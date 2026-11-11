/* ============================================================
   康鉴 HealthLens · 每日本地通知（v1.2 · 仅 Capacitor APK）
   ------------------------------------------------------------
   通过 window.Capacitor.Plugins.LocalNotifications 访问官方插件：
   不 import、不打包、不联网。网页版 / PWA 里这个对象天然不存在，
   getPlugin() 返回 null，所有 API 静默降级（不报错、不弹窗、不白屏）。

   隐私红线（锁屏通知会被别人看到）：
   标题 / 正文只写「行为层」，绝不出现体检数值、指标名、星级、评分、
   科室、疾病名、复查项目名。所以下面的文案全部是写死的行为提醒；
   训练那几条只取静态周模板里的 type / dur（经白名单校验），
   不取 detail，也完全不碰报告对象与 HL.rules。

   时间：三餐 7:30 / 12:00 / 18:30 来自 app.js 的 MEALS，
   训练 19:00 来自 app.js 的 trainEvents()；按设备本地时区触发。
   三餐用 schedule({ on: { hour, minute } }) 的 cron 式重复（每天）；
   训练按 weekday 各排一条（每周同一星期几 19:00），与周模板一一对应。
   不用 allowWhileIdle、不申请精确闹钟，因此不需要 SCHEDULE_EXACT_ALARM；
   插件在允许精确闹钟时会自己用 setExact，不允许时自动退化为非精确闹钟。

   Android 13+（API 33）的 POST_NOTIFICATIONS 是运行时危险权限：
   requestPermissions() 只在用户主动点「开启每日提醒」时调用，
   APP 启动时只做不弹框的 checkPermissions()。
   ============================================================ */
window.HL = window.HL || {};

HL.notify = (function () {
  'use strict';

  var KEY = 'hl_notify_v1';                 /* 独立存储，不复用打卡 key hl_checkin_v2::<id> */
  var MEAL_IDS = [7301, 7302, 7303];
  var TRAIN_ID_BASE = 7311;                /* 7311..7317 = 周一..周日 */
  var FALLBACK_MEALS = [
    { h: 7, m: 30 }, { h: 12, m: 0 }, { h: 18, m: 30 }
  ];
  var TRAIN_HOUR = 19;
  var TRAIN_MINUTE = 0;
  /* 周模板 tpl[0..6] = 周一..周日；Capacitor Weekday：周日=1 … 周六=7 */
  var WEEKDAY_OF_TPL = [2, 3, 4, 5, 6, 7, 1];

  /* 行为层文案：写死，不带任何报告上下文 */
  var MEAL_TEXT = [
    { title: '该吃早饭了', body: '先蛋白和菜，最后主食' },
    { title: '该吃午饭了', body: '菜 → 肉 → 饭，主食一拳就够' },
    { title: '该吃晚饭了', body: '尽量 19 点前吃完，主食减半，蛋白和菜照常' }
  ];
  var TRAIN_TITLE = '该练了';
  var TRAIN_FALLBACK = '先热身 5 分钟，再按今天的安排来';
  var SAFE_TYPE = {
    '有氧': 1, '长有氧': 1, '抗阻': 1, '抗阻·推': 1, '抗阻·拉': 1, '抗阻·腿': 1,
    '恢复': 1, '主动恢复': 1, '兴趣运动': 1
  };
  /* 兜底扫描：万一以后有人把报告文案塞进来，整句换成通用行为文案 */
  var RISK = /复查|科室|星级|评分|指标|诊断|血糖|血脂|尿酸|肝功|肾功|甲功|血常规|糖化|同型|结节|肿瘤|癌|mmol|μmol|g\/L|U\/L|\d+\s*星/;

  var plugin = null;
  var permission = 'unknown';
  var lastMessage = '';

  function getPlugin() {
    try {
      var C = window.Capacitor;
      if (!C || !C.Plugins) return null;
      var p = C.Plugins.LocalNotifications;
      if (!p || typeof p.schedule !== 'function') return null;
      return p;
    } catch (e) {
      return null;
    }
  }
  function readEnabled() {
    try { return localStorage.getItem(KEY) === '1'; }
    catch (e) { return false; }
  }
  function writeEnabled(on) {
    try { localStorage.setItem(KEY, on ? '1' : '0'); }
    catch (e) { /* 存储不可用时本次会话仍按内存状态走 */ }
  }
  function promised(r, fallback) {
    return (r && typeof r.then === 'function') ? r : Promise.resolve(fallback);
  }
  function errText(e) {
    try { return String((e && (e.message || e.code)) || e || '未知错误').slice(0, 60); }
    catch (x) { return '未知错误'; }
  }
  function safeText(s, fallback) {
    var t = String(s == null ? '' : s);
    return (!t || RISK.test(t)) ? fallback : t;
  }

  function appData() {
    try {
      if (HL.app && typeof HL.app.todayData === 'function') return HL.app.todayData() || {};
    } catch (e) { /* app.js 没起来也不能让通知模块抛错 */ }
    return {};
  }
  function hour(v, fallback) {
    var n = Number(v);
    return (isFinite(n) && n >= 0 && n <= 23) ? Math.floor(n) : fallback;
  }
  function minute(v, fallback) {
    var n = Number(v);
    return (isFinite(n) && n >= 0 && n <= 59) ? Math.floor(n) : fallback;
  }
  function trainBody(x) {
    if (!x) return TRAIN_FALLBACK;
    var t = String(x.type || '');
    var dur = String(x.dur || '').trim();
    if (!Object.prototype.hasOwnProperty.call(SAFE_TYPE, t) || !/^\d+\s*分钟$/.test(dur)) return TRAIN_FALLBACK;
    return '今天练' + t + ' ' + dur;
  }

  /* 组装全部待排通知。固定 id，先 cancel 再 schedule，幂等不重复。 */
  function buildNotifications() {
    var d = appData();
    var meals = Array.isArray(d.meals) ? d.meals : [];
    var tpl = Array.isArray(d.tpl) ? d.tpl : [];
    var list = [];
    var i = 0;
    var j = 0;

    for (i = 0; i < 3; i++) {
      var m = meals[i] || {};
      var f = FALLBACK_MEALS[i];
      list.push({
        id: MEAL_IDS[i],
        title: safeText(MEAL_TEXT[i].title, '该吃饭了'),
        body: safeText(MEAL_TEXT[i].body, '按时吃饭，顺序比份量更重要'),
        schedule: { on: { hour: hour(m.h, f.h), minute: minute(m.m, f.m), second: 0 } },
        extra: { hl: 'today', kind: 'meal' },
        autoCancel: true
      });
    }

    for (j = 0; j < 7; j++) {
      list.push({
        id: TRAIN_ID_BASE + j,
        title: TRAIN_TITLE,
        body: safeText(trainBody(tpl[j]), TRAIN_FALLBACK),
        schedule: {
          on: {
            weekday: WEEKDAY_OF_TPL[j],
            hour: TRAIN_HOUR,
            minute: TRAIN_MINUTE,
            second: 0
          }
        },
        extra: { hl: 'today', kind: 'train' },
        autoCancel: true
      });
    }
    return list;
  }
  function allIds() {
    var ids = MEAL_IDS.slice();
    for (var j = 0; j < 7; j++) ids.push(TRAIN_ID_BASE + j);
    return ids;
  }

  function cancelAll() {
    var p = plugin;
    if (!p || typeof p.cancel !== 'function') return Promise.resolve();
    try {
      var r = p.cancel({
        notifications: allIds().map(function (id) { return { id: id }; })
      });
      return promised(r, undefined).catch(function () { return undefined; });
    } catch (e) {
      return Promise.resolve();
    }
  }
  function scheduleAll() {
    var p = plugin;
    if (!p) return Promise.reject(new Error('LocalNotifications 插件不可用'));
    try {
      var r = p.schedule({ notifications: buildNotifications() });
      return promised(r, undefined);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /* 权限：checkPermissions 不弹框；requestPermissions 只在用户点「开启」时调。 */
  function checkPermission() {
    var p = plugin;
    if (!p || typeof p.checkPermissions !== 'function') return Promise.resolve('unknown');
    try {
      var r = p.checkPermissions();
      if (!r || typeof r.then !== 'function') return Promise.resolve('unknown');
      return r.then(function (s) {
        permission = (s && s.display) ? String(s.display) : 'unknown';
        return permission;
      }, function () { return 'unknown'; });
    } catch (e) {
      return Promise.resolve('unknown');
    }
  }
  function requestPermission() {
    var p = plugin;
    if (!p || typeof p.requestPermissions !== 'function') return Promise.resolve('unknown');
    try {
      var r = p.requestPermissions();
      if (!r || typeof r.then !== 'function') return Promise.resolve('unknown');
      return r.then(function (s) {
        permission = (s && s.display) ? String(s.display) : 'unknown';
        return permission;
      }, function () { return 'unknown'; });
    } catch (e) {
      return Promise.resolve('unknown');
    }
  }

  /* 只在用户主动点「开启每日提醒」时走这里 */
  function enable() {
    plugin = getPlugin();
    if (!plugin) {
      lastMessage = '这台设备暂不支持系统通知，今日卡片照常可用。';
      writeEnabled(false);
      return Promise.resolve({ ok: false, enabled: false, message: lastMessage });
    }
    return checkPermission()
      .then(function (state) {
        if (state === 'granted' || state === 'denied') return state;
        /* 'prompt' / 'prompt-with-rationale' / 'unknown'：
           用户主动点了开启，只有这里才会弹 Android 13+ 的系统权限框 */
        return requestPermission();
      })
      .then(function (state) {
        if (state === 'denied') {
          lastMessage = '通知权限被拒绝了。到「系统设置 → 应用 → 康鉴 → 通知」打开后，再回来点一次开启。';
          writeEnabled(false);
          return { ok: false, enabled: false, message: lastMessage };
        }
        /* v1.2 返工：授权状态未确认时绝不上报「已开启」。
           requestPermissions() 抛错 / 返回非 Promise / 结果里没有 display 时，
           requestPermission() 会统一返回 'unknown'；'prompt'、
           'prompt-with-rationale' 也可能残留。Android 13+ 没真正授权，
           通知就不会送达，若此时写 enabled=1 并返回「已开启」，
           用户会看到开关已开却收不到任何提醒 —— 这是最忌讳的静默失败。 */
        if (state !== 'granted') {
          lastMessage = '未能确认通知授权。到「系统设置 → 应用 → 康鉴 → 通知」打开后，再回来点一次开启。';
          writeEnabled(false);
          return { ok: false, enabled: false, message: lastMessage };
        }
        return cancelAll().then(scheduleAll).then(function () {
          writeEnabled(true);
          lastMessage = '已开启：每天 7:30 / 12:00 / 18:30 / 19:00 提醒，锁屏只显示行为提示。';
          return { ok: true, enabled: true, message: lastMessage };
        });
      })
      .catch(function (e) {
        writeEnabled(false);
        lastMessage = '开启失败：' + errText(e) +
          '。可能是系统通知被关了，到「设置 → 应用 → 康鉴 → 通知」打开后再点一次。';
        return { ok: false, enabled: false, message: lastMessage };
      });
  }

  function disable() {
    plugin = getPlugin();
    writeEnabled(false);
    return cancelAll().then(function () {
      lastMessage = '已关闭每日提醒。';
      return { ok: true, enabled: false, message: lastMessage };
    }, function () {
      lastMessage = '已关闭每日提醒。';
      return { ok: true, enabled: false, message: lastMessage };
    });
  }

  function setEnabled(on) { return on ? enable() : disable(); }
  function isEnabled() { return readEnabled(); }
  function available() { return !!getPlugin(); }
  function status() {
    plugin = getPlugin();
    return {
      available: !!plugin,
      enabled: readEnabled(),
      permission: permission,
      message: lastMessage || (plugin
        ? (readEnabled()
            ? '每天 7:30 / 12:00 / 18:30 / 19:00 提醒，锁屏只显示行为提示。'
            : '打开后到点自动提醒，锁屏只显示行为提示。')
        : '这台设备暂不支持系统通知，今日卡片照常可用。')
    };
  }

  /* 点通知打开 APP：卡片本来就挂在 .app 顶部，打开即第一眼；
     这里再滚到顶并闪一下，让「落到今日卡片」更明确。 */
  function focusToday() {
    window.__HL_OPEN_TODAY__ = true;
    try {
      if (HL.today && typeof HL.today.focus === 'function') HL.today.focus();
    } catch (e) {
      /* 卡片还没挂好也没关系，mount() 会消费这个标记 */
    }
  }
  function bindOpen() {
    var p = getPlugin();
    if (!p || typeof p.addListener !== 'function') return;
    try {
      var r = p.addListener('localNotificationActionPerformed', function () {
        focusToday();
      });
      /* Capacitor 老桥返回 { remove }，新桥返回 Promise<handle>；两种都兼容 */
      if (r && typeof r.catch === 'function') r.catch(function () {});
    } catch (e) {
      /* 监听注册失败不影响通知送达 */
    }
  }

  /* 启动：绝不弹权限框。只在不打扰用户的前提下恢复已开启的调度。 */
  function boot() {
    plugin = getPlugin();
    bindOpen();
    if (!plugin) {
      lastMessage = '这台设备暂不支持系统通知，今日卡片照常可用。';
      return;
    }
    if (!readEnabled()) return;   /* 用户没主动开过 → 什么都不做 */
    checkPermission().then(function (state) {
      if (state === 'denied') {
        lastMessage = '通知权限已被关闭，点「开启每日提醒」重新授权。';
        return;
      }
      if (state !== 'granted') {
        lastMessage = '点「开启每日提醒」完成授权后，到点才会响。';
        return;
      }
      return cancelAll().then(scheduleAll).then(function () {
        lastMessage = '每天 7:30 / 12:00 / 18:30 / 19:00 提醒，锁屏只显示行为提示。';
      });
    }).catch(function () {
      lastMessage = '通知暂时没排上，点一下开关重试即可。';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      try { boot(); } catch (e) { /* 通知模块任何异常都不能让 APP 白屏 */ }
    });
  } else {
    try { boot(); } catch (e) { /* 同上 */ }
  }

  return {
    enable: enable,
    disable: disable,
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    available: available,
    status: status,
    focusToday: focusToday,
    /* 只读，给自检 / 排障用 */
    buildNotifications: buildNotifications,
    storageKey: KEY
  };
})();
