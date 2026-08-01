// Bump this whenever a deploy must guarantee stale cached HTML/JS/CSS is
// dropped (the activate handler below deletes any cache whose name !==
// CACHE_NAME) -- e.g. this bump ships the Workout Tracker exercise-image
// deadlock fix and must not be served from a stale v1 cache after deploy.
const CACHE_NAME = 'fuelphysique-v3';

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
const urlsToCache = [
  '/',
  '/dashboard.html',
  '/workout-builder.html',
  '/nutrition-builder.html',
  '/workout-tracker.html',
  '/log-workout.html',
  '/progress.html',
  '/pricing.html',
  '/faq.html',
  '/contact.html',
  '/terms.html',
  '/privacy.html',
  '/css/dashboard.css',
  '/css/workout-builder.css',
  '/css/nutrition-builder.css',
  '/css/legal.css',
  '/css/pricing.css'
];

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

  // Skip Firebase and external APIs
  if (event.request.url.includes('firebaseio.com') ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('gstatic.com')) {
    return;
  }

  // Skip the same-origin Firebase Auth proxy -- see AUTH_PROXY_PREFIX above.
  if (new URL(event.request.url).pathname.startsWith(AUTH_PROXY_PREFIX)) {
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
