/**
 * E-paper display color palettes
 *
 * Each palette preset contains a pair of palettes:
 * - theoretical: Pure RGB values used for device output (what gets sent to the display)
 * - perceived: Actual RGB values as perceived on screen (for dithering calculations)
 *
 * Palette format:
 * {
 *   theoretical: {
 *     black: { r, g, b },
 *     white: { r, g, b },
 *     yellow: { r, g, b },
 *     red: { r, g, b },
 *     blue: { r, g, b },
 *     green: { r, g, b }
 *   },
 *   perceived: {
 *     black: { r, g, b },
 *     white: { r, g, b },
 *     yellow: { r, g, b },
 *     red: { r, g, b },
 *     blue: { r, g, b },
 *     green: { r, g, b }
 *   }
 * }
 */

/**
 * Spectra 6 (ACeP - Advanced Color ePaper)
 * Used by many modern 6-color e-paper displays including Waveshare
 */
export const SPECTRA6 = {
  theoretical: {
    black: { r: 0, g: 0, b: 0 },
    white: { r: 255, g: 255, b: 255 },
    yellow: { r: 255, g: 255, b: 0 },
    red: { r: 255, g: 0, b: 0 },
    blue: { r: 0, g: 0, b: 255 },
    green: { r: 0, g: 255, b: 0 },
  },
  perceived: {
    black: { r: 2, g: 2, b: 2 },
    white: { r: 190, g: 200, b: 200 },
    yellow: { r: 205, g: 202, b: 0 },
    red: { r: 135, g: 19, b: 0 },
    blue: { r: 5, g: 64, b: 158 },
    green: { r: 39, g: 102, b: 60 },
  },
};

/**
 * Grayscale 16-level (GC16) — for IT8951-based panels such as the Seeed
 * reTerminal E1003 (10.3" ED103TC2). Unlike the named-color Spectra palette,
 * a grayscale palette carries a `grays` array of [r,g,b] levels; level index i
 * maps directly to the 4-bit gray value i (0 = black … 15 = white). Dithering
 * is identical to the color path, just quantized against this gray ramp.
 */
function buildGrayRamp(levels) {
  const grays = [];
  for (let i = 0; i < levels; i++) {
    const v = Math.round((i * 255) / (levels - 1));
    grays.push([v, v, v]);
  }
  return grays;
}

const GRAY16_RAMP = buildGrayRamp(16);

// --- Perceived (calibrated) gray ramp -------------------------------------
// e-paper gray can't reach pure black/white, so the *perceived* ramp is
// compressed to the panel's real luminance. This is what makes
// compressDynamicRange (CDR) meaningful for GC16 (without it, perceived black/
// white are 0/255 and CDR is a no-op) and makes the preview match the panel.
//
// GRAY_BLACK_Y / GRAY_WHITE_Y are RELATIVE LUMINANCE (Y, 0..1) measured on the
// panel (display full black / full white). MEASURE on your panel and update.
// black=0 keeps blacks at pure black (CDR compresses only the white end) for
// punchier shadows; raise it toward the panel's real black for WYSIWYG.
const GRAY_BLACK_Y = 0;
const GRAY_WHITE_Y = 0.9;

// CIE L* (0..100) of a relative luminance Y (0..1).
const lstarFromY = (y) => (y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y);

// 8-bit sRGB neutral gray for a CIE L*.
function grayFromLstar(L) {
  const y = L > 8 ? Math.pow((L + 16) / 116, 3) : L / 903.3;
  const s = y <= 0.0031308 ? 12.92 * y : 1.055 * Math.pow(y, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(s * 255)));
}

// Gray ramp between the measured endpoints. gamma shapes the panel's mid-level
// response: gamma=1 is perceptually even (linear in L*); gamma>1 darkens the
// mid levels, gamma<1 lightens them. Tune it so the preview matches the panel,
// since the real GC16 level->luminance curve is not exactly L*-linear.
function buildCalibratedGrayRamp(blackL, whiteL, levels, gamma = 1) {
  const grays = [];
  for (let i = 0; i < levels; i++) {
    const t = i / (levels - 1);
    const shaped = gamma === 1 ? t : Math.pow(t, gamma);
    const L = blackL + shaped * (whiteL - blackL);
    const v = grayFromLstar(L);
    grays.push([v, v, v]);
  }
  return grays;
}

/**
 * Build a 16-level grayscale (GC16) palette from two measured luminance
 * endpoints. The perceived ramp is *derived* (L* interpolation -> sRGB), so only
 * the two endpoints need to be measured/transported -- a device reports its
 * Y_black / Y_white and everyone (CLI, webapp, app) derives the same ramp here.
 *
 * theoretical = the device output ramp (0..255, level i -> nibble i).
 * perceived   = the panel's compressed luminance (drives dithering + CDR); the
 *               black/white aliases keep the background + dynamic-range code
 *               (which reads palette.black/white) working.
 *
 * @param {Object} [opts]
 * @param {number} [opts.blackY] Relative luminance Y (0..1) of full black.
 * @param {number} [opts.whiteY] Relative luminance Y (0..1) of full white.
 * @param {number} [opts.gamma] Mid-level shaping (1 = linear in L*; >1 darkens).
 */
export function makeGrayscale16({
  blackY = GRAY_BLACK_Y,
  whiteY = GRAY_WHITE_Y,
  gamma = 1,
} = {}) {
  const perceived = buildCalibratedGrayRamp(
    lstarFromY(blackY),
    lstarFromY(whiteY),
    16,
    gamma,
  );
  const toC = (a) => ({ r: a[0], g: a[1], b: a[2] });
  return {
    mode: "grayscale",
    levels: 16,
    theoretical: {
      grays: GRAY16_RAMP,
      black: { r: 0, g: 0, b: 0 },
      white: { r: 255, g: 255, b: 255 },
    },
    perceived: {
      grays: perceived,
      black: toC(perceived[0]),
      white: toC(perceived[perceived.length - 1]),
    },
  };
}

// Default GC16 palette. GRAY_BLACK_Y / GRAY_WHITE_Y are the fallback endpoints;
// a device that reports its own measured luminance overrides them.
export const GRAYSCALE16 = makeGrayscale16();

// Preset palette registry
export const PALETTE_PRESETS = {
  spectra6: SPECTRA6,
  grayscale16: GRAYSCALE16,
  default: SPECTRA6,
};

/**
 * @param {Object} palettePair - Palette pair { theoretical, perceived }
 * @returns {boolean} True if this is a grayscale (gray-ramp) palette.
 */
export function isGrayscalePalette(palettePair) {
  return !!(
    palettePair &&
    palettePair.theoretical &&
    Array.isArray(palettePair.theoretical.grays)
  );
}

/**
 * Get a palette preset by name
 * @param {string} presetName - Name of the palette preset
 * @returns {Object|null} Palette pair object { theoretical, perceived } or null if not found
 */
export function getPalette(presetName) {
  const preset = PALETTE_PRESETS[presetName];
  return preset ? { ...preset } : null;
}

/**
 * Get all available palette preset names
 * @returns {string[]} Array of preset names
 */
export function getPaletteNames() {
  return Object.keys(PALETTE_PRESETS);
}

/**
 * Get palette options for UI/CLI display
 * @returns {Array<{value: string, title: string, description: string}>} Array of palette options
 */
export function getPaletteOptions() {
  return [
    {
      value: "spectra6",
      title: "Spectra 6 (Default)",
      description: "6-color ACeP palette for Waveshare and similar displays",
    },
    {
      value: "grayscale16",
      title: "Grayscale 16 (GC16)",
      description:
        "16-level grayscale for IT8951 panels (e.g. reTerminal E1003)",
    },
  ];
}

/**
 * Validate a single color palette (theoretical or perceived)
 * @param {Object} palette - Single palette object with color entries
 * @param {string} name - Name for error messages (e.g., "theoretical" or "perceived")
 * @throws {Error} If palette is invalid
 */
function validateSinglePalette(palette, name) {
  if (!palette || typeof palette !== "object") {
    throw new Error(`${name} palette must be an object`);
  }

  // Grayscale palette: a `grays` array of [r,g,b] levels (2..256 entries).
  if (Array.isArray(palette.grays)) {
    if (palette.grays.length < 2) {
      throw new Error(`${name} grayscale palette must have at least 2 levels`);
    }
    for (const level of palette.grays) {
      if (
        !Array.isArray(level) ||
        level.length !== 3 ||
        level.some((c) => typeof c !== "number" || c < 0 || c > 255)
      ) {
        throw new Error(`Invalid grayscale level in ${name} palette`);
      }
    }
    return;
  }

  const requiredColors = ["black", "white", "yellow", "red", "blue", "green"];
  for (const color of requiredColors) {
    if (!palette[color]) {
      throw new Error(`Missing required color in ${name} palette: ${color}`);
    }
    const { r, g, b } = palette[color];
    if (
      typeof r !== "number" ||
      typeof g !== "number" ||
      typeof b !== "number"
    ) {
      throw new Error(`Invalid RGB values for ${name}.${color}`);
    }
    if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
      throw new Error(`RGB values must be 0-255 for ${name}.${color}`);
    }
  }
}

/**
 * Validate a palette pair object
 * @param {Object} palettePair - Palette pair with theoretical and perceived
 * @returns {boolean} True if valid
 * @throws {Error} If palette pair is invalid
 */
export function validatePalette(palettePair) {
  if (!palettePair || typeof palettePair !== "object") {
    throw new Error("Palette must be an object");
  }

  if (!palettePair.theoretical) {
    throw new Error("Palette must have a 'theoretical' property");
  }
  if (!palettePair.perceived) {
    throw new Error("Palette must have a 'perceived' property");
  }

  validateSinglePalette(palettePair.theoretical, "theoretical");
  validateSinglePalette(palettePair.perceived, "perceived");

  return true;
}

/**
 * Parse a palette pair from JSON string
 * @param {string} jsonString - JSON string representing a palette pair
 * @returns {Object} Parsed palette pair object { theoretical, perceived }
 * @throws {Error} If JSON is invalid or palette format is incorrect
 */
export function parsePalette(jsonString) {
  const palettePair = JSON.parse(jsonString);
  validatePalette(palettePair);
  // A grayscale palette may arrive as bare { grays: [...] } (e.g. from the
  // server's MapProcessingSettings). Derive black/white aliases from the ramp
  // ends so the background and dynamic-range-compression code paths -- which
  // read palette.black/white -- work, matching the built-in GRAYSCALE16.
  if (isGrayscalePalette(palettePair)) {
    for (const sub of [palettePair.theoretical, palettePair.perceived]) {
      if (sub && Array.isArray(sub.grays) && sub.grays.length) {
        const lo = sub.grays[0];
        const hi = sub.grays[sub.grays.length - 1];
        if (!sub.black) sub.black = { r: lo[0], g: lo[1], b: lo[2] };
        if (!sub.white) sub.white = { r: hi[0], g: hi[1], b: hi[2] };
      }
    }
  }
  return palettePair;
}

// Default export for convenience
export default PALETTE_PRESETS;
