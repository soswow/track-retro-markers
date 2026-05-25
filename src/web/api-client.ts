import type {
  JobFormState,
  LayoutListItem,
  PersistedUiSettings,
  PixelsPreviewResponse,
  SettingsResponse,
  TrackingJob,
  VideoListItem
} from "./types.js";

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as { error?: string };

    throw new Error(errorBody.error ?? `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
};

const readMarkerNamesFromLayout = (layout: unknown): string[] => {
  if (layout === null || typeof layout !== "object" || !Array.isArray((layout as { markers?: unknown }).markers)) {
    return [];
  }

  return (layout as { markers: Array<{ name?: unknown }> }).markers
    .map((marker) => marker.name)
    .filter((markerName): markerName is string => typeof markerName === "string" && markerName.length > 0);
};

const fetchLayoutMarkerNames = async (fileName: string): Promise<string[]> => {
  const layoutResponse = await fetch(`/${encodeURI(fileName)}`);

  if (!layoutResponse.ok) {
    return [];
  }

  return readMarkerNamesFromLayout(await layoutResponse.json().catch(() => undefined));
};

export const fetchVideos = async (): Promise<VideoListItem[]> => {
  const response = await fetchJson<{ videos: VideoListItem[] }>("/api/videos");

  return response.videos;
};

export const fetchLayouts = async (): Promise<LayoutListItem[]> => {
  const response = await fetchJson<{ layouts: Array<LayoutListItem | string> }>("/api/layouts");

  return Promise.all(response.layouts.map(async (layout) => {
    if (typeof layout === "string") {
      return {
        fileName: layout,
        markerNames: await fetchLayoutMarkerNames(layout)
      };
    }

    return layout;
  }));
};

export const fetchSettings = async (): Promise<SettingsResponse> => {
  return fetchJson<SettingsResponse>("/api/settings");
};

export const fetchUiSettings = async (): Promise<PersistedUiSettings> => {
  return fetchJson<PersistedUiSettings>("/api/ui-settings");
};

export const saveUiSettings = async (settings: PersistedUiSettings): Promise<PersistedUiSettings> => {
  return fetchJson<PersistedUiSettings>("/api/ui-settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(settings)
  });
};

export const fetchJob = async (jobId: string): Promise<TrackingJob> => {
  return fetchJson<TrackingJob>(`/api/jobs/${jobId}`);
};

export const createJob = async (videoId: string, settings: JobFormState): Promise<TrackingJob> => {
  const payload: Record<string, unknown> = {
    startSeconds: settings.startSeconds.length > 0 ? settings.startSeconds : 0,
    color: settings.color,
    threshold: settings.threshold === "auto" ? "auto" : Number(settings.threshold),
    videoMode: settings.videoMode,
    circleRadius: Number(settings.circleRadius),
    trailLineWidth: Number(settings.trailLineWidth),
    trailSeconds: Number(settings.trailSeconds),
    minArea: Number(settings.minArea),
    maxArea: Number(settings.maxArea),
    mergeDistance: Number(settings.mergeDistance),
    maxTrackDistance: Number(settings.maxTrackDistance),
    searchRadius: Number(settings.searchRadius),
    localThresholdMin: Number(settings.localThresholdMin),
    labelMarkers: settings.labelMarkers,
    cropToRoi: settings.roi.length > 0 && settings.cropToRoi,
    layoutFitTolerance: Number(settings.layoutFitTolerance),
    debugOneFrame: settings.debugOneFrame
  };

  if (settings.stopSeconds.length > 0) {
    payload.stopSeconds = settings.stopSeconds;
  }

  if (settings.colorStart.length > 0) {
    payload.colorStart = settings.colorStart;
  }

  if (settings.colorEnd.length > 0) {
    payload.colorEnd = settings.colorEnd;
  }

  if (settings.trailMarkers.length > 0) {
    payload.trailMarkers = settings.trailMarkers;
  }

  if (settings.roi.length > 0) {
    payload.roi = settings.roi;
  }

  if (settings.markersLayoutPath.length > 0) {
    payload.markersLayoutPath = settings.markersLayoutPath;
  }

  return fetchJson<TrackingJob>("/api/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      videoId,
      settings: payload
    })
  });
};

export const createPixelsPreview = async (
  videoId: string,
  settings: JobFormState,
  previewSeconds: number
): Promise<PixelsPreviewResponse> => {
  const payload: Record<string, unknown> = {
    startSeconds: previewSeconds,
    threshold: Number(settings.threshold),
    roi: settings.roi.length > 0 ? settings.roi : undefined,
    minArea: Number(settings.minArea),
    maxArea: Number(settings.maxArea),
    mergeDistance: Number(settings.mergeDistance),
    maxTrackDistance: Number(settings.maxTrackDistance),
    searchRadius: Number(settings.searchRadius),
    localThresholdMin: Number(settings.localThresholdMin),
    markersLayoutPath: settings.markersLayoutPath.length > 0 ? settings.markersLayoutPath : undefined,
    labelMarkers: settings.labelMarkers,
    layoutFitTolerance: Number(settings.layoutFitTolerance)
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });

  return fetchJson<PixelsPreviewResponse>("/api/previews/pixels", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      videoId,
      previewSeconds,
      settings: payload
    })
  });
};

export const formatDuration = (seconds?: number): string => {
  if (seconds === undefined || !Number.isFinite(seconds)) {
    return "unknown";
  }

  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

export const formatFileSize = (sizeBytes: number): string => {
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
};
