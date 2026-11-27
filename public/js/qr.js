const VERSION = 6;
const SIZE = VERSION * 4 + 17;
const DATA_CODEWORDS = 136;
const ECC_CODEWORDS_PER_BLOCK = 18;
const BLOCK_COUNT = 2;
const MAX_DATA_BYTES = 134;
const FORMAT_MASK = 0x5412;
const FORMAT_POLYNOMIAL = 0x537;

function gfMultiply(left, right) {
  let product = 0;
  for (let bit = 0; bit < 8; bit += 1) {
    if ((right & 1) !== 0) product ^= left;
    right >>>= 1;
    left <<= 1;
    if ((left & 0x100) !== 0) left ^= 0x11d;
  }
  return product;
}

function reedSolomonDivisor(degree) {
  let polynomial = [1];
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(polynomial.length + 1).fill(0);
    for (let j = 0; j < polynomial.length; j += 1) {
      next[j] ^= polynomial[j];
      next[j + 1] ^= gfMultiply(polynomial[j], root);
    }
    polynomial = next;
    root = gfMultiply(root, 2);
  }
  return polynomial;
}

function reedSolomonRemainder(data, divisor) {
  const remainder = new Array(divisor.length - 1).fill(0);
  for (const value of data) {
    const factor = value ^ remainder.shift();
    remainder.push(0);
    for (let i = 0; i < remainder.length; i += 1) {
      remainder[i] ^= gfMultiply(divisor[i + 1], factor);
    }
  }
  return remainder;
}

function appendBits(bits, value, length) {
  for (let i = length - 1; i >= 0; i -= 1) {
    bits.push((value >>> i) & 1);
  }
}

function createCodewords(bytes) {
  const bits = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  for (const byte of bytes) appendBits(bits, byte, 8);

  const capacityBits = DATA_CODEWORDS * 8;
  const terminatorLength = Math.min(4, capacityBits - bits.length);
  for (let i = 0; i < terminatorLength; i += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) value = (value << 1) | bits[i + j];
    data.push(value);
  }
  for (let pad = 0; data.length < DATA_CODEWORDS; pad += 1) {
    data.push(pad % 2 === 0 ? 0xec : 0x11);
  }

  const blockLength = DATA_CODEWORDS / BLOCK_COUNT;
  const blocks = Array.from({ length: BLOCK_COUNT }, (_, index) =>
    data.slice(index * blockLength, (index + 1) * blockLength));
  const divisor = reedSolomonDivisor(ECC_CODEWORDS_PER_BLOCK);
  const errorCorrection = blocks.map((block) => reedSolomonRemainder(block, divisor));
  const interleaved = [];

  for (let i = 0; i < blockLength; i += 1) {
    for (const block of blocks) interleaved.push(block[i]);
  }
  for (let i = 0; i < ECC_CODEWORDS_PER_BLOCK; i += 1) {
    for (const block of errorCorrection) interleaved.push(block[i]);
  }
  return interleaved;
}

function setFunctionModule(matrix, functionModules, x, y, isDark) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  matrix[y][x] = isDark;
  functionModules[y][x] = true;
}

function drawFinder(matrix, functionModules, centerX, centerY) {
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -4; dx <= 4; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      setFunctionModule(
        matrix,
        functionModules,
        centerX + dx,
        centerY + dy,
        distance !== 2 && distance !== 4,
      );
    }
  }
}

function drawAlignment(matrix, functionModules, centerX, centerY) {
  if (functionModules[centerY][centerX]) return;
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      setFunctionModule(
        matrix,
        functionModules,
        centerX + dx,
        centerY + dy,
        distance === 2 || distance === 0,
      );
    }
  }
}

function drawFormatBits(matrix, functionModules, mask) {
  const data = (0b01 << 3) | mask;
  let remainder = data;
  for (let i = 0; i < 10; i += 1) {
    remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * FORMAT_POLYNOMIAL);
  }
  const format = ((data << 10) | remainder) ^ FORMAT_MASK;
  const bit = (index) => ((format >>> index) & 1) !== 0;

  for (let i = 0; i <= 5; i += 1) setFunctionModule(matrix, functionModules, 8, i, bit(i));
  setFunctionModule(matrix, functionModules, 8, 7, bit(6));
  setFunctionModule(matrix, functionModules, 8, 8, bit(7));
  setFunctionModule(matrix, functionModules, 7, 8, bit(8));
  for (let i = 9; i < 15; i += 1) {
    setFunctionModule(matrix, functionModules, 14 - i, 8, bit(i));
  }
  for (let i = 0; i < 8; i += 1) {
    setFunctionModule(matrix, functionModules, SIZE - 1 - i, 8, bit(i));
  }
  for (let i = 8; i < 15; i += 1) {
    setFunctionModule(matrix, functionModules, 8, SIZE - 15 + i, bit(i));
  }
  setFunctionModule(matrix, functionModules, 8, SIZE - 8, true);
}

function drawFunctionPatterns(matrix, functionModules) {
  for (let i = 8; i < SIZE - 8; i += 1) {
    const isDark = i % 2 === 0;
    setFunctionModule(matrix, functionModules, 6, i, isDark);
    setFunctionModule(matrix, functionModules, i, 6, isDark);
  }

  drawFinder(matrix, functionModules, 3, 3);
  drawFinder(matrix, functionModules, SIZE - 4, 3);
  drawFinder(matrix, functionModules, 3, SIZE - 4);
  for (const y of [6, 34]) {
    for (const x of [6, 34]) drawAlignment(matrix, functionModules, x, y);
  }
  drawFormatBits(matrix, functionModules, 0);
}

function placeData(matrix, functionModules, codewords) {
  let bitIndex = 0;
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < SIZE; vertical += 1) {
      const y = ((right + 1) & 2) === 0 ? SIZE - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;
        if (functionModules[y][x]) continue;
        const codeword = codewords[bitIndex >>> 3] ?? 0;
        matrix[y][x] = ((codeword >>> (7 - (bitIndex & 7))) & 1) !== 0;
        bitIndex += 1;
      }
    }
  }
}

function maskCondition(mask, x, y) {
  const product = x * y;
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5: return (product % 2) + (product % 3) === 0;
    case 6: return ((product % 2) + (product % 3)) % 2 === 0;
    case 7: return (((x + y) % 2) + (product % 3)) % 2 === 0;
    default: throw new RangeError('QR mask must be between 0 and 7');
  }
}

function penaltyForRuns(line) {
  let penalty = 0;
  let runColor = line[0];
  let runLength = 1;
  for (let i = 1; i < line.length; i += 1) {
    if (line[i] === runColor) {
      runLength += 1;
    } else {
      if (runLength >= 5) penalty += 3 + runLength - 5;
      runColor = line[i];
      runLength = 1;
    }
  }
  if (runLength >= 5) penalty += 3 + runLength - 5;

  const finderLikePatterns = [
    [true, false, true, true, true, false, true, false, false, false, false],
    [false, false, false, false, true, false, true, true, true, false, true],
  ];
  for (let start = 0; start <= line.length - 11; start += 1) {
    for (const pattern of finderLikePatterns) {
      if (pattern.every((value, offset) => line[start + offset] === value)) penalty += 40;
    }
  }
  return penalty;
}

function penaltyScore(matrix) {
  let penalty = 0;
  let darkCount = 0;
  const size = matrix.length;

  for (let y = 0; y < size; y += 1) {
    penalty += penaltyForRuns(matrix[y]);
    for (let x = 0; x < size; x += 1) {
      if (matrix[y][x]) darkCount += 1;
      if (x + 1 < size && y + 1 < size) {
        const color = matrix[y][x];
        if (
          matrix[y][x + 1] === color &&
          matrix[y + 1][x] === color &&
          matrix[y + 1][x + 1] === color
        ) {
          penalty += 3;
        }
      }
    }
  }

  for (let x = 0; x < size; x += 1) {
    penalty += penaltyForRuns(matrix.map((row) => row[x]));
  }
  penalty += Math.floor(Math.abs((darkCount * 100) / (size * size) - 50) / 5) * 10;
  return penalty;
}

function maskedMatrix(matrix, functionModules, mask) {
  const result = matrix.map((row) => [...row]);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (!functionModules[y][x] && maskCondition(mask, x, y)) {
        result[y][x] = !result[y][x];
      }
    }
  }
  drawFormatBits(result, functionModules, mask);
  return result;
}

export function encodeMatrix(text) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new TypeError('QR content must be a non-empty string');
  }
  if ([...text].some((character) => character.charCodeAt(0) > 0x7f)) {
    throw new TypeError('Ticket QR content must contain only ASCII characters');
  }
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > MAX_DATA_BYTES) {
    throw new RangeError(`Ticket QR content must be no more than ${MAX_DATA_BYTES} bytes`);
  }

  const matrix = Array.from({ length: SIZE }, () => new Array(SIZE).fill(false));
  const functionModules = Array.from({ length: SIZE }, () => new Array(SIZE).fill(false));
  drawFunctionPatterns(matrix, functionModules);
  placeData(matrix, functionModules, createCodewords(bytes));

  let bestMatrix;
  let bestPenalty = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = maskedMatrix(matrix, functionModules, mask);
    const penalty = penaltyScore(candidate);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMatrix = candidate;
    }
  }
  return bestMatrix;
}

export function toCanvas(canvas, text, { scale = 4, margin = 4, dark = '#000', light = '#fff' } = {}) {
  if (!canvas || typeof canvas.getContext !== 'function') {
    throw new TypeError('A canvas element is required');
  }
  if (!Number.isSafeInteger(scale) || scale < 1) {
    throw new TypeError('QR scale must be a positive whole number');
  }
  if (!Number.isSafeInteger(margin) || margin < 0) {
    throw new TypeError('QR margin must be a non-negative whole number');
  }
  const matrix = encodeMatrix(text);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The canvas 2D context is unavailable');

  const dimension = (SIZE + margin * 2) * scale;
  canvas.width = dimension;
  canvas.height = dimension;
  context.imageSmoothingEnabled = false;
  context.fillStyle = light;
  context.fillRect(0, 0, dimension, dimension);
  context.fillStyle = dark;
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (matrix[y][x]) {
        context.fillRect(
          (x + margin) * scale,
          (y + margin) * scale,
          scale,
          scale,
        );
      }
    }
  }
  return canvas;
}
