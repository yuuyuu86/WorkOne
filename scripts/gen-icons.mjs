// MessageDock のアイコンを依存ライブラリなしで生成する。
// - build/icon.png        : アプリアイコン(512px, 角丸の青背景 + 白い吹き出し)
// - build/trayTemplate.png : メニューバー用テンプレート画像(黒の吹き出し)
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'build');
fs.mkdirSync(outDir, { recursive: true });

// ---- PNG エンコーダ(RGBA, フィルタ0) ----
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- 描画ヘルパ(スーパーサンプリング用に大きく描いて縮小) ----
function makeCanvas(size) {
  return { size, buf: new Float32Array(size * size * 4) };
}
function px(c, x, y, [r, g, b, a]) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= c.size || y >= c.size) return;
  const i = (y * c.size + x) * 4;
  const ia = 1 - a;
  c.buf[i] = r * a + c.buf[i] * ia;
  c.buf[i + 1] = g * a + c.buf[i + 1] * ia;
  c.buf[i + 2] = b * a + c.buf[i + 2] * ia;
  c.buf[i + 3] = a + c.buf[i + 3] * ia;
}
function roundRect(c, x, y, w, h, r, color) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h); r = Math.round(r);
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      let inside = true;
      // 角の内側判定
      const corners = [
        [x + r, y + r],
        [x + w - r, y + r],
        [x + r, y + h - r],
        [x + w - r, y + h - r],
      ];
      if (xx < x + r && yy < y + r) inside = dist(xx, yy, corners[0]) <= r;
      else if (xx > x + w - r && yy < y + r) inside = dist(xx, yy, corners[1]) <= r;
      else if (xx < x + r && yy > y + h - r) inside = dist(xx, yy, corners[2]) <= r;
      else if (xx > x + w - r && yy > y + h - r) inside = dist(xx, yy, corners[3]) <= r;
      if (inside) px(c, xx, yy, color);
    }
  }
}
function dist(x, y, [cx, cy]) {
  return Math.hypot(x - cx, y - cy);
}
function triangle(c, p1, p2, p3, color) {
  const minX = Math.floor(Math.min(p1[0], p2[0], p3[0]));
  const maxX = Math.ceil(Math.max(p1[0], p2[0], p3[0]));
  const minY = Math.floor(Math.min(p1[1], p2[1], p3[1]));
  const maxY = Math.ceil(Math.max(p1[1], p2[1], p3[1]));
  const sign = (a, b, p) =>
    (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const p = [x + 0.5, y + 0.5];
      const d1 = sign(p1, p2, p);
      const d2 = sign(p2, p3, p);
      const d3 = sign(p3, p1, p);
      const neg = d1 < 0 || d2 < 0 || d3 < 0;
      const pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos)) px(c, x, y, color);
    }
  }
}
// スーパーサンプル縮小して RGBA(0-255) Buffer に
function downscale(c, target) {
  const factor = c.size / target;
  const out = Buffer.alloc(target * target * 4);
  for (let y = 0; y < target; y++) {
    for (let x = 0; x < target; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < factor; sy++) {
        for (let sx = 0; sx < factor; sx++) {
          const i = ((y * factor + sy) * c.size + (x * factor + sx)) * 4;
          r += c.buf[i]; g += c.buf[i + 1]; b += c.buf[i + 2]; a += c.buf[i + 3];
        }
      }
      const n = factor * factor;
      const o = (y * target + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = Math.round((a / n) * 255);
    }
  }
  return out;
}

// 吹き出しグリフを描く(0..1 座標系を size にスケール)
function drawBubble(c, color) {
  const S = c.size;
  const bx = S * 0.2, by = S * 0.22, bw = S * 0.6, bh = S * 0.42, br = S * 0.1;
  roundRect(c, bx, by, bw, bh, br, color);
  // しっぽ(左下)
  triangle(
    c,
    [S * 0.32, by + bh - 1],
    [S * 0.32, by + bh + S * 0.14],
    [S * 0.46, by + bh - 1],
    color
  );
}

// ---- アプリアイコン(512) ----
{
  const SS = 1024;
  const c = makeCanvas(SS);
  // 角丸の青背景
  const margin = SS * 0.085;
  roundRect(c, margin, margin, SS - margin * 2, SS - margin * 2, SS * 0.2, [10, 132, 255, 1]);
  // 白い吹き出し
  drawBubble(c, [255, 255, 255, 1]);
  // 吹き出し内の2本線(青)
  roundRect(c, SS * 0.3, SS * 0.32, SS * 0.34, SS * 0.05, SS * 0.025, [10, 132, 255, 1]);
  roundRect(c, SS * 0.3, SS * 0.42, SS * 0.24, SS * 0.05, SS * 0.025, [10, 132, 255, 1]);
  const out = downscale(c, 512);
  fs.writeFileSync(path.join(outDir, 'icon.png'), encodePNG(512, 512, out));
  console.log('wrote build/icon.png');
}

// ---- トレイ用テンプレート画像(黒の吹き出し, 32px) ----
{
  const SS = 256;
  const c = makeCanvas(SS);
  drawBubble(c, [0, 0, 0, 1]);
  const out = downscale(c, 32);
  fs.writeFileSync(path.join(outDir, 'trayTemplate.png'), encodePNG(32, 32, out));
  const out2 = downscale(c, 64);
  fs.writeFileSync(path.join(outDir, 'trayTemplate@2x.png'), encodePNG(64, 64, out2));
  console.log('wrote build/trayTemplate.png (+@2x)');
}
