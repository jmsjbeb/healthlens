/* 影像描述结构化 + 大模型调用
   ============================================================
   为什么不是「浏览器直接调智谱」：
     智谱 open.bigmodel.cn 不支持浏览器 CORS 直连（OPTIONS 预检不返回
     Access-Control-Allow-Origin），浏览器会拦掉带 Authorization 的 POST。
     所以默认走「本机同源代理」：浏览器 → /api/chat（同源，无跨域）
     → server/dev.js 带密钥转发给智谱。密钥只在服务端，浏览器里没有。

   两种模式（由配置决定）：
     · 代理模式（proxy:true 或有 proxyURL）：POST `${base}/api/chat`，不带密钥
     · 直连模式（有 apiKey）：POST `${baseURL}/chat/completions`，带 Bearer
   配置来源（按优先级）：
     1) 用户在「AI 设置」里填的（localStorage，仅本机浏览器）
     2) js/config.local.js（被 .gitignore 排除，不进仓库）
   两者都没有 → 静默降级：结构化返回 null，报告按原文本展示，不报错。
   判定（星级 / 科室）一律留给规则引擎；模型只做「抽取归一化」。 */
(function (global) {
  'use strict';

  var KEY_LS = 'hl_llm_v1';
  var DEFAULT_BASE = 'https://open.bigmodel.cn/api/paas/v4';

  function devConfig() {
    var c = global.HL_CONFIG && global.HL_CONFIG.llm;
    if (!c) return null;
    if (!c.apiKey && !c.proxy && !c.proxyURL) return null;
    return c;
  }
  function userConfig() {
    try {
      var s = global.localStorage.getItem(KEY_LS);
      if (!s) return null;
      var o = JSON.parse(s);
      if (!o) return null;
      if (!o.apiKey && !o.proxy && !o.proxyURL) return null;
      return o;
    } catch (e) { return null; }
  }
  function config() { return userConfig() || devConfig(); }

  /* 解析出「往哪发、是不是代理」 */
  function endpoint() {
    var c = config();
    if (!c) return null;
    if (c.proxy || c.proxyURL) {
      var base = String(c.proxyURL || c.baseURL || '').replace(/\/+$/, '');
      return { url: base + '/api/chat', proxy: true, model: c.model };
    }
    if (c.apiKey) {
      var b = String(c.baseURL || DEFAULT_BASE).replace(/\/+$/, '');
      return { url: b + '/chat/completions', proxy: false, model: c.model, apiKey: c.apiKey };
    }
    return null;
  }
  function hasConfig() { return !!endpoint(); }

  function chat(messages, opts) {
    var ep = endpoint();
    if (!ep) return Promise.reject(new Error('NO_CONFIG'));
    var body = { model: ep.model || 'glm-4-flash', temperature: 0, messages: messages };
    if (opts && opts.json) body.response_format = { type: 'json_object' };
    var headers = { 'Content-Type': 'application/json' };
    if (!ep.proxy && ep.apiKey) headers['Authorization'] = 'Bearer ' + ep.apiKey;

    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, (opts && opts.timeout) || 30000);
    return fetch(ep.url, {
      method: 'POST', headers: headers, body: JSON.stringify(body), signal: ctrl.signal
    }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) return r.text().then(function (t) { throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 160)); });
      return r.json();
    }).then(function (j) {
      return j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    });
  }

  function parseArray(text) {
    if (!text) return null;
    var s = String(text).trim();
    try {
      var o = JSON.parse(s);
      if (Array.isArray(o)) return o;
      if (o && Array.isArray(o.items)) return o.items;
      if (o && Array.isArray(o.data)) return o.data;
    } catch (e) {}
    var a = s.indexOf('['), b = s.lastIndexOf(']');
    if (a >= 0 && b > a) {
      try { var arr = JSON.parse(s.slice(a, b + 1)); if (Array.isArray(arr)) return arr; } catch (e2) {}
    }
    return null;
  }

  var SYS = '你是体检影像报告的结构化抽取器。输入若干条影像所见（中文自由文本，可能来自超声、CT、MRI、X 线），请逐条抽取为 JSON 数组，顺序与输入完全一致。每条包含字段：' +
    'organ（器官或系统，如甲状腺/肝脏/颈动脉/前列腺）、location（具体部位，如右叶/左侧/双侧）、' +
    'type（发现类型，如结节/囊肿/息肉/斑块/增生/脂肪肝）、size_mm（最大径，数字或「长×宽」，原文没有则 null）、' +
    'margin（边界，如清/欠清/模糊，没有则空串）、calcification（钙化：有/无/未提及）、impression（一句话影像印象）。' +
    '只做抽取，不要诊断，不要编造原文没有的信息。只返回合法 JSON，不要任何解释文字。';

  function structurizeImaging(imaging) {
    if (!Array.isArray(imaging) || !imaging.length) return Promise.resolve([]);
    if (!hasConfig()) return Promise.resolve(null);
    var lines = imaging.map(function (im, i) {
      return (i + 1) + '. ' + String(im.name || '影像发现') + (im.finding ? '：' + im.finding : '');
    }).join('\n');
    return chat([
      { role: 'system', content: SYS },
      { role: 'user', content: lines }
    ], { json: true, timeout: 45000 }).then(function (content) {
      var arr = parseArray(content);
      if (!arr) return null;
      return imaging.map(function (im, i) {
        var s = arr[i];
        if (!s || typeof s !== 'object') return null;
        var size = (s.size_mm != null && s.size_mm !== '') ? String(s.size_mm) : null;
        if (size && !/mm|cm|厘米|毫米/i.test(size)) size = size + 'mm';
        return {
          organ: s.organ || '', location: s.location || '', type: s.type || '',
          size_mm: size, margin: s.margin || '', calcification: s.calcification || '',
          impression: s.impression || ''
        };
      });
    }).catch(function () { return null; });
  }

  global.HL = global.HL || {};
  global.HL.img = {
    config: config, hasConfig: hasConfig, endpoint: endpoint, chat: chat,
    structurizeImaging: structurizeImaging,
    KEY_LS: KEY_LS, DEFAULT_BASE: DEFAULT_BASE
  };
})(window);
