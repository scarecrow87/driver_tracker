'use client';

import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import OfflineWarning from '@/components/OfflineWarning';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { getCachedLocations, setCachedLocations, getMeta, setMeta } from '@/lib/offline/indexed-db';
import {
  processOfflineQueue,
  queueAwareCheckIn,
  queueAwareCheckOut,
} from '@/lib/offline/offline-api-wrapper';
import { getQueuedActions } from '@/lib/offline/offline-queue';

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
  isExtendedStay?: boolean;
  extendedStayReason?: string;
}

export default function DriverDashboard() {
  const { data: session } = useSession();
  const { isOnline } = useOfflineStatus();
  const [locations, setLocations] = useState<Location[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [currentCheckIn, setCurrentCheckIn] = useState<CheckIn | null>(null);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'warning' | 'error'>('warning');
  const [lastQueuedAction, setLastQueuedAction] = useState<'checkin' | 'checkout' | null>(null);
  const [shareGps, setShareGps] = useState(false);
  const [extendedStay, setExtendedStay] = useState(false);
  const [extendedStayReason, setExtendedStayReason] = useState('');
  const [extending, setExtending] = useState(false);

  // Fetch locations and recent check-ins on mount
  useEffect(() => {
    loadCachedLocations();
    fetchLocations();
    fetchCheckIns();
    fetchCurrentCheckIn();
    refreshQueuedCount();
    flushQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load persisted shareGps preference
  useEffect(() => {
    getMeta('shareGps').then((val) => {
      if (val === 'true') setShareGps(true);
    });
  }, []);

  useEffect(() => {
    if (isOnline) {
      flushQueue();
      fetchLocations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const onWorkerMessage = (event: MessageEvent) => {
      const data = event.data as
        | { type?: string; synced?: number; failed?: number }
        | undefined;

      if (!data || data.type !== 'OFFLINE_SYNC_RESULT') {
        return;
      }

      const synced = data.synced || 0;
      const failed = data.failed || 0;

      void refreshQueuedCount();

      if (synced > 0) {
        void fetchCheckIns();
        void fetchCurrentCheckIn();
        setMessageTone('success');
        setLastQueuedAction(null);
        setMessage(
          `Background sync processed ${synced} queued action${synced === 1 ? '' : 's'}.`
        );
      } else if (failed > 0) {
        setMessageTone('warning');
        setMessage(
          `Background sync still has ${failed} queued action${failed === 1 ? '' : 's'} pending.`
        );
      }
    };

    navigator.serviceWorker.addEventListener('message', onWorkerMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', onWorkerMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCachedLocations() {
    const cached = await getCachedLocations();
    if (cached.length) {
      setLocations(
        cached.map((loc) => ({
          id: loc.id,
          name: loc.name,
          address: loc.address,
        }))
      );
    }
  }

  async function fetchLocations() {
    const res = await fetch('/api/locations');
    if (res.ok) {
      const rows = await res.json();
      setLocations(rows);
      await setCachedLocations(
        rows.map((loc: Location & { isActive?: boolean }) => ({
          id: loc.id,
          name: loc.name,
          address: loc.address,
          isActive: loc.isActive,
        }))
      );
    }
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

  async function refreshQueuedCount() {
    const queued = await getQueuedActions();
    setQueuedCount(queued.length);
  }

  async function flushQueue() {
    if (!navigator.onLine) return;

    setSyncing(true);
    await requestServiceWorkerReplay();
    const result = await processOfflineQueue();
    setSyncing(false);
    await refreshQueuedCount();

    if (result.synced > 0) {
      await fetchCheckIns();
      await fetchCurrentCheckIn();
      setMessageTone('success');
      setLastQueuedAction(null);
      setMessage(`Synced ${result.synced} queued action${result.synced === 1 ? '' : 's'}.`);
    } else if (result.failed > 0) {
      setMessageTone('warning');
      setMessage(`Still waiting to sync ${result.failed} queued action${result.failed === 1 ? '' : 's'}.`);
    }
  }

  async function requestServiceWorkerReplay() {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      registration.active?.postMessage({ type: 'OFFLINE_SYNC_NOW' });
    } catch {
      // Ignore worker messaging failures and keep app-runtime queue replay.
    }
  }

  async function handleShareGpsChange(checked: boolean) {
    setShareGps(checked);
    await setMeta('shareGps', checked ? 'true' : 'false');
  }

  async function handleToggleExtendedStay() {
    if (!currentCheckIn) return;

    if (!currentCheckIn.isExtendedStay && !extendedStayReason.trim()) {
      setMessageTone('error');
      setMessage('Please provide a reason for extended stay');
      return;
    }

    setExtending(true);
    setMessage('');

    try {
      const res = await fetch(`/api/checkin/${currentCheckIn.id}/extend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extendedStay: !currentCheckIn.isExtendedStay,
          reason: !currentCheckIn.isExtendedStay ? extendedStayReason.trim() : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentCheckIn(data);
        setExtendedStayReason('');
        setMessageTone('success');
        setMessage(
          data.isExtendedStay
            ? 'Extended stay declared. Alert thresholds have been raised.'
            : 'Extended stay removed. Standard alert thresholds apply.'
        );
        fetchCheckIns();
      } else {
        const err = await res.json();
        setMessageTone('error');
        setMessage(err.error || 'Failed to update extended stay');
      }
    } catch {
      setMessageTone('error');
      setMessage('Failed to update extended stay');
    }

    setExtending(false);
  }

  async function handleCheckIn() {
    if (!selectedLocation) {
      setMessageTone('error');
      setMessage('Please select a location');
      return;
    }

    if (extendedStay && !extendedStayReason.trim()) {
      setMessageTone('error');
      setMessage('Please provide a reason for extended stay');
      return;
    }

    setLoading(true);
    setMessage('');

    let latitude: number | undefined;
    let longitude: number | undefined;

    if (shareGps) {
      try {
        if ('geolocation' in navigator) {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          );
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        }
      } catch {
        console.log('Geolocation not available, checking in without coordinates.');
      }
    }

    try {
      const result = await queueAwareCheckIn({
        locationId: selectedLocation,
        latitude,
        longitude,
        extendedStay: extendedStay || undefined,
        extendedStayReason: extendedStay ? extendedStayReason.trim() : undefined,
      });

      if (result.status === 'synced') {
        setCurrentCheckIn(result.data as CheckIn);
        setMessageTone('success');
        setMessage('Checked in successfully!');
        fetchCheckIns();
        fetchCurrentCheckIn();
      } else {
        await refreshQueuedCount();
        setLastQueuedAction('checkin');
        setMessageTone('warning');
        setMessage('Check-in queued. Nothing has been logged yet; it will sync when you are back online.');
      }
    } catch (error) {
      setMessageTone('error');
      setMessage(error instanceof Error ? error.message : 'Failed to check in');
    }

    setLoading(false);
  }

  async function handleCheckOut() {
    setLoading(true);
    setMessage('');

    try {
      const result = await queueAwareCheckOut(currentCheckIn?.id);

      if (result.status === 'synced') {
        setCurrentCheckIn(null);
        setMessageTone('success');
        setMessage('Checked out successfully!');
        fetchCheckIns();
      } else {
        await refreshQueuedCount();
        setLastQueuedAction('checkout');
        setMessageTone('warning');
        setMessage('Check-out queued. Nothing has been logged yet; it will sync when you are back online.');
      }
    } catch (error) {
      setMessageTone('error');
      setMessage(error instanceof Error ? error.message : 'Failed to check out');
    }

    setLoading(false);
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
        <OfflineWarning
          isOnline={isOnline}
          syncing={syncing}
          queuedCount={queuedCount}
          lastQueuedAction={lastQueuedAction}
        />

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
              {currentCheckIn.isExtendedStay && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <p className="text-sm font-medium text-amber-800">Extended Stay Active</p>
                  {currentCheckIn.extendedStayReason && (
                    <p className="text-sm text-amber-700 mt-1">
                      Reason: {currentCheckIn.extendedStayReason}
                    </p>
                  )}
                  <p className="text-xs text-amber-600 mt-1">
                    Alert thresholds have been raised (6h/12h/24h)
                  </p>
                </div>
              )}
              <div className="mt-4 space-y-3">
                {!currentCheckIn.isExtendedStay && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Need to stay longer?
                    </label>
                    <input
                      type="text"
                      value={extendedStayReason}
                      onChange={(e) => setExtendedStayReason(e.target.value)}
                      placeholder="Reason for extended stay (e.g. vehicle breakdown)"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      onClick={handleToggleExtendedStay}
                      disabled={extending || !extendedStayReason.trim()}
                      className="w-full bg-amber-600 text-white py-2 rounded-md hover:bg-amber-700 disabled:opacity-50 font-medium"
                    >
                      {extending ? 'Processing...' : 'Declare Extended Stay'}
                    </button>
                  </div>
                )}
                {currentCheckIn.isExtendedStay && (
                  <button
                    onClick={handleToggleExtendedStay}
                    disabled={extending}
                    className="w-full bg-gray-600 text-white py-2 rounded-md hover:bg-gray-700 disabled:opacity-50 font-medium"
                  >
                    {extending ? 'Processing...' : 'Cancel Extended Stay'}
                  </button>
                )}
                <button
                  onClick={handleCheckOut}
                  disabled={loading}
                  className="w-full bg-red-600 text-white py-2 rounded-md hover:bg-red-700 disabled:opacity-50 font-medium"
                >
                  {loading ? 'Processing...' : 'Check Out'}
                </button>
              </div>
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
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={shareGps}
                  onChange={(e) => handleShareGpsChange(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Share GPS location on check-in
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={extendedStay}
                  onChange={(e) => setExtendedStay(e.target.checked)}
                  className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                Extended stay (I need to stay longer than usual)
              </label>
              {extendedStay && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for extended stay *
                  </label>
                  <input
                    type="text"
                    value={extendedStayReason}
                    onChange={(e) => setExtendedStayReason(e.target.value)}
                    placeholder="e.g. vehicle breakdown, waiting for parts"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Alert thresholds will be raised (6h/12h/24h instead of 2h/4h/8h)
                  </p>
                </div>
              )}
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
                messageTone === 'success'
                  ? 'text-green-600'
                  : messageTone === 'warning'
                    ? 'text-amber-700'
                    : 'text-red-600'
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
                      {ci.isExtendedStay && (
                        <p className="text-xs text-amber-600 font-medium">
                          Extended stay{ci.extendedStayReason ? `: ${ci.extendedStayReason}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          ci.checkOutTime
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {ci.checkOutTime ? 'Completed' : 'Active'}
                      </span>
                      {ci.isExtendedStay && !ci.checkOutTime && (
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                          Extended
                        </span>
                      )}
                    </div>
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
