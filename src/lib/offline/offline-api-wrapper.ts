import {
  enqueueOfflineAction,
  getQueuedActions,
  recordQueueFailure,
  removeQueuedAction,
} from './offline-queue';

export type OfflineActionResult<T> =
  | { status: 'synced'; data: T }
  | { status: 'queued'; message: string };

export async function queueAwareCheckIn(payload: {
  locationId: string;
  latitude?: number;
  longitude?: number;
  extendedStay?: boolean;
  extendedStayReason?: string;
}): Promise<OfflineActionResult<unknown>> {
  return queueAwareMutation('checkin', '/api/checkin', {
    ...payload,
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function queueAwareCheckOut(
  checkInId?: string
): Promise<OfflineActionResult<unknown>> {
  return queueAwareMutation('checkout', '/api/checkout', {
    idempotencyKey: newIdempotencyKey(),
    checkInId,
  });
}

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function queueAwareMutation(
  action: 'checkin' | 'checkout',
  url: string,
  payload: Record<string, unknown>
): Promise<OfflineActionResult<unknown>> {
  const body = { ...payload };

  if (navigator.onLine) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        return { status: 'synced', data };
      }

      if (response.status >= 500) {
        await enqueueOfflineAction(action, body);
        await triggerBackgroundSync();
        return {
          status: 'queued',
          message: 'Server unavailable. Action queued; nothing is logged server-side until sync succeeds.',
        };
      }

      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Request failed');
    } catch (error) {
      if (error instanceof Error && error.message !== 'Failed to fetch') {
        throw error;
      }

      await enqueueOfflineAction(action, body);
      await triggerBackgroundSync();
      return {
        status: 'queued',
        message: 'No connection. Action queued; nothing is logged server-side until sync succeeds.',
      };
    }
  }

  await enqueueOfflineAction(action, body);
  await triggerBackgroundSync();
  return {
    status: 'queued',
    message: 'Offline. Action queued; nothing is logged server-side until sync succeeds.',
  };
}

export async function processOfflineQueue(): Promise<{ synced: number; failed: number }> {
  if (!navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const items = await getQueuedActions();
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    const url = item.action === 'checkin' ? '/api/checkin' : '/api/checkout';

    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });

      if (response.ok) {
        await removeQueuedAction(item.id);
        synced += 1;
      } else {
        const data = await response.json().catch(() => ({}));
        await recordQueueFailure(item.id, data.error || `HTTP ${response.status}`);
        failed += 1;
      }
    } catch (error) {
      await recordQueueFailure(
        item.id,
        error instanceof Error ? error.message : 'Network error'
      );
      failed += 1;
    }
  }

  return { synced, failed };
}

async function triggerBackgroundSync() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await (registration as ServiceWorkerRegistration & {
        sync: { register: (tag: string) => Promise<void> };
      }).sync.register('offline-queue');
    }
  } catch {
    // Ignore; fallback sync on reconnect is handled by the dashboard.
  }
}
