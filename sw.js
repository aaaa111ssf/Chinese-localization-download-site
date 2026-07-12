const CACHE_VERSION = 'sfs-v2';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/data/data.json',
  '/data/announce.json',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/apple-touch-icon.png'
];

// 安装事件：预缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// 激活事件：清理旧版本缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// 判断请求类型
function getRequestType(url) {
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === '/index.html') {
    return 'html';
  }
  if (
    url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|eot|otf)$/)
  ) {
    return 'static';
  }
  if (url.pathname.endsWith('.json')) {
    return 'json';
  }
  return 'static';
}

// HTML 缓存策略：NetworkFirst
function htmlStrategy(event) {
  return event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
}

// 静态资源缓存策略：CacheFirst
function staticStrategy(event) {
  return event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
}

// JSON 数据缓存策略：StaleWhileRevalidate
function jsonStrategy(event) {
  return event.respondWith(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);
        return cachedResponse || fetchPromise;
      });
    })
  );
}

// Fetch 事件：根据请求类型选择缓存策略
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;

  // 不处理跨域请求
  if (url.origin !== self.location.origin) return;

  const type = getRequestType(url);

  switch (type) {
    case 'html':
      htmlStrategy(event);
      break;
    case 'json':
      jsonStrategy(event);
      break;
    default:
      staticStrategy(event);
      break;
  }
});
