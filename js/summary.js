/* ============================================================
   康鉴 HealthLens · 就诊摘要
   一页纸，带去诊室用。

   为什么单独做一页：就医页是「给自己看的」，讲的是为什么去、
   去了问什么；摘要是「给医生看的」——医生只有两分钟，需要的是
   异常项、上次对比、以及你希望解决的问题，不需要读我们的解释。

   为什么存图另写一套 canvas 模板：分享卡是正方形的「结论卡」，
   摘要是竖版 A4 比例的「病历夹」，两者排版规则完全不同。
   硬套一套模板会把两边都做坏，所以各写各的，互不影响。
   ============================================================ */
HL.summary = (function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function shortName(n) {
    return String(n == null ? '' : n).split('（')[0].split('(')[0].trim();
  }

  function fmt(v) {
    if (v == null || v === '') return '—';
    var n = typeof v === 'number' ? v : parseFloat(v);
    if (!isFinite(n)) return String(v);          /* 定性项（2+、±）原样显示 */
    return String(Math.round(n * 100) / 100);
  }

  function refText(ref) {
    if (!ref) return '—';
    var lo = ref[0], hi = ref[1];
    if (lo != null && hi != null) return fmt(lo) + '–' + fmt(hi);
    if (hi != null) return '< ' + fmt(hi);
    if (lo != null) return '> ' + fmt(lo);
    return '—';
  }

  function today() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function stText(st) {
    return st === 'high' ? '偏高' : st === 'low' ? '偏低' : st === 'abnormal' ? '异常' : '';
  }

  /* 年龄怎么显示。
     报告没写年龄栏时，引擎是拿 30 岁兜底算的（engine.js 的 `p.age || 30`），
     所以这里写「—」会自相矛盾：分数明明是按 30 岁算出来的，
     却告诉医生「不知道多大」。有 ageNote 就说清是按 30 岁估的。 */
  function ageText(p) {
    if (p && p.age) return p.age + ' 岁';
    if (p && p.ageNote) return '按 30 岁估算';
    return '—';
  }

  /* 上一次的记录：从趋势快照里倒着找第一个有这一项的 */
  function prevOf(id) {
    if (!HL.trend || !HL.trend.load) return null;
    var snaps = HL.trend.load() || [];
    for (var i = snaps.length - 1; i >= 0; i--) {
      var v = snaps[i] && snaps[i].vals && snaps[i].vals[id];
      if (typeof v === 'number' && isFinite(v)) return { v: v, at: snaps[i].at };
    }
    return null;
  }

  /* ---------- ① 三句话：取必须去的科室，每个科一条最该问的 ----------
     医生没有时间听完整背景，三句是上限。按星级排，最重要的先说。 */
  function threeAsks(r) {
    var out = [];
    (r.depts || []).forEach(function (d) {
      if (out.length >= 3) return;
      var ask = (d.ask && d.ask[0]) || '';
      if (!ask) return;
      out.push({ dept: d.name, ask: ask, stars: d.stars });
    });
    /* 必须去的科不够三个时，用「可以先不去」的科补齐——
       用户既然来了医院，顺手问一句也值 */
    if (out.length < 3) {
      (r.skipDepts || []).forEach(function (d) {
        if (out.length >= 3) return;
        var ask = (d.ask && d.ask[0]) || '';
        if (!ask) return;
        out.push({ dept: d.name + '（这次可不去）', ask: ask, stars: d.stars });
      });
    }
    return out;
  }

  /* ---------- ② 异常项清单 ----------
     医生要看的是「哪几项不在区间里、离多远、比上次好还是坏」。
     解释留给患者自己那页，这里只放事实。

     排序跟引擎一致：先按星级（引擎已经算好轻重），再按偏离幅度。
     只按偏离排会把「矫正视力 0.5」这种排到同型半胱氨酸前面——
     偏离比例大不等于更要紧。 */
  function starsMap(r) {
    var m = {};
    (r.findings || []).forEach(function (f) {
      if (f && f.ruleId) m[f.ruleId] = f.stars || 0;
    });
    return m;
  }

  function abRows(r) {
    var rows = [];
    var SM = starsMap(r);
    (r.items || []).forEach(function (it) {
      var st = it._status;
      if (!st || st === 'normal') return;
      var dev = 0;
      if (it.ref && typeof it.value === 'number' && HL.trend && HL.trend.outDist) {
        dev = Math.abs(HL.trend.outDist(it.value, it.ref, HL.dictById[it.id]) || 0);
      }
      var key = it._ruleId || ('fam:' + ((HL.dictById[it.id] || {}).fam || ''));
      rows.push({
        name: shortName(it.name), value: it.value, unit: it.unit || '',
        ref: it.ref, st: st, dev: dev, id: it.id, kind: 'item',
        stars: SM[key] || 0
      });
    });
    (r.imaging || []).forEach(function (im) {
      if (!im || im.status === 'normal') return;
      rows.push({
        name: shortName(im.name), value: im.finding || '异常', unit: '',
        ref: null, st: 'abnormal', dev: 0, id: im.id, kind: 'img',
        stars: SM['img:' + im.id] || 0
      });
    });
    rows.sort(function (a, b) {
      if (b.stars !== a.stars) return b.stars - a.stars;
      if (b.dev !== a.dev) return b.dev - a.dev;
      return 0;
    });
    return rows;
  }

  function trendCell(row) {
    if (row.kind !== 'item') return '';
    var p = prevOf(row.id);
    if (!p || typeof row.value !== 'number') return '';
    var j = null;
    if (HL.trend && HL.trend.judge) j = HL.trend.judge(row.value, p.v, row.ref, HL.dictById[row.id]);
    return '<td class="sum-prev">' + fmt(p.v) +
      (j ? '<i class="sum-tr ' + j.k + '">' + esc(j.t) + '</i>' : '') + '</td>';
  }

  /* ---------- ③④ 饮食 / 运动各三条 ---------- */
  function dietThree(r) {
    var out = [];
    var notes = (r.plan && r.plan.notes) || [];
    notes.forEach(function (n) {
      if (out.length >= 3) return;
      out.push({ t: n.t, d: n.d });
    });
    if (out.length < 3) {
      var daily = (r.plan && r.plan.portion && r.plan.portion.daily) || [];
      daily.forEach(function (x) {
        if (out.length >= 3) return;
        out.push({ t: x.t, d: x.v });
      });
    }
    return out;
  }

  function trainThree(r) {
    var out = [];
    var maxHR = (r.plan && r.plan.maxHR) || 180;
    var tpl = [];
    try { tpl = (HL.engine.templateFor(1) || {}).tpl || []; } catch (e) { tpl = []; }
    tpl.slice(0, 3).forEach(function (x) {
      var hr = (x.hr && x.hr.length === 2)
        ? Math.round(maxHR * x.hr[0]) + '–' + Math.round(maxHR * x.hr[1])
        : '';
      out.push({
        t: x.type + ' · ' + (x.dur || ''),
        d: x.detail + (hr ? '（心率 ' + hr + '）' : '')
      });
    });
    return out;
  }

  /* ================= 页面 HTML ================= */
  function build(r, who) {
    if (!r || r.isEmpty) return '';
    var p = r.profile || {};
    var asks = threeAsks(r);
    var rows = abRows(r);
    var shown = rows.slice(0, 10);
    var diet = dietThree(r);
    var train = trainThree(r);

    var askHtml = asks.length
      ? asks.map(function (a) {
          return '<li><b>' + esc(a.dept) + '</b><span>' + esc(a.ask) + '</span></li>';
        }).join('')
      : '<li><b>这次没有必须去的科室</b><span>异常项都可靠饮食和运动先调整，按复查时间再看。</span></li>';

    var rowHtml = shown.length
      ? shown.map(function (x) {
          /* 影像项的「值」是一句描述（FEV1 94%、FVC 107%…），
             塞进「本次」那格会把三列挤爆，所以放进项目格里当小字 */
          var img = x.kind === 'img';
          return '<tr>' +
            '<td class="sum-n">' + esc(x.name) +
              (stText(x.st) ? '<em class="sum-st ' + x.st + '">' + stText(x.st) + '</em>' : '') +
              (img && x.value ? '<span class="sum-desc">' + esc(x.value) + '</span>' : '') + '</td>' +
            '<td class="sum-v">' + (img ? '影像' : fmt(x.value)) +
              (!img && x.unit ? '<i>' + esc(x.unit) + '</i>' : '') + '</td>' +
            '<td class="sum-ref">' + (img ? '—' : refText(x.ref)) + '</td>' +
            trendCell(x) +
          '</tr>';
        }).join('')
      : '<tr><td colspan="4" class="sum-empty">这次报告里没有超出参考区间的项目</td></tr>';

    var more = rows.length > shown.length
      ? '<p class="sum-note">另有 ' + (rows.length - shown.length) + ' 项轻度偏离，未列出。</p>' : '';

    var listHtml = function (arr, cls) {
      return '<ul class="' + cls + '">' + arr.map(function (x) {
        return '<li><b>' + esc(x.t) + '</b><span>' + esc(x.d) + '</span></li>';
      }).join('') + '</ul>';
    };

    return '' +
      '<header class="sum-hd">' +
        '<div class="sum-brand"><span>康鉴 HealthLens</span><i>就诊摘要</i></div>' +
        '<h1>' + esc(who || '本人') + ' · 体检异常摘要</h1>' +
        '<div class="sum-meta">' +
          '<span>性别 <b>' + esc(p.sex || '—') + '</b></span>' +
          '<span>年龄 <b>' + esc(ageText(p)) + '</b></span>' +
          '<span>健康分 <b>' + r.score + '</b>（' + esc(r.band) + '）</span>' +
          '<span>需跟进 <b>' + r.stats.realIssues + '</b> 项</span>' +
          '<span>生成于 ' + today() + '</span>' +
        '</div>' +
      '</header>' +

      '<section class="sum-sec">' +
        '<h2><i>①</i>见到医生，先问这三句</h2>' +
        '<ol class="sum-ask">' + askHtml + '</ol>' +
      '</section>' +

      '<section class="sum-sec">' +
        '<h2><i>②</i>超出参考区间的 ' + rows.length + ' 项</h2>' +
        '<table class="sum-tbl">' +
          '<thead><tr><th>项目</th><th>本次</th><th>参考区间</th><th>上次</th></tr></thead>' +
          '<tbody>' + rowHtml + '</tbody>' +
        '</table>' +
        more +
        '<p class="sum-note">「上次」为空表示本机还没有更早的记录。本表只列数值与区间，不含判断。</p>' +
      '</section>' +

      '<section class="sum-sec sum-two">' +
        '<div>' +
          '<h2><i>③</i>接下来三个月怎么吃</h2>' +
          listHtml(diet, 'sum-list') +
        '</div>' +
        '<div>' +
          '<h2><i>④</i>怎么运动</h2>' +
          listHtml(train, 'sum-list') +
        '</div>' +
      '</section>' +

      '<footer class="sum-foot">' +
        '<p><b>说明</b>本摘要由规则引擎基于检验参考区间与公开临床指南生成，属于健康教育与就医引导，' +
          '不构成医学诊断，也不能替代执业医师的面诊。用药、补充剂与运动强度的调整，请以主诊医生意见为准。</p>' +
        '<p class="sum-sign">报告在本机解析，未上传服务器 · 康鉴 HealthLens</p>' +
      '</footer>';
  }

  /* ================= 覆盖层 ================= */
  function ensure() {
    var el = $('#sumSheet');
    if (el) return el;
    el = document.createElement('div');
    el.className = 'sum';
    el.id = 'sumSheet';
    el.innerHTML =
      '<div class="sum-bar">' +
        '<button class="sum-back" id="sumBack">‹ 返回</button>' +
        '<b>就诊摘要</b>' +
        '<button class="sum-act" id="sumPrint">打印</button>' +
        '<button class="sum-act on" id="sumSave">存图</button>' +
      '</div>' +
      '<div class="sum-scroll"><div class="sum-doc" id="sumDoc"></div></div>';
    document.body.appendChild(el);

    el.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('#sumBack')) close();
      else if (t.closest('#sumPrint')) doPrint();
      else if (t.closest('#sumSave')) doSave();
    });
    return el;
  }

  var LAST = null;

  function open(r, who) {
    if (!r || r.isEmpty) {
      window.alert('这份报告里没有可摘要的异常项。');
      return;
    }
    LAST = { r: r, who: who || '本人' };
    var el = ensure();
    $('#sumDoc', el).innerHTML = build(r, LAST.who);
    el.classList.add('on');
    document.body.classList.add('sum-open');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
  }

  function close() {
    var el = $('#sumSheet');
    if (el) el.classList.remove('on');
    document.body.classList.remove('sum-open');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.key === 'Escape' || e.key === 'Esc') close();
  }

  /* 打印：只留 .sum-doc，其余（含 app、弹层、工具栏）全部隐藏。
     打印样式在 css 的 @media print 里，这里只负责把文档准备好。 */
  function doPrint() {
    if (!LAST) return;
    window.print();
  }

  function doSave() {
    if (!LAST) return;
    var cv = canvasOf(LAST.r, LAST.who);
    if (!cv) { window.alert('这台设备不支持导出图片，可以改用「打印」另存为 PDF。'); return; }
    var url = cv.toDataURL('image/png');
    var a = document.createElement('a');
    a.href = url;
    a.download = '康鉴-就诊摘要-' + LAST.who + '.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /* ================= 竖版存图 =================
     750×按内容伸长的竖版，A4 比例附近，微信里发出去不会被裁。 */
  var CW = 750, PAD = 46;

  function wrap(g, size, weight, text, maxW, maxLines) {
    var out = [], cur = '';
    var chars = String(text == null ? '' : text).split('');
    for (var i = 0; i < chars.length; i++) {
      var test = cur + chars[i];
      if (g.measureText(test).width > maxW && cur) {
        out.push(cur);
        cur = chars[i];
        if (out.length >= maxLines) return out;
      } else {
        cur = test;
      }
    }
    if (cur) out.push(cur);
    return out.slice(0, maxLines);
  }

  function canvasOf(r, who) {
    try {
      var p = r.profile || {};
      var asks = threeAsks(r);
      var rows = abRows(r).slice(0, 8);
      var diet = dietThree(r);
      var train = trainThree(r);

      /* 先在一张足够高的画布上画，画完按实际用掉的高度裁一次。
         按行数估算高度太容易算少——少算一行，免责声明就被裁掉了。 */
      var cv = document.createElement('canvas');
      cv.width = CW;
      cv.height = 4000;
      var g = cv.getContext('2d');
      var F = function (size, weight) {
        g.font = (weight || 400) + ' ' + size + 'px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
      };

      g.fillStyle = '#FFFFFF';
      g.fillRect(0, 0, CW, cv.height);

      var C = {
        ink: '#0F2027', ink2: '#46595F', ink3: '#7E9099', line: '#E4EBED',
        teal: '#0C8B94', tealSoft: '#E4F3F4', coral: '#D2563C', green: '#2C8F5F', amber: '#B98311'
      };
      var cy = 0;
      var T = function (s, x, yy, size, weight, color, align) {
        F(size, weight);
        g.fillStyle = color || C.ink;
        g.textAlign = align || 'left';
        g.fillText(String(s), x, yy);
      };
      var L = function (x1, yy1, x2, yy2, color) {
        g.strokeStyle = color || C.line;
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(x1, yy1); g.lineTo(x2, yy2); g.stroke();
      };

      /* 顶部色带 */
      g.fillStyle = C.teal;
      g.fillRect(0, 0, CW, 8);

      cy = 70;
      T('康鉴 HealthLens', PAD, cy, 17, 600, C.teal);
      T('就诊摘要', CW - PAD, cy, 17, 500, C.ink3, 'right');
      cy += 52;
      T((who || '本人') + ' · 体检异常摘要', PAD, cy, 34, 700, C.ink);
      cy += 44;
      T('性别 ' + (p.sex || '—') + '　年龄 ' + ageText(p) +
        '　健康分 ' + r.score + '（' + r.band + '）　需跟进 ' + r.stats.realIssues + ' 项',
        PAD, cy, 18, 400, C.ink2);
      cy += 26;
      T('生成于 ' + today(), PAD, cy, 15, 400, C.ink3);
      cy += 34;
      L(PAD, cy, CW - PAD, cy);
      cy += 40;

      /* ① 三句话 */
      T('① 见到医生，先问这三句', PAD, cy, 22, 700, C.ink);
      cy += 36;
      asks.forEach(function (a, i) {
        T((i + 1) + '. ' + a.dept, PAD, cy, 18, 600, C.teal);
        cy += 28;
        F(19, 400);
        wrap(g, 19, 400, a.ask, CW - PAD * 2, 3).forEach(function (ln) {
          T(ln, PAD + 10, cy, 19, 400, C.ink2);
          cy += 29;
        });
        cy += 6;
      });
      cy += 12;
      L(PAD, cy, CW - PAD, cy);
      cy += 38;

      /* ② 异常项 */
      T('② 超出参考区间的 ' + abRows(r).length + ' 项', PAD, cy, 22, 700, C.ink);
      cy += 34;
      T('项目', PAD, cy, 15, 500, C.ink3);
      T('本次', CW - PAD - 250, cy, 15, 500, C.ink3, 'right');
      T('参考区间', CW - PAD - 120, cy, 15, 500, C.ink3, 'right');
      T('上次', CW - PAD, cy, 15, 500, C.ink3, 'right');
      cy += 12;
      L(PAD, cy, CW - PAD, cy);
      cy += 30;
      rows.forEach(function (x) {
        T(x.name, PAD, cy, 18, 500, C.ink);
        var st = stText(x.st);
        if (st) {
          T(st, PAD + g.measureText(x.name).width + 10, cy, 14, 500, C.coral);
        }
        T(fmt(x.value) + (x.unit ? ' ' + x.unit : ''), CW - PAD - 250, cy, 18, 600, C.ink, 'right');
        T(x.kind === 'img' ? '影像' : refText(x.ref), CW - PAD - 120, cy, 16, 400, C.ink3, 'right');
        var pv = x.kind === 'item' ? prevOf(x.id) : null;
        T(pv ? fmt(pv.v) : '—', CW - PAD, cy, 16, 400, pv ? C.ink2 : C.ink3, 'right');
        cy += 32;
        L(PAD, cy - 8, CW - PAD, cy - 8, '#F2F6F7');
        cy += 20;
      });
      cy += 6;
      T('「上次」为空表示本机还没有更早的记录；本表只列数值与区间，不含判断。', PAD, cy, 15, 400, C.ink3);
      cy += 30;
      L(PAD, cy, CW - PAD, cy);
      cy += 38;

      /* ③④ 饮食运动 */
      var colW = (CW - PAD * 2 - 24) / 2;
      T('③ 接下来三个月怎么吃', PAD, cy, 22, 700, C.ink);
      T('④ 怎么运动', PAD + colW + 24, cy, 22, 700, C.ink);
      cy += 36;
      var y1 = cy, y2 = cy;
      var drawCol = function (arr, x, yy) {
        arr.forEach(function (item) {
          T(item.t, x, yy, 17, 600, C.teal);
          yy += 26;
          wrap(g, 16, 400, item.d, colW, 3).forEach(function (ln) {
            T(ln, x, yy, 16, 400, C.ink2);
            yy += 24;
          });
          yy += 16;
        });
        return yy;
      };
      y1 = drawCol(diet, PAD, y1);
      y2 = drawCol(train, PAD + colW + 24, y2);
      cy = Math.max(y1, y2) + 10;
      L(PAD, cy, CW - PAD, cy);
      cy += 34;

      /* 免责：底色块按实际行数撑开，写死高度会把最后一行挤到框外 */
      F(15, 400);
      var disc = wrap(g, 15, 400,
        '本摘要由规则引擎基于检验参考区间与公开临床指南生成，属于健康教育与就医引导，不构成医学诊断，也不能替代执业医师的面诊。用药与运动强度调整请以主诊医生意见为准。',
        CW - PAD * 2 - 24, 6);
      var boxH = disc.length * 23 + 20;
      g.fillStyle = '#F7FAFB';
      g.fillRect(PAD, cy - 20, CW - PAD * 2, boxH);
      var dy = cy;
      disc.forEach(function (ln) {
        T(ln, PAD + 12, dy, 15, 400, C.ink3);
        dy += 23;
      });
      cy = dy + 20;
      T('报告在本机解析，未上传服务器 · 康鉴 HealthLens', PAD, cy, 14, 400, C.ink3);
      cy += 34;

      /* 按实际内容裁掉多余的空白 */
      var out = document.createElement('canvas');
      out.width = CW;
      out.height = Math.min(cv.height, Math.ceil(cy));
      out.getContext('2d').drawImage(cv, 0, 0);
      return out;
    } catch (e) {
      if (window.console && console.error) console.error('就诊摘要导出失败', e);
      return null;
    }
  }

  return {
    open: open,
    close: close,
    /* 测试用 */
    _build: build,
    _canvas: canvasOf,
    _threeAsks: threeAsks,
    _abRows: abRows
  };
})();
