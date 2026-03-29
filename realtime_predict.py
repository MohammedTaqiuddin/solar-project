"""
realtime_predict.py
====================
Bridges your ESP32 → Supabase data with the ML prediction model.

How it works:
1. Supabase calls this endpoint via a Database Webhook whenever a new
   row is inserted into sensor_data (set this up in Supabase dashboard).
2. This script fetches current weather (irradiance proxy, cloud, wind,
   humidity) from Open-Meteo (FREE, no API key needed).
3. Runs the Gradient Boosting model and writes predicted_kw back to
   the same Supabase row.

Run as a separate service on port 5001 alongside predict_api.py (port 5000).
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import requests
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

# ── Config ────────────────────────────────────────────────────
SUPABASE_URL     = os.environ.get("SUPABASE_URL", "https://yqriovmykzadncnozfmi.supabase.co")
SUPABASE_API_KEY = os.environ.get("SUPABASE_SERVICE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlxcmlvdm15a3phZG5jbm96Zm1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDk5ODE0MSwiZXhwIjoyMDg2NTc0MTQxfQ.-ylT5vIqckqK7RDIaXB8qTF_d5fPFb6697w3--hvvPY"
)

# Hyderabad coordinates (matches your dataset location)
LAT = 17.3850
LON = 78.4867

FEATURES = [
    "Solar_Irradiance_W_m2",
    "Ambient_Temperature_C",
    "Panel_Temperature_C",
    "Cloud_Cover_pct",
    "Wind_Speed_m_s",
    "Humidity_pct",
    "Hour",
    "Month",
]

# ── Load model once ───────────────────────────────────────────
print("Loading model...")
model = joblib.load("solar_model_Gradient_Boosting.pkl")
print("Model ready.")


# ── Weather helper ────────────────────────────────────────────
def get_weather():
    """
    Fetch current weather from Open-Meteo (free, no API key).
    Returns dict with irradiance, cloud_cover, wind_speed, humidity.
    """
    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={LAT}&longitude={LON}"
            f"&current=shortwave_radiation,cloudcover,windspeed_10m,relativehumidity_2m"
            f"&timezone=Asia/Kolkata"
        )
        r = requests.get(url, timeout=5)
        c = r.json()["current"]
        return {
            "irradiance":   float(c.get("shortwave_radiation", 0)),
            "cloud_cover":  float(c.get("cloudcover", 30)),
            "wind_speed":   float(c.get("windspeed_10m", 3)),
            "humidity":     float(c.get("relativehumidity_2m", 60)),
        }
    except Exception as e:
        print(f"Weather API error: {e} — using fallback values")
        now = datetime.now()
        hour = now.hour
        # Simple irradiance fallback based on time of day
        irr = max(0, 800 * abs((hour - 12) / 6 - 1)) if 6 <= hour <= 18 else 0
        return {
            "irradiance":  irr,
            "cloud_cover": 30,
            "wind_speed":  3.0,
            "humidity":    60.0,
        }


# ── Write prediction back to Supabase ────────────────────────
def update_supabase_prediction(row_id: int, predicted_kw: float,
                                irradiance: float, cloud_cover: float,
                                wind_speed: float, humidity: float):
    """Patch the sensor_data row with ML prediction + weather context."""
    url = f"{SUPABASE_URL}/rest/v1/sensor_data?id=eq.{row_id}"
    headers = {
        "apikey":        SUPABASE_API_KEY,
        "Authorization": f"Bearer {SUPABASE_API_KEY}",
        "Content-Type":  "application/json",
        "Prefer":        "return=minimal",
    }
    payload = {
        "predicted_kw": round(float(predicted_kw), 4),
        "irradiance":   round(float(irradiance), 2),
        "cloud_cover":  round(float(cloud_cover), 1),
        "wind_speed":   round(float(wind_speed), 2),
        "humidity":     round(float(humidity), 1),
    }
    r = requests.patch(url, json=payload, headers=headers, timeout=5)
    return r.status_code


# ── Webhook endpoint (called by Supabase Database Webhook) ────
@app.route("/webhook/sensor", methods=["POST"])
def sensor_webhook():
    """
    Supabase calls this every time a new row is inserted into sensor_data.
    Setup: Supabase Dashboard → Database → Webhooks → Insert on sensor_data
           → POST to http://YOUR_AWS_IP/webhook/sensor
    """
    try:
        data  = request.json
        # Supabase webhook sends: {"type": "INSERT", "record": {...}}
        record = data.get("record", data)

        row_id   = record.get("id")
        temp_c   = float(record.get("temperature", 30))
        now      = datetime.now()
        hour     = now.hour
        month    = now.month

        # Get live weather from Open-Meteo
        weather  = get_weather()

        # Build feature vector
        inp = pd.DataFrame([[
            weather["irradiance"],
            temp_c,          # ambient temp from ESP32 DS18B20
            temp_c + 10,     # panel temp estimate (ambient + ~10°C heat rise)
            weather["cloud_cover"],
            weather["wind_speed"],
            weather["humidity"],
            hour,
            month,
        ]], columns=FEATURES)

        predicted_kw = float(max(0, model.predict(inp)[0]))

        # Write back to Supabase
        status = update_supabase_prediction(
            row_id, predicted_kw,
            weather["irradiance"], weather["cloud_cover"],
            weather["wind_speed"], weather["humidity"]
        )

        print(f"[{now.strftime('%H:%M:%S')}] Row {row_id} → "
              f"Predicted: {predicted_kw:.3f} kW | "
              f"Irr: {weather['irradiance']:.0f} W/m² | "
              f"Supabase PATCH: {status}")

        return jsonify({
            "status":        "ok",
            "row_id":        row_id,
            "predicted_kw":  predicted_kw,
            "weather_used":  weather,
        })

    except Exception as e:
        print(f"Webhook error: {e}")
        return jsonify({"error": str(e)}), 500


# ── Manual trigger endpoint (for testing) ─────────────────────
@app.route("/trigger-prediction/<int:row_id>", methods=["GET"])
def trigger_prediction(row_id):
    """Manually trigger a prediction for any existing Supabase row."""
    try:
        # Fetch the row from Supabase
        url = f"{SUPABASE_URL}/rest/v1/sensor_data?id=eq.{row_id}&select=*"
        headers = {
            "apikey":        SUPABASE_API_KEY,
            "Authorization": f"Bearer {SUPABASE_API_KEY}",
        }
        r = requests.get(url, headers=headers, timeout=5)
        rows = r.json()
        if not rows:
            return jsonify({"error": f"Row {row_id} not found"}), 404

        record = rows[0]
        temp_c = float(record.get("temperature", 30))
        now    = datetime.now()
        weather = get_weather()

        inp = pd.DataFrame([[
            weather["irradiance"],
            temp_c,
            temp_c + 10,
            weather["cloud_cover"],
            weather["wind_speed"],
            weather["humidity"],
            now.hour,
            now.month,
        ]], columns=FEATURES)

        predicted_kw = float(max(0, model.predict(inp)[0]))
        update_supabase_prediction(
            row_id, predicted_kw,
            weather["irradiance"], weather["cloud_cover"],
            weather["wind_speed"], weather["humidity"]
        )

        return jsonify({
            "row_id":       row_id,
            "predicted_kw": round(float(predicted_kw), 4),
            "weather":      weather,
            "temperature":  temp_c,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Health check ──────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    weather = get_weather()
    return jsonify({
        "status":          "online",
        "model":           "Gradient Boosting",
        "current_weather": weather,
        "time":            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    })


if __name__ == "__main__":
    print("Starting realtime prediction bridge on port 5001")
    app.run(host="0.0.0.0", port=5001, debug=False)
