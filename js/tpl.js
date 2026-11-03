/* ============================================================
   康鉴 HealthLens · 模板层
   ------------------------------------------------------------
   这一层存在的唯一理由：文案不能写死某一个人的数值。

   改造前的问题：
     depts.cardio.why = '同型半胱氨酸 20.41 μmol/L 超出上限 36%…'
   换一个人上传报告，屏幕上还是显示 20.41。

   改造后的写法：
     depts.cardio.why = '同型半胱氨酸 {hcy.v} {hcy.u} 超出上限 {hcy.over}%…'

   语法
     {hcy.v}        数值                 20.41
     {hcy.u}        单位                 μmol/L
     {hcy.hi}       参考上限             15
     {hcy.lo}       参考下限             0
     {hcy.over}     超出上限的百分比     36
     {hcy.under}    低于下限的百分比
     {hcy.s}        状态词               偏高 / 偏低 / 正常
     {hcy.name}     报告里的原始项目名
     {_sex}         引擎算好的派生值（下划线开头）
     {?hcy}…{/hcy}  该项存在才输出
     {^hcy}…{/hcy}  该项缺失才输出

   取不到值一律输出「—」，永不抛错。
   条件块支持嵌套，按 key 配对，不可重名。
   ============================================================ */
window.HL = window.HL || {};

HL.tpl = (function () {
  'use strict';

  /* 去掉浮点噪声：11.599999999999994 → 11.6 */
  function clean(n) {
    if (typeof n !== 'number' || !isFinite(n)) return n;
    return Math.round(n * 1000) / 1000;
  }

  function get(ctx, path) {
    if (!ctx) return null;
    if (path.indexOf('.') < 0) return ctx[path];
    var seg = path.split('.'), cur = ctx;
    for (var i = 0; i < seg.length; i++) {
      if (cur == null) return null;
      cur = cur[seg[i]];
    }
    return cur;
  }

  /* 条件块的真假：布尔值用它本身，其余看是否取到 */
  function truthy(ctx, path) {
    var v = get(ctx, path);
    if (typeof v === 'boolean') return v;
    return v != null && v !== '';
  }

  function render(s, ctx) {
    if (typeof s !== 'string' || s.indexOf('{') < 0) return s;

    /* 条件块：从内到外逐层剥，最多 30 轮防死循环 */
    var guard = 0;
    while (guard++ < 30) {
      var next = s.replace(/\{([?^])([\w.]+)\}([\s\S]*?)\{\/\2\}/g,
        function (m, sign, key, body) {
          var on = truthy(ctx, key);
          return (sign === '?' ? on : !on) ? body : '';
        });
      if (next === s) break;
      s = next;
    }

    /* 变量 */
    return s.replace(/\{([\w.]+)\}/g, function (m, key) {
      var v = get(ctx, key);
      if (v == null || v === '') return '—';
      if (typeof v === 'number') return String(clean(v));
      return String(v);
    });
  }

  /* 把对象里所有字符串（含数组、嵌套一层）都过一遍模板 */
  function deep(obj, ctx) {
    if (typeof obj === 'string') return render(obj, ctx);
    if (Array.isArray(obj)) return obj.map(function (x) { return deep(x, ctx); });
    if (obj && typeof obj === 'object') {
      var o = {};
      Object.keys(obj).forEach(function (k) { o[k] = deep(obj[k], ctx); });
      return o;
    }
    return obj;
  }

  return { render: render, deep: deep, clean: clean, get: get, truthy: truthy };
})();
