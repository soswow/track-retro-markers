# Track Retro Markers

TypeScript CLI for tracking bright retro-reflective markers in video footage. It detects near-white clipped pixels, rejects colored LEDs by requiring balanced RGB channels, groups pixels into connected components, tracks marker centroids frame-to-frame, and exports both CSV data and optional visualization video.

## Requirements

- Node.js 24. Use `nvm use` from this directory to pick up `.nvmrc`.
- npm

FFmpeg and FFprobe are installed through `ffmpeg-static` and `ffprobe-static`, so no system FFmpeg installation is required.

## Install

```sh
nvm use
npm install
```

## Usage

```sh
npm run track -- inputs/VID_20260523_215552.mp4 \
  --start 0 \
  --stop 10 \
  --threshold auto \
  --video overlay \
  --color white \
  --output outputs
```

Outputs are derived from the input base name and requested time range. For the example above:

- `outputs/VID_20260523_215552_0p000-10p000_markers.csv`
- `outputs/VID_20260523_215552_0p000-10p000_overlay.mp4`

The CSV timestamp starts at zero for the analysed clip and is calculated as `frame_index / fps`.
Use `--debug-one-frame` to render only the first analysed frame as a PNG, with no CSV or video output.

## Video Modes

- `points`: black background with filled marker circles.
- `trails`: black background with marker circles and fading trails.
- `overlay`: original footage with marker circles and fading trails.
- `pixels`: black background with white pixels wherever the source pixel passes the marker candidate checks.
- `copy`: original footage with no tracking visualization.
- `none`: write CSV only.

## Parameters

- `--start <time>`: start time, in seconds or `hh:mm:ss.sss`. Default: `0`.
- `--stop <time>`: stop time, in seconds or `hh:mm:ss.sss`. Default: end of video.
- `--video <mode>`: `points`, `trails`, `overlay`, `pixels`, `copy`, or `none`. Default: `overlay`.
- `--color <color>`: named color, `#rrggbb`, `#rgb`, or `r,g,b`. Used for marker circles and as the default for both trail colors. Default: `white`.
- `--color-start <color>`: newest trail color. Uses the same formats as `--color`. Default: `--color`.
- `--color-end <color>`: oldest trail color. Uses the same formats as `--color`. Default: `--color`.
- `--output <path>`: output directory or file prefix. Default: `outputs`.
- `--circle-radius <pixels>`: rendered marker radius. Default: `8`.
- `--trail-line-width <pixels>`: rendered trail line width. Default: `3`.
- `--trail-seconds <seconds>`: fade duration for trail modes. Default: `2`.
- `--threshold <value>`: `auto` or an integer from `0` to `255`. Default: `auto`.
- `--min-area <pixels>` and `--max-area <pixels>`: connected-component area filter. Defaults: `2` and `2500`.
- `--merge-distance <pixels>`: merge nearby clipped components before assigning marker centroids. Default: `35`.
- `--max-track-distance <pixels>`: maximum frame-to-frame marker assignment distance. Default: `140`.
- `--search-radius <pixels>`: automatic per-marker local search radius after the first frame. Default: `180`.
- `--local-threshold-min <value>`: lowest threshold allowed when searching around an existing track. Default: `180`.
- `--debug-one-frame`: render one PNG for the first analysed frame instead of writing CSV or video output.
- `--no-progress`: disable the in-terminal progress bar (enabled by default on interactive terminals).

## Development

```sh
npm run build
npm run lint
```

The project uses ESLint with the `curly` rule to require braces for all control statements.
