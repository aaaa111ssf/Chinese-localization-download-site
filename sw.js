const CACHE_VERSION = 'sfs-v18-fresh-cache';
// 只预缓存必须离线可用的两样，JSON 由运行时缓存，装 SW 更快、省流量
const PRECACHE_ASSETS = [
  '/',
  '/android-chrome-192x192.png'
];

// 安装事件：预缓存静态资源（单个失败不拖垮整个安装）
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return Promise.all(
        PRECACHE_ASSETS.map((url) => cache.add(url).catch(() => null))
      );
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
  // API 请求不缓存（评分/统计/下载记录需要实时）
  if (url.pathname.startsWith('/api/')) {
    return 'api';
  }
  // 独立模组页按 HTML 处理（NetworkFirst，保证评分/统计最新）
  if (url.pathname.startsWith('/mod/')) {
    return 'html';
  }
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === '/index.html') {
    return 'html';
  }
  // 代码文件单独走「先网络」，否则改了 js/css 用户要等很久
  if (/\.(css|js)$/.test(url.pathname)) {
    return 'code';
  }
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|eot|otf)$/)) {
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

// 先网络、失败退回缓存：代码和 JSON 都走这套，改完刷新就能看到
function networkFirst(event) {
  return event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || Response.error()))
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

  // API 请求直接走网络，不缓存
  if (type === 'api') return;

  switch (type) {
    case 'html':
      htmlStrategy(event);
      break;
    case 'json-live':
    case 'code':
    case 'json':
      networkFirst(event);
      break;
    default:
      staticStrategy(event);
      break;
  }
});
