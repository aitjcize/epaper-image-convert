# epaper-image-convert

Convert images for e-paper displays with advanced tone mapping, dithering, and color palette optimization.

## Features

- **Advanced Tone Mapping** - S-curve and contrast-based tone mapping for optimal e-paper display
- **Error Diffusion Dithering** - Floyd-Steinberg, Stucki, Burkes, and Sierra algorithms
- **Dynamic Range Compression** - Automatically compress images to match display's actual luminance range
- **Color Palette Support** - Built-in presets and custom palette support with theoretical/perceived pairs
- **EXIF Orientation** - Automatic EXIF orientation handling
- **CLI and Library** - Use from command line or as a Node.js library

## Installation

```bash
npm install epaper-image-convert
```

Or install globally for CLI use:

```bash
npm install -g epaper-image-convert
```

## CLI Usage

### Basic Usage

```bash
# Convert a single image
epaper-image-convert input.jpg output.png

# Convert with specific display dimensions
epaper-image-convert input.jpg -d 640x384

# Convert all images in a directory
epaper-image-convert ./photos ./converted
```

### Processing Presets

```bash
# List all available presets
epaper-image-convert -l

# Use Balanced preset - default, produces the most balanced result
epaper-image-convert input.jpg -p balanced

# Use Dynamic preset - enhanced contrast, vibrant colors
epaper-image-convert input.jpg -p dynamic

# Use Vivid preset - boosted colors for illustrations
epaper-image-convert input.jpg -p vivid

# Available presets: balanced, dynamic, vivid, soft, grayscale
```

### Custom Processing Parameters

```bash
# Adjust exposure and saturation
epaper-image-convert input.jpg --exposure 1.2 --saturation 1.4

# Use S-curve tone mapping with custom parameters
epaper-image-convert input.jpg --tone-mode scurve \
  --scurve-strength 0.8 \
  --scurve-shadow 0.1 \
  --scurve-highlight 1.5

# Use LAB color space for better grayscale matching
epaper-image-convert input.jpg --color-method lab

# Change dithering algorithm
epaper-image-convert input.jpg --dither-algorithm stucki
```

### Palette Options

```bash
# Use built-in palette preset
epaper-image-convert input.jpg --palette-preset spectra6

# Use custom palette (JSON format)
epaper-image-convert input.jpg --palette '{
  "theoretical": {
    "black": {"r": 0, "g": 0, "b": 0},
    "white": {"r": 255, "g": 255, "b": 255},
    "yellow": {"r": 255, "g": 255, "b": 0},
    "red": {"r": 255, "g": 0, "b": 0},
    "blue": {"r": 0, "g": 0, "b": 255},
    "green": {"r": 0, "g": 255, "b": 0}
  },
  "perceived": {
    "black": {"r": 5, "g": 5, "b": 5},
    "white": {"r": 200, "g": 200, "b": 195},
    "yellow": {"r": 210, "g": 200, "b": 10},
    "red": {"r": 180, "g": 35, "b": 25},
    "blue": {"r": 20, "g": 70, "b": 160},
    "green": {"r": 45, "g": 120, "b": 70}
  }
}'
```

### Generate Thumbnails

```bash
# Generate thumbnail alongside output
epaper-image-convert input.jpg output.png -t output_thumb.jpg

# Custom thumbnail dimensions
epaper-image-convert input.jpg output.png -t thumb.jpg --thumbnail-dimension 200x120
```

### Output Format

```bash
# Output as PNG (default)
epaper-image-convert input.jpg output.png

# Output as BMP
epaper-image-convert input.jpg output.bmp -f bmp

# Format is auto-detected when output is a directory
epaper-image-convert input.jpg /tmp -f bmp  # Creates /tmp/input.bmp
```

### All Options

```
Options:
  -d, --dimension <WxH>           Display dimension (default: 800x480)
  -f, --format <format>           Output format: png or bmp (default: png)
  --palette-preset <name>         Palette preset (default: spectra6)
  --palette <json>                Custom palette JSON
  -l, --list-presets              List available presets and exit
  -p, --processing-preset <name>  Processing preset (default: balanced)
  --exposure <value>              Exposure multiplier (0.5-2.0)
  --saturation <value>            Saturation multiplier (0.5-2.0)
  --contrast <value>              Contrast multiplier (0.5-2.0)
  --tone-mode <mode>              Tone mapping: scurve or contrast
  --scurve-strength <value>       S-curve strength (0.0-1.0)
  --scurve-shadow <value>         S-curve shadow boost (0.0-1.0)
  --scurve-highlight <value>      S-curve highlight compress (0.5-5.0)
  --scurve-midpoint <value>       S-curve midpoint (0.3-0.7)
  --color-method <method>         Color matching: rgb or lab
  --dither-algorithm <algorithm>  floyd-steinberg, stucki, burkes, sierra
  --compress-dynamic-range        Compress to display range (default for balanced)
  --skip-rotation                 Skip portrait-to-landscape rotation
  --skip-dithering                Skip dithering step
  --use-perceived-output          Use perceived palette for output
  -t, --thumbnail <path>          Generate thumbnail
  --thumbnail-dimension <WxH>     Thumbnail size (default: 400x240)
  -v, --verbose                   Enable verbose output
```

## Library Usage

### Basic Conversion

```javascript
import { convertImage } from 'epaper-image-convert';

const { canvas, buffer } = await convertImage('input.jpg', {
  width: 800,
  height: 480,
  processingPreset: 'balanced',
  verbose: true,
});

// buffer is a PNG Buffer ready to write or send to device
fs.writeFileSync('output.png', buffer);
```

### Advanced Usage

```javascript
import {
  processImage,
  applyExifOrientation,
  createPNG,
  getPreset,
  getPalette,
  SPECTRA6,
} from 'epaper-image-convert';
import { createCanvas, loadImage } from 'canvas';

// Load image
const image = await loadImage('input.jpg');
const sourceCanvas = createCanvas(image.width, image.height);
sourceCanvas.getContext('2d').drawImage(image, 0, 0);

// Process with custom options
const { canvas, originalCanvas } = processImage(sourceCanvas, {
  displayWidth: 800,
  displayHeight: 480,
  palette: SPECTRA6,
  params: {
    ...getPreset('dynamic'),
    exposure: 1.1,
    saturation: 1.4,
  },
  skipRotation: false,
  verbose: true,
  createCanvas,
});

// Convert to PNG
const pngBuffer = await createPNG(canvas);
```

### Custom Palette

```javascript
import { processImage, validatePalette } from 'epaper-image-convert';

const customPalette = {
  theoretical: {
    black: { r: 0, g: 0, b: 0 },
    white: { r: 255, g: 255, b: 255 },
    yellow: { r: 255, g: 255, b: 0 },
    red: { r: 255, g: 0, b: 0 },
    blue: { r: 0, g: 0, b: 255 },
    green: { r: 0, g: 255, b: 0 },
  },
  perceived: {
    black: { r: 10, g: 10, b: 10 },
    white: { r: 220, g: 215, b: 210 },
    yellow: { r: 200, g: 190, b: 20 },
    red: { r: 170, g: 40, b: 30 },
    blue: { r: 30, g: 80, b: 150 },
    green: { r: 50, g: 110, b: 65 },
  },
};

// Validate palette format
validatePalette(customPalette);

// Use in processing
const { canvas } = processImage(sourceCanvas, {
  displayWidth: 800,
  displayHeight: 480,
  palette: customPalette,
});
```

## Palette Format

Palettes come in pairs - `theoretical` and `perceived`:

- **theoretical**: The ideal RGB values that the e-paper display driver expects. These are the values written to the output image that the device firmware will interpret.
- **perceived**: The actual RGB colors as they appear on the physical display when measured or observed. E-paper displays have limited color gamut - "white" is often grayish, "red" appears more muted, etc.

### Why Two Palettes?

E-paper displays don't reproduce colors accurately. For example, when you send "pure red" (255, 0, 0) to a Spectra 6 display, the actual color that appears might be closer to (135, 19, 0) - a darker, less saturated red.

**The dithering algorithm uses the perceived palette** to make accurate color-matching decisions. When deciding which palette color best represents a pixel, we compare against what colors *actually look like* on the display, not what we tell the display to show.

**The output image uses the theoretical palette** because that's what the device firmware understands. The display driver maps these theoretical values to the appropriate ink colors.

This separation allows the dithering algorithm to produce visually accurate results while maintaining compatibility with the device's expected input format.

For a visual comparison showing the impact of using perceived palettes vs theoretical palettes, see the [Image Quality Comparison](https://github.com/aitjcize/esp32-photoframe?tab=readme-ov-file#image-quality-comparison) in the ESP32 PhotoFrame project.

```json
{
  "theoretical": {
    "black": { "r": 0, "g": 0, "b": 0 },
    "white": { "r": 255, "g": 255, "b": 255 },
    "yellow": { "r": 255, "g": 255, "b": 0 },
    "red": { "r": 255, "g": 0, "b": 0 },
    "blue": { "r": 0, "g": 0, "b": 255 },
    "green": { "r": 0, "g": 255, "b": 0 }
  },
  "perceived": {
    "black": { "r": 2, "g": 2, "b": 2 },
    "white": { "r": 190, "g": 190, "b": 190 },
    "yellow": { "r": 205, "g": 202, "b": 0 },
    "red": { "r": 135, "g": 19, "b": 0 },
    "blue": { "r": 5, "g": 64, "b": 158 },
    "green": { "r": 39, "g": 102, "b": 60 }
  }
}
```

## Processing Presets

| Preset | Description | Best For |
|--------|-------------|----------|
| `balanced` | Compressed dynamic range (default) | General use, prevents overexposure |
| `dynamic` | S-Curve tone mapping | Photos with good dynamic range |
| `vivid` | High saturation | Colorful images, illustrations |
| `soft` | Low contrast | Subtle gradients |
| `grayscale` | LAB color space | B&W photos, documents |

## License

MIT

## Credits

Developed for the [ESP32 PhotoFrame](https://github.com/aitjcize/esp32-photoframe) project.
