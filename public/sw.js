const CACHE_NAME = 'boiler-chemical-v6';
const ASSETS = ['/manifest.json', '/app-logo.jpg', '/app-icon-192.png', '/app-icon-512.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  // Network-first for HTML pages so user always gets the latest deployed app bundle
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request) || caches.match('/'))
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (data && data.type === 'SHOW_NATIVE_NOTIFICATION' && self.registration) {
    const title = data.title || 'Boiler Chemical';
    const options = {
      body: data.body || 'มีการอัปเดตข้อมูลสารเคมีใหม่ แตะเพื่อเข้าดู',
      icon: '/app-icon-192.png',
      badge: '/app-icon-192.png',
      tag: data.tag || 'boiler-chem-update-' + Date.now(),
      renotify: true,
      silent: false,
      vibrate: [200, 100, 200],
      data: { url: data.url || '/history' },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/history';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

