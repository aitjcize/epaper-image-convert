/**
 * Core image processing functions for e-paper displays
 */

import { SPECTRA6 } from "./palettes.js";
import { getDefaultParams } from "./presets.js";

// Default dimensions
export const DEFAULT_DISPLAY_WIDTH = 800;
export const DEFAULT_DISPLAY_HEIGHT = 480;
export const DEFAULT_THUMBNAIL_WIDTH = 400;
export const DEFAULT_THUMBNAIL_HEIGHT = 240;

/**
 * Helper function to get canvas context with configurable image smoothing
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {string} contextType - Context type (default: "2d")
 * @param {boolean} enableSmoothing - Enable image smoothing for better quality scaling (default: false)
 */
export function getCanvasContext(
  canvas,
  contextType = "2d",
  enableSmoothing = false,
) {
  const ctx = canvas.getContext(contextType);
  if (ctx && contextType === "2d") {
    ctx.imageSmoothingEnabled = enableSmoothing;
    if (ctx.mozImageSmoothingEnabled !== undefined) {
      ctx.mozImageSmoothingEnabled = enableSmoothing;
    }
    if (ctx.webkitImageSmoothingEnabled !== undefined) {
      ctx.webkitImageSmoothingEnabled = enableSmoothing;
    }
    if (ctx.msImageSmoothingEnabled !== undefined) {
      ctx.msImageSmoothingEnabled = enableSmoothing;
    }
  }
  return ctx;
}

/**
 * Convert palette object to array format for indexing
 * Array format: [[r,g,b], ...] ordered as [black, white, yellow, red, reserved, blue, green]
 */
export function paletteToArray(palette) {
  return [
    [palette.black.r, palette.black.g, palette.black.b],
    [palette.white.r, palette.white.g, palette.white.b],
    [palette.yellow.r, palette.yellow.g, palette.yellow.b],
    [palette.red.r, palette.red.g, palette.red.b],
    [0, 0, 0], // Reserved (index 4, not used)
    [palette.blue.r, palette.blue.g, palette.blue.b],
    [palette.green.r, palette.green.g, palette.green.b],
  ];
}

// ===== Color Space Conversion Functions =====

function rgbToXyz(r, g, b) {
  r = r / 255;
  g = g / 255;
  b = b / 255;

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = r * 0.0193339 + g * 0.119192 + b * 0.9503041;

  return [x * 100, y * 100, z * 100];
}

function xyzToLab(x, y, z) {
  x = x / 95.047;
  y = y / 100.0;
  z = z / 108.883;

  x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

  const L = 116 * y - 16;
  const a = 500 * (x - y);
  const bVal = 200 * (y - z);

  return [L, a, bVal];
}

export function rgbToLab(r, g, b) {
  const [x, y, z] = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
}

function labToXyz(L, a, b) {
  let y = (L + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;

  x = x > 0.206897 ? Math.pow(x, 3) : (x - 16 / 116) / 7.787;
  y = y > 0.206897 ? Math.pow(y, 3) : (y - 16 / 116) / 7.787;
  z = z > 0.206897 ? Math.pow(z, 3) : (z - 16 / 116) / 7.787;

  return [x * 95.047, y * 100.0, z * 108.883];
}

function xyzToRgb(x, y, z) {
  x = x / 100;
  y = y / 100;
  z = z / 100;

  let r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  let g = x * -0.969266 + y * 1.8760108 + z * 0.041556;
  let b = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  b = b > 0.0031308 ? 1.055 * Math.pow(b, 1 / 2.4) - 0.055 : 12.92 * b;

  return [
    Math.max(0, Math.min(255, Math.round(r * 255))),
    Math.max(0, Math.min(255, Math.round(g * 255))),
    Math.max(0, Math.min(255, Math.round(b * 255))),
  ];
}

function labToRgb(L, a, b) {
  const [x, y, z] = labToXyz(L, a, b);
  return xyzToRgb(x, y, z);
}

function deltaE(lab1, lab2) {
  const dL = lab1[0] - lab2[0];
  const da = lab1[1] - lab2[1];
  const db = lab1[2] - lab2[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}

// ===== Image Adjustment Functions =====

function applyExposure(imageData, exposure) {
  if (exposure === 1.0) return;

  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.round(data[i] * exposure));
    data[i + 1] = Math.min(255, Math.round(data[i + 1] * exposure));
    data[i + 2] = Math.min(255, Math.round(data[i + 2] * exposure));
  }
}

function applyContrast(imageData, contrast) {
  if (contrast === 1.0) return;

  const data = imageData.data;
  const factor = contrast;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(
      0,
      Math.min(255, Math.round((data[i] - 128) * factor + 128)),
    );
    data[i + 1] = Math.max(
      0,
      Math.min(255, Math.round((data[i + 1] - 128) * factor + 128)),
    );
    data[i + 2] = Math.max(
      0,
      Math.min(255, Math.round((data[i + 2] - 128) * factor + 128)),
    );
  }
}

function applySaturation(imageData, saturation) {
  if (saturation === 1.0) return;

  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const l = (max + min) / 2;

    if (max === min) continue; // Grayscale

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    let h;
    if (max === r / 255) {
      h = ((g / 255 - b / 255) / d + (g < b ? 6 : 0)) / 6;
    } else if (max === g / 255) {
      h = ((b / 255 - r / 255) / d + 2) / 6;
    } else {
      h = ((r / 255 - g / 255) / d + 4) / 6;
    }

    const newS = Math.max(0, Math.min(1, s * saturation));
    const c = (1 - Math.abs(2 * l - 1)) * newS;
    const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
    const m = l - c / 2;

    let rPrime, gPrime, bPrime;
    const hSector = Math.floor(h * 6);

    if (hSector === 0) {
      [rPrime, gPrime, bPrime] = [c, x, 0];
    } else if (hSector === 1) {
      [rPrime, gPrime, bPrime] = [x, c, 0];
    } else if (hSector === 2) {
      [rPrime, gPrime, bPrime] = [0, c, x];
    } else if (hSector === 3) {
      [rPrime, gPrime, bPrime] = [0, x, c];
    } else if (hSector === 4) {
      [rPrime, gPrime, bPrime] = [x, 0, c];
    } else {
      [rPrime, gPrime, bPrime] = [c, 0, x];
    }

    data[i] = Math.round((rPrime + m) * 255);
    data[i + 1] = Math.round((gPrime + m) * 255);
    data[i + 2] = Math.round((bPrime + m) * 255);
  }
}

function applyScurveTonemap(
  imageData,
  strength,
  shadowBoost,
  highlightCompress,
  midpoint,
) {
  if (strength === 0) return;

  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const normalized = data[i + c] / 255.0;
      let result;

      if (normalized <= midpoint) {
        const shadowVal = normalized / midpoint;
        result = Math.pow(shadowVal, 1.0 - strength * shadowBoost) * midpoint;
      } else {
        const highlightVal = (normalized - midpoint) / (1.0 - midpoint);
        result =
          midpoint +
          Math.pow(highlightVal, 1.0 + strength * highlightCompress) *
            (1.0 - midpoint);
      }

      data[i + c] = Math.round(Math.max(0, Math.min(1, result)) * 255);
    }
  }
}

// ===== Color Matching Functions =====

function findClosestColorRGB(r, g, b, paletteArray) {
  let minDist = Infinity;
  let closest = 1; // Default to white

  for (let i = 0; i < paletteArray.length; i++) {
    if (i === 4) continue; // Skip reserved color

    const [pr, pg, pb] = paletteArray[i];
    const dr = r - pr;
    const dg = g - pg;
    const db = b - pb;
    const dist = dr * dr + dg * dg + db * db;

    if (dist < minDist) {
      minDist = dist;
      closest = i;
    }
  }

  return closest;
}

function findClosestColorLAB(r, g, b, paletteArray, paletteLab) {
  let minDist = Infinity;
  let closest = 1;

  const inputLab = rgbToLab(r, g, b);

  for (let i = 0; i < paletteArray.length; i++) {
    if (i === 4) continue;
    const dist = deltaE(inputLab, paletteLab[i]);
    if (dist < minDist) {
      minDist = dist;
      closest = i;
    }
  }

  return closest;
}

function findClosestColor(r, g, b, method, paletteArray, paletteLab) {
  return method === "lab"
    ? findClosestColorLAB(r, g, b, paletteArray, paletteLab)
    : findClosestColorRGB(r, g, b, paletteArray);
}

// ===== Dithering =====

const DIFFUSION_MATRICES = {
  "floyd-steinberg": [
    [1, 0, 7 / 16],
    [-1, 1, 3 / 16],
    [0, 1, 5 / 16],
    [1, 1, 1 / 16],
  ],
  stucki: [
    [1, 0, 8 / 42],
    [2, 0, 4 / 42],
    [-2, 1, 2 / 42],
    [-1, 1, 4 / 42],
    [0, 1, 8 / 42],
    [1, 1, 4 / 42],
    [2, 1, 2 / 42],
    [-2, 2, 1 / 42],
    [-1, 2, 2 / 42],
    [0, 2, 4 / 42],
    [1, 2, 2 / 42],
    [2, 2, 1 / 42],
  ],
  burkes: [
    [1, 0, 8 / 32],
    [2, 0, 4 / 32],
    [-2, 1, 2 / 32],
    [-1, 1, 4 / 32],
    [0, 1, 8 / 32],
    [1, 1, 4 / 32],
    [2, 1, 2 / 32],
  ],
  sierra: [
    [1, 0, 5 / 32],
    [2, 0, 3 / 32],
    [-2, 1, 2 / 32],
    [-1, 1, 4 / 32],
    [0, 1, 5 / 32],
    [1, 1, 4 / 32],
    [2, 1, 2 / 32],
    [-1, 2, 2 / 32],
    [0, 2, 3 / 32],
    [1, 2, 2 / 32],
  ],
};

/**
 * Apply error diffusion dithering to image data
 * @param {ImageData} imageData - Image data to dither (modified in place)
 * @param {string} method - Color matching method: "rgb" or "lab"
 * @param {Array} outputPaletteArray - Palette array for output colors
 * @param {Array} ditherPaletteArray - Palette array for error diffusion calculations
 * @param {string} algorithm - Dithering algorithm name
 */
function applyErrorDiffusionDither(
  imageData,
  method,
  outputPaletteArray,
  ditherPaletteArray,
  algorithm,
) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  const errors = new Array(width * height * 3).fill(0);
  const diffusionMatrix =
    DIFFUSION_MATRICES[algorithm] || DIFFUSION_MATRICES["floyd-steinberg"];

  // Pre-compute LAB values for dither palette if using LAB method
  const ditherPaletteLab =
    method === "lab"
      ? ditherPaletteArray.map(([r, g, b]) => rgbToLab(r, g, b))
      : null;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const errIdx = (y * width + x) * 3;

      const oldR = Math.max(0, Math.min(255, data[idx] + errors[errIdx]));
      const oldG = Math.max(
        0,
        Math.min(255, data[idx + 1] + errors[errIdx + 1]),
      );
      const oldB = Math.max(
        0,
        Math.min(255, data[idx + 2] + errors[errIdx + 2]),
      );

      const colorIdx = findClosestColor(
        oldR,
        oldG,
        oldB,
        method,
        ditherPaletteArray,
        ditherPaletteLab,
      );
      const [newR, newG, newB] = outputPaletteArray[colorIdx];

      data[idx] = newR;
      data[idx + 1] = newG;
      data[idx + 2] = newB;

      const [ditherR, ditherG, ditherB] = ditherPaletteArray[colorIdx];
      const errR = oldR - ditherR;
      const errG = oldG - ditherG;
      const errB = oldB - ditherB;

      for (const [dx, dy, weight] of diffusionMatrix) {
        const nx = x + dx;
        const ny = y + dy;

        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nextIdx = (ny * width + nx) * 3;
          errors[nextIdx] += errR * weight;
          errors[nextIdx + 1] += errG * weight;
          errors[nextIdx + 2] += errB * weight;
        }
      }
    }
  }
}

// ===== Image Preprocessing =====

function preprocessImage(imageData, params, perceivedPalette) {
  const toneMode = params.toneMode || "contrast";

  // 1. Apply exposure
  if (params.exposure && params.exposure !== 1.0) {
    applyExposure(imageData, params.exposure);
  }

  // 2. Apply saturation
  if (params.saturation !== 1.0) {
    applySaturation(imageData, params.saturation);
  }

  // 3. Apply tone mapping
  if (toneMode === "contrast") {
    if (params.contrast && params.contrast !== 1.0) {
      applyContrast(imageData, params.contrast);
    }
  } else {
    applyScurveTonemap(
      imageData,
      params.strength,
      params.shadowBoost,
      params.highlightCompress,
      params.midpoint,
    );
  }

  // 4. Compress dynamic range to display's actual luminance range
  if (params.compressDynamicRange && perceivedPalette) {
    const paletteBlack = perceivedPalette.black;
    const paletteWhite = perceivedPalette.white;

    const [blackL] = rgbToLab(paletteBlack.r, paletteBlack.g, paletteBlack.b);
    const [whiteL] = rgbToLab(paletteWhite.r, paletteWhite.g, paletteWhite.b);

    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const [l, a, bLab] = rgbToLab(r, g, b);
      const compressedL = blackL + (l / 100) * (whiteL - blackL);
      const [newR, newG, newB] = labToRgb(compressedL, a, bLab);

      data[i] = newR;
      data[i + 1] = newG;
      data[i + 2] = newB;
    }
  }
}

// ===== Canvas Transformation Functions =====

/**
 * Rotate canvas 90 degrees clockwise
 */
export function rotate90Clockwise(canvas, createCanvas = null) {
  let rotatedCanvas;
  if (createCanvas) {
    rotatedCanvas = createCanvas(canvas.height, canvas.width);
  } else {
    rotatedCanvas = document.createElement("canvas");
    rotatedCanvas.width = canvas.height;
    rotatedCanvas.height = canvas.width;
  }

  const ctx = getCanvasContext(rotatedCanvas);
  ctx.translate(canvas.height, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(canvas, 0, 0);

  return rotatedCanvas;
}

/**
 * Apply EXIF orientation transformation to canvas
 */
export function applyExifOrientation(canvas, orientation, createCanvas = null) {
  if (orientation === 1) return canvas;

  const { width, height } = canvas;
  let newCanvas;

  if (orientation >= 5 && orientation <= 8) {
    if (createCanvas) {
      newCanvas = createCanvas(height, width);
    } else {
      newCanvas = document.createElement("canvas");
      newCanvas.width = height;
      newCanvas.height = width;
    }
  } else {
    if (createCanvas) {
      newCanvas = createCanvas(width, height);
    } else {
      newCanvas = document.createElement("canvas");
      newCanvas.width = width;
      newCanvas.height = height;
    }
  }

  const ctx = getCanvasContext(newCanvas);

  switch (orientation) {
    case 2:
      ctx.transform(-1, 0, 0, 1, width, 0);
      break;
    case 3:
      ctx.transform(-1, 0, 0, -1, width, height);
      break;
    case 4:
      ctx.transform(1, 0, 0, -1, 0, height);
      break;
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      ctx.transform(0, 1, -1, 0, height, 0);
      break;
    case 7:
      ctx.transform(0, -1, -1, 0, height, width);
      break;
    case 8:
      ctx.transform(0, -1, 1, 0, 0, width);
      break;
  }

  ctx.drawImage(canvas, 0, 0);
  return newCanvas;
}

/**
 * Resize image with cover mode (scale and crop to fill)
 */
export function resizeImageCover(
  sourceCanvas,
  outputWidth,
  outputHeight,
  createCanvas = null,
) {
  const srcWidth = sourceCanvas.width;
  const srcHeight = sourceCanvas.height;

  const scaleX = outputWidth / srcWidth;
  const scaleY = outputHeight / srcHeight;
  const scale = Math.max(scaleX, scaleY);

  const scaledWidth = Math.round(srcWidth * scale);
  const scaledHeight = Math.round(srcHeight * scale);

  let tempCanvas;
  if (createCanvas) {
    tempCanvas = createCanvas(scaledWidth, scaledHeight);
  } else {
    tempCanvas = document.createElement("canvas");
    tempCanvas.width = scaledWidth;
    tempCanvas.height = scaledHeight;
  }
  const tempCtx = getCanvasContext(tempCanvas, "2d", true);
  tempCtx.drawImage(sourceCanvas, 0, 0, scaledWidth, scaledHeight);

  const cropX = Math.round((scaledWidth - outputWidth) / 2);
  const cropY = Math.round((scaledHeight - outputHeight) / 2);

  let outputCanvas;
  if (createCanvas) {
    outputCanvas = createCanvas(outputWidth, outputHeight);
  } else {
    outputCanvas = document.createElement("canvas");
    outputCanvas.width = outputWidth;
    outputCanvas.height = outputHeight;
  }
  const outputCtx = getCanvasContext(outputCanvas, "2d", true);
  outputCtx.drawImage(
    tempCanvas,
    cropX,
    cropY,
    outputWidth,
    outputHeight,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  return outputCanvas;
}

/**
 * Generate thumbnail from canvas
 */
export function generateThumbnail(
  sourceCanvas,
  outputWidth = DEFAULT_THUMBNAIL_WIDTH,
  outputHeight = DEFAULT_THUMBNAIL_HEIGHT,
  createCanvas = null,
) {
  const srcWidth = sourceCanvas.width;
  const srcHeight = sourceCanvas.height;

  const isPortrait = srcHeight > srcWidth;
  const thumbWidth = isPortrait ? outputHeight : outputWidth;
  const thumbHeight = isPortrait ? outputWidth : outputHeight;

  let thumbCanvas;
  if (createCanvas) {
    thumbCanvas = createCanvas(thumbWidth, thumbHeight);
  } else {
    thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = thumbWidth;
    thumbCanvas.height = thumbHeight;
  }

  const thumbCtx = getCanvasContext(thumbCanvas, "2d", true);

  const scaleX = thumbWidth / srcWidth;
  const scaleY = thumbHeight / srcHeight;
  const scale = Math.max(scaleX, scaleY);

  const scaledWidth = Math.round(srcWidth * scale);
  const scaledHeight = Math.round(srcHeight * scale);
  const cropX = Math.round((scaledWidth - thumbWidth) / 2);
  const cropY = Math.round((scaledHeight - thumbHeight) / 2);

  thumbCtx.drawImage(
    sourceCanvas,
    cropX / scale,
    cropY / scale,
    thumbWidth / scale,
    thumbHeight / scale,
    0,
    0,
    thumbWidth,
    thumbHeight,
  );

  return thumbCanvas;
}

/**
 * Convert canvas to PNG
 */
export async function createPNG(canvas) {
  if (typeof Buffer !== "undefined" && typeof window === "undefined") {
    return canvas.toBuffer("image/png");
  } else {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create PNG blob"));
        }
      }, "image/png");
    });
  }
}

/**
 * Convert canvas to BMP (24-bit uncompressed)
 */
export function createBMP(canvas) {
  const ctx = getCanvasContext(canvas);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { width, height, data } = imageData;

  // BMP row padding (rows must be multiple of 4 bytes)
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelDataSize = rowSize * height;

  // File size: headers (54 bytes) + pixel data
  const fileSize = 54 + pixelDataSize;

  const buffer = Buffer.alloc(fileSize);

  // BMP File Header (14 bytes)
  buffer.write("BM", 0); // Signature
  buffer.writeUInt32LE(fileSize, 2); // File size
  buffer.writeUInt32LE(0, 6); // Reserved
  buffer.writeUInt32LE(54, 10); // Pixel data offset

  // DIB Header (BITMAPINFOHEADER - 40 bytes)
  buffer.writeUInt32LE(40, 14); // Header size
  buffer.writeInt32LE(width, 18); // Width
  buffer.writeInt32LE(height, 22); // Height (positive = bottom-up)
  buffer.writeUInt16LE(1, 26); // Color planes
  buffer.writeUInt16LE(24, 28); // Bits per pixel
  buffer.writeUInt32LE(0, 30); // Compression (0 = none)
  buffer.writeUInt32LE(pixelDataSize, 34); // Image size
  buffer.writeInt32LE(2835, 38); // X pixels per meter (~72 DPI)
  buffer.writeInt32LE(2835, 42); // Y pixels per meter
  buffer.writeUInt32LE(0, 46); // Colors in color table
  buffer.writeUInt32LE(0, 50); // Important colors

  // Pixel data (BGR, bottom-up)
  let offset = 54;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      buffer[offset++] = data[srcIdx + 2]; // B
      buffer[offset++] = data[srcIdx + 1]; // G
      buffer[offset++] = data[srcIdx]; // R
    }
    // Padding to 4-byte boundary
    const padding = rowSize - width * 3;
    for (let p = 0; p < padding; p++) {
      buffer[offset++] = 0;
    }
  }

  return buffer;
}

// ===== Main Processing Function =====

/**
 * Complete image processing pipeline from source to device-ready output
 *
 * @param {Canvas|ImageData} source - Source canvas or ImageData
 * @param {Object} options - Processing options
 * @param {number} options.displayWidth - Display width in pixels (required)
 * @param {number} options.displayHeight - Display height in pixels (required)
 * @param {Object} options.palette - Palette pair { theoretical, perceived } (default: SPECTRA6)
 * @param {Object} options.params - Processing parameters (exposure, saturation, etc.)
 * @param {boolean} options.skipRotation - Skip portrait-to-landscape rotation (default: false)
 * @param {boolean} options.skipDithering - Skip dithering step (default: false)
 * @param {boolean} options.usePerceivedOutput - Use perceived palette for output (default: false)
 * @param {boolean} options.verbose - Enable verbose logging (default: false)
 * @param {Function} options.createCanvas - Canvas creation function for Node.js (default: null)
 * @returns {Object} { canvas, originalCanvas }
 */
export function processImage(source, options = {}) {
  const {
    displayWidth = DEFAULT_DISPLAY_WIDTH,
    displayHeight = DEFAULT_DISPLAY_HEIGHT,
    palette = SPECTRA6,
    params = getDefaultParams(),
    skipRotation = false,
    skipDithering = false,
    usePerceivedOutput = false,
    verbose = false,
    createCanvas = null,
  } = options;

  // Handle both canvas and ImageData inputs
  const isImageData = source.data && source.width && source.height;
  let canvas;
  if (createCanvas) {
    canvas = createCanvas(source.width, source.height);
  } else {
    canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
  }
  const ctx = getCanvasContext(canvas);

  if (isImageData) {
    ctx.putImageData(source, 0, 0);
  } else {
    ctx.drawImage(source, 0, 0);
  }

  if (verbose) {
    console.log(`  Original size: ${canvas.width}x${canvas.height}`);
    console.log(`  Processing parameters:`);
    console.log(`    Exposure: ${params.exposure ?? 1.0}`);
    console.log(`    Saturation: ${params.saturation ?? 1.0}`);
    console.log(`    Tone mode: ${params.toneMode || "contrast"}`);
    if (params.toneMode === "scurve") {
      console.log(`    S-curve strength: ${params.strength ?? 0.5}`);
      console.log(`    S-curve shadow boost: ${params.shadowBoost ?? 0.3}`);
      console.log(
        `    S-curve highlight compress: ${params.highlightCompress ?? 1.5}`,
      );
      console.log(`    S-curve midpoint: ${params.midpoint ?? 0.5}`);
    } else {
      console.log(`    Contrast: ${params.contrast ?? 1.0}`);
    }
    console.log(`    Color method: ${params.colorMethod || "rgb"}`);
    console.log(
      `    Dither algorithm: ${params.ditherAlgorithm || "floyd-steinberg"}`,
    );
    console.log(
      `    Compress dynamic range: ${params.compressDynamicRange ?? false}`,
    );
  }

  // Save original canvas for thumbnail generation
  let originalCanvas;
  if (createCanvas) {
    originalCanvas = createCanvas(canvas.width, canvas.height);
  } else {
    originalCanvas = document.createElement("canvas");
    originalCanvas.width = canvas.width;
    originalCanvas.height = canvas.height;
  }
  getCanvasContext(originalCanvas).drawImage(canvas, 0, 0);

  // Check if portrait and rotate to landscape
  const isPortrait = canvas.height > canvas.width;
  if (isPortrait && !skipRotation) {
    if (verbose) {
      console.log(`  Portrait detected, rotating 90° clockwise`);
    }
    canvas = rotate90Clockwise(canvas, createCanvas);
  }

  // Resize to display dimensions
  let finalWidth, finalHeight;
  const displayIsLandscape = displayWidth > displayHeight;
  if (isPortrait && skipRotation && displayIsLandscape) {
    finalWidth = displayHeight;
    finalHeight = displayWidth;
  } else {
    finalWidth = displayWidth;
    finalHeight = displayHeight;
  }

  if (canvas.width !== finalWidth || canvas.height !== finalHeight) {
    if (verbose) {
      console.log(`  Resizing to ${finalWidth}x${finalHeight}`);
    }
    canvas = resizeImageCover(canvas, finalWidth, finalHeight, createCanvas);
  }

  // Get image data for processing
  const imageData = getCanvasContext(canvas).getImageData(
    0,
    0,
    canvas.width,
    canvas.height,
  );

  // Apply tone mapping and preprocessing
  if (verbose) {
    console.log(`  Applying tone mapping (${params.toneMode || "contrast"})`);
  }
  if (verbose && params.compressDynamicRange) {
    const [blackL] = rgbToLab(
      palette.perceived.black.r,
      palette.perceived.black.g,
      palette.perceived.black.b,
    );
    const [whiteL] = rgbToLab(
      palette.perceived.white.r,
      palette.perceived.white.g,
      palette.perceived.white.b,
    );
    console.log(
      `  Compressing dynamic range to L* ${Math.round(blackL)}-${Math.round(whiteL)}`,
    );
  }
  const processingParams = { ...params, measuredPalette: palette.perceived };
  preprocessImage(imageData, processingParams, palette.perceived);

  // Apply dithering
  if (!skipDithering) {
    const outputPalette = usePerceivedOutput
      ? palette.perceived
      : palette.theoretical;
    const outputPaletteArray = paletteToArray(outputPalette);
    const ditherPaletteArray = paletteToArray(palette.perceived);

    if (verbose) {
      console.log(
        `  Applying ${params.ditherAlgorithm || "floyd-steinberg"} dithering`,
      );
    }

    applyErrorDiffusionDither(
      imageData,
      params.colorMethod || "rgb",
      outputPaletteArray,
      ditherPaletteArray,
      params.ditherAlgorithm || "floyd-steinberg",
    );
  }

  getCanvasContext(canvas).putImageData(imageData, 0, 0);

  return { canvas, originalCanvas };
}
