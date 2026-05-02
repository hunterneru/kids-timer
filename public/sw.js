const CACHE_NAME = 'kids-timer-v4';
const ASSETS = ['./index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first strategy
self.addEventListener('fetch', e => {
  // Don't cache API calls
  if (e.request.url.includes('/api/')) return;

  e.respondWith(
    fetch(e.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});

// Handle incoming push notifications
self.addEventListener('push', e => {
  let data = { title: 'Время вышло!', body: 'Пора забирать ребёнка!' };
  try {
    data = e.data.json();
  } catch(err) {}

  const options = {
    body: data.body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: data.tag || 'kids-timer',
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 100, 300, 100, 300],
  };

  e.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle notification click — open the app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length > 0) {
        list[0].focus();
      } else {
        clients.openWindow('/');
      }
    })
  );
});
