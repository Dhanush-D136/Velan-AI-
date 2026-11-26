const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
  }
  return (c ^ -1) >>> 0;
}
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generatePng(size, outPath) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const rCorner = size * 0.22;

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter type 0
    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 4;
      const t = (x + y) / (2 * size);

      // Indigo (#6366F1) -> Violet/Pink (#A855F7) gradient
      let r = Math.round(99 + (168 - 99) * t);
      let g = Math.round(102 + (85 - 102) * t);
      let b = Math.round(241 + (247 - 241) * t);
      let a = 255;

      // Rounded-square mask
      const dx = Math.max(0, Math.abs(x - size / 2) - (size / 2 - rCorner));
      const dy = Math.max(0, Math.abs(y - size / 2) - (size / 2 - rCorner));
      if (dx * dx + dy * dy > rCorner * rCorner) {
        a = 0;
      }

      // Draw crisp white 4-point sparkle in center
      if (a > 0) {
        const cx = (x - size / 2) / (size * 0.32);
        const cy = (y - size / 2) / (size * 0.32);
        const starDist = Math.pow(Math.abs(cx), 0.55) + Math.pow(Math.abs(cy), 0.55);
        if (starDist < 0.72 && starDist > 0.52) {
          r = 255; g = 255; b = 255;
        } else if (starDist <= 0.52 && (Math.abs(cx) < 0.08 || Math.abs(cy) < 0.08)) {
          r = 255; g = 255; b = 255;
        }
      }

      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const png = Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);

  fs.writeFileSync(outPath, png);
  console.log('Generated:', outPath, size + 'x' + size, png.length, 'bytes');
}

const pubDir = path.resolve(__dirname, '../client/public');
generatePng(192, path.join(pubDir, 'icon-192.png'));
generatePng(512, path.join(pubDir, 'icon-512.png'));
