import React, { useState, useEffect, useCallback } from 'react';
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
import {
  BrainCircuit, Sun, Thermometer, Cloud, Wind,
  Droplets, Clock, Calendar, Zap, RefreshCw, Wifi, WifiOff
} from 'lucide-react';
import DashboardHeader from './DashboardHeader';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, Filler
);

const API_URL = import.meta.env.DEV ? 'http://localhost:5000' : '';

// Hyderabad coordinates
const LAT = 17.3850;
const LON = 78.4867;

interface DayPrediction { hour: number; predicted_kw: number; }
interface FeatureImportance { feature: string; importance: number; }
interface ModelInfo {
  feature_importance: FeatureImportance[];
  scatter: { actual: number[]; predicted: number[] };
  hourly_pattern: { actual: number[]; predicted: number[] };
  metrics: { r2: number; mae: number; rmse: number; model_name: string };
}
interface WeatherData {
  irradiance: number;
  cloud_cover: number;
  wind_speed: number;
  humidity: number;
  ambient_temp: number;
}
interface PredictionsProps {
  activeTab: 'dashboard' | 'predictions';
  onTabChange: (tab: 'dashboard' | 'predictions') => void;
}

const Predictions: React.FC<PredictionsProps> = ({ activeTab, onTabChange }) => {
  // Inputs — will be auto-filled from live weather
  const [irradiance, setIrradiance] = useState(0);
  const [ambientTemp, setAmbientTemp] = useState(30);
  const [panelTemp, setPanelTemp] = useState(40);
  const [cloudCover, setCloudCover] = useState(30);
  const [windSpeed, setWindSpeed] = useState(3);
  const [humidity, setHumidity] = useState(60);
  const [hour, setHour] = useState(new Date().getHours());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  // State
  const [predictedPower, setPredictedPower] = useState<number | null>(null);
  const [dayPredictions, setDayPredictions] = useState<DayPrediction[]>([]);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [liveWeather, setLiveWeather] = useState<WeatherData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // ── Fetch live weather from Open-Meteo ──────────────────────
  const fetchLiveWeather = useCallback(async () => {
    setIsWeatherLoading(true);
    setWeatherError(null);
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${LAT}&longitude=${LON}` +
        `&current=shortwave_radiation,cloudcover,windspeed_10m,` +
        `relativehumidity_2m,temperature_2m` +
        `&timezone=Asia/Kolkata`;

      const res = await fetch(url);
      const data = await res.json();
      const c = data.current;

      const weather: WeatherData = {
        irradiance: Math.round(c.shortwave_radiation ?? 0),
        cloud_cover: Math.round(c.cloudcover ?? 30),
        wind_speed: parseFloat((c.windspeed_10m ?? 3).toFixed(1)),
        humidity: Math.round(c.relativehumidity_2m ?? 60),
        ambient_temp: parseFloat((c.temperature_2m ?? 30).toFixed(1)),
      };

      // Auto-fill all sliders with real values
      setIrradiance(weather.irradiance);
      setCloudCover(weather.cloud_cover);
      setWindSpeed(weather.wind_speed);
      setHumidity(weather.humidity);
      setAmbientTemp(weather.ambient_temp);
      setPanelTemp(parseFloat((weather.ambient_temp + 10).toFixed(1)));

      // Set current time
      const now = new Date();
      setHour(now.getHours());
      setMonth(now.getMonth() + 1);

      setLiveWeather(weather);
      setLastUpdated(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setIsLive(true);

      return weather;
    } catch (err) {
      setWeatherError('Could not fetch live weather. Using last values.');
      setIsLive(false);
      return null;
    } finally {
      setIsWeatherLoading(false);
    }
  }, []);

  // ── Run ML prediction ────────────────────────────────────────
  const runPrediction = useCallback(async (
    irrVal: number, ambVal: number, panVal: number,
    cldVal: number, wndVal: number, humVal: number,
    hrVal: number, monVal: number
  ) => {
    setIsLoading(true);
    setApiError(null);
    try {
      const body = {
        irradiance: irrVal, ambient_temp: ambVal, panel_temp: panVal,
        cloud_cover: cldVal, wind_speed: wndVal, humidity: humVal,
        hour: hrVal, month: monVal,
      };

      const [res1, res2] = await Promise.all([
        fetch(`${API_URL}/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        fetch(`${API_URL}/predict-day`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      ]);

      const data1 = await res1.json();
      const data2 = await res2.json();

      if (data1.error) throw new Error(data1.error);
      if (data2.error) throw new Error(data2.error);

      setPredictedPower(data1.predicted_power_kw);
      setDayPredictions(data2.predictions);
    } catch (err: any) {
      setApiError(err.message || 'Prediction failed. Is Flask running?');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── On mount: fetch weather + auto-predict ──────
  useEffect(() => {
    // Fetch weather then immediately predict with live values
    fetchLiveWeather().then(weather => {
      if (weather) {
        const now = new Date();
        runPrediction(
          weather.irradiance,
          weather.ambient_temp,
          weather.ambient_temp + 10,
          weather.cloud_cover,
          weather.wind_speed,
          weather.humidity,
          now.getHours(),
          now.getMonth() + 1
        );
      }
    });
  }, []);

  // ── Re-fetch model info when month changes ──────
  useEffect(() => {
    fetch(`${API_URL}/model-info?month=${month}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setModelInfo(d); })
      .catch(() => setApiError('Cannot connect to prediction API.'));
  }, [month]);

  // ── Manual predict (button click) ───────────────────────────
  const handlePredict = () => {
    runPrediction(irradiance, ambientTemp, panelTemp, cloudCover, windSpeed, humidity, hour, month);
  };

  // ── Refresh live weather + re-predict ───────────────────────
  const handleRefresh = async () => {
    const weather = await fetchLiveWeather();
    if (weather) {
      const now = new Date();
      await runPrediction(
        weather.irradiance, weather.ambient_temp, weather.ambient_temp + 10,
        weather.cloud_cover, weather.wind_speed, weather.humidity,
        now.getHours(), now.getMonth() + 1
      );
    }
  };

  // ── Slider helper ────────────────────────────────────────────
  const sliderInput = (
    label: string, value: number,
    setValue: (v: number) => void,
    min: number, max: number, step: number,
    unit: string, icon: React.ReactNode, isLiveField = false
  ) => (
    <div className={`bg-white rounded-lg p-3 shadow-sm border ${isLiveField && isLive ? 'border-green-300' : 'border-gray-100'}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-xs font-medium text-gray-600">{label}</span>
          {isLiveField && isLive && (
            <span className="text-[9px] bg-green-100 text-green-700 px-1 rounded font-medium">LIVE</span>
          )}
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

        {/* Live weather status bar */}
        <div className={`flex items-center justify-between mb-4 px-4 py-2 rounded-lg text-sm
          ${isLive ? 'bg-green-50 border border-green-200' : 'bg-gray-100 border border-gray-200'}`}>
          <div className="flex items-center gap-2">
            {isLive
              ? <Wifi size={14} className="text-green-600" />
              : <WifiOff size={14} className="text-gray-400" />}
            <span className={isLive ? 'text-green-700 font-medium' : 'text-gray-500'}>
              {isWeatherLoading
                ? 'Fetching live weather from Hyderabad...'
                : isLive
                  ? `Live weather loaded — Hyderabad  |  Last updated: ${lastUpdated}`
                  : 'Weather offline — using manual values'}
            </span>
            {isLive && liveWeather && (
              <span className="text-green-600 text-xs">
                | {liveWeather.irradiance} W/m²  {liveWeather.cloud_cover}% cloud  {liveWeather.ambient_temp}°C
              </span>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={isWeatherLoading || isLoading}
            className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 rounded-md
                       text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={12} className={isWeatherLoading ? 'animate-spin' : ''} />
            Refresh now
          </button>
        </div>

        {/* API error */}
        {apiError && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded">
            <p className="text-sm text-red-700">{apiError}</p>
          </div>
        )}
        {weatherError && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4 rounded">
            <p className="text-sm text-yellow-700">{weatherError}</p>
          </div>
        )}

        {/* Input Form + Prediction Result */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium text-gray-700 flex items-center gap-2">
                <BrainCircuit size={20} className="text-indigo-600" />
                Input Parameters
              </h2>
              <span className="text-xs text-gray-400">
                {isLive ? 'Green border = auto-filled from live weather' : 'Manual mode'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {sliderInput("Solar Irradiance", irradiance, setIrradiance, 0, 1200, 10, " W/m²",
                <Sun size={14} className="text-yellow-500" />, true)}
              {sliderInput("Ambient Temp", ambientTemp, setAmbientTemp, 0, 50, 0.5, "°C",
                <Thermometer size={14} className="text-orange-500" />, true)}
              {sliderInput("Panel Temp", panelTemp, setPanelTemp, 0, 80, 0.5, "°C",
                <Thermometer size={14} className="text-red-500" />)}
              {sliderInput("Cloud Cover", cloudCover, setCloudCover, 0, 100, 1, "%",
                <Cloud size={14} className="text-gray-400" />, true)}
              {sliderInput("Wind Speed", windSpeed, setWindSpeed, 0, 20, 0.5, " m/s",
                <Wind size={14} className="text-cyan-500" />, true)}
              {sliderInput("Humidity", humidity, setHumidity, 0, 100, 1, "%",
                <Droplets size={14} className="text-blue-400" />, true)}
              {sliderInput("Hour", hour, setHour, 0, 23, 1, "h",
                <Clock size={14} className="text-indigo-400" />, true)}
              <div className={`bg-white rounded-lg p-3 shadow-sm border ${isLive ? 'border-green-300' : 'border-gray-100'}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-green-500" />
                    <span className="text-xs font-medium text-gray-600">Month</span>
                    {isLive && <span className="text-[9px] bg-green-100 text-green-700 px-1 rounded font-medium">LIVE</span>}
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
            <div className="flex gap-3 mt-4">
              <button
                onClick={handlePredict}
                disabled={isLoading}
                className="px-8 py-2.5 bg-indigo-600 text-white font-medium rounded-lg
                           hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors flex items-center gap-2"
              >
                <BrainCircuit size={18} />
                {isLoading ? 'Predicting...' : 'Predict Power Output'}
              </button>
              <button
                onClick={handleRefresh}
                disabled={isWeatherLoading || isLoading}
                className="px-4 py-2.5 bg-green-600 text-white font-medium rounded-lg
                           hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors flex items-center gap-2"
              >
                <RefreshCw size={16} className={isWeatherLoading ? 'animate-spin' : ''} />
                Use Live Weather
              </button>
            </div>
          </div>

          {/* Prediction result card */}
          <div className="flex flex-col justify-center">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap size={20} />
                  <h3 className="text-sm font-medium opacity-90">Predicted Power Output</h3>
                </div>
                {isLive && (
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">
                    Live — {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <div className="text-4xl font-bold mb-1">
                {isLoading
                  ? <span className="text-2xl opacity-70">Predicting...</span>
                  : predictedPower !== null
                    ? `${predictedPower.toFixed(3)} kW`
                    : '— kW'}
              </div>
              <p className="text-xs opacity-70">
                {predictedPower !== null
                  ? `≈ ${(predictedPower * 1000).toFixed(0)} W  |  Hour ${hour}:00, ${monthNames[month - 1]}`
                  : 'Loading live prediction...'}
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
                  plugins: {
                    legend: { display: true },
                    title: { display: true, text: `24-Hour Power Forecast — ${monthNames[month - 1]} (Live weather)`, font: { size: 13, weight: 'bold' } }
                  },
                  scales: { y: { beginAtZero: true, title: { display: true, text: 'kW' } } },
                }}
              />
            </div>
          )}

          {modelInfo && (
            <div className="bg-white rounded-xl shadow-sm p-4 h-72">
              <Bar
                data={{
                  labels: modelInfo.feature_importance.map(f =>
                    f.feature.replace(/_/g, ' ').replace(/W m2|pct|m s|_C$/g, '').trim()
                  ),
                  datasets: [{
                    label: 'Importance',
                    data: modelInfo.feature_importance.map(f => f.importance),
                    backgroundColor: modelInfo.feature_importance.map((_, i) => i === 0 ? '#4f46e5' : '#a5b4fc'),
                    borderRadius: 4,
                  }],
                }}
                options={{
                  responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                  plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Feature Importance (Gradient Boosting)', font: { size: 13, weight: 'bold' } }
                  },
                  scales: { x: { beginAtZero: true } },
                }}
              />
            </div>
          )}

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
                  plugins: { title: { display: true, text: `Predictions vs Actual (R² = ${modelInfo?.metrics.r2})`, font: { size: 13, weight: 'bold' } } },
                  scales: {
                    x: { title: { display: true, text: 'Actual (kW)' }, beginAtZero: true },
                    y: { title: { display: true, text: 'Predicted (kW)' }, beginAtZero: true },
                  },
                }}
              />
            </div>
          )}

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
                  plugins: { title: { display: true, text: `Avg Hourly Pattern — ${new Date(2000, month - 1, 1).toLocaleString('default', { month: 'long' })} (Actual vs Predicted)`, font: { size: 13, weight: 'bold' } } },
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