import {
  PRESETS,
  BALANCED_PRESET,
  DYNAMIC_PRESET,
  VIVID_PRESET,
  SOFT_PRESET,
  GRAYSCALE_PRESET,
  getPreset,
  getPresetNames,
  getDefaultParams,
  mergeParams,
} from "../src/presets.js";

describe("presets", () => {
  describe("PRESETS", () => {
    it("should contain all expected presets", () => {
      expect(PRESETS).toHaveProperty("balanced");
      expect(PRESETS).toHaveProperty("dynamic");
      expect(PRESETS).toHaveProperty("vivid");
      expect(PRESETS).toHaveProperty("soft");
      expect(PRESETS).toHaveProperty("grayscale");
    });

    it("should not contain stock preset", () => {
      expect(PRESETS).not.toHaveProperty("stock");
      expect(PRESETS).not.toHaveProperty("waveshare");
    });
  });

  describe("preset objects", () => {
    const presets = [
      BALANCED_PRESET,
      DYNAMIC_PRESET,
      VIVID_PRESET,
      SOFT_PRESET,
      GRAYSCALE_PRESET,
    ];

    it.each(presets)("should have required properties", (preset) => {
      expect(preset).toHaveProperty("exposure");
      expect(preset).toHaveProperty("saturation");
      expect(preset).toHaveProperty("toneMode");
      expect(preset).toHaveProperty("colorMethod");
      expect(preset).toHaveProperty("ditherAlgorithm");
    });
  });

  describe("getPreset", () => {
    it("should return cloned preset", () => {
      const preset = getPreset("balanced");
      expect(preset).toEqual(BALANCED_PRESET);
      expect(preset).not.toBe(BALANCED_PRESET); // Should be a clone
    });

    it("should return null for unknown preset", () => {
      expect(getPreset("unknown")).toBeNull();
    });
  });

  describe("getPresetNames", () => {
    it("should return array of preset names", () => {
      const names = getPresetNames();
      expect(Array.isArray(names)).toBe(true);
      expect(names).toContain("balanced");
      expect(names).toContain("dynamic");
      expect(names).toContain("vivid");
    });
  });

  describe("getDefaultParams", () => {
    it("should return default parameters", () => {
      const params = getDefaultParams();
      expect(params).toHaveProperty("exposure", 1.0);
      expect(params).toHaveProperty("saturation", 1.0);
      expect(params).toHaveProperty("toneMode", "contrast");
      expect(params).toHaveProperty("ditherAlgorithm", "floyd-steinberg");
    });
  });

  describe("mergeParams", () => {
    it("should merge user params with defaults", () => {
      const merged = mergeParams({ exposure: 1.5 });
      expect(merged.exposure).toBe(1.5);
      expect(merged.saturation).toBe(1.0); // From defaults
    });

    it("should return defaults when no params provided", () => {
      const merged = mergeParams();
      expect(merged).toEqual(getDefaultParams());
    });
  });
});
