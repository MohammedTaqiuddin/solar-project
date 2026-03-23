import React from 'react';
import { Zap, Thermometer, Gauge, Bolt, Battery, Coins } from 'lucide-react';
import CurrentValueCard from './CurrentValueCard';
import { SensorData } from '../types/supabase';

interface CurrentValuesGridProps {
  data: SensorData | null;
  previousData: SensorData | null;
  isLoading: boolean;
}

const CurrentValuesGrid: React.FC<CurrentValuesGridProps> = ({ 
  data, 
  previousData,
  isLoading
}) => {
  // Calculate percentage change for each value
  const calculateChange = (current: number | null, previous: number | null): number => {
    if (current === null || previous === null || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <CurrentValueCard
        title="Voltage"
        value={data?.voltage || null}
        unit="V"
        icon={<Zap className="h-5 w-5 text-blue-600" />}
        change={calculateChange(data?.voltage || null, previousData?.voltage || null)}
        isLoading={isLoading}
        color="border-blue-600"
      />
      <CurrentValueCard
        title="Current"
        value={data?.current || null}
        unit="A"
        icon={<Bolt className="h-5 w-5 text-purple-600" />}
        change={calculateChange(data?.current || null, previousData?.current || null)}
        isLoading={isLoading}
        color="border-purple-600"
      />
      <CurrentValueCard
        title="Temperature"
        value={data?.temperature || null}
        unit="°C"
        icon={<Thermometer className="h-5 w-5 text-orange-600" />}
        change={calculateChange(data?.temperature || null, previousData?.temperature || null)}
        isLoading={isLoading}
        color="border-orange-600"
      />
      <CurrentValueCard
        title="Power"
        value={data?.power || null}
        unit="W"
        icon={<Gauge className="h-5 w-5 text-teal-600" />}
        change={calculateChange(data?.power || null, previousData?.power || null)}
        isLoading={isLoading}
        color="border-teal-600"
      />
      <CurrentValueCard
        title="Energy"
        value={data?.energy || null}
        unit="kWh"
        icon={<Battery className="h-5 w-5 text-yellow-600" />}
        change={calculateChange(data?.energy || null, previousData?.energy || null)}
        isLoading={isLoading}
        color="border-yellow-600"
      />
      <CurrentValueCard
        title="Saving"
        value={data?.saving || null}
        unit="₹"
        icon={<Coins className="h-5 w-5 text-green-600" />}
        change={calculateChange(data?.saving || null, previousData?.saving || null)}
        isLoading={isLoading}
        color="border-green-600"
      />
    </div>
  );
};

export default CurrentValuesGrid;