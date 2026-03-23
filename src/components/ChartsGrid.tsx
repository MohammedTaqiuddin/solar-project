import React from 'react';
import LineChart from './LineChart';
import { SensorData } from '../types/supabase';

interface ChartsGridProps {
  data: SensorData[];
  isLoading: boolean;
}

const ChartsGrid: React.FC<ChartsGridProps> = ({ data, isLoading }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <LineChart
        data={data}
        dataKey="voltage"
        title="Voltage (V)"
        color="#3B82F6"
        borderColor="rgba(59, 130, 246, 0.8)"
        backgroundColor="rgba(59, 130, 246, 0.1)"
        isLoading={isLoading}
      />
      <LineChart
        data={data}
        dataKey="current"
        title="Current (A)"
        color="#8B5CF6"
        borderColor="rgba(139, 92, 246, 0.8)"
        backgroundColor="rgba(139, 92, 246, 0.1)"
        isLoading={isLoading}
      />
      <LineChart
        data={data}
        dataKey="temperature"
        title="Temperature (°C)"
        color="#F97316"
        borderColor="rgba(249, 115, 22, 0.8)"
        backgroundColor="rgba(249, 115, 22, 0.1)"
        isLoading={isLoading}
      />
      <LineChart
        data={data}
        dataKey="power"
        title="Power (W)"
        color="#14B8A6"
        borderColor="rgba(20, 184, 166, 0.8)"
        backgroundColor="rgba(20, 184, 166, 0.1)"
        isLoading={isLoading}
      />
      <LineChart
        data={data}
        dataKey="energy"
        title="Energy (kWh)"
        color="#EAB308"
        borderColor="rgba(234, 179, 8, 0.8)"
        backgroundColor="rgba(234, 179, 8, 0.1)"
        isLoading={isLoading}
      />
      <LineChart
        data={data}
        dataKey="saving"
        title="Saving (₹)"
        color="#22C55E"
        borderColor="rgba(34, 197, 94, 0.8)"
        backgroundColor="rgba(34, 197, 94, 0.1)"
        isLoading={isLoading}
      />
    </div>
  );
};

export default ChartsGrid;