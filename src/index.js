/**
 * epaper-image-convert
 *
 * Convert images for e-paper displays with advanced tone mapping,
 * dithering, and color palette optimization.
 */

// Re-export from processor
export {
  processImage,
  applyExifOrientation,
  resizeImageCover,
  generateThumbnail,
  createPNG,
  createBMP,
  getCanvasContext,
  paletteToArray,
  rgbToLab,
  rotate90Clockwise,
  DEFAULT_DISPLAY_WIDTH,
  DEFAULT_DISPLAY_HEIGHT,
  DEFAULT_THUMBNAIL_WIDTH,
  DEFAULT_THUMBNAIL_HEIGHT,
} from "./processor.js";

// Re-export from palettes
export {
  SPECTRA6,
  PALETTE_PRESETS,
  getPalette,
  getPaletteNames,
  parsePalette,
  validatePalette,
} from "./palettes.js";

// Re-export from presets
export {
  PRESETS,
  BALANCED_PRESET,
  DYNAMIC_PRESET,
  VIVID_PRESET,
  SOFT_PRESET,
  GRAYSCALE_PRESET,
  DITHER_ALGORITHMS,
  getPreset,
  getPresetNames,
  getPresetOptions,
  getDefaultParams,
  mergeParams,
  getDitherOptions,
} from "./presets.js";

// Convenience function for simple conversion
/**
 * Convert an image file to e-paper format
 *
 * @param {string} inputPath - Path to input image file
 * @param {Object} options - Conversion options
 * @param {number} options.width - Display width (default: 800)
 * @param {number} options.height - Display height (default: 480)
 * @param {string} options.palettePreset - Palette preset name (default: "spectra6")
 * @param {Object} options.palette - Custom palette pair { theoretical, perceived }
 * @param {string} options.processingPreset - Processing preset name (default: "balanced")
 * @param {Object} options.params - Custom processing parameters
 * @param {boolean} options.skipRotation - Skip portrait rotation (default: false)
 * @param {boolean} options.verbose - Enable verbose logging (default: false)
 * @returns {Promise<Object>} { canvas, originalCanvas, buffer }
 */
export async function convertImage(inputPath, options = {}) {
  // Dynamic import for Node.js dependencies
  const { createCanvas, loadImage } = await import("canvas");
  const ExifReader = (await import("exifreader")).default;
  const fs = await import("fs");

  const {
    width = 800,
    height = 480,
    palettePreset = "spectra6",
    palette = null,
    processingPreset = "balanced",
    params = null,
    skipRotation = false,
    verbose = false,
  } = options;

  // Import what we need
  const { processImage, applyExifOrientation, createPNG } =
    await import("./processor.js");
  const { getPalette } = await import("./palettes.js");
  const { getPreset, mergeParams } = await import("./presets.js");

  // Load image
  const imageBuffer = fs.readFileSync(inputPath);
  const image = await loadImage(imageBuffer);

  // Create canvas from image
  const sourceCanvas = createCanvas(image.width, image.height);
  const ctx = sourceCanvas.getContext("2d");
  ctx.drawImage(image, 0, 0);

  // Read EXIF orientation
  let orientation = 1;
  try {
    const tags = ExifReader.load(imageBuffer);
    if (tags.Orientation) {
      orientation = tags.Orientation.value;
    }
  } catch (_e) {
    // Ignore EXIF errors
  }

  // Apply EXIF orientation
  const exifCorrectedCanvas = applyExifOrientation(
    sourceCanvas,
    orientation,
    createCanvas,
  );

  // Get palette
  const usePalette = palette || getPalette(palettePreset);
  if (!usePalette) {
    throw new Error(`Unknown palette preset: ${palettePreset}`);
  }

  // Get processing params
  let processingParams;
  if (params) {
    processingParams = mergeParams(params);
  } else {
    const preset = getPreset(processingPreset);
    if (!preset) {
      throw new Error(`Unknown processing preset: ${processingPreset}`);
    }
    processingParams = preset;
  }

  // Process image
  const { canvas, originalCanvas } = processImage(exifCorrectedCanvas, {
    displayWidth: width,
    displayHeight: height,
    palette: usePalette,
    params: processingParams,
    skipRotation,
    verbose,
    createCanvas,
  });

  // Create PNG buffer
  const buffer = await createPNG(canvas);

  return { canvas, originalCanvas, buffer };
}
