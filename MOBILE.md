# 康鉴 HealthLens · iOS / Android 跨平台方案

> 目标：把现有的纯静态 H5 变成能装到手机上的原生应用，一套代码同时出 iOS 和 Android。
> 前置结论：**不用重写。** 现有 4000 行原生 JS 一行都不用改，套一层原生壳即可。

---

## 一、先说结论：为什么是 Capacitor

| 方案 | 现有代码复用 | 双端 | 原生能力 | 学习成本 | 判断 |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **Capacitor 7** | **100%** | iOS + Android | 覆盖所需全部 | 低 | ✅ **推荐** |
| React Native | 0%（要重写） | iOS + Android | 最强 | 中 | ❌ 重写 4000 行换不到对应收益 |
| Flutter | 0%（要重写） | iOS + Android | 强 | 中高 | ❌ 同上 |
| uni-app | ~90% | 双端 + 小程序 | 中 | 低 | ⚠️ 备选，但它把 H5 再包一层，调试链路更长 |
| Tauri 2 | ~95% | iOS + Android | 中 | 中 | ⚠️ 移动端 2025 才稳定，插件生态还薄 |

**选 Capacitor 的三个理由：**

1. **这个项目的技术形态恰好是它的最佳场景。** 零框架、零构建、零外部依赖、纯 `file://` 能跑——这正是 Capacitor 想要的（它只是把你的静态目录塞进原生 WebView）。
2. **要的原生能力它都有官方插件。** 本地通知、相机、文件、安全存储、分享、状态栏，全部一等公民。
3. **出问题能查。** 它就是系统 WebView，CSS/JS 行为和在手机浏览器里一模一样，不会出现「Flutter 里这个 CSS 不生效」这类黑洞。

React Native / Flutter 的问题不是不好，是**对这个项目不成立**：它们要求用 Dart 或 JSX 重写界面，而现有代码的价值恰恰在引擎（200 项字典 + 41 家族 + 评分模型）和那套已经调好的中文排版上。重写等于把已验证的东西全部作废。

---

## 二、打包之后，多出来什么能力

这不是「换个壳」，有几件事是网页**永远做不到**的：

### 1. 本地定时提醒 —— 最初那个需求的真正答案

你最早问的是「到饭点、到锻炼时间能不能叫我一声」。当时查完六条通道，结论是只有手机日历 `.ics` 能做，因为：

- 小程序订阅消息：一次性，授权一次只能发一条
- 长期订阅：只对政务/医疗等线下公共服务类目开放，体检中心不在内
- 短信：要企业资质 + 签名报备
- 飞书：要求用户装办公软件

**打包成 APP 后，这条路直接通了。** `@capacitor/local-notifications` 是本地定时，不经过任何服务器、不需要任何授权、不需要任何资质：

```js
LocalNotifications.schedule({
  notifications: [
    { id: 1, title: '午饭时间', body: '先吃菜，再吃肉，主食留一半',
      schedule: { on: { hour: 12, minute: 0 }, repeats: true } },
    { id: 2, title: '今天该练了', body: '有氧 40 分钟 · 目标心率 122–137',
      schedule: { on: { hour: 19, minute: 0 }, repeats: true } }
  ]
});
```

对比现在的 `.ics` 方案：

| | .ics 导日历 | APP 本地通知 |
| :-- | :-- | :-- |
| 用户操作 | 下载文件 → 打开 → 选「添加到日历」 | 装完就有，一次开关 |
| 文案能否随报告变 | 不能，写死在事件里 | 能，读当天的训练内容 |
| 能否点开跳转 | 不能 | 能，点通知直接进「怎么运动」 |
| 能否按打卡情况调整 | 不能 | 能，昨天没练今天提醒语气变重 |

**这是打包最大的实际收益**，比「有个图标」重要得多。

### 2. 拍照上传 —— OCR 的入口

`@capacitor/camera` 可以直接调系统相机拍体检报告，比网页的 `<input type="file">` 体验好一档（能连续拍多页、能自动裁边）。这是接 OCR 之后的主入口。

### 3. 数据不会丢

iOS 的 WKWebView 在存储紧张时会清理 `localStorage`——打卡记录可能无声消失。换成 `@capacitor/preferences`（iOS 走 UserDefaults，Android 走 SharedPreferences）就稳了。

### 4. 分享卡

`@capacitor/share` 调系统分享面板，一键发微信/朋友圈。这是引流的关键动作。

---

## 三、目录怎么改

现在是：

```
outputs/healthlens/
  index.html
  js/  css/  manifest.json  sw.js  icon-*.png
```

接入后：

```
outputs/healthlens/
  www/                        ← 现在的全部 Web 资源移进来
    index.html
    js/  css/  manifest.json  sw.js  icon-*.png
  capacitor.config.json       ← 新增
  package.json                ← 新增
  android/                    ← npx cap add android 生成
  ios/                        ← npx cap add ios 生成
```

**为什么必须移进 `www/`**：Capacitor 的 `webDir` 会整个目录拷进原生工程。如果指向根目录，`node_modules`（几百 MB）会一起被拷进去，出包体积失控。

`capacitor.config.json` 大致长这样：

```json
{
  "appId": "cn.kangjian.healthlens",
  "appName": "康鉴",
  "webDir": "www",
  "ios": { "contentInset": "always" },
  "android": { "allowMixedContent": false },
  "plugins": {
    "LocalNotifications": { "smallIcon": "ic_stat_icon", "iconColor": "#0A6E75" }
  }
}
```

---

## 四、一条时间线走完（Windows 电脑也能做完 90%）

> 每一步都写了「你会看到什么」，对不上就停在那一步，别往下走。

### 第 1 步 · 确认分发方式（这一步决定后面所有事）

三条路，成本差很多：

| 方式 | iOS | Android | 需要什么 | 适合 |
| :-- | :-- | :-- | :-- | :-- |
| **自己用 / 给亲友** | Xcode 直装（免费签名 7 天到期）或 TestFlight | 直接装 APK | Apple ID（免费）或开发者账号 | 现在 |
| **小范围内测** | TestFlight（需 $99 开发者账号） | APK 或内测链接 | Apple Developer $99/年 | 验证阶段 |
| **上架应用商店** | App Store | 各安卓市场 | 开发者账号 + **医疗类目资质** | 有主体之后 |

⚠️ **上架那条路和之前小程序遇到的问题一样**：国内应用商店对医疗健康类 App 要求相应资质，App Store 的中国区上架也需要 ICP 备案号。这个坎绕不过去，除非以「健康记录工具」定位（去掉解读与建议）或者挂靠有资质的机构。

**我的建议：先走「自己用 + 亲友」，把产品打磨到值得分享，再谈上架。**

### 第 2 步 · 装工具链（Windows 可完成）

```bash
# Node 已有（本机 22.22.2）
cd outputs/healthlens
npm init -y
npm i @capacitor/core @capacitor/cli
npm i @capacitor/local-notifications @capacitor/camera @capacitor/preferences @capacitor/share
```

Android 需要 **Android Studio**（含 SDK + JDK）。从 https://developer.android.com/studio 下载安装，安装时勾选 Android SDK Platform 35 和 Build-Tools。

> ⚠️ 我不会替你下载安装包。这两步（Android Studio、后面的 Xcode）需要你自己点下一步，装完告诉我，我继续。

**自检**：命令行敲 `java -version` 有输出、`adb version` 有输出，就对了。

### 第 3 步 · 移动 Web 资源

```bash
mkdir www
# 把 index.html、js/、css/、manifest.json、sw.js、icon-*.png 全部移进 www/
```

**自检**：双击 `www/index.html`，页面和现在完全一样。

### 第 4 步 · 初始化 + 加 Android 平台

```bash
npx cap init 康鉴 cn.kangjian.healthlens --web-dir=www
npx cap add android
npx cap sync
```

**自检**：目录里出现 `android/` 文件夹。

### 第 5 步 · 跑起来看

```bash
npx cap run android
```

**自检**：手机上（或模拟器）出现「康鉴」图标，点开是完整页面，四个页签都能切。**第一次看到它在手机上以独立 App 的样子出现，就是这一步。**

### 第 6 步 · 处理两个必踩的坑

**坑 1：Service Worker 必须关掉。**
Capacitor 的 Android 用 `http://localhost`，`location.protocol.indexOf('http') === 0` 会成立 → SW 会注册 → 缓存旧的 JS，改代码不生效，严重时白屏。

改 `init()` 里那段：

```js
var native = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
if (!native && 'serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  // 只有浏览器里才注册 SW；打包后资源已经在本地，不需要缓存
}
```

**坑 2：状态栏会盖住顶栏。**
加 `@capacitor/status-bar`，启动时 `StatusBar.setOverlaysWebView({ overlay: false })`。否则 iPhone 上「康鉴」标题会被刘海压住。

**自检**：改完代码 → `npx cap sync` → 重新 run，能看到改动生效、顶部没被压。

### 第 7 步 · 把 .ics 换成真通知

在「怎么运动」和「怎么吃」两个页面，把「加进日历」按钮换成「开启提醒」：

- 首次点击请求通知权限（`LocalNotifications.requestPermissions()`）
- 训练：每天 19:00 重复，内容取当天的训练类型
- 三餐：7:30 / 12:00 / 18:30 重复
- 用户关掉提醒时 `cancel()` 对应 id

**自检**：把手机时间调到 18:59，等一分钟，通知应该弹出来。点通知能进到「怎么吃」页。

### 第 8 步 · 加 iOS（需要一个 Mac 或云构建）

**这台是 Windows，做不了 iOS 打包。** 三条路：

| 方式 | 成本 | 说明 |
| :-- | :-- | :-- |
| 借一台 Mac | 免费 | 装 Xcode → `npx cap add ios` → `npx cap open ios` → 签名 → 连 iPhone 运行 |
| 云构建（Codemagic / GitHub Actions macOS runner） | 免费额度或 $30/月 | 仓库推上去，云端出 ipa，TestFlight 分发 |
| 找人代打包 | 一次性 | 只适合偶尔出包，长期不划算 |

`npx cap add ios` 必须在 macOS 上跑，Windows 上会直接报错。

### 第 9 步 · 拍照识别（已经做完了，不需要 API）

这一步原来写的是「等 API」，后来发现根本不用等——纯前端就够：

```
拍照/选图 → 本机预处理（去表格线 + 纠偏）→ Tesseract 中文识别
          → 行级解析 → 字典模糊匹配 → 人工核对 → HL.engine.analyze()
```

`js/ocr.js` 已经接进网页版，壳里不用改一行。套壳之后唯一要动的是**把 `<input type="file">` 换成 `@capacitor/camera`**：

```js
import { Camera, CameraResultType } from '@capacitor/camera';
const photo = await Camera.getPhoto({
  quality: 90, resultType: CameraResultType.Uri, source: 'CAMERA'
});
const blob = await (await fetch(photo.webPath)).blob();
HL.ocr.recognize(blob, onStep).then(res => HL.ocr.mountVerify(...));
```

壳里的好处是能连续拍多页、能自动裁边，比网页的 `<input>` 体验好一档。但这是锦上添花，不是前置条件。

识别引擎和语言包共 5.7MB，打包进壳里就是本地资源，**完全离线可用**，比网页版还快。

### 2.1 PDF 在壳里要单独处理

网页版已经支持直接传 PDF（文字层抽取 + 扫描件转 OCR）。但**原生 WebView 的文件选择器对 `application/pdf` 的支持不一致**——Android 一般能选，iOS 上 `<input type="file" accept="application/pdf">` 有时只给「照片图库」不给「文件」。

套壳后建议这样处理：

```js
// 判断是否原生，原生就走 Filesystem 插件选文件
const native = window.Capacitor?.isNativePlatform?.();
if (native) {
  const { FilePicker } = await import('@capacitor/file-picker');  // 或 @capawesome/capacitor-file-picker
  const res = await FilePicker.pickFiles({ types: ['application/pdf', 'image/*'] });
  // 拿到 path → Filesystem.readFile → blob → HL.pdf.parse / HL.ocr.recognize
}
```

三条注意：
1. `vendor/pdf/` 那 1.4MB 在壳里也是本地资源，首次解析不用等下载
2. PDF worker 在 WebView 里走 `file://` 或 `http://localhost`，`workerSrc` 要用相对路径，别写绝对 URL
3. 扫描件 PDF 转 canvas 时，WebView 的 canvas 内存上限比桌面低，**页数多的大 PDF 要逐页释放**（`page.cleanup()`），否则低端安卓机会被系统杀掉

### 2.2 就诊摘要的打印与分享

网页版摘要支持「打印」和「存图」。壳里这两个能力要换成原生：

- **打印**：`@capacitor-community/printer` 或直接 `window.print()`（iOS WKWebView 不支持，Android 部分支持）
- **存图**：`@capacitor/share` 分享 `dataURL` 转成的临时文件，比让用户去相册找更顺
- 实际最常用的是「**把图发给医生/家人**」，所以 `@capacitor/share` 优先级高于打印

摘要的 canvas 是 750px 宽竖版，和分享卡同一套尺寸，微信里发出去不会被裁。

---

## 五、诚实的话：API 到底解锁了什么

先纠正我自己之前的说法。我一度说「OCR 要等 API」——**这是错的**，纯前端已经做出来了，18/18 项还原。现在真正还差 API 的只剩一件事：

| 待办 | 差 API 吗 | 现在能做吗 |
| :-- | :-- | :-- |
| 拍照识别（图片→结构化指标） | ❌ 不差 | ✅ **已完成**（`js/ocr.js`，本机 Tesseract + 自研预处理，18/18） |
| 影像描述结构化（从「结节 2.4×1.7mm」里抽数字） | ✅ 差 | 否，等 key |
| 指标名模糊匹配（各医院叫法不同） | ❌ 不差 | ✅ **已完成**（`HL.matchId`，60/60 命中） |
| 数据完整度提示（解决「查得少反而分高」） | ❌ 不差 | ✅ **已完成**（11 个常见项目计数 + 分数可能偏高的说明） |
| 分享卡生成 | ❌ 不差 | ✅ **已完成**（`js/share.js`，canvas 手绘竖图） |
| 多份报告趋势对比 | ❌ 不差 | ✅ **已完成**（`js/trend.js`，手动补录 + 折线） |
| 跨平台壳（iOS + Android） | ❌ 不差 | ⏳ 差 Android Studio / Xcode |
| 本地定时提醒 | ❌ 不差 | ⏳ 差上面那套工具链 |
| 账号与云端同步 | ❌ 不差 | ⏳ 需要云服务（不是 API key 那种） |

**现在 API 只解锁一件事：把影像描述里的数字抽出来。** 其余全部做完，再往下是工具链（Android Studio / Mac）和云服务（账号同步），都不是靠等一个 key 能解决的。

所以顺序上我建议：**先装 Android Studio 把壳跑起来**（这一步能立刻看到「手机上有个 App」）。识别已经能用了，装完壳直接就是完整产品。影像结构化放到最后——它是全项目唯一真正需要模型的地方，而且影响面最小（影像项本来就有家族兜底）。

---

## 六、版本与体积预期

| 项 | 数值 |
| :-- | :-- |
| Capacitor 版本 | 7.x（2026 年当前稳定版） |
| Android APK 体积 | 约 4–6 MB（含 WebView 容器，不含系统 WebView） |
| iOS ipa 体积 | 约 8–12 MB |
| 现有 Web 资源 | 约 200 KB（js + css + html） |
| 图标资源 | 约 60 KB |
| 启动时间 | 冷启动 < 1.5s（纯静态，无网络请求） |

体积几乎全部来自原生容器，Web 资源可以忽略。这也意味着**离线完全可用**，不需要任何网络。

---

## 七、风险清单

| 风险 | 影响 | 应对 |
| :-- | :-- | :-- |
| 没有 Mac，iOS 出不了包 | 只能先做 Android | 云构建，或借 Mac |
| Android Studio 体积大（约 8 GB） | 占磁盘 | 装完可以只保留 SDK，卸载 IDE 也能用命令行出包 |
| 上架医疗类目被拒 | 只能自用/内测 | 定位改为「健康记录工具」，或挂靠机构 |
| iOS 免费签名 7 天过期 | 要重装 | 上 TestFlight（$99/年）就解决 |
| WKWebView 清 localStorage | 打卡记录丢失 | 第 6 步换 Preferences 插件 |
| 系统 WebView 版本差异 | 老安卓机上样式错乱 | 最低支持 Android 7（WebView 可独立更新，实际风险低） |

---

## 八、一句话总结

**不用重写，套 Capacitor 壳。** 4000 行 JS 原样复用，Windows 上能做完 Android 全流程，iOS 只差一台 Mac 或云构建。打包后拿到的最有价值的东西不是「有个图标」，是**真正的本地定时提醒**——那才是你最早想要的东西，也是网页永远做不到的那件事。

顺序建议：**先装 Android Studio 把壳跑起来 → 再接 OCR**。API 只解决识别，不解决分发。
