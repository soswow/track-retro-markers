import type { ThresholdOption, VideoMode } from "../track-options.js";

export type VideoListItem = {
  id: string;
  fileName: string;
  sizeBytes: number;
  mediaUrl: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  fps?: number;
};

export type LayoutListItem = {
  fileName: string;
  markerNames: string[];
};

export type JobStatus = "queued" | "running" | "completed" | "failed";

export type JobOutputUrls = {
  csvUrl?: string;
  videoUrl?: string;
  debugFrameUrl?: string;
};

export type TrackResultSummary = {
  csvPath?: string;
  videoPath?: string;
  debugFramePath?: string;
  threshold: number;
  framesProcessed: number;
  fps: number;
};

export type TrackProgress = {
  framesProcessed: number;
  totalFrames?: number;
  percent?: number;
  phase?: "preparing" | "processing" | "finalizing";
};

export type TrackingJob = {
  jobId: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  videoId: string;
  settings: Record<string, unknown>;
  result?: TrackResultSummary;
  progress?: TrackProgress;
  outputUrls?: JobOutputUrls;
  errorMessage?: string;
};

export type TrackSettingsDefaults = {
  startSeconds: number;
  color: string;
  threshold: ThresholdOption;
  videoMode: VideoMode;
  outputLocation: string;
  circleRadius: number;
  trailLineWidth: number;
  trailSeconds: number;
  minArea: number;
  maxArea: number;
  mergeDistance: number;
  maxTrackDistance: number;
  searchRadius: number;
  localThresholdMin: number;
  layoutFitTolerance: number;
  labelMarkers: boolean;
  cropToRoi: boolean;
  debugOneFrame: boolean;
  trackLocalYAxisAngle: boolean;
  includeCsvDiffColumns: boolean;
  showProgress: boolean;
};

export type SettingsResponse = {
  defaults: TrackSettingsDefaults;
  videoModes: VideoMode[];
};

export type JobFormState = {
  startSeconds: string;
  stopSeconds: string;
  color: string;
  colorStart: string;
  colorEnd: string;
  threshold: string;
  thresholdPreviewEnabled: boolean;
  isVerticalVideo: boolean;
  videoMode: VideoMode;
  circleRadius: string;
  trailLineWidth: string;
  trailSeconds: string;
  trailMarkers: string;
  csvExportMarkers: string;
  minArea: string;
  maxArea: string;
  mergeDistance: string;
  maxTrackDistance: string;
  searchRadius: string;
  localThresholdMin: string;
  roi: string;
  markersLayoutPath: string;
  labelMarkers: boolean;
  cropToRoi: boolean;
  layoutFitTolerance: string;
  debugOneFrame: boolean;
  useLayoutUnits: boolean;
  trackLocalYAxisAngle: boolean;
  includeCsvDiffColumns: boolean;
};

export type PersistedUiSettings = {
  selectedVideoId: string;
  isVerticalVideo: boolean;
  formState: JobFormState;
};

export type PixelsPreviewResponse = {
  imageUrl: string;
};
