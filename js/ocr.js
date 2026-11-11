/* ============================================================
   ocr.js — 报告照片 → 结构化指标（全在本机跑，不上传）

   为什么要自己写预处理
   --------------------
   Tesseract 直接吃体检报告会彻底失败：表格线被当成笔画，行切分全乱，
   18 项能认出来的不到 2 项。去掉表格线之后同一张图置信度从 50 跳到 87。

   所以流程是四步：
     灰度 → 二值化 → 去长横线/长竖线 → 纠偏 → 重新二值化去线 → 识别

   为什么必须纠偏
   --------------
   手机拍纸一定歪。线一歪，run-length 去线就失效（长横线不再水平），
   整个链路崩掉。所以先用「去线后的纯文字」测倾角，转正了再走一遍。

   为什么识别结果必须让人核对
   --------------------------
   这份代码认错过「氨→氮」「蛋→蛇」「糖→精」。一个字错，判读结论就反了。
   所以永远不把 OCR 结果直接送进引擎——中间一定要有一步让人看一眼。

   识别不出来时怎么办
   ------------------
   不静默跳过。没认出的行照样列出来，标明「没认出」，让用户决定是指定
   指标还是删掉。静默丢弃会让用户以为报告里没这项。
   ============================================================ */
(function () {
  var HL = window.HL = window.HL || {};

  var BASE = 'vendor/ocr/';
  /* 缩放上限。手机原图 4000px 宽，不缩处理不动；但缩太狠字会糊——
     实测 1800 时拍照版从 15 项掉到 5 项，2400 才够。
     2400 宽约 700 万像素，预处理 1–2 秒，可以接受。 */
  var MAXW = 2400;
  var tessLoading = null;
  var activeRun = null;

  /* 原生壳里 Android aapt 会把 assets 里的 .gz 自动解压、并去掉 .gz 后缀：
     APK 内只有 chi_sim.traineddata（未压缩），网页版 / Pages 则是
     chi_sim.traineddata.gz。Tesseract worker 的规则是
       gzip ? '.traineddata.gz' : '.traineddata'
     所以原生壳必须传 gzip:false，否则会去请求一个不存在的文件，
     createWorker 永不 resolve —— 界面就一直卡在「正在加载中文语言包」。
     必须在 recognize() 运行时读：本文件加载早于 index.html 里
     __HL_NATIVE__ 的赋值，写在模块顶层会读到 undefined。 */
  function nativeLang() {
    try {
      if (window.__HL_NATIVE__ === true) return true;
      var C = window.Capacitor;
      return !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform());
    } catch (e) { return false; }
  }

  /* ================= 引擎懒加载 ================= */
  /* 5.7MB 的资源不能塞进首屏。用户点了「拍照识别」才下载，
     没点过的人一个字节都不会加载。 */
  function loadTess() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (tessLoading) return tessLoading;
    tessLoading = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = BASE + 'tesseract.min.js';
      s.onload = function () {
        if (window.Tesseract) res(window.Tesseract);
        else { tessLoading = null; rej(new Error('识别引擎加载失败')); }
      };
      s.onerror = function () { tessLoading = null; rej(new Error('识别引擎加载失败，请检查网络')); };
      document.head.appendChild(s);
    });
    return tessLoading;
  }

  /* ================= 图像处理 ================= */

  /* Otsu：自动找二值化阈值。固定阈值在暗光照片上必然翻车。 */
  function otsu(gray, N) {
    var hist = new Array(256);
    for (var t = 0; t < 256; t++) hist[t] = 0;
    for (var i = 0; i < N; i++) hist[gray[i]]++;
    var sum = 0;
    for (t = 0; t < 256; t++) sum += t * hist[t];
    var sumB = 0, wB = 0, best = -1, thr = 128;
    for (t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      var wF = N - wB;
      if (!wF) break;
      sumB += t * hist[t];
      var mB = sumB / wB, mF = (sum - sumB) / wF;
      var v = wB * wF * (mB - mF) * (mB - mF);
      if (v > best) { best = v; thr = t; }
    }
    return thr;
  }

  /* 标出长横线与长竖线。连续黑像素超过阈值才算线——
     文字笔画的连续长度远小于单元格宽高，不会被误伤。 */
  function lineMask(bin, W, H, hMin, vMin) {
    var kill = new Uint8Array(W * H), x, y, e, k, base;
    for (y = 0; y < H; y++) {
      x = 0; base = y * W;
      while (x < W) {
        if (bin[base + x]) {
          e = x;
          while (e < W && bin[base + e]) e++;
          if (e - x >= hMin) for (k = x; k < e; k++) kill[base + k] = 1;
          x = e;
        } else x++;
      }
    }
    for (x = 0; x < W; x++) {
      y = 0;
      while (y < H) {
        if (bin[y * W + x]) {
          e = y;
          while (e < H && bin[e * W + x]) e++;
          if (e - y >= vMin) for (k = y; k < e; k++) kill[k * W + x] = 1;
          y = e;
        } else y++;
      }
    }
    return kill;
  }

  /* 投影方差法测倾角：文字行越水平，行投影的直方图越尖。
     必须用「去过线的纯文字」来算——表格线是超强信号，会盖过文字。 */
  function findSkew(textBin, W, H) {
    var bestV = -1, bestA = 0, a, rad, sn, cs, off, hist, x, y, m, v, d, i;
    var step = 0.5, range = 4;
    for (a = -range; a <= range + 1e-9; a += step) {
      rad = a * Math.PI / 180; sn = Math.sin(rad); cs = Math.cos(rad);
      off = Math.ceil(Math.abs(W * sn)) + 2;
      hist = new Int32Array(H + off * 2 + 2);
      for (y = 0; y < H; y += 4) {
        var base = y * W;
        for (x = 0; x < W; x += 4) {
          if (textBin[base + x]) {
            var k = ((x * sn + y * cs) | 0) + off;
            if (k >= 0 && k < hist.length) hist[k]++;
          }
        }
      }
      m = 0;
      for (i = 0; i < hist.length; i++) m += hist[i];
      m /= hist.length;
      v = 0;
      for (i = 0; i < hist.length; i++) { d = hist[i] - m; v += d * d; }
      if (v > bestV) { bestV = v; bestA = a; }
    }
    return bestA;
  }

  /* 一张灰度图 → 去线后的二值画布 */
  function cleanPass(g, W, H, bias) {
    var d = g.getImageData(0, 0, W, H).data;
    var N = W * H, i;
    var gray = new Uint8Array(N);
    for (i = 0; i < N; i++) gray[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0;
    var thr = Math.min(210, Math.max(90, otsu(gray, N) - (bias || 0)));
    var bin = new Uint8Array(N);
    for (i = 0; i < N; i++) bin[i] = gray[i] < thr ? 1 : 0;
    var kill = lineMask(bin, W, H, Math.round(W * 0.25), Math.round(H * 0.018));

    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var cg = c.getContext('2d');
    var oi = cg.createImageData(W, H);
    for (i = 0; i < N; i++) {
      var v = (bin[i] && !kill[i]) ? 0 : 255;
      oi.data[i * 4] = oi.data[i * 4 + 1] = oi.data[i * 4 + 2] = v;
      oi.data[i * 4 + 3] = 255;
    }
    cg.putImageData(oi, 0, 0);
    return { canvas: c, thr: thr, textBin: (function () {
      var tb = new Uint8Array(N);
      for (var j = 0; j < N; j++) tb[j] = bin[j] && !kill[j] ? 1 : 0;
      return tb;
    })() };
  }

  function preprocess(img) {
    var W0 = img.naturalWidth, H0 = img.naturalHeight;
    if (!W0 || !H0) throw new Error('图片读不出来，换一张试试');
    var s = Math.min(1, MAXW / W0);
    var W = Math.max(1, Math.round(W0 * s)), H = Math.max(1, Math.round(H0 * s));

    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.drawImage(img, 0, 0, W, H);

    var pass = cleanPass(g, W, H, 0);
    var angle = findSkew(pass.textBin, W, H);

    /* 小于 0.4° 不值得转：插值会糊掉细笔画，反而掉识别率 */
    if (Math.abs(angle) < 0.4) return { canvas: pass.canvas, angle: 0, thr: pass.thr };

    var rc = document.createElement('canvas');
    rc.width = W; rc.height = H;
    var rg = rc.getContext('2d', { willReadFrequently: true });
    rg.fillStyle = '#fff'; rg.fillRect(0, 0, W, H);
    rg.translate(W / 2, H / 2);
    rg.rotate(-angle * Math.PI / 180);
    rg.drawImage(c, -W / 2, -H / 2);

    var pass2 = cleanPass(rg, W, H, 0);
    return { canvas: pass2.canvas, angle: angle, thr: pass2.thr };
  }

  /* ================= 文本 → 指标 ================= */

  /* 报告上这些行长得像指标行，但不是 */
  /* 报告页眉页脚、表头、结论段都会被 OCR 当成「名称 + 数值」的行。
     不放进来，核对页就会出现「攻了 3」「检验前 1」这种莫名其妙的行。 */
  var NOISE = /^(姓名|性别|年龄|体检日期|体检中心|日期|编号|条码|卡号|科室|床号|医生|医师|送检|采样|标本|备注|说明|提示|注意|须知|小结|结论|建议|异常|项目|名称|缩写|结果|单位|参考|区间|检验|检查|审核|报告|打印|地址|电话|身高|体重(?!指数)|腰围|血压|脉搏|体温|本报告|本页|本单|温馨提示|如有|请于|见第)/;

  /* 行级解析。
     不用 word 级：Tesseract 会把「5.82」拆成「5.」「82」，
     按 word 取数会取到 82，分数直接算错。 */
  function parseLines(lines) {
    var RANGE = /(\d+(?:\.\d+)?)\s*[-~—－]\s*(\d+(?:\.\d+)?)/;
    var QUAL = /^(阴性|阳性|弱阳性|[±+\-]{1,2}|[1-4]\+)$/;
    var out = [];

    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (!ln || !ln.text) continue;
      var s = ln.text.replace(/\s+/g, ' ').trim();
      /* 「5. 82」→「5.82」，「3. 1-5. 2」→「3.1-5.2」 */
      s = s.replace(/(\d)\s*\.\s*(\d)/g, '$1.$2');

      /* 行首不一定是中文：「γ-谷氨酰转肽酶」是标准写法，报告上还常有
         *、△、↑ 这类标记。只认中文开头会把这些整行跳过，
         这一项就在结果里凭空消失，用户完全看不出来少了什么。 */
      var nm = s.match(/^((?:[A-Za-z][\-\s]{0,2})?(?:[\u0391-\u03C9αβγδμ°↑↓*△▲※#]|[\u4e00-\u9fa5])[\u4e00-\u9fa5\-－\s]*[\u4e00-\u9fa5])/);
      if (!nm) continue;
      var name = nm[1].replace(/\s+/g, '');
      if (name.length < 2) continue;
      if (NOISE.test(name)) continue;

      var rest = s.slice(nm[0].length).trim();
      if (!rest) continue;

      var toks = rest.split(/\s{2,}/).map(function (t) { return t.trim(); }).filter(Boolean);
      if (toks.length < 2) toks = rest.split(/\s+/).filter(Boolean);

      /* 找结果：跳过含字母的「缩写」token。
         OCR 常把 GLU 认成 G6LU、BMI 认成 BM1，直接取第一个数字会取到 6 或 1。 */
      var value = null;
      for (var k = 0; k < toks.length; k++) {
        var t = toks[k];
        if (QUAL.test(t)) { value = t; break; }
        if (/[A-Za-z]/.test(t) && /^[A-Za-z0-9\-_.\/%\^]+$/.test(t)) continue;
        if (/^\d+(?:\.\d+)?$/.test(t)) { value = t; break; }
      }
      if (!value) continue;

      /* 缩写列：全字母、且不含「/」（含斜杠的是单位 U/L、mmol/L）。
         名称认不出来时靠它兜底——「肌酝 Cr 78」里名字废了，
         但 Cr 是准的，一样能定位到肌酐。 */
      var abbr = null;
      for (var m = 0; m < toks.length; m++) {
        if (toks[m].indexOf('/') >= 0) continue;
        if (/^[A-Za-z][A-Za-z0-9\-]{1,7}$/.test(toks[m])) { abbr = toks[m]; break; }
      }

      var rm = rest.match(RANGE);
      out.push({
        raw: name,
        abbr: abbr,
        value: value,
        ref: rm ? [parseFloat(rm[1]), parseFloat(rm[2])] : null,
        line: s
      });
    }
    return out;
  }

  /* ================= 主流程 ================= */

  /* 行解析结果 → 核对页用的 items：匹配指标库、补标准名与单位。
     OCR 与 PDF 文字层共用这一步——两条路只是「怎么拿到行」不同，
     「行怎么变成指标」必须是同一套规则，否则同一份报告从图片传
     和从 PDF 传会得到不同结论。 */
  function buildItems(raw) {
    return (raw || []).map(function (it) {
      var mid = HL.matchId({ name: it.raw, id: null });
      if (!mid && it.abbr) mid = HL.matchId({ name: it.abbr, id: null });
      var d = mid ? HL.dictById[mid] : null;
      return {
        raw: it.raw,
        abbr: it.abbr,
        value: it.value,
        ref: it.ref,
        id: mid,
        stdName: d ? d.name : null,
        unit: d ? d.unit : '',
        dictRef: d && d.ref ? d.ref : null,
        keep: !!mid
      };
    });
  }

  function readImage(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function () { res({ img: im, url: url }); };
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error('这张图打不开，换一张试试')); };
      im.src = url;
    });
  }

  /* file:// 下浏览器不允许 Worker 加载本地脚本，识别一定失败。
     这不是图片的问题——不明说，用户会以为是自己的照片拍得不好，
     反复重拍、反复失败。 */
  var AVAILABLE = location.protocol !== 'file:';

  function recognize(file, onStep) {
    var step = onStep || function () {};
    var o = null, worker = null, timer = null, bail = null;
    var gate = new Promise(function (_, rej) { bail = rej; });

    if (!AVAILABLE) {
      return Promise.reject(new Error(
        '识别功能需要从网址打开页面（http 或 https）。\n\n' +
        '你现在是直接双击打开本地文件，浏览器不允许这种方式启动识别引擎。' +
        '把整个文件夹传到任意静态托管（GitHub Pages 之类）就能用，' +
        '在手机上通过网址访问也没问题。\n\n' +
        '样板报告、就医、饮食、运动这些功能不受影响，可以照常看。'
      ));
    }

    var chain = loadTess()
      .then(function (T) {
        step('loading', 0.06, '正在加载识别引擎');
        return readImage(file).then(function (r) {
          o = r;
          step('prep', 0.12, '正在校正图片');
          var p = preprocess(r.img);
          return { T: T, p: p };
        });
      })
      .then(function (x) {
        step('ocr', 0.2, '正在识别文字');
        return x.T.createWorker('chi_sim', 1, {
          workerPath: BASE + 'worker.min.js',
          corePath: BASE,
          langPath: BASE,
          gzip: !nativeLang(),
          logger: function (m) {
            if (m.status === 'loading language traineddata') step('ocr', 0.2, '正在加载中文语言包');
            else if (m.status === 'initializing api') step('ocr', 0.24, '正在初始化');
            else if (m.status === 'recognizing text') step('ocr', 0.26 + m.progress * 0.6, '正在识别文字');
          }
        }).then(function (w) {
          worker = w;
          return w.recognize(x.p.canvas, {}, { text: true, blocks: true }).then(function (r) {
            return w.terminate().then(function () { worker = null; return { r: r, p: x.p }; });
          });
        });
      })
      .then(function (x) {
        step('parse', 0.9, '正在对照指标库');
        var lines = (x.r.data.lines || []).map(function (l) {
          return { text: l.text, bbox: l.bbox };
        });
        var raw = parseLines(lines);
        if (!raw.length && x.r.data.text) {
          /* 没有 line 数据时按行文本兜底 */
          raw = parseLines(x.r.data.text.split('\n').map(function (t) { return { text: t }; }));
        }

        var items = buildItems(raw);

        var hit = items.filter(function (i) { return i.id; }).length;
        return {
          items: items,
          hit: hit,
          total: items.length,
          angle: x.p.angle,
          conf: x.r.data.confidence,
          text: x.r.data.text || ''
        };
      })
      .then(function (res) {
        HL.ocr._last = res;          /* 调试与自动化测试用 */
        step('done', 1, '完成');
        return res;
      });

    /* 兜底：worker 一旦卡在加载资源上，Promise 可能永远不 settle
       （v1.2 的 .gz 文件名不匹配就是这么把用户锁死的）。
       给一个总超时和「取消」出口，保证用户永远不会被困在扫描遮罩里。 */
    var timeout = new Promise(function (_, rej) {
      timer = setTimeout(function () {
        rej(new Error(
          '识别超过 90 秒，已自动停止。\n\n' +
          '常见原因：照片太大、反光严重，或者识别引擎没能启动。' +
          '建议把报告平放、光线均匀、正对着只拍「项目名称 + 结果」那几列，再试一次；' +
          '也可以先点「先用样板报告体验」看看完整解读。'
        ));
      }, 90000);
    });

    activeRun = {
      cancel: function () {
        bail(new Error('已取消识别。'));
        if (worker) { try { worker.terminate(); } catch (e) {} }
      }
    };

    function finish() {
      if (timer) { clearTimeout(timer); timer = null; }
      activeRun = null;
      if (o && o.url) { try { URL.revokeObjectURL(o.url); } catch (e) {} }
      if (worker) { try { worker.terminate(); } catch (e) {} }
    }

    return Promise.race([chain, gate, timeout]).then(
      function (res) { finish(); return res; },
      function (e) { finish(); throw e; }
    );
  }

  /* ================= 核对界面 ================= */

  /* 名称去掉英文和括号后是否一致。
     「总胆固醇」和「总胆固醇 TC」是同一项，不该再写一遍「原文」。 */
  function sameName(raw, std) {
    if (!std) return false;
    function k(x) {
      return String(x).replace(/[（(][^)）]*[)）]/g, '').replace(/[A-Za-z\s\-]/g, '');
    }
    return k(raw) === k(std);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 未认出的行：给一个下拉，第一项是跳过，其余是全部指标。
     200 项只在真有未认出行时才生成，正常情况不增加 DOM。 */
  function dictOptions(sel) {
    var html = '<option value="">— 跳过这一行 —</option>';
    for (var i = 0; i < HL.dict.length; i++) {
      var d = HL.dict[i];
      html += '<option value="' + d.id + '"' + (d.id === sel ? ' selected' : '') + '>' +
        esc(d.name) + (d.unit ? '（' + esc(d.unit) + '）' : '') + '</option>';
    }
    return html;
  }

  function mountVerify(host, res, onConfirm, onCancel) {
    var rows = res.items.map(function (it, i) {
      it._i = i;
      return it;
    });

    function rowHtml(it) {
      var matched = !!it.id;
      return '<div class="vf-row' + (matched ? '' : ' bad') + '" data-i="' + it._i + '">' +
        '<div class="vf-info">' +
          (matched
            ? '<b>' + esc(it.stdName) + '</b>' +
              (sameName(it.raw, it.stdName)
                ? (it.unit ? '<span>' + esc(it.unit) + '</span>' : '')
                : '<span>原文：' + esc(it.raw) + '</span>')
            : '<b class="vf-unk">' + esc(it.raw) + '</b><span>没认出这一项</span>') +
        '</div>' +
        (matched
          ? '<input class="vf-val" inputmode="decimal" value="' + esc(it.value) + '">'
          : '<select class="vf-pick">' + dictOptions('') + '</select>') +
        '<button class="vf-del" title="删掉这一行">×</button>' +
      '</div>';
    }

    var unmatched = rows.filter(function (r) { return !r.id; }).length;

    /* PDF 的抬头里通常印着年龄和性别，解析时顺手抓出来预填。
       抓不到就空着——不猜。预填了必须在页面上说明来源，
       不能让用户以为是自己填过的。 */
    var pf = (res && res.profile) || {};
    var preAge = (typeof pf.age === 'number' && pf.age >= 10 && pf.age <= 100) ? pf.age : null;
    var preSex = (pf.sex === '男' || pf.sex === '女') ? pf.sex : null;
    var metaTip = '年龄和性别决定参考区间和心率上限，必须填。';
    if (preAge != null || preSex != null) {
      var got = [], miss = [];
      (preAge != null ? got : miss).push('年龄');
      (preSex != null ? got : miss).push('性别');
      metaTip = got.join('、') + '已从报告抬头读取，<b>请对着报告确认一遍</b>。' +
        (miss.length ? miss.join('和') + '没读到，需要手动填。' : '');
    }

    host.innerHTML =
      '<div class="vf">' +
        '<div class="vf-hd">' +
          '<h1>认出 <em>' + res.total + '</em> 项，请对着报告核对</h1>' +
          '<p>' +
            (unmatched
              ? '其中 <b>' + unmatched + '</b> 项没对上指标库，已标红。' +
                '可以给它指定是哪一项，也可以直接跳过。'
              : '全部对上了指标库。') +
            '<b>数字错一个，结论就会反</b>——尤其小数点位置，请逐行看一眼。' +
          '</p>' +
        '</div>' +

        '<div class="vf-meta' + (preAge != null || preSex != null ? ' pre' : '') + '">' +
          '<label><span>年龄</span><input id="vfAge" type="number" inputmode="numeric" min="10" max="100" placeholder="必填"' +
            (preAge != null ? ' value="' + preAge + '"' : '') + '></label>' +
          '<label><span>性别</span><select id="vfSex">' +
            '<option value="男"' + (preSex === '男' ? ' selected' : '') + '>男</option>' +
            '<option value="女"' + (preSex === '女' ? ' selected' : '') + '>女</option>' +
          '</select></label>' +
        '</div>' +
        '<p class="vf-meta-tip">' + metaTip + '</p>' +

        '<div class="vf-list">' + rows.map(rowHtml).join('') + '</div>' +

        '<button class="btn btn-main" id="vfOk">核对完了，开始分析</button>' +
        '<button class="btn btn-ghost" id="vfBack">换一张图重新识别</button>' +
        '<p class="vf-foot">识别在本机完成，图片不会离开这台设备。</p>' +
      '</div>';

    /* 删行 */
    host.querySelectorAll('.vf-del').forEach(function (b) {
      b.addEventListener('click', function () {
        var row = b.closest('.vf-row');
        var it = rows[+row.dataset.i];
        it.keep = false;
        row.remove();
      });
    });

    /* 未认出的行：选了下拉就转成正常行 */
    host.querySelectorAll('.vf-pick').forEach(function (sel) {
      sel.addEventListener('change', function () {
        if (!sel.value) return;
        var row = sel.closest('.vf-row');
        var it = rows[+row.dataset.i];
        var d = HL.dictById[sel.value];
        it.id = sel.value;
        it.stdName = d.name;
        it.unit = d.unit;
        it.keep = true;
        row.classList.remove('bad');
        row.querySelector('.vf-info').innerHTML =
          '<b>' + esc(d.name) + '</b><span>原文：' + esc(it.raw) + '</span>';
        var inp = document.createElement('input');
        inp.className = 'vf-val';
        inp.setAttribute('inputmode', 'decimal');
        inp.value = it.value;
        sel.replaceWith(inp);
      });
    });

    host.querySelector('#vfBack').addEventListener('click', function () {
      if (onCancel) onCancel();
    });

    host.querySelector('#vfOk').addEventListener('click', function () {
      var age = parseInt(host.querySelector('#vfAge').value, 10);
      if (!age || age < 10 || age > 100) {
        host.querySelector('#vfAge').focus();
        window.alert('请先填年龄。参考区间和心率上限都要用它。');
        return;
      }
      var sex = host.querySelector('#vfSex').value;

      var out = [];
      var seen = {};
      host.querySelectorAll('.vf-row').forEach(function (row) {
        var it = rows[+row.dataset.i];
        if (!it.keep || !it.id) return;
        if (seen[it.id]) return;               /* 同一项被认成两行时只留第一条 */
        var inp = row.querySelector('.vf-val');
        if (!inp) return;
        var v = String(inp.value).trim();
        if (!v) return;
        /* 「2+」「±」这类定性结果绝不能 parseFloat：
           parseFloat('2+') 得 2，定性值变成数字，判定直接失效——
           尿蛋白 2+ 会被当成「2」判正常，最该报的一项就这么没了。
           所以只有整串都是数字才转数值。 */
        var val = /^-?\d+(?:\.\d+)?$/.test(v) ? parseFloat(v) : v;
        var d = HL.dictById[it.id];
        seen[it.id] = 1;
        out.push({
          id: it.id,
          name: d.name,
          value: val,
          unit: d.unit || '',
          ref: d.ref || it.ref || null
        });
      });

      if (!out.length) {
        window.alert('一项都没留下，没法分析。请至少保留一项。');
        return;
      }

      onConfirm({
        profile: { age: age, sex: sex },
        items: out,
        imaging: []
      });
    });
  }

  HL.ocr = {
    available: AVAILABLE,
    recognize: recognize,
    cancel: function () { if (activeRun) activeRun.cancel(); },
    mountVerify: mountVerify,
    /* 测试用 */
    _parseLines: parseLines,
    _buildItems: buildItems,
    _preprocess: preprocess
  };
})();
