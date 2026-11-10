/* ============================================================
   康鉴 HealthLens · 分享卡
   ------------------------------------------------------------
   为什么要有这个文件：
     用户真正会做的事不是「看完就关」，而是把结论发给家人。
     截图截出来一半是折叠卡、一半是免责声明，发出去没人看。
     所以手画一张 750 宽的竖图：分数 + 三件要做的事 + 完整度。

   为什么用 canvas 而不是 html2canvas：
     项目是零依赖静态页，为了导一张图引 200KB 的库不值当。
     代价是所有排版都要自己算——下面就是这么算的。
   ============================================================ */
window.HL = window.HL || {};

HL.share = (function () {
  'use strict';

  var FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif';
  var C = {
    bg1: '#0C1C22', bg2: '#153039',
    teal: '#4FD8D2', tealSoft: 'rgba(79,216,210,.14)',
    ink: '#EAF6F7', ink2: '#9DB7BE', ink3: '#6C868D',
    amber: '#E8B33F', coral: '#E8735A', green: '#58C08A',
    line: 'rgba(255,255,255,.09)'
  };

  var W = 750;      /* 逻辑宽度，微信里缩放后仍清晰 */
  var PAD = 56;
  var SCALE = 2;    /* 导出 1500 宽，群里点开不糊 */

  function f(size, weight) {
    return (weight || 400) + ' ' + size + 'px ' + FONT;
  }

  /* ---------- 断行 ----------
     中文按字断，英文和数字整词不拆。
     否则「HbA1c」会被切成「HbA」+「1c」，非常业余。 */
  function tokenize(s) {
    var out = [], buf = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (/[A-Za-z0-9.%+\-\/–—]/.test(ch)) buf += ch;
      else {
        if (buf) { out.push(buf); buf = ''; }
        out.push(ch);
      }
    }
    if (buf) out.push(buf);
    return out;
  }

  function cut(m, s, maxW) {
    if (m.measureText(s + '…').width <= maxW) return s + '…';
    var t = s;
    while (t.length > 1 && m.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }

  /* 断行必须在「和实际绘制完全相同的字体」下测量。
     漏了这一步，measureText 用的是默认 10px，所有文字都被认为很短，
     永远不换行——长句会直接冲出画布右边。 */
  function wrap(m, size, weight, s, maxW, maxLines) {
    m.font = f(size, weight);
    var toks = tokenize(String(s == null ? '' : s));
    var lines = [], cur = '';
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (cur && m.measureText(cur + t).width > maxW) {
        lines.push(cur);
        cur = t;
      } else {
        cur += t;
      }
    }
    if (cur) lines.push(cur);
    if (maxLines && lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = cut(m, lines[maxLines - 1], maxW);
    }
    return lines;
  }

  /* 卡片上不写全名：「同型半胱氨酸（Hcy）」→「同型半胱氨酸」 */
  function shortName(n) {
    return String(n || '').split('（')[0].split('(')[0].trim();
  }

  function starColor(n) {
    return n >= 6 ? C.coral : n >= 5 ? C.amber : n >= 4 ? C.teal : C.ink3;
  }

  function verdictOf(score) {
    return score >= 90 ? '状态不错'
      : score >= 80 ? '整体可控'
        : score >= 70 ? '有几件事要处理'
          : '需要认真对待';
  }

  /* ---------- 主流程：先排一遍算高度，再画 ----------
     两次测量用同一个 ctx，保证换行位置一致。 */
  function build(r) {
    if (!r || r.isEmpty) return null;

    var mc = document.createElement('canvas').getContext('2d');
    var ops = [];
    var y = 0;

    function T(str, x, ty, size, weight, color, align, ls) {
      ops.push({ k: 't', s: str, x: x, y: ty, f: f(size, weight), c: color, a: align || 'left', ls: ls || 0 });
    }
    function L(x1, y1, x2, y2, color) {
      ops.push({ k: 'l', x1: x1, y1: y1, x2: x2, y2: y2, c: color || C.line });
    }
    function ARC(cx, cy, rad, from, to, color, width) {
      ops.push({ k: 'a', cx: cx, cy: cy, r: rad, from: from, to: to, c: color, w: width });
    }

    /* ===== 抬头 ===== */
    y = 76;
    T('康鉴 HealthLens', W / 2, y, 25, 700, C.teal, 'center', 0);
    T('把体检报告里的每个标红项说明白', W / 2, y + 38, 20, 400, C.ink3, 'center', 1);

    /* ===== 分数 ===== */
    var cy = 268, rad = 92;
    ARC(W / 2, cy, rad, 0, Math.PI * 2, 'rgba(255,255,255,.10)', 11);
    ARC(W / 2, cy, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (r.score / 100), C.teal, 11);
    T(String(r.score), W / 2, cy + 16, 68, 700, C.ink, 'center');
    T('健康分', W / 2, cy + 52, 19, 400, C.ink3, 'center', 2);

    var st = r.stats;
    y = 428;
    T(verdictOf(r.score), W / 2, y, 42, 700, C.ink, 'center', 2);

    /* 一句话把「标红」和「真有事」分开——这是本产品最想让人记住的差别 */
    var subBits = [];
    if (st.realIssues) subBits.push(st.realIssues + ' 项需要跟进');
    else subBits.push('没有需要跟进的项目');
    if (st.falseAlarmRows) subBits.push(st.falseAlarmRows + ' 项标红其实不用管');
    T(subBits.join(' · '), W / 2, y + 42, 22, 400, C.ink2, 'center');

    /* ===== 三格统计 ===== */
    y = 546;
    var cols = [
      { n: st.total, t: '检查项目' },
      { n: st.realIssues, t: '需要跟进' },
      { n: st.falseAlarmRows, t: '假警报' }
    ];
    var colW = W - PAD * 2;
    cols.forEach(function (c, i) {
      var cx = PAD + colW / 6 + (colW / 3) * i;
      T(String(c.n), cx, y + 26, 36, 700, i === 1 && c.n ? C.coral : C.ink, 'center');
      T(c.t, cx, y + 58, 19, 400, C.ink3, 'center', 1);
      if (i) L(PAD + (colW / 3) * i, y + 4, PAD + (colW / 3) * i, y + 50, C.line);
    });

    /* ===== 三件要做的事 ===== */
    y += 100;
    L(PAD, y, W - PAD, y);
    y += 52;

    var picks = (r.findings || []).filter(function (x) { return x.severity >= 1 && !x.noDeduct; }).slice(0, 3);

    if (picks.length) {
      T('现在最该先做的' + (picks.length === 3 ? '三件' : picks.length + ' 件'),
        PAD, y, 24, 600, C.ink2, 'left', 1);
      y += 46;

      picks.forEach(function (fd) {
        var rule = fd.rule || {};
        var name = shortName(rule.name);
        var stars = '';
        for (var i = 0; i < fd.stars; i++) stars += '★';

        T(name, PAD, y + 26, 29, 600, C.ink, 'left');
        T(stars, W - PAD, y + 25, 19, 400, starColor(fd.stars), 'right', 2);

        var why = rule.headline || rule.detail || '';
        var line = wrap(mc, 20, 400, why, W - PAD * 2, 1)[0] || '';
        if (line) T(line, PAD, y + 60, 20, 400, C.ink3, 'left');

        y += 92;
      });
    } else {
      T('这次没有需要处理的异常', PAD, y + 8, 26, 600, C.green, 'left');
      y += 60;
    }

    /* ===== 完整度 =====
       体检套餐差别很大，查得少不等于身体好。
       分享卡上必须留这一行，否则分数会被当成体检结论。 */
    var cov = r.coverage;
    if (cov && cov.missing.length) {
      y += 6;
      L(PAD, y, W - PAD, y);
      y += 44;

      T('只查了 ' + cov.checked + ' / ' + cov.total + ' 项，未包含 ' + cov.missing.length + ' 项',
        PAD, y, 20, 600, C.ink3, 'left', 0);
      y += 32;

      var missTxt = cov.missing.slice(0, 5).map(shortName).join('、') +
        (cov.missing.length > 5 ? ' 等' : '');
      wrap(mc, 20, 400, missTxt, W - PAD * 2, 2).forEach(function (ln) {
        T(ln, PAD, y, 20, 400, C.ink3, 'left');
        y += 30;
      });

      /* 只查了两三项也能拿 100 分——这张图会被发到家人群里，
         不写清楚就等于在骗人。 */
      if (cov.checked / cov.total < 0.6) {
        y += 4;
        T('查得太少，这个分数参考价值有限', PAD, y, 20, 600, C.amber, 'left');
        y += 30;
      }
    }

    /* ===== 页脚 ===== */
    y += 30;
    L(PAD, y, W - PAD, y);
    y += 40;
    T('康鉴 HealthLens · 体检报告解读', W / 2, y, 20, 600, C.teal, 'center', 0);
    y += 32;
    var foot = wrap(mc, 17, 400, '结论由规则引擎依据检验参考区间与公开临床指南生成，属健康教育与就医引导，不构成医学诊断。',
      W - PAD * 2, 2);
    foot.forEach(function (ln) {
      T(ln, W / 2, y, 17, 400, C.ink3, 'center');
      y += 26;
    });

    var H = Math.ceil(y + PAD - 8);

    /* ---------- 真正画 ---------- */
    var cv = document.createElement('canvas');
    cv.width = W * SCALE;
    cv.height = H * SCALE;
    var g = cv.getContext('2d');
    g.scale(SCALE, SCALE);

    var bg = g.createLinearGradient(0, 0, W * 0.4, H);
    bg.addColorStop(0, C.bg1);
    bg.addColorStop(1, C.bg2);
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    /* 左上角一层很淡的光，避免整张图死平 */
    var gl = g.createRadialGradient(W * 0.18, 180, 20, W * 0.18, 180, 520);
    gl.addColorStop(0, 'rgba(79,216,210,.13)');
    gl.addColorStop(1, 'rgba(79,216,210,0)');
    g.fillStyle = gl;
    g.fillRect(0, 0, W, H);

    ops.forEach(function (o) {
      if (o.k === 'l') {
        g.beginPath();
        g.moveTo(o.x1, o.y1);
        g.lineTo(o.x2, o.y2);
        g.strokeStyle = o.c;
        g.lineWidth = 1;
        g.stroke();
      } else if (o.k === 'a') {
        g.beginPath();
        g.arc(o.cx, o.cy, o.r, o.from, o.to);
        g.strokeStyle = o.c;
        g.lineWidth = o.w;
        g.lineCap = 'round';
        g.stroke();
      } else {
        g.font = o.f;
        g.fillStyle = o.c;
        g.textAlign = o.a;
        g.textBaseline = 'alphabetic';
        if (o.ls) {
          /* 手写 letterSpacing：canvas 的 letterSpacing 属性兼容性还不够。
             但只给中文加——否则「HealthLens」会被拉成「H e a l t h L e n s」。 */
          var isCJK = function (ch) { return /[\u3000-\u303F\u4E00-\u9FFF\uFF00-\uFFEF]/.test(ch); };
          var total = 0, i, adv = [];
          for (i = 0; i < o.s.length; i++) {
            var w = g.measureText(o.s.charAt(i)).width;
            adv.push(w + (isCJK(o.s.charAt(i)) ? o.ls : 0));
            total += adv[i];
          }
          total -= o.ls;
          var startX = o.a === 'center' ? o.x - total / 2 : o.a === 'right' ? o.x - total : o.x;
          for (i = 0; i < o.s.length; i++) {
            g.fillText(o.s.charAt(i), startX, o.y);
            startX += adv[i];
          }
        } else {
          g.fillText(o.s, o.x, o.y);
        }
      }
    });

    return cv;
  }

  /* ---------- 弹层 ---------- */
  var maskEl = null;

  function close() {
    if (maskEl && maskEl.parentNode) maskEl.parentNode.removeChild(maskEl);
    maskEl = null;
  }

  function open(r) {
    close();
    var cv = build(r);
    if (!cv) return;

    var url = cv.toDataURL('image/png');

    maskEl = document.createElement('div');
    maskEl.className = 'share-mask';
    maskEl.innerHTML =
      '<div class="share-box">' +
        '<div class="share-hd">' +
          '<b>分享卡已生成</b>' +
          '<button class="share-x" id="shClose" aria-label="关闭">✕</button>' +
        '</div>' +
        '<div class="share-img-wrap"><img id="shImg" alt="体检报告解读分享卡" src="' + url + '"></div>' +
        '<p class="share-tip">手机上长按图片即可保存；也可以点下面按钮下载</p>' +
        '<div class="share-ft">' +
          '<button class="btn btn-main" id="shSave">下载图片</button>' +
          '<button class="btn btn-ghost" id="shCancel">取消</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(maskEl);

    maskEl.addEventListener('click', function (e) {
      if (e.target === maskEl) close();
    });
    maskEl.querySelector('#shClose').addEventListener('click', close);
    maskEl.querySelector('#shCancel').addEventListener('click', close);
    maskEl.querySelector('#shSave').addEventListener('click', function () {
      var a = document.createElement('a');
      a.href = url;
      a.download = '康鉴-体检解读-' + r.score + '分.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }

  return {
    build: build,
    open: open,
    close: close,
    /* 给自动化测试用：直接拿 dataURL，不开弹层 */
    dataURL: function (r) {
      var cv = build(r);
      return cv ? cv.toDataURL('image/png') : null;
    }
  };
})(window.HL);
