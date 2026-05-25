import { readFile, readdir, stat } from "node:fs/promises";
import { extname } from "node:path";
import { probeVideo } from "../tracker.js";
import type { SafePathResolver } from "./safe-path.js";

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"]);

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

export const listVideos = async (videoPathResolver: SafePathResolver): Promise<VideoListItem[]> => {
  const directoryEntries = await readdir(videoPathResolver.rootDirectory, { withFileTypes: true });
  const videoEntries = directoryEntries.filter((entry) => {
    return entry.isFile() && VIDEO_EXTENSIONS.has(extname(entry.name).toLowerCase());
  });

  const videos = await Promise.all(
    videoEntries.map(async (entry) => {
      const absolutePath = await videoPathResolver.resolveRelativePath(entry.name);
      const fileStats = await stat(absolutePath);
      const relativePath = videoPathResolver.toRelativeUrlPath(absolutePath);
      let metadata: Awaited<ReturnType<typeof probeVideo>> | undefined;

      try {
        metadata = await probeVideo(absolutePath);
      } catch {
        metadata = undefined;
      }

      return {
        id: relativePath,
        fileName: entry.name,
        sizeBytes: fileStats.size,
        mediaUrl: `/media/${relativePath}`,
        durationSeconds: metadata?.durationSeconds,
        width: metadata?.width,
        height: metadata?.height,
        fps: metadata?.fps
      } satisfies VideoListItem;
    })
  );

  return videos.sort((left, right) => left.fileName.localeCompare(right.fileName));
};

export const resolveVideoPath = async (
  videoPathResolver: SafePathResolver,
  videoId: string
): Promise<string> => {
  return videoPathResolver.resolveRelativePath(videoId);
};

const readLayoutMarkerNames = async (layoutPath: string): Promise<string[]> => {
  const rawLayout = JSON.parse(await readFile(layoutPath, "utf8")) as {
    markers?: Array<{
      name?: unknown;
    }>;
  };

  if (!Array.isArray(rawLayout.markers)) {
    return [];
  }

  return rawLayout.markers
    .map((marker) => marker.name)
    .filter((markerName): markerName is string => typeof markerName === "string" && markerName.length > 0);
};

export const listLayoutFiles = async (layoutPathResolver: SafePathResolver): Promise<LayoutListItem[]> => {
  const directoryEntries = await readdir(layoutPathResolver.rootDirectory, { withFileTypes: true });
  const layoutFiles: LayoutListItem[] = [];

  for (const entry of directoryEntries) {
    if (!entry.isFile() || extname(entry.name).toLowerCase() !== ".json") {
      continue;
    }

    const layoutPath = await layoutPathResolver.resolveRelativePath(entry.name);

    layoutFiles.push({
      fileName: entry.name,
      markerNames: await readLayoutMarkerNames(layoutPath)
    });
  }

  return layoutFiles.sort((left, right) => left.fileName.localeCompare(right.fileName));
};

export const getLayoutFile = async (
  layoutPathResolver: SafePathResolver,
  layoutFileName: string
): Promise<LayoutListItem> => {
  const layoutPath = await layoutPathResolver.resolveRelativePath(layoutFileName);

  return {
    fileName: layoutFileName,
    markerNames: await readLayoutMarkerNames(layoutPath)
  };
};

export const resolveLayoutPath = async (
  layoutPathResolver: SafePathResolver,
  layoutFileName: string
): Promise<string> => {
  return layoutPathResolver.resolveRelativePath(layoutFileName);
};
