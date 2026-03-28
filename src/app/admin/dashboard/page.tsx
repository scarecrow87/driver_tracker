'use client';

import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';

interface Location {
  id: string;
  name: string;
  address?: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
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
  location?: Location;
  driver?: { id: string; name: string; email: string };
}

interface Stats {
  totalDrivers: number;
  totalLocations: number;
  activeCheckIns: number;
  totalCheckIns: number;
}

type ActiveTab = 'overview' | 'locations' | 'users';

export default function AdminDashboard() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<ActiveTab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Location form state
  const [locationForm, setLocationForm] = useState({ name: '', address: '' });
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  // User form state
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'DRIVER',
    adminPhone: '',
    adminEmail: '',
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formMessage, setFormMessage] = useState('');

  useEffect(() => {
    fetchStats();
    fetchCheckIns();
    fetchLocations();
    fetchUsers();
  }, []);

  async function fetchStats() {
    const res = await fetch('/api/admin/stats');
    if (res.ok) setStats(await res.json());
  }

  async function fetchCheckIns() {
    const res = await fetch('/api/checkins?includeLocation=true&includeDriver=true');
    if (res.ok) setCheckIns(await res.json());
  }

  async function fetchLocations() {
    const res = await fetch('/api/locations');
    if (res.ok) setLocations(await res.json());
  }

  async function fetchUsers() {
    const res = await fetch('/api/admin/users');
    if (res.ok) setUsers(await res.json());
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
        setLocationForm({ name: '', address: '' });
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
        setLocationForm({ name: '', address: '' });
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
      const body: any = { ...userForm };
      if (!body.password) delete body.password;
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setFormMessage('User updated!');
        setEditingUser(null);
        setUserForm({ name: '', email: '', password: '', role: 'DRIVER', adminPhone: '', adminEmail: '' });
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
        setUserForm({ name: '', email: '', password: '', role: 'DRIVER', adminPhone: '', adminEmail: '' });
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
        {(['overview', 'locations', 'users'] as ActiveTab[]).map((t) => (
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
                        <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
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
                        setLocationForm({ name: '', address: '' });
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
                    </div>
                    <div className="flex gap-2 ml-2">
                      <button
                        onClick={() => {
                          setEditingLocation(loc);
                          setLocationForm({ name: loc.name, address: loc.address || '' });
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
                  </select>
                </div>
                {userForm.role === 'ADMIN' && (
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
                        setUserForm({ name: '', email: '', password: '', role: 'DRIVER', adminPhone: '', adminEmail: '' });
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
                          user.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {user.role}
                      </span>
                    </div>
                    <div className="flex gap-2 ml-2">
                      <button
                        onClick={() => {
                          setEditingUser(user);
                          setUserForm({
                            name: user.name,
                            email: user.email,
                            password: '',
                            role: user.role,
                            adminPhone: user.adminPhone || '',
                            adminEmail: user.adminEmail || '',
                          });
                          setFormMessage('');
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
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
      </main>
    </div>
  );
}
