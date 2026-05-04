'use client';

import { useEffect, useState } from 'react';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushNotificationControl() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hasSupport = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSupported(hasSupport);
    if (hasSupport) {
      setPermission(Notification.permission);
      navigator.serviceWorker.ready
        .then((registration) => registration.pushManager.getSubscription())
        .then((subscription) => setSubscribed(Boolean(subscription)))
        .catch(() => setSubscribed(false));
    }
  }, []);

  async function enablePush() {
    if (!supported) return;
    setBusy(true);
    setMessage('');

    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== 'granted') {
        setMessage('Browser notifications were not allowed.');
        return;
      }

      const keyRes = await fetch('/api/push/public-key');
      const { publicKey } = await keyRes.json();
      if (!publicKey) {
        setMessage('Push notifications are not configured on the server.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const res = await fetch('/api/push/subscriptions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });

      if (!res.ok) {
        setMessage('Could not save this browser subscription.');
        return;
      }

      setSubscribed(true);
      setMessage('Browser notifications enabled for this device.');
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    if (!supported) return;
    setBusy(true);
    setMessage('');

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/push/subscriptions', {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      setMessage('Browser notifications disabled for this device.');
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage('');

    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      setMessage(res.ok ? `Sent ${data.sent} test notification(s).` : data.error || 'Test notification failed.');
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return <p className="text-sm text-gray-600">Browser push is not supported in this browser.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Device status: {subscribed ? 'enabled' : 'disabled'}{permission === 'denied' ? ' (blocked by browser)' : ''}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={enablePush} disabled={busy || permission === 'denied'} className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50">
          Enable This Device
        </button>
        <button type="button" onClick={disablePush} disabled={busy || !subscribed} className="bg-gray-200 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-300 disabled:opacity-50">
          Disable This Device
        </button>
        <button type="button" onClick={sendTest} disabled={busy || !subscribed} className="bg-gray-800 text-white px-3 py-2 rounded-md hover:bg-gray-900 disabled:opacity-50">
          Send Test
        </button>
      </div>
      {message && <p className="text-sm text-gray-700">{message}</p>}
    </div>
  );
}
