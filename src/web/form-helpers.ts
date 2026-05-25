import type { SettingsResponse } from "./types.js";
import type { JobFormState } from "./types.js";

export type Point = {
  x: number;
  y: number;
};

export type Rectangle = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export const parseRoiValue = (value: string): Rectangle | undefined => {
  const coordinates = value.split(",").map((coordinate) => Number(coordinate.trim()));

  if (coordinates.length !== 4 || coordinates.some((coordinate) => !Number.isFinite(coordinate))) {
    return undefined;
  }

  const [left = 0, top = 0, right = 0, bottom = 0] = coordinates;

  if (right <= left || bottom <= top) {
    return undefined;
  }

  return { left, top, right, bottom };
};

export const parseUiTimeSeconds = (value: string): number | undefined => {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return 0;
  }

  const parts = trimmedValue.split(":").map((part) => Number(part));

  if (parts.some((part) => Number.isNaN(part) || part < 0) || parts.length > 3) {
    return undefined;
  }

  if (parts.length === 1) {
    return parts[0] ?? 0;
  }

  if (parts.length === 2) {
    return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  }

  return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
};

export const createRectangle = (startPoint: Point, endPoint: Point): Rectangle => {
  return {
    left: Math.round(Math.min(startPoint.x, endPoint.x)),
    top: Math.round(Math.min(startPoint.y, endPoint.y)),
    right: Math.round(Math.max(startPoint.x, endPoint.x)),
    bottom: Math.round(Math.max(startPoint.y, endPoint.y))
  };
};

export const formatRectangle = (rectangle: Rectangle): string => {
  return `${rectangle.left},${rectangle.top},${rectangle.right},${rectangle.bottom}`;
};

export const createDefaultFormState = (settings: SettingsResponse): JobFormState => {
  return {
    startSeconds: String(settings.defaults.startSeconds),
    stopSeconds: "",
    color: settings.defaults.color,
    colorStart: "",
    colorEnd: "",
    threshold: typeof settings.defaults.threshold === "number" ? String(settings.defaults.threshold) : "180",
    thresholdPreviewEnabled: false,
    isVerticalVideo: false,
    videoMode: settings.defaults.videoMode,
    circleRadius: String(settings.defaults.circleRadius),
    trailLineWidth: String(settings.defaults.trailLineWidth),
    trailSeconds: String(settings.defaults.trailSeconds),
    trailMarkers: "",
    minArea: String(settings.defaults.minArea),
    maxArea: String(settings.defaults.maxArea),
    mergeDistance: String(settings.defaults.mergeDistance),
    maxTrackDistance: String(settings.defaults.maxTrackDistance),
    searchRadius: String(settings.defaults.searchRadius),
    localThresholdMin: String(settings.defaults.localThresholdMin),
    roi: "",
    markersLayoutPath: "",
    labelMarkers: settings.defaults.labelMarkers,
    cropToRoi: settings.defaults.cropToRoi,
    layoutFitTolerance: String(settings.defaults.layoutFitTolerance),
    debugOneFrame: settings.defaults.debugOneFrame
  };
};
