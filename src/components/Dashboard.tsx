import React, { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import toast, { Toaster } from 'react-hot-toast';

import DashboardHeader from './DashboardHeader';
import CurrentValuesGrid from './CurrentValuesGrid';
import DateRangePicker from './DateRangePicker';
import ChartsGrid from './ChartsGrid';
import NoDataState from './NoDataState';
import { supabase } from '../lib/supabase';
import { SensorData, Alert } from '../types/supabase';

interface DashboardProps {
  activeTab: 'dashboard' | 'predictions';
  onTabChange: (tab: 'dashboard' | 'predictions') => void;
}

const Dashboard: React.FC<DashboardProps> = ({ activeTab, onTabChange }) => {
  const [currentData, setCurrentData] = useState<SensorData | null>(null);
  const [previousData, setPreviousData] = useState<SensorData | null>(null);
  const [historicalData, setHistoricalData] = useState<SensorData[]>([]);
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Check if Supabase connection is available
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { data, error } = await supabase.from('sensor_data').select('count');
        if (error) {
          throw error;
        }
        setIsConnected(true);
      } catch (error) {
        console.error('Error connecting to Supabase:', error);
        setIsConnected(false);
        toast.error('Unable to connect to Supabase. Please check your configuration.');
      }
    };

    checkConnection();
  }, []);

  // Fetch alerts
  useEffect(() => {
    if (!isConnected) return;

    const fetchAlerts = async () => {
      try {
        const { data, error } = await supabase
          .from('alerts')
          .select('*')
          .eq('is_active', true);

        if (error) {
          throw error;
        }
        setAlerts(data || []);
      } catch (error) {
        console.error('Error fetching alerts:', error);
        toast.error('Failed to fetch alert configurations');
      }
    };

    fetchAlerts();
  }, [isConnected]);

  // Fetch the latest data
  useEffect(() => {
    if (!isConnected) return;

    const fetchLatestData = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('sensor_data')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(2);

        if (error) {
          throw error;
        }

        if (data && data.length > 0) {
          setCurrentData(data[0]);
          if (data.length > 1) {
            setPreviousData(data[1]);
          }
        }
      } catch (error) {
        console.error('Error fetching latest data:', error);
        toast.error('Failed to fetch latest sensor data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLatestData();

    // Set up real-time subscription
    const subscription = supabase
      .channel('sensor_data_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sensor_data',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPreviousData(currentData);
            const newSensorData = payload.new as SensorData;
            setCurrentData(newSensorData);
            
            toast.success('New sensor data received!', { duration: 2000 });
            
            // Check for alert conditions
            alerts.forEach(alert => {
              const metricValue = newSensorData[alert.metric as keyof SensorData];
              if (typeof metricValue === 'number') {
                let alertTriggered = false;
                switch (alert.operator) {
                  case 'gt':
                    if (metricValue > alert.threshold) alertTriggered = true;
                    break;
                  case 'lt':
                    if (metricValue < alert.threshold) alertTriggered = true;
                    break;
                  case 'eq':
                    if (metricValue === alert.threshold) alertTriggered = true;
                    break;
                }

                if (alertTriggered) {
                  toast.error(
                    alert.message || `Alert: ${alert.metric} is ${metricValue} (Threshold: ${alert.threshold})`,
                    { duration: 5000 }
                  );
                }
              }
            });
            
            if (
              new Date(newSensorData.created_at) >= startDate &&
              new Date(newSensorData.created_at) <= endDate
            ) {
              fetchHistoricalData(startDate, endDate);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [isConnected, alerts]);

  // Fetch historical data based on date range
  const fetchHistoricalData = async (start: Date, end: Date) => {
    if (!isConnected) return;
    
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('sensor_data')
        .select('*')
        .gte('created_at', format(start, 'yyyy-MM-dd'))
        .lte('created_at', format(new Date(end.setHours(23, 59, 59)), 'yyyy-MM-dd HH:mm:ss'))
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      setHistoricalData(data || []);
    } catch (error) {
      console.error('Error fetching historical data:', error);
      toast.error('Failed to fetch historical sensor data');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle date range change
  const handleDateRangeChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
    fetchHistoricalData(start, end);
  };

  // Initial fetch of historical data
  useEffect(() => {
    if (isConnected) {
      fetchHistoricalData(startDate, endDate);
    }
  }, [isConnected]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      <DashboardHeader activeTab={activeTab} onTabChange={onTabChange} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!isConnected ? (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Not connected to Supabase. Please check your configuration.
                </p>
              </div>
            </div>
          </div>
        ) : null}
        
        {/* Current Values */}
        <section className="mb-6">
          <h2 className="text-lg font-medium text-gray-700 mb-3">Current Values</h2>
          <CurrentValuesGrid 
            data={currentData} 
            previousData={previousData}
            isLoading={isLoading} 
          />
        </section>
        
        {/* Date Range Picker */}
        <section className="mb-6">
          <DateRangePicker onDateRangeChange={handleDateRangeChange} />
        </section>
        
        {/* Charts */}
        <section>
          <h2 className="text-lg font-medium text-gray-700 mb-3">Historical Data</h2>
          {historicalData.length > 0 ? (
            <ChartsGrid data={historicalData} isLoading={isLoading} />
          ) : (
            <NoDataState />
          )}
        </section>
      </main>
    </div>
  );
};

export default Dashboard;