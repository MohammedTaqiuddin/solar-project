import React from 'react';
import { Database } from 'lucide-react';

const NoDataState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white rounded-xl shadow-sm h-64">
      <Database className="h-12 w-12 text-gray-300 mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-1">No data available</h3>
      <p className="text-gray-500 text-center max-w-md">
        There is no sensor data in your Supabase database for the selected time period. 
        Please add data to your database or adjust the date range.
      </p>
    </div>
  );
};

export default NoDataState;