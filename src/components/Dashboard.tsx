import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  // Refs to avoid stale closures in the subscription callback
  const currentDataRef = useRef<SensorData | null>(null);
  const alertsRef = useRef<Alert[]>([]);
  const startDateRef = useRef<Date>(startDate);
  const endDateRef = useRef<Date>(endDate);

  // Keep refs in sync with state
  useEffect(() => { currentDataRef.current = currentData; }, [currentData]);
  useEffect(() => { alertsRef.current = alerts; }, [alerts]);
  useEffect(() => { startDateRef.current = startDate; }, [startDate]);
  useEffect(() => { endDateRef.current = endDate; }, [endDate]);

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

  // Fetch historical data based on date range
  const fetchHistoricalData = useCallback(async (start: Date, end: Date) => {
    if (!isConnected) return;

    try {
      setIsLoading(true);
      const endCopy = new Date(end);
      endCopy.setHours(23, 59, 59);
      const { data, error } = await supabase
        .from('sensor_data')
        .select('*')
        .gte('created_at', format(start, 'yyyy-MM-dd'))
        .lte('created_at', format(endCopy, 'yyyy-MM-dd HH:mm:ss'))
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
  }, [isConnected]);

  // Fetch the latest data and set up real-time subscription
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
          setLastUpdated(new Date(data[0].created_at));
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
          event: 'INSERT',
          schema: 'public',
          table: 'sensor_data',
        },
        (payload) => {
          const newSensorData = payload.new as SensorData;

          // Use functional updates to avoid stale closures
          setCurrentData((prev) => {
            setPreviousData(prev);
            return newSensorData;
          });

          setLastUpdated(new Date());

          toast.success('New sensor data received!', {
            duration: 2000,
            icon: '📡',
          });

          // Check for alert conditions using ref
          alertsRef.current.forEach(alert => {
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

          // Append to historical data if it falls within the current date range
          const newDate = new Date(newSensorData.created_at);
          if (newDate >= startDateRef.current && newDate <= endDateRef.current) {
            setHistoricalData((prev) => [...prev, newSensorData]);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeStatus('disconnected');
        }
      });

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [isConnected]);

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
  }, [isConnected, fetchHistoricalData]);

  // ──────────────────────────────────────────────
  // 10-SECOND AUTO-POLL: fetch only NEW rows and append to charts
  // ──────────────────────────────────────────────
  const lastPolledAtRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isConnected) return;

    const pollNewData = async () => {
      try {
        // Determine the "after" timestamp: latest row we already have
        const lastKnown =
          lastPolledAtRef.current ||
          (historicalData.length > 0
            ? historicalData[historicalData.length - 1].created_at
            : null);

        let query = supabase
          .from('sensor_data')
          .select('*')
          .order('created_at', { ascending: true });

        if (lastKnown) {
          // Only rows strictly newer than what we already have
          query = query.gt('created_at', lastKnown);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Polling error:', error);
          return;
        }

        if (data && data.length > 0) {
          // Update the bookmark
          lastPolledAtRef.current = data[data.length - 1].created_at;

          // Update current / previous values
          setCurrentData((prev) => {
            setPreviousData(prev);
            return data[data.length - 1];
          });
          setLastUpdated(new Date());

          // Append new rows to historical data (deduplicate by id)
          setHistoricalData((prev) => {
            const existingIds = new Set(prev.map((r) => r.id));
            const newRows = data.filter((r) => !existingIds.has(r.id));
            if (newRows.length === 0) return prev;
            return [...prev, ...newRows];
          });

          // Keep endDate pushed to "now" so new data is always in range
          setEndDate(new Date());
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    // Poll every 10 seconds
    const intervalId = setInterval(pollNewData, 10_000);

    // Also run once immediately so the first new data shows up fast
    pollNewData();

    return () => clearInterval(intervalId);
  }, [isConnected]);

  // Format the "last updated" time for display
  const formatLastUpdated = (date: Date | null): string => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 5) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    return format(date, 'HH:mm:ss');
  };

  // Auto-refresh the "ago" timestamp every 5s for a snappy feel
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      <DashboardHeader activeTab={activeTab} onTabChange={onTabChange} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Real-time Status Bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Live Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white shadow-sm border border-gray-200">
              <span className="relative flex h-2.5 w-2.5">
                {realtimeStatus === 'connected' ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                  </>
                ) : realtimeStatus === 'connecting' ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                )}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                {realtimeStatus === 'connected' ? 'Live' : realtimeStatus === 'connecting' ? 'Connecting' : 'Offline'}
              </span>
            </div>
          </div>
          {/* Last Updated */}
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Last updated: <span className="font-medium text-gray-700">{formatLastUpdated(lastUpdated)}</span>
          </div>
        </div>

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