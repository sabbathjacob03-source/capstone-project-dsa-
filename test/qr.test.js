import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encodeMatrix, toCanvas } from '../public/js/qr.js';
import { signTicketToken } from '../src/lib/ticketToken.js';

process.env.TICKET_TOKEN_SECRET = 'qr-ticket-test-secret';

function readsFunctionModule(x, y) {
  const inFinder = (left, top) =>
    x >= left && x < left + 8 && y >= top && y < top + 8;
  const inFormat = (
    (x === 8 && y <= 5) ||
    (x === 8 && y === 7) ||
    (x === 8 && y === 8) ||
    (x === 7 && y === 8) ||
    (y === 8 && x <= 5) ||
    (y === 8 && x >= 33) ||
    (x === 8 && y >= 34)
  );
  return inFinder(0, 0) ||
    inFinder(33, 0) ||
    inFinder(0, 33) ||
    (x === 6 && y >= 8 && y <= 32) ||
    (y === 6 && x >= 8 && x <= 32) ||
    (x >= 32 && x <= 36 && y >= 32 && y <= 36) ||
    inFormat ||
    (x === 8 && y === 33);
}

function verifiesErrorCorrection(codewords) {
  const multiply = (left, right) => {
    let result = 0;
    for (let bit = 0; bit < 8; bit += 1) {
      if ((right & 1) !== 0) result ^= left;
      right >>>= 1;
      left <<= 1;
      if ((left & 0x100) !== 0) left ^= 0x11d;
    }
    return result;
  };
  for (let block = 0; block < 2; block += 1) {
    const words = [];
    for (let i = 0; i < 68; i += 1) words.push(codewords[i * 2 + block]);
    for (let i = 0; i < 18; i += 1) words.push(codewords[136 + i * 2 + block]);
    let root = 1;
    for (let syndrome = 0; syndrome < 18; syndrome += 1) {
      let value = 0;
      for (const word of words) value = multiply(value, root) ^ word;
      assert.equal(value, 0);
      root = multiply(root, 2);
    }
  }
}

function decodePayloadFromMatrix(matrix) {
  let format = 0;
  for (let i = 0; i <= 5; i += 1) format |= Number(matrix[i][8]) << i;
  format |= Number(matrix[7][8]) << 6;
  format |= Number(matrix[8][8]) << 7;
  format |= Number(matrix[8][7]) << 8;
  for (let i = 9; i < 15; i += 1) format |= Number(matrix[8][14 - i]) << i;
  const formatData = format ^ 0x5412;
  const formatPayload = formatData >>> 10;
  assert.equal((formatPayload >>> 3) & 0b11, 0b01);
  let formatRemainder = formatPayload;
  for (let i = 0; i < 10; i += 1) {
    formatRemainder = (formatRemainder << 1) ^ (((formatRemainder >>> 9) & 1) * 0x537);
  }
  assert.equal(format, ((formatPayload << 10) | formatRemainder) ^ 0x5412);
  const mask = formatPayload & 0b111;

  const moduleBits = [];
  let upward = true;
  for (let right = matrix.length - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < matrix.length; vertical += 1) {
      const y = upward ? matrix.length - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;
        if (readsFunctionModule(x, y)) continue;
        const product = x * y;
        const masked = [
          (x + y) % 2 === 0,
          y % 2 === 0,
          x % 3 === 0,
          (x + y) % 3 === 0,
          (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
          product % 2 + product % 3 === 0,
          (product % 2 + product % 3) % 2 === 0,
          ((x + y) % 2 + product % 3) % 2 === 0,
        ][mask];
        moduleBits.push(Number(matrix[y][x] !== masked));
      }
    }
    upward = !upward;
  }

  const codewords = [];
  for (let i = 0; i < 172; i += 1) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) {
      value = (value << 1) | moduleBits[i * 8 + j];
    }
    codewords.push(value);
  }
  verifiesErrorCorrection(codewords);
  const data = [];
  for (let block = 0; block < 2; block += 1) {
    for (let i = 0; i < 68; i += 1) data.push(codewords[i * 2 + block]);
  }
  const bits = data.flatMap((byte) =>
    Array.from({ length: 8 }, (_, i) => (byte >>> (7 - i)) & 1));
  let offset = 0;
  const readBits = (length) => {
    let value = 0;
    for (let i = 0; i < length; i += 1) value = (value << 1) | bits[offset++];
    return value;
  };
  assert.equal(readBits(4), 0b0100);
  const length = readBits(8);
  const bytes = Array.from({ length }, () => readBits(8));
  return new TextDecoder().decode(new Uint8Array(bytes));
}

describe('QR ticket encoder', () => {
  it('creates a stable version 6 matrix with finder patterns', () => {
    const text = 'ticket-token.'.repeat(7);
    const matrix = encodeMatrix(text);
    assert.equal(matrix.length, 41);
    assert.ok(matrix.every((row) => row.length === 41));
    assert.deepEqual(matrix, encodeMatrix(text));

    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        const distance = Math.max(Math.abs(x - 3), Math.abs(y - 3));
        assert.equal(matrix[y][x], distance !== 2);
      }
    }
  });

  it('encodes the signed ticket token format', () => {
    const token = signTicketToken('ABCDEFGH');
    assert.ok(new TextEncoder().encode(token).length <= 134);
    assert.equal(encodeMatrix(token).length, 41);
  });

  it('can recover the original bytes from its QR data modules', () => {
    const text = 'ticket-token.'.repeat(7);
    assert.equal(decodePayloadFromMatrix(encodeMatrix(text)), text);
  });

  it('draws the matrix on a canvas with a quiet zone', () => {
    const rectangles = [];
    const context = {
      fillRect(...rectangle) {
        rectangles.push({ fillStyle: this.fillStyle, rectangle });
      },
    };
    const canvas = {
      getContext: () => context,
    };
    const result = toCanvas(canvas, 'paid-ticket-token');
    assert.equal(result, canvas);
    assert.equal(canvas.width, 196);
    assert.equal(canvas.height, 196);
    assert.equal(rectangles[0].fillStyle, '#fff');
    assert.deepEqual(rectangles[0].rectangle, [0, 0, 196, 196]);
    assert.ok(rectangles.length > 1);
  });

  it('accepts the byte capacity and rejects invalid or oversized content', () => {
    assert.equal(encodeMatrix('x'.repeat(134)).length, 41);
    assert.throws(() => encodeMatrix('x'.repeat(135)), RangeError);
    assert.throws(() => encodeMatrix('tícket'), TypeError);
    assert.throws(() => encodeMatrix(''), TypeError);
    assert.throws(() => toCanvas({}, 'ticket'), TypeError);
  });
});
