import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { createCanvas, loadImage } from "canvas";
import {
  parseDeviceConfig,
  paletteFromDeviceConfig,
  paramsFromDeviceConfig,
  isGrayCalibration,
} from "../src/device-config.js";
import {
  SPECTRA6,
  GRAYSCALE16,
  makeGrayscale16,
  isGrayscalePalette,
} from "../src/palettes.js";
import { getDefaultParams } from "../src/presets.js";
import * as index from "../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, "..", "src", "cli.js");
const FIXTURES = path.join(__dirname, "fixtures");
const NEW_STYLE = path.join(FIXTURES, "device-config.json");
const OLD_STYLE = path.join(FIXTURES, "device-config-old.json");
const GRAYSCALE = path.join(FIXTURES, "device-config-grayscale.json");

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

describe("device-config", () => {
  describe("parseDeviceConfig", () => {
    it("reads a new-style export (with system_info)", () => {
      const raw = readJson(NEW_STYLE);
      const cfg = parseDeviceConfig(raw);
      expect(cfg.processing).toEqual(raw.processing);
      expect(cfg.palette).toEqual(raw.palette);
      expect(cfg.orientation).toBe("portrait");
      expect(cfg.width).toBe(1600);
      expect(cfg.height).toBe(1200);
      expect(cfg.version).toBe("2.9.0");
      expect(cfg.boardName).toBe("seeedstudio_reterminal_e1004");
      expect(cfg.grayscale).toBe(false);
    });

    it("accepts the JSON text as well as the parsed object", () => {
      expect(parseDeviceConfig(fs.readFileSync(NEW_STYLE, "utf8"))).toEqual(
        parseDeviceConfig(readJson(NEW_STYLE)),
      );
      expect(() => parseDeviceConfig("{ nope")).toThrow("not valid JSON");
    });

    it("reads an old-style export (no system_info)", () => {
      const cfg = parseDeviceConfig(readJson(OLD_STYLE));
      expect(cfg.width).toBeNull();
      expect(cfg.height).toBeNull();
      expect(cfg.version).toBe("");
      expect(cfg.boardName).toBeNull();
      expect(cfg.orientation).toBe("landscape");
      expect(cfg.grayscale).toBe(false);
    });

    it("marks a gc16 panel grayscale, by display_type or by palette shape", () => {
      const raw = readJson(GRAYSCALE);
      expect(parseDeviceConfig(raw).grayscale).toBe(true);
      expect(isGrayCalibration(raw.palette)).toBe(true);
      delete raw.system_info;
      expect(parseDeviceConfig(raw).grayscale).toBe(true);
    });

    it("treats every block as optional and ignores unknown keys", () => {
      const cfg = parseDeviceConfig({
        processing: readJson(OLD_STYLE).processing,
        future_block: { x: 1 },
      });
      expect(cfg.palette).toBeNull();
      expect(cfg.orientation).toBeNull();
      expect(cfg.grayscale).toBe(false);
    });

    it.each([
      [null, "expected a JSON object"],
      [{ unrelated: 1 }, "not a device config export"],
      [{ processing: 1 }, '"processing" must be an object'],
      [
        { palette: { black: { r: 0, g: 0, b: 0 } } },
        '"palette.white" must be an object',
      ],
      [
        { palette: { black_y: "0", white_y: 0.6 } },
        '"palette.black_y" and "palette.white_y" must be numbers',
      ],
      [
        { palette: { black_y: 0, white_y: 0.6, gamma: null } },
        '"palette.gamma" must be a number',
      ],
      [
        { config: { display_orientation: "sideways" } },
        '"config.display_orientation" must be',
      ],
      [{ config: {}, system_info: [] }, '"system_info" must be an object'],
      [
        { config: {}, system_info: { width: 800 } },
        "must be positive integers",
      ],
      [
        { config: {}, system_info: { width: -800, height: 480 } },
        "must be positive integers",
      ],
      [
        {
          config: {},
          system_info: { width: 800, height: 480, display_type: 1 },
        },
        '"system_info.display_type" must be a string',
      ],
    ])("rejects %j", (data, message) => {
      expect(() => parseDeviceConfig(data)).toThrow(message);
    });
  });

  describe("paletteFromDeviceConfig", () => {
    it("pairs SPECTRA6 theoretical with the device's perceived colours", () => {
      const raw = readJson(NEW_STYLE);
      const palette = paletteFromDeviceConfig(parseDeviceConfig(raw));
      expect(palette).toEqual({
        theoretical: SPECTRA6.theoretical,
        perceived: raw.palette,
      });
      expect(isGrayscalePalette(palette)).toBe(false);
    });

    it("derives the GC16 ramp from the device's luminance endpoints", () => {
      const palette = paletteFromDeviceConfig(
        parseDeviceConfig(readJson(GRAYSCALE)),
      );
      expect(palette).toEqual(
        makeGrayscale16({ blackY: 0.012, whiteY: 0.62, gamma: 1.4 }),
      );
      expect(isGrayscalePalette(palette)).toBe(true);
    });

    it("lets explicit endpoints override the file's, one at a time", () => {
      const cfg = parseDeviceConfig(readJson(GRAYSCALE));
      expect(paletteFromDeviceConfig(cfg, { gamma: 1 })).toEqual(
        makeGrayscale16({ blackY: 0.012, whiteY: 0.62, gamma: 1 }),
      );
      expect(paletteFromDeviceConfig(cfg, { blackY: 0.02 })).toEqual(
        makeGrayscale16({ blackY: 0.02, whiteY: 0.62, gamma: 1.4 }),
      );
    });

    it("falls back to the defaults when the export has no palette", () => {
      expect(
        paletteFromDeviceConfig(parseDeviceConfig({ processing: {} })),
      ).toBe(SPECTRA6);
      expect(
        paletteFromDeviceConfig(
          parseDeviceConfig({
            processing: {},
            system_info: { width: 1872, height: 1404, display_type: "gc16" },
          }),
        ),
      ).toBe(GRAYSCALE16);
    });

    it("rejects out-of-range colours through validatePalette", () => {
      const raw = readJson(NEW_STYLE);
      raw.palette.red.r = 300;
      expect(() => paletteFromDeviceConfig(parseDeviceConfig(raw))).toThrow(
        "RGB values must be 0-255",
      );
    });
  });

  describe("paramsFromDeviceConfig", () => {
    it("returns the processing params the export carries, nothing else", () => {
      const raw = readJson(NEW_STYLE);
      const params = paramsFromDeviceConfig(parseDeviceConfig(raw));
      expect(params).toEqual({
        exposure: 1.1,
        saturation: 1.4,
        toneMode: "scurve",
        contrast: 1,
        strength: 0.8,
        shadowBoost: 0.1,
        highlightCompress: 1.6,
        midpoint: 0.45,
        colorMethod: "lab",
        ditherAlgorithm: "stucki",
        compressDynamicRange: false,
      });
      expect(params).not.toHaveProperty("scaleMode");
      expect(params).not.toHaveProperty("backgroundColor");
      // Every key is one processImage() understands
      for (const key of Object.keys(params)) {
        expect(getDefaultParams()).toHaveProperty(key);
      }
    });

    it("is empty without a processing block", () => {
      expect(paramsFromDeviceConfig(parseDeviceConfig({ config: {} }))).toEqual(
        {},
      );
    });
  });

  it("is exported from the package entry point", () => {
    expect(index.parseDeviceConfig).toBe(parseDeviceConfig);
    expect(index.paletteFromDeviceConfig).toBe(paletteFromDeviceConfig);
    expect(index.paramsFromDeviceConfig).toBe(paramsFromDeviceConfig);
    expect(index.isGrayCalibration).toBe(isGrayCalibration);
  });
});

describe("epaper-image-convert --device-config", () => {
  let tmpDir;
  let inputPng;

  const run = (args) =>
    spawnSync(process.execPath, [CLI, ...args], {
      cwd: tmpDir,
      encoding: "utf8",
    });

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "epaper-devcfg-"));
    const canvas = createCanvas(320, 200);
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 320, 200);
    gradient.addColorStop(0, "#ff4000");
    gradient.addColorStop(0.5, "#40ff80");
    gradient.addColorStop(1, "#0040ff");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 320, 200);
    inputPng = path.join(tmpDir, "input.png");
    fs.writeFileSync(inputPng, canvas.toBuffer("image/png"));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("sizes the output from the file's system_info", async () => {
    const out = path.join(tmpDir, "new.png");
    const r = run([
      inputPng,
      out,
      "--device-config",
      NEW_STYLE,
      "-f",
      "png",
      "-v",
    ]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Using processing settings from device config");
    expect(r.stdout).toContain("1600x1200");
    const img = await loadImage(out);
    expect(img.width).toBe(1600);
    expect(img.height).toBe(1200);
  }, 60000);

  it("lets an explicit -d win over the file", async () => {
    const out = path.join(tmpDir, "small.png");
    const r = run([
      inputPng,
      out,
      "--device-config",
      NEW_STYLE,
      "-d",
      "400x240",
      "-f",
      "png",
    ]);
    expect(r.status).toBe(0);
    const img = await loadImage(out);
    expect(img.width).toBe(400);
    expect(img.height).toBe(240);
  });

  it("lets an explicit -p win over the file's processing settings", () => {
    const out = path.join(tmpDir, "preset.png");
    const r = run([
      inputPng,
      out,
      "--device-config",
      NEW_STYLE,
      "-d",
      "200x120",
      "-p",
      "vivid",
      "-f",
      "png",
      "-v",
    ]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Using preset: vivid");
    expect(r.stdout).not.toContain("from device config");
  });

  it("lets an explicit --palette-preset win over the file's palette", async () => {
    // Perceived output of grayscale16 is neutral gray; the colour export's
    // Spectra 6 palette would leave the gradient coloured.
    const out = path.join(tmpDir, "preset-palette.png");
    const r = run([
      inputPng,
      out,
      "--device-config",
      NEW_STYLE,
      "--palette-preset",
      "grayscale16",
      "--use-perceived-output",
      "-d",
      "200x120",
      "-f",
      "png",
    ]);
    expect(r.status).toBe(0);
    const img = await loadImage(out);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, img.width, img.height);
    let coloured = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] !== data[i + 1] || data[i + 1] !== data[i + 2]) coloured++;
    }
    expect(coloured).toBe(0);
  });

  it("refuses an old-style export without -d", () => {
    const r = run([
      inputPng,
      path.join(tmpDir, "old.png"),
      "--device-config",
      OLD_STYLE,
    ]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("has no system_info");
    expect(r.stderr).toContain("-d WxH");
  });

  it("converts an old-style export with -d", () => {
    const out = path.join(tmpDir, "old.png");
    const r = run([
      inputPng,
      out,
      "--device-config",
      OLD_STYLE,
      "-d",
      "200x120",
      "-f",
      "png",
    ]);
    expect(r.status).toBe(0);
    expect(fs.existsSync(out)).toBe(true);
  });

  it("packs grayscale epdgz for a GC16 export", () => {
    const out = path.join(tmpDir, "gray.epdgz");
    const r = run([
      inputPng,
      out,
      "--device-config",
      GRAYSCALE,
      "-d",
      "200x120",
      "-v",
    ]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("grayscale");
    expect(fs.existsSync(out)).toBe(true);
  });

  it("reports an unreadable or invalid file", () => {
    const missing = run([
      inputPng,
      "--device-config",
      path.join(tmpDir, "x.json"),
    ]);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("Cannot read device config");

    const bad = path.join(tmpDir, "bad.json");
    fs.writeFileSync(bad, JSON.stringify({ hello: "world" }));
    const invalid = run([inputPng, "--device-config", bad]);
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain("Invalid device config");
    expect(invalid.stderr).toContain("not a device config export");
  });
});
