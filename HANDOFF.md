# 康鉴 HealthLens · 交接说明（2026-11-03）

> 给接手的 AI / 开发者：这份文档是「当前在哪、下一步做什么、哪些坑别再踩」。
> 架构细节和完整坑位表在 `README.md`，上架时间线在 `MOBILE.md`，这两份先读。
> 本文档只做三件事：说清现状、指路、划红线。

---

## 一、现状一句话

纯静态 H5，**零外部依赖、断网可用**，上传体检报告 → 分清真假异常 → 按星级排先后 → 判断哪个科不用去 → 输出「怎么吃」「怎么运动」两份可执行方案 + 一页就诊摘要。

**可选增强（需本机代理）：AI 影像描述结构化** —— 把「甲状腺右叶结节 2.4×1.7mm，边界清，无钙化」抽成结构化的尺寸/边界/钙化，补进影像卡。模型只做「抽取归一化」，判定仍由本地规则引擎完成。不配也能用，自动降级为原文展示。

**质量口径：`app.js` sha256 `70f3fdc3…`（115,904B）这一版，169 条自动化用例全通过，跑前跑后 13 项指纹逐字节一致。** 「150/150」「159/159」都是旧数字，作废。

## 二、怎么跑起来

```bash
cd outputs/healthlens
python -m http.server 8899        # 纯静态：任意静态服务器都行
# 浏览器开 http://127.0.0.1:8899

# 需要 AI 影像解读时，改用内置开发服务器（静态托管 + 智谱代理，零依赖）
node server/dev.js                # 浏览器开 http://127.0.0.1:8787
```

**AI 影像解读为什么需要这个服务器**：智谱 `open.bigmodel.cn` 不支持浏览器 CORS 直连（OPTIONS 预检不返回 `Access-Control-Allow-Origin`，浏览器会拦掉带 Authorization 的 POST）。所以浏览器不能直接带密钥调它。`server/dev.js` 做两件事：托管静态文件 + 把 `/api/chat` 转发给智谱（密钥只在服务端读取）。**密钥不进浏览器，也不进仓库。**

- **直接双击 `index.html` 也能用**，但 `file://` 下 Service Worker 不会启用，拍照识别/PDF 也建议走 http(s)。PWA 安装必须 https 或 localhost。
- 两个内置样板报告可直接体验（上传页两个按钮）：`HL.sample`（真实数据，86 分）／`HL.sample2`（构造的 45 岁女性，84 分）。
- 测试脚本在 `E:/tmp/hltest/`（`regress_b.js` 主链冒烟、`q_warnstore.js` 18 条、`full_regress.js`；QA 套件 t1–t14 共 169 条）。跑测试需要 Playwright：`NODE_PATH=C:/Users/Lenovo/.workbuddy-ai/binaries/node/workspace/node_modules`。

## 三、文件地图（改哪儿先看这儿）

| 文件 | 职责 | 改动风险 |
|:--|:--|:--|
| `index.html` | 入口骨架，只引脚本 | 低 |
| `js/dict.js` | **字典层**：200 项指标 / 41 家族 / 17 专属文案。`D(id,name,unit,ref,dir,fam,{rule,sexRef,benignMax})` | **新增指标 = 加一行 `D()`**，引擎/文案/视图都不用动 |
| `js/engine.js` | 计算层：评分、星级、异常判定、单位换算（`UNIT_CONV` :117-160）、模糊匹配 `HL.matchId` | 高：参考区间兜底、`normRef`、定性结果识别都在这 |
| `js/data.js` | 知识层：规则、文案模板（`{hcy.v}` 占位符 + `{?k}…{/k}` 条件块）、饮食/运动计划 | 中：文案是模板不是硬编码 |
| `js/app.js` | 视图层 + 本地存储 + 上传/识别调度 | 高：五个 localStorage key、`warnStore` 兜底 |
| `js/ocr.js` | 拍照识别（四步预处理：Otsu→去线→纠偏→重跑） | **别动 MAXW=2400**，别换 best 语言包 |
| `js/pdf.js` | PDF 文字层抽取；全页 <50 字判定为扫描件转 OCR | 低 |
| `js/summary.js` | 就诊摘要：DOM 版 + canvas 存图版（两处共用 `ageText()`） | 中：改一处必须验另一处 |
| `js/share.js` | 分享卡（零依赖 canvas） | 中：测量 ctx 必须先设 font |
| `js/trend.js` | 历史对比 + 手动补录 | 低 |
| `js/img.js` | **AI 影像结构化**：调用大模型抽取尺寸/边界/钙化，两种模式（本机代理 / 直连）。无配置时静默降级 | 低：只产出 `im.struct`，判定不在这 |
| `server/dev.js` | 本机开发服务器：静态托管 + `/api/chat` 智谱代理（零依赖） | 低：密钥只在这里读，别把密钥写进代码 |
| `vendor/ocr/` `vendor/pdf/` | 识别/PDF 引擎（7.0MB），懒加载 | **不要动** |

**本地存储 key**（动任何一个都要做幂等迁移）：`hl_profiles_v1` 成员档案 / `hl_checkin_v2::<成员id>` 打卡 / `hl_report_v1` 当前报告 / `hl_last_v1` 上次报告 / `hl_ui_v1` 界面偏好 / `hl_hist_v1` 历史记录 / `hl_prof_cur_v1` 当前成员。

## 四、下一步（按优先级，都有明确卡点）

1. **Capacitor 7 套壳上架** → `MOBILE.md` 有一条完整时间线（Windows 能做 90%）。最大收益是 `@capacitor/local-notifications` 本地定时提醒——这是用户最初「饭点叫我」的真答案。**两个必踩的坑写在 MOBILE.md 第六节**：壳里必须关 SW；状态栏要 `setOverlaysWebView({overlay:false})`。**iOS 打包必须 macOS，Windows 做不到**。
2. ~~影像描述结构化~~ —— **已实现（`js/img.js` + `server/dev.js`）**。本机跑 `node server/dev.js` 即可；模型只做抽取归一化，判定仍在规则引擎。**部署到 GitHub Pages 后若要保留 AI 功能，需另跑一个代理并把地址填进「AI 设置」。**
3. **账号云同步** —— 要先选云服务，属于新增依赖。
4. **加密 PDF** —— 话术已实现（`pdf.js` 里有），但**没有样本实测过**，接手后如有加密样本先测这条。

## 五、已知取舍（有意为之，别当 bug 修）

| 现象 | 为什么不改 |
|:--|:--|
| 新成员必须先有一份报告才能打卡 | 没有报告就不知道给谁排计划；`renderAll` 提前 return，tabbar 不显示 |
| 无痕窗口下新加的成员存不住，且无任何提示 | 唯一一次提醒机会留给「报告丢了」那一刻。**裁定过：不加常驻静态警告**——为边缘情况给 100% 用户常驻一行提示，是拿主路径可读性换边缘覆盖率。若将来要加，条件是「至少一次写失败后才显示」，不是常驻 |
| `warnStore(false)`：成员清单写失败不弹 | 成员记录可重建（重传即可），不可替代的是报告本体。**结构上报告静默丢不存在**：`patchProf` 全项目只有 2 个调用点，`:396` 只写 `{kind,file}` 不含 report，`:414` 在 `saveReport` 内且紧接 `warnStore(true)` |
| OCR 路径的单位换算盲区（`ocr.js:344`） | 取的是字典单位，走不到 `UNIT_CONV`。OCR 结果本来就要求用户在核对页确认，影响面小；将来 OCR 准确率上来再补 |
| 成员不能改名 | 删了重建，代价可接受 |

**待办 P3（纯注释，功能无影响）**：① `summary.js doSave()` 加「canvas 离屏，测试用 download 事件」注释 ② `saveProfiles` catch 处加「只有 saveReport 才是重要写入」注释。下次顺手做，**不要为注释单独开一轮回归**。

## 五之二、AI 影像解读与密钥安全（两套版本，别搞混）

| | 开发版（本机） | GitHub 版（公开） |
|:--|:--|:--|
| 密钥位置 | `server/key.local.txt`（**被 gitignore**） | **没有密钥** |
| 谁来带密钥 | `server/dev.js` 在服务端转发时带 | 无 |
| AI 功能 | 跑 `node server/dev.js` 即可用 | 默认降级为原文；用户可在「AI 设置」填自己的代理地址 |
| 浏览器里有没有密钥 | **没有**（密钥在服务端） | 没有 |

**三条铁律**：
1. **密钥永远不写进任何会被提交的文件**（`js/*.js`、`index.html`、`README`、`HANDOFF` 都不行）。只能放 `server/key.local.txt`，它已在 `.gitignore`。
2. **不要为了"让 GitHub 版也能用"把密钥塞进前端**。纯前端没有秘密——任何人 F12 都能看到。GitHub 版想用 AI，只能是「另跑代理」或「用户自带密钥/代理」。
3. **分享文件夹给别人前**：先删 `server/key.local.txt` 和 `js/config.local.js`。若密钥已外泄，去智谱控制台**吊销并重建**。

## 六、红线（踩过的坑，别再踩）

1. **模板文案是占位符不是硬编码**：`{hcy.v}`、`{?k}…{/k}`。星级是吃 ctx 的函数——静态星级会让血糖 7.2 和 5.2 同分。
2. **`r.plan` 不是 `HL.plan`**：`buildPlan()` 只挑字段返回，往 `HL.plan` 加字段必须同步加进 return，否则 `undefined.rows` 让整页空白且 tabbar 不出现。
3. **定性结果**：`ref` 为空的项（尿蛋白/尿潜血）走 `qualStatus`，不按偏离幅度分档——`if (!it.ref) return 'normal'` 会让尿蛋白 2+ 整块消失。
4. **`parseFloat('2+')` 得 2**：只有整串是数字才转数值，否则尿蛋白 2+ 被当数字判正常。
5. **`normRef` 必须在匹配后、判定前跑**：参考区间可能是 `"7-40"` 字符串，`60 > '-'` 得 NaN。
6. **宁可匹配不上也不能误配**：`EXCLUDE` 挡前白蛋白/糖化白蛋白/总T3/游离PSA。模糊匹配失败就标红让用户下拉选择，绝不静默丢弃。
7. **SW 是 network-first**：改 cache-first 会让改代码不生效。SW 版本号在 `sw.js` 顶部的 `healthlens-v6`，**改任何静态资源都要 bump**。
8. **科室刻意不加肿瘤科**：标志物轻度升高多为假阳性，推肿瘤科制造恐慌。文案写「4–6 周复查同一项」。
9. **改 `app.js` 后对外报数字之前**：先 `node --check` 全部 js → 跑 `q_warnstore.js` + `regress_b.js` → 看四页截图。「测试全绿」和「改动按意图生效」是两件事。
10. **验证阶梯**：语法检查 → 最小实跑 → 产物存在 → **截图看图** → 像素采样。静默错误只能靠看图发现。

## 七、发布路径（用户已定调）

不上架也要做成成熟产品：① 分享给亲友（H5 链接）② 挂网站做引流 ③ 上 GitHub + DeepSeek 社区（复用 OceanProof 项目的发布路径：仓库 + GitHub Pages Demo）。发布前记得把 `manifest.json` / `sw.js` 里的名称与图标核对一遍。

---

*交接前最后状态：26 文件 / 7.8MB（vendor 7.0MB + js 420KB + css 84KB）；指纹清单见 `README.md` 回归表；测试脚本 `E:/tmp/hltest/`（一次性环境，不在项目内）。*
