/* ============================================================
   康鉴 HealthLens · 历史对比
   ------------------------------------------------------------
   为什么不做「上传第二份报告自动对比」：
     现在还没有 OCR，能拿到的结构化报告只有内置样板。
     假装有趋势，就是在编数据。

   所以做成「补录」：
     用户手里一定有上一次的纸质或 PDF 报告，抄几个关键数字，
     就能看出这一年是变好还是变差。这不需要任何后端。

   判断方向的关键：
     不能看数值涨跌，要看「离参考区间多远」。
     尿酸 392 → 405 是变差，HDL 1.0 → 1.2 是变好，
     同样是「涨了」，结论相反。用偏离幅度判断天然处理这件事。
   ============================================================ */
window.HL = window.HL || {};

HL.trend = (function () {
  'use strict';

  var KEY = 'hl_hist_v1';
  var MAX = 12;                    /* 最多留 12 次，再多 localStorage 吃不消 */

  /* 没有异常时也值得盯的项：下次体检好对得上 */
  /* 顺序就是优先级：尿酸、血糖、低密度脂蛋白这几个最常被问到，
     排在前面才不会被边缘项挤掉 */
  var CORE = ['uric', 'fbg', 'ldl', 'tc', 'tg', 'hdl', 'alt', 'ggt',
    'hcy', 'bmi', 'cr', 'ast', 'hba1c', 'tsh'];

  /* ---------- 存取 ---------- */
  function load() {
    try {
      var a = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(a)) return [];
      return a.filter(function (x) { return x && x.at && x.vals; });
    } catch (e) { return []; }
  }
  function store(a) {
    try {
      localStorage.setItem(KEY, JSON.stringify(a.slice(-MAX)));
    } catch (e) { /* 无痕模式，静默失败 */ }
  }
  function push(snap) {
    var a = load();
    /* 同一个月只留最新的一条，避免反复保存堆出重复行 */
    a = a.filter(function (x) { return x.at !== snap.at; });
    a.push(snap);
    a.sort(function (p, q) { return p.at < q.at ? -1 : p.at > q.at ? 1 : 0; });
    store(a);
    return a;
  }
  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  /* ---------- 判断 ----------
     返回「离参考区间有多远」的相对值。区间内为 0。

     两个必须处理的例外，否则会把好转说成恶化：
       dir === 'low'   只有偏低算异常（血氧 100、视力 2.0、eGFR 200
                       都在区间外，但没人认为这是病）
       benignMax       高到某个值以内算良性（HDL 1.50 超上限，但这是好事）

     不做这两个例外，HDL 从 1.05 升到 1.50 会被判成「和上次差不多」，
     而它其实是这次报告里最值得高兴的一项。 */
  function outDist(v, ref, meta) {
    if (v == null || !ref) return 0;
    var lo = ref[0], hi = ref[1];

    if (hi != null && v > hi) {
      if (meta && meta.dir === 'low') return 0;
      if (meta && meta.benignMax != null && v <= meta.benignMax) return 0;
      return (v - hi) / (Math.abs(hi) || 1);
    }
    if (lo != null && v < lo) return (v - lo) / (Math.abs(lo) || 1);
    return 0;
  }

  function judge(cur, prev, ref, meta) {
    if (cur == null || prev == null) return null;
    var dn = outDist(cur, ref, meta), dp = outDist(prev, ref, meta);
    var an = Math.abs(dn), ap = Math.abs(dp);
    var pct = prev === 0 ? null : Math.round((cur - prev) / Math.abs(prev) * 100);

    if (ap === 0 && an === 0) return { k: 'flat', t: '两次都在区间内', pct: pct };
    if (ap > 0 && an === 0) return { k: 'good', t: '已回到区间内', pct: pct };
    if (ap === 0 && an > 0) return { k: 'bad', t: '这次超出区间', pct: pct };
    /* 两侧都异常：看偏离是在收窄还是扩大 */
    if (an < ap - 0.02) return { k: 'good', t: '偏离在收窄', pct: pct };
    if (an > ap + 0.02) return { k: 'bad', t: '偏离在扩大', pct: pct };
    return { k: 'flat', t: '和上次差不多', pct: pct };
  }

  /* ---------- 本次有哪些项值得比 ---------- */
  function candidates(r) {
    var items = r.items || [];
    var byId = {}, list = [];

    items.forEach(function (it) {
      var v = parseFloat(it.value);
      if (!isFinite(v)) return;                 /* 定性项（尿蛋白 2+）不参与数值对比 */
      if (!it.ref) return;
      if (byId[it.id]) return;
      byId[it.id] = it;
    });

    /* 异常项按「偏离参考区间多远」降序。
       原来按报告里的原始顺序排，结果排头的是 rdwcv、淋巴细胞百分比
       这类边缘项，把尿酸和血糖挤到 14 行以外——用户抄了半天，
       最该比的两项没抄到。 */
    var abn = [];
    Object.keys(byId).forEach(function (id) {
      var o = byId[id];
      if (o._status === 'normal') return;
      abn.push({ o: o, d: Math.abs(outDist(parseFloat(o.value), o.ref, HL.dictById[o.id])) });
    });
    abn.sort(function (a, b) { return b.d - a.d; });
    abn.slice(0, 8).forEach(function (x) { list.push(x.o); });

    /* 核心项兜底补满：即使全部正常也值得和上次对一下 */
    CORE.forEach(function (id) {
      var o = byId[id];
      if (o && list.indexOf(o) < 0) list.push(o);
    });

    return list.slice(0, 16);
  }

  /* 「同型半胱氨酸（Hcy）」在窄行里放不下，只留中文部分 */
  function shortName(n) {
    return String(n || '').split('（')[0].split('(')[0].trim();
  }

  function fmtNum(v) {
    if (v == null) return '—';
    var n = Math.round(v * 100) / 100;
    return String(n);
  }

  function atLabel(at) {
    var m = String(at).match(/^(\d{4})-(\d{1,2})$/);
    return m ? m[1] + ' 年 ' + parseInt(m[2], 10) + ' 月' : String(at);
  }

  /* ---------- 小折线 ----------
     只有两条以上历史才有意义（本次 + 2 次过去 = 3 个点） */
  function spark(vals, color) {
    if (vals.length < 3) return '';
    var w = 66, h = 22, pad = 3;
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    var span = mx - mn || 1;
    var pts = vals.map(function (v, i) {
      var x = pad + (w - pad * 2) * (i / (vals.length - 1));
      var y = h - pad - (h - pad * 2) * ((v - mn) / span);
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    var last = pts[pts.length - 1].split(',');
    return '<svg class="tr-spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="1.6" ' +
        'stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.4" fill="' + color + '"/>' +
    '</svg>';
  }

  /* ---------- 主体 ---------- */
  function blockHtml(r) {
    var hist = load();
    var cands = candidates(r);

    if (!hist.length) {
      return '<div class="sec-title"><h2>和上次比</h2><span class="sub">只有一次数据看不出趋势</span></div>' +
        '<div class="card trend-empty">' +
          '<p>趋势至少要两次体检才成立。你手上如果有上一次的报告，把几个关键数字抄进来——' +
          '不需要上传文件，也不会传出去，只存在这台设备上。</p>' +
          '<button class="btn btn-ghost" id="trAdd">补录上一次的数值</button>' +
        '</div>';
    }

    var last = hist[hist.length - 1];
    var rows = [], counts = { good: 0, bad: 0, flat: 0 };

    cands.forEach(function (it) {
      var prev = last.vals[it.id];
      if (prev == null) return;
      var j = judge(parseFloat(it.value), parseFloat(prev), it.ref, HL.dictById[it.id]);
      if (!j) return;
      counts[j.k]++;
      var series = hist.map(function (h) { return h.vals[it.id]; })
        .filter(function (v) { return v != null; })
        .concat([parseFloat(it.value)]);
      var col = j.k === 'good' ? 'var(--green)' : j.k === 'bad' ? 'var(--coral)' : 'var(--ink4)';
      /* 两行式：第一行名称 + 判断，第二行数值 + 折线。
         挤成一行时名称只剩 80 多像素，「低密度脂蛋白胆固醇 LDL-C」
         会被截成「低密度脂蛋白…」，而它恰恰是最该看清的一项。 */
      rows.push(
        '<div class="tr-row">' +
          '<div class="tr-top">' +
            '<b>' + esc(shortName(it.name)) + '</b>' +
            '<span class="tr-tag ' + j.k + '">' + j.t + '</span>' +
          '</div>' +
          '<div class="tr-bot">' +
            '<span class="tr-prev">' + fmtNum(prev) + '</span>' +
            '<span class="tr-dash">→</span>' +
            '<span class="tr-now" style="color:' + col + '">' + fmtNum(parseFloat(it.value)) + '</span>' +
            (it.unit ? '<span class="tr-unit">' + esc(it.unit) + '</span>' : '') +
            spark(series, col) +
          '</div>' +
        '</div>');
    });

    if (!rows.length) {
      return '<div class="sec-title"><h2>和上次比</h2><span class="sub">' + atLabel(last.at) + '</span></div>' +
        '<div class="card trend-empty">' +
          '<p>上次记录的项这次一项都没查到，没法对比。可以补一条新的记录。</p>' +
          '<button class="btn btn-ghost" id="trAdd">补录一次</button>' +
        '</div>';
    }

    var bits = [];
    if (counts.good) bits.push(counts.good + ' 项在变好');
    if (counts.bad) bits.push(counts.bad + ' 项在变差');
    if (counts.flat) bits.push(counts.flat + ' 项基本没变');

    return '<div class="sec-title"><h2>和上次比</h2><span class="sub">' + atLabel(last.at) + ' → 本次</span></div>' +
      '<div class="card trend">' +
        '<div class="tr-sum">' + esc(bits.join('，')) + '。</div>' +
        rows.join('') +
        '<div class="tr-foot">' +
          '<button class="tr-link" id="trAdd">补录一次</button>' +
          '<button class="tr-link danger" id="trClear">清除历史</button>' +
        '</div>' +
      '</div>';
  }

  /* ---------- 补录表单 ---------- */
  function formHtml(r, hist) {
    var cands = candidates(r);
    if (!cands.length) return '<div class="card trend-empty"><p>这份报告没有可对比的数值项。</p></div>';

    /* 名称独占左侧一列、允许折两行。
       挤成一行时 320 宽下只剩 100px，「红细胞体积分布宽度 CV」
       和「红细胞体积分布宽度 SD」都会被截成同一个「红细胞体积分布宽…」，
       用户根本不知道该填哪一项。 */
    var rows = cands.map(function (it) {
      return '<div class="tr-frow">' +
        '<div class="tr-finfo">' +
          '<b>' + esc(it.name) + '</b>' +
          '<span>' + (it.unit ? esc(it.unit) + ' · ' : '') +
            '本次 ' + fmtNum(parseFloat(it.value)) + '</span>' +
        '</div>' +
        '<input type="number" step="any" inputmode="decimal" data-id="' + esc(it.id) + '" ' +
          'placeholder="上次的值">' +
      '</div>';
    }).join('');

    /* 用两个下拉而不是 <input type="month">：
       Safari（iOS 与 Mac）至今不支持 month 类型，会退化成纯文本框，
       手机上要手打「2024-11」，还要自己保证格式对。下拉点两下就完事。 */
    var now = new Date();
    var thisYear = now.getFullYear();
    var defAt = hist.length ? hist[hist.length - 1].at : '';
    var defY = defAt ? parseInt(defAt.slice(0, 4), 10) : thisYear - 1;
    var defM = defAt ? parseInt(defAt.slice(5, 7), 10) : now.getMonth() + 1;

    var yearOpts = '';
    for (var yy = thisYear; yy >= thisYear - 12; yy--) {
      yearOpts += '<option value="' + yy + '"' + (yy === defY ? ' selected' : '') + '>' + yy + '</option>';
    }
    var monthOpts = '';
    for (var mm = 1; mm <= 12; mm++) {
      monthOpts += '<option value="' + mm + '"' + (mm === defM ? ' selected' : '') + '>' + mm + '</option>';
    }

    return '<div class="card trend-form">' +
      '<div class="tr-form-hd"><b>补录上一次的数值</b>' +
        '<button class="tr-x" id="trCancel">取消</button></div>' +
      '<p class="tr-form-tip">只填你手边有的，空着的跳过就行。数据只存在这台设备上。</p>' +
      '<div class="tr-at"><span>上次体检时间</span>' +
        '<span class="tr-sel">' +
          '<select id="trYear">' + yearOpts + '</select><i>年</i>' +
          '<select id="trMonth">' + monthOpts + '</select><i>月</i>' +
        '</span>' +
      '</div>' +
      '<div class="tr-flist">' + rows + '</div>' +
      '<button class="btn btn-main" id="trSave">保存这次记录</button>' +
    '</div>';
  }

  /* ---------- 挂载 ----------
     root: 容器元素；r: 分析结果；onChange: 需要重画时回调 */
  function mount(root, r, onChange) {
    var box = root.querySelector('#trendBox');
    if (!box) return;

    function paint() { box.innerHTML = blockHtml(r); bind(); }

    function bind() {
      var add = box.querySelector('#trAdd');
      if (add) add.addEventListener('click', function () {
        box.innerHTML = formHtml(r, load());
        bindForm();
      });
      var clr = box.querySelector('#trClear');
      if (clr) clr.addEventListener('click', function () {
        if (!window.confirm('清除后无法恢复，确定要删掉所有历史记录吗？')) return;
        clear();
        paint();
      });
    }

    function bindForm() {
      var cancel = box.querySelector('#trCancel');
      if (cancel) cancel.addEventListener('click', paint);

      var save = box.querySelector('#trSave');
      if (!save) return;
      save.addEventListener('click', function () {
        var yEl = box.querySelector('#trYear'), mEl = box.querySelector('#trMonth');
        var at = yEl.value + '-' + ('0' + mEl.value).slice(-2);
        var vals = {}, n = 0;
        box.querySelectorAll('.tr-frow input').forEach(function (inp) {
          var v = parseFloat(inp.value);
          if (isFinite(v)) { vals[inp.dataset.id] = v; n++; }
        });
        if (!n) {
          window.alert('一个数字都没填，先填至少一项再保存。');
          return;
        }
        push({ at: at, vals: vals, savedAt: Date.now() });
        if (onChange) onChange(); else paint();
      });
    }

    paint();
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  return {
    load: load,
    push: push,
    clear: clear,
    mount: mount,
    judge: judge,
    outDist: outDist,
    candidates: candidates
  };
})(window.HL);
