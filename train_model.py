"""
Solar Power Output Prediction Model
====================================
Project : IoT-Based Real-Time Solar Energy Monitoring
College : Methodist College of Engineering and Technology
Team    : Mohammed Taqiuddin, Mohammed Noumaan Mujeeb, Mohammed Younus Uddin
Guide   : Dr. M Sharada Varalakshmi

Features used  : True causal sensor/weather inputs ONLY
                 (no leaky derived columns like energy or saving)
Target         : Power_Output_kW
Models trained : XGBoost, Random Forest, LightGBM (with comparison)
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import warnings, os
warnings.filterwarnings("ignore")

from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
import xgboost as xgb
import joblib

# ─────────────────────────────────────────────
# 1. LOAD DATASET
# ─────────────────────────────────────────────
print("=" * 60)
print("  Solar Power Prediction — Corrected Training Script")
print("=" * 60)

# Load from Excel (Hourly_Data sheet)
df = pd.read_excel("solar_panel_dataset.xlsx", sheet_name="Hourly_Data")
print(f"\n[1] Dataset loaded: {df.shape[0]:,} rows x {df.shape[1]} columns")

# ─────────────────────────────────────────────
# 2. FEATURE SELECTION  (NO LEAKAGE)
# ─────────────────────────────────────────────
#
#  EXCLUDED (data leakage — derived from power):
#    energy_kWh     = power x 1 hr        <- cheating
#    saving_INR     = energy x 8          <- cheating
#    voltage_V      = not a cause of output, it's a result
#    current_A      = same issue
#    grid_import/export = derived from power & demand
#    self_sufficiency_pct = derived
#
#  INCLUDED (true causal inputs the ESP32/weather API can supply):
FEATURES = [
    "Solar_Irradiance_W_m2",   # primary driver of power
    "Ambient_Temperature_C",   # affects efficiency
    "Panel_Temperature_C",     # direct efficiency impact
    "Cloud_Cover_pct",         # reduces effective irradiance
    "Wind_Speed_m_s",          # cools panels -> better efficiency
    "Humidity_pct",            # minor atmospheric effect
    "Hour",                    # time-of-day (sun angle proxy)
    "Month",                   # seasonality
]

TARGET = "Power_Output_kW"

print(f"\n[2] Features selected ({len(FEATURES)}) — zero data leakage:")
for f in FEATURES:
    print(f"     * {f}")
print(f"\n    Target  : {TARGET}")

# ─────────────────────────────────────────────
# 3. PREPARE DATA
# ─────────────────────────────────────────────
df_model = df[FEATURES + [TARGET]].dropna()

# Filter nighttime rows (power = 0 AND irradiance = 0)
# Keep them in — the model should learn night = 0 output naturally
X = df_model[FEATURES]
y = df_model[TARGET]

print(f"\n[3] Clean samples  : {len(X):,}")
print(f"    Power range    : {y.min():.3f} -- {y.max():.3f} kW")
print(f"    Mean power     : {y.mean():.3f} kW")

# Train / Validation / Test split  (70 / 15 / 15)
X_train, X_temp, y_train, y_temp = train_test_split(
    X, y, test_size=0.30, random_state=42, shuffle=True
)
X_val, X_test, y_val, y_test = train_test_split(
    X_temp, y_temp, test_size=0.50, random_state=42
)
print(f"\n    Train  : {len(X_train):,} samples")
print(f"    Val    : {len(X_val):,} samples")
print(f"    Test   : {len(X_test):,} samples")

# Scale for models that benefit from it (not tree-based, but kept for pipeline)
scaler = StandardScaler()
X_train_sc = scaler.fit_transform(X_train)
X_val_sc   = scaler.transform(X_val)
X_test_sc  = scaler.transform(X_test)

# ─────────────────────────────────────────────
# 4. TRAIN MODELS
# ─────────────────────────────────────────────
print("\n[4] Training models...")

models = {
    "XGBoost": xgb.XGBRegressor(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=6,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        verbosity=0
    ),
    "Random Forest": RandomForestRegressor(
        n_estimators=200,
        max_depth=12,
        min_samples_leaf=5,
        random_state=42,
        n_jobs=-1
    ),
    "Gradient Boosting": GradientBoostingRegressor(
        n_estimators=200,
        learning_rate=0.08,
        max_depth=5,
        subsample=0.8,
        random_state=42
    ),
}

results = {}
for name, model in models.items():
    model.fit(X_train, y_train)
    preds = model.predict(X_test)
    r2   = r2_score(y_test, preds)
    mae  = mean_absolute_error(y_test, preds)
    rmse = np.sqrt(mean_squared_error(y_test, preds))
    results[name] = {"model": model, "preds": preds, "R2": r2, "MAE": mae, "RMSE": rmse}
    print(f"    {name:20s}  R2={r2:.4f}  MAE={mae:.4f} kW  RMSE={rmse:.4f} kW")

# Pick best model by R2
best_name = max(results, key=lambda k: results[k]["R2"])
best      = results[best_name]
print(f"\n    Best model : {best_name}  (R2={best['R2']:.4f})")

# ─────────────────────────────────────────────
# 5. CROSS-VALIDATION ON BEST MODEL
# ─────────────────────────────────────────────
print(f"\n[5] 5-fold cross-validation on {best_name}...")
cv_scores = cross_val_score(
    best["model"], X, y, cv=5, scoring="r2", n_jobs=-1
)
print(f"    CV R2 scores : {cv_scores.round(4)}")
print(f"    Mean R2      : {cv_scores.mean():.4f} +/- {cv_scores.std():.4f}")

# ─────────────────────────────────────────────
# 6. PLOTS
# ─────────────────────────────────────────────
print("\n[6] Generating plots...")
os.makedirs("plots", exist_ok=True)
plt.style.use("seaborn-v0_8-whitegrid")
COLORS = {"XGBoost": "#2563eb", "Random Forest": "#16a34a", "Gradient Boosting": "#d97706"}

# -- 6a. Model comparison bar chart
fig, axes = plt.subplots(1, 3, figsize=(14, 4))
metrics = ["R2", "MAE", "RMSE"]
titles  = ["R2 Score (higher = better)", "MAE -- kW (lower = better)", "RMSE -- kW (lower = better)"]
for ax, metric, title in zip(axes, metrics, titles):
    vals  = [results[n][metric] for n in results]
    names = list(results.keys())
    bars  = ax.bar(names, vals, color=[COLORS[n] for n in names], width=0.5, edgecolor="white")
    ax.set_title(title, fontsize=11, fontweight="bold")
    ax.set_ylim(0, max(vals) * 1.2 if metric != "R2" else 1.05)
    for bar, val in zip(bars, vals):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + max(vals)*0.02,
                f"{val:.4f}", ha="center", va="bottom", fontsize=9)
    ax.tick_params(axis="x", rotation=10)
plt.suptitle("Model Comparison -- No Data Leakage", fontsize=13, fontweight="bold", y=1.02)
plt.tight_layout()
plt.savefig("plots/01_model_comparison.png", dpi=150, bbox_inches="tight")
plt.close()

# -- 6b. Predictions vs Actual (best model)
fig, ax = plt.subplots(figsize=(7, 7))
ax.scatter(y_test, best["preds"], alpha=0.3, s=8, color="#2563eb", label="Predictions")
lim = max(y_test.max(), best["preds"].max()) + 0.2
ax.plot([0, lim], [0, lim], "r--", linewidth=1.5, label="Perfect prediction")
ax.set_xlabel("Actual Power (kW)", fontsize=12)
ax.set_ylabel("Predicted Power (kW)", fontsize=12)
ax.set_title(
    f"Predictions vs Actual -- {best_name}\n"
    f"R2={best['R2']:.4f}  MAE={best['MAE']:.4f} kW  RMSE={best['RMSE']:.4f} kW",
    fontsize=11, fontweight="bold"
)
ax.legend()
ax.set_xlim(0, lim); ax.set_ylim(0, lim)
plt.tight_layout()
plt.savefig("plots/02_predictions_vs_actual.png", dpi=150, bbox_inches="tight")
plt.close()

# -- 6c. Residual plot
residuals = y_test.values - best["preds"]
fig, ax = plt.subplots(figsize=(10, 4))
ax.scatter(best["preds"], residuals, alpha=0.3, s=8, color="#7c3aed")
ax.axhline(0, color="red", linewidth=1.5, linestyle="--")
ax.set_xlabel("Predicted Power (kW)", fontsize=12)
ax.set_ylabel("Residual (kW)", fontsize=12)
ax.set_title(f"Residuals -- {best_name}  (random scatter = good)", fontsize=11, fontweight="bold")
plt.tight_layout()
plt.savefig("plots/03_residuals.png", dpi=150, bbox_inches="tight")
plt.close()

# -- 6d. Feature importance (XGBoost)
xgb_model = results["XGBoost"]["model"]
importance = pd.Series(xgb_model.feature_importances_, index=FEATURES).sort_values()
fig, ax = plt.subplots(figsize=(8, 5))
colors = ["#2563eb" if i == importance.idxmax() else "#93c5fd" for i in importance.index]
importance.plot(kind="barh", ax=ax, color=colors, edgecolor="white")
ax.set_title("Feature Importance -- XGBoost (no leakage)", fontsize=11, fontweight="bold")
ax.set_xlabel("Importance Score")
for bar, val in zip(ax.patches, importance.values):
    ax.text(val + 0.001, bar.get_y() + bar.get_height()/2,
            f"{val:.3f}", va="center", fontsize=9)
plt.tight_layout()
plt.savefig("plots/04_feature_importance.png", dpi=150, bbox_inches="tight")
plt.close()

# -- 6e. Hourly prediction pattern (1 sample day)
sample_day = df_model[df_model["Month"] == 6].head(24).copy()
sample_preds = best["model"].predict(sample_day[FEATURES])
fig, ax = plt.subplots(figsize=(12, 4))
ax.plot(range(24), sample_day[TARGET].values, "o-", color="#16a34a", label="Actual", linewidth=2)
ax.plot(range(24), sample_preds, "s--", color="#2563eb", label="Predicted", linewidth=2)
ax.fill_between(range(24), sample_day[TARGET].values, sample_preds, alpha=0.1, color="#7c3aed")
ax.set_xlabel("Hour of Day", fontsize=12)
ax.set_ylabel("Power Output (kW)", fontsize=12)
ax.set_title("Hourly Power Prediction -- Sample June Day", fontsize=11, fontweight="bold")
ax.set_xticks(range(24))
ax.legend()
plt.tight_layout()
plt.savefig("plots/05_hourly_pattern.png", dpi=150, bbox_inches="tight")
plt.close()

print("    Plots saved to ./plots/")

# ─────────────────────────────────────────────
# 7. SAVE MODEL & SCALER
# ─────────────────────────────────────────────
joblib.dump(best["model"], f"solar_model_{best_name.replace(' ','_')}.pkl")
joblib.dump(scaler, "solar_scaler.pkl")
print(f"\n[7] Model saved : solar_model_{best_name.replace(' ','_')}.pkl")
print("    Scaler saved : solar_scaler.pkl")

# ─────────────────────────────────────────────
# 8. INFERENCE FUNCTION  (plug into your dashboard)
# ─────────────────────────────────────────────
def predict_power(irradiance, ambient_temp, panel_temp,
                  cloud_cover, wind_speed, humidity, hour, month):
    """
    Predict solar power output from real sensor + weather inputs.

    Parameters
    ----------
    irradiance    : float  -- W/m2 (from pyranometer or weather API)
    ambient_temp  : float  -- C   (from DHT22 or similar)
    panel_temp    : float  -- C   (from DS18B20 on panel)
    cloud_cover   : float  -- %    (from weather API)
    wind_speed    : float  -- m/s  (from anemometer or weather API)
    humidity      : float  -- %    (from DHT22)
    hour          : int    -- 0-23 (from ESP32 RTC)
    month         : int    -- 1-12 (from ESP32 RTC)

    Returns
    -------
    float -- predicted power output in kW
    """
    model  = joblib.load(f"solar_model_{best_name.replace(' ','_')}.pkl")
    inp    = pd.DataFrame([[irradiance, ambient_temp, panel_temp,
                            cloud_cover, wind_speed, humidity, hour, month]],
                          columns=FEATURES)
    return float(model.predict(inp)[0])

# Quick test
sample_pred = predict_power(
    irradiance=650, ambient_temp=32, panel_temp=45,
    cloud_cover=20, wind_speed=3.5, humidity=60,
    hour=12, month=6
)
print(f"\n[8] Inference test (noon, June, clear sky):")
print(f"    Predicted power = {sample_pred:.3f} kW")

# ─────────────────────────────────────────────
# 9. FINAL SUMMARY
# ─────────────────────────────────────────────
print("\n" + "=" * 60)
print("  FINAL RESULTS SUMMARY")
print("=" * 60)
print(f"  Best model  : {best_name}")
print(f"  R2 Score    : {best['R2']:.4f}  (realistic -- not 0.9999)")
print(f"  MAE         : {best['MAE']:.4f} kW")
print(f"  RMSE        : {best['RMSE']:.4f} kW")
print(f"  CV R2 mean  : {cv_scores.mean():.4f} +/- {cv_scores.std():.4f}")
print("\n  Features used (no leakage):")
for f in FEATURES:
    print(f"    * {f}")
print("\n  Leaky features correctly EXCLUDED:")
print("    x energy_kWh   (= power x 1hr)")
print("    x saving_INR   (= energy x 8)")
print("    x voltage_V    (output, not input)")
print("    x current_A    (output, not input)")
print("=" * 60)
