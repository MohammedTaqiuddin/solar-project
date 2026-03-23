import React from 'react';
import { Activity, BarChart4, BrainCircuit } from 'lucide-react';

interface DashboardHeaderProps {
  activeTab: 'dashboard' | 'predictions';
  onTabChange: (tab: 'dashboard' | 'predictions') => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ activeTab, onTabChange }) => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Activity size={28} className="text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">Solar Monitoring Dashboard</h1>
          </div>
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => onTabChange('dashboard')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <BarChart4 size={16} />
              Dashboard
            </button>
            <button
              onClick={() => onTabChange('predictions')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'predictions'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <BrainCircuit size={16} />
              Predictions
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;