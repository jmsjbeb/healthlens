/* ============================================================
   康鉴 HealthLens · 分析引擎
   输入：结构化报告（HL.sample 或解析器产出）
   输出：健康域评分、星级排序的关注项、真假异常、科室导航、
        饮食/运动/复查计划、形体变化推算
   ============================================================ */
window.HL = window.HL || {};

HL.engine = (function () {
  'use strict';

  /* 指标 → 解读规则：从字典自动推导。
     原来是一张 20 条的手写表，新增指标必须回来改代码；
     现在只要在 dict.js 里给该项写上 rule:'xxx' 就自动生效。 */
  var MAP = {};
  (HL.dict || []).forEach(function (d) { if (d.rule) MAP[d.id] = d.rule; });

  /* 严重度 → 扣分 */
  var DEDUCT = { 3: 25, 2: 15, 1: 7, 0: 0 };

  /* 就诊分趟：空腹抽血的项目凑一趟，检查类的凑另一趟
     —— 提示语按实际科室动态生成，不写死科室名 */
  var TRIP = {
    cardio: 1, endo: 1, gi: 1, nephro: 1,
    resp: 2, eye: 2, uro: 2, gyn: 2, surg: 2, ortho: 2
  };
  var TRIP_NAME = { 1: '第 1 趟 · 空腹抽血日', 2: '第 2 趟 · 检查类，不用空腹' };
  function tripTip(no, names) {
    var who = names.join('、');
    if (no === 1) return who + ' 这几科都要空腹抽血，同一天上午一次抽完，不用跑两趟。';
    return who + ' 都是现场检查，不用空腹，同一天下午约，中间隔一小时即可。';
  }

  /* 星级并入规则表 —— 注意：必须每次分析重算。
     starMeta.s 可以是一个数字，也可以是一个吃 ctx 的函数，
     这样「空腹血糖 7.2」和「空腹血糖 5.2」能拿到不同星级。 */
  function applyStars(ctx) {
    Object.keys(HL.rules).forEach(function (k) {
      var r = HL.rules[k];
      var m = HL.starMeta[k];
      var sv;
      if (!m) sv = r.benign ? 0 : 1;
      else sv = typeof m.s === 'function' ? m.s(ctx) : m.s;
      r.stars = sv;
      r.starWhy = m ? HL.tpl.render(m.why || '', ctx) : '';
      /* 严重度也跟星级走。之前 severity 是写死的常量，
         导致「空腹血糖 7.2」和「空腹血糖 5.2」扣一样的分——
         第二份报告反而比第一份分数高。 */
      r.severity = sv >= 7 ? 3 : sv >= 5 ? 2 : sv >= 3 ? 1 : 0;
    });
  }

  /* ---------- 工具 ---------- */
  /* 定性结果：尿蛋白、尿潜血、尿糖这类没有参考区间的项，
     值是「阴性 / ± / 1+ / 2+ / 阳性」。
     原来 ref 为 null 一律判 normal —— 尿蛋白 2+ 会被当成正常，
     这是整个引擎最不该漏的一类信号。 */
  function qualStatus(v) {
    if (v == null) return 'normal';
    var s = String(v).trim();
    if (!s) return 'normal';
    if (/^(±|弱阳性|微量|trace|tr)$/i.test(s)) return 'low';
    if (/[+＋]|阳性|positive|pos/i.test(s)) return 'high';
    return 'normal';                     /* 阴性 / - / 未见 / 正常 */
  }

  /* 定性阳性没有「偏离百分之多少」，按等级给星：
     ± → 2 星，+ / 1+ / 阳性 → 3 星，2+ 及以上 → 4 星 */
  function qualStars(v) {
    var s = String(v == null ? '' : v);
    if (/^(±|弱阳性|微量|trace|tr)$/i.test(s.trim())) return 2;
    var m = s.match(/(\d)\s*[+＋]/);
    if (m) return Math.min(4, 2 + parseInt(m[1], 10));
    if (/[+＋]|阳性|positive|pos/i.test(s)) return 3;
    return 0;
  }

  /* 参考区间归一化。
     字典和样板里写的是 [lo, hi] 数组，但实际传入的报告数据格式不止一种：
       OCR 抽出 "7-40"、模型抽取给 "7–40"、手工录入写 "<40" 或 ">7"、
       或者干脆给 {lo:7, hi:40}。
     原来只认数组，字符串会让 it.ref[1] 变成 '-'，比较结果为 NaN，
     于是「谷丙转氨酶 60（参考 7-40）」被判成正常——异常静默消失。
     所以这里统一转成 [lo|null, hi|null]，转不出来就返回 null 走定性判读。 */
  function normRef(ref) {
    if (ref == null) return null;

    function num(x) {
      if (x == null) return null;
      if (typeof x === 'number') return isFinite(x) ? x : null;
      var m = String(x).match(/-?\d+(\.\d+)?/);
      return m ? parseFloat(m[0]) : null;
    }

    if (Object.prototype.toString.call(ref) === '[object Array]') {
      var a = num(ref[0]), b = num(ref[1]);
      return (a == null && b == null) ? null : [a, b];
    }
    if (typeof ref === 'object') {
      var lo0 = num(ref.lo != null ? ref.lo : ref.min != null ? ref.min : ref.low);
      var hi0 = num(ref.hi != null ? ref.hi : ref.max != null ? ref.max : ref.high);
      return (lo0 == null && hi0 == null) ? null : [lo0, hi0];
    }

    var s = String(ref).replace(/[，,]/g, ' ').replace(/[–—~～至]/g, '-').trim();
    if (!s) return null;
    var m;
    if ((m = s.match(/^[<≤]\s*(-?[\d.]+)/))) return [null, parseFloat(m[1])];
    if ((m = s.match(/^[>≥]\s*(-?[\d.]+)/))) return [parseFloat(m[1]), null];
    if ((m = s.match(/^(-?[\d.]+)\s*-\s*(-?[\d.]+)$/))) return [parseFloat(m[1]), parseFloat(m[2])];
    if ((m = s.match(/^(-?[\d.]+)$/))) return [parseFloat(m[1]), parseFloat(m[1])];
    return null;
  }

  /* ============================================================
     单位换算（英制 → 字典单位）
     ------------------------------------------------------------
     字典里的参考区间是按国内报告的单位写的（HGB g/L、血脂 mmol/L）。
     但英制单位的报告并不罕见：HGB 15.4 g/dL、血糖 100 mg/dL、
     胆固醇 200 mg/dL。BUG-1 修好字典兜底之后，这些值会被直接拿去
     和字典区间比——15.4 对 130–175 会判成「严重偏低」，比修复前的
     「静默判正常」更危险：方向变了，但都是错。

     规则：只在报告单位明确写成英制时换算；单位缺失或已经是字典
     单位一律不动。换算后原地改 value/unit，并留下 _rawValue /
      _rawUnit / _unitConv 三个痕迹，界面要把「15.4 g/dL = 154 g/L」
     显示出来——不能悄悄改用户刚核对过的数字。
     表里没有的指标 / 单位原样放行（10^9/L 这类本来就一致）。
     ============================================================ */
  var UNIT_CONV = {
    hgb: { 'g/dl': { f: 10, to: 'g/L' } },
    fbg: { 'mg/dl': { f: 1 / 18, to: 'mmol/L' } },
    tc: { 'mg/dl': { f: 1 / 38.67, to: 'mmol/L' } },
    hdl: { 'mg/dl': { f: 1 / 38.67, to: 'mmol/L' } },
    ldl: { 'mg/dl': { f: 1 / 38.67, to: 'mmol/L' } },
    tg: { 'mg/dl': { f: 1 / 88.57, to: 'mmol/L' } },
    uric: { 'mg/dl': { f: 59.48, to: 'μmol/L' } },
    cr: { 'mg/dl': { f: 88.4, to: 'μmol/L' } }
  };

  /* 单位比较只做大小写与空白归一：'g/dL' / 'G/DL' / 'mg/dl ' 都认 */
  function unitKey(u) {
    return String(u == null ? '' : u).toLowerCase().replace(/\s+/g, '');
  }

  /* 把一项换算到字典单位。原地改并留痕，返回是否发生了换算。
     值不是数字（定性项）或单位对不上时原样返回。 */
  function convUnit(it) {
    if (!it || it.value == null) return false;
    var map = UNIT_CONV[it.id];
    if (!map) return false;
    var c = map[unitKey(it.unit)];
    if (!c) return false;
    var v = typeof it.value === 'number' ? it.value : parseFloat(it.value);
    if (!isFinite(v)) return false;
    var from = String(it.unit);
    it._rawValue = it.value;
    it._rawUnit = from;
    it.value = Math.round(v * c.f * 1000) / 1000;
    it.unit = c.to;
    it._unitConv = from + '→' + c.to;
    return true;
  }

  function statusOf(it) {
    if (it.status && it.status !== 'text') return it.status;
    if (it.value == null) return 'normal';
    var ref = normRef(it.ref);
    if (!ref) return qualStatus(it.value);
    /* 值本身不是数字（「阴性」「未见异常」），走定性判读，
       否则 '阴性' > 40 这种比较永远是 false，又变回静默正常 */
    var v = typeof it.value === 'number' ? it.value : parseFloat(it.value);
    if (!isFinite(v)) return qualStatus(it.value);
    var lo = ref[0], hi = ref[1];
    if (hi != null && v > hi) return 'high';
    if (lo != null && v < lo) return 'low';
    return 'normal';
  }

  function fmt(n, d) {
    if (n == null) return '—';
    return (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toString();
  }

  /* ============================================================
     家族兜底：把「异常但没有专属规则」的项讲明白
     ------------------------------------------------------------
     星级按偏离幅度定，不拍脑袋：
       < 10%  不单独列卡（进「轻度偏离」折叠区）
       10–25% 2 星
       25–50% 3 星
       > 50%  4 星
     同一家族的多项合成一张卡，避免 200 项铺满屏幕。
     ============================================================ */
  function devOf(it) {
    if (!it.ref || it.value == null) return 0;
    var lo = it.ref[0], hi = it.ref[1];
    if (it._status === 'high' && hi) return Math.round((it.value - hi) / hi * 100);
    /* 下界是 0 或负数时（骨密度 T 值下界 −1.0），
       百分比偏离没有意义——(−1 − (−1.8)) / (−1) 会算出 −80% */
    if (it._status === 'low' && lo > 0) return Math.round((lo - it.value) / lo * 100);
    return 0;
  }

  /* 短名：优先用英文缩写（AST / GGT / TC），否则去掉括号说明。
     同一张卡里塞三四个全名会把版面撑爆 */
  function shortName(n) {
    var s = String(n == null ? '' : n);
    var m = s.match(/^(.*?)[\s（]+([A-Za-z][\w#%\-\.\/:]*)\s*$/);
    if (m && m[2].length <= 10) return m[2];
    return s.split('（')[0];
  }

  function famWhy(F, it, dev) {
    var t = it._status === 'low' ? F.whyLow : F.whyHigh;
    if (!t) return '';
    return HL.tpl.render(t, {
      /* 字典里也查不到的自定义项，name 仍可能为空——这里不能再假设它有值 */
      name: String(it.name == null ? '' : it.name).split('（')[0],
      v: it.value, u: it.unit || '',
      hi: it.ref ? it.ref[1] : null,
      lo: it.ref ? it.ref[0] : null,
      /* 定性项（+ / 2+）没有偏离百分比，给 null，
         否则文案会渲染出「高于参考范围 0%」 */
      over: (it._status === 'high' && it.ref) ? dev : null,
      under: (it._status === 'low' && it.ref) ? dev : null
    });
  }

  function famFinding(g, stars, whyFn) {
    var F = g.F;
    var parts = g.items.map(function (x) {
      return {
        it: x.it, dev: x.dev, st: x.it._status,
        name: shortName(x.it.name),
        v: x.it.value, u: x.it.unit || ''
      };
    });
    var title = F.label + '（' + parts.map(function (p) { return p.name; }).join(' / ') + '）';

    var headline;
    if (parts.length === 1) {
      var p0 = parts[0];
      headline = p0.v + (p0.u ? ' ' + p0.u : '') + '，' +
        (p0.st === 'low' ? '低于' : '高于') + '参考范围' +
        (p0.dev ? ' ' + p0.dev + '%' : '');
    } else {
      headline = parts.length + ' 项同族指标同时偏离，指向同一件事';
    }

    return {
      ruleId: 'fam:' + g.fam, famKey: g.fam, famAuto: true,
      rule: {
        name: title, domain: F.domain, headline: headline,
        detail: parts.map(function (p) { return whyFn(F, p.it, p.dev); }).join('\n\n'),
        actions: F.advice, dept: F.dept || null,
        recheck: F.recheck, grade: F.grade || '实测', fam: g.fam
      },
      sources: parts.map(function (p) { return p.name + ' ' + p.v; }),
      severity: stars >= 4 ? 3 : stars >= 3 ? 2 : 1,
      benign: false, stars: stars, noDeduct: false,
      domain: F.domain, extra: null,
      starWhy: '这类指标没有单独的解读卡片，星级按偏离幅度算：10–25% 给 2 星，25–50% 给 3 星，超过 50% 给 4 星。' +
        '本次偏离 ' + g.maxDev + '%，' + (parts.length > 1 ? parts.length + ' 项同族指标一起偏离，' : '') +
        '所以是 ' + stars + ' 星。它排在有专属卡片的项目之后，是因为这类偏离通常先复查确认、再判断，不需要马上跑医院。'
    };
  }

  /* AI 结构化摘要：规则卡和兜底卡共用同一段文字，保证口径一致。
     没有结构化数据（未配模型 / 调用失败 / 正常项）时返回空串，行为与之前完全一致。 */
  function imgStructLine(st, partsOnly) {
    if (!st) return '';
    var parts = [];
    if (st.margin) parts.push('边界' + st.margin);
    if (st.calcification) parts.push('钙化' + st.calcification);
    if (st.size_mm) parts.push('大小 ' + st.size_mm);
    var body = parts.join('、');
    /* 规则卡（partsOnly）：原文已经讲清了印象，只补「尺寸/边界/钙化」这类
       原文里散落、不容易一眼看到的量化信息；没有就不追加，避免重复。 */
    if (partsOnly && !body) return '';
    if (!body && !st.impression) return '';
    /* 详情按 \n\n 分段，单个 \n 会被吞掉，所以压成一段、用分号连接 */
    var s = '\n\n';
    if (body) s += 'AI 结构化：' + body;
    if (st.impression) s += (body ? '；影像印象：' : 'AI 影像印象：') + st.impression;
    s += '（由 AI 从影像描述中提取，供参考，以报告原件为准。）';
    return s;
  }

  function imgFinding(im, F, d) {
    var txt = String(im.finding || '');
    /* AI 结构化结果（img.js 回填）：只用来把「甲状腺右叶结节 6×4mm」
       这种尺寸/边界讲清楚，不参与判定。没有就完全退回原文，行为与之前一致。 */
    var st = im.struct || null;
    var head = txt.length > 34 ? txt.slice(0, 34) + '…' : (txt || '影像报告有异常描述');
    if (st && st.organ && st.type && st.size_mm) {
      head = [st.organ, st.location, st.type].filter(Boolean).join('') + ' ' + st.size_mm;
    }
    var extra = imgStructLine(st);
    return {
      ruleId: 'img:' + im.id, famKey: d ? d.fam : '', famAuto: true,
      rule: {
        name: im.name, domain: F.domain,
        headline: head,
        detail: F.note + (txt ? '\n\n报告原文：' + txt : '') + extra,
        actions: F.advice, dept: F.dept || null,
        recheck: F.recheck, grade: '实测', fam: d ? d.fam : ''
      },
      sources: [im.name],
      severity: 1, benign: false, stars: 2, noDeduct: false,
      domain: F.domain, extra: null,
      starWhy: '这项没有专属解读卡片，星级按「需要复查」给 2 星——影像发现的价值在于留底对比，通常按报告建议的间隔复查即可。'
    };
  }

  /* 影像项按名称/描述猜家族。顺序很重要：
     先判更具体的（胆囊在肝胆之前，乳腺在通用之前） */
  var IMG_HINT = [
    [/甲状腺/, 'imgThyroid'],
    [/乳腺/, 'imgBreast'],
    [/子宫|卵巢|附件|宫颈|妇科/, 'imgGyn'],
    [/前列腺/, 'imgProstate'],
    [/胆囊|胆管|胆结石|胆息肉/, 'imgGall'],
    [/颈动脉|斑块|血管|内膜/, 'imgVessel'],
    [/心电|ST段|T波|心律/, 'imgEcg'],
    [/肾|输尿管|膀胱|泌尿|结石/, 'imgKidney'],
    [/肝|脂肪肝|胰|脾/, 'imgLiver'],
    [/肺|胸片|胸部|结节影|纤维灶/, 'imgLung'],
    [/胃|肠|食管|息肉|糜烂/, 'imgGi'],
    [/鼻|咽|喉|耳|听力|鼓膜/, 'imgEnt'],
    [/骨|颈|腰椎|脊柱|关节|骨质/, 'bone'],
    [/囊肿|息肉|增生|结节|钙化/, 'imgBenign']
  ];

  function guessImgFam(im) {
    var t = String((im.name || '') + ' ' + (im.finding || '') + ' ' + (im.panel || ''));
    for (var i = 0; i < IMG_HINT.length; i++) {
      if (IMG_HINT[i][0].test(t) && HL.fam[IMG_HINT[i][1]]) return IMG_HINT[i][1];
    }
    return null;
  }

  function refText(it) {
    if (!it.ref) return '—';
    var lo = it.ref[0], hi = it.ref[1];
    if (lo === 0 && hi != null) return '< ' + hi;
    if (lo != null && hi != null) return lo + ' – ' + hi;
    if (lo != null) return '> ' + lo;
    return '—';
  }

  /* ---------- 模板上下文 ----------
     把「这份报告里有什么」整理成一张可查的表，
     文案里的 {hcy.v} 就从这里取值。
     换一份报告，这张表跟着变，文案不用改一个字。
  ------------------------------------------------------------- */
  function buildCtx(report) {
    var ctx = {};
    var items = report.items || [];
    var p = report.profile || {};
    var male = p.sex === '男';

    items.forEach(function (it) {
      if (it.value == null) return;
      var st = it._status || statusOf(it);
      var c = { v: it.value, u: it.unit || '', name: it.name || it.id, status: st };
      if (it.ref) { c.lo = it.ref[0]; c.hi = it.ref[1]; }
      if (c.hi != null && c.hi !== 0 && c.v > c.hi) c.over = Math.round((c.v - c.hi) / c.hi * 100);
      if (c.lo != null && c.lo !== 0 && c.v < c.lo) c.under = Math.round((c.lo - c.v) / c.lo * 100);
      c.s = st === 'high' ? '偏高' : st === 'low' ? '偏低' : '正常';
      ctx[it.id] = c;
    });

    /* 影像项没有数值，只有文字。但「有没有这一项」本身就是信息，
       所以照样登记，供 {?fattyliver} 这类条件块使用。 */
    (report.imaging || []).forEach(function (im) {
      if (!im.id || ctx[im.id]) return;
      ctx[im.id] = { name: im.name, text: im.finding || '', status: im.status };
    });

    /* ---- 派生值（下划线开头，文案里写作 {_sex}） ---- */
    /* 「有这项影像」和「这项影像异常」要分清：正常肝脏超声 + 转氨酶升高
       同样会走到消化内科，但文案不能说「超声看到脂肪肝」。 */
    ctx._fattyLiver = !!(ctx.fattyliver && ctx.fattyliver.status && ctx.fattyliver.status !== 'normal');
    ctx._sex = male ? '男' : (p.sex === '女' ? '女' : '—');
    ctx._waistLimit = male ? 90 : 85;      /* 中心性肥胖判定线 */
    ctx._waistGoal = male ? 85 : 80;       /* 干预目标值 */
    ctx._waistRatio = (p.waist && p.hip) ? Math.round(p.waist / p.hip * 100) / 100 : null;
    ctx._familyHx = (p.familyHx && !/^(无|未|否认|—)/.test(p.familyHx)) ? p.familyHx : '';
    ctx.hxHBP = /高血压/.test(String(p.familyHx || ''));
    ctx.hxDM = /糖尿病/.test(String(p.familyHx || ''));
    ctx._noSmoke = /^(无|不|否|未)/.test(String(p.smoke || '无'));

    /* 肝功整体状态：脂肪肝那条文案要用 */
    var liverKeys = ['alt', 'ast', 'ggt', 'tbil'];
    var haveLiver = liverKeys.every(function (k) { return ctx[k]; });
    var liverOk = haveLiver && liverKeys.every(function (k) { return ctx[k].status === 'normal'; });
    ctx._liverPanel = haveLiver ? (liverOk ? '全部正常' : '已有项目升高') : '本次未查';
    ctx.liverNormal = liverOk;

    /* 血象背景是否干净：淋巴细胞那条文案要用 */
    ctx._bloodBg = ['wbc', 'hgb', 'plt'].every(function (k) {
      return ctx[k] && ctx[k].status === 'normal';
    });

    /* 条件布尔：供 {?x}…{/x} 分支 */
    ctx.bmiOver = !!(ctx.bmi && ctx.bmi.v < 28);
    ctx.waistOk = !!(ctx.waist && ctx.waist.v < ctx._waistLimit);
    ctx.uricHigh = !!(ctx.uric && ctx.uric.v > (male ? 420 : 360));
    ctx.bpOk = !!(ctx.sbp && ctx.dbp && ctx.sbp.v < 120 && ctx.dbp.v < 80);
    ctx.lungBorder = !!(ctx.fev1fvc && ctx.fev1fvc.v >= 70 && ctx.fev1fvc.v < 75);
    ctx.lungBelow = !!(ctx.fev1fvc && ctx.fev1fvc.v < 70);

    ctx.tgOk = !!(ctx.tg && ctx.tg.status === 'normal');
    ctx.ldlOk = !!(ctx.ldl && ctx.ldl.v <= 3.4);
    ctx.altOk = !!(ctx.alt && ctx.alt.status === 'normal');
    ctx.tpsaOk = !!(ctx.tpsa && ctx.tpsa.v < 4);
    ctx.fbgOk = !!(ctx.fbg && ctx.fbg.v < 6.1);
    ctx.fbgPre = !!(ctx.fbg && ctx.fbg.v >= 6.1 && ctx.fbg.v < 7.0);
    ctx.fbgDm = !!(ctx.fbg && ctx.fbg.v >= 7.0);

    if (ctx.bmi) {
      var gap = 28 - ctx.bmi.v;
      ctx._bmiGap = gap > 0 ? Math.round(gap * 10) / 10 : 0;
    }

    return ctx;
  }

  /* 把整张规则表按上下文渲染一份副本，模板本身不动 */
  function renderRules(ctx) {
    var out = {};
    Object.keys(HL.rules).forEach(function (k) {
      out[k] = HL.tpl.deep(HL.rules[k], ctx);
    });
    return out;
  }

  /* ---------- 主分析 ---------- */
  function analyze(report) {
    /* 报告对象可能不完整：解析器半路失败、用户只填了几项、或者空文件。
       这里必须兜住，否则一个 undefined 会让整个页面白屏。 */
    report = report || {};
    var p = report.profile || {};
    /* 只认数组。之前写的是 (report.items || []).slice()，而字符串也有
       .slice()，'abc'.slice() 还是 'abc'，后面的 forEach 直接抛
       「items.forEach is not a function」，整页白屏。 */
    var items = Array.isArray(report.items) ? report.items.slice() : [];
    var imaging = Array.isArray(report.imaging) ? report.imaging.slice() : [];

    /* 指标 id 归一化：OCR 出来的名字不可能刚好等于字典 id，
       不先对一遍，这一项就会静默消失（引擎不报错，页面少一行）。 */
    items.forEach(function (it) {
      var mid = HL.matchId(it);
      if (mid && mid !== it.id) {
        it._rawId = it.id;
        it._rawName = it.name;
        it.id = mid;
      }
      /* 单位换算要在补 unit 之前：判定「报告写的是不是英制单位」
         必须看原文，补完 unit 就看不出来了。 */
      convUnit(it);
      /* name / unit 兜底：数据源只给 {id, value} 时（模型抽取、手工录入、
         第三方对接），后面的家族文案、短名、分享卡全都要读 it.name，
         缺了就是 famWhy 里 'undefined'.split 直接抛。字典有的就补上，
         但只在缺失时补——OCR 认出来的原文名字要留着给用户核对。 */
      var d = HL.dictById[it.id];
      if (d) {
        if (!it.name) it.name = d.name;
        if (!it.unit) it.unit = d.unit;
      }
    });
    /* 影像项同一个坑：数据源可能只给 {id, status}，name 缺失时
       渲染层 m.name.split 会直接抛（轻度偏离那一段）。字典里有名字
       就补，没有就用 id 兜底，保证渲染层永远拿到字符串。 */
    imaging.forEach(function (im) {
      if (im.name) return;
      var di = HL.dictById[im.id];
      im.name = (di && di.name) || im.id || '影像发现';
    });
    /* buildCtx 读的是 report.items / report.imaging，两个都写回归一化后的数组，
       否则 report.imaging 是字符串时 buildCtx 里的 forEach 照样崩。 */
    report.items = items;
    report.imaging = imaging;

    /* 参考区间归一化 + 字典兜底。
       字典里写的是 [lo, hi]，但 OCR / 模型抽取 / 手工录入
       很可能给 "7-40" / "<40" / ">7" 这种字符串。
       不转的话 60 会被判成 normal —— 静默丢异常，比报错严重得多。

       兜底这一段是必需的：真实报告经常不印参考区间，OCR 也可能
       没抽到区间列，外部数据源只给 {id, value}。只归一化不兜底，
       「ALT 200（参考 7-40）」会被判成正常、总分 100——这是产品
       最严重的错误。所以报告没给区间时回退到字典。
       有 sexRef 的项（血红蛋白、红细胞计数、腰围、腰臀比、体脂率、
       肌酐、尿酸…）按 profile.sex 取对应区间，男女标准本来就不同。 */
    items.forEach(function (it) {
      var r = normRef(it.ref);
      if (!r) {
        var d = HL.dictById[it.id];
        if (d) {
          var sr = d.sexRef && d.sexRef[p.sex];
          r = normRef(sr) || normRef(d.ref);
        }
      }
      it.ref = r;
    });

    items.forEach(function (it) { it._status = statusOf(it); });

    /* 模板上下文：这份报告里有什么，文案就从这里取值 */
    var ctx = buildCtx(report);
    /* 星级依赖数值，必须在 ctx 之后算 */
    applyStars(ctx);

    /* 1) 收集关注项（按规则去重） */
    var seen = {};
    var findings = [];

    function push(ruleId, source, benignOverride) {
      if (!ruleId || seen[ruleId]) {
        if (seen[ruleId]) seen[ruleId].sources.push(source);
        return;
      }
      var r = HL.rules[ruleId];
      if (!r) return;
      var f = {
        ruleId: ruleId, rule: r, sources: [source],
        severity: r.severity,
        benign: benignOverride == null ? !!r.benign : benignOverride,
        stars: r.stars, starWhy: r.starWhy,
        noDeduct: r.grade === '缺失',
        domain: r.domain
      };
      seen[ruleId] = f;
      findings.push(f);
    }

    items.forEach(function (it) {
      var rid = MAP[it.id];
      if (rid) {
        it._ruleId = rid;
        if (it._status !== 'normal') {
          /* 「良性项」也有上限：HDL 偏高是好事，但高到离谱就不是了。
             超过 benignMax 时翻成需要关注，不能继续写「不用管」。 */
          var bg = !!HL.rules[rid].benign;
          var cap = (HL.dictById[it.id] || {}).benignMax;
          if (bg && cap != null && it.value != null && it.value > cap) bg = false;
          it._benign = bg;
          push(rid, it.name + ' ' + it.value, bg);
          it._covered = true;
        }
      }
    });
    imaging.forEach(function (im) {
      if (im.ruleId && im.status !== 'normal') {
        push(im.ruleId, im.name);
        im._covered = true;
      }
    });
    /* 缺项检查：只有「做了甲状腺超声却没查甲功」才算缺项。
       没做甲状腺超声的报告，不该被提示漏查甲功。 */
    var hasThyroidImg = imaging.some(function (im) { return im.id === 'thyroid'; });
    var hasTsh = items.some(function (i) { return i.id === 'tsh'; });
    if (hasThyroidImg && !hasTsh) push('tsh', '本次未查');

    /* ============================================================
       1.5) 兜底：异常但没有专属规则的项，按家族聚合
       ------------------------------------------------------------
       这是「字典扩到 200 项」的关键一步。
       200 项里只有 17 项有专属文案，其余全靠家族模板。
       不做这一步，报告标红的项就会静默消失——产品承诺的
       「把每个标红项说明白」当场破产。
       ============================================================ */
    var famHit = {};                       /* 该家族已有专属卡片 */
    findings.forEach(function (f) {
      /* 假警报卡不参与「同族合并」——否则一项轻度异常会被塞进
         一张写着「不用管」的卡里，等于把真问题藏了 */
      if (f.benign) return;
      var fk = f.rule.fam || (HL.dictById[f.ruleId] || {}).fam;
      if (fk) famHit[fk] = f;
    });

    var famGroups = {};
    items.forEach(function (it) {
      if (it._status === 'normal') return;
      if (MAP[it.id]) return;              /* 已有专属规则，走上面那条路 */
      var d = HL.dictById[it.id];
      if (!d) return;
      var F = HL.fam[d.fam];
      if (!F || !F.whyHigh) return;
      var dev = devOf(it);
      /* 定性项（尿蛋白 2+）偏离恒为 0，不能靠 dev 分档，
         否则会被当成「轻度偏离」塞进折叠区——2+ 不该折叠 */
      var q = (!it.ref && it._status !== 'normal') ? qualStars(it.value) : 0;
      var g = famGroups[d.fam] || (famGroups[d.fam] = { fam: d.fam, F: F, items: [], maxDev: 0, maxQual: 0 });
      g.items.push({ it: it, dev: dev, q: q });
      it._covered = true;                  /* 已归入家族，不会静默消失 */
      if (dev > g.maxDev) g.maxDev = dev;
      if (q > g.maxQual) g.maxQual = q;
    });

    var minor = [];

    Object.keys(famGroups).forEach(function (fam) {
      var g = famGroups[fam], F = g.F;

      /* 该家族已有专属卡片 → 不另开一张，把数值并进那张的「同族其他项」 */
      if (famHit[fam]) {
        famHit[fam].extra = g.items.map(function (x) {
          return { name: shortName(x.it.name), v: x.it.value, u: x.it.unit || '', dev: x.dev };
        });
        return;
      }

      /* 偏离不到 10% 的进「轻度偏离」折叠区：
         不占星级卡位，也不制造焦虑，但一定看得见 */
      /* 只有「确实偏了一点」才折叠。dev 算不出来（<=0）时宁可出卡——
         折叠意味着「几乎正常」，对骨密度 T 值 −1.8 这种项是错的 */
      if (g.maxDev > 0 && g.maxDev < 10 && !g.maxQual) {
        g.items.forEach(function (x) {
          minor.push({
            name: x.it.name, v: x.it.value, u: x.it.unit || '',
            ref: x.it.ref, dev: x.dev, fam: fam,
            why: famWhy(F, x.it, x.dev)
          });
        });
        return;
      }

      var stars = g.maxQual || (g.maxDev >= 50 ? 4 : g.maxDev >= 25 ? 3 : 2);
      findings.push(famFinding(g, stars, famWhy));
    });

    /* 影像：有 ruleId 的已在上面处理；报告判为异常却没有 ruleId 的，
       同样不能静默丢掉 */
    imaging.forEach(function (im) {
      if (im.status === 'normal' || im.ruleId) return;
      im._covered = true;
      var d = HL.dictById[im.id];
      var F = d && HL.fam[d.fam];
      /* 字典里查不到这个影像 id 时，按名称和描述猜家族。
         OCR 抽出来的 id 不可能刚好和字典一致，不兜底就整块丢掉。 */
      if (!F || !F.note) {
        var guessed = guessImgFam(im);
        if (guessed) { F = HL.fam[guessed]; d = { fam: guessed }; }
      }
      if (!F || !F.note) {
        minor.push({ name: im.name, v: null, u: '', ref: null, dev: 0, fam: d ? d.fam : '', why: im.finding || '' });
        return;
      }
      findings.push(imgFinding(im, F, d));
    });

    /* 2) 分类：按星级排序，假警报单列 */
    var actionable = findings.filter(function (f) { return !f.benign; })
      .sort(function (a, b) {
        if (b.stars !== a.stars) return b.stars - a.stars;
        return b.severity - a.severity;
      });
    var falseAlarms = findings.filter(function (f) { return f.benign; });

    /* 3) 健康域评分 */
    var domainScores = {};
    HL.domains.forEach(function (d) {
      domainScores[d.id] = { id: d.id, name: d.name, weight: d.weight, desc: d.desc, score: 100, hits: [] };
    });

    actionable.forEach(function (f) {
      if (f.noDeduct) return;
      var bucket = domainScores[f.domain];
      if (!bucket) return;
      var n = bucket.hits.length;
      var cut = DEDUCT[f.severity] || 0;
      if (n > 0) cut = Math.round(cut * 0.5);
      bucket.score -= cut;
      bucket.hits.push(f.ruleId);
    });

    var total = 0, wsum = 0;
    var domainList = HL.domains.map(function (d) {
      var b = domainScores[d.id];
      b.score = Math.max(40, Math.min(100, b.score));
      total += b.score * d.weight;
      wsum += d.weight;
      return b;
    });
    var score = Math.round(total / wsum);
    var band = score >= 90 ? '优' : score >= 80 ? '良好' : score >= 70 ? '一般' : '需关注';

    /* 4) 统计 */
    var numeric = items.filter(function (i) { return i.value != null; });
    var normalCount = numeric.filter(function (i) { return i._status === 'normal'; }).length;
    var flagCount = numeric.filter(function (i) { return i._status !== 'normal'; }).length;
    var imgNormal = imaging.filter(function (i) { return i.status === 'normal'; }).length;

    /* 5) 风险聚类：心血管代谢 */
    var cmHits = [];
    if (seen.hcy) cmHits.push('同型半胱氨酸升高');
    if (seen.fattyliver) cmHits.push('脂肪肝');
    if (seen.bmi) cmHits.push('超重');
    if (/高血压/.test(p.familyHx || '')) cmHits.push('高血压家族史');
    var riskCluster = cmHits.length >= 3 ? {
      level: cmHits.length >= 4 ? '偏高' : '中等',
      title: '心血管代谢风险组合',
      hits: cmHits,
      note: cmHits.length >= 4
        ? '这四项单独看都不算重，但叠在一起指向同一条病理通路：内脏脂肪堆积 → 胰岛素抵抗 → 血管内皮损伤。它们共同作用的风险高于任何单项。好消息是这条通路对生活方式干预最敏感——减重 5–8%、把 Hcy 降到 15 以下，风险会明显回落。'
        : '这些因素有共同的生活方式基础，一起改善比逐项处理更有效。'
    } : null;

    /* 6) 计划数值 —— 先算，因为 bmi 那条文案要用到目标体重 */
    var plan = buildPlan(p, seen, score);
    ctx._dropKg = plan.dropKg;
    ctx._targetBMI = plan.targetBMI;
    ctx._needLose = plan.dropKg >= 1;

    /* 6.5) 渲染文案：模板 → 这份报告的真实数值
       规则表本身不动，每次分析生成一份副本，换报告不会污染模板 */
    var R = renderRules(ctx);
    findings.forEach(function (f) {
      f.rule = R[f.ruleId] || f.rule;
      /* 家族兜底项的 ruleId 是 'fam:xxx' / 'img:xxx'，不在 HL.rules 里，
         starWhy 已经在生成时算好，这里不能再去查表 */
      var base = HL.rules[f.ruleId];
      if (base) f.starWhy = HL.tpl.render(base.starWhy || '', ctx);
    });

    /* 7) 科室导航：必去 / 可不去 分两组 */
    var depts = [], skipDepts = [];
    var deptSeen = {};
    actionable.forEach(function (f) {
      var dk = f.rule.dept;
      if (!dk) return;
      if (deptSeen[dk]) { deptSeen[dk].reasons.push(f.rule.name); return; }
      var d = HL.depts[dk];
      if (!d) return;
      var dr = HL.tpl.deep(d, ctx);
      /* 科室星级 = min(科室固有优先级, 触发它的规则星级)，但不低于 3。
         这样「Hcy 7 星」推出心内科 7 星，「血压 5 星」推出心内科 5 星，
         而不是不管轻重一律 7 星。 */
      var need = dr.need, within = dr.within;
      /* 科室星级跟着触发它的规则走，但不超过科室固有优先级。
         唯一例外：一旦这个科已经被判为「必须去」，它的星级不能被
         固有值压到比问题本身还低——否则会出现「7 星的病去 5 星的科」。 */
      var dstars = Math.min(dr.stars, Math.max(f.stars, 3));
      /* 脂肪肝本身靠减重就能解决，所以默认「可不去」；
         但一旦肝功已经异常，性质就变了，必须翻成「必须去」。
         注意 _liverPanel 只有四项肝功都查了才给得出判断，报告只查了
         ALT 一项时它是「本次未查」——所以转氨酶本身也要单独看，
         否则「ALT 200，这次可以不去」这种建议是害人的。 */
      var liverHit = ctx._liverPanel === '已有项目升高' ||
        ['alt', 'ast', 'ggt'].some(function (k) {
          return ctx[k] && ctx[k].status !== 'normal';
        });
      if (dk === 'gi' && liverHit) {
        need = 'must'; within = '1 个月内';
        dstars = Math.max(f.stars, 5);
      }
      if (need === 'must') dstars = Math.max(dstars, Math.min(7, f.stars));
      var o = {
        key: dk, name: dr.name, icon: dr.icon, why: dr.why,
        stars: dstars, need: need, within: within,
        skipWhy: need === 'must' ? '' : (dr.skipWhy || ''),
        whenToGo: need === 'must' ? '' : (dr.whenToGo || ''),
        prep: dr.prep, ask: dr.ask, reasons: [f.rule.name],
        trip: TRIP[dk] || 0
      };
      deptSeen[dk] = o;
      (o.need === 'skip' ? skipDepts : depts).push(o);
    });
    function byStar(a, b) { return b.stars - a.stars; }
    depts.sort(byStar);
    skipDepts.sort(byStar);

    /* 就诊分趟汇总 */
    var tripMap = {};
    depts.forEach(function (d) {
      if (!d.trip) return;
      (tripMap[d.trip] = tripMap[d.trip] || []).push(d.name);
    });
    var trips = Object.keys(tripMap).sort().map(function (k) {
      return { no: +k, name: TRIP_NAME[k], tip: tripTip(+k, tripMap[k]), depts: tripMap[k] };
    });

    /* 7.5) 数据完整度
       体检套餐差别很大：只查 20 项的报告，八个维度可能全 100 分，
       因为没查到的项目不会扣分。这不是身体好，是查得少。
       这里列出「常见但本次没查」的项目，让分数有个参照。 */
    var KEY_PANELS = [
      { name: '血常规', ids: ['wbc', 'rbc', 'hgb', 'plt'] },
      { name: '肝功能', ids: ['alt', 'ast', 'tbil'] },
      { name: '肾功能', ids: ['cr', 'urea'] },
      { name: '血脂四项', ids: ['tc', 'tg', 'ldl', 'hdl'] },
      { name: '空腹血糖', ids: ['fbg'] },
      { name: '尿常规', ids: ['upro', 'ublood'] },
      { name: '甲状腺功能', ids: ['tsh'] },
      { name: '同型半胱氨酸', ids: ['hcy'] },
      { name: '糖化血红蛋白', ids: ['hba1c'] },
      { name: '维生素 D', ids: ['vitd'] },
      { name: '腹部超声', ids: ['fattyliver', 'liverUs', 'gallUs'] }
    ];
    var missingPanels = KEY_PANELS.filter(function (kp) {
      return !kp.ids.some(function (id) {
        return !!ctx[id] || imaging.some(function (im) { return im.id === id; });
      });
    }).map(function (kp) { return kp.name; });

    /* 8) 复查时间表 */
    var followup = buildFollowup(seen, p, ctx);

    /* 9) 形体推算 */

    var falseAlarmRows = falseAlarms.reduce(function (n, f) { return n + f.sources.length; }, 0);

    /* 空报告 / 只解析出几项：分母为 0 时 normalRate 会变成 NaN。
       这里给 0，并单独标一个 empty，让视图层换一套话术——
       否则空文件会拿到「100 分 · 状态不错」，那是骗人的。 */
    var denom = numeric.length + imaging.length;
    var isEmpty = denom === 0;

    /* 换算留痕：把「哪几项按英制单位换算了」整理成一张表，
       界面要显式告诉用户「15.4 g/dL = 154 g/L」，
       否则等于替用户改了他刚核对过的数字。 */
    var conversions = items.filter(function (it) { return it._unitConv; })
      .map(function (it) {
        return {
          id: it.id, name: it.name,
          from: it._rawUnit, to: it.unit,
          raw: it._rawValue, value: it.value
        };
      });

    /* 把 AI 结构化结果补进「有专属规则的影像卡」。
       规则卡的文字是策划好的，这里只在末尾追加一段结构化摘要，不改原文。
       克隆一份 rule 再改，避免污染 HL.rules 里的共享对象（那是全报告共用的）。 */
    var imgStructByRule = {};
    imaging.forEach(function (im) {
      if (im.struct && im.ruleId) imgStructByRule[im.ruleId] = im.struct;
    });
    if (Object.keys(imgStructByRule).length) {
      findings.forEach(function (f) {
        var st = imgStructByRule[f.ruleId];
        if (!st) return;
        var line = imgStructLine(st, true);
        if (!line) return;
        var clone = {};
        Object.keys(f.rule).forEach(function (k) { clone[k] = f.rule[k]; });
        clone.detail = (clone.detail || '') + line;
        f.rule = clone;
      });
    }

    return {
      profile: p,
      items: items,
      imaging: imaging,
      urine: report.urine || [],
      conversions: conversions,
      score: score,
      band: band,
      isEmpty: isEmpty,
      domains: domainList,
      findings: actionable,
      falseAlarms: falseAlarms,
      minor: minor,
      riskCluster: riskCluster,
      depts: depts,
      skipDepts: skipDepts,
      trips: trips,
      plan: plan,
      followup: followup,
      coverage: {
        missing: missingPanels,
        checked: KEY_PANELS.length - missingPanels.length,
        total: KEY_PANELS.length
      },
      stats: {
        total: denom,
        normal: normalCount + imgNormal,
        flagged: flagCount,
        falseAlarmCount: falseAlarms.length,
        falseAlarmRows: falseAlarmRows,
        minorCount: minor.length,
        realIssues: actionable.filter(function (f) { return f.severity >= 1 && !f.noDeduct; }).length,
        missing: actionable.filter(function (f) { return f.noDeduct; }).length,
        normalRate: denom ? Math.round(((normalCount + imgNormal) / denom) * 100) : 0,
        topStars: actionable.length ? actionable[0].stars : 0
      }
    };
  }

  /* ---------- 计划生成 ---------- */
  function buildPlan(p, seen, score) {
    var h = p.height || 170, w = p.weight || 70;
    var age = p.age || 30;
    var bmr = 10 * w + 6.25 * h - 5 * age + 5;
    var tdee = Math.round(bmr * 1.4 / 10) * 10;
    var kcalHi = Math.round((tdee - 500) / 50) * 50;
    var kcalLo = kcalHi - 100;

    var weeks = 12, perWeek = 0.5;
    var goalWeight = Math.round(24 * Math.pow(h / 100, 2) * 10) / 10;
    /* 「12 周能减的」和「需要减的」取小的那个；已经达标就不减 */
    var need = Math.max(0, w - goalWeight);
    var dropKg = Math.round(Math.min(perWeek * weeks, need) * 10) / 10;
    var targetWeight = Math.round((w - dropKg) * 10) / 10;
    var targetBMI = Math.round((targetWeight / Math.pow(h / 100, 2)) * 10) / 10;
    var proteinLo = Math.round(1.35 * targetWeight);
    var proteinHi = Math.round(1.5 * targetWeight);
    var carbHi = Math.round((kcalHi * 0.46) / 4 / 5) * 5;
    var carbLo = carbHi - 20;
    var fatLo = Math.round((kcalHi * 0.27) / 9);
    var fatHi = fatLo + 5;

    var maxHR = 220 - age;
    var zones = {
      low: [Math.round(maxHR * 0.50), Math.round(maxHR * 0.60)],
      mid: [Math.round(maxHR * 0.64), Math.round(maxHR * 0.76)],
      high: [Math.round(maxHR * 0.77), Math.round(maxHR * 0.85)]
    };

    /* 个性化要点 */
    var notes = [];
    if (seen.fattyliver) notes.push({ t: '脂肪肝：先断果糖', d: '果糖是肝内脂肪合成的直接底物。含糖饮料、果汁、蜂蜜这三样先断掉，比控制油脂更有效。' });
    if (seen.hcy) notes.push({ t: '叶酸靠吃菜，不靠补剂', d: '每天 6 捧菜里至少 3 捧是深绿叶菜，急火快炒或焯水 30 秒，久煮会让叶酸流失一半以上。豆类每周 3–4 次。' });
    if (seen.bmi) notes.push({ t: '蛋白质不能少', d: '减重期每天 4–5 掌心蛋白质（约 ' + proteinLo + '–' + proteinHi + 'g），能保住肌肉、维持基础代谢。每餐一个掌心。' });
    if (seen.lung) notes.push({ t: '运动时的呼吸节奏', d: '存在轻度通气障碍，有氧运动采用「鼻吸口呼」，避免憋气发力；强度以能说完整句子为准。' });
    if (seen.thyroid) notes.push({ t: '碘：等抗体结果再定', d: '若 TPOAb 阳性，限制海带、紫菜、海苔；碘盐可正常使用，不额外补碘。' });

    return {
      kcalLo: kcalLo, kcalHi: kcalHi, tdee: tdee, bmr: Math.round(bmr),
      proteinLo: proteinLo, proteinHi: proteinHi,
      carbLo: carbLo, carbHi: carbHi, fatLo: fatLo, fatHi: fatHi,
      fiber: [25, 30], water: [1800, 2200], salt: 5,
      targetWeight: targetWeight, dropKg: dropKg, goalWeight: goalWeight,
      weeks: weeks, perWeek: perWeek, targetBMI: targetBMI,
      maxHR: maxHR, zones: zones,
      notes: notes,
      portion: HL.plan.portion,
      dietSets: HL.plan.dietSets,
      shopping: HL.plan.shopping,
      monthProgram: HL.plan.monthProgram,
      weekTemplates: HL.plan.weekTemplates,
      stick: HL.plan.stick,
      /* v4：吃与运动拆成两页后新增的静态内容 */
      eatFlow: HL.plan.eatFlow,
      myths: HL.plan.myths,
      prep: HL.plan.prep,
      snack: HL.plan.snack,
      cook: HL.plan.cook,
      fullness: HL.plan.fullness,
      session: HL.plan.session,
      moves: HL.plan.moves,
      equip: HL.plan.equip,
      cardio: HL.plan.cardio,
      safety: HL.plan.safety,
      track: HL.plan.track
    };
  }

  /* 某个月用哪套周模板 */
  function templateFor(month) {
    var prog = HL.plan.monthProgram;
    var m = Math.max(1, Math.min(12, month || 1));
    var hit = prog.filter(function (x) { return x.m === m; })[0] || prog[0];
    return { tpl: HL.plan.weekTemplates[hit.tpl], month: hit };
  }

  /* 某个月用哪套菜单 */
  function dietSetFor(month) {
    var sets = HL.plan.dietSets;
    return sets[(Math.max(1, month) - 1) % sets.length];
  }

  /* ---------- 复查时间表 ---------- */
  function buildFollowup(seen, p, ctx) {
    var list = [];
    function add(when, monthOffset, title, items, dept) {
      list.push({ when: when, monthOffset: monthOffset, title: title, items: items, dept: dept || '' });
    }

    /* 1 个月内：要补查或要复核的 */
    if (seen.thyroid || seen.tsh) add('1 个月内', 1, '甲状腺功能补查',
      ['甲功五项（TSH / FT3 / FT4 / TT3 / TT4）', '甲状腺自身抗体（TPOAb / TgAb）'], '内分泌科');
    if (seen.hcy) add('1 个月内', 1, '同型半胱氨酸归因',
      ['血清叶酸', '维生素 B12', 'Hcy 复查'], '心血管内科');
    if (seen.lung) add('1 个月内', 1, '肺功能复核',
      ['肺功能全套 + 支气管舒张试验'], '呼吸内科');
    if (seen.fbg && ctx && !ctx.fbgOk) add('1 个月内', 1, '血糖复核',
      ['空腹血糖复查（另一天）', '糖化血红蛋白（HbA1c）'], '内分泌科');

    /* 3 个月内：要设备、但不着急的 */
    if (seen.vision) add('3 个月内', 3, '完整验光',
      ['验光（含散光轴位）', '眼压与眼底（如度数变化明显）'], '眼科');
    if (seen.lymph) add('3 个月内', 3, '血常规复查',
      ['血常规（看淋巴细胞是否回落）'], '体检中心（不用挂专科）');

    /* 6 个月：代谢与器官层面 */
    var six = [];
    if (seen.fattyliver) six.push('腹部超声');
    if (seen.fattyliver || seen.alt) six.push('肝功五项');
    six.push('血脂四项', '空腹血糖');
    if (seen.uric) six.push('尿酸');
    if (seen.bmi) six.push('腰围与体重记录');
    add('6 个月', 6, '代谢与肝脏复查', six, '体检中心（不用挂专科）');

    /* 12 个月：年度体检 */
    add('12 个月', 12, '年度全面体检',
      ['甲状腺超声', '颈动脉超声', '肿瘤标志物', '心电图'], '体检中心');

    return list;
  }


  return {
    analyze: analyze,
    statusOf: statusOf,
    convUnit: convUnit,
    fmt: fmt,
    refText: refText,
    templateFor: templateFor,
    dietSetFor: dietSetFor,
    DEDUCT: DEDUCT
  };
})();
