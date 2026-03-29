import { getOfflineDb, QueuedAction, QueueActionType } from './indexed-db';

const MAX_QUEUE_ITEMS = 200;

function newActionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function enqueueOfflineAction(
  action: QueueActionType,
  payload: Record<string, unknown>
): Promise<QueuedAction> {
  const db = await getOfflineDb();

  const entry: QueuedAction = {
    id: newActionId(),
    action,
    payload,
    createdAt: Date.now(),
    attempts: 0,
    idempotencyKey: newIdempotencyKey(),
  };

  await db.put('queue', entry);
  await pruneQueueIfNeeded();
  return entry;
}

export async function getQueuedActions(): Promise<QueuedAction[]> {
  const db = await getOfflineDb();
  const rows = await db.getAll('queue');
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeQueuedAction(id: string): Promise<void> {
  const db = await getOfflineDb();
  await db.delete('queue', id);
}

export async function recordQueueFailure(id: string, error: string): Promise<void> {
  const db = await getOfflineDb();
  const existing = await db.get('queue', id);
  if (!existing) return;

  await db.put('queue', {
    ...existing,
    attempts: existing.attempts + 1,
    lastError: error,
  });
}

export async function pruneQueueIfNeeded(): Promise<void> {
  const rows = await getQueuedActions();
  if (rows.length <= MAX_QUEUE_ITEMS) return;

  const db = await getOfflineDb();
  const removeCount = rows.length - MAX_QUEUE_ITEMS;

  for (let i = 0; i < removeCount; i += 1) {
    await db.delete('queue', rows[i].id);
  }
}
