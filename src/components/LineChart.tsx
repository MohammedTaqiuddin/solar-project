import React, { useRef, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartData,
  ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { format } from 'date-fns';
import { SensorData } from '../types/supabase';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface LineChartProps {
  data: SensorData[];
  dataKey: keyof Pick<SensorData, 'voltage' | 'current' | 'temperature' | 'power' | 'energy' | 'saving'>;
  title: string;
  color: string;
  borderColor: string;
  backgroundColor: string;
  isLoading: boolean;
}

const LineChart: React.FC<LineChartProps> = ({
  data,
  dataKey,
  title,
  color,
  borderColor,
  backgroundColor,
  isLoading,
}) => {
  const chartRef = useRef<ChartJS<'line'>>(null);

  useEffect(() => {
    // Update chart when data changes
    if (chartRef.current) {
      chartRef.current.update();
    }
  }, [data]);

  const chartData: ChartData<'line'> = {
    labels: data.map((item) => format(new Date(item.created_at), 'MM/dd HH:mm')),
    datasets: [
      {
        label: title,
        data: data.map((item) => item[dataKey] as number),
        borderColor,
        backgroundColor,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: color,
        pointBorderColor: '#fff',
        pointBorderWidth: 1,
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        titleColor: '#1F2937',
        bodyColor: '#4B5563',
        borderColor: '#E5E7EB',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 6,
        displayColors: true,
        boxPadding: 3,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        beginAtZero: false,
        grid: {
          color: 'rgba(243, 244, 246, 1)',
        },
      },
    },
    animation: {
      duration: 500,
    },
  };

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center bg-white rounded-xl shadow-sm p-4">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-4 w-28 bg-gray-200 rounded mb-3"></div>
          <div className="h-40 w-full bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 h-64">
      <Line ref={chartRef} data={chartData} options={options} />
    </div>
  );
};

export default LineChart;