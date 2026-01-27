/**
 * Image processing presets for e-paper displays
 *
 * Each preset defines a combination of processing parameters
 * optimized for different use cases.
 *
 * @module presets
 */

// =============================================================================
// Preset Definitions
// =============================================================================

/**
 * Compressed Dynamic Range (CDR) preset
 *
 * Best for: General use, prevents overexposure, works well with most images
 * Characteristics: Slightly darker, but preserves detail in highlights
 *
 * @type {ProcessingParams}
 */
export const CDR_PRESET = {
  name: "cdr",
  title: "Compressed Dynamic Range (Default)",
  description:
    "Balanced preset that compresses highlights to prevent overexposure. Works well with most images.",
  exposure: 1.0,
  saturation: 1.0,
  toneMode: "contrast",
  contrast: 1.0,
  colorMethod: "rgb",
  ditherAlgorithm: "floyd-steinberg",
  compressDynamicRange: true,
};

/**
 * S-Curve preset
 *
 * Best for: Photos with good dynamic range, artistic effect
 * Characteristics: Enhanced contrast, more vibrant colors
 *
 * @type {ProcessingParams}
 */
export const SCURVE_PRESET = {
  name: "scurve",
  title: "S-Curve",
  description:
    "Advanced tone mapping with brighter output. Some parts of the image may be over-exposed.",
  exposure: 1.0,
  saturation: 1.3,
  toneMode: "scurve",
  contrast: 1.0,
  strength: 0.9,
  shadowBoost: 0.0,
  highlightCompress: 1.5,
  midpoint: 0.5,
  colorMethod: "rgb",
  ditherAlgorithm: "floyd-steinberg",
  compressDynamicRange: false,
};

/**
 * Vivid preset - High saturation
 *
 * Best for: Colorful images, illustrations
 * Characteristics: Boosted colors, vivid output
 *
 * @type {ProcessingParams}
 */
export const VIVID_PRESET = {
  name: "vivid",
  title: "Vivid",
  description: "Boosted colors for colorful images and illustrations.",
  exposure: 1.1,
  saturation: 1.6,
  toneMode: "scurve",
  contrast: 1.0,
  strength: 0.7,
  shadowBoost: 0.1,
  highlightCompress: 1.3,
  midpoint: 0.5,
  colorMethod: "rgb",
  ditherAlgorithm: "floyd-steinberg",
  compressDynamicRange: false,
};

/**
 * Soft preset - Low contrast
 *
 * Best for: Images with lots of subtle gradients
 * Characteristics: Softer look, better gradient rendering
 *
 * @type {ProcessingParams}
 */
export const SOFT_PRESET = {
  name: "soft",
  title: "Soft",
  description: "Softer look with better gradient rendering.",
  exposure: 1.0,
  saturation: 1.1,
  toneMode: "contrast",
  contrast: 0.9,
  colorMethod: "rgb",
  ditherAlgorithm: "stucki",
  compressDynamicRange: true,
};

/**
 * Grayscale-optimized preset
 *
 * Best for: Black and white photos, documents
 * Characteristics: Uses LAB color space for better grayscale matching
 *
 * @type {ProcessingParams}
 */
export const GRAYSCALE_PRESET = {
  name: "grayscale",
  title: "Grayscale",
  description: "Optimized for black and white photos using LAB color space.",
  exposure: 1.0,
  saturation: 0.0,
  toneMode: "scurve",
  contrast: 1.0,
  strength: 0.8,
  shadowBoost: 0.1,
  highlightCompress: 1.4,
  midpoint: 0.5,
  colorMethod: "lab",
  ditherAlgorithm: "floyd-steinberg",
  compressDynamicRange: true,
};

// =============================================================================
// Preset Registry
// =============================================================================

/**
 * Registry of all available presets
 * @type {Object<string, ProcessingParams>}
 */
export const PRESETS = {
  cdr: CDR_PRESET,
  scurve: SCURVE_PRESET,
  vivid: VIVID_PRESET,
  soft: SOFT_PRESET,
  grayscale: GRAYSCALE_PRESET,
};

// =============================================================================
// Dithering Options
// =============================================================================

/**
 * Supported dithering algorithms
 * @type {Array<{value: string, title: string}>}
 */
export const DITHER_ALGORITHMS = [
  { value: "floyd-steinberg", title: "Floyd-Steinberg" },
  { value: "stucki", title: "Stucki" },
  { value: "burkes", title: "Burkes" },
  { value: "sierra", title: "Sierra" },
];

// =============================================================================
// Accessor Functions
// =============================================================================

/**
 * Get a preset by name
 *
 * @param {string} name - Name of the preset (e.g., "cdr", "scurve")
 * @returns {ProcessingParams|null} Cloned preset object or null if not found
 * @example
 * const preset = getPreset("cdr");
 * // { exposure: 1.0, saturation: 1.0, ... }
 */
export function getPreset(name) {
  const preset = PRESETS[name];
  return preset ? { ...preset } : null;
}

/**
 * Get all available preset names (including aliases)
 *
 * @returns {string[]} Array of preset names
 * @example
 * getPresetNames(); // ["cdr", "scurve", "vivid", "soft", "grayscale", "default", "enhanced"]
 */
export function getPresetNames() {
  return Object.keys(PRESETS);
}

/**
 * Get preset options for UI dropdowns
 *
 * Returns an array of objects suitable for use in select/dropdown components.
 * Each option includes value, title, and description. Excludes aliases.
 *
 * @returns {Array<{value: string, title: string, description: string}>} Array of preset options
 * @example
 * const options = getPresetOptions();
 * // [{ value: "cdr", title: "Compressed Dynamic Range", description: "..." }, ...]
 */
export function getPresetOptions() {
  // Return only primary presets (exclude aliases like "default", "enhanced")
  const primaryPresets = [
    CDR_PRESET,
    SCURVE_PRESET,
    VIVID_PRESET,
    SOFT_PRESET,
    GRAYSCALE_PRESET,
  ];
  return primaryPresets.map((p) => ({
    value: p.name,
    title: p.title,
    description: p.description,
  }));
}

/**
 * Get supported dithering algorithm options for UI dropdowns
 *
 * @returns {Array<{value: string, title: string}>} Array of dither options
 * @example
 * const options = getDitherOptions();
 * // [{ value: "floyd-steinberg", title: "Floyd-Steinberg" }, ...]
 */
export function getDitherOptions() {
  return DITHER_ALGORITHMS.map((opt) => ({ ...opt }));
}

/**
 * Get default processing parameters
 *
 * Returns a complete set of processing parameters with sensible defaults.
 * This is equivalent to the CDR preset.
 *
 * @returns {ProcessingParams} Default parameters object
 * @example
 * const params = getDefaultParams();
 * // { exposure: 1.0, saturation: 1.0, toneMode: "contrast", ... }
 */
export function getDefaultParams() {
  return {
    exposure: 1.0,
    saturation: 1.0,
    toneMode: "contrast",
    contrast: 1.0,
    strength: 0.9,
    shadowBoost: 0.0,
    highlightCompress: 1.5,
    midpoint: 0.5,
    colorMethod: "rgb",
    ditherAlgorithm: "floyd-steinberg",
    compressDynamicRange: true,
  };
}

/**
 * Merge user parameters with defaults
 *
 * Combines user-provided parameters with default values, ensuring all
 * required parameters are present.
 *
 * @param {Partial<ProcessingParams>} [userParams={}] - User-provided parameters
 * @returns {ProcessingParams} Complete merged parameters object
 * @example
 * const params = mergeParams({ exposure: 1.2, saturation: 1.5 });
 * // { exposure: 1.2, saturation: 1.5, toneMode: "contrast", ... }
 */
export function mergeParams(userParams = {}) {
  return { ...getDefaultParams(), ...userParams };
}

// =============================================================================
// Type Definitions (JSDoc)
// =============================================================================

/**
 * @typedef {Object} ProcessingParams
 * @property {number} exposure - Exposure adjustment (0.5-2.0, default: 1.0)
 * @property {number} saturation - Saturation adjustment (0.0-2.0, default: 1.0)
 * @property {"contrast"|"scurve"} toneMode - Tone mapping mode
 * @property {number} contrast - Contrast adjustment for contrast mode (0.5-2.0)
 * @property {number} [strength] - S-curve strength (0.0-1.0, scurve mode only)
 * @property {number} [shadowBoost] - Shadow boost (0.0-1.0, scurve mode only)
 * @property {number} [highlightCompress] - Highlight compression (0.5-5.0, scurve mode only)
 * @property {number} [midpoint] - S-curve midpoint (0.3-0.7, scurve mode only)
 * @property {"rgb"|"lab"} colorMethod - Color matching method
 * @property {string} ditherAlgorithm - Dithering algorithm name
 * @property {boolean} compressDynamicRange - Whether to compress dynamic range
 */

// Default export
export default PRESETS;
