<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="media/livliv-player-wordmark-white.svg">
    <img alt="LivLiv Player" src="media/livliv-player-wordmark-2000.png" width="360">
  </picture>
</p>

<p align="center">
  Trình phát nhân vật 2.5D nhẹ cho web, có đồng bộ môi (lip sync) và theo dõi khuôn mặt qua webcam. Chỉ vài dòng code là đưa được nhân vật vào trang web, lớp phủ stream hay ứng dụng.<br>
  Đi kèm 21 nhân vật nổi bật với nhiều phong cách khác nhau, sẵn sàng dùng ngay.
</p>

<p align="center"><a href="README.md">English</a> · <a href="README.zh-CN.md">中文</a> · <a href="README.ja.md">日本語</a> · <b>Tiếng Việt</b></p>

<p align="center"><img src="media/demo.gif" alt="Các nhân vật nổi bật đang thở, chớp mắt, quay đầu và nói chuyện" width="720"></p>

- WebGL2, không phụ thuộc thư viện ngoài, lõi chỉ khoảng 30 KB sau khi nén gzip
- Đồng bộ môi (microphone, audio, video) và theo dõi khuôn mặt qua webcam (MediaPipe), đều chạy trong trình duyệt, chỉ được tải khi bạn cần
- Phát nhân vật LivLiv, VRM và PNGTuber qua cùng một API
- 21 nhân vật nổi bật trong [`characters/`](characters/), sẵn sàng dùng

## Thử ngay

- **Trực tuyến**: các ví dụ chạy trên [livliv-dev.github.io/player](https://livliv-dev.github.io/player/).
- **Tại đây**: `npm install && npm run build`, chạy thư mục này bằng bất kỳ static server nào rồi mở `/example/demo.html`
  (biểu cảm, hành động, microphone, camera; `?model=../characters/<id>/` chọn nhân vật khác).
  `/example/png.html` và `/example/vrm.html` là ví dụ về PNGTuber và VRM.
- **Trên livliv.ai**: trang của từng nhân vật ở đó cũng dùng chính bộ renderer này để chạy nhân vật. Bắt đầu tại
  [livliv.ai/discover](https://livliv.ai/discover).

## Project LivLiv

Chúng tôi mong ai cũng có thể tạo nên nhân vật từ trí tưởng tượng của chính mình.

Chúng tôi đang mở mã nguồn cho bộ công cụ tạo nhân vật bằng AI, trình phát và giao thức phát đi kèm,
cùng một sân khấu để những nhân vật ấy ra mắt khán giả.

Ghé [Discord](https://discord.gg/ac5qF36T2H) trò chuyện với chúng tôi và theo dõi LivLiv trên [X (Twitter)](https://x.com/livliv_ai) nhé.

## Dùng trong trang của bạn

```sh
npm install @livliv-dev/player
```

```js
import { Player } from '@livliv-dev/player'

const player = new Player(document.querySelector('canvas'))
await player.load('characters/k01/')   // thư mục chứa model.json và textures/, hoặc file .livliv

player.setExpression('smile')          // các id có trong player.expressions
player.act('nod')
player.params.mouthOpen = 0.6          // 0..1
```

Đồng bộ môi và theo dõi khuôn mặt:

```js
import { createSpeech } from '@livliv-dev/player/voice'
import { startFaceTracking } from '@livliv-dev/player/tracking'   // cần @mediapipe/tasks-vision

const speech = createSpeech(player)
button.onclick = () => { speech.unlock(); speech.say('/reply.mp3') }

await startFaceTracking(player)
```

VRM hay PNGTuber đều dùng chung một API:

```js
import { BodyPlayer } from '@livliv-dev/player/body'
import { VrmBody } from '@livliv-dev/player/vrm'    // cần three và @pixiv/three-vrm
import { PngBody } from '@livliv-dev/player/png'

const vrm = new BodyPlayer(canvasA, new VrmBody())
await vrm.load('/avatars/me.vrm')
const png = new BodyPlayer(canvasB, new PngBody())
await png.load({ closed: 'me-closed.png', open: 'me-open.png' })
```

Toàn bộ API có trong [API.md](API.md) (tiếng Anh): các tùy chọn, tham số, biểu cảm và hành động, driver, tư thế đã ghi và điểm gắn, nhân vật VRM và PNGTuber,
giới hạn khi đọc file không đáng tin cậy, gói model và phiên bản định dạng. Định dạng gói LivLiv (`.livliv`,
`model.json` v4) có trong [FORMAT.md](FORMAT.md), kèm JSON Schema trong [`schema/`](schema/); các gói xuất trước v4
được mô tả trong [FORMAT-v3.md](FORMAT-v3.md) và vẫn phát được.

> Gói npm chỉ có trình phát. Các nhân vật nổi bật nằm trong [`characters/`](characters/) của repository này: hãy sao chép
> những nhân vật bạn dùng, kèm giấy phép, vào cạnh trang của bạn.

## Nhân vật nổi bật

`characters/` có 21 nhân vật, sẵn sàng để `load()`. Các nhân vật mang một dấu LivLiv nhỏ ở góc dưới bên phải, do
trình phát vẽ lên. Các nhân vật này **không** thuộc phạm vi Giấy phép Apache. Hầu hết do LivLiv tạo ra: bạn được dùng miễn phí cho dự án cá nhân, phi thương mại kèm ghi công
("Characters: LivLiv (livliv.ai)"); không được bán, dùng thương mại hay dùng các nhân vật này để huấn luyện mô hình AI. Nana là
linh vật của LivLiv. Điều khoản có trong [characters/LICENSE.md](characters/LICENSE.md).

Kujira, Kujira Q và Pen dựa trên tác phẩm của người khác: giấy phép và cách ghi công nêu trên không áp dụng cho các nhân vật này. Nguồn,
ghi công và điều khoản của các nhân vật này có trong [characters/CREDITS.md](characters/CREDITS.md).

Mỗi nhân vật còn có một `cover.webp` (512 x 768, khoảng 50 KB), là khung hình đầu tiên của nhân vật, không kèm dấu. `player.load(source, { poster })`
hiện ảnh này trên canvas cho đến khung hình đầu tiên. Muốn có ảnh trước khi script chạy, hãy đặt ảnh này phía sau canvas với
`object-fit: contain` rồi cho nhân vật hiện dần lên trên nó, như [example/loading.js](example/loading.js) đã làm.

| id | tên | id | tên | id | tên |
|---|---|---|---|---|---|
| `k01` | Sena | `d01` | Yui | `v01` | Aster |
| `k02` | Elio | `d02` | Leo | `v03` | Mira |
| `char06` | Aoi | `d03` | Nana | `v04` | Kai |
| `char07` | Sora | `d03ft` | Nana (bản tinh chỉnh) | `v05` | Lilith |
| `s01` | Hana | `p01` | Kujira | `v06` | Usa |
| `q02` | Mochi | `p02` | Kujira Q | `v07` | Stella |
| `q03` | Kotaro | `p03` | Pen | `w01` | Max |

## Nhân vật của riêng bạn

Bạn có thể đưa vào ảnh của một PNGTuber, hoặc một VRM (vẽ bằng three.js); hoặc tự tạo nhân vật của mình từ một
ảnh trên [livliv.ai](https://livliv.ai).

- **Một PNGTuber**: hai ảnh (ngậm miệng, há miệng), và thêm hai ảnh nhắm mắt nếu bạn có.
- **Một VRM**: từ VRoid Studio hoặc bất kỳ công cụ nào xuất VRM 0.x hay 1.0.
- **Một model LivLiv**: tạo một model từ một ảnh trên [livliv.ai](https://livliv.ai), rồi tải gói model từ
  trang của nhân vật đó (**Model package**): một file `.livliv`. Đưa file đó vào `load()` nguyên như vậy (một URL, hoặc `File`
  người dùng đã chọn), hoặc giải nén thành thư mục. Gói model thuộc tài khoản miễn phí (free plan) sẽ mang dấu LivLiv, và trình phát sẽ vẽ dấu đó.
  Nhân vật toàn thân sẽ được hỗ trợ trong một phiên bản sau của trình phát.

## Về trình phát và các nhân vật

LivLiv Player và định dạng `.livliv` là sản phẩm của chính LivLiv. Chúng không dùng phần mềm Live2D hay Cubism SDK và không
đọc file `.moc3` hay `.cmo3`. "Live2D" là nhãn hiệu của Live2D Inc.; LivLiv không liên kết với công ty đó.

Việc tạo nhân vật trên livliv.ai có dùng AI. Bản thân trình phát chỉ phát: nó không gọi dịch vụ AI nào và chỉ đọc các file bạn chỉ định.
Theo dõi khuôn mặt chạy MediaPipe của Google trong trình duyệt, và hình ảnh camera không rời khỏi thiết bị; chi tiết về kết nối mạng có trong API.md.

Các nhân vật nổi bật trong repository này cũng được tạo trên LivLiv, cũng bằng AI; Kujira, Kujira Q và Pen phỏng theo
nhân vật của người khác ([ghi công](characters/CREDITS.md)). Nana bản tinh chỉnh (`d03ft`) còn có thêm
các bộ phận đung đưa và keyform xoay đầu, được thêm bằng công cụ của chính LivLiv.

`meta.author` và `meta.license` của một gói ghi lại ai đã tạo gói đó và với điều khoản nào: hãy giữ nguyên các trường này và tuân theo chúng. Khi bạn
trình bày công khai một nhân vật được tạo bằng LivLiv, hãy nói rõ nhân vật đó được tạo bằng AI, và đừng trình bày nó như được vẽ tay hay
rig thủ công.

## Nhúng không cần code

```html
<iframe src="https://livliv.ai/live/k01" width="480" height="640" allow="camera; microphone"
  style="border:0;background:transparent"></iframe>
```

Chính trang `/live/<id>` này có nền trong suốt và dùng được làm Browser Source trong OBS.\
(Powered by [https://livliv.ai](https://livliv.ai))

## Phát triển

```sh
git clone https://github.com/livliv-dev/player
cd player
npm install
npm run check          # kiểm tra kiểu
npm run build          # dist/: index.js, tracking.js, voice.js, body.js, png.js, vrm.js (ES modules), chunks/ và types/
npm test               # unit test và fuzz test (Node 22.18 trở lên, không cần trình duyệt)
npm run test:browser   # vẽ mọi nhân vật nổi bật trong headless Chromium; chạy một lần trước: npx playwright-core install chromium-headless-shell
npm run test:engines   # một mẫu trên Firefox và WebKit, ở môi trường WebGL2 chạy được (có GPU hoặc software GL); chạy một lần trước: npx playwright-core install firefox webkit
```

`src/runtime/` là code renderer và chuyển động mà livliv.ai đang chạy; repository này được xuất bản từ code đó. Xem
[CONTRIBUTING.md](CONTRIBUTING.md). Báo cáo bảo mật: [SECURITY.md](SECURITY.md).

## Trình duyệt hỗ trợ

WebGL2 và ES2023: Chrome / Edge 97+, Firefox 104+, Safari 15.4+. Đã kiểm tra trên các phiên bản mới nhất của trình duyệt desktop, chưa kiểm tra trên điện thoại.

## Giấy phép

Code thuộc [Giấy phép Apache 2.0](LICENSE) (xem thêm [NOTICE](NOTICE)). Các nhân vật nổi bật có
giấy phép riêng, [characters/LICENSE.md](characters/LICENSE.md). Không giấy phép nào trong hai giấy phép trên bao hàm tên và logo LivLiv.

## Cảm ơn

Cảm ơn 上善无形, ZipZipPipe và 贱兔死顺盖 — các tác giả của nhân vật gốc mà Kujira, Kujira Q và Pen dựa theo: xem chi tiết tại [characters/CREDITS.md](characters/CREDITS.md).
