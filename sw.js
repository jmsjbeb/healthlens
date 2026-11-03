/* ============================================================
   康鉴 HealthLens · Service Worker
   ------------------------------------------------------------
   只做两件事：
     1. 让手机能「添加到主屏幕」并在离线时打开
     2. 更新走「网络优先」，拿不到网络才用缓存
        —— 不做「缓存优先」，否则改一版代码用户永远看到旧的
   ============================================================ */
const CACHE = 'healthlens-v9';
const ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './js/tpl.js',
  './js/data.js',
  './js/dict.js',
  './js/engine.js',
  './js/ocr.js',
  './js/pdf.js',
  './js/share.js',
  './js/trend.js',
  './js/summary.js',
  './js/img.js',
  './js/app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  const url = new URL(req.url);
  const isOcrAsset = url.pathname.indexOf('/vendor/ocr/') >= 0;
  /* pdf.js 也是版本固定、不会变的大文件（320KB + 1.09MB worker），
     同样缓存优先：第一次用过之后就不再重复下载。 */
  const isPdfAsset = url.pathname.indexOf('/vendor/pdf/') >= 0;

  /* 识别引擎和语言包（5.7MB）版本固定、不会变。
     走「缓存优先」：第一次下载后就不再重复下，第二次识别几乎秒开。
     其余文件仍然网络优先——改了代码要立刻生效。 */
  if (isOcrAsset || isPdfAsset) {
    e.respondWith(
      caches.match(req).then((hit) =>
        hit || fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
      )
    );
    return;
  }

  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
