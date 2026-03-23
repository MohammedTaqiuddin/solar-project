import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Scatter } from 'react-chartjs-2';
import { BrainCircuit, Sun, Thermometer, Cloud, Wind, Droplets, Clock, Calendar, Zap } from 'lucide-react';
import DashboardHeader from './DashboardHeader';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// In production (Nginx), API is proxied on the same domain
// In development, set to 'http://localhost:5000'
const API_URL = import.meta.env.DEV ? 'http://localhost:5000' : '';

interface DayPrediction {
  hour: number;
  predicted_kw: number;
}

interface FeatureImportance {
  feature: string;
  importance: number;
}

interface ModelInfo {
  feature_importance: FeatureImportance[];
  scatter: { actual: number[]; predicted: number[] };
  hourly_pattern: { actual: number[]; predicted: number[] };
  metrics: { r2: number; mae: number; rmse: number; model_name: string };
}

interface PredictionsProps {
  activeTab: 'dashboard' | 'predictions';
  onTabChange: (tab: 'dashboard' | 'predictions') => void;
}

const Predictions: React.FC<PredictionsProps> = ({ activeTab, onTabChange }) => {
  // Input state
  const [irradiance, setIrradiance] = useState(650);
  const [ambientTemp, setAmbientTemp] = useState(32);
  const [panelTemp, setPanelTemp] = useState(45);
  const [cloudCover, setCloudCover] = useState(20);
  const [windSpeed, setWindSpeed] = useState(3.5);
  const [humidity, setHumidity] = useState(50);
  const [hour, setHour] = useState(12);
  const [month, setMonth] = useState(6);

  // Output state
  const [predictedPower, setPredictedPower] = useState<number | null>(null);
  const [dayPredictions, setDayPredictions] = useState<DayPrediction[]>([]);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Fetch model info on mount
  useEffect(() => {
    fetch(`${API_URL}/model-info`)
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setModelInfo(data);
        setApiError(null);
      })
      .catch(err => setApiError('Cannot connect to prediction API. Make sure predict_api.py is running.'));
  }, []);

  const handlePredict = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const body = { irradiance, ambient_temp: ambientTemp, panel_temp: panelTemp, cloud_cover: cloudCover, wind_speed: windSpeed, humidity, hour, month };

      // Single prediction
      const res1 = await fetch(`${API_URL}/predict`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data1 = await res1.json();
      if (data1.error) throw new Error(data1.error);
      setPredictedPower(data1.predicted_power_kw);

      // 24-hour forecast
      const res2 = await fetch(`${API_URL}/predict-day`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data2 = await res2.json();
      if (data2.error) throw new Error(data2.error);
      setDayPredictions(data2.predictions);
    } catch (err: any) {
      setApiError(err.message || 'Prediction failed');
    } finally {
      setIsLoading(false);
    }
  };

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const sliderInput = (label: string, value: number, setValue: (v: number) => void, min: number, max: number, step: number, unit: string, icon: React.ReactNode) => (
    <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-xs font-medium text-gray-600">{label}</span>
        </div>
        <span className="text-sm font-bold text-gray-900">{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => setValue(Number(e.target.value))}
        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
      <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader activeTab={activeTab} onTabChange={onTabChange} />
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {apiError && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <p className="text-sm text-red-700">{apiError}</p>
        </div>
      )}

      {/* Input Form + Prediction Result */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Input sliders */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-medium text-gray-700 mb-3 flex items-center gap-2">
            <BrainCircuit size={20} className="text-indigo-600" />
            Input Parameters
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {sliderInput("Solar Irradiance", irradiance, setIrradiance, 0, 1200, 10, " W/m²", <Sun size={14} className="text-yellow-500" />)}
            {sliderInput("Ambient Temp", ambientTemp, setAmbientTemp, 0, 50, 0.5, "°C", <Thermometer size={14} className="text-orange-500" />)}
            {sliderInput("Panel Temp", panelTemp, setPanelTemp, 0, 80, 0.5, "°C", <Thermometer size={14} className="text-red-500" />)}
            {sliderInput("Cloud Cover", cloudCover, setCloudCover, 0, 100, 1, "%", <Cloud size={14} className="text-gray-400" />)}
            {sliderInput("Wind Speed", windSpeed, setWindSpeed, 0, 20, 0.5, " m/s", <Wind size={14} className="text-cyan-500" />)}
            {sliderInput("Humidity", humidity, setHumidity, 0, 100, 1, "%", <Droplets size={14} className="text-blue-400" />)}
            {sliderInput("Hour", hour, setHour, 0, 23, 1, "h", <Clock size={14} className="text-indigo-400" />)}
            <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-green-500" />
                  <span className="text-xs font-medium text-gray-600">Month</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{monthNames[month - 1]}</span>
              </div>
              <input
                type="range" min={1} max={12} step={1} value={month}
                onChange={e => setMonth(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                <span>Jan</span><span>Dec</span>
              </div>
            </div>
          </div>
          <button
            onClick={handlePredict}
            disabled={isLoading}
            className="mt-4 w-full sm:w-auto px-8 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <BrainCircuit size={18} />
            {isLoading ? 'Predicting...' : 'Predict Power Output'}
          </button>
        </div>

        {/* Prediction result */}
        <div className="flex flex-col justify-center">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={20} />
              <h3 className="text-sm font-medium opacity-90">Predicted Power Output</h3>
            </div>
            <div className="text-4xl font-bold mb-1">
              {predictedPower !== null ? `${predictedPower.toFixed(3)} kW` : '— kW'}
            </div>
            <p className="text-xs opacity-70">
              {predictedPower !== null ? `≈ ${(predictedPower * 1000).toFixed(0)} W` : 'Adjust inputs and click Predict'}
            </p>
            {modelInfo && (
              <div className="mt-4 pt-3 border-t border-white/20 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-bold">{modelInfo.metrics.r2}</div>
                  <div className="text-[10px] opacity-70">R² Score</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{modelInfo.metrics.mae}</div>
                  <div className="text-[10px] opacity-70">MAE (kW)</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{modelInfo.metrics.rmse}</div>
                  <div className="text-[10px] opacity-70">RMSE (kW)</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 24-Hour Forecast */}
        {dayPredictions.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4 h-72">
            <Line
              data={{
                labels: dayPredictions.map(p => `${p.hour}:00`),
                datasets: [{
                  label: 'Predicted Power (kW)',
                  data: dayPredictions.map(p => p.predicted_kw),
                  borderColor: '#6366f1',
                  backgroundColor: 'rgba(99,102,241,0.1)',
                  borderWidth: 2, pointRadius: 3, tension: 0.3, fill: true,
                }],
              }}
              options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: true }, title: { display: true, text: '24-Hour Power Forecast', font: { size: 14, weight: 'bold' } } },
                scales: { y: { beginAtZero: true, title: { display: true, text: 'kW' } } },
              }}
            />
          </div>
        )}

        {/* Feature Importance */}
        {modelInfo && (
          <div className="bg-white rounded-xl shadow-sm p-4 h-72">
            <Bar
              data={{
                labels: modelInfo.feature_importance.map(f => f.feature.replace(/_/g, ' ').replace(/W m2|pct|m s|C/g, '')),
                datasets: [{
                  label: 'Importance',
                  data: modelInfo.feature_importance.map(f => f.importance),
                  backgroundColor: modelInfo.feature_importance.map((_, i) =>
                    i === 0 ? '#4f46e5' : '#a5b4fc'
                  ),
                  borderRadius: 4,
                }],
              }}
              options={{
                responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                plugins: { legend: { display: false }, title: { display: true, text: 'Feature Importance (Gradient Boosting)', font: { size: 14, weight: 'bold' } } },
                scales: { x: { beginAtZero: true } },
              }}
            />
          </div>
        )}

        {/* Predictions vs Actual Scatter */}
        {modelInfo && (
          <div className="bg-white rounded-xl shadow-sm p-4 h-72">
            <Scatter
              data={{
                datasets: [
                  {
                    label: 'Predictions',
                    data: modelInfo.scatter.actual.map((a, i) => ({ x: a, y: modelInfo.scatter.predicted[i] })),
                    backgroundColor: 'rgba(6,182,212,0.3)',
                    pointRadius: 3,
                  },
                  {
                    label: 'Perfect',
                    data: [{ x: 0, y: 0 }, { x: 8, y: 8 }],
                    borderColor: '#ef4444',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    pointRadius: 0,
                    showLine: true,
                    type: 'line' as any,
                  },
                ],
              }}
              options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { title: { display: true, text: `Predictions vs Actual (R² = ${modelInfo.metrics.r2})`, font: { size: 14, weight: 'bold' } } },
                scales: {
                  x: { title: { display: true, text: 'Actual (kW)' }, beginAtZero: true },
                  y: { title: { display: true, text: 'Predicted (kW)' }, beginAtZero: true },
                },
              }}
            />
          </div>
        )}

        {/* Hourly Pattern */}
        {modelInfo && (
          <div className="bg-white rounded-xl shadow-sm p-4 h-72">
            <Line
              data={{
                labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
                datasets: [
                  {
                    label: 'Actual (avg)',
                    data: modelInfo.hourly_pattern.actual,
                    borderColor: '#16a34a',
                    backgroundColor: 'rgba(22,163,74,0.1)',
                    borderWidth: 2, pointRadius: 3, tension: 0.3, fill: true,
                  },
                  {
                    label: 'Predicted (avg)',
                    data: modelInfo.hourly_pattern.predicted,
                    borderColor: '#2563eb',
                    borderDash: [5, 5],
                    borderWidth: 2, pointRadius: 3, tension: 0.3,
                  },
                ],
              }}
              options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { title: { display: true, text: 'Avg Hourly Pattern — June (Actual vs Predicted)', font: { size: 14, weight: 'bold' } } },
                scales: { y: { beginAtZero: true, title: { display: true, text: 'kW' } } },
              }}
            />
          </div>
        )}
      </div>
    </main>
    </div>
  );
};

export default Predictions;
