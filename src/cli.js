#!/usr/bin/env node
/**
 * epaper-image-convert CLI
 *
 * Convert images for e-paper displays from the command line.
 */

import { program } from "commander";
import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "canvas";
import ExifReader from "exifreader";

import {
  processImage,
  applyExifOrientation,
  generateThumbnail,
  createPNG,
  createBMP,
  DEFAULT_DISPLAY_WIDTH,
  DEFAULT_DISPLAY_HEIGHT,
  DEFAULT_THUMBNAIL_WIDTH,
  DEFAULT_THUMBNAIL_HEIGHT,
} from "./processor.js";

import {
  getPalette,
  getPaletteNames,
  getPaletteOptions,
  parsePalette,
  SPECTRA6,
} from "./palettes.js";

import {
  getPreset,
  getPresetNames,
  getDefaultParams,
  getPresetOptions,
  getDitherOptions,
} from "./presets.js";

const DEFAULT_PARAMS = getDefaultParams();

/**
 * Parse dimension string (e.g., "800x480") into width and height
 */
function parseDimension(value) {
  const match = value.match(/^(\d+)x(\d+)$/);
  if (!match) {
    throw new Error(
      `Invalid dimension format: ${value}. Expected format: WIDTHxHEIGHT (e.g., 800x480)`,
    );
  }
  return {
    width: parseInt(match[1], 10),
    height: parseInt(match[2], 10),
  };
}

/**
 * Load and process a single image
 */
async function processImageFile(inputPath, outputPath, options) {
  console.log(`Processing: ${inputPath}`);

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
  let palette;
  if (options.palette) {
    try {
      palette = parsePalette(options.palette);
    } catch (e) {
      console.error(`Error parsing palette JSON: ${e.message}`);
      process.exit(1);
    }
  } else {
    palette = getPalette(options.palettePreset) || SPECTRA6;
  }

  // Get processing parameters
  let processingParams;
  if (options.processingPreset && options.processingPreset !== "custom") {
    const preset = getPreset(options.processingPreset);
    if (!preset) {
      console.error(`Unknown processing preset: ${options.processingPreset}`);
      console.error(`Available presets: ${getPresetNames().join(", ")}`);
      process.exit(1);
    }
    processingParams = { ...preset };
  } else {
    processingParams = { ...DEFAULT_PARAMS };
  }

  // Override with individual options
  if (options.exposure !== undefined)
    processingParams.exposure = options.exposure;
  if (options.saturation !== undefined)
    processingParams.saturation = options.saturation;
  if (options.contrast !== undefined)
    processingParams.contrast = options.contrast;
  if (options.toneMode !== undefined)
    processingParams.toneMode = options.toneMode;
  if (options.scurveStrength !== undefined)
    processingParams.strength = options.scurveStrength;
  if (options.scurveShadow !== undefined)
    processingParams.shadowBoost = options.scurveShadow;
  if (options.scurveHighlight !== undefined)
    processingParams.highlightCompress = options.scurveHighlight;
  if (options.scurveMidpoint !== undefined)
    processingParams.midpoint = options.scurveMidpoint;
  if (options.colorMethod !== undefined)
    processingParams.colorMethod = options.colorMethod;
  if (options.ditherAlgorithm !== undefined)
    processingParams.ditherAlgorithm = options.ditherAlgorithm;
  if (options.compressDynamicRange !== undefined)
    processingParams.compressDynamicRange = options.compressDynamicRange;

  // Parse dimensions
  const { width: displayWidth, height: displayHeight } = parseDimension(
    options.dimension,
  );

  // Process image
  const { canvas, originalCanvas } = processImage(exifCorrectedCanvas, {
    displayWidth,
    displayHeight,
    palette,
    params: processingParams,
    skipRotation: options.skipRotation,
    skipDithering: options.skipDithering,
    usePerceivedOutput: options.usePerceivedOutput,
    verbose: options.verbose,
    createCanvas,
  });

  // Create output directory if needed
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Save output in requested format
  const format = options.format || "png";
  let outputBuffer;
  if (format === "bmp") {
    outputBuffer = createBMP(canvas);
  } else {
    outputBuffer = await createPNG(canvas);
  }
  fs.writeFileSync(outputPath, outputBuffer);
  console.log(`  Output: ${outputPath}`);

  // Generate thumbnail if requested
  if (options.thumbnail) {
    const thumbDim = parseDimension(options.thumbnailDimension);
    const thumbnailCanvas = generateThumbnail(
      originalCanvas,
      thumbDim.width,
      thumbDim.height,
      createCanvas,
    );

    // Convert thumbnail to JPEG
    const thumbnailBuffer = thumbnailCanvas.toBuffer("image/jpeg", {
      quality: 0.85,
    });

    const thumbPath = options.thumbnail;
    const thumbDir = path.dirname(thumbPath);
    if (!fs.existsSync(thumbDir)) {
      fs.mkdirSync(thumbDir, { recursive: true });
    }
    fs.writeFileSync(thumbPath, thumbnailBuffer);
    console.log(`  Thumbnail: ${thumbPath}`);
  }

  return { canvas, originalCanvas };
}

/**
 * Display available presets and exit
 */
function listPresets() {
  console.log("\nProcessing Presets:");
  console.log("===================");
  for (const preset of getPresetOptions()) {
    console.log(`  ${preset.value.padEnd(12)} - ${preset.title}`);
    console.log(`                 ${preset.description}`);
  }

  console.log("\nPalette Presets:");
  console.log("================");
  for (const palette of getPaletteOptions()) {
    console.log(`  ${palette.value.padEnd(12)} - ${palette.title}`);
    console.log(`                 ${palette.description}`);
  }

  console.log("\nDithering Algorithms:");
  console.log("=====================");
  for (const dither of getDitherOptions()) {
    console.log(`  ${dither.value.padEnd(16)} - ${dither.title}`);
  }

  console.log("");
}

// CLI setup
program
  .name("epaper-image-convert")
  .description(
    "Convert images for e-paper displays with advanced tone mapping and dithering",
  )
  .version("0.1.0")
  .argument("[input]", "Input image file or directory")
  .argument("[output]", "Output file or directory")
  .option("-l, --list-presets", "List available presets and exit")
  .option(
    "-d, --dimension <WxH>",
    "Display dimension (e.g., 800x480)",
    `${DEFAULT_DISPLAY_WIDTH}x${DEFAULT_DISPLAY_HEIGHT}`,
  )
  .option("-f, --format <format>", "Output format: png or bmp", "png")
  .option(
    "--palette-preset <name>",
    `Palette preset: ${getPaletteNames().join(", ")}`,
    "spectra6",
  )
  .option(
    "--palette <json>",
    "Custom palette JSON (overrides --palette-preset)",
  )
  .option(
    "-p, --processing-preset <name>",
    `Processing preset: ${getPresetNames().join(", ")}`,
    "balanced",
  )
  .option("--exposure <value>", "Exposure multiplier (0.5-2.0)", parseFloat)
  .option("--saturation <value>", "Saturation multiplier (0.5-2.0)", parseFloat)
  .option("--contrast <value>", "Contrast multiplier (0.5-2.0)", parseFloat)
  .option("--tone-mode <mode>", "Tone mapping mode: scurve or contrast")
  .option(
    "--scurve-strength <value>",
    "S-curve overall strength (0.0-1.0)",
    parseFloat,
  )
  .option(
    "--scurve-shadow <value>",
    "S-curve shadow boost (0.0-1.0)",
    parseFloat,
  )
  .option(
    "--scurve-highlight <value>",
    "S-curve highlight compress (0.5-5.0)",
    parseFloat,
  )
  .option("--scurve-midpoint <value>", "S-curve midpoint (0.3-0.7)", parseFloat)
  .option("--color-method <method>", "Color matching: rgb or lab")
  .option(
    "--dither-algorithm <algorithm>",
    "Dithering algorithm: floyd-steinberg, stucki, burkes, or sierra",
  )
  .option("--compress-dynamic-range", "Compress dynamic range to display range")
  .option("--no-compress-dynamic-range", "Disable dynamic range compression")
  .option("--skip-rotation", "Skip portrait-to-landscape rotation")
  .option("--skip-dithering", "Skip dithering step")
  .option(
    "--use-perceived-output",
    "Use perceived palette for output (for preview)",
  )
  .option("-t, --thumbnail <path>", "Generate thumbnail and save to path")
  .option(
    "--thumbnail-dimension <WxH>",
    "Thumbnail dimension",
    `${DEFAULT_THUMBNAIL_WIDTH}x${DEFAULT_THUMBNAIL_HEIGHT}`,
  )
  .option("-v, --verbose", "Enable verbose output")
  .action(async (input, output, options) => {
    // Handle --list-presets option
    if (options.listPresets) {
      listPresets();
      process.exit(0);
    }

    // Require input if not listing presets
    if (!input) {
      console.error("Error: Input file or directory is required");
      console.error("Use --help for usage information");
      process.exit(1);
    }

    try {
      const inputPath = path.resolve(input);

      if (!fs.existsSync(inputPath)) {
        console.error(`Error: Input not found: ${inputPath}`);
        process.exit(1);
      }

      const stats = fs.statSync(inputPath);

      if (stats.isDirectory()) {
        // Process directory
        const files = fs
          .readdirSync(inputPath)
          .filter((f) => /\.(jpe?g|png)$/i.test(f));

        if (files.length === 0) {
          console.error("No image files found in directory");
          process.exit(1);
        }

        const outputDir = output
          ? path.resolve(output)
          : path.join(inputPath, "converted");

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        console.log(`Processing ${files.length} images...`);

        for (const file of files) {
          const inputFile = path.join(inputPath, file);
          const baseName = path.basename(file, path.extname(file));
          const ext = options.format === "bmp" ? "bmp" : "png";
          const outputFile = path.join(outputDir, `${baseName}.${ext}`);

          const fileOptions = { ...options };
          if (options.thumbnail) {
            fileOptions.thumbnail = path.join(
              outputDir,
              `${baseName}_thumb.jpg`,
            );
          }

          await processImageFile(inputFile, outputFile, fileOptions);
        }

        console.log(`\nDone! Processed ${files.length} images.`);
      } else {
        // Process single file
        let outputPath;
        if (output) {
          const resolvedOutput = path.resolve(output);
          // Check if output is a directory
          if (
            fs.existsSync(resolvedOutput) &&
            fs.statSync(resolvedOutput).isDirectory()
          ) {
            const baseName = path.basename(inputPath, path.extname(inputPath));
            const ext = options.format === "bmp" ? "bmp" : "png";
            outputPath = path.join(resolvedOutput, `${baseName}.${ext}`);
          } else {
            outputPath = resolvedOutput;
          }
        } else {
          const ext = options.format === "bmp" ? "bmp" : "png";
          outputPath = inputPath.replace(/\.[^.]+$/, `.${ext}`);
        }

        await processImageFile(inputPath, outputPath, options);
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Parse and execute
program.parse();
