'use client';

import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface DriverInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface CheckInRecord {
  id: string;
  driverId: string;
  locationId: string;
  checkInTime: string;
  checkOutTime?: string;
  latitude?: number;
  longitude?: number;
  alertLevel?: number;
  location?: { id: string; name: string; address?: string };
}

export default function DriverHistoryPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const driverId = params.id as string;

  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [historyData, setHistoryData] = useState<CheckInRecord[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState({
    from: '',
    to: '',
    status: 'all',
  });

  const fetchDriver = useCallback(async () => {
    const res = await fetch('/api/admin/users');
    if (!res.ok) return;
    const users = await res.json();
    const found = users.find((u: DriverInfo) => u.id === driverId);
    if (found) {
      setDriver(found);
    } else {
      setError('Driver not found.');
    }
  }, [driverId]);

  const fetchHistory = useCallback(
    async (page: number) => {
      setLoading(true);
      const params = new URLSearchParams({
        includeLocation: 'true',
        page: String(page),
        limit: '25',
        driverId,
      });
      if (filter.from) params.set('from', filter.from);
      if (filter.to) params.set('to', filter.to);
      if (filter.status !== 'all') params.set('status', filter.status);

      const res = await fetch(`/api/checkins?${params}`);
      if (res.ok) {
        const result = await res.json();
        setHistoryData(result.data);
        setHistoryTotal(result.total);
        setHistoryPage(result.page);
        setHistoryTotalPages(result.totalPages);
      }
      setLoading(false);
    },
    [driverId, filter.from, filter.to, filter.status]
  );

  useEffect(() => {
    fetchDriver();
  }, [fetchDriver]);

  useEffect(() => {
    fetchHistory(1);
  }, [fetchHistory]);

  function formatDateTime(dt: string) {
    return new Date(dt).toLocaleString();
  }

  function getDuration(checkIn: string, checkOut?: string) {
    const start = new Date(checkIn).getTime();
    const end = checkOut ? new Date(checkOut).getTime() : Date.now();
    const diffMs = end - start;
    const hours = Math.floor(diffMs / 3_600_000);
    const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  // Compute summary stats from current loaded data
  const completedCount = historyData.filter((ci) => ci.checkOutTime).length;
  const activeCount = historyData.filter((ci) => !ci.checkOutTime).length;

  if (!session || session.user.role === 'DRIVER') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-700 text-white px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            className="text-blue-200 hover:text-white text-sm"
          >
            &larr; Dashboard
          </Link>
          <h1 className="text-xl font-bold">
            {driver ? driver.name : 'Driver'} — History
          </h1>
        </div>
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

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
            {error}
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="ml-4 text-sm underline"
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {/* Driver Info Card */}
        {driver && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  {driver.name}
                </h2>
                <p className="text-sm text-gray-500">{driver.email}</p>
                <div className="flex gap-2 mt-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      driver.role === 'SUPERUSER'
                        ? 'bg-amber-100 text-amber-700'
                        : driver.role === 'ADMIN'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {driver.role}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      driver.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {driver.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div className="flex gap-6 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-800">
                    {historyTotal}
                  </p>
                  <p className="text-xs text-gray-500">Total Records</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {activeCount}
                  </p>
                  <p className="text-xs text-gray-500">Active (this page)</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-400">
                    {completedCount}
                  </p>
                  <p className="text-xs text-gray-500">
                    Completed (this page)
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From
              </label>
              <input
                type="date"
                value={filter.from}
                onChange={(e) =>
                  setFilter({ ...filter, from: e.target.value })
                }
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To
              </label>
              <input
                type="date"
                value={filter.to}
                onChange={(e) =>
                  setFilter({ ...filter, to: e.target.value })
                }
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filter.status}
                onChange={(e) =>
                  setFilter({ ...filter, status: e.target.value })
                }
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <button
              onClick={() => {
                setHistoryPage(1);
                fetchHistory(1);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              Search
            </button>
            <button
              onClick={() => {
                setFilter({ from: '', to: '', status: 'all' });
                setHistoryPage(1);
              }}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm font-medium"
            >
              Clear
            </button>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="font-semibold text-gray-800">
              Check-in / Check-out History
              {historyTotal > 0 && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({historyTotal} record{historyTotal !== 1 ? 's' : ''})
                </span>
              )}
            </h2>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">
                      Location
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">
                      Check In
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">
                      Check Out
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">
                      Duration
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">
                      GPS
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">
                      Alert
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historyData.map((ci) => (
                    <tr key={ci.id}>
                      <td className="px-4 py-3">
                        {ci.location?.name || ci.locationId}
                      </td>
                      <td className="px-4 py-3">
                        {formatDateTime(ci.checkInTime)}
                      </td>
                      <td className="px-4 py-3">
                        {ci.checkOutTime
                          ? formatDateTime(ci.checkOutTime)
                          : '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {getDuration(ci.checkInTime, ci.checkOutTime)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {ci.latitude != null
                          ? `${ci.latitude.toFixed(4)}, ${ci.longitude?.toFixed(4)}`
                          : '\u2014'}
                      </td>
                      <td className="px-4 py-3">
                        {ci.alertLevel === 1 && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                            Alerted
                          </span>
                        )}
                        {ci.alertLevel === 2 && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                            Escalated
                          </span>
                        )}
                        {(ci.alertLevel ?? 0) >= 3 && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            Urgent
                          </span>
                        )}
                        {(ci.alertLevel ?? 0) === 0 && (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            ci.checkOutTime
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {ci.checkOutTime ? 'Completed' : 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {historyData.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-6 text-center text-gray-500"
                      >
                        No check-in records found for this driver.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {historyTotalPages > 1 && (
            <div className="p-4 border-t flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Page {historyPage} of {historyTotalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const p = historyPage - 1;
                    setHistoryPage(p);
                    fetchHistory(p);
                  }}
                  disabled={historyPage <= 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from(
                  { length: Math.min(5, historyTotalPages) },
                  (_, i) => {
                    let pageNum: number;
                    if (historyTotalPages <= 5) {
                      pageNum = i + 1;
                    } else if (historyPage <= 3) {
                      pageNum = i + 1;
                    } else if (historyPage >= historyTotalPages - 2) {
                      pageNum = historyTotalPages - 4 + i;
                    } else {
                      pageNum = historyPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => {
                          setHistoryPage(pageNum);
                          fetchHistory(pageNum);
                        }}
                        className={`px-3 py-1 text-sm border rounded-md ${
                          historyPage === pageNum
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                )}
                <button
                  onClick={() => {
                    const p = historyPage + 1;
                    setHistoryPage(p);
                    fetchHistory(p);
                  }}
                  disabled={historyPage >= historyTotalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
