<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="media/livliv-player-wordmark-white.svg">
    <img alt="LivLiv Player" src="media/livliv-player-wordmark-2000.png" width="360">
  </picture>
</p>

<p align="center">
  超軽量の Web 向けキャラクタープレイヤー。リップシンクと Web カメラのフェイストラッキングに対応し、数行のコードでページや配信画面、アプリに組み込めます。<br>
  さまざまなスタイルの厳選キャラクター 25 体を同梱。すぐに使えます。
</p>

<p align="center"><a href="README.md">English</a> · <a href="README.zh-CN.md">中文</a> · <b>日本語</b> · <a href="README.vi.md">Tiếng Việt</a></p>

<p align="center"><img src="media/demo.gif" alt="厳選キャラクターが呼吸し、まばたきし、振り向き、話す様子" width="720"></p>

- WebGL2、依存なし、コアは gzip で約 30 KB
- リップシンク（マイク、音声、動画）と Web カメラのフェイストラッキング（MediaPipe）はブラウザ内で動作し、必要なときだけ読み込めます
- LivLiv・VRM・PNGTuber のキャラクターを同じ API で再生
- 全身のキャラクターは足を地面に着けたまま、揺れ、しゃがみ、話すと上半身が沈みます。表示範囲も選べます
- [`characters/`](characters/) に厳選キャラクター 25 体。すぐに使えます

## 試してみる

- **オンラインで**：デモページは [livliv-dev.github.io/player](https://livliv-dev.github.io/player/) にあります。
- **手元で**：`npm install && npm run build` のあと、このフォルダを静的サーバーで配信して `/example/demo.html` を開きます
  （表情、アクション、マイク、カメラ。`?model=../characters/<id>/` でキャラクターを切り替え）。`/example/png.html` と
  `/example/vrm.html` は PNGTuber と VRM です。
- **livliv.ai で**：各キャラクターのページで、同じレンダラーがそのキャラクターを動かしています。[livliv.ai/discover](https://livliv.ai/discover) からどうぞ。

## Project LivLiv

誰もが、思い描いたキャラクターをかたちにできるように。それが私たちの願いです。

AI を使ったキャラクター制作のツール群、プレイヤーとその再生プロトコル、そしてキャラクターをお披露目できる舞台をオープンソース化しています。

ぜひ [Discord](https://discord.gg/ac5qF36T2H) に遊びに来てください。[X（Twitter）](https://x.com/livliv_ai) でも LivLiv をフォローしてもらえたらうれしいです。

## 自分のページで使う

```sh
npm install @livliv-dev/player
```

```js
import { Player } from '@livliv-dev/player'

const player = new Player(document.querySelector('canvas'))
await player.load('characters/k01/')   // model.json と textures/ のあるフォルダ、または .livliv ファイル

player.setExpression('smile')          // 使える id は player.expressions に
player.act('nod')
player.params.mouthOpen = 0.6          // 0..1
```

リップシンクとフェイストラッキング：

```js
import { createSpeech } from '@livliv-dev/player/voice'
import { startFaceTracking } from '@livliv-dev/player/tracking'   // @mediapipe/tasks-vision が必要

const speech = createSpeech(player)
button.onclick = () => { speech.unlock(); speech.say('/reply.mp3') }

await startFaceTracking(player)
```

VRM や PNGTuber も同じ API で：

```js
import { BodyPlayer } from '@livliv-dev/player/body'
import { VrmBody } from '@livliv-dev/player/vrm'    // three と @pixiv/three-vrm が必要
import { PngBody } from '@livliv-dev/player/png'

const vrm = new BodyPlayer(canvasA, new VrmBody())
await vrm.load('/avatars/me.vrm')
const png = new BodyPlayer(canvasB, new PngBody())
await png.load({ closed: 'me-closed.png', open: 'me-open.png' })
```

API の全体は [API.md](API.md)（英語）にあります：オプション、パラメーター、表情とアクション、ドライバー、記録したポーズと取り付け位置、VRM と PNGTuber、信頼できないファイルの上限、モデルパッケージ、フォーマットのバージョン。LivLiv のパッケージ形式（`.livliv`、`model.json` v4）は [FORMAT.md](FORMAT.md)、JSON Schema は [`schema/`](schema/) にあります。v4 より前に書き出したパッケージは [FORMAT-v3.md](FORMAT-v3.md) のとおりで、そのまま再生できます。

> npm パッケージに入っているのはプレイヤーだけです。厳選キャラクターはこのリポジトリの [`characters/`](characters/) にあります。使うキャラクターをライセンスと一緒にページのそばにコピーしてください。

## 全身のキャラクター

<p align="center"><img src="media/full-body.webp" alt="Tsubaki、Neve、Juno、Viola：全身の厳選キャラクター 4 体" width="560"></p>

全身のキャラクターは頭から足まで描かれ、地面に立っています。上半身は半身のキャラクターと同じように動き、体全体は足首を支点に揺れ、腰は重心を移し、スカートの裾は少し遅れてついてきます。ジャンプの前やカメラに身を乗り出したときは、足はそのままで膝を曲げてしゃがみます。表示範囲は `view.fit` で選べます。

```js
player.view.fit = 'whole'   // 'frame'（頭と胸まで、既定）、'knee'（膝まで）、'whole'（全身）
```

ドライバーは `frame.grounded` を読み、`frame.talk` で上半身を沈ませられます。記録したポーズにはしゃがみと沈みも残ります。詳しくは API.md の [Full-body characters](API.md#full-body-characters) をご覧ください。

## 厳選キャラクター

`characters/` には 25 体のキャラクターが入っていて、そのまま `load()` できます（f05〜f08 の 4 体は全身）。これらには Apache License は**適用されません**。大半は LivLiv が制作したもので、個人の非商用利用は、クレジット（「キャラクター：LivLiv（livliv.ai）」）を入れれば無料です。販売、商用利用、AI モデルの学習には使えません。Nana は LivLiv のマスコットです。条文は [characters/LICENSE.md](characters/LICENSE.md) をご覧ください。

Kujira、Kujira Q、Pen は他の方の作品に基づくもので、上記のライセンスとクレジットは適用されません。出典、クレジット、条件は [characters/CREDITS.md](characters/CREDITS.md) をご覧ください。

各キャラクターには `cover.webp`（512 x 768、約 50 KB。全身のキャラクターは全身が入った 512 x 1024）もあります。最初のフレームです。`player.load(source, { poster })` を使うと、最初のフレームが出るまでキャンバスに表示されます。スクリプトが動く前から絵を出したいときは、キャンバスの下に `object-fit: contain` で置き、準備ができたらキャラクターをフェードインさせます（[example/loading.js](example/loading.js) がこの方法です）。

キャラクターの一覧は[英語の README](README.md#featured-characters) にあります。

## 自分のキャラクター

PNGTuber の画像や VRM（three.js で描画）を読み込めます。[livliv.ai](https://livliv.ai) で 1 枚の絵から自分のキャラクターを作ることもできます。

- **PNGTuber**：2 枚の画像（口を閉じた絵、開いた絵）。目を閉じた 2 枚もあればなお良いです。
- **VRM**：VRoid Studio など、VRM 0.x / 1.0 を書き出せるツールで作ったもの。
- **LivLiv のモデル**：[livliv.ai](https://livliv.ai) で 1 枚の絵からキャラクターを作り、キャラクターページから**モデルパッケージ**（`.livliv` ファイル）をダウンロードします。そのまま `load()` に渡せます（URL、または選んでもらった `File`）。展開したフォルダでも構いません。全身のキャラクターも再生できます（0.5 から）。livliv.ai ではまだ全身キャラクターのパッケージを提供していません。

## プレイヤーとキャラクターについて

LivLiv Player と `.livliv` 形式は LivLiv が独自に開発したもので、Live2D のソフトウェアや Cubism SDK は使っておらず、`.moc3` / `.cmo3` ファイルも読み込みません。「Live2D」は Live2D Inc. の商標であり、LivLiv は同社と提携していません。

livliv.ai でのキャラクター制作には AI を使います。プレイヤー自体は再生するだけです。AI のサービスを呼び出すことはなく、指定されたファイルだけを読み込みます。フェイストラッキングはブラウザ内で Google の MediaPipe を動かし、カメラの映像は端末の外に出ません。通信について詳しくは API.md をご覧ください。

このリポジトリの厳選キャラクターも LivLiv で作ったもので、同じく AI を使っています。Kujira、Kujira Q、Pen は他の方のキャラクターを翻案したものです（[クレジット](characters/CREDITS.md)）。Nana のリファイン版（`d03ft`）には、LivLiv 独自のツールで揺れるパーツと振り向きのキーフォームを加えています。

パッケージの `meta.author` と `meta.license` は、クレジットと利用条件を記したものです。残したうえで従ってください。LivLiv で作ったキャラクターを公開するときは AI が制作に関わっていることを明記し、手描きや手作業のリギングによる作品として紹介しないでください。

## コードを書かずに埋め込む

```html
<iframe src="https://livliv.ai/live/k01" width="480" height="640" allow="camera; microphone"
  style="border:0;background:transparent"></iframe>
```

同じ `/live/<id>` ページは背景が透明なので、そのまま OBS のブラウザソースに使えます。\
(Powered by [https://livliv.ai](https://livliv.ai))

## 開発

```sh
git clone https://github.com/livliv-dev/player
cd player
npm install
npm run check          # 型チェック
npm run build          # dist/：index.js、tracking.js、voice.js、body.js、png.js、vrm.js（ES モジュール）、chunks/ と types/
npm test               # ユニットテストとファジング（Node 22.18 以降、ブラウザ不要）
npm run test:browser   # ヘッドレス Chromium で全キャラクターを描画。最初に一度 npx playwright-core install chromium-headless-shell
npm run test:engines   # Firefox と WebKit で小さなサンプルを実行。WebGL2 が動く環境（GPU かソフトウェア GL）が必要。最初に一度 npx playwright-core install firefox webkit
```

`src/runtime/` は livliv.ai 自身が使っているレンダラーとモーションのコードで、このリポジトリはそこから公開しています。[CONTRIBUTING.md](CONTRIBUTING.md) もご覧ください。セキュリティの問題は [SECURITY.md](SECURITY.md) のとおりにご報告ください。

## 対応ブラウザ

WebGL2 と ES2023 が必要です：Chrome / Edge 97+、Firefox 104+、Safari 15.4+。テスト済みなのはデスクトップの最新版で、スマートフォンはまだテストしていません。

## ライセンス

コードは [Apache License 2.0](LICENSE) です（[NOTICE](NOTICE) も参照）。厳選キャラクターには別のライセンス [characters/LICENSE.md](characters/LICENSE.md) があります。LivLiv の名前とロゴは、公式版を名乗らない限り、あなたのバージョンでもそのまま使えます。

## 謝辞

Kujira、Kujira Q、Pen の元になったキャラクターの作者である上善无形さん、ZipZipPipe さん、贱兔死顺盖さんに感謝します。詳しくは [characters/CREDITS.md](characters/CREDITS.md) をご覧ください。
