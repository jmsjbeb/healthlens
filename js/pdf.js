/* ============================================================
   pdf.js — PDF 报告 → 结构化指标（全在本机跑，不上传）

   为什么要有这一层
   ----------------
   体检中心 App 导出的报告九成是 PDF。让用户「先截成图」是产品里
   最大的一处摩擦：截图会丢精度、会截错页、会把表格拆散。
   而 PDF 里往往带着完整文字层——那是原文，不存在认错字，
   比 OCR 准得多。

   两条路径
   --------
     ① 有文字层（电子报告）：抽文字 → 按坐标聚行 → 复用 ocr.js 的行解析
     ② 没有文字层（扫描件）：页面渲染成 canvas → 交给 HL.ocr.recognize
   判据是「所有页加起来抽到的字数」。医院导出的扫描件 PDF 文字层通常
   只有页码或水印，字数远小于 50。

   为什么必须懒加载
   ----------------
   pdf.min.js 320KB + worker 1.09MB。首屏多这 1.4MB，弱网下就是
   多等两三秒，而 99% 的首次访问根本不上传 PDF。所以只有用户
   真的选了 PDF 才注入 script。

   为什么不能跳过核对页
   --------------------
   文字层虽然准，但 PDF 表格经常是「结果」和「参考区间」分列排的，
   抽取顺序一乱，数字就会串行——把别人的参考区间配到这一项上，
   结论直接反。所以这里只负责把行还原出来，认项、配对仍然走
   ocr.js 的核对页，让人看一眼。
   ============================================================ */
(function () {
  var HL = window.HL = window.HL || {};

  var BASE = 'vendor/pdf/';
  var loading = null;

  /* 扫描件最多识别几页：一页 OCR 约 3–6 秒，全册几十页会让人以为卡死。
     检验结果通常在 2–4 页，取前 4 页覆盖绝大多数报告。 */
  var OCR_MAX_PAGES = 4;

  /* ================= 库懒加载 ================= */
  function loadLib() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (loading) return loading;
    loading = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = BASE + 'pdf.min.js';
      s.onload = function () {
        if (!window.pdfjsLib) {
          loading = null;
          rej(new Error('PDF 解析库加载失败，请刷新页面后重试'));
          return;
        }
        try {
          /* worker 必须指向本地文件：走 CDN 等于把报告内容发出去，
             而且断网就彻底不能用了 */
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = BASE + 'pdf.worker.min.js';
        } catch (e) { /* worker 配不上时 pdf.js 会退回主线程，仍能用 */ }
        res(window.pdfjsLib);
      };
      s.onerror = function () {
        loading = null;
        rej(new Error('PDF 解析库加载失败，请检查网络后重试'));
      };
      document.head.appendChild(s);
    });
    return loading;
  }

  /* ================= 文件 → ArrayBuffer ================= */
  function readBuf(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = function () { rej(new Error('文件读不出来，可能没下载完整')); };
      fr.readAsArrayBuffer(file);
    });
  }

  /* ================= 文字层 → 行 =================
     pdf.js 给的是「片段」而不是「行」：一行检验结果会被拆成
     「丙氨酸氨基转移酶」「ALT」「68」「U/L」「7-40」五六个片段。
     不按坐标聚行，后面的解析器（按行找「名称 + 数值 + 区间」）全废。

     聚法：transform[5] 是基线 y，同一行的片段 y 几乎相同（误差 <3）；
     组内按 transform[4]（x）从左到右排。PDF 的 y 轴朝上，所以要降序。 */
  function itemsToLines(items) {
    var rows = [];
    (items || []).forEach(function (it) {
      var str = it && it.str;
      if (!str || !String(str).trim()) return;
      var tr = it.transform || [];
      var x = tr[4] || 0, y = tr[5] || 0;
      var row = null;
      for (var i = 0; i < rows.length; i++) {
        if (Math.abs(rows[i].y - y) <= 3) { row = rows[i]; break; }
      }
      if (!row) {
        row = { y: y, parts: [] };
        rows.push(row);
      }
      row.parts.push({ x: x, s: String(str) });
    });

    rows.sort(function (a, b) { return b.y - a.y; });
    return rows.map(function (r) {
      r.parts.sort(function (a, b) { return a.x - b.x; });
      /* 用空格连接：中文名被拆成单字时，解析器会再把空格去掉；
         而「5.」+「82」这种数字被拆开的情况，解析器也专门处理了 */
      return { text: r.parts.map(function (p) { return p.s; }).join(' ') };
    });
  }

  /* 抽一页的文字片段 */
  function pageText(doc, no) {
    return doc.getPage(no).then(function (page) {
      return page.getTextContent().then(function (tc) {
        return { page: page, items: tc.items || [] };
      });
    });
  }

  /* ================= 扫描件：页面 → 图片 ================= */
  function pageToBlob(page, scale) {
    return new Promise(function (res, rej) {
      var vp = page.getViewport({ scale: scale || 2 });
      var cv = document.createElement('canvas');
      cv.width = Math.round(vp.width);
      cv.height = Math.round(vp.height);
      var cx = cv.getContext('2d');
      if (!cx) { rej(new Error('这台设备画不出 PDF 页面，换个浏览器试试')); return; }
      /* 白底：PDF 页面本身是透明的，直接画会得到黑底，OCR 全废 */
      cx.fillStyle = '#fff';
      cx.fillRect(0, 0, cv.width, cv.height);
      page.render({ canvasContext: cx, viewport: vp }).promise.then(function () {
        if (cv.toBlob) {
          cv.toBlob(function (b) {
            if (!b) { rej(new Error('PDF 页面转图片失败')); return; }
            res(new File([b], 'pdf-page-' + page.pageNumber + '.png', { type: 'image/png' }));
          }, 'image/png');
        } else {
          rej(new Error('这台设备不支持 PDF 转图片'));
        }
      }, rej);
    });
  }

  /* ================= 错误话术 =================
     pdf.js 抛的是英文异常，直接显示给用户等于没提示。 */
  function friendly(e) {
    var n = (e && (e.name || '')) + '';
    if (n === 'PasswordException') return new Error('这份 PDF 有密码保护，先解除密码再上传');
    if (n === 'InvalidPDFException') return new Error('文件读不出来，可能没下载完整——重新下载一份再试');
    if (n === 'MissingPDFException') return new Error('这个文件不是有效的 PDF');
    if (n === 'UnexpectedResponseException') return new Error('PDF 读取被中断，请重试');
    var m = (e && e.message) || '';
    if (/password/i.test(m)) return new Error('这份 PDF 有密码保护，先解除密码再上传');
    return new Error(m || 'PDF 打不开，换一份试试');
  }

  /* ================= 抬头信息：年龄 / 性别 =================
     核对页的年龄和性别是必填项（参考区间、心率上限都靠它），
     可报告抬头本来就印着「性别：男　年龄：45」。
     让用户再敲一遍、还得回 PDF 里翻，是把机器该干的活推给人。

     但只认明确标注的：抓不到就返回空，**绝不从名字猜性别**。
     猜错会让整套参考区间和心率上限偏掉，比空着让他自己填更糟。 */
  var AGE_RE = /年\s*龄\s*[：:\s]*(\d{1,3})/;
  var AGE_ALT = /^(\d{2,3})\s*岁/;
  var SEX_RE = /性\s*别\s*[：:\s]*([男女])/;

  function pickProfile(lines) {
    var out = { age: null, sex: null };
    var scan = (lines || []).slice(0, 40);      /* 抬头都在前几十行 */
    for (var i = 0; i < scan.length; i++) {
      var t = String((scan[i] && scan[i].text) || '');
      if (out.age == null) {
        var a = AGE_RE.exec(t) || AGE_ALT.exec(t.replace(/^\s+/, ''));
        if (a) {
          var n = parseInt(a[1], 10);
          /* 10–100 之外一律不认：多半是编号、批号或参考值，不是年龄 */
          if (n >= 10 && n <= 100) out.age = n;
        }
      }
      if (out.sex == null) {
        var s = SEX_RE.exec(t);
        if (s) out.sex = s[1];
      }
      if (out.age != null && out.sex != null) break;
    }
    return out;
  }

  /* ================= 主流程 =================
     onStage(stage, p, label)：stage = 'load' | 'read' | 'ocr' | 'parse'
     返回 { items, total, hit, source, pages, note, profile } */
  function parse(file, onStage) {
    var step = onStage || function () {};
    var lib = null, doc = null, pages = 0;

    step('load', 0.04, '正在加载 PDF 解析器');

    return loadLib().then(function (l) {
      lib = l;
      step('read', 0.1, '正在读取 PDF');
      return readBuf(file);
    }).then(function (buf) {
      /* 传副本：pdf.js 会「接管」这个 ArrayBuffer，同一个 buffer
         被 worker 转移所有权后就不能再读了 */
      return lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
    }).then(function (d) {
      doc = d;
      pages = d.numPages;
      if (!pages) throw new Error('这份 PDF 里没有页面');

      /* 逐页抽文字。检验结果常常在第 2–3 页，只看第一页会漏掉大半。 */
      var lines = [];
      var seq = Promise.resolve();
      var donePages = 0;
      for (var i = 1; i <= pages; i++) {
        (function (no) {
          seq = seq.then(function () {
            return pageText(doc, no).then(function (r) {
              lines = lines.concat(itemsToLines(r.items));
              donePages++;
              step('read', 0.1 + 0.5 * (donePages / pages),
                '正在读取第 ' + donePages + ' / ' + pages + ' 页');
            }, function () {
              /* 单页抽不出来不该让整份失败：扫描件里常混着空白页 */
              donePages++;
            });
          });
        })(i);
      }

      return seq.then(function () { return lines; });
    }).then(function (lines) {
      var chars = lines.reduce(function (n, l) { return n + (l.text ? l.text.length : 0); }, 0);

      /* 文字层够多 → 走文字路径，不惊动 OCR 引擎 */
      if (chars >= 50) {
        step('parse', 0.75, '正在对照指标库');
        var raw = HL.ocr._parseLines(lines);
        var items = HL.ocr._buildItems(raw);
        return {
          items: items,
          total: items.length,
          hit: items.filter(function (x) { return x.id; }).length,
          source: 'pdf-text',
          pages: pages,
          chars: chars,
          profile: pickProfile(lines),
          note: 'PDF 文字层直接读取，没有经过图片识别'
        };
      }

      /* 文字层几乎是空的 → 扫描件，渲染成图交给 OCR */
      if (!HL.ocr || !HL.ocr.recognize) throw new Error('这份 PDF 是扫描件，但识别引擎没加载成功');
      if (HL.ocr.available === false) {
        throw new Error('这份 PDF 是扫描件（没有文字层），需要在服务器环境下打开才能识别');
      }

      step('ocr', 0.55, '这份 PDF 是扫描件，正在转成图片');
      var maxNo = Math.min(pages, OCR_MAX_PAGES);
      var merged = [], seen = {}, ocrFail = 0;

      var chain = Promise.resolve();
      for (var p = 1; p <= maxNo; p++) {
        (function (no) {
          chain = chain.then(function () {
            return doc.getPage(no).then(function (page) {
              return pageToBlob(page, 2).then(function (blob) {
                return HL.ocr.recognize(blob, function (stage, pp, label) {
                  /* 把单页进度折算到总进度：0.55 → 0.95 */
                  var span = 0.95 - 0.55;
                  step('ocr', 0.55 + span * ((no - 1 + (pp || 0)) / maxNo), label);
                }).then(function (res) {
                  (res.items || []).forEach(function (it) {
                    if (!it.id || seen[it.id]) return;
                    seen[it.id] = 1;
                    merged.push(it);
                  });
                });
              });
            }, function () {
              ocrFail++;
            });
          });
        })(p);
      }

      return chain.then(function () {
        step('parse', 0.97, '正在对照指标库');
        return {
          items: merged,
          total: merged.length,
          hit: merged.filter(function (x) { return x.id; }).length,
          source: 'pdf-ocr',
          pages: pages,
          scannedPages: maxNo,
          ocrFail: ocrFail,
          /* 扫描件没有文字层可抓抬头，空着让用户自己填，不猜 */
          profile: { age: null, sex: null },
          note: '这份 PDF 没有文字层（扫描件），已转成图片识别前 ' + maxNo + ' 页'
        };
      });
    }).catch(function (e) {
      throw friendly(e);
    }).then(function (out) {
      try { if (doc && doc.destroy) doc.destroy(); } catch (e) { /* 释放失败不影响结果 */ }
      return out;
    });
  }

  HL.pdf = {
    available: true,        /* 库随包本地提供；真正失败会在 parse 的 reject 里说清楚 */
    parse: parse,
    /* 测试用 */
    _itemsToLines: itemsToLines,
    _pickProfile: pickProfile
  };
})();
