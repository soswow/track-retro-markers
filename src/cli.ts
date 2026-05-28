#!/usr/bin/env tsx
import { Command, InvalidArgumentError } from "commander";
import {
  buildTrackOptions,
  parseMarkerNameList,
  parsePositiveInteger,
  parsePositiveNumber,
  parseRegionOfInterest,
  parseThresholdInteger,
  parseThresholdOption,
  parseTimeOption,
  parseVideoMode,
  type TrackSettingsInput
} from "./track-options.js";
import { trackRetroMarkers } from "./tracker.js";

const wrapParser =
  <T>(parser: (value: string) => T) =>
  (value: string): T => {
    try {
      return parser(value);
    } catch (error) {
      throw new InvalidArgumentError(error instanceof Error ? error.message : "Invalid value.");
    }
  };

const program = new Command();

program
  .name("track-retro-markers")
  .description("Track near-white retro-reflective markers in video footage.")
  .argument("<input>", "input video file")
  .option("--start <time>", "start time as seconds or hh:mm:ss.sss", wrapParser(parseTimeOption), 0)
  .option("--stop <time>", "stop time as seconds or hh:mm:ss.sss", wrapParser(parseTimeOption))
  .option("--color <color>", "circle and trail color: name, #rrggbb, #rgb, or r,g,b", "white")
  .option("--color-start <color>", "newest trail color: name, #rrggbb, #rgb, or r,g,b")
  .option("--color-end <color>", "oldest trail color: name, #rrggbb, #rgb, or r,g,b")
  .option("--threshold <value>", "auto or an integer from 0 to 255", wrapParser(parseThresholdOption), "auto")
  .option("--video <mode>", "points, trails, overlay, pixels, copy, or none", wrapParser(parseVideoMode), "overlay")
  .option("--output <path>", "output directory or file prefix", "outputs")
  .option("--circle-radius <pixels>", "rendered marker circle radius", wrapParser(parsePositiveInteger), 8)
  .option("--trail-line-width <pixels>", "rendered trail line width", wrapParser(parsePositiveInteger), 3)
  .option("--trail-seconds <seconds>", "trail fade duration for trails and overlay modes", wrapParser(parsePositiveNumber), 2)
  .option("--trail-markers <names>", "comma-separated marker names to draw trails for", wrapParser(parseMarkerNameList))
  .option("--csv-export-markers <names>", "comma-separated marker names to include in CSV output", wrapParser(parseMarkerNameList))
  .option("--include-csv-diff-columns", "add diff_ x/y columns measured from each exported marker's first value")
  .option("--min-area <pixels>", "minimum connected component area", wrapParser(parsePositiveInteger), 2)
  .option("--max-area <pixels>", "maximum connected component area", wrapParser(parsePositiveInteger), 2500)
  .option(
    "--merge-distance <pixels>",
    "merge nearby clipped components before assigning marker centroids",
    wrapParser(parsePositiveNumber),
    35
  )
  .option(
    "--max-track-distance <pixels>",
    "maximum per-frame marker assignment distance",
    wrapParser(parsePositiveNumber),
    140
  )
  .option(
    "--search-radius <pixels>",
    "automatic per-marker local search radius after the first frame",
    wrapParser(parsePositiveNumber),
    180
  )
  .option(
    "--local-threshold-min <value>",
    "lowest threshold allowed when searching around an existing track",
    wrapParser(parseThresholdInteger),
    180
  )
  .option("--roi <left,top,right,bottom>", "region of interest containing all markers", wrapParser(parseRegionOfInterest))
  .option("--markers-layout <path>", "JSON marker layout used to fit and label known markers")
  .option("--use-layout-units", "scale CSV marker coordinates into marker layout units")
  .option("--track-local-y-axis-angle", "add the local Y-axis image angle to the CSV output")
  .option("--label-markers", "render marker names next to tracked markers")
  .option("--crop-to-roi", "crop the rendered output video to the region of interest")
  .option("--layout-fit-tolerance <pixels>", "maximum marker-layout fit error per marker", wrapParser(parsePositiveNumber), 60)
  .option("--debug-one-frame", "write one rendered PNG frame instead of CSV or video output")
  .option("--no-progress", "disable the in-terminal progress bar")
  .action(async (input: string, options: Record<string, unknown>) => {
    const settings: TrackSettingsInput = {
      inputPath: input,
      outputLocation: String(options.output),
      startSeconds: options.start as number,
      stopSeconds: options.stop as number | undefined,
      color: String(options.color),
      colorStart: options.colorStart === undefined ? undefined : String(options.colorStart),
      colorEnd: options.colorEnd === undefined ? undefined : String(options.colorEnd),
      threshold: options.threshold as string | number,
      videoMode: String(options.video),
      circleRadius: options.circleRadius as number,
      trailLineWidth: options.trailLineWidth as number,
      trailSeconds: options.trailSeconds as number,
      trailMarkers: options.trailMarkers as string[] | undefined,
      csvExportMarkers: options.csvExportMarkers as string[] | undefined,
      includeCsvDiffColumns: options.includeCsvDiffColumns === true,
      minArea: options.minArea as number,
      maxArea: options.maxArea as number,
      mergeDistance: options.mergeDistance as number,
      maxTrackDistance: options.maxTrackDistance as number,
      searchRadius: options.searchRadius as number,
      localThresholdMin: options.localThresholdMin as number,
      markersLayoutPath: options.markersLayout === undefined ? undefined : String(options.markersLayout),
      useLayoutUnits: options.useLayoutUnits === true,
      trackLocalYAxisAngle: options.trackLocalYAxisAngle === true,
      labelMarkers: options.labelMarkers === true,
      cropToRoi: options.cropToRoi === true,
      layoutFitTolerance: options.layoutFitTolerance as number,
      roi: options.roi as TrackSettingsInput["roi"],
      debugOneFrame: options.debugOneFrame === true,
      showProgress: options.progress !== false
    };

    const trackOptions = buildTrackOptions(settings);
    const result = await trackRetroMarkers(trackOptions);

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
