'use client';

import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

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
  hasEmailClientSecret: boolean;
  hasTwilioAuthToken: boolean;
}

interface Stats {
  totalDrivers: number;
  totalLocations: number;
  activeCheckIns: number;
  totalCheckIns: number;
}

type ActiveTab = 'overview' | 'locations' | 'users' | 'map' | 'settings';

const DriverMap = dynamic(() => import('@/components/DriverMap'), { ssr: false });

export default function AdminDashboard() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<ActiveTab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [latestLocations, setLatestLocations] = useState<MapPoint[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Location form state
  const [locationForm, setLocationForm] = useState({ name: '', address: '', isActive: true });
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

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
    hasEmailClientSecret: false,
    hasTwilioAuthToken: false,
  });

  useEffect(() => {
    fetchStats();
    fetchCheckIns();
    fetchLatestLocations();
    fetchLocations();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (session?.user?.role === 'SUPERUSER') {
      fetchNotificationSettings();
    }
  }, [session?.user?.role]);

  async function fetchStats() {
    const res = await fetch('/api/admin/stats');
    if (res.ok) setStats(await res.json());
  }

  async function fetchCheckIns() {
    const res = await fetch('/api/checkins?includeLocation=true&includeDriver=true');
    if (res.ok) setCheckIns(await res.json());
  }

  async function fetchLatestLocations() {
    const res = await fetch('/api/checkins?includeLocation=true&includeDriver=true&latestOnly=true');
    if (!res.ok) return;

    const rows: CheckIn[] = await res.json();
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
      const res = await fetch(`/api/locations/${editingLocation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationForm),
      });
      if (res.ok) {
        setFormMessage('Location updated!');
        setEditingLocation(null);
        setLocationForm({ name: '', address: '', isActive: true });
        fetchLocations();
        fetchStats();
      }
    } else {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationForm),
      });
      if (res.ok) {
        setFormMessage('Location created!');
        setLocationForm({ name: '', address: '', isActive: true });
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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-700 text-white px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Admin Dashboard</h1>
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

      {/* Tabs */}
      <nav className="bg-white border-b px-6 flex gap-4">
        {([
          'overview',
          'locations',
          'users',
          'map',
          ...(session?.user?.role === 'SUPERUSER' ? (['settings'] as ActiveTab[]) : []),
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
                        <td className="px-4 py-3">{ci.driver?.name || ci.driverId}</td>
                        <td className="px-4 py-3">{ci.location?.name || ci.locationId}</td>
                        <td className="px-4 py-3">{formatDateTime(ci.checkInTime)}</td>
                        <td className="px-4 py-3">
                          {ci.checkOutTime ? formatDateTime(ci.checkOutTime) : '\u2014'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {ci.latitude != null
                            ? `${ci.latitude.toFixed(4)}, ${ci.longitude?.toFixed(4)}`
                            : '\u2014'}
                        </td>
                        <td className="px-4 py-3">
                          {ci.alertLevel === 1 && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">⚠ Alerted</span>
                          )}
                          {ci.alertLevel === 2 && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">🔶 Escalated</span>
                          )}
                          {(ci.alertLevel ?? 0) >= 3 && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">🔴 Urgent</span>
                          )}
                          {(ci.alertLevel ?? 0) === 0 && <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              ci.checkOutTime
                                ? 'bg-gray-100 text-gray-600'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {ci.checkOutTime ? 'Done' : 'Active'}
                          </span>
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
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={locationForm.isActive}
                    onChange={(e) => setLocationForm({ ...locationForm, isActive: e.target.checked })}
                  />
                  Active location
                </label>
                <div className="flex gap-2">
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
                        setLocationForm({ name: '', address: '', isActive: true });
                      }}
                      className="px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {formMessage && (
                  <p className="text-sm text-green-600 font-medium">{formMessage}</p>
                )}
              </form>
            </div>

            {/* List */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold text-gray-800 mb-4">Locations ({locations.length})</h2>
              <ul className="divide-y divide-gray-100">
                {locations.map((loc) => (
                  <li key={loc.id} className="py-3 flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-800">{loc.name}</p>
                      {loc.address && (
                        <p className="text-xs text-gray-500">{loc.address}</p>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${loc.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {loc.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex gap-2 ml-2">
                      <button
                        onClick={() => {
                          setEditingLocation(loc);
                          setLocationForm({ name: loc.name, address: loc.address || '', isActive: loc.isActive });
                          setFormMessage('');
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteLocation(loc.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
                {locations.length === 0 && (
                  <li className="py-4 text-center text-gray-500 text-sm">No locations yet.</li>
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
                    required={!editingUser}
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required={!editingUser}
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password {editingUser ? '(leave blank to keep)' : '*'}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="DRIVER">Driver</option>
                    <option value="ADMIN">Admin</option>
                    {session?.user?.role === 'SUPERUSER' && (
                      <option value="SUPERUSER">Superuser</option>
                    )}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={userForm.isActive}
                    onChange={(e) => setUserForm({ ...userForm, isActive: e.target.checked })}
                  />
                  Active user
                </label>
                {(userForm.role === 'ADMIN' || userForm.role === 'SUPERUSER') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Admin Phone</label>
                      <input
                        type="tel"
                        value={userForm.adminPhone}
                        onChange={(e) => setUserForm({ ...userForm, adminPhone: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="+1234567890"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
                      <input
                        type="email"
                        value={userForm.adminEmail}
                        onChange={(e) => setUserForm({ ...userForm, adminEmail: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}
                <div className="flex gap-2">
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
                      className="px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {formMessage && (
                  <p className={`text-sm font-medium ${formMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                    {formMessage}
                  </p>
                )}
              </form>
            </div>

            {/* List */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold text-gray-800 mb-4">Users ({users.length})</h2>
              <ul className="divide-y divide-gray-100">
                {users.map((user) => (
                  <li key={user.id} className="py-3 flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-800">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          user.role === 'SUPERUSER'
                            ? 'bg-amber-100 text-amber-700'
                            : user.role === 'ADMIN'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {user.role}
                      </span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex gap-2 ml-2">
                      {(session?.user?.role === 'SUPERUSER' || user.role !== 'SUPERUSER') && (
                        <>
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
                              setFormMessage('');
                            }}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Edit
                          </button>
                          {session?.user?.id !== user.id && (
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                ))}
                {users.length === 0 && (
                  <li className="py-4 text-center text-gray-500 text-sm">No users yet.</li>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* Map Tab */}
        {tab === 'map' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-800">Driver Last Locations</h2>
                <p className="text-sm text-gray-600">
                  Active drivers are blue. Checked-out drivers remain on the map in gray.
                </p>
              </div>
              <button
                onClick={fetchLatestLocations}
                className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 text-sm"
              >
                Refresh Map
              </button>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              {latestLocations.length > 0 ? (
                <DriverMap points={latestLocations} />
              ) : (
                <p className="text-sm text-gray-500">No driver locations available yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {tab === 'settings' && session?.user?.role === 'SUPERUSER' && (
          <div className="bg-white rounded-lg shadow p-6 max-w-3xl">
            <h2 className="font-semibold text-gray-800 mb-1">Notification Provider Settings</h2>
            <p className="text-sm text-gray-600 mb-4">
              Configure Microsoft Graph email and Twilio SMS credentials for alert delivery.
            </p>

            <form onSubmit={handleSettingsSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Tenant ID</label>
                  <input
                    type="text"
                    value={notificationSettings.emailTenantId}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, emailTenantId: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Client ID</label>
                  <input
                    type="text"
                    value={notificationSettings.emailClientId}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, emailClientId: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Client Secret</label>
                  <input
                    type="password"
                    value={notificationSettings.emailClientSecret}
                    placeholder={notificationSettings.hasEmailClientSecret ? 'Stored (enter to replace)' : ''}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, emailClientSecret: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email From</label>
                  <input
                    type="email"
                    value={notificationSettings.emailFrom}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, emailFrom: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Twilio Account SID</label>
                  <input
                    type="text"
                    value={notificationSettings.twilioAccountSid}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, twilioAccountSid: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Twilio Auth Token</label>
                  <input
                    type="password"
                    value={notificationSettings.twilioAuthToken}
                    placeholder={notificationSettings.hasTwilioAuthToken ? 'Stored (enter to replace)' : ''}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, twilioAuthToken: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Twilio From Number</label>
                  <input
                    type="text"
                    value={notificationSettings.twilioFromNumber}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, twilioFromNumber: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-60"
              >
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>

              {settingsMessage && (
                <p className={`text-sm font-medium ${settingsMessage.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
                  {settingsMessage}
                </p>
              )}
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
