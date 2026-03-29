const DB_NAME = 'driver-tracker-offline';
const DB_VERSION = 1;

function openOfflineDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open offline database'));
  });
}

function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

async function getQueuedActionsFromDb() {
  const db = await openOfflineDb();

  try {
    const tx = db.transaction('queue', 'readonly');
    const store = tx.objectStore('queue');
    const rows = await promisifyRequest(store.getAll());
    return (Array.isArray(rows) ? rows : []).sort((a, b) => a.createdAt - b.createdAt);
  } finally {
    db.close();
  }
}

async function removeQueuedActionFromDb(id) {
  const db = await openOfflineDb();

  try {
    const tx = db.transaction('queue', 'readwrite');
    const store = tx.objectStore('queue');
    store.delete(id);
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to remove queued action'));
      tx.onabort = () => reject(tx.error || new Error('Failed to remove queued action'));
    });
  } finally {
    db.close();
  }
}

async function recordQueueFailureInDb(id, error) {
  const db = await openOfflineDb();

  try {
    const tx = db.transaction('queue', 'readwrite');
    const store = tx.objectStore('queue');
    const existing = await promisifyRequest(store.get(id));
    if (!existing) {
      return;
    }

    store.put({
      ...existing,
      attempts: (existing.attempts || 0) + 1,
      lastError: error,
    });

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to record queue failure'));
      tx.onabort = () => reject(tx.error || new Error('Failed to record queue failure'));
    });
  } finally {
    db.close();
  }
}

async function notifyClients(result) {
  const clientList = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  for (const client of clientList) {
    client.postMessage({
      type: 'OFFLINE_SYNC_RESULT',
      synced: result.synced,
      failed: result.failed,
    });
  }
}

async function replayOfflineQueue() {
  const result = {
    synced: 0,
    failed: 0,
  };

  const items = await getQueuedActionsFromDb();

  for (const item of items) {
    const url = item.action === 'checkin' ? '/api/checkin' : '/api/checkout';

    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(item.payload),
      });

      if (response.ok) {
        await removeQueuedActionFromDb(item.id);
        result.synced += 1;
      } else {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const data = await response.json();
          if (data && typeof data.error === 'string' && data.error.length > 0) {
            errorMessage = data.error;
          }
        } catch {
          // Ignore parse failures and keep status-based message.
        }

        await recordQueueFailureInDb(item.id, errorMessage);
        result.failed += 1;
      }
    } catch (error) {
      await recordQueueFailureInDb(
        item.id,
        error instanceof Error ? error.message : 'Network error'
      );
      result.failed += 1;
    }
  }

  await notifyClients(result);
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'offline-queue') {
    event.waitUntil(replayOfflineQueue());
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'OFFLINE_SYNC_NOW') {
    event.waitUntil(replayOfflineQueue());
  }
});
