/* ============================================================
   康鉴 HealthLens · 应用层
   视图：上传 / 总览 / 就医 / 怎么吃 / 怎么运动
   ============================================================ */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  var ICONS = {
    heart: '<path d="M12 21s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.5-7 10-7 10z"/>',
    lung: '<path d="M12 3v9"/><path d="M9 7c-2.2 0-4 2.2-4 5.2S6 18 8 18s3-1.8 3-4V7"/><path d="M15 7c2.2 0 4 2.2 4 5.2S18 18 16 18s-3-1.8-3-4V7"/>',
    liver: '<path d="M4 8.5C4 6 7 4.5 10 4.5s8 .8 8 4-2.2 6.5-6.2 6.5S4 12 4 8.5z"/><path d="M9 15v3"/>',
    eye: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/>',
    blood: '<path d="M12 3s6 6.6 6 10a6 6 0 01-12 0c0-3.4 6-10 6-10z"/>',
    thyroid: '<path d="M12 4.5v4"/><path d="M8.5 9c-2 0-3.2 2-3.2 4.2S6.3 17 8.3 17s3-1.5 3-3.4V9"/><path d="M15.5 9c2 0 3.2 2 3.2 4.2S17.7 17 15.7 17s-3-1.5-3-3.4V9"/>',
    kidney: '<path d="M9.4 3.8C6 3.8 3.8 6.8 3.8 10.4s2.2 6.4 5.6 6.4c2.4 0 3.6-2.1 3.6-4.6V8.6c0-2.6-1-4.8-3.6-4.8z"/><path d="M13 12.2c.9 2.1 1.9 3.4 3.4 4.1"/>',
    bladder: '<path d="M8.2 4h7.6l-1 4.2c2.1.9 3.2 2.6 3.2 4.6 0 3.1-2.7 5.6-6 5.6s-6-2.5-6-5.6c0-2 1.1-3.7 3.2-4.6L8.2 4z"/>',
    female: '<circle cx="12" cy="8.6" r="4.6"/><path d="M12 13.2V21M9.2 18.2h5.6"/>',
    scalpel: '<path d="M20 3.6L8.4 15.2l-3.2 4.4 4.4-3.2L21.2 4.8"/><path d="M15.4 8.2l2.4 2.4"/>',
    bone: '<path d="M7.4 4.6a2.2 2.2 0 102.6 3.2l7 7a2.2 2.2 0 103.2 2.6 2.2 2.2 0 10-3.2-2.6l-7-7A2.2 2.2 0 007.4 4.6z"/>'
  };

  var STATE = {
    result: null, tab: 'overview',
    report: null,            /* 当前报告的原始对象，供 AI 结构化回填后重算 */
    dietSet: 0, trainRange: 'week', trainMonth: 1,
    uploadedName: null,
    uploadedFile: null, showAllFindings: false
  };

  /* PWA 安装：安卓 Chrome 会派发 beforeinstallprompt，捕获后能「一键安装」；
     iOS Safari 没有这个事件，只能给「分享 → 添加到主屏幕」的指引。 */
  var DEFERRED_INSTALL = null;
  function doInstall() {
    if (DEFERRED_INSTALL) {
      DEFERRED_INSTALL.prompt();
      DEFERRED_INSTALL.userChoice.then(function () { DEFERRED_INSTALL = null; });
      return;
    }
    var ua = navigator.userAgent || '';
    var ios = /iPad|iPhone|iPod/.test(ua);
    window.alert(
      ios
        ? '在 iPhone 上用 Safari 打开本页，点底部的分享按钮 ⤴，选「添加到主屏幕」。\n\n添加后桌面会出现「康鉴」图标，点开就是全屏，和 App 一样。'
        : '在手机浏览器里打开本页，点右上角菜单 ⋮，选「安装应用」或「添加到主屏幕」。\n\n添加后桌面会出现「康鉴」图标，点开就是全屏，和 App 一样。'
    );
  }

  /* 事件必须在脚本一执行就挂上：Chrome 是在页面加载早期派发的，
     等渲染完再监听就已经错过了，用户永远看不到「一键安装」。
     所以这里用模块级监听，按钮存在就点亮，不存在就等渲染时再点亮。 */
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    DEFERRED_INSTALL = e;
    var b = $('#btnInstall');
    if (b) b.style.display = '';
  });
  window.addEventListener('appinstalled', function () {
    DEFERRED_INSTALL = null;
    var b = $('#btnInstall');
    if (b) b.style.display = 'none';
    var c = $('.install-card');
    if (c) c.style.display = 'none';
  });

  /* 已经是「装好的 App」（全屏无地址栏）就不用再劝装了 */
  function isStandalone() {
    try {
      return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
             window.navigator.standalone === true;
    } catch (err) { return false; }
  }

  /* ================= 日历文件：提醒的零成本实现 =================
     为什么不做微信推送：小程序的一次性订阅消息每授权一次只能发一条；
     长期订阅只对政务、医疗等特定二级类目开放，个人主体拿不到医疗健康类目。
     而 .ics 不需要任何授权、不需要服务器，用户导进手机自带日历就能收到系统提醒。
     ------------------------------------------------------------ */
  function icsFold(line) {
    var out = '', buf = '', n = 0;
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      var b = ch.charCodeAt(0) < 128 ? 1 : 3;
      if (n + b > 72) { out += buf + '\r\n '; buf = ''; n = 0; }
      buf += ch; n += b;
    }
    return out + buf;
  }
  function icsEsc(s) {
    return String(s == null ? '' : s)
      .replace(/\\/g, '\\\\').replace(/;/g, '\\;')
      .replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }
  function icsStamp(d) {
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
      'T' + p(d.getHours()) + p(d.getMinutes()) + '00';
  }
  /* 下一个「星期 dow」的 hh:mm，从此刻往后算 */
  function nextDow(dow, hh, mm) {
    var d = new Date();
    d.setHours(hh, mm, 0, 0);
    var diff = (dow - d.getDay() + 7) % 7;
    if (diff === 0 && d.getTime() <= Date.now()) diff = 7;
    d.setDate(d.getDate() + diff);
    return d;
  }
  function buildICS(events) {
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'CALSCALE:GREGORIAN',
      'PRODID:-//HealthLens//CN', 'METHOD:PUBLISH', 'X-WR-CALNAME:康鉴 · 健康计划'];
    events.forEach(function (e) {
      L.push('BEGIN:VEVENT');
      L.push('UID:' + e.uid + '@healthlens');
      L.push('DTSTAMP:' + icsStamp(new Date()));
      L.push('DTSTART:' + icsStamp(e.start));
      L.push('DURATION:PT' + (e.min || 30) + 'M');
      if (e.rrule) L.push('RRULE:' + e.rrule);
      L.push('SUMMARY:' + icsEsc(e.title));
      if (e.desc) L.push('DESCRIPTION:' + icsEsc(e.desc));
      L.push('BEGIN:VALARM');
      L.push('TRIGGER:-PT10M');
      L.push('ACTION:DISPLAY');
      L.push('DESCRIPTION:' + icsEsc(e.title));
      L.push('END:VALARM');
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.map(icsFold).join('\r\n') + '\r\n';
  }
  function saveICS(name, text) {
    try {
      var blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name; a.style.display = 'none';
      document.body.appendChild(a); a.click();
      setTimeout(function () {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1200);
      return true;
    } catch (e) { return false; }
  }

  /* 训练提醒：按当前月的周模板，每天一条，每周重复，共 12 周 */
  function trainEvents() {
    var tpl = (HL.engine.templateFor(1) || {}).tpl || [];
    return tpl.map(function (x, i) {
      var dow = (i + 1) % 7;                       /* 模板 0 = 周一 → getDay() 1 */
      var min = parseInt(String(x.dur || '40'), 10) || 40;
      return {
        uid: 'train-' + dow,
        start: nextDow(dow, 19, 0),
        min: min,
        rrule: 'FREQ=WEEKLY;COUNT=12',
        title: '训练 · ' + x.type,
        desc: x.detail + '\n（具体内容以康鉴「怎么运动」当周安排为准）'
      };
    });
  }

  /* 三餐提醒：每天三条，共 12 周 */
  function mealEvents() {
    var MEALS = [
      { h: 7, m: 30, t: '早餐', d: '先吃蛋白（蛋/奶/豆）和菜，最后吃主食。' },
      { h: 12, m: 0, t: '午餐', d: '顺序：菜 → 肉 → 饭。一拳主食，一掌蛋白，两捧菜。' },
      { h: 18, m: 30, t: '晚餐', d: '尽量 19 点前吃完，主食减到半拳，蛋白和菜照常。' }
    ];
    return MEALS.map(function (x, i) {
      var st = new Date();
      st.setHours(x.h, x.m, 0, 0);
      if (st.getTime() <= Date.now()) st.setDate(st.getDate() + 1);
      return {
        uid: 'meal-' + i,
        start: st,
        min: 30,
        rrule: 'FREQ=DAILY;COUNT=84',
        title: x.t + ' · 康鉴',
        desc: x.d
      };
    });
  }

  function calCard(kind) {
    var isTrain = kind === 'train';
    return '<div class="cal-card">' +
      '<div class="cal-hd"><b>老是忘？让它自己提醒你</b>' +
        '<span>写进手机自带日历，不用授权、不用注册、不依赖网络</span></div>' +
      '<button class="cal-btn" id="' + (isTrain ? 'calTrain' : 'calMeal') + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
          '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>' +
          '<path d="M12 14v3M10.5 15.5h3"/>' +
        '</svg>' +
        '<span><b>' + (isTrain ? '加进日历：每天的训练时间' : '加进日历：每天三餐时间') + '</b>' +
        '<i>' + (isTrain ? '19:00 提醒 · 每周重复 · 连续 12 周' : '7:30 / 12:00 / 18:30 · 连续 12 周') + '</i></span>' +
      '</button>' +
      '<p class="cal-note">下载一个 .ics 文件，双击就会问你要不要加到日历。' +
        '加进去之后时间是活的——想改成早上练，在日历里改一次，所有重复项一起改。</p>' +
    '</div>';
  }

  function bindCal(kind) {
    var btn = $(kind === 'train' ? '#calTrain' : '#calMeal');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var evs = kind === 'train' ? trainEvents() : mealEvents();
      var ok = saveICS(kind === 'train' ? '康鉴-训练提醒.ics' : '康鉴-三餐提醒.ics', buildICS(evs));
      btn.classList.toggle('done', ok);
      var i = btn.querySelector('i');
      if (i) i.textContent = ok
        ? '已下载 · 打开它选择「添加到日历」'
        : '这个浏览器不允许下载文件，换个浏览器再试';
    });
  }

  /* ================= 家庭成员档案 =================
     一份报告只对一个人有意义：给父亲看的结论套不到母亲身上。
     所以「哪份报告 + 打卡记录」全部按成员分开存，顶栏可以随时切。

     存的是原始报告而不是分析结果——引擎口径改一次，老档案跟着更新，
     不会把过时的判断固化在 localStorage 里。

     兼容 v1：老版本只有一份全局报告（hl_report_v1）和一条「上次看过」
     （hl_last_v1），迁移时变成第一个成员「本人」。旧 key 不删，双写一段
     时间更安全——万一要回退版本，数据还在。 */
  var PROF_KEY = 'hl_profiles_v1';   /* [{ id, name, rel, report, kind, file, updatedAt }] */
  var PROF_CUR = 'hl_prof_cur_v1';   /* 当前正在看哪个成员 */
  var PROF_MAX = 5;                  /* 一个家庭最多 5 位，多了顶栏和清单都放不下 */
  var RELS = ['父亲', '母亲', '配偶', '儿子', '女儿', '其他'];

  var LAST_KEY = 'hl_last_v1';       /* 旧版：上次看的是哪一份 */
  var REPORT_KEY = 'hl_report_v1';   /* 旧版：识别出来的报告内容 */

  var PROF_CACHE = null;             /* 本次会话的档案，写操作后同步更新 */

  function newProfId() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* 字段收敛：缺的补齐、类型不对的丢掉。坏数据不该让整个应用起不来。 */
  function normProf(p) {
    p = p || {};
    var o = {
      id: String(p.id || newProfId()),
      name: String(p.name == null || p.name === '' ? '本人' : p.name).slice(0, 10),
      rel: String(p.rel == null || p.rel === '' ? '本人' : p.rel).slice(0, 6),
      report: (p.report && p.report.items instanceof Array) ? p.report : null,
      kind: ['sample', 'sample2', 'upload'].indexOf(p.kind) >= 0 ? p.kind : null,
      file: p.file ? String(p.file) : null,
      updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : Date.now()
    };
    /* kind 与内容必须自洽：upload 靠 report 还原，样板靠 kind 还原 */
    if (o.kind === 'upload' && !o.report) { o.kind = null; o.file = null; }
    return o;
  }

  function readProfilesRaw() {
    try {
      var s = localStorage.getItem(PROF_KEY);
      if (!s) return null;
      var o = JSON.parse(s);
      return (o instanceof Array) ? o : null;
    } catch (e) { return null; }
  }

  /* 存不进去必须说出口。
     静默失败会让用户以为存好了，刷新才发现没了——这比直接报错更糟，
     因为报错用户会重试，静默用户会放心关掉页面。

     important 的含义是「这次丢的东西不可替代吗」：
       · 分析完的报告 —— 是。丢了要重新拍照/上传，用户自己恢复不了 → true
       · 初始化阶段造成员 / 自愈成员清单 —— 否。丢的只是「第一个成员」这条记录，
         重开页面重新上传一次就回来了，而且那时页面上还没有报告，
         「生成就诊摘要」按钮根本不存在，弹出来等于指一个空按钮让人去点。
         更糟的是它会占掉唯一一次提醒机会（STORE_WARNED），
         导致真正该提醒的那一刻（报告存不进去）一个字都不弹。 → false

     所以不重要的那次直接返回，**不设 flag**，把机会留给后面。
     代价：一直没拿到报告的用户收不到这条提醒，成员清单会静默丢——这个取舍是
     有意的，不是漏了。 */
  var STORE_WARNED = false;
  function warnStore(important) {
    if (STORE_WARNED) return;
    if (!important) return;
    STORE_WARNED = true;
    try {
      window.alert(
        '本机存储空间不够，这份数据没能保存下来。\n\n' +
        '这一次照样能看，但关掉页面就没了。\n\n' +
        '想先把结果留住：点「生成就诊摘要」，再点上面的「存图」，存到相册里。\n' +
        '想彻底解决：换普通窗口（不要无痕）重新打开一次；还不行就删掉一位旧成员腾点空间。'
      );
    } catch (e) { /* 弹窗都被禁的话，也只能这样了 */ }
  }

  function saveProfiles(list) {
    PROF_CACHE = list;
    try { localStorage.setItem(PROF_KEY, JSON.stringify(list)); return true; }
    catch (e) { warnStore(false); return false; }   /* 无痕模式 / 配额满：本次会话照常可用；见 warnStore 注释，这里不弹 */
  }

  /* 迁移：把 v1 的全局报告变成第一个成员「本人」。
     幂等——只要 hl_profiles_v1 里已经有合法成员，就直接返回，不重复造。 */
  function migrateProfiles() {
    var raw = readProfilesRaw();
    if (raw && raw.length) {
      var clean = [];
      for (var i = 0; i < raw.length; i++) {
        if (!raw[i] || typeof raw[i] !== 'object' || !raw[i].id) continue;
        clean.push(normProf(raw[i]));
      }
      if (clean.length) {
        /* 归一化后有变化就写回，让存储自愈；没变化不写，
           否则每开一次页面都要写一遍 localStorage */
        if (JSON.stringify(clean) !== JSON.stringify(raw)) saveProfiles(clean);
        return clean;
      }
    }

    var rep = null;
    try { rep = JSON.parse(localStorage.getItem(REPORT_KEY) || 'null'); } catch (e) { rep = null; }
    if (!rep || !(rep.items instanceof Array) || !rep.items.length) rep = null;

    var last = readLast();
    var kind = (last && last.kind) || (rep ? 'upload' : null);
    var file = (last && last.name) || null;

    var first = normProf({
      id: newProfId(), name: '本人', rel: '本人',
      report: rep, kind: kind, file: file,
      updatedAt: (last && last.at) || Date.now()
    });
    var list = [first];
    saveProfiles(list);
    try { localStorage.setItem(PROF_CUR, first.id); } catch (e) {}

    /* 打卡记录一起搬：老 key 没有成员后缀，归到第一个成员名下 */
    try {
      var legacy = localStorage.getItem(CK_BASE) || localStorage.getItem(CK_OLD);
      if (legacy) localStorage.setItem(CK_BASE + '::' + first.id, legacy);
    } catch (e) {}
    return list;
  }

  function profList() {
    if (!PROF_CACHE) PROF_CACHE = migrateProfiles();
    return PROF_CACHE;
  }

  function profById(id) {
    var list = profList();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* 存下来的 id 可能指向一个已被删掉的成员，那就退回第一个 */
  function activeId() {
    var list = profList(), id = null;
    try { id = localStorage.getItem(PROF_CUR); } catch (e) { id = null; }
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return id;
    return list[0].id;
  }

  function activeProf() {
    var list = profList(), id = activeId();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0];
  }

  function setActive(id) {
    if (!profById(id)) return false;
    try { localStorage.setItem(PROF_CUR, id); } catch (e) { /* 写不进去也不影响本次 */ }
    return true;
  }

  function patchProf(id, patch) {
    var p = profById(id);
    if (!p) return null;
    Object.keys(patch).forEach(function (k) { p[k] = patch[k]; });
    p.updatedAt = Date.now();
    saveProfiles(profList());
    return p;
  }

  /* 重名自动加序号：一家两个「儿子」也不会在清单里分不清 */
  function addProf(rel) {
    var list = profList();
    if (list.length >= PROF_MAX) return null;
    var base = String(rel || '家人').slice(0, 6);
    var name = base, n = 2, exists = function (s) {
      return list.some(function (p) { return p.name === s; });
    };
    while (exists(name)) { name = base + n; n++; }
    var p = normProf({ id: newProfId(), name: name, rel: base, report: null, kind: null });
    list.push(p);
    saveProfiles(list);
    return p;
  }

  function delProf(id) {
    var list = profList();
    if (list.length <= 1) return false;       /* 至少留一个，否则无处可退 */
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) idx = i;
    if (idx < 0) return false;
    var wasActive = false;
    try { wasActive = localStorage.getItem(PROF_CUR) === id; } catch (e) {}
    list.splice(idx, 1);
    saveProfiles(list);
    try { localStorage.removeItem(CK_BASE + '::' + id); } catch (e) {}
    if (wasActive) {
      try { localStorage.setItem(PROF_CUR, list[0].id); } catch (e) {}
    }
    return true;
  }

  /* 档案 → 可分析的报告。样板报告不存内容，靠 kind 还原。 */
  function reportOf(p) {
    if (!p) return null;
    if (p.kind === 'sample') return HL.sample;
    if (p.kind === 'sample2') return HL.sample2;
    if (p.report && p.report.items && p.report.items.length) return p.report;
    return null;
  }

  /* ---------- 旧接口 ----------
     名字保持不变，语义改成「写到当前成员名下」，调用点不用跟着改。 */
  function saveLast(kind, name) {
    var p = profById(activeId());
    /* 同一份报告再看一遍不算「更新」——否则档案上的日期会变成最后访问时间，
       写着「上次的报告（今天）」，实际报告是上个月做的。 */
    if (p && (p.kind !== kind || (name || null) !== p.file)) {
      patchProf(p.id, { kind: kind, file: name || null });
    }
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify({ kind: kind, name: name || null, at: Date.now() }));
    } catch (e) { /* 无痕模式下写不进去，不影响本次使用 */ }
  }
  function readLast() {
    try {
      var s = localStorage.getItem(LAST_KEY);
      if (!s) return null;
      var o = JSON.parse(s);
      if (!o || ['sample', 'sample2', 'upload'].indexOf(o.kind) < 0) return null;
      return o;
    } catch (e) { return null; }
  }

  /* 识别出来的报告：写进当前成员，同时留一份在旧 key 里（双写） */
  function saveReport(rep, fileName) {
    patchProf(activeId(), { report: rep, kind: 'upload', file: fileName || null });
    try { localStorage.setItem(REPORT_KEY, JSON.stringify(rep)); }
    catch (e) { warnStore(true); }
  }

  function dateShort(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  /* ---------- 界面偏好 ----------
     换到第几套菜单、正在看哪个时间范围，这些不存的话每次刷新都跳回
     「本周 / 第 1 套」，用户会以为自己点错了。 */
  var UI_KEY = 'hl_ui_v1';
  function saveUI() {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify({
        dietSet: STATE.dietSet,
        trainRange: STATE.trainRange,
        trainMonth: STATE.trainMonth
      }));
    } catch (e) { /* 无痕模式，忽略 */ }
  }
  function readUI() {
    try {
      var o = JSON.parse(localStorage.getItem(UI_KEY) || 'null');
      if (!o) return;
      if (typeof o.dietSet === 'number' && o.dietSet >= 0) STATE.dietSet = o.dietSet;
      if (['week', 'month', 'quarter', 'year'].indexOf(o.trainRange) >= 0) STATE.trainRange = o.trainRange;
      if (typeof o.trainMonth === 'number' && o.trainMonth >= 1 && o.trainMonth <= 12) STATE.trainMonth = o.trainMonth;
    } catch (e) { /* 坏数据就当没有 */ }
  }

  /* ================= 星级 ================= */
  function starRow(n) {
    var out = '';
    for (var i = 1; i <= 7; i++) out += '<i class="' + (i <= n ? 'on' : '') + '">★</i>';
    return '<span class="stars" aria-label="' + n + ' 星">' + out + '</span>';
  }

  /* ================= 上传页：这份报告是谁的 =================
     同一套规则套到不同人身上结论完全不同（45 岁男性和 60 岁女性，
     同一个血糖值判读都不一样），所以上传前必须先定人。 */
  function whoPickHtml() {
    var list = profList(), cur = activeId(), p = activeProf();
    var chips = list.map(function (x) {
      var on = x.id === cur;
      return '<button class="wp-chip' + (on ? ' on' : '') + '" data-sw="' + esc(x.id) + '"' +
        ' aria-pressed="' + (on ? 'true' : 'false') + '">' +
        '<span class="wp-av">' + esc(String(x.name).charAt(0)) + '</span>' + esc(x.name) + '</button>';
    }).join('');
    var rep = reportOf(p);
    /* 这里是「选择」不是「跳转」：点了只换归属，不把人从上传页带走。
       想看某人已经存下的报告，走下面这条链接或顶栏。 */
    var arch = rep ? '<button class="wp-arch" data-open="' + esc(p.id) + '">' +
        '「' + esc(p.name) + '」上次的报告' +
        (p.updatedAt ? '（' + dateShort(p.updatedAt) + '）' : '') + ' · 直接看 ›</button>' : '';
    return '<div class="who-pick">' +
        '<div class="wp-hd"><b>这份报告是谁的？</b>' +
          '<span>每个成员的结论与打卡分开存，互不干扰</span></div>' +
        '<div class="wp-row">' + chips +
          (list.length < PROF_MAX
            ? '<button class="wp-chip add" data-add="1" aria-label="添加家庭成员">＋ 家人</button>' : '') +
        '</div>' + arch +
      '</div>';
  }

  /* ================= 上传页 ================= */
  function renderIntake() {
    $('#view-intake').innerHTML =
      '<div class="hero">' +
        '<h1>上传体检报告，<br><em>把每个标红项说明白</em></h1>' +
        '<p>报告只给你一个 ↑ 和一行参考区间，不解释它意味着什么。这里补上三件事：这一项为什么异常、值不值得跑一趟医院、接下来三个月做什么能把它拉回来。' +
        '<b>每条结论都写了依据，可以对着报告逐条核对。</b></p>' +
      '</div>' +

      whoPickHtml() +

      '<div class="dropzone" id="dz" role="button" tabindex="0" aria-label="拍照或上传体检报告">' +
        '<div class="dz-ico">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="#0C8B94" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/>' +
            '<path d="M12 12v5M9.5 14.5L12 12l2.5 2.5"/>' +
          '</svg>' +
        '</div>' +
        '<div class="dz-t">拍照、截图、PDF 都行</div>' +
        '<div class="dz-s">体检中心 App 下载的 PDF 直接传 · 图片支持相册与截图</div>' +
        '<div class="dz-file" id="dzFile"><span>📄</span><span id="dzName">未选择</span></div>' +
      '</div>' +
      '<input type="file" id="fileInput" accept="image/*,application/pdf" hidden>' +

      (HL.ocr && HL.ocr.available === false ?
        '<div class="ocr-warn">当前是双击本地文件打开的，浏览器不允许启动识别引擎。' +
          '把文件夹传到任意静态托管、或用本地服务器打开，识别就能用。样板报告不受影响。</div>' : '') +

      '<button class="btn btn-main" id="btnGo" style="display:none">识别这份报告</button>' +
      '<button class="btn btn-ghost" id="btnDemo">先用样板报告体验（真实体检数据）</button>' +
      '<button class="btn btn-ghost btn-alt" id="btnDemo2">换个人试试：45 岁女性，血糖偏高型</button>' +
      '<p class="swap-note">同一套规则，换一份报告会得到完全不同的结论。点第二个按钮可以对比。</p>' +

      '<div class="privacy">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="#7E9099" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/>' +
        '</svg>' +
        '<div>报告在本机解析，不上传服务器。识别结果仅用于健康提示，不构成诊断依据。</div>' +
      '</div>' +

      '<div class="sec-title"><h2>同一份报告，三个红字怎么讲</h2></div>' +
      '<div class="red-demo">' +
        '<div class="rd-head">下面三条都来自同一份真实报告，都带 ↑ 或 ↓。' +
          '<b>两个不用管，一个必须管</b>——区别不在箭头，在它到底影响什么。</div>' +

        '<div class="rd-item ok">' +
          '<div class="rd-row">' +
            '<div class="rd-name">高密度脂蛋白 HDL-C<span class="rd-ref">参考 1.16–1.42</span></div>' +
            '<div class="rd-num"><b>1.54</b><i>↑</i><span>mmol/L</span></div>' +
          '</div>' +
          '<div class="rd-body"><span class="rd-tag ok">不用管</span>' +
            '<p>这是「好胆固醇」，负责把血管里的胆固醇运回肝脏，偏高对心血管是保护性的。报告标红只是因为它跑出了区间，不是因为它坏。</p></div>' +
        '</div>' +

        '<div class="rd-item ok">' +
          '<div class="rd-row">' +
            '<div class="rd-name">红细胞体积分布宽度 RDW-CV<span class="rd-ref">参考 12.2–14.8</span></div>' +
            '<div class="rd-num"><b>11.9</b><i>↓</i><span>%</span></div>' +
          '</div>' +
          '<div class="rd-body"><span class="rd-tag ok">不用管</span>' +
            '<p>临床只关心它「升高」（提示红细胞大小不均）。偏低只说明红细胞尺寸高度一致，没有病理意义。血红蛋白正常，不存在贫血。</p></div>' +
        '</div>' +

        '<div class="rd-item bad">' +
          '<div class="rd-row">' +
            '<div class="rd-name">血同型半胱氨酸 Hcy<span class="rd-ref">参考 0–15</span></div>' +
            '<div class="rd-num"><b>20.41</b><i>↑</i><span>μmol/L</span></div>' +
          '</div>' +
          '<div class="rd-body"><span class="rd-tag bad">要管</span>' +
            '<p>超出上限 36%，会持续刺激血管内皮，是独立于血脂之外的脑卒中风险因素。常见原因是叶酸或 B12 不足，补上通常能降下来——所以它排在 7 星第一位。</p></div>' +
        '</div>' +
      '</div>' +

      '<div class="sec-title"><h2>它能做什么</h2></div>' +
      '<div class="cap-grid">' +
        '<div class="cap"><b>结论都带依据</b><span>依据来自检验参考区间与公开指南，不是凭感觉</span></div>' +
        '<div class="cap"><b>按星级排先后</b><span>7 星到 1 星，哪件最该先动手，一眼看得出来</span></div>' +
        '<div class="cap"><b>哪个科可以先不跑</b><span>能靠饮食运动解决的，不让你白排一次队</span></div>' +
        '<div class="cap"><b>不用秤的方案</b><span>一掌肉、一捧菜、一拳头饭，12 个月训练表</span></div>' +
      '</div>' +

      '<div class="disclaimer"><b>关于本产品</b>' +
        '报告识别在本机完成，图片不会上传。识别结果会先让你逐行核对再分析——OCR 不是百分之百准，数字错一个结论就会反。所有结论基于公开的检验参考区间与临床指南，不替代执业医师的诊断。' +
      '</div>' +

      '<div class="install-card">' +
        '<div class="ic-ico">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="#0C8B94" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="6" y="2" width="12" height="20" rx="2.6"/><path d="M11 18.5h2"/></svg>' +
        '</div>' +
        '<div class="ic-t"><b>装到手机主屏，像 App 一样用</b>' +
          '<span>安卓：浏览器菜单选「安装应用 / 添加到主屏」；iPhone：分享 ⤴ → 添加到主屏幕。不用下载安装包。</span></div>' +
        '<button class="ic-btn" id="btnInstall" style="display:none">一键安装</button>' +
      '</div>';

    var dz = $('#dz'), input = $('#fileInput'), go = $('#btnGo');

    /* 已经装到主屏、正以 App 模式运行时，别再劝装一次 */
    var icard = $('.install-card');
    if (icard && isStandalone()) icard.style.display = 'none';

    dz.addEventListener('click', function () { input.click(); });
    /* 键盘用户：Tab 能到（tabindex=0），Enter / 空格能触发（role=button）。
       少了这段，上传区对键盘和读屏用户是不存在的。 */
    dz.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
        ev.preventDefault();
        input.click();
      }
    });
    input.addEventListener('change', function () {
      if (input.files && input.files[0]) pick(input.files[0]);
    });
    ['dragenter', 'dragover'].forEach(function (e) {
      dz.addEventListener(e, function (ev) { ev.preventDefault(); dz.classList.add('drag'); });
    });
    ['dragleave', 'drop'].forEach(function (e) {
      dz.addEventListener(e, function (ev) { ev.preventDefault(); dz.classList.remove('drag'); });
    });
    dz.addEventListener('drop', function (ev) {
      var f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (f) pick(f);
    });

    function pick(file) {
      STATE.uploadedFile = file;
      STATE.uploadedName = file.name;
      $('#dzName').textContent = file.name;
      $('#dzFile').classList.add('on');
      /* PDF 不用等用户点「识别」再判断——提前说清这份会走文字层
         还是扫描件识别，用户对等待时间有预期 */
      go.textContent = isPdf(file) ? '解析这份 PDF' : '识别这份报告';
      go.style.display = '';
      go.disabled = false;
    }

    /* 绝不能拿样板报告去填上传路径。
       用户传的是自己的报告，引擎没加载成功时必须明说——
       否则页面会渲染出别人的 86 分，还落盘成「上传的报告」，
       用户会把它当成自己的结论。这是这类产品最不该犯的错。 */
    go.addEventListener('click', function () {
      if (!STATE.uploadedFile) {
        window.alert('先选一份报告，再点这里。');
        return;
      }
      if (isPdf(STATE.uploadedFile)) runPdf(STATE.uploadedFile);
      else if (HL.ocr) runOcr(STATE.uploadedFile);
      else window.alert(
        '识别引擎没加载成功，请刷新页面重试。\n\n' +
        '如果反复出现，换手机自带浏览器或 Chrome 再试一次。\n' +
        '（样板报告不受影响，可以直接点下面的按钮体验）'
      );
    });
    $('#btnDemo').addEventListener('click', function () {
      STATE.uploadedName = null;
      runScan(HL.sample, 'sample');
    });
    $('#btnDemo2').addEventListener('click', function () {
      STATE.uploadedName = null;
      runScan(HL.sample2, 'sample2');
    });

    /* 成员切换 / 添加：切换会连带换掉「当前档案」，所以统一走 openProfile */
    $$('#view-intake [data-sw]').forEach(function (b) {
      b.addEventListener('click', function () { selectProfile(b.dataset.sw); });
    });
    var wpOpen = $('#view-intake [data-open]');
    if (wpOpen) wpOpen.addEventListener('click', function () { openProfile(wpOpen.dataset.open); });
    var wpAdd = $('#view-intake [data-add]');
    if (wpAdd) wpAdd.addEventListener('click', openSheet);

    var ib = $('#btnInstall');
    if (ib) {
      if (DEFERRED_INSTALL) ib.style.display = '';
      ib.addEventListener('click', doInstall);
    }
  }

  /* ================= 扫描动效 ================= */
  /* 步骤里的示例文字从报告本身取，换报告不会露出别人的指标 */
  function scanSteps(report) {
    var hits = (report.items || []).filter(function (it) {
      return it.status !== 'normal' && it.value != null;
    }).slice(0, 4).map(function (it) {
      return it.name + ' ' + it.value + (it.unit ? ' ' + it.unit : '');
    });
    var mid = hits.map(function (t, i) { return { p: 52 + i * 9, t: t }; });
    return [
      { p: 12, t: '正在识别报告版式…' },
      { p: 26, t: '定位检查项目与数值…' },
      { p: 41, t: '匹配参考区间…' }
    ].concat(mid).concat([
      { p: 94, t: '正在排优先级与科室…' },
      { p: 100, t: '完成' }
    ]);
  }

  function runScan(report, kind) {
    report = report || HL.sample;
    var STEPS = scanSteps(report);
    var total = (report.items || []).length + (report.imaging || []).length;
    var scan = $('#scan'), pct = $('#scanPct'), fill = $('#scanFill'), now = $('#scanNow'), note = $('#scanNote');
    /* 样板报告是本地写死的数据，没有"扫描"这回事，只是走一遍动效。
       9 步 × 300ms + 收尾 420ms ≈ 3.3 秒空白，对中年用户等于劝退。
       所以样板路径压到 60ms/步（约 0.9 秒），真实上传仍保留 300ms 的节奏感。
       动画本身不删——它是产品调性的一部分，只是不该让人干等。 */
    var pace = (kind === 'sample' || kind === 'sample2') ? 60 : 300;
    scan.classList.add('on');
    var i = 0;

    function step() {
      if (i >= STEPS.length) {
        setTimeout(function () {
          scan.classList.remove('on');
          var r = HL.engine.analyze(report);
          STATE.result = r;
          STATE.report = report;
          STATE.showAllFindings = false;
          renderAll(r);
          $('#btnReset').style.display = '';
          saveLast(kind || 'sample', STATE.uploadedName);
          switchTab('overview');
          /* 样板数据不落库，结构化结果只留在本次会话（persist=false） */
          refreshImagingStruct(report, false);
        }, pace + 120);
        return;
      }
      var s = STEPS[i++];
      pct.textContent = s.p;
      fill.style.width = s.p + '%';
      now.textContent = s.t;
      if (s.p > 45 && s.p < 100) note.textContent = '已识别 ' + Math.round(s.p / 100 * total) + ' / ' + total + ' 项检查结果';
      setTimeout(step, pace);
    }
    step();
  }

  /* ================= 核对页确认后的收尾 =================
     OCR 和 PDF 两条路都走到这里：存报告、分析、渲染、切到总览。
     抽出来是因为两条路的收尾必须完全一致——否则同一份报告从图片
     传和从 PDF 传，落库的字段会不一样。 */
  function applyUploaded(report) {
    STATE.uploadedFile = null;
    /* 报告落到「当前档案」名下：上传页选的是谁，就存给谁 */
    saveReport(report, STATE.uploadedName);
    var r = HL.engine.analyze(report);
    STATE.result = r;
    STATE.report = report;
    STATE.showAllFindings = false;
    renderAll(r);
    $('#btnReset').style.display = '';
    $('#btnShare').style.display = '';
    saveLast('upload', STATE.uploadedName);
    renderWho();
    switchTab('overview');
    /* 先按原文出报告，再后台让 AI 把影像描述结构化，回来刷新那几张卡 */
    refreshImagingStruct(report, true);
  }

  /* ================= AI 影像结构化（后台，不阻塞） =================
     为什么放在渲染之后：免费模型单次调用要十几秒，卡在扫描动画里等于劝退。
     先出文本版报告（原有行为），模型回来后挂上 struct 再重算重渲染。
     - 没有密钥：直接返回，报告照常。
     - 已经结构化过：跳过，避免切成员/刷新反复烧额度。
     - persist=true：把结果随报告一起存盘，下次打开直接读缓存。 */
  function refreshImagingStruct(report, persist) {
    if (!report || !HL.img || !HL.img.hasConfig()) return;
    var imaging = report.imaging;
    if (!Array.isArray(imaging) || !imaging.length) return;
    /* 只发「会生成卡片的异常项」：正常项不生成卡片，发给模型纯属浪费额度和时间
       （样板 8 项全发要 30s+，只发 3 个异常项约 12s）。 */
    var targets = imaging.filter(function (im) { return im.status !== 'normal' && !im.struct; });
    if (!targets.length) return;

    HL.img.structurizeImaging(targets).then(function (res) {
      if (!res) return;
      var changed = false;
      res.forEach(function (s, i) {
        if (s && targets[i]) { targets[i].struct = s; changed = true; }
      });
      if (!changed) return;
      if (STATE.result) {
        var r = HL.engine.analyze(report);
        STATE.result = r;
        renderAll(r);
      }
      if (persist && report !== HL.sample && report !== HL.sample2) {
        try { saveReport(report, STATE.uploadedName); } catch (e) {}
      }
    });
  }

  function backToIntake() {
    STATE.uploadedFile = null;
    renderIntake();
  }

  /* ================= PDF 解析 ================= */
  /* 体检中心导出的报告九成是 PDF，让用户先截图是最大的摩擦点。
     电子报告带文字层，直接读原文（不存在认错字）；扫描件则渲染成
     图片交给 OCR。两条路最后都进同一个核对页——PDF 的表格同样会
     串行，用户必须有机会看一眼。 */
  function isPdf(file) {
    if (!file) return false;
    if (file.type === 'application/pdf') return true;
    return /\.pdf$/i.test(file.name || '');
  }

  function runPdf(file) {
    if (!HL.pdf) {
      window.alert('这个页面没有加载 PDF 解析模块，请刷新后重试');
      return;
    }
    var scan = $('#scan'), pct = $('#scanPct'), fill = $('#scanFill');
    var now = $('#scanNow'), note = $('#scanNote');

    scan.classList.add('on');
    pct.textContent = '0';
    fill.style.width = '0%';
    now.textContent = '正在打开 PDF';
    note.textContent = 'PDF 在本机解析，不会上传';

    HL.pdf.parse(file, function (stage, p, label) {
      pct.textContent = String(Math.round(p * 100));
      fill.style.width = (p * 100) + '%';
      now.textContent = label;
      if (stage === 'read') note.textContent = '正在读取 PDF 的文字层';
      if (stage === 'ocr') note.textContent = '这份 PDF 没有文字层，正在逐页识别，字越小越慢';
      if (stage === 'parse') note.textContent = '正在对照指标库';
    }).then(function (res) {
      scan.classList.remove('on');

      if (!res.items.length) {
        window.alert(
          '这份 PDF 里没有读到检验数据。\n\n' +
          '常见原因：只下载了封面页；报告是扫描件且字太小；或者这份 PDF ' +
          '只有结论文字、没有「项目 + 数值」的表格页。'
        );
        return;
      }

      HL.ocr.mountVerify($('#view-intake'), res, applyUploaded, backToIntake);
    }).catch(function (e) {
      scan.classList.remove('on');
      window.alert((e && e.message) || 'PDF 解析失败，换一份试试');
    });
  }

  /* ================= 照片识别 ================= */
  /* 识别完不直接出结论，先进核对页。
     理由写在 ocr.js 顶部：OCR 会认错字，一个字错结论就反，
     所以中间必须有人看一眼的机会。 */
  function runOcr(file) {
    var scan = $('#scan'), pct = $('#scanPct'), fill = $('#scanFill');
    var now = $('#scanNow'), note = $('#scanNote');

    scan.classList.add('on');
    pct.textContent = '0';
    fill.style.width = '0%';
    now.textContent = '正在准备识别';
    note.textContent = '首次使用要下载识别引擎（约 6MB），之后存在本地，不再下载';

    HL.ocr.recognize(file, function (stage, p, label) {
      pct.textContent = String(Math.round(p * 100));
      fill.style.width = (p * 100) + '%';
      now.textContent = label;
      if (stage === 'ocr') note.textContent = '正在逐行识别，字越小越慢，请稍候';
      if (stage === 'parse') note.textContent = '正在对照指标库';
    }).then(function (res) {
      scan.classList.remove('on');

      if (!res.items.length) {
        window.alert(
          '这张图没认出任何检查项目。\n\n' +
          '常见原因：拍歪了、有反光、只拍到局部，或者这张是纯文字的结论页。\n' +
          '建议把报告平放、光线均匀、正对着拍，只拍「项目名称 + 结果」那几列。'
        );
        return;
      }

      HL.ocr.mountVerify($('#view-intake'), res, applyUploaded, backToIntake);
    }).catch(function (e) {
      scan.classList.remove('on');
      window.alert((e && e.message) || '识别失败，换一张图试试');
    });
  }

  /* ================= 总览 ================= */
  function renderOverview(r) {
    /* 空报告：一项都没解析出来时，别装成「100 分状态不错」。
       直接说清楚现在缺什么、下一步该做什么。 */
    if (r.isEmpty) {
      $('#view-overview').innerHTML =
        '<div class="empty-state">' +
          '<div class="es-icon">📄</div>' +
          '<h2>这份报告里没读到检查结果</h2>' +
          '<p>照片太模糊、只拍到了封面页、或者表格被拆成好几页只传了一张，都会这样。' +
          '把「检验结果」那一页拍清楚再试一次；实在认不出，也可以直接看下面的内置样板。</p>' +
          '<div class="es-acts">' +
            '<button class="btn btn-main" id="btnEmptySample">看样板报告</button>' +
            '<button class="btn btn-ghost" id="btnEmptyBack">重新上传</button>' +
          '</div>' +
        '</div>' +
        disclaimerHtml();
      var be = $('#btnEmptySample'), bb = $('#btnEmptyBack');
      if (be) be.addEventListener('click', function () { runScan(HL.sample, 'sample'); });
      if (bb) bb.addEventListener('click', function () { $('#btnReset').click(); });
      return;
    }

    var circ = 2 * Math.PI * 44;
    var off = circ * (1 - r.score / 100);
    var st = r.stats;

    /* 评级话术跟着分数走。原来写死「整体可控」，
       66 分、22 项待跟进的报告也这么写，自相矛盾。 */
    var verdict = r.score >= 90 ? '状态不错'
      : r.score >= 80 ? '整体可控'
        : r.score >= 70 ? '有几件事要处理'
          : '需要认真对待';

    var weak = r.domains.slice().sort(function (a, b) { return a.score - b.score; })
      .filter(function (d) { return d.score < 90; }).slice(0, 2);
    var focusTxt = weak.length === 2
      ? weak[0].name + '、' + weak[1].name + '这两个维度'
      : weak.length === 1 ? weak[0].name + '这个维度' : '';

    /* 标题带不带项数，看这句话放不放得下。
       「整体可控，7 项需要跟进」一行刚好；「需要认真对待，23 项需要跟进」
       在 390 宽的屏上会被拆成两行，还把「23 项」切在两行之间。
       放不下就只留评级，项数挪到下面那段。 */
    var countTxt = st.realIssues ? st.realIssues + ' 项需要跟进' : '没有需要跟进的项目';
    var shortVerdict = r.score >= 80;

    var headLine = shortVerdict ? verdict + '，' + countTxt : verdict;

    var scoreSub = (shortVerdict ? '' : countTxt + '，') +
      '指标正常率 ' + st.normalRate + '%。' +
      (focusTxt ? '扣分主要来自' + focusTxt + '。' : '各维度都在 90 分以上。') +
      (st.realIssues ? '按星级从第一件开始做，不必一次全改。' : '');

    /* 数据完整度：体检套餐差别很大，查得少不等于身体好。
       没查到的项不扣分，所以综合分会偏高——这里把它说出来。 */
    var cov = r.coverage;
    var covHtml = (cov && cov.missing.length) ? (
      '<div class="cov">' +
        '<div class="cov-hd">' +
          '<b>本次未包含 ' + cov.missing.length + ' 个常见项目</b>' +
          '<span>' + cov.checked + ' / ' + cov.total + ' 项已查</span>' +
        '</div>' +
        '<div class="cov-list">' +
          cov.missing.slice(0, 6).map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') +
          (cov.missing.length > 6 ? '<span>等 ' + cov.missing.length + ' 项</span>' : '') +
        '</div>' +
        '<p>没查到的项目不参与评分，所以这个分数可能偏高。这不是说这些项目有问题，只是下次体检时可以按需补上。</p>' +
      '</div>'
    ) : '';

    /* 单位换算留痕：报告写英制单位（HGB 15.4 g/dL）时引擎会先换算成
       字典单位再判读。这一步必须让用户看见——否则等于悄悄改了他刚
       核对过的数字。没有换算时整块不渲染，老报告零影响。 */
    var convHtml = (r.conversions && r.conversions.length) ? (
      '<div class="conv-note">' +
        '<b>已按单位换算后再判读</b>' +
        r.conversions.map(function (c) {
          return '<span>' + esc(c.name || c.id) + '：' +
            esc(String(c.raw) + ' ' + c.from) + ' = ' +
            esc(String(c.value) + ' ' + c.to) + '</span>';
        }).join('') +
      '</div>'
    ) : '';

    var domainBars = r.domains.map(function (d) {
      var c = d.score >= 90 ? 'var(--green)' : d.score >= 80 ? 'var(--teal)' : d.score >= 70 ? '#DE8A2E' : 'var(--coral)';
      return '<div class="domain-row">' +
        '<div class="dm-name">' + esc(d.name) + '</div>' +
        '<div class="dm-bar"><div class="dm-fill" style="width:' + d.score + '%;background:' + c + '"></div></div>' +
        '<div class="dm-val" style="color:' + c + '">' + d.score + '</div>' +
      '</div>';
    }).join('');

    var riskHtml = r.riskCluster ? (
      '<div class="risk">' +
        '<div class="risk-hd"><h3>' + esc(r.riskCluster.title) + '</h3>' +
          '<span class="risk-lvl">' + esc(r.riskCluster.level) + '</span></div>' +
        '<div class="risk-hits">' + r.riskCluster.hits.map(function (h) { return '<span>' + esc(h) + '</span>'; }).join('') + '</div>' +
        '<p>' + esc(r.riskCluster.note) + '</p>' +
      '</div>'
    ) : '';

    /* 假警报：可展开看完整解释 */
    var benignHtml = r.falseAlarms.length ? (
      '<div class="benign-wrap">' +
        '<button class="benign-bar" id="benignToggle">' +
          '<span class="b-n">' + st.falseAlarmRows + '</span>' +
          '<span class="b-t"><b>项标红，其实不用管</b>' +
            r.falseAlarms.map(function (f) { return esc(f.rule.name.split('（')[0]); }).join('、') +
          ' —— 报告里标为异常，临床上无意义。点开看为什么。</span>' +
          '<span class="b-arrow">›</span>' +
        '</button>' +
        '<div class="benign-body" id="benignBody" style="display:none">' +
          r.falseAlarms.map(function (f) {
            return '<div class="benign-item">' +
              '<b>' + esc(f.rule.name) + '</b>' +
              '<div class="bi-head">' + esc(f.rule.headline) + '</div>' +
              '<p>' + esc(f.rule.detail) + '</p>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>'
    ) : '';

    /* 折叠卡已经很紧凑，默认放 8 项；超过再折叠，避免把真实问题藏起来 */
    var FOLD_AT = 8;
    var allCards = r.findings.map(function (f, i) {
      var hidden = i >= FOLD_AT && !STATE.showAllFindings;
      /* 第一张是「现在最该做的一件事」，直接摊开；其余折叠成可扫读的行 */
      return findingCard(f, hidden ? 'hidden' : (i === 0 ? 'full' : 'compact'), i === 0);
    }).join('');

    /* 轻度偏离：偏离参考区间不到 10%，不占星级卡位，
       但也不能消失——折叠成一行，点开能看到是哪几项 */
    var minorHtml = (r.minor && r.minor.length) ? (
      '<div class="minor-wrap">' +
        '<button class="minor-bar" id="minorToggle">' +
          '<span class="b-n">' + r.minor.length + '</span>' +
          '<span class="b-t"><b>项轻度偏离，先记着</b>' +
            r.minor.map(function (m) { return esc(String(m.name == null ? '' : m.name).split('（')[0]); }).join('、') +
            ' —— 刚过参考线，通常复查即可。点开看每项怎么理解。</span>' +
          '<span class="b-arrow">›</span>' +
        '</button>' +
        '<div class="minor-body" id="minorBody" style="display:none">' +
          r.minor.map(function (m) {
            return '<div class="minor-item">' +
              '<div class="mi-hd"><b>' + esc(m.name) + '</b>' +
                (m.v != null ? '<span class="mi-v">' + m.v + (m.u ? ' ' + esc(m.u) : '') + '</span>' : '') +
                (m.dev ? '<span class="mi-dev">偏离 ' + m.dev + '%</span>' : '') +
              '</div>' +
              (m.why ? '<p>' + esc(m.why) + '</p>' : '') +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>'
    ) : '';

    $('#view-overview').innerHTML =
      (STATE.uploadedName ?
        '<div class="src-bar">' +
          '<b>' + (profList().length > 1
            ? '来自「' + esc(activeProf().name) + '」上传的报告'
            : '来自你上传的报告') + '</b>' +
          '<span>「' + esc(STATE.uploadedName) + '」识别出 ' + r.items.length +
          ' 项，已按你核对后的数值分析。哪条结论对不上，多半是某个数字认错了——点右上角「重新上传」，把报告拍正、光线均匀再试一次。</span>' +
        '</div>' : '') +
      '<div class="score-card">' +
        '<div class="score-top">' +
          '<div class="ring">' +
            '<svg width="104" height="104" viewBox="0 0 104 104">' +
              '<circle cx="52" cy="52" r="44" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="8"/>' +
              '<circle cx="52" cy="52" r="44" fill="none" stroke="#4FD8D2" stroke-width="8" stroke-linecap="round" ' +
                'stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/>' +
            '</svg>' +
            '<div class="ring-mid"><div class="ring-num">' + r.score + '</div><div class="ring-lbl">健康分</div></div>' +
          '</div>' +
          '<div class="score-meta">' +
            '<div class="score-band">综合评级 · ' + esc(r.band) + '</div>' +
            '<h2>' + esc(headLine) + '</h2>' +
            '<p>' + esc(scoreSub) + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="score-stats">' +
          '<div class="ss"><b>' + st.total + '</b><span>检查项目</span></div>' +
          '<div class="ss"><b>' + st.realIssues + '</b><span>需跟进</span></div>' +
          '<div class="ss"><b>' + st.falseAlarmRows + '</b><span>假警报</span></div>' +
        '</div>' +
      '</div>' +

      covHtml +
      convHtml +

      '<div class="sec-title"><h2>八个维度的状态</h2><span class="sub">分数越高越好，40 为下限</span></div>' +
      '<div class="card domain-grid">' + domainBars + '</div>' +

      riskHtml + benignHtml +

      '<div class="sec-title"><h2>按星级排，先做这几件</h2><span class="sub">7 星最优先，同分看严重度</span></div>' +
      '<div class="rank-note">星越多不代表病越重，代表<b>现在最该动手</b>。判断看四件事：数值偏离多少、器官有没有已经出现改变、是不是和别的异常构成组合风险、现在干预还来不来得及。</div>' +
      '<div class="findings-grid">' + allCards + '</div>' +
      (r.findings.length > FOLD_AT && !STATE.showAllFindings ?
        '<button class="btn btn-ghost" id="btnAllFindings">查看全部 ' + r.findings.length + ' 项</button>' : '') +
      minorHtml +

      /* 历史对比放在收尾区：先看「现在该做什么」，再看「比上次怎么样」。
         放分数下面太抢戏——第一次进来还没读结论就被要求抄数字。 */
      '<div id="trendBox"></div>' +

      /* 分享入口：放在最后，因为看完才想发。
         文案写清「不带姓名」，否则没人敢往群里发。 */
      '<button class="share-cta" id="btnShareCta">' +
        '<span class="sc-ico">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M12 16V4"/><path d="M8 8l4-4 4 4"/><path d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4"/></svg>' +
        '</span>' +
        '<span class="sc-t"><b>把结论发给家人</b>' +
          '<small>生成一张竖图：分数、三件要做的事、缺了哪几项。不含姓名和报告原文。</small></span>' +
        '<span class="sc-arrow">›</span>' +
      '</button>' +

      disclaimerHtml();

    /* 假警报展开 */
    var bt = $('#benignToggle');
    if (bt) bt.addEventListener('click', function () {
      var b = $('#benignBody');
      var open = b.style.display !== 'none';
      b.style.display = open ? 'none' : '';
      bt.classList.toggle('open', !open);
    });

    /* 轻度偏离展开 */
    var mt = $('#minorToggle');
    if (mt) mt.addEventListener('click', function () {
      var b = $('#minorBody');
      var open = b.style.display !== 'none';
      b.style.display = open ? 'none' : '';
      mt.classList.toggle('open', !open);
    });

    /* 全部关注项 */
    var ba = $('#btnAllFindings');
    if (ba) ba.addEventListener('click', function () {
      STATE.showAllFindings = true;
      renderOverview(r);
    });

    /* 分享卡 */
    var sc = $('#btnShareCta');
    if (sc) sc.addEventListener('click', function () { openShare(); });

    /* 历史对比：补录完要重画整页（分数不变，但对比表要更新） */
    if (HL.trend) HL.trend.mount($('#view-overview'), r, function () { renderOverview(r); });

    /* 折叠卡：整张卡都可以点开 */
    $$('#view-overview .finding.is-compact').forEach(function (card) {
      card.addEventListener('click', function () {
        if (card.classList.contains('open')) return;
        var slot = card.querySelector('.f-detail-slot');
        if (slot) slot.style.display = '';
        card.classList.add('open');
      });
    });

    /* 凭什么 N 星 */
    $$('#view-overview .f-starwhy').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var box = btn.closest('.finding').querySelector('.f-starwhy-body');
        if (!box) return;
        var open = box.style.display !== 'none';
        box.style.display = open ? 'none' : '';
        btn.classList.toggle('open', !open);
      });
    });
  }

  /* ================= 关注项卡片 ================= */
  function findingCard(f, mode, isTop) {
    var r = f.rule;
    var hidden = mode === 'hidden';
    var compact = mode === 'compact';
    var sevLabel = f.benign ? '无需处理' : f.noDeduct ? '缺项' : ({ 3: '优先处理', 2: '需要干预', 1: '建议观察', 0: '无需处理' }[f.severity] || '观察');
    var tagCls = f.benign ? 'tag-benign' : 'tag-s' + f.severity;

    var detail = String(r.detail).split('\n\n').map(function (p) {
      return '<p>' + esc(p) + '</p>';
    }).join('');

    var acts =
      '<div class="f-acts">' +
        '<div class="f-acts-lbl">怎么做</div>' +
        '<ul>' + r.actions.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>' +
      '</div>';

    var dept = r.dept && HL.depts[r.dept] ? HL.depts[r.dept] : null;
    /* 科室 chip 做成可点的：点一下直接跳到就医页那一张卡 */
    var deptChip = dept
      ? '<button class="f-chip f-jump' + (dept.need === 'skip' ? ' f-chip-skip' : '') + '"' +
        ' data-jump="care" data-anchor="dept-' + esc(dept.key || r.dept) + '">科室 · <b>' +
        esc(dept.name) + (dept.need === 'skip' ? '（可不去）' : '') + '</b> ›</button>'
      : '';

    var chips = '<div class="f-foot">' +
      (f.starWhy ? '<button class="f-starwhy">凭什么 ' + f.stars + ' 星？</button>' : '') +
      '<span class="f-chip">复查 · <b>' + esc(r.recheck) + '</b></span>' +
      deptChip +
      '<span class="f-chip">数据 · <b>' + esc(r.grade) + '</b></span>' +
    '</div>';

    var whyBody = f.starWhy
      ? '<div class="f-starwhy-body" style="display:none">' + esc(f.starWhy) + '</div>'
      : '';

    var inner = '<div class="f-detail">' + detail + '</div>' + acts;

    /* 同族其他项：ALT 那张卡里带上 AST / GGT 的数值，
       避免同一件事开三张卡，也避免这些数值凭空消失 */
    var extraHtml = (f.extra && f.extra.length)
      ? '<div class="f-extra"><span class="fe-k">同族其他项</span>' +
          f.extra.map(function (x) {
            return '<span class="fe-i">' + esc(x.name) + ' <b>' + x.v + '</b>' +
              (x.u ? '<i>' + esc(x.u) + '</i>' : '') + '</span>';
          }).join('') + '</div>'
      : '';

    /* 折叠态里「需要干预」这类标签和星级是同一个意思，重复四遍就是噪音；
       只保留真正补充信息的：假警报 / 缺项 */
    var showTag = !compact || f.benign || f.noDeduct;

    var head = '<div class="finding-hd">' +
      '<div class="f-sev s' + f.severity + '"></div>' +
      '<div class="f-body">' +
        '<div class="f-top">' + starRow(f.stars) +
          (showTag ? '<span class="f-tag ' + tagCls + '">' + sevLabel + '</span>' : '') +
          (isTop && f.stars >= 3 ? '<span class="f-topnote">先做这件</span>' : '') + '</div>' +
        '<h3>' + esc(r.name) + '</h3>' +
        '<div class="f-head">' + esc(r.headline) + '</div>' +
        extraHtml +
      '</div>' +
      (compact ? '<span class="f-chev" aria-hidden="true">›</span>' : '') +
    '</div>';

    /* 折叠态只留「几星 / 什么名字 / 一句话」，点开才出正文、怎么做、复查与科室 */
    return '<div class="finding' + (hidden ? ' is-hidden' : '') +
      (isTop ? ' is-top' : '') + (compact ? ' is-compact' : '') + '">' +
      head +
      (compact
        ? '<div class="f-detail-slot" style="display:none">' + inner + chips + whyBody + '</div>'
        : inner + chips + whyBody) +
    '</div>';
  }

  /* ================= 就医导航 ================= */
  function deptCard(d) {
    var ico = ICONS[d.icon] || ICONS.heart;
    var isSkip = d.need === 'skip';
    var badge = isSkip
      ? '<span class="pri pri-skip">这次可以不去</span>'
      : '<span class="pri pri-must">必须去</span>';
    return '<div class="dept' + (isSkip ? ' dept-skip' : '') + '" id="dept-' + esc(d.key) + '">' +
      '<div class="dept-hd">' +
        '<div class="dept-ico"><svg viewBox="0 0 24 24" fill="none" stroke="#0C8B94" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + ico + '</svg></div>' +
        '<div class="dept-title">' +
          '<h3>' + esc(d.name) + '</h3>' +
          '<div class="dept-stars">' + starRow(d.stars) + '</div>' +
        '</div>' +
        badge +
      '</div>' +
      '<div class="dept-why"><span class="dw-k">' +
        (isSkip ? '报告里怎么写的' : '为什么非去不可') + '</span>' +
        '<p>' + esc(d.why) + '</p></div>' +
      (isSkip ?
        '<div class="skip-box">' +
          '<div class="sb-lbl">为什么这次不用去</div>' +
          '<p>' + esc(d.skipWhy) + '</p>' +
          '<div class="sb-lbl">什么情况下再去</div>' +
          '<p>' + esc(d.whenToGo) + '</p>' +
        '</div>'
      : '') +
      '<div class="dept-sec">' + (isSkip ? '如果最终还是去了，怎么准备' : '去之前准备') + '</div>' +
      '<ul class="dept-list">' + d.prep.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '<div class="dept-sec">见到医生问这三句</div>' +
      '<ul class="dept-list ask">' + d.ask.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '<div class="dept-foot"><span>建议时间</span><b>' + esc(d.within) + '</b></div>' +
    '</div>';
  }

  function renderCare(r) {
    var must = r.depts.map(deptCard).join('');
    var skip = r.skipDepts.map(deptCard).join('');

    var tripHtml = r.trips.map(function (t) {
      return '<div class="trip">' +
        '<div class="trip-hd"><span class="trip-no">' + t.no + '</span><b>' + esc(t.name) + '</b></div>' +
        '<div class="trip-depts">' + t.depts.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</div>' +
        '<p>' + esc(t.tip) + '</p>' +
      '</div>';
    }).join('');

    $('#view-care').innerHTML =
      '<button class="sum-entry" id="btnSummary">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="#0C8B94" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/>' +
          '<path d="M8.5 13h7M8.5 16.5h4.5"/>' +
        '</svg>' +
        '<span><b>生成就诊摘要</b><i>一页纸，带去诊室 · 可打印、可存图</i></span>' +
        '<em>›</em>' +
      '</button>' +
      '<div class="sec-title"><h2>必须去 ' + r.depts.length + ' 个，可不去 ' + r.skipDepts.length + ' 个</h2>' +
        '<span class="sub">按星级排序</span></div>' +
      '<div class="hint" style="margin:-4px 2px 12px">' +
        '体检报告拆出 ' + (r.depts.length + r.skipDepts.length) + ' 个科室方向。' +
        '但只有需要抽血、需要设备、需要处方的才必须跑一趟——其余的先靠饮食和运动，' +
        '到了复查时间再看。' +
      '</div>' +

      (tripHtml ? '<div class="sec-title"><h2>怎么跑最省时间</h2><span class="sub">' + r.trips.length + ' 趟就能跑完</span></div>' +
        '<div class="card">' + tripHtml + '</div>' : '') +

      '<div class="sec-title"><h2>必须去的 ' + r.depts.length + ' 个科</h2><span class="sub">自己做不到的</span></div>' +
      must +

      (skip ?
        '<div class="sec-title"><h2>可以先不去的 ' + r.skipDepts.length + ' 个科</h2><span class="sub">省下的时间和挂号费</span></div>' +
        '<div class="hint" style="margin:-4px 2px 12px">不是让你永远别去。是这两件事现在去医院，医生大概率也只是让你「先回去减重、先复查一次」，不如把这几个月用在能真正改变指标的事上。</div>' +
        skip : '') +

      '<div class="card mt12">' +
        '<div class="dept-sec" style="margin-top:0">省时提示</div>' +
        '<div class="note-item" style="padding-top:6px"><b>把报告按科室分页</b><span>打印时把同一科室相关的检验页放在一起，医生不用翻整本。甲状腺结节带超声页，Hcy 带生化页。</span></div>' +
        '<div class="note-item"><b>一次门诊解决两件事</b><span>内分泌科可以同时开甲功和抗体；心内科可以同时开 Hcy 复查、叶酸、B12。开单时说清「我想一次查完」。</span></div>' +
        '<div class="note-item"><b>空腹项目凑一天</b><span>甲功、血脂、肝功、血糖、Hcy 都需要空腹，安排在同一次抽血里，避免跑两趟。</span></div>' +
      '</div>' +

      '<div class="sec-title" id="followup"><h2>什么时候复查</h2><span class="sub">不用再挂号，直接约检查</span></div>' +
      followHtml(r) +

      xlink('diet', null, '除了去医院，还能自己做什么', '怎么吃 · 用手量，不用秤') +
      xlink('train', null, '运动怎么配合', '怎么运动 · 12 个月加量计划') +

      disclaimerHtml();

    /* 摘要要带上「这是谁的」：一家人共用一台手机时，
       打印出来没有名字就分不清是哪一份 */
    var bs = $('#btnSummary');
    if (bs) bs.addEventListener('click', function () {
      if (!HL.summary) return;
      HL.summary.open(r, activeProf().name);
    });
  }

  /* ================= 怎么吃 ================= */
  function renderDiet(r) {
    var p = r.plan;
    var sets = p.dietSets;
    var idx = STATE.dietSet % sets.length;
    var set = sets[idx];

    /* --- 手掌量具 --- */
    var units = p.portion.units.map(function (u) {
      return '<div class="unit-row">' +
        '<div class="u-k">' + esc(u.k) + '</div>' +
        '<div class="u-v"><b>' + esc(u.v) + '</b><span>' + esc(u.use) + '</span></div>' +
      '</div>';
    }).join('');

    var daily = p.portion.daily.map(function (d) {
      return '<div class="daily-item"><div class="di-v">' + esc(d.v) + '</div>' +
        '<div class="di-t">' + esc(d.t) + '</div><div class="di-n">' + esc(d.n) + '</div></div>';
    }).join('');

    /* --- 一天怎么吃 --- */
    var flow = p.eatFlow.rows.map(function (x) {
      return '<div class="flow-item">' +
        '<div class="fl-t">' + esc(x.t) + '</div>' +
        '<div class="fl-b"><b>' + esc(x.k) + '</b><span>' + esc(x.d) + '</span></div>' +
      '</div>';
    }).join('');

    /* --- 饱腹感 --- */
    var fs = p.fullness.scale.map(function (x) {
      return '<div class="fs-row ' + x.tone + '">' +
        '<div class="fs-n">' + x.n + '</div>' +
        '<div class="fs-b"><b>' + esc(x.t) + '</b><span>' + esc(x.d) + '</span></div>' +
      '</div>';
    }).join('');

    /* --- 菜单 --- */
    var days = set.days.map(function (d) {
      return '<div class="meal-day">' +
        '<div class="meal-d">' + esc(d.d) + '</div>' +
        '<div class="meal-row"><div class="meal-k">早</div><div class="meal-v">' + esc(d.b) + '</div></div>' +
        '<div class="meal-row"><div class="meal-k">午</div><div class="meal-v">' + esc(d.l) + '</div></div>' +
        '<div class="meal-row"><div class="meal-k">晚</div><div class="meal-v">' + esc(d.d2) + '</div></div>' +
      '</div>';
    }).join('');

    /* --- 执行要点 --- */
    var notes = p.notes.map(function (n) {
      return '<div class="note-item"><b>' + esc(n.t) + '</b><span>' + esc(n.d) + '</span></div>';
    }).join('');

    /* --- 采购 --- */
    var shop = p.shopping.map(function (s) {
      return '<div class="shop-cat">' + esc(s.cat) + '</div><div class="shop-items">' + esc(s.items) + '</div>';
    }).join('');

    /* --- 备餐 --- */
    var prep = p.prep.steps.map(function (x) {
      return '<div class="note-item"><b>' + esc(x.t) + '</b><span>' + esc(x.d) + '</span></div>';
    }).join('');

    /* --- 加餐 --- */
    var snack = p.snack.rows.map(function (x) {
      return '<tr><td class="hr" style="white-space:nowrap">' + esc(x.kcal) + '</td>' +
        '<td><b style="font-weight:600;font-size:12.5px;color:var(--ink)">' + esc(x.items) + '</b>' +
        '<span style="display:block;font-size:11.5px;line-height:1.55;color:var(--muted);margin-top:3px">' + esc(x.note) + '</span></td></tr>';
    }).join('');

    /* --- 烹饪 --- */
    var cook = p.cook.order.map(function (x) {
      return '<div class="cook-row"><div class="cook-k">' + esc(x.k) + '</div>' +
        '<div class="cook-b"><b>' + esc(x.v) + '</b><span>' + esc(x.d) + '</span></div></div>';
    }).join('');

    /* --- 误区 --- */
    var myths = p.myths.map(function (x) {
      return '<div class="myth"><div class="my-q">' + esc(x.t) + '</div><p>' + esc(x.d) + '</p></div>';
    }).join('');

    $('#view-diet').innerHTML =
      '<div class="sec-title"><h2>怎么吃</h2><span class="sub">不用秤，用你的手</span></div>' +
      '<div class="hint" style="margin:-4px 2px 12px">' +
        '这一页解决三件事：吃多少、什么时候吃、怎么才能一直这么吃。菜单只是参考，规则比菜单重要。' +
      '</div>' +

      '<div class="kpi-grid">' +
        kpi('每日热量', p.kcalLo + '–' + p.kcalHi, 'kcal', '基础代谢 ' + p.bmr + ' · 总消耗 ' + p.tdee) +
        kpi('蛋白质', p.proteinLo + '–' + p.proteinHi, 'g', '约 4–5 掌心，每餐 1 掌心') +
        kpi('碳水', p.carbLo + '–' + p.carbHi, 'g', '约 3 拳头，两拳头是粗粮') +
        kpi('脂肪', p.fatLo + '–' + p.fatHi, 'g', '约 2.5 拇指的烹调用油') +
      '</div>' +

      /* ---------- 1. 手掌量化 ---------- */
      '<div class="sec-title"><h2>吃多少：用手量</h2><span class="sub">误差 20%，比不量强得多</span></div>' +
      '<div class="card">' +
        '<p class="portion-intro">' + esc(p.portion.intro) + '</p>' +
        '<div class="unit-list">' + units + '</div>' +
        '<div class="portion-daily">' + daily + '</div>' +
      '</div>' +

      /* ---------- 2. 一天怎么吃 ---------- */
      '<div class="sec-title"><h2>什么时候吃</h2><span class="sub">顺序比份量更重要</span></div>' +
      '<div class="card">' +
        '<p class="portion-intro">' + esc(p.eatFlow.intro) + '</p>' +
        '<div class="flow-list">' + flow + '</div>' +
        '<div class="hint">' + esc(p.eatFlow.tip) + '</div>' +
      '</div>' +
      calCard('meal') +

      /* ---------- 3. 吃到几分饱 ---------- */
      '<div class="sec-title"><h2>吃到几分饱停</h2><span class="sub">这一节最容易做到</span></div>' +
      '<div class="card">' +
        '<p class="portion-intro">' + esc(p.fullness.head) + '</p>' +
        '<div class="fs-list">' + fs + '</div>' +
        '<div class="hint">' + esc(p.fullness.tip) + '</div>' +
      '</div>' +

      /* ---------- 4. 执行要点 ---------- */
      '<div class="sec-title"><h2>针对你这份报告的四条</h2><span class="sub">其余都是通用建议</span></div>' +
      '<div class="card"><ul class="note-list">' + notes + '</ul></div>' +

      /* ---------- 5. 四周菜单 ---------- */
      '<div class="sec-title"><h2>四周轮换菜单</h2>' +
        '<span class="sub">第 ' + (idx + 1) + ' / ' + sets.length + ' 套</span></div>' +
      '<div class="menu-bar">' +
        '<div class="mb-txt"><b>' + esc(set.name) + '</b><span>' + esc(set.tag) + '</span></div>' +
        '<button class="mb-btn" id="btnSwapMenu">换一套 ›</button>' +
      '</div>' +
      '<div class="card">' + days + '</div>' +
      '<div class="hint">四周一轮，第 5 周回到第 1 套——不会每周都吃一样的。' +
        '同一类食材可以互换：鱼换鸡换虾、糙米换藜麦换玉米，看下面的采购清单挑你买得到的。</div>' +

      /* ---------- 6. 采购 + 备餐 ---------- */
      '<div class="sec-title"><h2>买什么</h2><span class="sub">按类别一次买齐</span></div>' +
      '<div class="card">' + shop + '</div>' +

      '<div class="sec-title"><h2>周日 90 分钟备餐</h2><span class="sub">把「选择」提前做完</span></div>' +
      '<div class="card">' +
        '<p class="stick-head">' + esc(p.prep.head) + '</p>' +
        '<ul class="note-list">' + prep + '</ul>' +
        '<div class="hint">' + esc(p.prep.tip) + '</div>' +
      '</div>' +

      /* ---------- 7. 饿了 ---------- */
      '<div class="sec-title"><h2>饿了怎么办</h2><span class="sub">加餐不是破戒</span></div>' +
      '<div class="card">' +
        '<p class="stick-head">' + esc(p.snack.head) + '</p>' +
        '<div style="overflow-x:auto"><table class="tbl"><thead><tr>' +
          '<th style="width:52px">热量</th><th>选这些</th></tr></thead>' +
          '<tbody>' + snack + '</tbody></table></div>' +
        '<div class="hint" style="color:#B4553F">' + esc(p.snack.avoid) + '</div>' +
      '</div>' +

      /* ---------- 8. 怎么做 ---------- */
      '<div class="sec-title"><h2>怎么做</h2><span class="sub">同样食材，热量差一倍</span></div>' +
      '<div class="card">' +
        '<p class="stick-head">' + esc(p.cook.head) + '</p>' +
        cook +
        '<div class="note-item"><b>控油</b><span>' + esc(p.cook.oil) + '</span></div>' +
        '<div class="note-item"><b>调味</b><span>' + esc(p.cook.season) + '</span></div>' +
        '<div class="note-item"><b>绿叶菜别久煮</b><span>' + esc(p.cook.leaf) + '</span></div>' +
      '</div>' +

      /* ---------- 9. 外食 ---------- */
      '<div class="sec-title"><h2>外食怎么点</h2><span class="sub">食堂、外卖、火锅、烧烤</span></div>' +
      '<div class="card">' +
        '<div class="note-item" style="padding-top:0"><b>点菜顺序</b><span>先点一份清炒或白灼的绿叶菜，再点蛋白质（鱼、鸡、牛肉），最后才点主食。主食只吃一半。</span></div>' +
        '<div class="note-item"><b>避开这三类</b><span>糖醋 / 红烧 / 干锅（糖油双高）、勾芡汤羹、含糖饮料。这三类是脂肪肝最直接的推手。</span></div>' +
        '<div class="note-item"><b>火锅与烧烤</b><span>可以吃。清汤锅底，蘸料用醋 + 蒜 + 少量酱油，不喝汤底，肉类选瘦的，主食换成杂粮或不吃。</span></div>' +
        '<div class="note-item"><b>喝酒这件事</b><span>一杯啤酒约 150 kcal，且酒精优先被代谢，同时吃进去的脂肪会先存起来。要减脂肪肝，这段时间先停。</span></div>' +
      '</div>' +

      /* ---------- 10. 误区 ---------- */
      '<div class="sec-title"><h2>五个最容易踩的坑</h2><span class="sub">比菜单更值得读</span></div>' +
      '<div class="card">' + myths + '</div>' +

      xlink('train', null, '吃对了，还要练', '怎么运动 · 12 个月加量计划') +
      xlink('care', 'followup', '什么时候复查', '就医页 · 复查节奏表') +

      disclaimerHtml();

    var sw = $('#btnSwapMenu');
    if (sw) sw.addEventListener('click', function () {
      STATE.dietSet = (STATE.dietSet + 1) % HL.plan.dietSets.length;
      saveUI();
      renderDiet(r);
    });

    bindCal('meal');
  }

  /* ================= 跨页跳转条 ================= */
  function xlink(tab, anchor, label, sub) {
    return '<button class="xlink" data-jump="' + tab + '"' +
      (anchor ? ' data-anchor="' + anchor + '"' : '') + '>' +
      '<span class="xl-txt"><b>' + label + '</b><i>' + sub + '</i></span>' +
      '<span class="xl-a">›</span></button>';
  }

  function kpi(label, val, unit, sub) {
    return '<div class="kpi"><div class="k-lbl">' + label + '</div>' +
      '<div class="k-val">' + val + '<small>' + unit + '</small></div>' +
      '<div class="k-sub">' + sub + '</div></div>';
  }

  /* ================= 怎么运动 ================= */
  /* 「针对你报告」这一块以前把「你尿酸 405.7」写死在代码里，
     换一份报告就变成别人的数值——必须从当前报告里取。 */
  function itemOf(r, id) {
    var found = null;
    (r.items || []).forEach(function (it) { if (it.id === id) found = it; });
    return found;
  }

  function reportNotes(r) {
    var rows = [];

    var fev = itemOf(r, 'fev1') || itemOf(r, 'fev1fvc');
    if (fev && fev._status && fev._status !== 'normal') {
      rows.push({
        t: '肺功能：先测再练',
        d: '肺功能复查前 24 小时不要做高强度训练，会影响结果。复查确认后，有氧以节奏稳定为主，鼻吸口呼，不要憋气发力。'
      });
    }

    var ua = itemOf(r, 'uric');
    if (ua && ua.value != null) {
      var hi = (ua.ref && ua.ref[1]) || 428;
      var over = ua.value > hi;
      var near = !over && ua.value >= hi * 0.85;
      rows.push({
        t: '减重速度：别求快',
        d: '你尿酸 ' + ua.value + (ua.unit ? ' ' + ua.unit : '') +
          (over ? '，已经超过上限' : near ? '，接近上限' : '，目前在正常范围内') +
          '。快速减重会让尿酸短时升高，也可能诱发胆结石，每周 0.5 kg 是安全线。'
      });
    }

    if (!rows.length) {
      rows.push({
        t: '减重速度：别求快',
        d: '每周 0.5 kg 是安全线。减得太快掉的先是肌肉和水，停下来反弹得更快。'
      });
    }

    return '<div class="card">' +
      '<div class="dept-sec" style="margin-top:0">针对你报告的' +
        (rows.length > 1 ? '两条' : '一条') + '注意</div>' +
      rows.map(function (x, i) {
        return '<div class="note-item"' + (i === 0 ? ' style="padding-top:6px"' : '') + '>' +
          '<b>' + esc(x.t) + '</b><span>' + esc(x.d) + '</span></div>';
      }).join('') +
    '</div>';
  }

  function renderTrain(r) {
    var p = r.plan;

    var ranges = [['week', '本周'], ['month', '第 1 月'], ['quarter', '前 3 月'], ['year', '12 个月']];
    var rangeHtml = ranges.map(function (x) {
      return '<button class="rng' + (STATE.trainRange === x[0] ? ' on' : '') + '" data-r="' + x[0] + '">' + x[1] + '</button>';
    }).join('');

    var body = '';
    if (STATE.trainRange === 'week') body = weekView(p, r);
    else if (STATE.trainRange === 'month') body = monthView(p, r);
    else if (STATE.trainRange === 'quarter') body = quarterView(p, r);
    else body = yearView(p, r);

    /* 每次训练流程 */
    var sess = p.session.steps.map(function (x) {
      return '<div class="flow-item">' +
        '<div class="fl-t">' + esc(x.t) + '</div>' +
        '<div class="fl-b"><b>' + esc(x.k) + '</b><span>' + esc(x.d) + '</span></div>' +
      '</div>';
    }).join('');

    /* 五个动作 */
    var moves = p.moves.map(function (x) {
      return '<div class="mv-item">' +
        '<div class="mv-hd">' + esc(x.t) + '</div>' +
        '<p>' + esc(x.d) + '</p>' +
        '<div class="mv-err">' + esc(x.err) + '</div>' +
      '</div>';
    }).join('');

    /* 器械 */
    var tiers = p.equip.tiers.map(function (x) {
      return '<div class="note-item"><b>' + esc(x.k) + ' · ' + esc(x.v) + '</b><span>' + esc(x.d) + '</span></div>';
    }).join('');

    /* 有氧 */
    var cardio = p.cardio.rows.map(function (x) {
      return '<div class="note-item"><b>' + esc(x.k) + ' <i class="cd-tag">' + esc(x.tag) + '</i></b><span>' + esc(x.d) + '</span></div>';
    }).join('');

    /* 安全 */
    var safety = p.safety.rows.map(function (x) {
      return '<div class="sf-row ' + x.tone + '">' +
        '<b>' + esc(x.t) + '</b><span>' + esc(x.d) + '</span></div>';
    }).join('');

    /* 记录 */
    var track = p.track.rows.map(function (x) {
      return '<div class="note-item"><b>' + esc(x.t) + ' <i class="cd-tag">' + esc(x.f) + '</i></b><span>' + esc(x.d) + '</span></div>';
    }).join('');

    /* 心率 */
    var zoneBar = function (label, z, pct, color) {
      return '<div class="domain-row"><div class="dm-name">' + label + '</div>' +
        '<div class="dm-bar"><div class="dm-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
        '<div class="dm-val" style="font-size:11px;color:' + color + ';width:64px">' + hrText(z, p.maxHR) + '</div></div>';
    };

    $('#view-train').innerHTML =
      '<div class="sec-title"><h2>怎么运动</h2><span class="sub">12 个月，不是一周</span></div>' +
      '<div class="hint" style="margin:-4px 2px 12px">' +
        '这一页解决三件事：每次练什么、长期怎么加量、断了怎么接回来。动作标准比重量重要，坚持比强度重要。' +
      '</div>' +

      checkinHtml(p) +
      calCard('train') +

      '<div class="kpi-grid">' +
        kpi('周有氧时长', '150–250', '分钟', '中等强度，可分次累计') +
        kpi('抗阻训练', '2–3', '次/周', '大肌群，每次 40 分钟') +
        kpi('目标心率', p.zones.mid[0] + '–' + p.zones.mid[1], '次/分', '最大心率 ' + p.maxHR + ' 的 64–76%') +
        kpi('12 周减重', '–' + p.dropKg, 'kg', '每周 0.4–0.6kg，不丢肌肉') +
      '</div>' +

      /* ---------- 1. 一次训练的流程 ---------- */
      '<div class="sec-title"><h2>一次训练分四段</h2><span class="sub">前后两段最常被省掉</span></div>' +
      '<div class="card">' +
        '<p class="stick-head">' + esc(p.session.head) + '</p>' +
        '<div class="flow-list">' + sess + '</div>' +
        '<div class="hint">' + esc(p.session.tip) + '</div>' +
      '</div>' +

      /* ---------- 2. 心率 ---------- */
      '<div class="card">' +
        '<div class="dept-sec" style="margin-top:0">心率区间对照</div>' +
        zoneBar('低强度', p.zones.low, 34, 'var(--green)') +
        zoneBar('中等强度', p.zones.mid, 64, 'var(--teal)') +
        zoneBar('高强度', p.zones.high, 88, '#DE8A2E') +
        '<div class="hint">最大心率按 220 − 年龄估算。有氧以「能说完整句子、但不能唱歌」为中等强度，这句话比看表更准。</div>' +
      '</div>' +

      /* ---------- 3. 动作怎么做 ---------- */
      '<div class="sec-title"><h2>五个动作，覆盖全身</h2><span class="sub">先学对，再加重</span></div>' +
      '<div class="card">' + moves + '</div>' +

      /* ---------- 4. 器械 ---------- */
      '<div class="sec-title"><h2>没器械怎么办</h2><span class="sub">第一档就够用一年</span></div>' +
      '<div class="card">' +
        '<p class="stick-head">' + esc(p.equip.head) + '</p>' +
        tiers +
        '<div class="hint">' + esc(p.equip.tip) + '</div>' +
      '</div>' +

      /* ---------- 5. 有氧怎么选 ---------- */
      '<div class="sec-title"><h2>有氧选哪个</h2><span class="sub">按关节负担排</span></div>' +
      '<div class="card">' +
        '<p class="stick-head">' + esc(p.cardio.head) + '</p>' +
        cardio +
        '<div class="hint">' + esc(p.cardio.tip) + '</div>' +
      '</div>' +

      /* ---------- 6. 长期递进 ---------- */
      '<div class="sec-title"><h2>练多久、怎么递进</h2><span class="sub">点一下换周期</span></div>' +
      '<div class="range-bar">' + rangeHtml + '</div>' +
      body +

      /* ---------- 7. 记录 ---------- */
      '<div class="sec-title"><h2>记什么才算进步</h2><span class="sub">打卡只证明你动了</span></div>' +
      '<div class="card">' +
        '<p class="stick-head">' + esc(p.track.head) + '</p>' +
        track +
        '<div class="hint">' + esc(p.track.tip) + '</div>' +
      '</div>' +

      /* ---------- 8. 防掉队 ---------- */
      '<div class="sec-title"><h2>断了怎么接回来</h2><span class="sub">这一节比训练表更重要</span></div>' +
      '<div class="card">' +
        '<p class="stick-head">' + esc(p.stick.head) + '</p>' +
        '<ul class="note-list">' +
          p.stick.rules.map(function (x) {
            return '<li class="note-item"><b>' + esc(x.t) + '</b><span>' + esc(x.d) + '</span></li>';
          }).join('') +
        '</ul>' +
      '</div>' +
      '<div class="card">' +
        '<div class="dept-sec" style="margin-top:0">两个防止放弃的机制</div>' +
        '<div class="note-item" style="padding-top:6px"><b>每 4 周复盘一次</b><span>' + esc(p.stick.review) + '</span></div>' +
        '<div class="note-item"><b>用非食物奖励自己</b><span>' + esc(p.stick.reward) + '</span></div>' +
      '</div>' +

      /* ---------- 9. 安全红线 ---------- */
      '<div class="sec-title"><h2>什么时候必须停</h2><span class="sub">不要「再坚持一下」</span></div>' +
      '<div class="card">' +
        '<p class="stick-head">' + esc(p.safety.head) + '</p>' +
        safety +
        '<div class="hint">' + esc(p.safety.tip) + '</div>' +
      '</div>' +

      /* ---------- 10. 针对报告 ---------- */
      reportNotes(r) +

      xlink('diet', null, '练完怎么吃', '怎么吃 · 手掌量化与四周菜单') +
      xlink('care', 'followup', '什么时候复查', '就医页 · 复查节奏表') +

      disclaimerHtml();

    $$('#view-train .rng').forEach(function (b) {
      b.addEventListener('click', function () {
        STATE.trainRange = b.dataset.r;
        saveUI();
        renderTrain(r);
      });
    });

    bindCal('train');

    $$('#view-train .mn-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        STATE.trainMonth = Math.max(1, Math.min(12, STATE.trainMonth + (+b.dataset.mv)));
        saveUI();
        renderTrain(r);
      });
    });

    /* 今天这一次：主按钮，明确「在打什么卡」 */
    var btnToday = $('#ckToday');
    if (btnToday) btnToday.addEventListener('click', function () {
      var cur = (HL.engine.templateFor(STATE.trainMonth).tpl || [])[todayIdx()] || {};
      toggleCheck(dkey(new Date()), { t: TYPE_KEY[cur.type] || 'other' }, r);
    });

    /* 7 天格子：今天等同主按钮，过去可补记，未来 disabled 不绑定 */
    $$('#view-train .ck').forEach(function (b) {
      if (b.disabled) return;
      b.addEventListener('click', function () {
        var i = +b.dataset.i;
        var cur = (HL.engine.templateFor(STATE.trainMonth).tpl || [])[i] || {};
        toggleCheck(b.dataset.k, { t: TYPE_KEY[cur.type] || 'other' }, r);
      });
    });

    /* 清空记录 */
    var clr = $('#ckClear');
    if (clr) clr.addEventListener('click', function () {
      /* 打卡按成员分开存，所以文案要说清清的是谁的 */
      if (!window.confirm('清空「' + activeProf().name + '」的所有打卡记录？这个操作不能撤销。')) return;
      try {
        localStorage.removeItem(ckKey());   /* 只清当前成员的 */
        if (profList().length === 1) localStorage.removeItem(CK_OLD);
      } catch (e) { /* 存不了也删不了，忽略 */ }
      CK_FAIL = false;
      renderTrain(r);
    });
  }

  function hrText(zone, maxHR) {
    return Math.round(maxHR * zone[0]) + '–' + Math.round(maxHR * zone[1]);
  }

  function weekView(p, r) {
    var m = STATE.trainMonth;
    var got = HL.engine.templateFor(m);
    var rows = got.tpl.map(function (x) {
      return '<tr><td class="d">' + esc(x.d) + '</td><td class="ty">' + esc(x.type) + '</td><td>' + esc(x.detail) + '</td><td class="hr">' + hrText(x.hr, p.maxHR) + '</td></tr>';
    }).join('');

    return '<div class="month-nav">' +
        '<button class="mn-btn" data-mv="-1" ' + (m <= 1 ? 'disabled' : '') + '>‹</button>' +
        '<div class="mn-mid"><b>第 ' + m + ' 个月 · ' + esc(got.month.title) + '</b>' +
          '<span>有氧 ' + got.month.aerobic + ' 分钟/周 · 抗阻 ' + got.month.strength + ' 次 · ' + esc(got.month.intensity) + '</span></div>' +
        '<button class="mn-btn" data-mv="1" ' + (m >= 12 ? 'disabled' : '') + '>›</button>' +
      '</div>' +
      '<div class="card flush" style="padding:14px 12px;overflow-x:auto">' +
        '<table class="tbl"><thead><tr><th style="width:40px"></th><th style="width:56px">类型</th><th>内容</th><th class="hr">心率</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table>' +
      '</div>' +
      '<div class="hint">本月里程碑：' + esc(got.month.milestone) + '。' + esc(got.month.note) + '</div>';
  }

  function monthView(p, r) {
    var got = HL.engine.templateFor(1);
    var weeks = [1, 2, 3, 4].map(function (w) {
      var aer = 150, str = 2, extra = '';
      if (w === 1) extra = '先戒含糖饮料；每次训练 25 分钟起，不追求时长';
      else if (w === 2) extra = '主食一半换粗粮；训练加到 40 分钟';
      else if (w === 3) extra = '开始记录每天吃了几掌心蛋白质';
      else extra = '第 4 周末称重、量腰围，做第一次复盘';
      return '<div class="wk-row">' +
        '<div class="wk-n">W' + w + '</div>' +
        '<div class="wk-body"><b>有氧 ' + aer + ' 分钟 · 抗阻 ' + str + ' 次</b><span>' + extra + '</span></div>' +
      '</div>';
    }).join('');

    return '<div class="card">' +
        '<div class="dept-sec" style="margin-top:0">第 1 个月 · 四周怎么走</div>' +
        '<p class="stick-head">' + esc(got.month.note) + '</p>' +
        weeks +
      '</div>' +
      '<div class="card">' +
        '<div class="dept-sec" style="margin-top:0">这个月只守三条</div>' +
        '<div class="note-item" style="padding-top:6px"><b>一周动 4 次以上</b><span>不要求每次 40 分钟。25 分钟也算一次，先让身体记住「这一天要动」。</span></div>' +
        '<div class="note-item"><b>含糖饮料归零</b><span>这一条对脂肪肝的贡献比任何训练都大。果汁、奶茶、蜂蜜水都算。</span></div>' +
        '<div class="note-item"><b>每天 4–5 掌心蛋白质</b><span>减重期蛋白质不够，掉的是肌肉，基础代谢会跟着降。</span></div>' +
      '</div>';
  }

  function quarterView(p, r) {
    var prog = p.monthProgram.slice(0, 3);
    var cards = prog.map(function (mo) {
      return '<div class="ph-card">' +
        '<div class="ph-hd"><span class="ph-m">M' + mo.m + '</span><b>' + esc(mo.title) + '</b></div>' +
        '<div class="ph-meta">有氧 ' + mo.aerobic + ' 分钟/周 · 抗阻 ' + mo.strength + ' 次 · HIIT ' + (mo.hiit || 0) + ' 次</div>' +
        '<div class="ph-mile">里程碑：' + esc(mo.milestone) + '</div>' +
        '<p>' + esc(mo.note) + '</p>' +
      '</div>';
    }).join('');

    return '<div class="card">' +
        '<div class="dept-sec" style="margin-top:0">前 3 个月是减重的主战场</div>' +
        '<p class="stick-head">这 3 个月的目标是把脂肪肝往回推、把 Hcy 降下来。第 12 周去复查，那组数字是后面 9 个月的基线。</p>' +
        cards +
        '<div class="hint">第 3 个月末如果体重降了 4kg 以上，说明方案对你是有效的，直接进第 4 个月；如果只降了 1–2kg，先看饮食执行率，别急着加运动量。</div>' +
      '</div>';
  }

  function yearView(p, r) {
    var rows = p.monthProgram.map(function (mo) {
      return '<tr>' +
        '<td class="d">M' + mo.m + '</td>' +
        '<td><b class="mt">' + esc(mo.title) + '</b><span class="md">' + esc(mo.milestone) + '</span></td>' +
        '<td class="hr">' + mo.aerobic + '<br><small>' + mo.strength + ' 次</small></td>' +
      '</tr>';
    }).join('');

    return '<div class="sec-title"><h2>12 个月一张表</h2><span class="sub">有氧分钟 / 抗阻次数</span></div>' +
      '<div class="card flush" style="padding:14px 12px;overflow-x:auto">' +
        '<table class="tbl"><thead><tr><th style="width:38px">月份</th><th>主题与里程碑</th><th class="hr">周量</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table>' +
      '</div>' +
      '<div class="card">' +
        '<div class="dept-sec" style="margin-top:0">这张表怎么用</div>' +
        '<div class="note-item" style="padding-top:6px"><b>不要提前跳到后面的月份</b><span>第 5 个月才加力量，是因为前 4 个月要把习惯和心肺底子打好。跳过去的结果通常是受伤，然后彻底停下。</span></div>' +
        '<div class="note-item"><b>每个月的「周量」是上限不是下限</b><span>做不到 220 分钟就做 150，能坚持的那个量才是你的量。</span></div>' +
        '<div class="note-item"><b>把 12 个月拆成 12 个小目标</b><span>每月只看本月里程碑那一行。看全年会崩，看一个月不会。</span></div>' +
      '</div>';
  }

  /* ---------- 打卡 ----------
     设计要点（v2）：
       1. 打卡必须知道「在打什么」——卡片直接显示今天该练什么，主按钮就是完成这一次
       2. 未来的日期不可点（v1 的 bug：整周都能点满）
       3. 进度按「周目标 4 次」算，不按「已过天数」算（否则周一打一次就是 100%）
       4. 记录带类型，才能回答「这周练了几次力量」
       5. 断档 ≥3 天主动给恢复建议，把防掉队规则真正激活
       6. 存储失败要显式提示，不能点了没反应
  ------------------------------------------------------------------ */
  /* 打卡按成员隔离：`hl_checkin_v2::<成员id>`。
     父亲的训练进度不能算到母亲头上——两个人练的项目和强度本来就不一样。 */
  var CK_BASE = 'hl_checkin_v2';
  var CK_OLD = 'hl_checkin_v1';
  var CK_GOAL = 4;              /* 每周最低目标，与 KPI「一周动 4 次以上」一致 */
  var CK_FAIL = false;          /* 本次会话存储是否失败 */

  function ckKey() { return CK_BASE + '::' + activeId(); }

  /* 注意：这里存的是类型 key，不是中文名。之前用中文做键，
     查 TYPE_SHORT['aerobic'] 永远取不到，格子只能显示 ✓。 */
  var TYPE_SHORT = { aerobic: '有', strength: '抗', recover: '恢', rest: '休', fun: '趣', other: '·' };
  var TYPE_KEY = { '有氧': 'aerobic', '长有氧': 'aerobic', '抗阻': 'strength', '恢复': 'recover', '主动恢复': 'rest', '兴趣运动': 'fun' };

  function loadCheck() {
    var raw = null;
    try {
      raw = localStorage.getItem(ckKey());
      /* 兼容档案功能上线前的全局打卡记录。只在「只有一个人」时回退，
         否则会把本人的记录原样算到家人头上。 */
      if (!raw && profList().length === 1) {
        raw = localStorage.getItem(CK_BASE) || localStorage.getItem(CK_OLD);
      }
    } catch (e) {
      CK_FAIL = true;
      return {};
    }
    var obj = {};
    try { obj = JSON.parse(raw || '{}') || {}; } catch (e) { obj = {}; }
    if (typeof obj !== 'object' || obj instanceof Array) obj = {};
    /* 旧格式 { '2026-11-02': 1 } → 新格式 { '2026-11-02': { t: 'other' } } */
    Object.keys(obj).forEach(function (k) {
      if (typeof obj[k] === 'number') obj[k] = { t: 'other' };
      else if (!obj[k] || typeof obj[k] !== 'object') delete obj[k];
    });
    /* 日期 key 补零迁移：'2026-11-3' → '2026-11-03'。
       幂等——补过零的 key 再跑一次不会被改动；非法 key 直接跳过。
       只有真的发生了迁移才写回，避免每次读都触发一次存储。 */
    var moved = false;
    Object.keys(obj).forEach(function (k) {
      var nk = migKey(k);
      if (!nk) return;
      if (!obj[nk]) obj[nk] = obj[k];       /* 新格式已存在则以它为准 */
      delete obj[k];
      moved = true;
    });
    /* 垃圾 key 直接扔掉：'not-a-date'、'2026-13-40'、'2026-02-31' 这类
       永远渲染不出来，留着只会越积越多，还会让「清空记录」看着像没清干净。
       注意先补零再校验，否则合法的 '2026-11-3' 会被当成非法删掉。 */
    Object.keys(obj).forEach(function (k) {
      if (validDateKey(k)) return;
      delete obj[k];
      moved = true;
    });
    if (moved) saveCheck(obj);
    return obj;
  }

  /* 严格校验 YYYY-MM-DD，且必须是真实存在的日期（2 月 31 号不算） */
  function validDateKey(k) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(k == null ? '' : k));
    if (!m) return false;
    var y = parseInt(m[1], 10), mo = parseInt(m[2], 10), dd = parseInt(m[3], 10);
    if (!(mo >= 1 && mo <= 12) || !(dd >= 1 && dd <= 31)) return false;
    var d = new Date(y, mo - 1, dd);
    return d.getFullYear() === y && d.getMonth() === mo - 1 && d.getDate() === dd;
  }

  function saveCheck(o) {
    try {
      localStorage.setItem(ckKey(), JSON.stringify(o));
      /* 只有单人时才能确定旧全局记录已经搬完，多人时留着不动 */
      if (profList().length === 1) localStorage.removeItem(CK_OLD);
      CK_FAIL = false;
      return true;
    } catch (e) {
      CK_FAIL = true;
      return false;
    }
  }

  /* 日期 key 必须补零：'2026-11-3' 与 '2026-11-10' 按字符串排序时
     前者反而更大，跨月跨年的历史记录会乱序。 */
  function dkey(d) {
    var m = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (dd < 10 ? '0' + dd : dd);
  }

  /* 老用户 localStorage 里存的是不补零的旧 key（'2026-11-3'），
     改格式后直接读会读不到，所以要迁一次。返回补零后的 key；
     已经合规、或不是日期形状的 key 一律返回 null（跳过，不抛错）。 */
  function migKey(k) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(k == null ? '' : k));
    if (!m) return null;
    var mo = parseInt(m[2], 10), dd = parseInt(m[3], 10);
    if (!(mo >= 1 && mo <= 12) || !(dd >= 1 && dd <= 31)) return null;
    var nk = m[1] + '-' + (mo < 10 ? '0' + mo : mo) + '-' + (dd < 10 ? '0' + dd : dd);
    return nk === k ? null : nk;            /* 已补零 → 无需迁移 */
  }

  function weekDates() {
    var now = new Date();
    var day = (now.getDay() + 6) % 7;           /* 周一为 0 */
    var mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
    var out = [];
    for (var i = 0; i < 7; i++) out.push(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i));
    return out;
  }

  function todayIdx() { return (new Date().getDay() + 6) % 7; }

  /* 连续打卡天数；今天还没打时从昨天起算，不算断 */
  function streakOf(data) {
    var n = 0, d = new Date();
    if (!data[dkey(d)]) d.setDate(d.getDate() - 1);
    while (data[dkey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  /* 距上一次打卡几天；从没打过返回 -1 */
  function daysSinceLast(data) {
    for (var i = 1; i <= 60; i++) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      if (data[dkey(d)]) return i;
    }
    return -1;
  }

  function toggleCheck(k, meta, r) {
    var data = loadCheck();
    if (data[k]) delete data[k];
    else {
      data[k] = meta || { t: 'other' };
      data[k].at = Date.now();
    }
    var ok = saveCheck(data);
    if (r) renderTrain(r);
    return ok;
  }

  function checkinHtml(p) {
    var data = loadCheck();
    var ds = weekDates();
    var today = new Date();
    var todayKey = dkey(today);
    var ti = todayIdx();

    var got = HL.engine.templateFor(STATE.trainMonth);
    var all = got.tpl || [];
    var cur = all[ti] || { type: '恢复', detail: '按身体感觉走，累了就休息', hr: [0.5, 0.6] };
    var todayDone = !!data[todayKey];

    var cells = ds.map(function (d, i) {
      var k = dkey(d);
      var v = data[k];
      var isToday = k === todayKey;
      var future = !isToday && d.getTime() > today.getTime();
      var cls = 'ck' + (v ? ' done' : '') + (isToday ? ' today' : '') + (future ? ' future' : '');
      var mark = v ? (TYPE_SHORT[v.t] || '✓') : '';
      return '<button class="' + cls + '" data-k="' + k + '" data-i="' + i + '"' +
        (future ? ' disabled aria-disabled="true" tabindex="-1"' : '') +
        ' aria-pressed="' + (v ? 'true' : 'false') + '"' +
        ' aria-label="' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + (v ? '已完成' : (future ? '未到' : '未完成')) + '">' +
        '<span class="ck-d">' + ['一', '二', '三', '四', '五', '六', '日'][i] + '</span>' +
        '<span class="ck-n">' + d.getDate() + '</span>' +
        '<span class="ck-m">' + mark + '</span>' +
      '</button>';
    }).join('');

    var done = ds.filter(function (d) { return data[dkey(d)]; }).length;
    var pct = Math.min(100, Math.round(done / CK_GOAL * 100));
    var range = (ds[0].getMonth() + 1) + '/' + ds[0].getDate() + ' – ' +
                (ds[6].getMonth() + 1) + '/' + ds[6].getDate();
    var planDays = all.filter(function (x) { return x.type !== '主动恢复'; }).length;

    /* 提示语：按优先级取第一条 */
    var tip, tone = '';
    var since = daysSinceLast(data);
    var streak = streakOf(data);

    if (CK_FAIL) {
      tone = 'bad';
      tip = '这个浏览器不允许本地保存（可能是无痕模式或隐私设置）。打卡可以点，但关掉页面就没了。';
    } else if (!todayDone && since >= 3) {
      tone = 'warn';
      tip = '上次打卡是 ' + since + ' 天前。按断 3–7 天的规则，今天从原剂量的 60% 开始（原计划 40 分钟就先做 25 分钟），别直接补上整份计划。';
    } else if (!todayDone && done === 0) {
      tip = '还没开始。今天先做 10 分钟也算——比计划完整但没开始强得多。';
    } else if (todayDone && streak >= 7) {
      tip = '已经连续 ' + streak + ' 天。这时候最该做的是别加量，把这个节奏再守一周。';
    } else if (done >= CK_GOAL) {
      tip = '本周已达标（' + done + '/' + CK_GOAL + ' 次）。剩下的日子挑一天做点轻松的，不用凑数。';
    } else if (!todayDone) {
      tip = '本周还差 ' + (CK_GOAL - done) + ' 次。今天这次做完，就只剩 ' + Math.max(0, CK_GOAL - done - 1) + ' 次了。';
    } else {
      tip = '今天已完成。本周还差 ' + Math.max(0, CK_GOAL - done) + ' 次，挑最容易的两天补上，不要连着练。';
    }

    return '<div class="card ck-card">' +
        '<div class="ck-hd">' +
          '<div><b>本周训练</b><span>' + range + ' · 目标 ' + CK_GOAL + ' 次</span></div>' +
          '<div class="ck-stat"><b>' + done + '/' + CK_GOAL + '</b><span>' + pct + '%</span></div>' +
        '</div>' +
        /* 四段进度：不读数字也能一眼看出完成几成 */
        '<div class="ck-bar">' +
          [0, 1, 2, 3].map(function (i) {
            return '<i class="' + (i < done ? 'on' : '') + '"></i>';
          }).join('') +
        '</div>' +

        /* 今天该练什么 —— 打卡必须有对象，不能「点一下就完成」 */
        '<div class="ck-today">' +
          '<div class="ck-t-top">' +
            '<span class="ck-t-lbl">今天 · 周' + ['一', '二', '三', '四', '五', '六', '日'][ti] + ' · 第 ' + got.month.m + ' 个月</span>' +
            '<span class="ck-t-type">' + esc(cur.type) + '</span>' +
          '</div>' +
          '<div class="ck-t-main">' + esc(cur.detail) + '</div>' +
          '<div class="ck-t-hr">目标心率 ' + hrText(cur.hr, p.maxHR) + ' 次/分 · ' + esc(cur.dur || '') + '</div>' +
          '<button class="ck-do' + (todayDone ? ' done' : '') + '" id="ckToday">' +
            (todayDone ? '今天已完成 ✓ <i>点一下撤销</i>' : '完成这次训练') +
          '</button>' +
        '</div>' +

        '<div class="ck-row">' + cells + '</div>' +
        '<div class="ck-tip' + (tone ? ' ' + tone : '') + '">' + esc(tip) + '</div>' +
        '<div class="ck-foot">' +
          '<span>本周计划 ' + planDays + ' 次，' + CK_GOAL + ' 次是及格线</span>' +
          '<button class="ck-clear" id="ckClear">清空记录</button>' +
        '</div>' +
      '</div>';
  }

  /* ---------- 复查（放在「就医」页底部） ---------- */
  function followHtml(r) {
    var groups = [];
    r.followup.forEach(function (f) {
      var g = groups.filter(function (x) { return x.when === f.when; })[0];
      if (!g) { g = { when: f.when, list: [] }; groups.push(g); }
      g.list.push(f);
    });

    var tl = groups.map(function (g) {
      var inner = g.list.map(function (f) {
        return '<h4>' + esc(f.title) + '</h4>' +
          '<ul>' + f.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' +
          (f.dept ? '<div class="tl-dept">科室 · ' + esc(f.dept) + '</div>' : '');
      }).join('');
      return '<div class="tl-item">' +
        '<div class="tl-when">' + esc(g.when) + '</div>' +
        '<div class="tl-grp">' + inner + '</div>' +
      '</div>';
    }).join('');

    return '<div class="card">' +
        '<div class="dept-sec" style="margin-top:0">复查节奏</div>' +
        '<div class="hint" style="margin-bottom:14px">不是所有项目都要复查。下面只列需要跟进的，正常项随年度体检即可。</div>' +
        '<div class="timeline">' + tl + '</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="dept-sec" style="margin-top:0">自己在家测什么</div>' +
        '<div class="note-item" style="padding-top:6px"><b>体重 · 每周一次</b><span>晨起空腹、排便后、同一台秤。看周均值，不看单日波动。</span></div>' +
        '<div class="note-item"><b>腰围 · 每月一次</b><span>肚脐水平，呼气末测量。目标降到 80cm 以下。</span></div>' +
        '<div class="note-item"><b>血压 · 每月 3–4 次</b><span>静坐 5 分钟后测，早晚各一次。记录下来给医生看，比诊室里单次测量准。</span></div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="dept-sec" style="margin-top:0">什么情况要提前就医</div>' +
        '<ul class="dept-list" style="margin-top:2px">' +
          '<li>颈部出现明显肿块、吞咽困难或声音嘶哑</li>' +
          '<li>持续乏力、怕冷、体重无故上升（甲减信号）</li>' +
          '<li>活动后气促明显加重，或出现持续咳嗽超过 3 周</li>' +
          '<li>右上腹持续隐痛、乏力伴尿色加深（肝功异常信号）</li>' +
          '<li>发热、盗汗、体重下降伴淋巴结肿大</li>' +
        '</ul>' +
      '</div>';
  }

  /* ================= 公共 ================= */
  function disclaimerHtml() {
    return '<div class="disclaimer"><b>重要提示</b>' +
      '本页所有结论由规则引擎基于检验参考区间与公开临床指南生成，属于健康教育与就医引导，不构成医学诊断，也不能替代执业医师的面诊。任何用药、补充剂与运动强度的调整，请以主诊医生意见为准。' +
    '</div>';
  }

  function renderAll(r) {
    renderOverview(r);
    /* 空报告没有可分析的东西：就医/饮食/运动三个页签全是空的，
       留着只会让人以为坏了，直接不显示。 */
    if (r.isEmpty) {
      $('#tabbar').classList.remove('on');
      $('#app').classList.remove('has-tabs');
      var sh0 = $('#btnShare');
      if (sh0) sh0.style.display = 'none';
      return;
    }
    renderCare(r);
    renderDiet(r);
    renderTrain(r);
    $('#tabbar').classList.add('on');
    $('#app').classList.add('has-tabs');
    var sh = $('#btnShare');
    if (sh) sh.style.display = '';
  }

  function switchTab(name) {
    STATE.tab = name;
    $$('.view').forEach(function (v) { v.classList.remove('on'); });
    var el = $('#view-' + name);
    if (el) el.classList.add('on');
    $$('.tab').forEach(function (t) { t.classList.toggle('on', t.dataset.tab === name); });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* 跨页跳转：总览里看到「科室 · 心内科」，点一下应该直接到那一张科室卡，
     而不是让人自己切到就医页再从六个科里翻。 */
  function jumpTo(tab, anchor) {
    if (!STATE.result) return;
    switchTab(tab);
    if (!anchor) return;
    setTimeout(function () {
      var el = document.getElementById(anchor);
      if (!el) return;
      var y = el.getBoundingClientRect().top + window.pageYOffset - 62;
      window.scrollTo({ top: y, behavior: 'smooth' });
      el.classList.add('flash');
      setTimeout(function () { el.classList.remove('flash'); }, 1600);
    }, 140);
  }

  /* ================= 成员切换 =================
     档案是「报告 + 打卡」的容器，切成员等于换一整套上下文：
     报告重跑引擎、打卡换 key、页面回到总览。 */
  function openProfile(id) {
    if (!setActive(id)) return;
    var p = activeProf();
    var rep = reportOf(p);
    closeSheet();
    renderWho();

    if (!rep) {
      /* 这个成员还没有报告：回上传页。绝不能把上一个人的结论留在屏幕上。 */
      STATE.result = null;
      STATE.uploadedName = null;
      STATE.uploadedFile = null;
      STATE.showAllFindings = false;
      STATE.dietSet = 0;
      STATE.trainRange = 'week';
      STATE.trainMonth = 1;
      $('#tabbar').classList.remove('on');
      $('#app').classList.remove('has-tabs');
      $('#btnReset').style.display = 'none';
      $('#btnShare').style.display = 'none';
      switchTab('intake');
      renderIntake();
      return;
    }

    STATE.uploadedName = p.kind === 'upload' ? (p.file || '上次上传的报告') : null;
    var r = HL.engine.analyze(rep);
    STATE.result = r;
    STATE.report = rep;
    STATE.showAllFindings = false;
    renderAll(r);
    $('#btnReset').style.display = '';
    $('#btnShare').style.display = r.isEmpty ? 'none' : '';
    switchTab('overview');
    refreshImagingStruct(rep, true);
  }

  /* 只换归属，不跳页：上传页上的成员按钮是「这份报告是谁的」，
     点它不该把人带走；想看已存的报告由「上次的报告」链接负责。 */
  function selectProfile(id) {
    if (!setActive(id)) return;
    renderWho();
    renderIntake();
  }

  /* 顶栏那条「当前档案」只在有家人时才出现：
     单人用户顶栏本来就挤（320px 下只剩 18px 余量），
     不该为他用不上的功能买单；加家人的入口在上传页。 */
  function renderWho() {
    var el = $('#tbWho');
    if (!el) return;
    var list = profList();
    if (list.length <= 1) {
      el.style.display = 'none';
      el.innerHTML = '';
      el.setAttribute('aria-hidden', 'true');
      return;
    }
    var p = activeProf();
    el.style.display = '';
    el.removeAttribute('aria-hidden');
    el.innerHTML = '<span class="tw-av">' + esc(String(p.name).charAt(0)) + '</span>' +
      '<span class="tw-t">当前档案 <b>' + esc(p.name) + '</b></span>' +
      '<span class="tw-go">切换 ›</span>';
    el.setAttribute('aria-label', '当前档案 ' + p.name + '，点按切换家庭成员');
  }

  /* ---------- 成员清单（底部弹层） ---------- */
  function ensureSheet() {
    var el = $('#whoSheet');
    if (el) return el;
    el = document.createElement('div');
    el.className = 'sheet';
    el.id = 'whoSheet';
    el.innerHTML =
      '<div class="sheet-mask" data-close="1"></div>' +
      '<div class="sheet-card" role="dialog" aria-modal="true" aria-label="家庭成员">' +
        '<div class="sheet-hd"><b>家庭成员</b>' +
          '<span>每份报告只对一个人有意义，分开存才不会串</span></div>' +
        '<div class="who-list" id="whoList"></div>' +
        '<div class="who-add-wrap">' +
          '<div class="who-add-t">添加一位家人</div>' +
          '<div class="rel-pick" id="relPick"></div>' +
        '</div>' +
        '<button class="sheet-cancel" data-close="1">关闭</button>' +
      '</div>';
    document.body.appendChild(el);

    el.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('[data-close]')) { closeSheet(); return; }
      var sw = t.closest('[data-sw]');
      if (sw) { openProfile(sw.dataset.sw); return; }
      var del = t.closest('[data-del]');
      if (del) { askDelete(del.dataset.del); return; }
      var add = t.closest('[data-rel]');
      if (add) {
        var np = addProf(add.dataset.rel);
        if (np) openProfile(np.id);
      }
    });
    return el;
  }

  function renderSheet() {
    var el = ensureSheet();
    var list = profList(), cur = activeId();
    $('#whoList', el).innerHTML = list.map(function (p) {
      var rep = reportOf(p);
      var meta = rep
        ? (p.kind === 'upload' ? (p.file || '上传的报告') : '样板报告') +
          ' · ' + ((rep.items || []).length + (rep.imaging || []).length) + ' 项'
        : '还没有报告';
      if (p.updatedAt) meta += ' · ' + dateShort(p.updatedAt);
      return '<div class="who-item' + (p.id === cur ? ' on' : '') + '">' +
          '<button class="who-main" data-sw="' + esc(p.id) + '">' +
            '<span class="who-av">' + esc(String(p.name).charAt(0)) + '</span>' +
            '<span class="who-txt"><b>' + esc(p.name) +
              (p.rel === p.name ? '' : '<i>' + esc(p.rel) + '</i>') + '</b>' +
              '<em>' + esc(meta) + '</em></span>' +
            (p.id === cur ? '<span class="who-cur">当前</span>' : '') +
          '</button>' +
          (list.length > 1
            ? '<button class="who-del" data-del="' + esc(p.id) + '" aria-label="删除 ' + esc(p.name) + '">删除</button>'
            : '') +
        '</div>';
    }).join('');

    var full = list.length >= PROF_MAX;
    $('#relPick', el).innerHTML = full
      ? '<div class="rel-full">最多 5 位成员，删掉一位才能再加</div>'
      : RELS.map(function (r) {
          return '<button class="rel-chip" data-rel="' + esc(r) + '">' + esc(r) + '</button>';
        }).join('');
    return el;
  }

  function openSheet() {
    var el = renderSheet();
    el.classList.add('on');
    document.body.style.overflow = 'hidden';
    var first = $('#whoList .who-main', el);
    if (first && first.focus) first.focus();
    document.addEventListener('keydown', sheetKey);
  }

  function closeSheet() {
    var el = $('#whoSheet');
    if (el) el.classList.remove('on');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', sheetKey);
  }

  function sheetKey(e) {
    if (e.key === 'Escape' || e.key === 'Esc') closeSheet();
  }

  /* ================= AI 模型设置（BYOK，自带密钥） =================
     GitHub 版本里没有任何密钥。谁想用 AI 影像解读，在这里粘贴自己的即可，
     只存进他本机浏览器的 localStorage，不上传、不进仓库。
     本机开发版则由 gitignored 的 js/config.local.js 提供，这里显示为「本机开发配置」。 */
  function ensureLlmSheet() {
    var el = $('#llmSheet');
    if (el) return el;
    el = document.createElement('div');
    el.className = 'sheet';
    el.id = 'llmSheet';
    el.innerHTML =
      '<div class="sheet-mask" data-close="1"></div>' +
      '<div class="sheet-card" role="dialog" aria-modal="true" aria-label="AI 影像解读设置">' +
        '<div class="sheet-hd"><b>AI 影像解读</b>' +
          '<span>默认走本机代理，无需填密钥。设置只存本机浏览器，不上传、不进代码仓库；不配也不影响其他功能。</span></div>' +
        '<div class="llm-bd" id="llmBd"></div>' +
        '<button class="sheet-cancel" data-close="1">关闭</button>' +
      '</div>';
    document.body.appendChild(el);
    el.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('[data-close]')) { closeLlmSheet(); return; }
      if (t.closest('[data-llmsave]')) { saveLlm(); return; }
      if (t.closest('[data-llmclear]')) { clearLlm(); return; }
    });
    return el;
  }

  function renderLlmSheet() {
    var el = ensureLlmSheet();
    var ep = HL.img.endpoint();
    var user = null;
    try { user = JSON.parse(localStorage.getItem(HL.img.KEY_LS) || 'null'); } catch (e) { user = null; }
    var dev = window.HL_CONFIG && window.HL_CONFIG.llm;
    var status;
    if (ep) {
      status = ep.proxy
        ? '已配置：本机代理 /api/chat · ' + (ep.model || 'glm-4-flash')
        : '已配置：直连 · ' + (ep.model || 'glm-4-flash');
      if (!user && dev) status += '（本机开发配置）';
    } else {
      status = '未配置：影像描述保持原文展示，其他功能不受影响';
    }
    var proxyVal = (user && (user.proxyURL || '')) || (dev && dev.proxyURL) || '';
    var keyVal = (user && user.apiKey) || '';
    var modelVal = (user && user.model) || (dev && dev.model) || 'glm-4-flash';
    $('#llmBd', el).innerHTML =
      '<div class="llm-status' + (ep ? ' on' : '') + '">' + esc(status) + '</div>' +
      '<label class="llm-field"><span>代理地址</span>' +
        '<input id="llmProxy" type="text" inputmode="url" placeholder="留空 = 本机同源 /api/chat" value="' + esc(proxyVal) + '"></label>' +
      '<label class="llm-field"><span>API 密钥（仅直连时用）</span>' +
        '<input id="llmKey" type="password" autocomplete="off" placeholder="支持跨域的服务商才需要" value="' + esc(keyVal) + '"></label>' +
      '<label class="llm-field"><span>模型</span>' +
        '<input id="llmModel" type="text" placeholder="glm-4-flash" value="' + esc(modelVal) + '"></label>' +
      '<div class="llm-note">智谱不支持浏览器直连（跨域会被拦）。本机开发运行 <b>node server/dev.js</b>，代理地址留空即走同源 <b>/api/chat</b>；部署到 GitHub 后想用 AI，需另跑一个代理并把地址填在这里。</div>' +
      '<div class="llm-actions">' +
        '<button class="btn-main" data-llmsave="1">保存</button>' +
        (user ? '<button class="btn-ghost" data-llmclear="1">清除我填的设置</button>' : '') +
      '</div>';
    return el;
  }

  function openLlmSheet() {
    var el = renderLlmSheet();
    el.classList.add('on');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', llmKeyHandler);
    var inp = $('#llmKey', el);
    if (inp && inp.focus) setTimeout(function () { inp.focus(); }, 60);
  }
  function closeLlmSheet() {
    var el = $('#llmSheet');
    if (el) el.classList.remove('on');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', llmKeyHandler);
  }
  function llmKeyHandler(e) {
    if (e.key === 'Escape' || e.key === 'Esc') closeLlmSheet();
  }
  function saveLlm() {
    var proxyURL = (($('#llmProxy') || {}).value || '').trim();
    var key = (($('#llmKey') || {}).value || '').trim();
    var model = (($('#llmModel') || {}).value || '').trim() || 'glm-4-flash';
    var obj = { model: model };
    if (proxyURL) { obj.proxy = true; obj.proxyURL = proxyURL; }
    else if (key) { obj.proxy = false; obj.apiKey = key; obj.baseURL = HL.img.DEFAULT_BASE; }
    else { obj.proxy = true; }   /* 留空 = 本机同源 /api/chat */
    try { localStorage.setItem(HL.img.KEY_LS, JSON.stringify(obj)); } catch (e) {}
    closeLlmSheet();
    window.alert('已保存。\n打开一份带影像描述的报告，就能看到结构化结果。');
    if (STATE.report) refreshImagingStruct(STATE.report, true);
  }
  function clearLlm() {
    try { localStorage.removeItem(HL.img.KEY_LS); } catch (e) {}
    closeLlmSheet();
    renderLlmSheet();
  }

  /* 删成员是不可撤销的，必须问一次；只剩一个时不给删——否则无处可退。 */
  function askDelete(id) {
    var p = profById(id);
    if (!p || profList().length <= 1) return;
    if (!window.confirm('删除「' + p.name + '」？这份报告和打卡记录会一起删掉，不能撤销。')) return;
    var wasActive = activeId() === id;
    delProf(id);
    renderWho();
    if (wasActive) openProfile(activeId());   /* 内部会关掉弹层并重新渲染 */
    else renderSheet();
  }

  /* ================= 初始化 ================= */
  function openShare() {
    if (!STATE.result || STATE.result.isEmpty) return;
    HL.share.open(STATE.result);
  }

  function init() {
    readUI();
    profList();          /* 先跑一次档案迁移：任何读报告的地方都依赖它 */
    renderWho();
    renderIntake();

    /* 顶栏在滚动后加一层分隔阴影，避免内容贴着标题 */
    var tb = $('.topbar');
    if (tb) {
      var onScroll = function () {
        tb.classList.toggle('scrolled', window.scrollY > 8);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    var whoBtn = $('#tbWho');
    if (whoBtn) whoBtn.addEventListener('click', openSheet);

    $$('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        if (!STATE.result) return;
        switchTab(t.dataset.tab);
      });
    });

    /* 所有跨页跳转统一走这里：总览的科室 chip、各页底部的「接着看」 */
    document.addEventListener('click', function (e) {
      var j = e.target.closest && e.target.closest('[data-jump]');
      if (!j) return;
      e.preventDefault();
      e.stopPropagation();
      jumpTo(j.dataset.jump, j.dataset.anchor);
    });

    $('#btnReset').addEventListener('click', function () {
      STATE.result = null;
      STATE.dietSet = 0;
      STATE.trainRange = 'week';
      STATE.trainMonth = 1;
      STATE.uploadedName = null;
      STATE.uploadedFile = null;
      STATE.showAllFindings = false;
      /* 这里不清档案。点「重新上传」只是回到上传页换一份新的，
         原来那份还挂在成员名下——真要删走成员清单里的「删除」。
         否则点错一下，上个月的报告就找不回来了。 */
      saveUI();
      $('#tabbar').classList.remove('on');
      $('#app').classList.remove('has-tabs');
      $('#btnReset').style.display = 'none';
      $('#btnShare').style.display = 'none';
      switchTab('intake');
      renderIntake();
      renderWho();
    });

    $('#btnShare').addEventListener('click', openShare);

    var llmBtn = $('#btnLlm');
    if (llmBtn) llmBtn.addEventListener('click', openLlmSheet);

    /* 上次看过就直接回到结果页，不用每次重新点一遍 */
    var p0 = activeProf();
    var rep0 = reportOf(p0);
    if (rep0) {
      STATE.uploadedName = p0.kind === 'upload' ? (p0.file || '上次上传的报告') : null;
      var r0 = HL.engine.analyze(rep0);
      STATE.result = r0;
      STATE.showAllFindings = false;
      renderAll(r0);
      $('#btnReset').style.display = '';
      $('#btnShare').style.display = r0.isEmpty ? 'none' : '';
      switchTab('overview');
    }

    /* PWA：手机上可以「添加到主屏幕」，离线也能打开。
       file:// 下不注册（浏览器本来也不支持）。 */
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () {});
      });
    }
  }

  /* 对外接口：把一份结构化报告直接渲染出来。
     留给后续「手动录入 / 接口对接」，也方便自动化测试。
     用法：HL.app.render(报告对象) */
  HL.app = {
    /* kind: 'sample' | 'sample2'，给了才会在刷新后自动恢复。
       不给就只渲染一次——外部塞进来的报告对象没法反序列化回去。 */
    render: function (report, kind) {
      if (!report) return null;
      if (kind) saveLast(kind, null);
      var r = HL.engine.analyze(report);
      STATE.result = r;
      STATE.showAllFindings = false;
      renderAll(r);
      $('#btnReset').style.display = '';
      switchTab('overview');
      return r;
    },
    state: STATE
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
