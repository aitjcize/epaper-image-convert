import { createCanvas } from "canvas";
import { gunzipSync } from "zlib";
import {
  paletteToArray,
  rgbToLab,
  getCanvasContext,
  resizeImageCover,
  resizeImageFit,
  resizeImageCustom,
  generateThumbnail,
  rotateImage,
  applyExifOrientation,
  processImage,
  createPNG,
  createBMP,
  createEPDGZ,
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

  describe("resizeImageFit", () => {
    it("should fit landscape source into target with letterbox", () => {
      const source = createCanvas(1000, 600);
      const result = resizeImageFit(source, 800, 480, "white", createCanvas);

      expect(result.width).toBe(800);
      expect(result.height).toBe(480);
    });

    it("should fit portrait source into landscape target with bars on sides", () => {
      const source = createCanvas(600, 1000);
      const result = resizeImageFit(source, 800, 480, "white", createCanvas);

      expect(result.width).toBe(800);
      expect(result.height).toBe(480);

      // Check left bar is filled with white (background)
      const ctx = result.getContext("2d");
      const pixel = ctx.getImageData(0, 0, 1, 1).data;
      expect(pixel[0]).toBe(255); // R
      expect(pixel[1]).toBe(255); // G
      expect(pixel[2]).toBe(255); // B
    });

    it("should center the image", () => {
      const source = createCanvas(100, 100);
      const ctx = source.getContext("2d");
      ctx.fillStyle = "red";
      ctx.fillRect(0, 0, 100, 100);

      const result = resizeImageFit(source, 400, 200, "black", createCanvas);

      // Image should be centered: 200x200 scaled to 200x200, offset at (100, 0)
      const resultCtx = result.getContext("2d");
      // Left bar should be black
      const leftPixel = resultCtx.getImageData(0, 100, 1, 1).data;
      expect(leftPixel[0]).toBe(0);
      // Center should be red
      const centerPixel = resultCtx.getImageData(200, 100, 1, 1).data;
      expect(centerPixel[0]).toBe(255);
      expect(centerPixel[1]).toBe(0);
    });
  });

  describe("resizeImageCustom", () => {
    it("should draw image at custom zoom and pan", () => {
      const source = createCanvas(100, 100);
      const ctx = source.getContext("2d");
      ctx.fillStyle = "red";
      ctx.fillRect(0, 0, 100, 100);

      const result = resizeImageCustom(
        source,
        200,
        200,
        1.0,
        50,
        50,
        "black",
        createCanvas,
      );

      expect(result.width).toBe(200);
      expect(result.height).toBe(200);

      const resultCtx = result.getContext("2d");
      // Top-left should be background (black)
      const bgPixel = resultCtx.getImageData(0, 0, 1, 1).data;
      expect(bgPixel[0]).toBe(0);
      // At (50,50) should be red (image starts here)
      const imgPixel = resultCtx.getImageData(75, 75, 1, 1).data;
      expect(imgPixel[0]).toBe(255);
      expect(imgPixel[1]).toBe(0);
    });

    it("should output at specified dimensions regardless of zoom", () => {
      const source = createCanvas(100, 100);
      const result = resizeImageCustom(
        source,
        800,
        480,
        0.5,
        0,
        0,
        "white",
        createCanvas,
      );

      expect(result.width).toBe(800);
      expect(result.height).toBe(480);
    });
  });

  describe("rotateImage", () => {
    it("should swap width and height for 90°", () => {
      const source = createCanvas(400, 600);
      const rotated = rotateImage(source, 90, createCanvas);

      expect(rotated.width).toBe(600);
      expect(rotated.height).toBe(400);
    });

    it("should keep dimensions for 180°", () => {
      const source = createCanvas(400, 600);
      const rotated = rotateImage(source, 180, createCanvas);

      expect(rotated.width).toBe(400);
      expect(rotated.height).toBe(600);
    });

    it("should return same canvas for 0°", () => {
      const source = createCanvas(400, 600);
      const rotated = rotateImage(source, 0, createCanvas);

      expect(rotated).toBe(source);
    });

    it("should throw for non-90° multiples", () => {
      const source = createCanvas(400, 600);
      expect(() => rotateImage(source, 45, createCanvas)).toThrow(
        "multiple of 90",
      );
    });
  });

  describe("generateThumbnail", () => {
    it("should create thumbnail preserving aspect ratio from landscape source", () => {
      const source = createCanvas(1000, 600);
      const thumb = generateThumbnail(source, 400, createCanvas);

      expect(thumb.width).toBe(400);
      expect(thumb.height).toBe(240);
    });

    it("should create thumbnail preserving aspect ratio from portrait source", () => {
      const source = createCanvas(600, 1000);
      const thumb = generateThumbnail(source, 400, createCanvas);

      expect(thumb.width).toBe(240);
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
        params: getPreset("balanced"),
        createCanvas,
      });

      expect(result).toHaveProperty("canvas");
      expect(result).toHaveProperty("originalCanvas");
      expect(result.canvas.width).toBe(800);
      expect(result.canvas.height).toBe(480);
    });

    it("should resize portrait source to landscape target (crop to fill)", () => {
      const source = createCanvas(600, 1000); // Portrait
      const ctx = source.getContext("2d");
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, 600, 1000);

      const result = processImage(source, {
        displayWidth: 800,
        displayHeight: 480,
        palette: SPECTRA6,
        params: getPreset("balanced"),
        createCanvas,
      });

      // Output should match target dimensions (cropped, not rotated)
      expect(result.canvas.width).toBe(800);
      expect(result.canvas.height).toBe(480);
    });

    it("should not auto-rotate, just resize to target dimensions", () => {
      const source = createCanvas(600, 1000); // Portrait
      const ctx = source.getContext("2d");
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, 600, 1000);

      // Portrait source with landscape target: should crop to fill, not rotate
      const result = processImage(source, {
        displayWidth: 800,
        displayHeight: 480,
        palette: SPECTRA6,
        params: getPreset("balanced"),
        createCanvas,
      });

      expect(result.canvas.width).toBe(800);
      expect(result.canvas.height).toBe(480);
    });

    it("should resize portrait source to portrait target without rotation", () => {
      const source = createCanvas(600, 1000); // Portrait
      const ctx = source.getContext("2d");
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, 600, 1000);

      // Portrait source with portrait target: should just resize
      const result = processImage(source, {
        displayWidth: 480,
        displayHeight: 800,
        palette: SPECTRA6,
        params: getPreset("balanced"),
        createCanvas,
      });

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
        params: getPreset("balanced"),
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
        params: getPreset("balanced"),
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

    it("should use fit scale mode with background", () => {
      const source = createCanvas(600, 1000); // Portrait
      const ctx = source.getContext("2d");
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, 600, 1000);

      const result = processImage(source, {
        displayWidth: 800,
        displayHeight: 480,
        palette: SPECTRA6,
        params: getPreset("balanced"),
        scaleMode: "fit",
        backgroundColor: "white",
        createCanvas,
      });

      // Output should match target dimensions
      expect(result.canvas.width).toBe(800);
      expect(result.canvas.height).toBe(480);

      // Left edge should be white (letterbox bar) — palette white is (255,255,255)
      const imageData = result.canvas
        .getContext("2d")
        .getImageData(0, 240, 1, 1);
      expect(imageData.data[0]).toBe(255);
      expect(imageData.data[1]).toBe(255);
      expect(imageData.data[2]).toBe(255);
    });

    it("should use fit scale mode with black background", () => {
      const source = createCanvas(600, 1000); // Portrait
      const ctx = source.getContext("2d");
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, 600, 1000);

      const result = processImage(source, {
        displayWidth: 800,
        displayHeight: 480,
        palette: SPECTRA6,
        params: getPreset("balanced"),
        scaleMode: "fit",
        backgroundColor: "black",
        createCanvas,
      });

      // Left edge should be black (letterbox bar) — palette black is (0,0,0)
      const imageData = result.canvas
        .getContext("2d")
        .getImageData(0, 240, 1, 1);
      expect(imageData.data[0]).toBe(0);
      expect(imageData.data[1]).toBe(0);
      expect(imageData.data[2]).toBe(0);
    });

    it("should use custom scale mode with zoom and pan", () => {
      const source = createCanvas(100, 100);
      const ctx = source.getContext("2d");
      ctx.fillStyle = "red";
      ctx.fillRect(0, 0, 100, 100);

      const result = processImage(source, {
        displayWidth: 200,
        displayHeight: 200,
        palette: SPECTRA6,
        params: getPreset("balanced"),
        scaleMode: "custom",
        backgroundColor: "white",
        zoom: 1.0,
        panX: 50,
        panY: 50,
        skipDithering: true,
        createCanvas,
      });

      expect(result.canvas.width).toBe(200);
      expect(result.canvas.height).toBe(200);

      // Top-left should be white background
      const bgPixel = result.canvas
        .getContext("2d")
        .getImageData(0, 0, 1, 1).data;
      expect(bgPixel[0]).toBe(255);
      expect(bgPixel[1]).toBe(255);
      expect(bgPixel[2]).toBe(255);
    });
  });

  describe("processImage orientation", () => {
    it("should output native dimensions when orientation is null", () => {
      const source = createCanvas(1000, 600);
      const ctx = source.getContext("2d");
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, 1000, 600);

      const result = processImage(source, {
        displayWidth: 800,
        displayHeight: 480,
        palette: SPECTRA6,
        params: getPreset("balanced"),
        orientation: null,
        createCanvas,
      });

      expect(result.canvas.width).toBe(800);
      expect(result.canvas.height).toBe(480);
    });

    it("should output native dims for portrait on landscape panel", () => {
      const source = createCanvas(600, 1000);
      const ctx = source.getContext("2d");
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, 600, 1000);

      const result = processImage(source, {
        displayWidth: 800,
        displayHeight: 480,
        palette: SPECTRA6,
        params: getPreset("balanced"),
        orientation: "portrait",
        createCanvas,
      });

      // Output should be native 800x480 (processed at 480x800, then rotated)
      expect(result.canvas.width).toBe(800);
      expect(result.canvas.height).toBe(480);
    });

    it("should output native dims for landscape on portrait panel", () => {
      const source = createCanvas(1000, 600);
      const ctx = source.getContext("2d");
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, 1000, 600);

      const result = processImage(source, {
        displayWidth: 1200,
        displayHeight: 1600,
        palette: SPECTRA6,
        params: getPreset("balanced"),
        orientation: "landscape",
        createCanvas,
      });

      // Output should be native 1200x1600 (processed at 1600x1200, then rotated)
      expect(result.canvas.width).toBe(1200);
      expect(result.canvas.height).toBe(1600);
    });

    it("should not rotate when orientation matches native", () => {
      // Red left half, blue right half — if rotated, top/bottom would change
      const source = createCanvas(800, 480);
      const ctx = source.getContext("2d");
      ctx.fillStyle = "red";
      ctx.fillRect(0, 0, 400, 480);
      ctx.fillStyle = "blue";
      ctx.fillRect(400, 0, 400, 480);

      const result = processImage(source, {
        displayWidth: 800,
        displayHeight: 480,
        palette: SPECTRA6,
        params: getPreset("balanced"),
        orientation: "landscape",
        skipDithering: true,
        createCanvas,
      });

      expect(result.canvas.width).toBe(800);
      expect(result.canvas.height).toBe(480);

      // Left should still be reddish, right should still be bluish (not swapped by rotation)
      const imgData = result.canvas.getContext("2d").getImageData(0, 0, 800, 480);
      const leftPixel = [imgData.data[0], imgData.data[1], imgData.data[2]];
      const rightPixel = [imgData.data[(799) * 4], imgData.data[(799) * 4 + 1], imgData.data[(799) * 4 + 2]];
      expect(leftPixel[0]).toBeGreaterThan(leftPixel[2]); // Red > Blue on left
      expect(rightPixel[2]).toBeGreaterThan(rightPixel[0]); // Blue > Red on right
    });

    it("should not rotate portrait panel with portrait orientation", () => {
      // Red top half, blue bottom half
      const source = createCanvas(1200, 1600);
      const ctx = source.getContext("2d");
      ctx.fillStyle = "red";
      ctx.fillRect(0, 0, 1200, 800);
      ctx.fillStyle = "blue";
      ctx.fillRect(0, 800, 1200, 800);

      const result = processImage(source, {
        displayWidth: 1200,
        displayHeight: 1600,
        palette: SPECTRA6,
        params: getPreset("balanced"),
        orientation: "portrait",
        skipDithering: true,
        createCanvas,
      });

      expect(result.canvas.width).toBe(1200);
      expect(result.canvas.height).toBe(1600);

      // Top should still be reddish, bottom should still be bluish
      const imgData = result.canvas.getContext("2d").getImageData(0, 0, 1200, 1600);
      const topPixel = [imgData.data[0], imgData.data[1], imgData.data[2]];
      const bottomIdx = (1599 * 1200) * 4;
      const bottomPixel = [imgData.data[bottomIdx], imgData.data[bottomIdx + 1], imgData.data[bottomIdx + 2]];
      expect(topPixel[0]).toBeGreaterThan(topPixel[2]); // Red > Blue on top
      expect(bottomPixel[2]).toBeGreaterThan(bottomPixel[0]); // Blue > Red on bottom
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

  describe("createEPDGZ", () => {
    it("should create a gzip-compressed buffer from canvas", async () => {
      const canvas = createCanvas(100, 100);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "red";
      ctx.fillRect(0, 0, 100, 100);

      const buffer = await createEPDGZ(canvas);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
      // Gzip magic number
      expect(buffer[0]).toBe(0x1f);
      expect(buffer[1]).toBe(0x8b);
    });

    it("should decompress to correct size (2 pixels per byte)", async () => {
      const width = 100;
      const height = 50;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, width, height);

      const compressed = await createEPDGZ(canvas);
      const raw = gunzipSync(compressed);

      const expectedSize = Math.ceil((width * height) / 2);
      expect(raw.length).toBe(expectedSize);
    });

    it("should encode palette colors to correct indices", async () => {
      // Create a 6x1 canvas with one pixel of each palette color
      const canvas = createCanvas(6, 1);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "rgb(0, 0, 0)"; // Black = 0
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillStyle = "rgb(255, 255, 255)"; // White = 1
      ctx.fillRect(1, 0, 1, 1);
      ctx.fillStyle = "rgb(255, 255, 0)"; // Yellow = 2
      ctx.fillRect(2, 0, 1, 1);
      ctx.fillStyle = "rgb(255, 0, 0)"; // Red = 3
      ctx.fillRect(3, 0, 1, 1);
      ctx.fillStyle = "rgb(0, 0, 255)"; // Blue = 5
      ctx.fillRect(4, 0, 1, 1);
      ctx.fillStyle = "rgb(0, 255, 0)"; // Green = 6
      ctx.fillRect(5, 0, 1, 1);

      const compressed = await createEPDGZ(canvas);
      const raw = gunzipSync(compressed);

      // 6 pixels = 3 bytes (2 pixels per byte, high nibble first)
      expect(raw.length).toBe(3);
      expect(raw[0]).toBe((0 << 4) | 1); // Black, White
      expect(raw[1]).toBe((2 << 4) | 3); // Yellow, Red
      expect(raw[2]).toBe((5 << 4) | 6); // Blue, Green
    });

    it("should pad odd-width rows with white", async () => {
      // 3-pixel wide canvas: 2 bytes per row, second byte has padding
      const canvas = createCanvas(3, 1);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "rgb(0, 0, 0)"; // Black = 0
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillStyle = "rgb(255, 0, 0)"; // Red = 3
      ctx.fillRect(1, 0, 1, 1);
      ctx.fillStyle = "rgb(0, 0, 255)"; // Blue = 5
      ctx.fillRect(2, 0, 1, 1);

      const compressed = await createEPDGZ(canvas);
      const raw = gunzipSync(compressed);

      expect(raw.length).toBe(2);
      expect(raw[0]).toBe((0 << 4) | 3); // Black, Red
      expect(raw[1]).toBe((5 << 4) | 1); // Blue, White (padded)
    });
  });
});
