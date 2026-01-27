import { createCanvas } from "canvas";
import {
  paletteToArray,
  rgbToLab,
  getCanvasContext,
  resizeImageCover,
  generateThumbnail,
  rotate90Clockwise,
  applyExifOrientation,
  processImage,
  createPNG,
  createBMP,
  DEFAULT_DISPLAY_WIDTH,
  DEFAULT_DISPLAY_HEIGHT,
} from "../src/processor.js";
import { SPECTRA6 } from "../src/palettes.js";
import { getPreset } from "../src/presets.js";

describe("processor", () => {
  describe("paletteToArray", () => {
    it("should convert palette object to array format", () => {
      const palette = {
        black: { r: 0, g: 0, b: 0 },
        white: { r: 255, g: 255, b: 255 },
        yellow: { r: 255, g: 255, b: 0 },
        red: { r: 255, g: 0, b: 0 },
        blue: { r: 0, g: 0, b: 255 },
        green: { r: 0, g: 255, b: 0 },
      };

      const arr = paletteToArray(palette);

      expect(arr).toHaveLength(7); // 6 colors + 1 reserved
      expect(arr[0]).toEqual([0, 0, 0]); // black
      expect(arr[1]).toEqual([255, 255, 255]); // white
      expect(arr[2]).toEqual([255, 255, 0]); // yellow
      expect(arr[3]).toEqual([255, 0, 0]); // red
      expect(arr[4]).toEqual([0, 0, 0]); // reserved
      expect(arr[5]).toEqual([0, 0, 255]); // blue
      expect(arr[6]).toEqual([0, 255, 0]); // green
    });
  });

  describe("rgbToLab", () => {
    it("should convert black correctly", () => {
      const [L, a, b] = rgbToLab(0, 0, 0);
      expect(L).toBeCloseTo(0, 0);
    });

    it("should convert white correctly", () => {
      const [L, a, b] = rgbToLab(255, 255, 255);
      expect(L).toBeCloseTo(100, 0);
    });

    it("should convert gray correctly", () => {
      const [L, a, b] = rgbToLab(128, 128, 128);
      expect(L).toBeGreaterThan(40);
      expect(L).toBeLessThan(60);
      expect(Math.abs(a)).toBeLessThan(1);
      expect(Math.abs(b)).toBeLessThan(1);
    });

    it("should convert red correctly", () => {
      const [L, a, b] = rgbToLab(255, 0, 0);
      expect(a).toBeGreaterThan(0); // Red has positive a
    });

    it("should convert blue correctly", () => {
      const [L, a, b] = rgbToLab(0, 0, 255);
      expect(b).toBeLessThan(0); // Blue has negative b
    });
  });

  describe("getCanvasContext", () => {
    it("should return 2d context with image smoothing disabled", () => {
      const canvas = createCanvas(100, 100);
      const ctx = getCanvasContext(canvas);

      expect(ctx).toBeDefined();
      expect(ctx.imageSmoothingEnabled).toBe(false);
    });
  });

  describe("resizeImageCover", () => {
    it("should resize canvas to specified dimensions", () => {
      const source = createCanvas(1000, 600);
      const ctx = source.getContext("2d");
      ctx.fillStyle = "red";
      ctx.fillRect(0, 0, 1000, 600);

      const resized = resizeImageCover(source, 800, 480, createCanvas);

      expect(resized.width).toBe(800);
      expect(resized.height).toBe(480);
    });

    it("should handle portrait to landscape resize", () => {
      const source = createCanvas(600, 1000);
      const resized = resizeImageCover(source, 800, 480, createCanvas);

      expect(resized.width).toBe(800);
      expect(resized.height).toBe(480);
    });
  });

  describe("rotate90Clockwise", () => {
    it("should swap width and height", () => {
      const source = createCanvas(400, 600);
      const rotated = rotate90Clockwise(source, createCanvas);

      expect(rotated.width).toBe(600);
      expect(rotated.height).toBe(400);
    });
  });

  describe("generateThumbnail", () => {
    it("should create landscape thumbnail from landscape source", () => {
      const source = createCanvas(1000, 600);
      const thumb = generateThumbnail(source, 400, 240, createCanvas);

      expect(thumb.width).toBe(400);
      expect(thumb.height).toBe(240);
    });

    it("should create portrait thumbnail from portrait source", () => {
      const source = createCanvas(600, 1000);
      const thumb = generateThumbnail(source, 400, 240, createCanvas);

      expect(thumb.width).toBe(240); // Swapped for portrait
      expect(thumb.height).toBe(400);
    });
  });

  describe("applyExifOrientation", () => {
    it("should return same canvas for orientation 1", () => {
      const source = createCanvas(100, 100);
      const result = applyExifOrientation(source, 1, createCanvas);

      expect(result).toBe(source);
    });

    it("should swap dimensions for orientation 6 (90° CW)", () => {
      const source = createCanvas(100, 50);
      const result = applyExifOrientation(source, 6, createCanvas);

      expect(result.width).toBe(50);
      expect(result.height).toBe(100);
    });

    it("should swap dimensions for orientation 8 (90° CCW)", () => {
      const source = createCanvas(100, 50);
      const result = applyExifOrientation(source, 8, createCanvas);

      expect(result.width).toBe(50);
      expect(result.height).toBe(100);
    });
  });

  describe("processImage", () => {
    it("should process canvas and return result", () => {
      const source = createCanvas(1000, 600);
      const ctx = source.getContext("2d");
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, 1000, 600);

      const result = processImage(source, {
        displayWidth: 800,
        displayHeight: 480,
        palette: SPECTRA6,
        params: getPreset("cdr"),
        createCanvas,
      });

      expect(result).toHaveProperty("canvas");
      expect(result).toHaveProperty("originalCanvas");
      expect(result.canvas.width).toBe(800);
      expect(result.canvas.height).toBe(480);
    });

    it("should rotate portrait images by default", () => {
      const source = createCanvas(600, 1000); // Portrait
      const ctx = source.getContext("2d");
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, 600, 1000);

      const result = processImage(source, {
        displayWidth: 800,
        displayHeight: 480,
        palette: SPECTRA6,
        params: getPreset("cdr"),
        createCanvas,
      });

      // Output should be landscape
      expect(result.canvas.width).toBe(800);
      expect(result.canvas.height).toBe(480);
    });

    it("should skip rotation when skipRotation is true", () => {
      const source = createCanvas(600, 1000); // Portrait
      const ctx = source.getContext("2d");
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, 600, 1000);

      const result = processImage(source, {
        displayWidth: 800,
        displayHeight: 480,
        palette: SPECTRA6,
        params: getPreset("cdr"),
        skipRotation: true,
        createCanvas,
      });

      // Output should be portrait (height, width swapped for display)
      expect(result.canvas.width).toBe(480);
      expect(result.canvas.height).toBe(800);
    });

    it("should use default dimensions when not specified", () => {
      const source = createCanvas(1000, 600);
      const ctx = source.getContext("2d");
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, 1000, 600);

      const result = processImage(source, {
        palette: SPECTRA6,
        params: getPreset("cdr"),
        createCanvas,
      });

      expect(result.canvas.width).toBe(DEFAULT_DISPLAY_WIDTH);
      expect(result.canvas.height).toBe(DEFAULT_DISPLAY_HEIGHT);
    });

    it("should skip dithering when skipDithering is true", () => {
      const source = createCanvas(100, 60);
      const ctx = source.getContext("2d");
      // Create a gradient
      const gradient = ctx.createLinearGradient(0, 0, 100, 0);
      gradient.addColorStop(0, "black");
      gradient.addColorStop(1, "white");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 100, 60);

      const result = processImage(source, {
        displayWidth: 100,
        displayHeight: 60,
        palette: SPECTRA6,
        params: getPreset("cdr"),
        skipDithering: true,
        createCanvas,
      });

      // Get pixel data - should have gradient colors, not just palette colors
      const imageData = result.canvas
        .getContext("2d")
        .getImageData(0, 0, 100, 60);
      const middlePixel = imageData.data.slice(30 * 4, 30 * 4 + 4);

      // Middle should be grayish (not pure black or white)
      expect(middlePixel[0]).toBeGreaterThan(50);
      expect(middlePixel[0]).toBeLessThan(200);
    });
  });

  describe("createPNG", () => {
    it("should create a PNG buffer from canvas", async () => {
      const canvas = createCanvas(100, 100);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "red";
      ctx.fillRect(0, 0, 100, 100);

      const buffer = await createPNG(canvas);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
      // PNG magic number
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50); // P
      expect(buffer[2]).toBe(0x4e); // N
      expect(buffer[3]).toBe(0x47); // G
    });
  });

  describe("createBMP", () => {
    it("should create a BMP buffer from canvas", () => {
      const canvas = createCanvas(100, 100);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "blue";
      ctx.fillRect(0, 0, 100, 100);

      const buffer = createBMP(canvas);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
      // BMP magic number "BM"
      expect(buffer[0]).toBe(0x42); // B
      expect(buffer[1]).toBe(0x4d); // M
    });

    it("should have correct BMP file size", () => {
      const width = 100;
      const height = 50;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "green";
      ctx.fillRect(0, 0, width, height);

      const buffer = createBMP(canvas);

      // BMP row size is padded to 4 bytes
      const rowSize = Math.ceil((width * 3) / 4) * 4;
      const expectedPixelDataSize = rowSize * height;
      const expectedFileSize = 54 + expectedPixelDataSize; // 54 bytes header

      expect(buffer.length).toBe(expectedFileSize);
      // File size in header (little-endian at offset 2)
      expect(buffer.readUInt32LE(2)).toBe(expectedFileSize);
    });

    it("should have correct BMP dimensions in header", () => {
      const width = 80;
      const height = 60;
      const canvas = createCanvas(width, height);

      const buffer = createBMP(canvas);

      // Width at offset 18, height at offset 22 (little-endian)
      expect(buffer.readInt32LE(18)).toBe(width);
      expect(buffer.readInt32LE(22)).toBe(height);
    });

    it("should encode pixel colors correctly (BGR format)", () => {
      const canvas = createCanvas(1, 1);
      const ctx = canvas.getContext("2d");
      // Set a specific color: RGB(255, 128, 64)
      ctx.fillStyle = "rgb(255, 128, 64)";
      ctx.fillRect(0, 0, 1, 1);

      const buffer = createBMP(canvas);

      // Pixel data starts at offset 54, stored as BGR
      expect(buffer[54]).toBe(64); // B
      expect(buffer[55]).toBe(128); // G
      expect(buffer[56]).toBe(255); // R
    });
  });
});
