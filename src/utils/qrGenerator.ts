/**
 * Minimal, dependency-free ISO/IEC 18004 QR Code Version 3-L (29x29) Matrix Generator
 * Encodes URLs up to 53 bytes into a crisp boolean[][] grid for instant SVG rendering.
 */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    EXP[i] = EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function computeReedSolomon(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLen);
  const rem = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecLen - 1] = 0;
    for (let j = 0; j < ecLen; j++) {
      rem[j] ^= gfMul(gen[j + 1], factor);
    }
  }
  return rem;
}

// QR Version 4-L: Size 33x33, Total Codewords = 100, Data = 80, EC = 20 (supports URLs up to 78 chars!)
export function generateQrMatrix(text: string): boolean[][] {
  const utf8 = new TextEncoder().encode(text.slice(0, 78));
  const dataCodewords = 80;
  const ecCodewords = 20;
  const size = 33; // Version 4

  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };

  // Byte mode indicator = 0100
  pushBits(0b0100, 4);
  pushBits(utf8.length, 8);
  for (const byte of utf8) {
    pushBits(byte, 8);
  }
  // Terminator up to 4 zero bits
  const maxBits = dataCodewords * 8;
  for (let i = 0; i < 4 && bits.length < maxBits; i++) {
    bits.push(0);
  }
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const dataBytes = new Uint8Array(dataCodewords);
  for (let i = 0; i < bits.length / 8; i++) {
    let b = 0;
    for (let k = 0; k < 8; k++) {
      b = (b << 1) | bits[i * 8 + k];
    }
    dataBytes[i] = b;
  }
  const padBytes = [0xec, 0x11];
  for (let i = bits.length / 8, p = 0; i < dataCodewords; i++, p++) {
    dataBytes[i] = padBytes[p % 2];
  }

  const ecBytes = computeReedSolomon(dataBytes, ecCodewords);
  const allBytes = new Uint8Array(dataCodewords + ecCodewords);
  allBytes.set(dataBytes, 0);
  allBytes.set(ecBytes, dataCodewords);

  const modules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setFunctionModule = (x: number, y: number, dark: boolean) => {
    if (x >= 0 && x < size && y >= 0 && y < size) {
      modules[y][x] = dark;
      isFunction[y][x] = true;
    }
  };

  const drawFinder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = cx + dx;
        const yy = cy + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) {
          setFunctionModule(xx, yy, dist !== 2 && dist !== 4);
        }
      }
    }
  };

  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);

  // Alignment pattern for Version 4 at (24, 24)
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      setFunctionModule(24 + dx, 24 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setFunctionModule(i, 6, i % 2 === 0);
    setFunctionModule(6, i, i % 2 === 0);
  }

  // Reserve Format info & Dark module
  for (let i = 0; i <= 8; i++) {
    if (!isFunction[8][i]) setFunctionModule(i, 8, false);
    if (!isFunction[i][8]) setFunctionModule(8, i, false);
  }
  for (let i = 0; i < 8; i++) {
    setFunctionModule(size - 1 - i, 8, false);
    setFunctionModule(8, size - 1 - i, false);
  }
  setFunctionModule(8, size - 8, true);

  // Zigzag data placement
  let bitIdx = 0;
  const totalBits = allBytes.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x]) {
          let dark = false;
          if (bitIdx < totalBits) {
            dark = ((allBytes[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) !== 0;
            bitIdx++;
          }
          // Mask 0: (x + y) % 2 === 0
          if ((x + y) % 2 === 0) dark = !dark;
          modules[y][x] = dark;
        }
      }
    }
  }

  // Format bits for Level L (01) + Mask 0 (000) -> precomputed BCH = 0x77c4 (30660)
  const formatBits = 0x77c4;
  const getFmtBit = (i: number) => ((formatBits >>> i) & 1) !== 0;

  for (let i = 0; i <= 5; i++) modules[8][i] = getFmtBit(i);
  modules[8][7] = getFmtBit(6);
  modules[8][8] = getFmtBit(7);
  modules[7][8] = getFmtBit(8);
  for (let i = 9; i < 15; i++) modules[14 - i][8] = getFmtBit(i);

  for (let i = 0; i < 8; i++) modules[size - 1 - i][8] = getFmtBit(i);
  for (let i = 8; i < 15; i++) modules[8][size - 15 + i] = getFmtBit(i);

  return modules;
}
