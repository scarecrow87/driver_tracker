'use client';

import { useSession } from '@/lib/session';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { PushNotificationControl } from '@/components/PushNotificationControl';
import { useRouter } from 'next/navigation';

interface Location {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  adminPhone?: string;
  adminEmail?: string;
}

interface CheckIn {
  id: string;
  driverId: string;
  locationId: string;
  checkInTime: string;
  checkOutTime?: string;
  latitude?: number;
  longitude?: number;
  alertLevel?: number;
  location?: Location;
  driver?: { id: string; name: string; email: string };
  isExtendedStay?: boolean;
  extendedStayReason?: string;
}

interface CheckInsResponse {
  data?: CheckIn[];
  total?: number;
  page?: number;
  totalPages?: number;
}

interface MapPoint {
  id: string;
  driverName: string;
  locationName?: string;
  latitude: number;
  longitude: number;
  checkInTime: string;
  checkOutTime?: string;
}

interface NotificationSettings {
  emailTenantId: string;
  emailClientId: string;
  emailClientSecret: string;
  emailFrom: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioFromNumber: string;
  emailAlertsEnabled: boolean;
  smsAlertsEnabled: boolean;
  pushAlertsEnabled: boolean;
  hasEmailClientSecret: boolean;
  hasTwilioAuthToken: boolean;
}

interface Stats {
  totalDrivers: number;
  totalLocations: number;
  activeCheckIns: number;
  totalCheckIns: number;
}

type ActiveTab = 'overview' | 'locations' | 'users' | 'map' | 'history' | 'settings';

const DriverMap = dynamic(() => import('@/components/DriverMap'), { ssr: false });

function getCheckInRows(result: CheckIn[] | CheckInsResponse): CheckIn[] {
  if (Array.isArray(result)) return result;
  return Array.isArray(result.data) ? result.data : [];
}

export default function AdminDashboard() {
  const { user, loading: authLoading, logout } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<ActiveTab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [latestLocations, setLatestLocations] = useState<MapPoint[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // History tab state
  const [historyData, setHistoryData] = useState<CheckIn[]>([]);
  const [/* unused */, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit] = useState(25);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyFilter, setHistoryFilter] = useState({
    driverId: '',
    from: '',
    to: '',
    status: 'all',
  });
  const [historyLoading, setHistoryLoading] = useState(false);

  // Location form state
  const [locationForm, setLocationForm] = useState({ name: '', address: '', latitude: '', longitude: '', isActive: true });
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // User form state
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'DRIVER',
    isActive: true,
    adminPhone: '',
    adminEmail: '',
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formMessage, setFormMessage] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailTenantId: '',
    emailClientId: '',
    emailClientSecret: '',
    emailFrom: '',
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioFromNumber: '',
    emailAlertsEnabled: true,
    smsAlertsEnabled: true,
    pushAlertsEnabled: true,
    hasEmailClientSecret: false,
    hasTwilioAuthToken: false,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role === 'DRIVER') {
      router.replace('/driver/dashboard');
      return;
    }

    fetchStats();
    fetchCheckIns();
    fetchLatestLocations();
    fetchLocations();
    fetchUsers();
  }, [authLoading, router, user]);

  useEffect(() => {
    if (user?.role === 'SUPERUSER') {
      fetchNotificationSettings();
    }
  }, [user?.role]);

  async function fetchStats() {
    const res = await fetch('/api/admin/stats');
    if (res.ok) setStats(await res.json());
  }

  async function fetchCheckIns() {
    const res = await fetch('/api/checkins?includeLocation=true&includeDriver=true');
    if (res.ok) {
      const result: CheckIn[] | CheckInsResponse = await res.json();
      setCheckIns(getCheckInRows(result));
    }
  }

  async function fetchLatestLocations() {
    const res = await fetch('/api/checkins?includeLocation=true&includeDriver=true&latestOnly=true');
    if (!res.ok) return;

    const result: CheckIn[] | CheckInsResponse = await res.json();
    const rows = getCheckInRows(result);
    const points = rows
      .map((ci) => ({
        id: ci.id,
        driverName: ci.driver?.name || ci.driverId,
        locationName: ci.location?.name,
        latitude: ci.latitude ?? ci.location?.latitude,
        longitude: ci.longitude ?? ci.location?.longitude,
        checkInTime: ci.checkInTime,
        checkOutTime: ci.checkOutTime,
      }))
      .filter((p) => p.latitude != null && p.longitude != null) as MapPoint[];

    setLatestLocations(points);
  }

  async function fetchLocations() {
    const res = await fetch('/api/locations?includeInactive=true');
    if (res.ok) setLocations(await res.json());
  }

  async function fetchUsers() {
    const res = await fetch('/api/admin/users');
    if (res.ok) setUsers(await res.json());
  }

  async function fetchHistory(page = historyPage) {
    setHistoryLoading(true);
    const params = new URLSearchParams({
      includeLocation: 'true',
      includeDriver: 'true',
      page: String(page),
      limit: String(historyLimit),
    });
    if (historyFilter.driverId) params.set('driverId', historyFilter.driverId);
    if (historyFilter.from) params.set('from', historyFilter.from);
    if (historyFilter.to) params.set('to', historyFilter.to);
    if (historyFilter.status !== 'all') params.set('status', historyFilter.status);

    const res = await fetch(`/api/checkins?${params}`);
    if (res.ok) {
      const result: CheckInsResponse = await res.json();
      setHistoryData(getCheckInRows(result));
      setHistoryTotal(result.total ?? 0);
      setHistoryPage(result.page ?? page);
      setHistoryTotalPages(result.totalPages ?? 1);
    }
    setHistoryLoading(false);
  }

  async function fetchNotificationSettings() {
    const res = await fetch('/api/admin/settings/notifications');
    if (!res.ok) return;

    const data = await res.json();
    setNotificationSettings((prev) => ({
      ...prev,
      emailTenantId: data.emailTenantId || '',
      emailClientId: data.emailClientId || '',
      emailFrom: data.emailFrom || '',
      twilioAccountSid: data.twilioAccountSid || '',
      twilioFromNumber: data.twilioFromNumber || '',
      emailAlertsEnabled: data.emailAlertsEnabled ?? true,
      smsAlertsEnabled: data.smsAlertsEnabled ?? true,
      pushAlertsEnabled: data.pushAlertsEnabled ?? true,
      hasEmailClientSecret: Boolean(data.hasEmailClientSecret),
      hasTwilioAuthToken: Boolean(data.hasTwilioAuthToken),
      emailClientSecret: '',
      twilioAuthToken: '',
    }));
  }

  async function handleSettingsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSettingsMessage('');
    setSavingSettings(true);

    const payload = {
      emailTenantId: notificationSettings.emailTenantId,
      emailClientId: notificationSettings.emailClientId,
      emailClientSecret: notificationSettings.emailClientSecret,
      emailFrom: notificationSettings.emailFrom,
      twilioAccountSid: notificationSettings.twilioAccountSid,
      twilioAuthToken: notificationSettings.twilioAuthToken,
      twilioFromNumber: notificationSettings.twilioFromNumber,
      emailAlertsEnabled: notificationSettings.emailAlertsEnabled,
      smsAlertsEnabled: notificationSettings.smsAlertsEnabled,
      pushAlertsEnabled: notificationSettings.pushAlertsEnabled,
    };

    const res = await fetch('/api/admin/settings/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setSettingsMessage('Notification settings saved.');
      await fetchNotificationSettings();
    } else {
      const err = await res.json();
      setSettingsMessage(err.error || 'Failed to save settings.');
    }

    setSavingSettings(false);
  }

  // --- Location management ---
  async function handleLocationSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormMessage('');

    if (editingLocation) {
      const payload: Record<string, unknown> = { ...locationForm };
      if (payload.latitude !== '' && payload.longitude !== '') {
        payload.latitude = parseFloat(payload.latitude as string);
        payload.longitude = parseFloat(payload.longitude as string);
      } else {
        delete payload.latitude;
        delete payload.longitude;
      }
      const res = await fetch(`/api/locations/${editingLocation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setFormMessage('Location updated!');
        setEditingLocation(null);
        setLocationForm({ name: '', address: '', latitude: '', longitude: '', isActive: true });
        fetchLocations();
        fetchStats();
      }
    } else {
      const payload: Record<string, unknown> = { ...locationForm };
      if (payload.latitude !== '' && payload.longitude !== '') {
        payload.latitude = parseFloat(payload.latitude as string);
        payload.longitude = parseFloat(payload.longitude as string);
      } else {
        delete payload.latitude;
        delete payload.longitude;
      }
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setFormMessage('Location created!');
        setLocationForm({ name: '', address: '', latitude: '', longitude: '', isActive: true });
        fetchLocations();
        fetchStats();
      }
    }
  }

  async function handleDeleteLocation(id: string) {
    if (!confirm('Delete this location?')) return;
    const res = await fetch(`/api/locations/${id}`, { method: 'DELETE' });
    if (res.ok) {
      fetchLocations();
      fetchStats();
    }
  }

  // --- User management ---
  async function handleUserSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormMessage('');

    if (editingUser) {
      const body: Record<string, string | boolean> = { ...userForm };
      if (!body.password) delete body.password;
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setFormMessage('User updated!');
        setEditingUser(null);
        setUserForm({ name: '', email: '', password: '', role: 'DRIVER', isActive: true, adminPhone: '', adminEmail: '' });
        fetchUsers();
        fetchStats();
      }
    } else {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      });
      if (res.ok) {
        setFormMessage('User created!');
        setUserForm({ name: '', email: '', password: '', role: 'DRIVER', isActive: true, adminPhone: '', adminEmail: '' });
        fetchUsers();
        fetchStats();
      } else {
        const err = await res.json();
        setFormMessage(err.error?.fieldErrors?.email?.[0] || 'Error creating user');
      }
    }
  }

  async function handleDeleteUser(id: string) {
    if (!confirm('Delete this user?')) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (res.ok) {
      fetchUsers();
      fetchStats();
    }
  }

  function formatDateTime(dt: string) {
    return new Date(dt).toLocaleString();
  }

  if (authLoading || !user || user.role === 'DRIVER') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-700 text-white px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Admin Dashboard</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm">{user?.name}</span>
          <button
            onClick={logout}
            className="bg-blue-800 hover:bg-blue-900 px-3 py-1 rounded text-sm"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white border-b px-6 flex gap-4">
        {([
          'overview',
          'locations',
          'users',
          'map',
          'history',
          ...(user?.role === 'SUPERUSER' ? (['settings'] as ActiveTab[]) : []),
        ] as ActiveTab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setFormMessage(''); }}
            className={`py-3 px-2 text-sm font-medium border-b-2 capitalize transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      <main className="max-w-5xl mx-auto p-6">
        {/* Overview Tab */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Drivers', value: stats.totalDrivers },
                  { label: 'Locations', value: stats.totalLocations },
                  { label: 'Active Check-ins', value: stats.activeCheckIns },
                  { label: 'Total Check-ins', value: stats.totalCheckIns },
                ].map((s) => (
                  <div key={s.label} className="bg-white rounded-lg shadow p-4 text-center">
                    <p className="text-3xl font-bold text-blue-600">{s.value}</p>
                    <p className="text-sm text-gray-600 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* All Check-ins */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h2 className="font-semibold text-gray-800">All Check-ins</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Driver</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Location</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Check In</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Check Out</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">GPS</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Alert</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {checkIns.map((ci) => (
                      <tr key={ci.id}>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/drivers/${ci.driverId}`}
                            className="text-blue-600 hover:underline"
                          >
                            {ci.driver?.name || ci.driverId}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{ci.location?.name || ci.locationId}</td>
                        <td className="px-4 py-3">{formatDateTime(ci.checkInTime)}</td>
                        <td className="px-4 py-3">
                          {ci.checkOutTime ? formatDateTime(ci.checkOutTime) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {ci.latitude != null
                            ? `${ci.latitude.toFixed(4)}, ${ci.longitude?.toFixed(4)}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {ci.alertLevel === 1 && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">⚠ Alerted</span>
                          )}
                          {ci.alertLevel === 2 && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">🠞 Escalated</span>
                          )}
                          {(ci.alertLevel ?? 0) >= 3 && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">● Urgent</span>
                          )}
                          {(ci.alertLevel ?? 0) === 0 && <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                ci.checkOutTime
                                  ? 'bg-gray-100 text-gray-600'
                                  : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {ci.checkOutTime ? 'Done' : 'Active'}
                            </span>
                            {ci.isExtendedStay && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700" title={ci.extendedStayReason || ''}>
                                Extended
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {checkIns.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                          No check-ins found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Locations Tab */}
        {tab === 'locations' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Form */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold text-gray-800 mb-4">
                {editingLocation ? 'Edit Location' : 'Add Location'}
              </h2>
              <form onSubmit={handleLocationSubmit} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={locationForm.name}
                    onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Main Warehouse"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={locationForm.address}
                    onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="123 Main St, City, ST"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Coordinates</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={locationForm.latitude}
                      onChange={(e) => setLocationForm({ ...locationForm, latitude: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Latitude"
                    />
                    <input
                      type="text"
                      value={locationForm.longitude}
                      onChange={(e) => setLocationForm({ ...locationForm, longitude: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Longitude"
                    />
                    <button
                      type="button"
                      disabled={lookupLoading || !locationForm.address}
                      onClick={async () => {
                        setLookupLoading(true);
                        setFormMessage('');
                        try {
                          const res = await fetch('/api/locations/geocode', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ address: locationForm.address }),
                          });
                          if (res.ok) {
                            const coords = await res.json();
                            setLocationForm((prev) => ({
                              ...prev,
                              latitude: String(coords.latitude),
                              longitude: String(coords.longitude),
                            }));
                            setFormMessage('Coordinates found!');
                          } else {
                            setFormMessage('Could not geocode address.');
                          }
                        } catch {
                          setFormMessage('Lookup failed.');
                        }
                        setLookupLoading(false);
                      }}
                      className="shrink-0 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm disabled:opacity-50"
                    >
                      {lookupLoading ? '...' : 'Lookup'}
                    </button>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={locationForm.isActive}
                    onChange={(e) => setLocationForm({ ...locationForm, isActive: e.target.checked })}
                  />
                  Active location
                </label>
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 font-medium"
                  >
                    {editingLocation ? 'Update' : 'Create'}
                  </button>
                  {editingLocation && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLocation(null);
                        setLocationForm({ name: '', address: '', latitude: '', longitude: '', isActive: true });
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {formMessage && (
                  <p className={`text-sm ${formMessage.includes('failed') || formMessage.includes('Could not') ? 'text-red-600' : 'text-green-600'}`}>
                    {formMessage}
                  </p>
                )}
              </form>
            </div>

            {/* List */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold text-gray-800 mb-4">Locations</h2>
              <ul className="space-y-2">
                {locations.map((loc) => (
                  <li key={loc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div>
                      <p className="font-medium text-gray-800">{loc.name}</p>
                      <p className="text-sm text-gray-500">{loc.address || 'No address'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${loc.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {loc.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        onClick={() => {
                          setEditingLocation(loc);
                          setLocationForm({
                            name: loc.name,
                            address: loc.address || '',
                            latitude: loc.latitude?.toString() || '',
                            longitude: loc.longitude?.toString() || '',
                            isActive: loc.isActive,
                          });
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteLocation(loc.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
                {locations.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No locations yet.</p>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {tab === 'users' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Form */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold text-gray-800 mb-4">
                {editingUser ? 'Edit User' : 'Add User'}
              </h2>
              <form onSubmit={handleUserSubmit} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {editingUser ? 'New Password (leave blank to keep current)' : 'Password *'}
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="DRIVER">Driver</option>
                    <option value="ADMIN">Admin</option>
                    {user?.role === 'SUPERUSER' && (
                      <option value="SUPERUSER">Superuser</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admin Phone (for alerts)</label>
                  <input
                    type="tel"
                    value={userForm.adminPhone}
                    onChange={(e) => setUserForm({ ...userForm, adminPhone: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email (for alerts)</label>
                  <input
                    type="email"
                    value={userForm.adminEmail}
                    onChange={(e) => setUserForm({ ...userForm, adminEmail: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={userForm.isActive}
                    onChange={(e) => setUserForm({ ...userForm, isActive: e.target.checked })}
                  />
                  Active user
                </label>
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 font-medium"
                  >
                    {editingUser ? 'Update' : 'Create'}
                  </button>
                  {editingUser && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingUser(null);
                        setUserForm({ name: '', email: '', password: '', role: 'DRIVER', isActive: true, adminPhone: '', adminEmail: '' });
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {formMessage && (
                  <p className={`text-sm ${formMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                    {formMessage}
                  </p>
                )}
              </form>
            </div>

            {/* List */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold text-gray-800 mb-4">Users</h2>
              <ul className="space-y-2">
                {users.map((user) => (
                  <li key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div>
                      <p className="font-medium text-gray-800">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                      <div className="flex gap-1 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          user.role === 'SUPERUSER' ? 'bg-amber-100 text-amber-700' :
                          user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {user.role}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          user.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingUser(user);
                          setUserForm({
                            name: user.name,
                            email: user.email,
                            password: '',
                            role: user.role,
                            isActive: user.isActive,
                            adminPhone: user.adminPhone || '',
                            adminEmail: user.adminEmail || '',
                          });
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
                {users.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No users yet.</p>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* Map Tab */}
        {tab === 'map' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Active Drivers Map</h2>
            {latestLocations.length > 0 ? (
              <DriverMap points={latestLocations} />
            ) : (
              <p className="text-gray-500 text-center py-8">No active check-ins with GPS coordinates.</p>
            )}
          </div>
        )}

        {/* History Tab */}
        {tab === 'history' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-800">Check-in History</h2>
            </div>
            <div className="p-4 border-b">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Driver</label>
                  <select
                    value={historyFilter.driverId}
                    onChange={(e) => setHistoryFilter({ ...historyFilter, driverId: e.target.value })}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Drivers</option>
                    {users.filter(u => u.role === 'DRIVER').map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                  <input
                    type="date"
                    value={historyFilter.from}
                    onChange={(e) => setHistoryFilter({ ...historyFilter, from: e.target.value })}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                  <input
                    type="date"
                    value={historyFilter.to}
                    onChange={(e) => setHistoryFilter({ ...historyFilter, to: e.target.value })}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={historyFilter.status}
                    onChange={(e) => setHistoryFilter({ ...historyFilter, status: e.target.value })}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <button
                  onClick={() => { setHistoryPage(1); fetchHistory(1); }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
                >
                  Search
                </button>
                <button
                  onClick={() => { setHistoryFilter({ driverId: '', from: '', to: '', status: 'all' }); setHistoryPage(1); }}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm font-medium"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              {historyLoading ? (
                <div className="p-8 text-center text-gray-500">Loading...</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Driver</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Location</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Check In</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Check Out</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {historyData.map((ci) => (
                      <tr key={ci.id}>
                        <td className="px-4 py-3">
                          <Link href={`/admin/drivers/${ci.driverId}`} className="text-blue-600 hover:underline">
                            {ci.driver?.name || ci.driverId}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{ci.location?.name || ci.locationId}</td>
                        <td className="px-4 py-3">{formatDateTime(ci.checkInTime)}</td>
                        <td className="px-4 py-3">{ci.checkOutTime ? formatDateTime(ci.checkOutTime) : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${ci.checkOutTime ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}`}>
                            {ci.checkOutTime ? 'Completed' : 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {historyData.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-gray-500">No records found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
            {historyTotalPages > 1 && (
              <div className="p-4 border-t flex items-center justify-between">
                <p className="text-sm text-gray-600">Page {historyPage} of {historyTotalPages}</p>
                <div className="flex gap-2">
                  <button onClick={() => { const p = historyPage - 1; setHistoryPage(p); fetchHistory(p); }} disabled={historyPage <= 1} className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">Previous</button>
                  <button onClick={() => { const p = historyPage + 1; setHistoryPage(p); fetchHistory(p); }} disabled={historyPage >= historyTotalPages} className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">Next</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab (Superuser only) */}
        {tab === 'settings' && user?.role === 'SUPERUSER' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Notification Settings</h2>
            <form onSubmit={handleSettingsSubmit} className="space-y-4 max-w-xl">
              <div className="border-b pb-4 mb-4">
                <h3 className="font-medium text-gray-800 mb-3">Alert Channels</h3>
                <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                  <input type="checkbox" checked={notificationSettings.emailAlertsEnabled} onChange={(e) => setNotificationSettings({ ...notificationSettings, emailAlertsEnabled: e.target.checked })} />
                  Email alerts
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                  <input type="checkbox" checked={notificationSettings.smsAlertsEnabled} onChange={(e) => setNotificationSettings({ ...notificationSettings, smsAlertsEnabled: e.target.checked })} />
                  SMS alerts
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={notificationSettings.pushAlertsEnabled} onChange={(e) => setNotificationSettings({ ...notificationSettings, pushAlertsEnabled: e.target.checked })} />
                  Browser push alerts
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Tenant ID</label>
                <input type="text" value={notificationSettings.emailTenantId} onChange={(e) => setNotificationSettings({ ...notificationSettings, emailTenantId: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Client ID</label>
                <input type="text" value={notificationSettings.emailClientId} onChange={(e) => setNotificationSettings({ ...notificationSettings, emailClientId: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Client Secret {notificationSettings.hasEmailClientSecret && '(leave blank to keep existing)'}</label>
                <input type="password" value={notificationSettings.emailClientSecret} onChange={(e) => setNotificationSettings({ ...notificationSettings, emailClientSecret: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email From</label>
                <input type="email" value={notificationSettings.emailFrom} onChange={(e) => setNotificationSettings({ ...notificationSettings, emailFrom: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div className="border-t pt-4 mt-4">
                <h3 className="font-medium text-gray-800 mb-3">Twilio SMS</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account SID</label>
                  <input type="text" value={notificationSettings.twilioAccountSid} onChange={(e) => setNotificationSettings({ ...notificationSettings, twilioAccountSid: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Auth Token {notificationSettings.hasTwilioAuthToken && '(leave blank to keep existing)'}</label>
                  <input type="password" value={notificationSettings.twilioAuthToken} onChange={(e) => setNotificationSettings({ ...notificationSettings, twilioAuthToken: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Number</label>
                  <input type="text" value={notificationSettings.twilioFromNumber} onChange={(e) => setNotificationSettings({ ...notificationSettings, twilioFromNumber: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2" />
                </div>
              </div>
              <div className="border-t pt-4 mt-4">
                <h3 className="font-medium text-gray-800 mb-3">Browser Push</h3>
                <PushNotificationControl />
              </div>
              <button type="submit" disabled={savingSettings} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50">
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
              {settingsMessage && <p className={`text-sm ${settingsMessage.includes('saved') ? 'text-green-600' : 'text-red-600'}`}>{settingsMessage}</p>}
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
