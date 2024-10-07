import React, { useState, useEffect, useCallback } from 'react';
import { Clock, MapPin, FileText, RefreshCw } from 'lucide-react';

const API_URL = '/api';

export default function TimeTracker() {
  const [currentStatus, setCurrentStatus] = useState('out');
  const [punches, setPunches] = useState([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [note, setNote] = useState('');
  const [weeklyHours, setWeeklyHours] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchPunches = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/punches/1`);
      if (response.ok) {
        const data = await response.json();
        setPunches(data);
        localStorage.setItem('cachedPunches', JSON.stringify(data));
        const lastPunch = data[0];
        if (lastPunch) {
          setCurrentStatus(lastPunch.type);
          if (lastPunch.type === 'in') {
            setElapsedTime(Math.floor((new Date() - new Date(lastPunch.timestamp)) / 1000));
          }
        }
      } else {
        throw new Error('Failed to fetch punches');
      }
    } catch (error) {
      console.error('Error fetching punches:', error);
      const cachedPunches = JSON.parse(localStorage.getItem('cachedPunches') || '[]');
      setPunches(cachedPunches);
    }
  }, []);

  const fetchWeeklySummary = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/weekly-summary/1`);
      if (response.ok) {
        const data = await response.json();
        setWeeklyHours(data.totalHours);
        localStorage.setItem('cachedWeeklyHours', data.totalHours);
      } else {
        throw new Error('Failed to fetch weekly summary');
      }
    } catch (error) {
      console.error('Error fetching weekly summary:', error);
      const cachedHours = localStorage.getItem('cachedWeeklyHours');
      if (cachedHours) setWeeklyHours(parseFloat(cachedHours));
    }
  }, []);

  useEffect(() => {
    fetchPunches();
    fetchWeeklySummary();
  }, [fetchPunches, fetchWeeklySummary]);

  useEffect(() => {
    let interval;
    if (currentStatus === 'in') {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [currentStatus]);

  const handlePunch = async (type) => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const newPunch = {
          id: Date.now(), // Temporary ID for offline storage
          employeeId: 1,
          type,
          timestamp: new Date().toISOString(),
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          note: note
        };
        try {
          const response = await fetch(`${API_URL}/punch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(newPunch),
          });
          if (response.ok) {
            fetchPunches();
            fetchWeeklySummary();
            setCurrentStatus(type);
            setNote('');
          } else {
            throw new Error('Failed to record punch');
          }
        } catch (error) {
          console.error('Error recording punch:', error);
          // Store punch locally if offline
          const offlinePunches = JSON.parse(localStorage.getItem('offlinePunches') || '[]');
          offlinePunches.push(newPunch);
          localStorage.setItem('offlinePunches', JSON.stringify(offlinePunches));
          alert('Punch saved offline. It will be synced when you\'re back online.');
          // Trigger background sync
          if ('serviceWorker' in navigator && 'SyncManager' in window) {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register('sync-punches');
          }
        } finally {
          setIsLoading(false);
        }
      },
      () => {
        alert('Unable to retrieve your location');
        setIsLoading(false);
      }
    );
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchPunches();
    await fetchWeeklySummary();
    setIsRefreshing(false);
  };

  const formatElapsedTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-lg mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Construction Time Tracker</h1>
            <button 
              onClick={handleRefresh} 
              disabled={isRefreshing}
              className="p-2 rounded-full hover:bg-gray-200 transition-colors duration-200"
            >
              <RefreshCw className={`h-6 w-6 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
            <span className={`text-lg font-medium ${currentStatus === 'in' ? 'text-green-600' : 'text-red-600'}`}>
              {currentStatus === 'in' ? 'Punched In' : 'Punched Out'}
            </span>
            <span className="text-3xl font-bold mt-2 sm:mt-0">{formatElapsedTime(elapsedTime)}</span>
          </div>
          <div className="mb-4">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional)"
              className="w-full px-4 py-2 text-gray-700 border rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <button 
              onClick={() => handlePunch('in')} 
              disabled={currentStatus === 'in' || isLoading}
              className={`flex-1 px-4 py-2 rounded-lg text-white font-medium ${
                currentStatus === 'in' || isLoading ? 'bg-gray-400' : 'bg-green-500 hover:bg-green-600'
              } transition duration-150 ease-in-out`}
            >
              <Clock className="inline-block mr-2 h-5 w-5" />
              Punch In
            </button>
            <button 
              onClick={() => handlePunch('out')} 
              disabled={currentStatus === 'out' || isLoading}
              className={`flex-1 px-4 py-2 rounded-lg text-white font-medium ${
                currentStatus === 'out' || isLoading ? 'bg-gray-400' : 'bg-red-500 hover:bg-red-600'
              } transition duration-150 ease-in-out`}
            >
              <Clock className="inline-block mr-2 h-5 w-5" />
              Punch Out
            </button>
          </div>
        </div>
        <div className="border-t border-gray-200 px-8 py-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Weekly Summary</h2>
          <p className="text-lg">Hours worked: <span className="font-bold">{weeklyHours}</span></p>
        </div>
        <div className="border-t border-gray-200 px-8 py-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Punches</h2>
          <div className="space-y-4">
            {punches.map((punch, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-semibold ${punch.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                    {punch.type === 'in' ? '🟢 Punch In' : '🔴 Punch Out'}
                  </span>
                  <span className="text-sm text-gray-500">{new Date(punch.timestamp).toLocaleString()}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin className="mr-1 h-4 w-4" />
                  <span>{punch.latitude.toFixed(4)}, {punch.longitude.toFixed(4)}</span>
                </div>
                {punch.note && (
                  <div className="mt-2 flex items-center text-sm text-gray-600">
                    <FileText className="mr-1 h-4 w-4" />
                    <span>{punch.note}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}