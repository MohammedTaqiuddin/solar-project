"""
Flask Prediction API for Solar Power Model
===========================================
Serves the trained Gradient Boosting model via REST endpoints.
Run: python predict_api.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import numpy as np
import os

app = Flask(__name__)
CORS(app)

# Load model once at startup
MODEL_PATH = os.path.join("solar_model_Gradient_Boosting.pkl")
DATASET_PATH = "solar_panel_dataset.xlsx"

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

print("Loading model...")
model = joblib.load(MODEL_PATH)
print("Model loaded successfully!")


@app.route("/predict", methods=["POST"])
def predict():
    """Single-point prediction."""
    try:
        data = request.json
        inp = pd.DataFrame([[
            float(data.get("irradiance", 0)),
            float(data.get("ambient_temp", 30)),
            float(data.get("panel_temp", 40)),
            float(data.get("cloud_cover", 20)),
            float(data.get("wind_speed", 3)),
            float(data.get("humidity", 50)),
            int(data.get("hour", 12)),
            int(data.get("month", 6)),
        ]], columns=FEATURES)

        prediction = float(model.predict(inp)[0])
        return jsonify({"predicted_power_kw": round(float(prediction), 4)})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/predict-day", methods=["POST"])
def predict_day():
    """Predict power output for all 24 hours of a day."""
    try:
        data = request.json
        predictions = []
        for hour in range(24):
            inp = pd.DataFrame([[
                float(data.get("irradiance", 0)),
                float(data.get("ambient_temp", 30)),
                float(data.get("panel_temp", 40)),
                float(data.get("cloud_cover", 20)),
                float(data.get("wind_speed", 3)),
                float(data.get("humidity", 50)),
                hour,
                int(data.get("month", 6)),
            ]], columns=FEATURES)
            pred = float(model.predict(inp)[0])
            predictions.append({"hour": hour, "predicted_kw": round(float(max(pred, 0)), 4)})
        return jsonify({"predictions": predictions})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/model-info", methods=["GET"])
def model_info():
    """Return feature importance, metrics, and sample predictions."""
    try:
        # Feature importance
        importances = model.feature_importances_.tolist()
        fi = [{"feature": f, "importance": round(float(v), 4)}
              for f, v in sorted(zip(FEATURES, importances),
                                 key=lambda x: x[1], reverse=True)]

        # Load training data for sample predictions chart
        df = pd.read_excel(DATASET_PATH, sheet_name="Hourly_Data")
        sample = df.sample(n=min(200, len(df)), random_state=42)
        X_sample = sample[FEATURES]
        y_actual = sample["Power_Output_kW"].tolist()
        y_pred = model.predict(X_sample).tolist()

        # Hourly pattern — average actual vs predicted for a summer month
        june = df[df["Month"] == 6].copy()
        hourly_actual = june.groupby("Hour")["Power_Output_kW"].mean().tolist()
        june_preds = model.predict(june[FEATURES])
        june["pred"] = june_preds
        hourly_pred = june.groupby("Hour")["pred"].mean().tolist()

        return jsonify({
            "feature_importance": fi,
            "scatter": {
                "actual": [round(float(v), 4) for v in y_actual],
                "predicted": [round(float(v), 4) for v in y_pred],
            },
            "hourly_pattern": {
                "actual": [round(float(v), 4) for v in hourly_actual],
                "predicted": [round(float(v), 4) for v in hourly_pred],
            },
            "metrics": {
                "r2": 0.9993,
                "mae": 0.0352,
                "rmse": 0.0478,
                "model_name": "Gradient Boosting",
            },
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400


if __name__ == "__main__":
    print("Starting prediction API on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=False)
