import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface CurrentValueCardProps {
  title: string;
  value: number | null;
  unit: string;
  icon: React.ReactNode;
  change?: number;
  isLoading?: boolean;
  color: string;
}

const CurrentValueCard: React.FC<CurrentValueCardProps> = ({
  title,
  value,
  unit,
  icon,
  change = 0,
  isLoading = false,
  color,
}) => {
  const isPositiveChange = change >= 0;
  
  return (
    <div className={`bg-white rounded-xl shadow-sm p-5 border-l-4 ${color} transition-all duration-300`}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-medium text-gray-500">{title}</h3>
          <div className="mt-1 flex items-baseline">
            {isLoading ? (
              <div className="h-8 w-28 bg-gray-200 rounded animate-pulse"></div>
            ) : (
              <>
                <p className="text-2xl font-semibold text-gray-900">{value !== null ? value.toFixed(2) : 'N/A'}</p>
                <span className="ml-1 text-sm font-medium text-gray-500">{unit}</span>
              </>
            )}
          </div>
        </div>
        <div className={`p-2 rounded-full ${color.replace('border-', 'bg-').replace('-600', '-100')}`}>
          {icon}
        </div>
      </div>
      
      {!isLoading && change !== undefined && (
        <div className="mt-3 flex items-center">
          {isPositiveChange ? (
            <TrendingUp size={16} className="text-green-500 mr-1" />
          ) : (
            <TrendingDown size={16} className="text-red-500 mr-1" />
          )}
          <span className={`text-sm font-medium ${isPositiveChange ? 'text-green-500' : 'text-red-500'}`}>
            {Math.abs(change).toFixed(2)}% {isPositiveChange ? 'increase' : 'decrease'}
          </span>
        </div>
      )}
    </div>
  );
};

export default CurrentValueCard;