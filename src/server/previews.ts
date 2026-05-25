import { join } from "node:path";
import { buildTrackOptions, type TrackSettingsInput } from "../track-options.js";
import { trackRetroMarkers } from "../tracker.js";
import { resolveJobSettings } from "./jobs.js";
import type { SafePathResolver } from "./safe-path.js";

export type CreatePixelsPreviewRequest = {
  videoId: string;
  previewSeconds: number;
  settings: Record<string, unknown>;
};

type PreviewDependencies = {
  videoPathResolver: SafePathResolver;
  outputPathResolver: SafePathResolver;
  layoutPathResolver: SafePathResolver;
};

export const createPixelsPreview = async (
  dependencies: PreviewDependencies,
  request: CreatePixelsPreviewRequest
): Promise<{ imageUrl: string }> => {
  const settings = await resolveJobSettings(dependencies, request.videoId, {
    ...request.settings,
    startSeconds: request.previewSeconds,
    stopSeconds: request.previewSeconds + 0.05,
    videoMode: "pixels",
    debugOneFrame: true,
    showProgress: false
  } as Omit<TrackSettingsInput, "inputPath">);

  settings.outputLocation = join(dependencies.outputPathResolver.rootDirectory, "previews");

  const trackOptions = buildTrackOptions(settings);
  const result = await trackRetroMarkers(trackOptions);

  if (result.debugFramePath === undefined) {
    throw new Error("Pixels preview did not produce an image.");
  }

  const relativePath = dependencies.outputPathResolver.toRelativeUrlPath(result.debugFramePath);

  return {
    imageUrl: `/outputs/${relativePath}?t=${Date.now()}`
  };
};
