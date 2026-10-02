/**
 * ESP32 PhotoFrame device config exports
 *
 * The frame's web UI (Settings -> Maintenance -> Config Backup -> Export
 * Config) writes a JSON file holding the raw responses of the device's REST
 * endpoints:
 *
 *   {
 *     "config":      GET /api/config               (display_orientation, ...)
 *     "processing":  GET /api/settings/processing  (exposure, toneMode, ...)
 *     "palette":     GET /api/settings/palette     (the six perceived colours,
 *                                                   or { black_y, white_y,
 *                                                   gamma } on a GC16 panel)
 *     "system_info": { board_name, display_type, width, height, version }
 *   }
 *
 * This module turns such a file into what processImage() needs: a palette
 * pair and processing params, plus the panel size and orientation. It is
 * pure (no file I/O) so it works in the browser as well as the CLI.
 *
 * `system_info` is only written by newer firmware; without it the panel
 * size is unknown and the caller has to supply one.
 *
 * @module device-config
 */

import {
  SPECTRA6,
  GRAYSCALE16,
  makeGrayscale16,
  validatePalette,
} from "./palettes.js";

const PALETTE_COLORS = ["black", "white", "yellow", "red", "blue", "green"];

// Processing settings the device reports that are processImage() params,
// under the same names.
const PROCESSING_PARAM_KEYS = [
  "exposure",
  "saturation",
  "toneMode",
  "contrast",
  "strength",
  "shadowBoost",
  "highlightCompress",
  "midpoint",
  "colorMethod",
  "ditherAlgorithm",
  "compressDynamicRange",
];

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

/**
 * Whether a device palette is a GC16 gray calibration ({ black_y, white_y })
 * rather than six colours.
 * @param {*} palette
 * @returns {boolean}
 */
export function isGrayCalibration(palette) {
  return (
    isPlainObject(palette) &&
    typeof palette.black_y === "number" &&
    typeof palette.white_y === "number"
  );
}

function validateDevicePalette(palette) {
  if (!isPlainObject(palette)) {
    throw new Error('"palette" must be an object');
  }
  if ("black_y" in palette || "white_y" in palette) {
    if (!isGrayCalibration(palette)) {
      throw new Error(
        '"palette.black_y" and "palette.white_y" must be numbers',
      );
    }
    if ("gamma" in palette && typeof palette.gamma !== "number") {
      throw new Error('"palette.gamma" must be a number');
    }
    return;
  }
  for (const name of PALETTE_COLORS) {
    const color = palette[name];
    if (
      !isPlainObject(color) ||
      !["r", "g", "b"].every((c) => typeof color[c] === "number")
    ) {
      throw new Error(
        `"palette.${name}" must be an object with numeric r, g and b`,
      );
    }
  }
}

function validateSystemInfo(info) {
  if (!isPlainObject(info)) {
    throw new Error('"system_info" must be an object');
  }
  if (!isPositiveInteger(info.width) || !isPositiveInteger(info.height)) {
    throw new Error(
      '"system_info.width" and "system_info.height" must be positive integers',
    );
  }
  if (
    info.display_type !== undefined &&
    typeof info.display_type !== "string"
  ) {
    throw new Error('"system_info.display_type" must be a string');
  }
}

/**
 * Validate a device config export and pull out what image conversion needs.
 *
 * @param {Object|string} data - The export, parsed or as JSON text
 * @returns {{
 *   processing: Object|null,
 *   palette: Object|null,
 *   orientation: ("landscape"|"portrait")|null,
 *   width: number|null,
 *   height: number|null,
 *   version: string,
 *   grayscale: boolean,
 *   boardName: string|null,
 * }} `processing` and `palette` are the device's blocks as exported;
 *   `grayscale` is true for a GC16 panel (display_type "gc…", or, for an
 *   export without system_info, a gray calibration palette)
 * @throws {Error} If the data is not a device config export
 */
export function parseDeviceConfig(data) {
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch (e) {
      throw new Error(`not valid JSON: ${e.message}`);
    }
  }
  if (!isPlainObject(data)) {
    throw new Error("expected a JSON object");
  }
  const { config, processing, palette, system_info: systemInfo } = data;
  if (
    processing === undefined &&
    palette === undefined &&
    config === undefined
  ) {
    throw new Error(
      'not a device config export (no "processing", "palette" or "config" key)',
    );
  }
  if (processing !== undefined && !isPlainObject(processing)) {
    throw new Error('"processing" must be an object');
  }
  if (palette !== undefined) {
    validateDevicePalette(palette);
  }
  if (config !== undefined && !isPlainObject(config)) {
    throw new Error('"config" must be an object');
  }
  if (systemInfo !== undefined) {
    validateSystemInfo(systemInfo);
  }

  let orientation = null;
  if (config && config.display_orientation !== undefined) {
    if (!["landscape", "portrait"].includes(config.display_orientation)) {
      throw new Error(
        '"config.display_orientation" must be "landscape" or "portrait"',
      );
    }
    orientation = config.display_orientation;
  }

  // The firmware names grayscale panels "gc16" (and would name an 8- or
  // 4-level one "gc8"/"gc4"). Without system_info the palette shape still
  // tells: only a grayscale panel reports luminance endpoints.
  const grayscale = systemInfo
    ? (systemInfo.display_type || "").startsWith("gc")
    : isGrayCalibration(palette);

  return {
    processing: processing ?? null,
    palette: palette ?? null,
    orientation,
    width: systemInfo ? systemInfo.width : null,
    height: systemInfo ? systemInfo.height : null,
    version: (systemInfo && systemInfo.version) || "",
    grayscale,
    boardName: (systemInfo && systemInfo.board_name) || null,
  };
}

/**
 * The palette pair to dither with for the exporting device.
 *
 * Colour panel: SPECTRA6's theoretical colours with the device's calibrated
 * perceived colours. Grayscale panel: the 16-level ramp derived from the
 * device's measured luminance endpoints (the default GC16 ramp when the
 * export carries none). Each override, when given, replaces the file's value
 * for the grayscale ramp.
 *
 * @param {ReturnType<typeof parseDeviceConfig>} deviceConfig
 * @param {Object} [overrides]
 * @param {number} [overrides.blackY]
 * @param {number} [overrides.whiteY]
 * @param {number} [overrides.gamma]
 * @returns {Object} Palette pair { theoretical, perceived }
 */
export function paletteFromDeviceConfig(deviceConfig, overrides = {}) {
  const { palette, grayscale } = deviceConfig;
  if (grayscale) {
    const calibration = isGrayCalibration(palette) ? palette : null;
    const blackY = overrides.blackY ?? calibration?.black_y;
    const whiteY = overrides.whiteY ?? calibration?.white_y;
    const gamma = overrides.gamma ?? calibration?.gamma;
    if (blackY === undefined && whiteY === undefined && gamma === undefined) {
      return GRAYSCALE16;
    }
    return makeGrayscale16({ blackY, whiteY, gamma });
  }
  if (!palette) {
    return SPECTRA6;
  }
  const pair = { theoretical: SPECTRA6.theoretical, perceived: palette };
  validatePalette(pair);
  return pair;
}

/**
 * The device's processing settings as processImage() params: only the keys
 * the export carries, so the result can be layered over a preset.
 *
 * @param {ReturnType<typeof parseDeviceConfig>} deviceConfig
 * @returns {Object} Partial processing params ({} when the export has none)
 */
export function paramsFromDeviceConfig(deviceConfig) {
  const params = {};
  const { processing } = deviceConfig;
  if (!processing) {
    return params;
  }
  for (const key of PROCESSING_PARAM_KEYS) {
    if (processing[key] !== undefined) {
      params[key] = processing[key];
    }
  }
  return params;
}
