<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="media/livliv-player-wordmark-white.svg">
    <img alt="LivLiv Player" src="media/livliv-player-wordmark-2000.png" width="360">
  </picture>
</p>

<p align="center">
  超轻量的 2.5D 网页角色播放器，支持口型同步和摄像头面捕，几行代码就能接入网页、直播画面和应用。<br>
  自带 21 个风格各异的精选角色，即开即用。
</p>

<p align="center"><a href="README.md">English</a> · <b>中文</b> · <a href="README.ja.md">日本語</a> · <a href="README.vi.md">Tiếng Việt</a></p>

<p align="center"><img src="media/demo.gif" alt="精选角色在呼吸、眨眼、转头、说话" width="720"></p>

特点：

- WebGL2，无依赖，核心 gzip 后约 30 KB
- 口型同步（麦克风、音频、视频）和摄像头面捕（MediaPipe），都在浏览器里运行，按需引入
- 支持 LivLiv、VRM 和 PNGTuber 三种角色，用同一套接口
- [`characters/`](characters/) 里有 21 个精选角色，可以直接用

## 试一试

- **在线**：示例页在 [livliv-dev.github.io/player](https://livliv-dev.github.io/player/)。
- **在本地**：`npm install && npm run build`，用任意静态服务器打开这个目录，访问 `/example/demo.html`
  （表情、动作、麦克风、摄像头；`?model=../characters/<id>/` 换一个角色）。`/example/png.html` 和
  `/example/vrm.html` 是 PNGTuber 和 VRM。
- **在 livliv.ai 上**：那里的每个角色页都用同一套渲染播放这个角色。从 [livliv.ai/discover](https://livliv.ai/discover) 开始。

## Project LivLiv

我们希望，创造角色这件事能属于每一个人。

我们正在开源 AI 角色创作工具链、播放器与播放协议，还有一方舞台，让你创作的角色与大家见面。

欢迎来 [Discord](https://discord.gg/ac5qF36T2H) 聊聊角色创作，也可以在 [X（Twitter）](https://x.com/livliv_ai) 上关注我们。

## 在自己的页面里用

```sh
npm install @livliv-dev/player
```

```js
import { Player } from '@livliv-dev/player'

const player = new Player(document.querySelector('canvas'))
await player.load('characters/k01/')   // 含 model.json 和 textures/ 的文件夹，或一个 .livliv 文件

player.setExpression('smile')          // 可用的 id 在 player.expressions 里
player.act('nod')
player.params.mouthOpen = 0.6          // 0..1
```

口型同步和面捕：

```js
import { createSpeech } from '@livliv-dev/player/voice'
import { startFaceTracking } from '@livliv-dev/player/tracking'   // 需要 @mediapipe/tasks-vision

const speech = createSpeech(player)
button.onclick = () => { speech.unlock(); speech.say('/reply.mp3') }

await startFaceTracking(player)
```

VRM 和 PNGTuber 用同一套接口：

```js
import { BodyPlayer } from '@livliv-dev/player/body'
import { VrmBody } from '@livliv-dev/player/vrm'    // 需要 three 和 @pixiv/three-vrm
import { PngBody } from '@livliv-dev/player/png'

const vrm = new BodyPlayer(canvasA, new VrmBody())
await vrm.load('/avatars/me.vrm')
const png = new BodyPlayer(canvasB, new PngBody())
await png.load({ closed: 'me-closed.png', open: 'me-open.png' })
```

完整的 API 见 [API.md](API.md)（英文）：选项、参数、表情和动作、驱动、录下的姿态和挂点、VRM 和 PNGTuber、不可信文件的上限、模型包和格式版本。LivLiv 模型包格式（`.livliv`、`model.json` v4）见 [FORMAT.md](FORMAT.md)，JSON Schema 在 [`schema/`](schema/)；v4 之前导出的模型包见 [FORMAT-v3.md](FORMAT-v3.md)，照样能播放。

> npm 包里只有播放器。精选角色在这个仓库的 [`characters/`](characters/) 里，把要用的角色连同许可一起复制到你的页面旁边。

## 精选角色

`characters/` 里有 21 个角色，可以直接 `load()`。它们右下角带一个小小的 LivLiv 标，播放器会画出来。它们**不**适用 Apache 许可。大部分由 LivLiv 制作：个人非商业用途可以免费使用，请署名（「角色：LivLiv（livliv.ai）」）；不能出售、不能商用、不能用来训练 AI 模型。Nana 是 LivLiv 的吉祥物。完整条款见 [characters/LICENSE.md](characters/LICENSE.md)。

Kujira、Kujira Q 和 Pen 来自别人的作品，不适用上面的许可和署名。它们的来源、署名和条款见 [characters/CREDITS.md](characters/CREDITS.md)。

每个角色还带一张 `cover.webp`（512 x 768，约 50 KB），是它的第一帧，不带标。`player.load(source, { poster })` 会在第一帧出来之前把它显示在画布上。如果想在脚本运行之前就有画面，就把它放在画布下面（`object-fit: contain`），角色好了再淡入，[example/loading.js](example/loading.js) 就是这样做的。

角色列表见[英文 README](README.md#featured-characters)。

## 用自己的角色

可以导入 PNGTuber 的几张图，或 VRM（用 three.js 画）；也可以在 [livliv.ai](https://livliv.ai) 用一张图做出自己的角色。

- **PNGTuber**：两张图（闭嘴、张嘴），有闭眼的两张更好。
- **VRM**：VRoid Studio 或任何能导出 VRM 0.x / 1.0 的工具做的。
- **LivLiv 模型**：在 [livliv.ai](https://livliv.ai) 用一张图做出角色，在角色页下载**模型包**（一个 `.livliv` 文件），直接传给 `load()`（URL，或用户选的 `File`），解压后的文件夹也可以。免费版的模型包带 LivLiv 水印，播放器会画出来。全身角色也能播放（0.5 起），双脚站在地面上；livliv.ai 暂时还不提供全身角色的模型包。

## 关于播放器和角色

LivLiv Player 和 `.livliv` 格式是 LivLiv 独立做的，没有用 Live2D 的软件或 Cubism SDK，也不读 `.moc3` / `.cmo3` 文件。「Live2D」是 Live2D Inc. 的商标，LivLiv 与其无关联。

在 livliv.ai 上制作角色会用到 AI。播放器本身只负责播放：不调用 AI 服务，只读取你指给它的文件。面捕在浏览器里运行 Google 的 MediaPipe，摄像头画面不离开设备；网络方面的细节见 API.md。

仓库里的精选角色也是在 LivLiv 上做的，同样用到了 AI；Kujira、Kujira Q 和 Pen 改编自别人的角色（[来源](characters/CREDITS.md)）。Nana 精修版（`d03ft`）另外用 LivLiv 自己的工具加了会摆动的部件和转头的关键形。

模型包里的 `meta.author` 和 `meta.license` 记的是署名和使用条款，请保留并遵守。公开展示用 LivLiv 做的角色时，请注明 AI 参与制作，不要说成手绘或人工绑定的作品。

## 不写代码，直接嵌入

```html
<iframe src="https://livliv.ai/live/k01" width="480" height="640" allow="camera; microphone"
  style="border:0;background:transparent"></iframe>
```

同一个 `/live/<id>` 页面背景透明，可以直接作为 OBS 的浏览器源。\
(Powered by [https://livliv.ai](https://livliv.ai))

## 开发

```sh
git clone https://github.com/livliv-dev/player
cd player
npm install
npm run check          # 类型检查
npm run build          # dist/：index.js、tracking.js、voice.js、body.js、png.js、vrm.js（ES 模块）、chunks/ 和 types/
npm test               # 单元测试和模糊测试（Node 22.18 及以上，不需要浏览器）
npm run test:browser   # 在无头 Chromium 里画出每个精选角色；先执行一次 npx playwright-core install chromium-headless-shell
npm run test:engines   # 在 Firefox 和 WebKit 上跑一个小样本，机器要能启动 WebGL2（有 GPU 或软件 GL）；先执行一次 npx playwright-core install firefox webkit
```

`src/runtime/` 是 livliv.ai 自己在用的渲染和动作代码，这个仓库从它发布。参见 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题请按 [SECURITY.md](SECURITY.md) 报告。

## 浏览器支持

需要 WebGL2 和 ES2023：Chrome / Edge 97+、Firefox 104+、Safari 15.4+。目前在桌面最新版上测过，手机还没有测。

## 许可

代码采用 [Apache License 2.0](LICENSE)（另见 [NOTICE](NOTICE)）。精选角色有自己的许可：[characters/LICENSE.md](characters/LICENSE.md)。两份许可都不包括 LivLiv 的名称和标志。

## 致谢

感谢上善无形、ZipZipPipe 和贱兔死顺盖，Kujira、Kujira Q 和 Pen 基于他们的角色，详见 [characters/CREDITS.md](characters/CREDITS.md)。
