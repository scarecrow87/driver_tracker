'use client';

import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';

interface Location {
  id: string;
  name: string;
  address?: string;
}

interface CheckIn {
  id: string;
  locationId: string;
  checkInTime: string;
  checkOutTime?: string;
  latitude?: number;
  longitude?: number;
  location?: Location;
}

export default function DriverDashboard() {
  const { data: session } = useSession();
  const [locations, setLocations] = useState<Location[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [currentCheckIn, setCurrentCheckIn] = useState<CheckIn | null>(null);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Fetch locations and recent check-ins on mount
  useEffect(() => {
    fetchLocations();
    fetchCheckIns();
    fetchCurrentCheckIn();
  }, []);

  async function fetchLocations() {
    const res = await fetch('/api/locations');
    if (res.ok) setLocations(await res.json());
  }

  async function fetchCheckIns() {
    const res = await fetch('/api/checkins?includeLocation=true');
    if (res.ok) setCheckIns(await res.json());
  }

  async function fetchCurrentCheckIn() {
    const res = await fetch('/api/checkin');
    if (res.ok) {
      const data = await res.json();
      setCurrentCheckIn(data);
    }
  }

  async function handleCheckIn() {
    if (!selectedLocation) {
      setMessage('Please select a location');
      return;
    }

    setLoading(true);
    setMessage('');

    // Request geolocation
    let latitude: number | undefined;
    let longitude: number | undefined;

    try {
      if ('geolocation' in navigator) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        );
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      }
    } catch {
      // Geolocation denied or unavailable – proceed without coordinates
      console.log('Geolocation not available, checking in without coordinates.');
    }

    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: selectedLocation, latitude, longitude }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setCurrentCheckIn(data);
      setMessage('Checked in successfully!');
      fetchCheckIns();
    } else {
      setMessage(data.error || 'Failed to check in');
    }
  }

  async function handleCheckOut() {
    setLoading(true);
    setMessage('');

    const res = await fetch('/api/checkout', { method: 'POST' });
    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setCurrentCheckIn(null);
      setMessage('Checked out successfully!');
      fetchCheckIns();
    } else {
      setMessage(data.error || 'Failed to check out');
    }
  }

  function formatDateTime(dt: string) {
    return new Date(dt).toLocaleString();
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-700 text-white px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Driver Dashboard</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm">{session?.user?.name}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="bg-blue-800 hover:bg-blue-900 px-3 py-1 rounded text-sm"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Status Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Current Status
          </h2>

          {currentCheckIn ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full inline-block"></span>
                <span className="font-medium text-green-700">Checked In</span>
              </div>
              <p className="text-sm text-gray-600">
                <strong>Location:</strong>{' '}
                {currentCheckIn.location?.name || currentCheckIn.locationId}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Since:</strong>{' '}
                {formatDateTime(currentCheckIn.checkInTime)}
              </p>
              {currentCheckIn.latitude != null && (
                <p className="text-sm text-gray-600">
                  <strong>GPS:</strong> {currentCheckIn.latitude.toFixed(5)},{' '}
                  {currentCheckIn.longitude?.toFixed(5)}
                </p>
              )}
              <button
                onClick={handleCheckOut}
                disabled={loading}
                className="mt-4 w-full bg-red-600 text-white py-2 rounded-md hover:bg-red-700 disabled:opacity-50 font-medium"
              >
                {loading ? 'Processing...' : 'Check Out'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-gray-400 rounded-full inline-block"></span>
                <span className="font-medium text-gray-600">Not Checked In</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Location
                </label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Choose a location --</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                      {loc.address ? ` \u2013 ${loc.address}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleCheckIn}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {loading ? 'Processing...' : 'Check In'}
              </button>
            </div>
          )}

          {message && (
            <p
              className={`mt-3 text-sm font-medium ${
                message.includes('success') ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {message}
            </p>
          )}
        </div>

        {/* Recent Check-Ins */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Recent Check-Ins
          </h2>
          {checkIns.length === 0 ? (
            <p className="text-gray-500 text-sm">No check-ins yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {checkIns.map((ci) => (
                <li key={ci.id} className="py-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-800">
                        {ci.location?.name || ci.locationId}
                      </p>
                      <p className="text-xs text-gray-500">
                        In: {formatDateTime(ci.checkInTime)}
                      </p>
                      {ci.checkOutTime && (
                        <p className="text-xs text-gray-500">
                          Out: {formatDateTime(ci.checkOutTime)}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        ci.checkOutTime
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {ci.checkOutTime ? 'Completed' : 'Active'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
