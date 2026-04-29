// See docs/twilio-sms-testing.md for Twilio sandbox/test credential usage and magic numbers reference.
// Official docs: https://www.twilio.com/docs/iam/test-credentials

import { DBSchema, IDBPDatabase, openDB } from 'idb';

export interface CachedLocation {
  id: string;
  name: string;
  address?: string;
  isActive?: boolean;
  cachedAt: number;
}

export type QueueActionType = 'checkin' | 'checkout';

export interface QueuedAction {
  id: string;
  action: QueueActionType;
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastError?: string;
  idempotencyKey: string;
}

interface DriverTrackerOfflineDB extends DBSchema {
  locations: {
    key: string;
    value: CachedLocation;
  };
  queue: {
    key: string;
    value: QueuedAction;
  };
  meta: {
    key: string;
    value: { key: string; value: string; updatedAt: number };
  };
}

const DB_NAME = 'driver-tracker-offline';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<DriverTrackerOfflineDB>> | null = null;

export function getOfflineDb() {
  if (!dbPromise) {
    dbPromise = openDB<DriverTrackerOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('locations')) {
          db.createObjectStore('locations', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('queue')) {
          db.createObjectStore('queue', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }

  return dbPromise;
}

export async function getMeta(key: string): Promise<string | null> {
  const db = await getOfflineDb();
  const row = await db.get('meta', key);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getOfflineDb();
  await db.put('meta', { key, value, updatedAt: Date.now() });
}

export async function getCachedLocations(): Promise<CachedLocation[]> {
  const db = await getOfflineDb();
  const rows = await db.getAll('locations');
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function setCachedLocations(
  locations: Array<Omit<CachedLocation, 'cachedAt'>>
): Promise<void> {
  const db = await getOfflineDb();
  const tx = db.transaction('locations', 'readwrite');

  await tx.store.clear();
  const cachedAt = Date.now();

  for (const location of locations) {
    await tx.store.put({
      ...location,
      cachedAt,
    });
  }

  await tx.done;
}
