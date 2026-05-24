#!/usr/bin/env tsx
import { Command, InvalidArgumentError } from "commander";
import {
  parseColor,
  parseTimeSeconds,
  trackRetroMarkers,
  type ThresholdOption,
  type VideoMode
} from "./tracker.js";

const parsePositiveInteger = (value: string): number => {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new InvalidArgumentError("Expected a positive integer.");
  }

  return parsedValue;
};

const parsePositiveNumber = (value: string): number => {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new InvalidArgumentError("Expected a positive number.");
  }

  return parsedValue;
};

const parseTimeOption = (value: string): number => {
  try {
    return parseTimeSeconds(value);
  } catch (error) {
    throw new InvalidArgumentError(error instanceof Error ? error.message : "Invalid time value.");
  }
};

const parseThresholdOption = (value: string): ThresholdOption => {
  if (value.toLowerCase() === "auto") {
    return "auto";
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0 || parsedValue > 255) {
    throw new InvalidArgumentError("Expected auto or an integer from 0 to 255.");
  }

  return parsedValue;
};

const parseThresholdInteger = (value: string): number => {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0 || parsedValue > 255) {
    throw new InvalidArgumentError("Expected an integer from 0 to 255.");
  }

  return parsedValue;
};

const parseVideoMode = (value: string): VideoMode => {
  const allowedValues: VideoMode[] = ["points", "trails", "overlay", "pixels", "copy", "none"];

  if (!allowedValues.includes(value as VideoMode)) {
    throw new InvalidArgumentError(`Expected one of: ${allowedValues.join(", ")}.`);
  }

  return value as VideoMode;
};

const program = new Command();

program
  .name("track-retro-markers")
  .description("Track near-white retro-reflective markers in video footage.")
  .argument("<input>", "input video file")
  .option("--start <time>", "start time as seconds or hh:mm:ss.sss", parseTimeOption, 0)
  .option("--stop <time>", "stop time as seconds or hh:mm:ss.sss", parseTimeOption)
  .option("--color <color>", "circle and trail color: name, #rrggbb, #rgb, or r,g,b", "white")
  .option("--color-start <color>", "newest trail color: name, #rrggbb, #rgb, or r,g,b")
  .option("--color-end <color>", "oldest trail color: name, #rrggbb, #rgb, or r,g,b")
  .option("--threshold <value>", "auto or an integer from 0 to 255", parseThresholdOption, "auto")
  .option("--video <mode>", "points, trails, overlay, pixels, copy, or none", parseVideoMode, "overlay")
  .option("--output <path>", "output directory or file prefix", "outputs")
  .option("--circle-radius <pixels>", "rendered marker circle radius", parsePositiveInteger, 8)
  .option("--trail-line-width <pixels>", "rendered trail line width", parsePositiveInteger, 3)
  .option("--trail-seconds <seconds>", "trail fade duration for trails and overlay modes", parsePositiveNumber, 2)
  .option("--min-area <pixels>", "minimum connected component area", parsePositiveInteger, 2)
  .option("--max-area <pixels>", "maximum connected component area", parsePositiveInteger, 2500)
  .option("--merge-distance <pixels>", "merge nearby clipped components before assigning marker centroids", parsePositiveNumber, 35)
  .option("--max-track-distance <pixels>", "maximum per-frame marker assignment distance", parsePositiveNumber, 140)
  .option("--search-radius <pixels>", "automatic per-marker local search radius after the first frame", parsePositiveNumber, 180)
  .option("--local-threshold-min <value>", "lowest threshold allowed when searching around an existing track", parseThresholdInteger, 180)
  .option("--debug-one-frame", "write one rendered PNG frame instead of CSV or video output")
  .option("--no-progress", "disable the in-terminal progress bar")
  .action(async (input: string, options: Record<string, unknown>) => {
    const color = parseColor(String(options.color));
    const trailColorStart = options.colorStart === undefined ? color : parseColor(String(options.colorStart));
    const trailColorEnd = options.colorEnd === undefined ? color : parseColor(String(options.colorEnd));

    const result = await trackRetroMarkers({
      inputPath: input,
      outputLocation: String(options.output),
      startSeconds: options.start as number,
      stopSeconds: options.stop as number | undefined,
      color,
      videoMode: options.video as VideoMode,
      threshold: options.threshold as ThresholdOption,
      circleRadius: options.circleRadius as number,
      trailLineWidth: options.trailLineWidth as number,
      trailSeconds: options.trailSeconds as number,
      trailColorStart,
      trailColorEnd,
      minArea: options.minArea as number,
      maxArea: options.maxArea as number,
      mergeDistance: options.mergeDistance as number,
      maxTrackDistance: options.maxTrackDistance as number,
      searchRadius: options.searchRadius as number,
      localThresholdMin: options.localThresholdMin as number,
      debugOneFrame: options.debugOneFrame === true,
      showProgress: options.progress !== false
    });

    if (result.csvPath !== undefined) {
      console.log(`CSV: ${result.csvPath}`);
    }

    if (result.videoPath !== undefined) {
      console.log(`Video: ${result.videoPath}`);
    }

    if (result.debugFramePath !== undefined) {
      console.log(`Debug frame: ${result.debugFramePath}`);
    }

    console.log(`Threshold: ${result.threshold}`);
    console.log(`Frames processed: ${result.framesProcessed}`);
    console.log(`FPS: ${result.fps.toFixed(6)}`);
  });

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
