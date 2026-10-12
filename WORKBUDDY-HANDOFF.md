# FIRST MIX — WorkBuddy 总交接

这份文件是项目的单一交接入口。它把当前设计规范、已组合页面、保留的旧版页面、3D 控台、音乐、状态存储、验证方式和可直接复制给 WorkBuddy 的完整话术集中在一起。

## 1. 项目位置与启动

- 项目根目录：`C:\Users\sunchenxi\WorkBuddy\2026-09-08-21-15-22\dreamcore-loader-home\first-mix`
- 本交接文件：`C:\Users\sunchenxi\WorkBuddy\2026-09-08-21-15-22\dreamcore-loader-home\first-mix\WORKBUDDY-HANDOFF.md`
- 安装依赖：在项目根目录运行 `npm install`
- 启动：`npm start`
- 测试：`npm test`
- 本地入口：`http://127.0.0.1:4177/`

不要通过直接打开本地 HTML 文件测试。课程页面会使用 `fetch`、ES Module、Web Audio 和 Three.js，必须通过本地服务器访问。

## 2. “组合成一个”的准确含义

当前交付是一套连贯的网站，但不把所有页面强行合并为一个 HTML 文件：

1. `index.html` 是唯一的新版应用文件，内部包含首页、学习页、打碟台和“我的”。
2. 首页主按钮切换到 `index.html?view=learning` 对应的统一学习视图。
3. 学习视图是新版 A＋C，负责进入 00–05 课程。
4. 底部导航在同一个主应用中切换学习、`index.html?view=practice` 的新版 C 风格打碟台和 `index.html?view=my` 的“我的”。
5. 00–05 课程内页继续保留各自已经验证过的旧版界面和交互，不自动换肤。
6. 06、07 虽然存在实验文件，但学习页继续显示“调整中”，暂不作为正式开放课程。

原来的 `learning.html`、`learning.css`、`learning.js` 已在迁移验证通过后删除。不要重新创建第二套学习页；统一学习视图只在 `index.html`、`styles.css`、`app.js` 中维护。

这是一个产品和导航上的整体，不是一次全站视觉重做。不要为了“统一”而把尚未修改的旧版课程强制改成新版。

## 3. 当前页面地图

| 页面 | 本地 URL | 源文件 | 当前状态 |
|---|---|---|---|
| 首页 | `/index.html` | `index.html`、`styles.css`、`app.js` | 新版 C 环境，已接入学习页 |
| 学习页 | `/index.html?view=learning` | `index.html`、`styles.css`、`app.js` | 新版 A＋C，已合并进主应用 |
| 打碟台 | `/index.html?view=practice` | `index.html`、`styles.css`、`app.js`、`controller-3d.*` | 新版 C 环境，3D 控台 |
| 我的 | `/index.html?view=my` | `index.html`、`styles.css`、`app.js`、`works-store.js` | 旧版现状，未要求重做 |
| 00 第一次交接 | `/concepts/course-00-playable.html` | 同名 HTML | 可操作，旧版外观保留 |
| 01 设置开始位置 | `/concepts/course-01-playable.html` | 同名 HTML | 可操作，旧版外观保留 |
| 02 听懂音乐结构 | `/concepts/course-02-playable.html` | 同名 HTML | 可操作，旧版外观保留 |
| 03 让两首歌对齐 | `/concepts/course-03-playable.html` | 同名 HTML | 可操作，旧版外观保留 |
| 04 在正确时间接入 | `/concepts/course-04-playable-standard.html` | 同名 HTML | 正式版本；不要编辑重定向壳 |
| 05 让转场保持清晰 | `/concepts/course-05-playable.html` | 同名 HTML | 可操作，旧版外观保留 |
| 06 选择短交接或长混合 | `/concepts/course-06-playable.html` | HTML、JS、`course-06-07-playable.css` | 实验稿，暂停调整 |
| 07 独立完成与 AI 评分 | `/concepts/course-07-playable.html` | HTML、JS、`course-06-07-playable.css` | 实验稿，暂停调整 |
| 风格方向板 | `/concepts/direction-board.html` | 同名 HTML | A/B/C 决策参考；当前采用 A＋C |
| 00–07 交互脚本总览 | `/concepts/course-00-07-interaction-scripts.html` | 同名 HTML 与脚本页 | 课程逻辑参考，不是产品入口 |

`course-04-playable.html` 只负责跳转到 `course-04-playable-standard.html`。04 的正式修改必须落在 `course-04-playable-standard.html`。

## 4. 当前设计规范

### 4.1 视觉架构

- **C 是新版页面的柔和环境层**：蓝绿、雾蓝、浅紫和淡粉形成安静、有空气感的音乐空间。
- **A 是学习内容层**：学习内容放在清晰的浅色面板里，强调进度、单一下一步和即时反馈。
- 首页和打碟台使用 C 环境；学习页是 C 承载 A。
- 00–05 旧版课程暂时保留旧版，不因 C 是环境层就自动重绘。
- 不再使用旧学习背景图。环境感由 CSS 色彩和光线完成。

当前 C 色彩令牌在 `styles.css` 末尾：

| 角色 | 值 |
|---|---|
| 蓝绿画布 | `#b9dedf` |
| 雾蓝画布 | `#dce8eb` |
| 浅紫画布 | `#d9ccec` |
| 淡粉画布 | `#efdcda` |
| 主文字 | `#211c29` |
| 次文字 | `#665e70` |
| 信息 / 选中 | `#7253b7` |
| 选中浅底 | `#e9e0f7` |
| 当前动作 | `#baff2e` |

### 4.2 不可破坏的设计规则

- 不擅自改变已验证页面的结构、间距、行距、字号、圆角、控件尺寸和操作顺序。
- 功能色保持稳定：荧光绿只表示当前动作或完成，紫色表示信息和选中，深色用于设备和高对比操作。
- 操作区必须有明确边界，不能因为透明白底而失去层级。
- 提示区保留紫色边框和当前动作按钮，不要与主操作区融成一片。
- FIRST MIX 字标使用 `GochiHand.woff2`；界面正文使用系统中文无衬线；数据可使用 `Cubic_11.woff2`。
- 字体文件全部在 `fonts/`，不要改成在线字体依赖。
- 页面至少验证手机竖屏、手机横屏和桌面。移动端不得横向溢出，固定底栏不得遮挡操作。
- 文字和控件不能只靠颜色表达状态；键盘焦点必须可见；尊重 `prefers-reduced-motion`。
- 完整规范优先阅读 `DESIGN.md`，产品边界阅读 `PRODUCT.md`。

### 4.3 明确过时的参考

- `design-system/first-mix/MASTER.md` 是早期自动生成的红 / 橙方案，已经过时，不能作为当前配色依据。
- `DESIGN-RESET.md` 是历史重置记录，只用于理解过去决策。
- `assets/learning-background-v1.png` 与 `learning-background-v2.png` 已退役，不要在新版页面重新使用。
- 根目录的 `tmp-*.png`、`.tmp-*.png`、`title-comparison.png` 是过程截图或对照图，不是线上资源。

## 5. 3D 打碟台

### 5.1 文件位置

- 模型生成与控制映射：`controller-3d.js`
- 叠加控件、热区和响应式样式：`controller-3d.css`
- 音频状态与主应用连接：`app.js`
- 音频引擎：`audio-engine.js`
- Three.js 依赖：`package.json`，当前版本 `^0.186.1`

### 5.2 重要事实

项目没有 `.glb`、`.gltf` 或 `.obj` 文件。双唱盘、中央混音区、旋钮、推杆、屏幕和贴纸都由 Three.js 几何体在 `createController()` 中实时创建。

真实 HTML 控件通过 Three.js 投影坐标覆盖在模型表面，因此模型既可以拖动，也保留键盘和辅助技术能力。`data-source` 用于把 3D 表面的控件同步到原生控件；不要只改画面而断开事件映射。

打碟台的 C 材质只在 `body.practice-open` 时启用；课程使用 3D 控台时仍可保留原有材质。这是为了满足“新版与旧版组合，但未修改的旧版不变”。

### 5.3 修改规则

- 改模型尺寸或摄像机后，必须重新检查 HTML 控件投影位置。
- 旋钮拖动、推杆拖动、唱盘 scrub、双击旋钮归零、Play、Cue、Sync 都必须继续操作真实音频状态。
- 不允许用纯动画伪造播放、对拍、Cue、Gain 或完成判定。
- 3D 高亮区域只提示当前操作，不能替用户完成动作。

## 6. 音乐与音频

### 6.1 正式目录

- 所有音频：`assets/tracks/`
- 有来源和许可证元数据的曲目：`assets/tracks/tracks.json`
- 试听候选库：`assets/tracks/audition/`
- 试听候选说明：`assets/tracks/audition-candidates.json`

### 6.2 当前页面实际使用

| 使用位置 | 音频文件 | 备注 |
|---|---|---|
| 主应用 / 通用训练 | `intro-a.mp3`、`intro-b.mp3` | Mixkit 元数据见 `tracks.json` |
| 00 | `audition/edm-at-midnight.mp3`、`audition/rave-sound.mp3` | 旧版课程现用；发布前核对来源 |
| 01 | `audition/venus.mp3` | 旧版课程现用；发布前核对来源 |
| 02 | `audition/course-02-shiki-instrumental.wav`、`audition/course-02-so-far-to-go-vocal.wav` | 旧版课程现用；发布前核对来源 |
| 03 | `course-03-beat-a.wav`、`course-03-beat-b.wav` | 对拍训练素材 |
| 04、05 | `course-04-beat-laments.mp3`、`course-04-ten-years.mp3` | 当前原型素材，公开发布前必须确认授权 |
| 06 | `course-06-a-madoromi.mp3`、`course-06-b1-wo-zhi-zai-hu-ni.mp3`、`course-06-b2-all-night.mp3` | 当前原型素材，公开发布前必须确认授权 |
| 07 | `course-06-a-madoromi.mp3`＋`course-06-b1-wo-zhi-zai-hu-ni.mp3` | 当前原型素材，公开发布前必须确认授权 |

`c00-a.mp3` 至 `c06-b.mp3` 是一组约一分钟的 Mixkit 课程候选 / 备用素材，来源信息在 `tracks.json`。不要因为文件名相似就假定它们是当前课程正在播放的文件。

### 6.3 音频规范

- 统一目标：`-16 LUFS-I`，最大真峰值 `-1 dBTP`。
- 单 Deck 建议上限 `0.90`；双 Deck 对比或叠加每边上限 `0.84`；短 Cue / scrub 试听约 `0.28`。
- 不自动改变系统音量，不用页面专属增益补偿掩盖源文件响度问题。
- 浏览器限制自动播放，必须由用户手势激活音频。
- 页面切换、重置、重做、完成、隐藏时必须停止或断开不再使用的音源，避免后台继续播放影响测试。
- 同一时刻只允许课程声明的音频源发声；试听按钮切换时要先停止上一段。
- 进度条、播放时间、电平、唱盘旋转和完成条件必须来自真实播放状态。
- 按“拍”训练时用 BPM、拍位或相位判断，不要把固定秒数冒充拍数。
- 06 的整段听歌目标约一分钟，不能退化成只有几秒的片段。
- 商业录音只能用于当前本地原型和验证；公开部署、作品集发布或交付第三方前必须取得授权或替换成权利清晰的素材。

## 7. 课程状态与关键约束

- 00–05 的正式入口由 `app.js` 中的 `LEARNING_COURSES` 管理。
- 06、07 在 `index.html` 的统一学习视图中明确显示“调整中”，不要擅自开放。
- 04 的核心判定：B 从目标歌词位置回退 16 拍；回退判定以拍为准，不以秒数为准；目标歌词为“93 年我来到 Westcoast，开始听到 Hiphop”。
- 05 的核心流程：匹配 A/B 基础电平 → B LOW 降低 → 在 16 拍内降低 A LOW 并恢复 B LOW → Crossfader 到 B。
- 06 的目标：通过真实听感判断歌曲关系，选择 16 拍短交接或 32 拍长混合；流程说明两种都要有，但完整引导只使用 A＋B2。
- 07 的目标：A＋B1 完整复习，用户全程独立操作，并引入 AI 评判 / 打分；最终效果尽量接近用户提供的转场录屏。
- 06、07 后续继续开发时使用 3D 模拟器。07 横屏体验优先，按键说明可常驻右上角。
- 所有判定必须基于真实音频、真实控件值和真实操作时序，不允许“点了就过”或隐藏假判定。

## 8. 数据与本地状态

项目当前有两套历史形成的进度记录，不要在没有迁移方案时直接删掉其中一套：

- 独立课程完成标记：`first-mix-course-00-complete` 至 `first-mix-course-05-complete`，学习页读取这一套。
- 主应用旧课程进度：`first-mix-course-progress-v1`。
- 音乐备忘：`first-mix-music-memos-v1`。
- 学习 / 作品 / 备忘活动：`first-mix-activity-log-v1`。
- 首次界面介绍：`first-mix-interface-tour-v2-seen`。
- 教程完成：`first-mix-tutorial-completed`。
- 录制作品：IndexedDB 数据库 `first-mix-local-works`，object store 为 `works`，代码在 `works-store.js`。

## 9. 代码职责

| 文件 | 职责 |
|---|---|
| `index.html` | 首页、学习页、打碟台、“我的”统一 DOM |
| `styles.css` | 主应用旧样式，以及末尾隔离的首页 / 学习页 / 打碟台新版覆盖 |
| `app.js` | 页面状态、统一导航、学习目录、教程、录制、音乐备忘、3D 控台接入 |
| `audio-engine.js` | Web Audio 双 Deck、EQ、Sync、Crossfader、录制输出 |
| `controller-3d.js/css` | 程序化 3D 模型与表面交互 |
| `tutorial-engine.js` | 确定性教程状态机和拍位计算 |
| `bpm-analyzer.js` | 本地音频 BPM 估算 |
| `interface-tour.js` | 首次界面介绍 |
| `works-store.js` | IndexedDB 作品保存 |
| `concepts/course-*-playable.*` | 各课程独立可操作内页 |
| `concepts/course-*-interaction-script*.html` | 各课程交互脚本和制作依据 |

## 10. 验证清单

每次改动后至少完成：

1. `npm test`。
2. `node --check` 检查改过的 JS。
3. 检查 `430 × 932` 手机竖屏。
4. 检查 `932 × 430` 手机横屏，尤其是 3D 控台。
5. 检查 `1440 × 900` 桌面。
6. 从 `/` 实际点击进入学习页，再进入一节旧版课程，再回学习页，再去打碟台。
7. 确认音频离开页面后停止，进度条和唱盘由真实播放状态驱动。
8. 确认没有控制台错误、横向溢出、固定底栏遮挡和不可见焦点。
9. 视觉修改只做一次桌面＋移动端成组检查、一次集中修复、最多一次确认，不进行无止境微调。

## 11. 可直接复制给 WorkBuddy 的完整话术

```text
你现在接手 FIRST MIX 项目。

项目根目录：
C:\Users\sunchenxi\WorkBuddy\2026-09-08-21-15-22\dreamcore-loader-home\first-mix

开始前必须按顺序阅读：
1. WORKBUDDY-HANDOFF.md
2. DESIGN.md
3. PRODUCT.md
4. README.md

这是一个已经组合好的完整网站，但新版与旧版要共存：
- /index.html 是唯一新版主应用文件，默认显示 C 风格首页。
- 首页按钮在主应用内进入 /index.html?view=learning。
- /index.html?view=learning 是新版 A＋C 学习视图。
- 原独立 learning.html/css/js 已删除，不要恢复或复制出第二套入口。
- /index.html?view=practice 是新版 C 风格 3D 打碟台。
- /index.html?view=my 暂时保留当前旧版。
- 00–05 课程内页保留现有旧版外观与已验证交互，不要自动换肤。
- 06、07 文件存在但仍是实验稿，学习页必须继续显示“调整中”，不要擅自开放。

设计原则：C 是柔和的蓝绿—雾蓝—浅紫—淡粉环境层；A 是清晰的浅色学习内容层。荧光绿只用于当前动作或完成，紫色用于信息和选中，深色用于设备与高对比操作。不要使用已经退役的 learning-background-v1/v2.png，也不要采用 design-system/first-mix/MASTER.md 的红橙旧方案。不要擅自改动已有结构、间距、字号、行距、控件尺寸和操作顺序。

3D 打碟台没有 GLB/OBJ 文件。它由 controller-3d.js 使用 Three.js 程序化生成，controller-3d.css 放置真实 HTML 控件和高亮热区，app.js 与 audio-engine.js 连接真实音频状态。任何视觉修改都不能断开 Play、Cue、Sync、唱盘 scrub、旋钮、推杆、Crossfader 与原生控件的映射。

音乐全部在 assets/tracks/。先阅读 tracks.json。00–07 当前使用的具体文件已列在 WORKBUDDY-HANDOFF.md。课程中的商业歌曲只用于本地原型，公开发布前必须确认授权或替换。音频目标为 -16 LUFS-I / -1 dBTP；离开页面、重置或切换试听时必须停止旧音源。所有进度、电平、拍位和课程通过条件都必须读取真实状态，禁止假判定。按拍训练使用 BPM/拍位/相位判断，不用固定秒数冒充拍数。

开发时使用 npm start，访问 http://127.0.0.1:4177/。修改后运行 npm test 和 node --check，并同时检查 430×932、932×430、1440×900。先保护已完成页面，再做当前明确任务；不要顺手重构、全站换肤或删除旧版文件。

每次开始工作先说明将修改哪些文件、哪些页面保持不动；完成后报告实际验证过的路由、操作和音频状态。
```

## 12. 接手者第一步

先从根入口 `/` 走一遍“首页 → 学习页 → 00 课程 → 返回学习页 → 打碟台”，确认新旧页面已经作为一个产品连通。然后再根据新的明确任务修改，不要从 06/07 或全站重构开始。
