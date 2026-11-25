import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
  type PrecacheEntry,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import {
  EXAM_SYNC_TAG,
  replayQueuedSubmissionsWithSupabase,
} from './lib/offlineSyncQueue';

interface SWWindowClient {
  postMessage: (message: unknown) => void;
}

interface SWNotificationOptions {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
}

interface SWRegistration {
  showNotification?: (title: string, options?: SWNotificationOptions) => Promise<void>;
}

interface SyncEventLike extends Event {
  tag: string;
  waitUntil: (promise: Promise<unknown>) => void;
}

interface ExtendableMessageEventLike extends Event {
  data?: { type?: string };
  waitUntil: (promise: Promise<unknown>) => void;
}

declare global {
  interface Window {
    __WB_MANIFEST?: Array<PrecacheEntry | string>;
  }
}

interface ServiceWorkerGlobalLike {
  skipWaiting: () => Promise<void>;
  clients: {
    matchAll: (opts?: { type?: string; includeUncontrolled?: boolean }) => Promise<SWWindowClient[]>;
  };
  registration: SWRegistration;
  Notification?: { permission?: NotificationPermission };
  addEventListener: (type: string, listener: (event: any) => void) => void;
}

const swSelf = self as unknown as ServiceWorkerGlobalLike;

swSelf.skipWaiting();
clientsClaim();

const manifest: Array<PrecacheEntry | string> = self.__WB_MANIFEST || [];
precacheAndRoute(manifest);
cleanupOutdatedCaches();

// SPA offline fallback (uses precached index.html in production, NetworkFirst in dev preview)
const hasPrecachedIndex =
  Array.isArray(manifest) &&
  manifest.some((entry) => {
    const url = typeof entry === 'string' ? entry : entry?.url;
    return typeof url === 'string' && (url === '/index.html' || url === 'index.html');
  });

if (hasPrecachedIndex) {
  registerRoute(
    new NavigationRoute(createHandlerBoundToURL('/index.html'), {
      denylist: [/^\/api\//],
    })
  );
} else {
  registerRoute(
    ({ request }) => request.mode === 'navigate',
    new NetworkFirst({
      cacheName: 'synapsis-pages-dev-cache',
    })
  );
}

// Cache Bible JSON chapters lazily on first access for offline reading
registerRoute(
  ({ url }) => /\/bible\/.*\.json$/i.test(url.pathname),
  new CacheFirst({
    cacheName: 'synapsis-bible-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 80,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ],
  })
);

// Cache Google Fonts stylesheets & font files
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ],
  })
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ],
  })
);

async function notifyClientsAndOS(payload: {
  syncedIds: string[];
  syncedCount: number;
  syncedTitles: string[];
  source: 'outbox' | 'workbox-http';
}): Promise<void> {
  if (payload.syncedCount <= 0) return;

  try {
    const windowClients = await swSelf.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    windowClients.forEach((client) => {
      client.postMessage({
        type: 'SYNAPSIS_BG_SYNC_COMPLETE',
        ...payload,
      });
    });
  } catch {
    // Ignore client broadcast errors
  }

  try {
    if (
      swSelf.Notification?.permission === 'granted' &&
      typeof swSelf.registration?.showNotification === 'function'
    ) {
      const label =
        payload.syncedCount === 1
          ? '1 entrega de examen pendiente se envió automáticamente a la nube.'
          : `${payload.syncedCount} entregas de examen pendientes se enviaron automáticamente a la nube.`;
      await swSelf.registration.showNotification('Synapsis ERP · Sincronización completada', {
        body: label,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'synapsis-bg-sync',
      });
    }
  } catch {
    // Ignore notification errors in restricted contexts
  }
}

// Workbox Background Sync queue for direct HTTP submission writes to Supabase
const submissionsHttpBgSync = new BackgroundSyncPlugin('synapsis-submissions-http-queue', {
  maxRetentionTime: 24 * 60, // Retry for up to 24 hours
  onSync: async ({ queue }) => {
    const initialSize = await queue.size();
    try {
      await queue.replayRequests();
    } finally {
      const remainingSize = await queue.size();
      const replayedCount = Math.max(0, initialSize - remainingSize);
      if (replayedCount > 0) {
        await notifyClientsAndOS({
          syncedIds: [],
          syncedCount: replayedCount,
          syncedTitles: [],
          source: 'workbox-http',
        });
      }
    }
  },
});

registerRoute(
  ({ url }) => /^https:\/\/.*\.supabase\.co\/rest\/v1\/submissions/i.test(url.href),
  new NetworkOnly({
    plugins: [submissionsHttpBgSync],
  }),
  'POST'
);

registerRoute(
  ({ url }) => /^https:\/\/.*\.supabase\.co\/rest\/v1\/submissions/i.test(url.href),
  new NetworkOnly({
    plugins: [submissionsHttpBgSync],
  }),
  'PATCH'
);

// Keep all other Supabase calls strictly NetworkOnly so localStorage remains authoritative offline
registerRoute(
  ({ url }) => /^https:\/\/.*\.supabase\.co\/.*/i.test(url.href),
  new NetworkOnly()
);

let activeOutboxSyncPromise: Promise<void> | null = null;

async function runOutboxSyncAndNotify(rethrowOnFailure: boolean): Promise<void> {
  if (activeOutboxSyncPromise) {
    return activeOutboxSyncPromise;
  }

  activeOutboxSyncPromise = (async () => {
    const result = await replayQueuedSubmissionsWithSupabase();

    if (result.syncedIds.length > 0) {
      await notifyClientsAndOS({
        syncedIds: result.syncedIds,
        syncedCount: result.syncedIds.length,
        syncedTitles: result.syncedTitles,
        source: 'outbox',
      });
    }

    if (result.failedIds.length > 0 && rethrowOnFailure) {
      throw new Error(`Remaining pending submissions: ${result.failedIds.length}`);
    }
  })();

  try {
    await activeOutboxSyncPromise;
  } finally {
    activeOutboxSyncPromise = null;
  }
}

swSelf.addEventListener('sync', (event: SyncEventLike) => {
  if (event.tag === EXAM_SYNC_TAG) {
    event.waitUntil(runOutboxSyncAndNotify(true));
  }
});

swSelf.addEventListener('message', (event: ExtendableMessageEventLike) => {
  if (event.data?.type === 'SYNAPSIS_FLUSH_SYNC') {
    event.waitUntil(runOutboxSyncAndNotify(false));
  }
});
