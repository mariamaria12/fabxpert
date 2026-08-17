import { getPushPublicKey, subscribeToPush, unsubscribeFromPush } from '@fabxpert/shared';

/** VAPID keys travel as base64url; `pushManager.subscribe` wants raw bytes. */
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padded = base64Url.padEnd(base64Url.length + ((4 - (base64Url.length % 4)) % 4), '=');
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

/**
 * `serviceWorker.ready` never resolves when no worker is registered — which is
 * the case in `vite dev`, where the PWA plugin doesn't emit one. Without a cap
 * the caller would wait forever.
 */
function serviceWorkerReady(timeoutMs = 10_000): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) {
    return false;
  }
  const existing = new Uint8Array(a);
  return existing.length === b.length && existing.every((byte, i) => byte === b[i]);
}

/**
 * Subscribes this device to push and registers it with the API. Call it after
 * permission is granted; it's idempotent, so running it on every app open is
 * the intended way to keep the stored endpoint fresh.
 *
 * Returns false when the server has no VAPID keys configured — in-app
 * notifications still work in that case, only the phone-level push is off.
 */
export async function registerPushDevice(): Promise<boolean> {
  const { publicKey } = await getPushPublicKey();
  if (!publicKey) {
    return false;
  }

  const applicationServerKey = base64UrlToUint8Array(publicKey);
  const registration = await serviceWorkerReady();
  if (!registration) {
    return false;
  }

  let subscription = await registration.pushManager.getSubscription();
  /** A subscription made with an older VAPID key can't be pushed to — replace it. */
  if (subscription && !sameKey(subscription.options.applicationServerKey, applicationServerKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }

  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey as BufferSource,
  });

  const { endpoint, keys } = subscription.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) {
    return false;
  }

  await subscribeToPush({ endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } });
  return true;
}

/** Drops this device's push registration, locally and on the server. */
export async function unregisterPushDevice(): Promise<void> {
  const registration = await serviceWorkerReady();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) {
    return;
  }

  await unsubscribeFromPush(subscription.endpoint);
  await subscription.unsubscribe();
}
