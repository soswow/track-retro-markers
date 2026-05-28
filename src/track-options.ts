import {
  parseColor,
  parseTimeSeconds,
  type RgbColor,
  type ThresholdOption,
  type TrackOptions,
  type VideoMode
} from "./tracker.js";

export type RegionOfInterest = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export const VIDEO_MODES: VideoMode[] = ["points", "trails", "overlay", "pixels", "copy", "none"];

export const DEFAULT_TRACK_SETTINGS = {
  startSeconds: 0,
  color: "white",
  threshold: "auto" as ThresholdOption,
  videoMode: "overlay" as VideoMode,
  outputLocation: "outputs",
  circleRadius: 8,
  trailLineWidth: 3,
  trailSeconds: 2,
  minArea: 2,
  maxArea: 2500,
  mergeDistance: 35,
  maxTrackDistance: 140,
  searchRadius: 180,
  localThresholdMin: 180,
  layoutFitTolerance: 60,
  labelMarkers: false,
  cropToRoi: false,
  debugOneFrame: false,
  trackLocalYAxisAngle: false,
  includeCsvDiffColumns: false,
  showProgress: true
};

export const parsePositiveInteger = (value: string | number): number => {
  const parsedValue = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error("Expected a positive integer.");
  }

  return parsedValue;
};

export const parsePositiveNumber = (value: string | number): number => {
  const parsedValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error("Expected a positive number.");
  }

  return parsedValue;
};

export const parseTimeOption = (value: string | number): number => {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("Expected a non-negative time value.");
    }

    return value;
  }

  return parseTimeSeconds(value);
};

export const parseThresholdOption = (value: string | number): ThresholdOption => {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new Error("Expected auto or an integer from 0 to 255.");
    }

    return value;
  }

  if (value.toLowerCase() === "auto") {
    return "auto";
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0 || parsedValue > 255) {
    throw new Error("Expected auto or an integer from 0 to 255.");
  }

  return parsedValue;
};

export const parseThresholdInteger = (value: string | number): number => {
  const parsedValue = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0 || parsedValue > 255) {
    throw new Error("Expected an integer from 0 to 255.");
  }

  return parsedValue;
};

export const parseVideoMode = (value: string): VideoMode => {
  if (!VIDEO_MODES.includes(value as VideoMode)) {
    throw new Error(`Expected one of: ${VIDEO_MODES.join(", ")}.`);
  }

  return value as VideoMode;
};

export const parseMarkerNameList = (value: string | string[]): string[] => {
  const markerNames = (Array.isArray(value) ? value : value.split(","))
    .map((markerName) => markerName.trim())
    .filter((markerName) => markerName.length > 0);

  if (markerNames.length === 0) {
    throw new Error("Expected at least one marker name.");
  }

  return markerNames;
};

const parseOptionalMarkerNameList = (value: string | string[] | undefined): string[] | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const markerNames = (Array.isArray(value) ? value : value.split(","))
    .map((markerName) => markerName.trim())
    .filter((markerName) => markerName.length > 0);

  return markerNames.length === 0 ? undefined : markerNames;
};

export const parseRegionOfInterest = (value: string | RegionOfInterest): RegionOfInterest => {
  if (typeof value !== "string") {
    if (
      !Number.isFinite(value.left) ||
      !Number.isFinite(value.top) ||
      !Number.isFinite(value.right) ||
      !Number.isFinite(value.bottom)
    ) {
      throw new Error("Expected four numeric coordinates: left, top, right, bottom.");
    }

    if (value.right <= value.left || value.bottom <= value.top) {
      throw new Error("Expected right > left and bottom > top.");
    }

    return value;
  }

  const coordinates = value.split(",").map((coordinate) => Number(coordinate.trim()));

  if (coordinates.length !== 4 || coordinates.some((coordinate) => !Number.isFinite(coordinate))) {
    throw new Error("Expected four comma-separated coordinates: left,top,right,bottom.");
  }

  const [left = 0, top = 0, right = 0, bottom = 0] = coordinates;

  if (right <= left || bottom <= top) {
    throw new Error("Expected right > left and bottom > top.");
  }

  return {
    left,
    top,
    right,
    bottom
  };
};

export type TrackSettingsInput = {
  inputPath: string;
  outputLocation?: string;
  startSeconds?: string | number;
  stopSeconds?: string | number;
  color?: string;
  colorStart?: string;
  colorEnd?: string;
  threshold?: string | number;
  videoMode?: string;
  circleRadius?: string | number;
  trailLineWidth?: string | number;
  trailSeconds?: string | number;
  trailMarkers?: string | string[];
  csvExportMarkers?: string | string[];
  minArea?: string | number;
  maxArea?: string | number;
  mergeDistance?: string | number;
  maxTrackDistance?: string | number;
  searchRadius?: string | number;
  localThresholdMin?: string | number;
  roi?: string | RegionOfInterest;
  markersLayoutPath?: string;
  labelMarkers?: boolean;
  cropToRoi?: boolean;
  layoutFitTolerance?: string | number;
  debugOneFrame?: boolean;
  trackLocalYAxisAngle?: boolean;
  includeCsvDiffColumns?: boolean;
  useLayoutUnits?: boolean;
  showProgress?: boolean;
};

export const buildTrackOptions = (settings: TrackSettingsInput): TrackOptions => {
  const color = parseColor(settings.color ?? DEFAULT_TRACK_SETTINGS.color);
  const trailColorStart =
    settings.colorStart === undefined ? color : parseColor(settings.colorStart);
  const trailColorEnd = settings.colorEnd === undefined ? color : parseColor(settings.colorEnd);

  return {
    inputPath: settings.inputPath,
    outputLocation: settings.outputLocation ?? DEFAULT_TRACK_SETTINGS.outputLocation,
    startSeconds:
      settings.startSeconds === undefined
        ? DEFAULT_TRACK_SETTINGS.startSeconds
        : parseTimeOption(settings.startSeconds),
    stopSeconds:
      settings.stopSeconds === undefined ? undefined : parseTimeOption(settings.stopSeconds),
    color,
    videoMode:
      settings.videoMode === undefined
        ? DEFAULT_TRACK_SETTINGS.videoMode
        : parseVideoMode(settings.videoMode),
    threshold:
      settings.threshold === undefined
        ? DEFAULT_TRACK_SETTINGS.threshold
        : parseThresholdOption(settings.threshold),
    circleRadius:
      settings.circleRadius === undefined
        ? DEFAULT_TRACK_SETTINGS.circleRadius
        : parsePositiveInteger(settings.circleRadius),
    trailLineWidth:
      settings.trailLineWidth === undefined
        ? DEFAULT_TRACK_SETTINGS.trailLineWidth
        : parsePositiveInteger(settings.trailLineWidth),
    trailSeconds:
      settings.trailSeconds === undefined
        ? DEFAULT_TRACK_SETTINGS.trailSeconds
        : parsePositiveNumber(settings.trailSeconds),
    trailMarkerNames: parseOptionalMarkerNameList(settings.trailMarkers),
    csvExportMarkerNames: parseOptionalMarkerNameList(settings.csvExportMarkers),
    trailColorStart,
    trailColorEnd,
    minArea:
      settings.minArea === undefined
        ? DEFAULT_TRACK_SETTINGS.minArea
        : parsePositiveInteger(settings.minArea),
    maxArea:
      settings.maxArea === undefined
        ? DEFAULT_TRACK_SETTINGS.maxArea
        : parsePositiveInteger(settings.maxArea),
    mergeDistance:
      settings.mergeDistance === undefined
        ? DEFAULT_TRACK_SETTINGS.mergeDistance
        : parsePositiveNumber(settings.mergeDistance),
    maxTrackDistance:
      settings.maxTrackDistance === undefined
        ? DEFAULT_TRACK_SETTINGS.maxTrackDistance
        : parsePositiveNumber(settings.maxTrackDistance),
    searchRadius:
      settings.searchRadius === undefined
        ? DEFAULT_TRACK_SETTINGS.searchRadius
        : parsePositiveNumber(settings.searchRadius),
    localThresholdMin:
      settings.localThresholdMin === undefined
        ? DEFAULT_TRACK_SETTINGS.localThresholdMin
        : parseThresholdInteger(settings.localThresholdMin),
    markersLayoutPath: settings.markersLayoutPath,
    labelMarkers: settings.labelMarkers ?? DEFAULT_TRACK_SETTINGS.labelMarkers,
    cropToRoi: settings.cropToRoi ?? DEFAULT_TRACK_SETTINGS.cropToRoi,
    layoutFitTolerance:
      settings.layoutFitTolerance === undefined
        ? DEFAULT_TRACK_SETTINGS.layoutFitTolerance
        : parsePositiveNumber(settings.layoutFitTolerance),
    regionOfInterest: settings.roi === undefined ? undefined : parseRegionOfInterest(settings.roi),
    debugOneFrame: settings.debugOneFrame ?? DEFAULT_TRACK_SETTINGS.debugOneFrame,
    trackLocalYAxisAngle: settings.trackLocalYAxisAngle ?? DEFAULT_TRACK_SETTINGS.trackLocalYAxisAngle,
    includeCsvDiffColumns: settings.includeCsvDiffColumns ?? DEFAULT_TRACK_SETTINGS.includeCsvDiffColumns,
    useLayoutUnits: settings.useLayoutUnits === true,
    showProgress: settings.showProgress ?? DEFAULT_TRACK_SETTINGS.showProgress
  };
};

export const formatSecondsAsTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const wholeSeconds = Math.floor(remainingSeconds);
  const milliseconds = Math.round((remainingSeconds - wholeSeconds) * 1000);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
  }

  if (minutes > 0) {
    return `${minutes}:${String(wholeSeconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
  }

  return `${wholeSeconds}.${String(milliseconds).padStart(3, "0")}`;
};

export type TrackSettingsSummary = {
  defaults: typeof DEFAULT_TRACK_SETTINGS;
  videoModes: VideoMode[];
};

export const getTrackSettingsSummary = (): TrackSettingsSummary => {
  return {
    defaults: DEFAULT_TRACK_SETTINGS,
    videoModes: VIDEO_MODES
  };
};

export type { RgbColor, ThresholdOption, TrackOptions, VideoMode };
