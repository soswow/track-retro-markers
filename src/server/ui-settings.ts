import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { VideoMode } from "../tracker.js";

type SystemError = Error & {
  code?: string;
};

export type UiFormState = {
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
  minArea: string;
  maxArea: string;
  mergeDistance: string;
  maxTrackDistance: string;
  searchRadius: string;
  localThresholdMin: string;
  roi: string;
  markersLayoutPath: string;
  labelMarkers: boolean;
  layoutFitTolerance: string;
  debugOneFrame: boolean;
};

export type PersistedUiSettings = {
  selectedVideoId: string;
  isVerticalVideo: boolean;
  formState: UiFormState;
};

export const SEEDED_UI_SETTINGS: PersistedUiSettings = {
  selectedVideoId: "VID_20260524_213716.mp4",
  isVerticalVideo: false,
  formState: {
    startSeconds: "01:24",
    stopSeconds: "01:43",
    color: "white",
    colorStart: "green",
    colorEnd: "blue",
    threshold: "160",
    thresholdPreviewEnabled: false,
    isVerticalVideo: false,
    videoMode: "trails",
    circleRadius: "12",
    trailLineWidth: "4",
    trailSeconds: "20",
    trailMarkers: "main front camera",
    minArea: "10",
    maxArea: "2500",
    mergeDistance: "10",
    maxTrackDistance: "140",
    searchRadius: "180",
    localThresholdMin: "180",
    roi: "238,1300,2300,2500",
    markersLayoutPath: "markers-layout.json",
    labelMarkers: true,
    layoutFitTolerance: "60",
    debugOneFrame: false
  }
};

export class UiSettingsStore {
  public constructor(private readonly settingsPath: string) {}

  public async read(): Promise<PersistedUiSettings> {
    try {
      const rawSettings = await readFile(this.settingsPath, "utf8");
      const parsedSettings = JSON.parse(rawSettings) as Partial<PersistedUiSettings>;

      return this.normalize(parsedSettings);
    } catch (error) {
      if (error instanceof Error && (error as SystemError).code === "ENOENT") {
        return SEEDED_UI_SETTINGS;
      }

      throw error;
    }
  }

  public async write(settings: PersistedUiSettings): Promise<PersistedUiSettings> {
    const normalizedSettings = this.normalize(settings);

    await mkdir(dirname(this.settingsPath), { recursive: true });
    await writeFile(this.settingsPath, `${JSON.stringify(normalizedSettings, null, 2)}\n`, "utf8");

    return normalizedSettings;
  }

  private normalize(settings: Partial<PersistedUiSettings>): PersistedUiSettings {
    return {
      selectedVideoId:
        typeof settings.selectedVideoId === "string" ? settings.selectedVideoId : SEEDED_UI_SETTINGS.selectedVideoId,
      isVerticalVideo:
        typeof settings.isVerticalVideo === "boolean"
          ? settings.isVerticalVideo
          : settings.formState?.isVerticalVideo ?? SEEDED_UI_SETTINGS.isVerticalVideo,
      formState: {
        ...SEEDED_UI_SETTINGS.formState,
        ...(settings.formState ?? {}),
        isVerticalVideo:
          settings.formState?.isVerticalVideo ??
          settings.isVerticalVideo ??
          SEEDED_UI_SETTINGS.formState.isVerticalVideo
      }
    };
  }
}
