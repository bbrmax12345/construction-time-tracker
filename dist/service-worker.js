const CACHE_NAME = 'construction-time-tracker-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/src/main.jsx',
  '/src/App.jsx',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-punches') {
    event.waitUntil(syncPunches());
  }
});

async function syncPunches() {
  const punches = await getLocalPunches();
  for (const punch of punches) {
    try {
      const response = await fetch('/api/punch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(punch),
      });
      if (response.ok) {
        await removeLocalPunch(punch.id);
      }
    } catch (error) {
      console.error('Failed to sync punch:', error);
    }
  }
}

function getLocalPunches() {
  return JSON.parse(localStorage.getItem('offlinePunches') || '[]');
}

function removeLocalPunch(id) {
  const punches = getLocalPunches();
  const updatedPunches = punches.filter(punch => punch.id !== id);
  localStorage.setItem('offlinePunches', JSON.stringify(updatedPunches));
}