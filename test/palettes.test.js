import {
  SPECTRA6,
  PALETTE_PRESETS,
  getPalette,
  getPaletteNames,
  parsePalette,
  validatePalette,
} from "../src/palettes.js";

describe("palettes", () => {
  describe("SPECTRA6", () => {
    it("should have theoretical and perceived palettes", () => {
      expect(SPECTRA6).toHaveProperty("theoretical");
      expect(SPECTRA6).toHaveProperty("perceived");
    });

    it("should have all required colors in theoretical palette", () => {
      const colors = ["black", "white", "yellow", "red", "blue", "green"];
      for (const color of colors) {
        expect(SPECTRA6.theoretical).toHaveProperty(color);
        expect(SPECTRA6.theoretical[color]).toHaveProperty("r");
        expect(SPECTRA6.theoretical[color]).toHaveProperty("g");
        expect(SPECTRA6.theoretical[color]).toHaveProperty("b");
      }
    });

    it("should have all required colors in perceived palette", () => {
      const colors = ["black", "white", "yellow", "red", "blue", "green"];
      for (const color of colors) {
        expect(SPECTRA6.perceived).toHaveProperty(color);
        expect(SPECTRA6.perceived[color]).toHaveProperty("r");
        expect(SPECTRA6.perceived[color]).toHaveProperty("g");
        expect(SPECTRA6.perceived[color]).toHaveProperty("b");
      }
    });

    it("should have valid RGB values (0-255)", () => {
      const checkRgb = (palette) => {
        for (const color of Object.values(palette)) {
          expect(color.r).toBeGreaterThanOrEqual(0);
          expect(color.r).toBeLessThanOrEqual(255);
          expect(color.g).toBeGreaterThanOrEqual(0);
          expect(color.g).toBeLessThanOrEqual(255);
          expect(color.b).toBeGreaterThanOrEqual(0);
          expect(color.b).toBeLessThanOrEqual(255);
        }
      };
      checkRgb(SPECTRA6.theoretical);
      checkRgb(SPECTRA6.perceived);
    });
  });

  describe("getPalette", () => {
    it("should return spectra6 palette", () => {
      const palette = getPalette("spectra6");
      expect(palette).toEqual(SPECTRA6);
    });

    it("should return default palette (spectra6)", () => {
      const palette = getPalette("default");
      expect(palette).toEqual(SPECTRA6);
    });

    it("should return null for unknown preset", () => {
      const palette = getPalette("unknown");
      expect(palette).toBeNull();
    });
  });

  describe("getPaletteNames", () => {
    it("should return array of palette names", () => {
      const names = getPaletteNames();
      expect(Array.isArray(names)).toBe(true);
      expect(names).toContain("spectra6");
      expect(names).toContain("default");
    });
  });

  describe("validatePalette", () => {
    it("should validate correct paired palette", () => {
      expect(() => validatePalette(SPECTRA6)).not.toThrow();
    });

    it("should throw for missing theoretical", () => {
      expect(() => validatePalette({ perceived: SPECTRA6.perceived })).toThrow(
        /theoretical/,
      );
    });

    it("should throw for missing perceived", () => {
      expect(() =>
        validatePalette({ theoretical: SPECTRA6.theoretical }),
      ).toThrow(/perceived/);
    });

    it("should throw for missing color in palette", () => {
      const incomplete = {
        theoretical: { black: { r: 0, g: 0, b: 0 } },
        perceived: SPECTRA6.perceived,
      };
      expect(() => validatePalette(incomplete)).toThrow();
    });

    it("should throw for invalid RGB values", () => {
      const invalid = {
        theoretical: {
          ...SPECTRA6.theoretical,
          black: { r: 300, g: 0, b: 0 },
        },
        perceived: SPECTRA6.perceived,
      };
      expect(() => validatePalette(invalid)).toThrow(/0-255/);
    });
  });

  describe("parsePalette", () => {
    it("should parse valid JSON palette", () => {
      const json = JSON.stringify(SPECTRA6);
      const palette = parsePalette(json);
      expect(palette).toEqual(SPECTRA6);
    });

    it("should throw for invalid JSON", () => {
      expect(() => parsePalette("not json")).toThrow();
    });

    it("should throw for invalid palette structure", () => {
      expect(() => parsePalette('{"foo": "bar"}')).toThrow();
    });
  });
});
