import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { format, subDays } from 'date-fns';

interface DateRangePickerProps {
  onDateRangeChange: (startDate: Date, endDate: Date) => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ onDateRangeChange }) => {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartDate = new Date(e.target.value);
    setStartDate(newStartDate);
    onDateRangeChange(newStartDate, endDate);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEndDate = new Date(e.target.value);
    setEndDate(newEndDate);
    onDateRangeChange(startDate, newEndDate);
  };

  const setQuickDateRange = (days: number) => {
    const newStartDate = subDays(new Date(), days);
    setStartDate(newStartDate);
    setEndDate(new Date());
    onDateRangeChange(newStartDate, new Date());
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center">
          <Calendar className="h-5 w-5 text-gray-500 mr-2" />
          <h3 className="text-sm font-medium text-gray-700">Date Range</h3>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center">
            <span className="text-sm text-gray-500 mr-2">From:</span>
            <input
              type="date"
              value={format(startDate, 'yyyy-MM-dd')}
              onChange={handleStartDateChange}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center">
            <span className="text-sm text-gray-500 mr-2">To:</span>
            <input
              type="date"
              value={format(endDate, 'yyyy-MM-dd')}
              onChange={handleEndDateChange}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setQuickDateRange(1)}
            className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setQuickDateRange(7)}
            className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            7 Days
          </button>
          <button
            onClick={() => setQuickDateRange(30)}
            className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            30 Days
          </button>
        </div>
      </div>
    </div>
  );
};

export default DateRangePicker;