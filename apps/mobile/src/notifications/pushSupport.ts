/**
 * What this browser can do with Web Push.
 *
 * `needsInstall` is the iOS case: Safari only exposes push to a PWA that was
 * added to the Home Screen, so those users get instructions instead of a
 * permission prompt that could never appear.
 */
export type PushSupport = 'supported' | 'needsInstall' | 'unsupported';

function isIosDevice(): boolean {
  const ua = navigator.userAgent;
  /** iPadOS 13+ claims to be a Mac; touch points are what separate it from a desktop. */
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

/** True once the PWA runs from the Home Screen rather than a browser tab. */
export function isInstalledApp(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function detectPushSupport(): PushSupport {
  const hasPushApi =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  if (hasPushApi) {
    return 'supported';
  }
  return isIosDevice() && !isInstalledApp() ? 'needsInstall' : 'unsupported';
}

export function getPermission(): NotificationPermission {
  return 'Notification' in window ? Notification.permission : 'denied';
}
