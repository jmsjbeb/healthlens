/* 康鉴 · 本机开发服务器（静态托管 + 智谱代理）
   ============================================================
   为什么需要它：智谱 open.bigmodel.cn 不支持浏览器 CORS 直连
   （OPTIONS 预检不返回 Access-Control-Allow-Origin，浏览器会拦掉 POST）。
   所以浏览器不能直接带密钥调它。这里用一个零依赖的小代理：
     - 浏览器 → 本机 /api/chat（同源，无跨域）
     - 本机 → 智谱（密钥只在这里，浏览器永远看不到）
   密钥来源（按优先级）：
     1) 环境变量 ZHIPU_API_KEY
     2) 同目录下 key.local.txt 的第一行（已被 .gitignore 排除）
   用法：node server/dev.js   然后浏览器打开 http://127.0.0.1:8787/
   ------------------------------------------------------------ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 8787;
const ZHIPU_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

function readKey() {
  if (process.env.ZHIPU_API_KEY) return process.env.ZHIPU_API_KEY.trim();
  try {
    const p = path.join(__dirname, 'key.local.txt');
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').split(/\r?\n/)[0].trim();
  } catch (e) {}
  return '';
}
const KEY = readKey();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.map': 'application/json',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8'
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function sendJson(res, code, obj) {
  const s = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(s) });
  res.end(s);
}

/* ---------- /api/chat：把请求原样转发给智谱，替浏览器带上密钥 ---------- */
async function handleChat(req, res) {
  cors(res);
  if (!KEY) {
    return sendJson(res, 500, { error: { message: '本机没有配置密钥：请在 server/key.local.txt 第一行填入，或设置环境变量 ZHIPU_API_KEY' } });
  }
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 2e6) req.destroy(); });
  req.on('end', async () => {
    let body;
    try { body = JSON.parse(raw || '{}'); }
    catch (e) { return sendJson(res, 400, { error: { message: '请求体不是合法 JSON' } }); }
    if (!body.model) body.model = 'glm-4-flash';
    try {
      const r = await fetch(ZHIPU_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY },
        body: JSON.stringify(body)
      });
      const text = await r.text();
      res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(text);
    } catch (e) {
      sendJson(res, 502, { error: { message: '代理转发失败：' + e.message } });
    }
  });
}

/* ---------- 静态文件 ---------- */
function serveStatic(req, res) {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch (e) { urlPath = '/'; }
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  const filePath = path.join(ROOT, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('not found'); }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const pathname = (() => { try { return new URL(req.url, 'http://x').pathname; } catch (e) { return '/'; } })();
  if (pathname === '/api/chat') {
    if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end(); }
    if (req.method !== 'POST') return sendJson(res, 405, { error: { message: '只接受 POST' } });
    return handleChat(req, res);
  }
  if (pathname === '/api/health') return sendJson(res, 200, { ok: true, key: !!KEY });
  serveStatic(req, res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('康鉴 开发服务器已启动： http://127.0.0.1:' + PORT + '/');
  console.log('智谱代理： /api/chat  →  ' + ZHIPU_URL);
  console.log('密钥：' + (KEY ? '已加载（来自 ' + (process.env.ZHIPU_API_KEY ? '环境变量' : 'server/key.local.txt') + '）' : '未找到 —— AI 影像解读将自动降级，其余功能正常'));
});
