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

// Preset palette registry
export const PALETTE_PRESETS = {
  spectra6: SPECTRA6,
  default: SPECTRA6,
};

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
  return palettePair;
}

// Default export for convenience
export default PALETTE_PRESETS;
