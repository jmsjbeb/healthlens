/* ============================================================
   康鉴 HealthLens · 今日卡片（v1.2 · 仅 Capacitor APK）
   ------------------------------------------------------------
   打开 APP 第一眼就看到「今天吃什么 / 今天练什么」，零点击。
   卡片挂在 .app 外壳里（顶栏之后、#views 之前），所以不管首屏
   落在上传页、还是自动恢复到的总览页，它都是最上面那一张。

   数据来源：HL.app.todayData() —— app.js 里现成的 MEALS 三餐文案、
   HL.engine.templateFor(month).tpl 周训练模板、todayIdx() 周几索引、
   STATE.result 的复查时间表、打卡 key。本文件不产生任何新结论，
   不改判定逻辑、不改星级、不改评分。

   网页版 / PWA 根本不会加载这个文件：index.html 只在 nativeApp 为
   true 时才 document.write 它，公开版不会多请求任何资源。
   ============================================================ */
window.HL = window.HL || {};

HL.today = (function () {
  'use strict';

  var SLOT_ID = 'hlTodaySlot';
  var CARD_ID = 'hlTodayCard';
  var WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  var DAY_MS = 86400000;

  /* ---------- 小工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function pad2(n) {
    n = Number(n) || 0;
    return (n < 10 ? '0' : '') + n;
  }
  function timeOf(m) {
    return pad2(m && m.h) + ':' + pad2(m && m.m);
  }

  /* 与 index.html 里那段 nativeApp 判断保持同一口径；这里只是防御性复核，
     因为本文件本身只会在原生壳里被加载。 */
  function isNative() {
    try {
      if (window.__HL_NATIVE__ === true) return true;
      var C = window.Capacitor;
      if (C && typeof C.isNativePlatform === 'function' && C.isNativePlatform()) return true;
      var proto = location.protocol;
      if (proto === 'capacitor:' || proto === 'app:') return true;
      var h = location.hostname;
      return proto === 'https:' && !location.port && (h === 'localhost' || h === '127.0.0.1');
    } catch (e) {
      return false;
    }
  }

  function appData() {
    try {
      if (HL.app && typeof HL.app.todayData === 'function') return HL.app.todayData() || {};
    } catch (e) {
      /* app.js 没起来也不能让卡片抛错 */
    }
    return {};
  }

  /* ---------- 外壳插槽 ---------- */
  function ensureSlot() {
    var old = document.getElementById(SLOT_ID);
    if (old) return old;
    var app = document.getElementById('app');
    if (!app) return null;
    var slot = document.createElement('div');
    slot.id = SLOT_ID;
    slot.className = 'hl-today-slot';
    slot.setAttribute('aria-live', 'polite');
    var views = document.getElementById('views');
    if (views && views.parentNode === app) app.insertBefore(slot, views);
    else app.appendChild(slot);
    return slot;
  }

  /* ---------- 数据归一化 ----------
     mount(container, report) 的 report 可以是：
       · HL.app.todayData() 的结果（刷新时走这条）
       · HL.engine.analyze() 的结果
       · 原始报告对象（带 items）
       · null / undefined（还没上传报告时的通用形态） */
  function normalize(src) {
    var d = null;
    if (src && Array.isArray(src.meals) && Array.isArray(src.tpl)) d = src;
    else d = appData();
    if (!d || typeof d !== 'object') d = {};

    var meals = (Array.isArray(d.meals) ? d.meals : []).filter(function (x) {
      return x && typeof x === 'object';
    });
    var tpl = (Array.isArray(d.tpl) ? d.tpl : []).filter(function (x) {
      return x && typeof x === 'object';
    });

    var result = null;
    if (src && Array.isArray(src.followup)) result = src;
    else if (src && src.items && HL.engine && typeof HL.engine.analyze === 'function') {
      try { result = HL.engine.analyze(src); } catch (e) { result = null; }
    }
    if (!result) result = d.result || null;

    var idx = typeof d.todayIdx === 'number'
      ? d.todayIdx
      : ((new Date().getDay() + 6) % 7);   /* 周一 = 0，与 app.js 的 todayIdx() 同口径 */

    return {
      meals: meals,
      tpl: tpl,
      todayIdx: idx,
      month: typeof d.month === 'number' ? d.month : 1,
      monthTitle: String(d.monthTitle || ''),
      result: result,
      report: d.report || (src && src.items ? src : null),
      hasReport: !!d.hasReport || !!(result && !result.isEmpty),
      planWeeks: typeof d.planWeeks === 'number' && d.planWeeks > 0 ? d.planWeeks : 12,
      checkinKey: String(d.checkinKey || ''),
      memberName: String(d.memberName || '')
    };
  }

  /* ---------- 今天是第几周 ----------
     项目里没有「计划开始日」这个字段，就绝不编一个。有打卡记录时以
     最早一次打卡起算；没有记录时显示第 1 周（计划起点）并标注口径。 */
  function firstCheckinDay(key) {
    if (!key) return null;
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return null;
      var days = Object.keys(obj).filter(function (k) {
        return /^\d{4}-\d{2}-\d{2}$/.test(k);
      }).sort();
      if (!days.length) return null;
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(days[0]);
      if (!m) return null;
      var dt = new Date(+m[1], +m[2] - 1, +m[3]);
      return isNaN(dt.getTime()) ? null : dt;
    } catch (e) {
      return null;
    }
  }

  function weekInfo(d) {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var start = firstCheckinDay(d.checkinKey);
    var n = 1;
    var note = '';
    if (start && start.getTime() <= today.getTime()) {
      n = Math.floor((today.getTime() - start.getTime()) / (7 * DAY_MS)) + 1;
      note = '按首次打卡起算';
    }
    if (!isFinite(n) || n < 1) n = 1;
    if (n > d.planWeeks) n = d.planWeeks;
    return {
      n: n,
      note: note,
      weekday: WEEK_CN[now.getDay()] || '',
      date: (now.getMonth() + 1) + '月' + now.getDate() + '日'
    };
  }

  /* ---------- 离复查还有几天 ----------
     拿到「具体日期 / 明确天数」才给精确天数；
     引擎只给「1 个月内」这种相对文案时，按引擎真实输出的 monthOffset
     用日历月推算，并在句子里写明是估算，绝不把相对文案伪装成精确结论；
     两者都拿不到就整行省略（不编造）。 */
  function parseDate(v) {
    var dt = null;
    if (v instanceof Date) dt = v;
    else if (typeof v === 'number' && isFinite(v)) dt = new Date(v);
    else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) dt = new Date(v);
    return dt && !isNaN(dt.getTime()) ? dt : null;
  }
  function addMonths(base, n) {
    var dt = new Date(base.getTime());
    var day = dt.getDate();
    dt.setDate(1);
    dt.setMonth(dt.getMonth() + n);
    var last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
    dt.setDate(Math.min(day, last));
    return dt;
  }
  function recheckText(d) {
    if (!d.hasReport || !d.result || d.result.isEmpty) return '';
    var r = d.result;
    var follow = Array.isArray(r.followup) ? r.followup : [];
    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var days = null;
    var tail = '';
    try {
      var cands = [];
      if (d.report && d.report.recheckDate) cands.push(d.report.recheckDate);
      if (r.recheck && r.recheck.date) cands.push(r.recheck.date);
      if (r.followupDate) cands.push(r.followupDate);
      if (r.recheck && typeof r.recheck.daysLeft === 'number') days = r.recheck.daysLeft;
      follow.forEach(function (f) { if (f && f.date) cands.push(f.date); });

      if (days == null) {
        for (var i = 0; i < cands.length; i++) {
          var dt = parseDate(cands[i]);
          if (dt) {
            days = Math.round(
              (new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()) - start) / DAY_MS
            );
            break;
          }
        }
      }
      if (days == null && follow.length) {
        var best = null;
        follow.forEach(function (f) {
          if (!f || typeof f.monthOffset !== 'number' || f.monthOffset <= 0) return;
          if (!best || f.monthOffset < best.monthOffset) best = f;
        });
        if (best) {
          days = Math.round((addMonths(start, best.monthOffset) - start) / DAY_MS);
          tail = '（按复查计划「' + String(best.when || (best.monthOffset + ' 个月')) + '」估算）';
        }
      }
    } catch (e) {
      return '';
    }
    if (days == null || !isFinite(days) || days < 0) return '';
    return '离复查还有 ' + days + ' 天' + tail;
  }

  /* ---------- 片段 ---------- */
  function mealHtml(d) {
    if (!d.meals.length) {
      return '<div class="hl-today-none">今天按三餐节奏吃，先蛋白和菜，最后主食。</div>';
    }
    return '<ul class="hl-today-meals">' + d.meals.map(function (m) {
      return '<li class="hl-today-meal">' +
        '<span class="hl-today-time">' + esc(timeOf(m)) + '</span>' +
        '<span class="hl-today-meal-txt"><b>' + esc(m.t || '') + '</b>' +
        '<span>' + esc(m.d || '') + '</span></span>' +
      '</li>';
    }).join('') + '</ul>';
  }

  function trainHtml(d) {
    var t = d.tpl[d.todayIdx];
    if (!t || (!t.type && !t.detail)) {
      return '<div class="hl-today-none">今天按「怎么运动」里的当周安排来，先热身 5 分钟。</div>';
    }
    var head = [esc(t.type || '训练'), esc(t.dur || '')]
      .filter(function (x) { return !!x; })
      .join(' · ');
    return '<div class="hl-today-train">' +
      '<b>' + head + '</b>' +
      '<p>' + esc(t.detail || '') + '</p>' +
    '</div>';
  }

  function notifyHtml() {
    var n = (HL.notify && typeof HL.notify.status === 'function') ? HL.notify.status() : null;
    var on = !!(n && n.enabled);
    var note = n && n.message
      ? n.message
      : (n && !n.available
          ? '这台设备暂不支持系统通知，今日卡片照常可用。'
          : '打开后到点自动提醒，锁屏只显示行为提示。');
    return '<div class="hl-today-notify">' +
      '<button type="button" class="hl-today-toggle' + (on ? ' on' : '') + '" ' +
        'id="hlNotifyToggle" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        (on ? '关闭每日提醒' : '开启每日提醒') +
      '</button>' +
      '<span class="hl-today-note" id="hlNotifyNote">' + esc(note) + '</span>' +
    '</div>';
  }

  function cardHtml(d) {
    var w = weekInfo(d);
    var rc = recheckText(d);
    var sub = d.hasReport
      ? '按你这份报告的计划，今天这样吃、这样动'
      : '先看看今天怎么吃怎么动';
    var monthLine = '第 ' + d.month + ' 个月' + (d.monthTitle ? ' · ' + d.monthTitle : '');
    return '<section class="hl-today" id="' + CARD_ID + '" aria-label="今日计划">' +
      '<div class="hl-today-hd">' +
        '<span class="hl-today-tag">今天</span>' +
        '<div class="hl-today-hd-b">' +
          '<b>第 ' + w.n + ' 周 · ' + esc(w.weekday) + '</b>' +
          '<span>' + esc(w.date) + ' · ' + esc(monthLine) +
            (w.note ? ' · ' + esc(w.note) : '') + '</span>' +
        '</div>' +
      '</div>' +
      '<p class="hl-today-sub">' + esc(sub) + '</p>' +
      '<div class="hl-today-grid">' +
        '<div class="hl-today-col">' +
          '<div class="hl-today-label">今天练什么 <i>19:00</i></div>' +
          trainHtml(d) +
        '</div>' +
        '<div class="hl-today-col">' +
          '<div class="hl-today-label">今天怎么吃</div>' +
          mealHtml(d) +
        '</div>' +
      '</div>' +
      (rc ? '<p class="hl-today-recheck">' + esc(rc) + '</p>' : '') +
      notifyHtml() +
    '</section>';
  }

  /* ---------- 通知开关 ---------- */
  function setNote(root, text) {
    var el = root.querySelector('#hlNotifyNote');
    if (el) el.textContent = String(text || '');
  }
  function syncToggle(root) {
    var btn = root.querySelector('#hlNotifyToggle');
    if (!btn) return;
    var n = (HL.notify && typeof HL.notify.status === 'function') ? HL.notify.status() : null;
    var on = !!(n && n.enabled);
    btn.textContent = on ? '关闭每日提醒' : '开启每日提醒';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.classList.toggle('on', on);
    if (n && n.message) setNote(root, n.message);
  }
  function errText(e) {
    try { return String((e && e.message) || e || '未知错误').slice(0, 60); }
    catch (x) { return '未知错误'; }
  }
  function bindToggle(root) {
    var btn = root.querySelector('#hlNotifyToggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var n = HL.notify;
      if (!n || typeof n.setEnabled !== 'function') {
        setNote(root, '这台设备暂不支持系统通知，今日卡片照常可用。');
        return;
      }
      var want = !n.isEnabled();
      btn.disabled = true;
      setNote(root, want ? '正在开启…' : '正在关闭…');
      var done = function (res) {
        btn.disabled = false;
        syncToggle(root);
        if (res && res.message) setNote(root, res.message);
      };
      try {
        var p = n.setEnabled(want);
        if (p && typeof p.then === 'function') {
          p.then(done, function (e) {
            done({ message: '操作失败：' + errText(e) + '，可以再试一次。' });
          });
        } else {
          done(null);
        }
      } catch (e) {
        done({ message: '操作失败：' + errText(e) + '，可以再试一次。' });
      }
    });
  }

  /* ---------- 对外接口 ---------- */
  function mount(container, report) {
    if (!isNative()) return null;
    try {
      var host = (container && container.nodeType === 1) ? container : ensureSlot();
      if (!host) return null;
      var d = normalize(report);
      host.innerHTML = cardHtml(d);
      bindToggle(host);
      if (window.__HL_OPEN_TODAY__) {
        window.__HL_OPEN_TODAY__ = false;
        focus();
      }
      return host;
    } catch (e) {
      /* 卡片画不出来也不能拖垮 APP：留空插槽，主页面照常可用 */
      return null;
    }
  }
  function refresh(data) {
    return mount(null, data);
  }
  function focus() {
    try {
      var el = document.getElementById(CARD_ID);
      if (!el) return;
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); }
      catch (e) {
        try { window.scrollTo(0, 0); } catch (e2) { /* 老 WebView 忽略 */ }
      }
      el.classList.remove('hl-today-flash');
      void el.offsetWidth;
      el.classList.add('hl-today-flash');
      setTimeout(function () { el.classList.remove('hl-today-flash'); }, 1600);
    } catch (e) {
      /* 滚动 / 高亮失败不影响卡片本身 */
    }
  }

  /* app.js 的 renderIntake() / renderAll() 会带着完整上下文再刷新一次；
     这里先自救一次，万一 app.js 起不来，首屏也不会是空的 / 白的。 */
  function selfMount() {
    try { mount(null, null); } catch (e) { /* 忽略 */ }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', selfMount);
  } else {
    selfMount();
  }

  return {
    mount: mount,
    refresh: refresh,
    focus: focus,
    isNative: isNative
  };
})();
