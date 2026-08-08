// Bump this whenever a deploy must guarantee stale cached HTML/JS/CSS is
// dropped (the activate handler below deletes any cache whose name !==
// CACHE_NAME) -- e.g. this bump ships the Workout Tracker exercise-image
// deadlock fix and must not be served from a stale v1 cache after deploy.
const CACHE_NAME = 'fuelphysique-v7';

// Firebase Auth's OAuth helper, proxied same-origin at /__/auth/* (see
// lib/auth-proxy.js) so the Google consent screen shows the public domain
// instead of the internal Firebase project id. Because the proxy makes
// these requests same-origin, the "skip Firebase and external APIs" check
// below (which matches on firebaseio.com/googleapis.com/gstatic.com) does
// NOT catch them -- without this separate check, a request carrying an
// OAuth authorization code or state value IN ITS URL would be used as a
// Cache Storage key, and a redirect/response body from the helper could be
// persisted to disk. Always go to the network for this path; never read
// from or write to any cache.
const AUTH_PROXY_PREFIX = '/__/auth/';
const NETWORK_ONLY_PREFIXES = ['/api/'];
const urlsToCache = [
  '/',
  '/manifest.json',
  '/dashboard.html',
  '/workout-builder.html',
  '/nutrition-builder.html',
  '/workout-tracker.html',
  '/log-workout.html',
  '/progress.html',
  '/pricing.html',
  '/social.html',
  '/faq.html',
  '/contact.html',
  '/terms.html',
  '/privacy.html',
  '/css/dashboard.css',
  '/css/workout-builder.css',
  '/css/nutrition-builder.css',
  '/css/legal.css',
  '/css/pricing.css',
  '/css/social.css',
  '/js/social.js',
  '/js/social-core.mjs',
  '/js/voice-message-client.mjs',
  '/css/push-notifications.css',
  '/js/push-notifications.js',
  '/js/push-client-core.mjs'
];

const NOTIFICATION_PATHS = new Set([
  '/dashboard.html',
  '/social.html',
  '/workout-tracker.html'
]);

function safeNotificationUrl(value) {
  try {
    const url = new URL(String(value || '/dashboard.html'), self.location.origin);
    if (url.origin !== self.location.origin || !NOTIFICATION_PATHS.has(url.pathname)) {
      return new URL('/dashboard.html', self.location.origin).href;
    }
    return url.href;
  } catch {
    return new URL('/dashboard.html', self.location.origin).href;
  }
}

function readPushData(event) {
  if (!event.data) return {};
  try {
    const json = event.data.json();
    return json?.data && typeof json.data === 'object' ? json.data : json || {};
  } catch {
    return { body: event.data.text?.() || '' };
  }
}

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(err => {
        console.log('Cache add failed:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - Network first, fallback to cache
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const requestPath = new URL(event.request.url).pathname;

  // Voice playback URLs are private, short-lived capabilities. Never persist
  // audio responses or signed ImageKit URLs in Cache Storage.
  if (event.request.destination === 'audio' || event.request.url.includes('imagekit.io')) {
    return;
  }

  // Authenticated APIs and SSE must never be persisted in Cache Storage.
  // This includes /api/social/* and the typing stream beneath it.
  if (NETWORK_ONLY_PREFIXES.some(prefix => requestPath.startsWith(prefix))) {
    return;
  }

  // Skip Firebase and external APIs
  if (event.request.url.includes('firebaseio.com') ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('gstatic.com')) {
    return;
  }

  // Skip the same-origin Firebase Auth proxy -- see AUTH_PROXY_PREFIX above.
  if (requestPath.startsWith(AUTH_PROXY_PREFIX)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Return cached version if fetch fails
        return caches.match(event.request).then(response => {
          return response || new Response('Offline - page not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
      })
  );
});

// Firebase sends data-only messages. Keeping display logic here avoids the
// SDK creating a second, generic notification and gives us one audited click
// path for both installed and browser-mode PWAs.
self.addEventListener('push', event => {
  const data = readPushData(event);
  const destination = safeNotificationUrl(data.url);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const visible = windows.find(client => client.visibilityState === 'visible');
    if (visible) {
      windows.forEach(client => client.postMessage({ type: 'FUELPHYSIQUE_PUSH_FOREGROUND', data: { ...data, url: destination } }));
      return;
    }
    await self.registration.showNotification(String(data.title || 'FuelPhysique').slice(0, 100), {
      body: String(data.body || '').slice(0, 180),
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: String(data.eventId || data.type || 'fuelphysique').slice(0, 120),
      renotify: false,
      data: { url: destination, type: String(data.type || 'unknown').slice(0, 40) }
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const destination = safeNotificationUrl(event.notification.data?.url);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const sameOrigin = windows.find(client => {
      try { return new URL(client.url).origin === self.location.origin; } catch { return false; }
    });
    if (sameOrigin) {
      await sameOrigin.navigate(destination);
      return sameOrigin.focus();
    }
    return self.clients.openWindow(destination);
  })());
});
