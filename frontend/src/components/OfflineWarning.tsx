'use client';

type OfflineWarningProps = {
  isOnline: boolean;
  syncing: boolean;
  queuedCount: number;
  lastQueuedAction?: 'checkin' | 'checkout' | null;
};

export default function OfflineWarning({
  isOnline,
  syncing,
  queuedCount,
  lastQueuedAction,
}: OfflineWarningProps) {
  if (isOnline && queuedCount === 0 && !syncing) return null;

  if (!isOnline) {
    return (
      <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">You are offline.</p>
        <p>
          Check-in/check-out actions are queued only. Nothing is logged to the server until you are back online and sync completes.
        </p>
      </div>
    );
  }

  if (syncing) {
    return (
      <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Syncing queued actions...
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      <p className="font-semibold">
        {queuedCount} queued action{queuedCount === 1 ? '' : 's'} pending sync.
      </p>
      <p>
        {lastQueuedAction === 'checkin'
          ? 'Your latest check-in is still local and not logged server-side yet.'
          : lastQueuedAction === 'checkout'
            ? 'Your latest check-out is still local and not logged server-side yet.'
            : 'Queued actions are not logged server-side until sync finishes.'}
      </p>
    </div>
  );
}
