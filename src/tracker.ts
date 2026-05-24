import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { estimateExpectedFrameCount, ProgressReporter } from "./progress.js";

const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static") as string | null;
const ffprobeStatic = require("ffprobe-static") as { path: string };
const MAX_COLOR_SPREAD = 45;

export type VideoMode = "points" | "trails" | "overlay" | "pixels" | "copy" | "none";
export type ThresholdOption = "auto" | number;

export type TrackOptions = {
  inputPath: string;
  outputLocation: string;
  startSeconds: number;
  stopSeconds?: number;
  color: RgbColor;
  videoMode: VideoMode;
  threshold: ThresholdOption;
  circleRadius: number;
  trailLineWidth: number;
  trailSeconds: number;
  trailColorStart: RgbColor;
  trailColorEnd: RgbColor;
  minArea: number;
  maxArea: number;
  mergeDistance: number;
  maxTrackDistance: number;
  searchRadius: number;
  localThresholdMin: number;
  debugOneFrame?: boolean;
  showProgress?: boolean;
};

export type RgbColor = {
  red: number;
  green: number;
  blue: number;
};

type VideoMetadata = {
  width: number;
  height: number;
  fps: number;
  durationSeconds?: number;
};

type Detection = {
  x: number;
  y: number;
  area: number;
};

type TrackPoint = {
  x: number;
  y: number;
  frameIndex: number;
};

type OutputPaths = {
  csvPath?: string;
  videoPath?: string;
  debugFramePath?: string;
};

type SearchWindow = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type TrackResult = {
  csvPath?: string;
  videoPath?: string;
  debugFramePath?: string;
  threshold: number;
  framesProcessed: number;
  fps: number;
};

export const parseTimeSeconds = (value: string): number => {
  const parts = value.split(":").map((part) => Number(part));

  if (parts.some((part) => Number.isNaN(part) || part < 0)) {
    throw new Error(`Invalid time value: ${value}`);
  }

  if (parts.length === 1) {
    return parts[0] ?? 0;
  }

  if (parts.length === 2) {
    return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  }

  if (parts.length === 3) {
    return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  }

  throw new Error(`Invalid time value: ${value}`);
};

export const parseColor = (value: string): RgbColor => {
  const namedColors: Record<string, RgbColor> = {
    white: { red: 255, green: 255, blue: 255 },
    red: { red: 255, green: 0, blue: 0 },
    green: { red: 0, green: 255, blue: 0 },
    blue: { red: 0, green: 0, blue: 255 },
    yellow: { red: 255, green: 255, blue: 0 }
  };

  const normalizedValue = value.trim().toLowerCase();
  const namedColor = namedColors[normalizedValue];

  if (namedColor !== undefined) {
    return namedColor;
  }

  const hexMatch = normalizedValue.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/u);

  if (hexMatch?.[1] !== undefined) {
    const hex = hexMatch[1];
    const expandedHex =
      hex.length === 3
        ? hex
            .split("")
            .map((character) => `${character}${character}`)
            .join("")
        : hex;

    return {
      red: Number.parseInt(expandedHex.slice(0, 2), 16),
      green: Number.parseInt(expandedHex.slice(2, 4), 16),
      blue: Number.parseInt(expandedHex.slice(4, 6), 16)
    };
  }

  const rgbParts = normalizedValue.split(",").map((part) => Number(part.trim()));

  if (rgbParts.length === 3 && rgbParts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    return {
      red: rgbParts[0] ?? 0,
      green: rgbParts[1] ?? 0,
      blue: rgbParts[2] ?? 0
    };
  }

  throw new Error(`Invalid color: ${value}. Use a name, #rrggbb, #rgb, or r,g,b.`);
};

export const trackRetroMarkers = async (options: TrackOptions): Promise<TrackResult> => {
  assertFfmpegAvailable();

  const metadata = await probeVideo(options.inputPath);
  const stopSeconds = options.stopSeconds ?? metadata.durationSeconds;

  if (stopSeconds !== undefined && stopSeconds <= options.startSeconds) {
    throw new Error("--stop must be greater than --start");
  }

  const outputPaths = await createOutputPaths(options, stopSeconds);
  const frameSize = metadata.width * metadata.height * 3;
  const debugOneFrame = options.debugOneFrame === true;
  const shouldWriteDebugFrame = debugOneFrame && options.videoMode !== "none";
  const expectedFrameCount = estimateExpectedFrameCount(
    options.startSeconds,
    stopSeconds,
    metadata.durationSeconds,
    metadata.fps
  );
  const frameReadLimit = debugOneFrame ? 1 : expectedFrameCount;
  const detector = new MarkerDetector(metadata.width, metadata.height, {
    maxColorSpread: MAX_COLOR_SPREAD,
    minArea: options.minArea,
    maxArea: options.maxArea,
    mergeDistance: options.mergeDistance
  });
  let histories: TrackPoint[][] = [];
  const csvStream = debugOneFrame ? undefined : createWriteStream(outputPaths.csvPath ?? "");
  const videoWriter =
    debugOneFrame || options.videoMode === "none"
      ? undefined
      : createVideoWriter(outputPaths.videoPath ?? "", metadata.width, metadata.height, metadata.fps, frameSize, frameReadLimit);
  const ffmpeg = createFrameReader(options.inputPath, options.startSeconds, stopSeconds, metadata, frameReadLimit);
  let frameBuffer = Buffer.allocUnsafe(frameSize);
  let frameBufferOffset = 0;
  let resolvedThreshold = typeof options.threshold === "number" ? options.threshold : undefined;
  let searchTracks: Array<Detection | undefined> = [];
  let hasAcquiredTracks = false;
  let frameIndex = 0;
  const progressReporter = new ProgressReporter({
    enabled: options.showProgress !== false,
    expectedFrameCount: frameReadLimit,
    fps: metadata.fps,
    startSeconds: options.startSeconds,
    stopSeconds
  });

  let csvHeaderWritten = false;

  let frameProcessingComplete = false;

  for await (const chunk of ffmpeg.stdout) {
    let chunkOffset = 0;

    while (chunkOffset < chunk.length) {
      const bytesToCopy = Math.min(frameSize - frameBufferOffset, chunk.length - chunkOffset);
      chunk.copy(frameBuffer, frameBufferOffset, chunkOffset, chunkOffset + bytesToCopy);
      frameBufferOffset += bytesToCopy;
      chunkOffset += bytesToCopy;

      if (frameBufferOffset < frameSize) {
        continue;
      }

      const frame = frameBuffer;

      if (resolvedThreshold === undefined) {
        resolvedThreshold = detector.chooseAutoThreshold(frame);
      }

      let detections: Detection[];
      let assignedTracks: Array<Detection | undefined>;

      if (!hasAcquiredTracks) {
        detections = detector.detect(frame, resolvedThreshold);
        assignedTracks = assignInitialDetections(detections);
        searchTracks = assignedTracks;
        histories = Array.from({ length: assignedTracks.length }, () => [] as TrackPoint[]);
        hasAcquiredTracks = true;
      } else {
        assignedTracks = trackDetectionsLocally(frame, detector, searchTracks, resolvedThreshold, options, metadata);
        searchTracks = searchTracks.map((previousDetection, trackIndex) => assignedTracks[trackIndex] ?? previousDetection);

        if (assignedTracks.some((detection) => detection === undefined)) {
          detections = detector.detect(frame, resolvedThreshold);
          assignedTracks = reacquireMissingTracks(detections, assignedTracks, searchTracks, options);
          searchTracks = searchTracks.map((previousDetection, trackIndex) => assignedTracks[trackIndex] ?? previousDetection);
        }
      }

      if (csvStream !== undefined) {
        if (!csvHeaderWritten) {
          csvStream.write(createCsvHeader(assignedTracks.length));
          csvHeaderWritten = true;
        }

        writeCsvRow(csvStream, frameIndex, metadata.fps, assignedTracks);
      }

      if (videoWriter !== undefined || shouldWriteDebugFrame) {
        const renderedFrame = renderFrame(frame, assignedTracks, histories, frameIndex, metadata, resolvedThreshold, options);

        if (shouldWriteDebugFrame) {
          await writePngFrame(outputPaths.debugFramePath ?? "", metadata.width, metadata.height, renderedFrame);
        } else if (videoWriter !== undefined) {
          await writeFrame(videoWriter, renderedFrame);
        }
      }

      progressReporter.report(frameIndex);
      frameIndex += 1;
      frameBuffer = Buffer.allocUnsafe(frameSize);
      frameBufferOffset = 0;

      if (frameReadLimit !== undefined && frameIndex >= frameReadLimit) {
        frameProcessingComplete = true;
        break;
      }
    }

    if (frameProcessingComplete) {
      break;
    }
  }

  if (frameIndex > 0) {
    progressReporter.finish(frameIndex - 1);
  }

  const readerExitCode = await stopChildProcess(ffmpeg, "frame extraction");

  if (readerExitCode !== 0) {
    throw new Error(`FFmpeg frame extraction failed with exit code ${readerExitCode}`);
  }

  if (csvStream !== undefined) {
    if (!csvHeaderWritten) {
      csvStream.write(createCsvHeader(0));
    }

    csvStream.end();
    await once(csvStream, "finish");
  }

  if (videoWriter !== undefined) {
    progressReporter.logStatus("Finalizing video...");
    await finishVideoWriter(videoWriter);
  }

  return {
    csvPath: outputPaths.csvPath,
    videoPath: outputPaths.videoPath,
    debugFramePath: outputPaths.debugFramePath,
    threshold: resolvedThreshold ?? 255,
    framesProcessed: frameIndex,
    fps: metadata.fps
  };
};

class MarkerDetector {
  private readonly width: number;
  private readonly height: number;
  private readonly pixelCount: number;
  private readonly visited: Uint8Array;
  private readonly stack: Int32Array;
  private readonly options: {
    maxColorSpread: number;
    minArea: number;
    maxArea: number;
    mergeDistance: number;
  };

  public constructor(
    width: number,
    height: number,
    options: {
      maxColorSpread: number;
      minArea: number;
      maxArea: number;
      mergeDistance: number;
    }
  ) {
    this.width = width;
    this.height = height;
    this.pixelCount = width * height;
    this.visited = new Uint8Array(this.pixelCount);
    this.stack = new Int32Array(this.pixelCount);
    this.options = options;
  }

  public chooseAutoThreshold(frame: Buffer): number {
    const thresholdsToTry = [255, 252, 250, 248, 245, 242, 240, 235, 230, 225, 220];

    for (const threshold of thresholdsToTry) {
      const detections = this.detect(frame, threshold);

      if (detections.length > 0) {
        return threshold;
      }
    }

    return thresholdsToTry[0] ?? 255;
  }

  public detect(frame: Buffer, threshold: number, searchWindows?: SearchWindow[]): Detection[] {
    const components: Detection[] = [];
    this.visited.fill(0);

    for (const searchWindow of searchWindows ?? [this.getFullFrameWindow()]) {
      this.detectInWindow(frame, threshold, searchWindow, components);
    }

    const detections = mergeNearbyDetections(components, this.options.mergeDistance).sort((left, right) => right.area - left.area);

    return detections;
  }

  public detectClosestInWindow(
    frame: Buffer,
    previousDetection: Detection,
    searchWindow: SearchWindow,
    baseThreshold: number,
    minimumThreshold: number,
    maxDistance: number
  ): Detection | undefined {
    const thresholdStep = 5;
    const thresholdFloor = Math.min(baseThreshold, minimumThreshold);

    for (let threshold = baseThreshold; threshold >= thresholdFloor; threshold -= thresholdStep) {
      const detections = this.detect(frame, threshold, [searchWindow]);
      const closestDetection = findClosestDetection(previousDetection, detections, maxDistance);

      if (closestDetection !== undefined) {
        return closestDetection;
      }
    }

    return undefined;
  }

  private detectInWindow(frame: Buffer, threshold: number, searchWindow: SearchWindow, components: Detection[]): void {
    for (let y = searchWindow.top; y < searchWindow.bottom; y += 1) {
      const rowOffset = y * this.width;

      for (let x = searchWindow.left; x < searchWindow.right; x += 1) {
        const pixelIndex = rowOffset + x;

        if (this.visited[pixelIndex] === 1 || !this.isCandidate(frame, pixelIndex, threshold)) {
          continue;
        }

        const detection = this.readComponent(frame, pixelIndex, threshold);

        if (detection.area >= this.options.minArea && detection.area <= this.options.maxArea) {
          components.push(detection);
        }
      }
    }
  }

  private readComponent(frame: Buffer, startPixelIndex: number, threshold: number): Detection {
    let stackLength = 0;
    let area = 0;
    let sumX = 0;
    let sumY = 0;

    this.stack[stackLength] = startPixelIndex;
    stackLength += 1;
    this.visited[startPixelIndex] = 1;

    while (stackLength > 0) {
      stackLength -= 1;
      const pixelIndex = this.stack[stackLength] ?? 0;
      const x = pixelIndex % this.width;
      const y = Math.floor(pixelIndex / this.width);

      area += 1;
      sumX += x;
      sumY += y;

      stackLength = this.tryPushNeighbor(frame, pixelIndex - 1, threshold, x > 0, stackLength);
      stackLength = this.tryPushNeighbor(frame, pixelIndex + 1, threshold, x < this.width - 1, stackLength);
      stackLength = this.tryPushNeighbor(frame, pixelIndex - this.width, threshold, y > 0, stackLength);
      stackLength = this.tryPushNeighbor(frame, pixelIndex + this.width, threshold, y < this.height - 1, stackLength);
    }

    return {
      x: sumX / area,
      y: sumY / area,
      area
    };
  }

  private tryPushNeighbor(frame: Buffer, pixelIndex: number, threshold: number, isInBounds: boolean, stackLength: number): number {
    if (!isInBounds || this.visited[pixelIndex] === 1 || !this.isCandidate(frame, pixelIndex, threshold)) {
      return stackLength;
    }

    this.visited[pixelIndex] = 1;
    this.stack[stackLength] = pixelIndex;
    return stackLength + 1;
  }

  private isCandidate(frame: Buffer, pixelIndex: number, threshold: number): boolean {
    return isCandidatePixel(frame, pixelIndex, threshold, this.options.maxColorSpread);
  }

  private getFullFrameWindow(): SearchWindow {
    return {
      left: 0,
      top: 0,
      right: this.width,
      bottom: this.height
    };
  }
}

const assignInitialDetections = (detections: Detection[]): Detection[] => {
  return sortInitialDetections(detections);
};

const trackDetectionsLocally = (
  frame: Buffer,
  detector: MarkerDetector,
  searchTracks: Array<Detection | undefined>,
  resolvedThreshold: number,
  options: TrackOptions,
  metadata: VideoMetadata
): Array<Detection | undefined> => {
  const assignedTracks: Array<Detection | undefined> = Array.from({ length: searchTracks.length }, () => undefined);

  for (let trackIndex = 0; trackIndex < searchTracks.length; trackIndex += 1) {
    const previousDetection = searchTracks[trackIndex];

    if (previousDetection === undefined) {
      continue;
    }

    const searchWindow = createSearchWindow(previousDetection, metadata, options.searchRadius);
    const localDetection = detector.detectClosestInWindow(
      frame,
      previousDetection,
      searchWindow,
      resolvedThreshold,
      options.localThresholdMin,
      options.maxTrackDistance
    );

    if (localDetection !== undefined && !isAlreadyAssigned(localDetection, assignedTracks, options.mergeDistance)) {
      assignedTracks[trackIndex] = localDetection;
    }
  }

  return assignedTracks;
};

const reacquireMissingTracks = (
  detections: Detection[],
  assignedTracks: Array<Detection | undefined>,
  searchTracks: Array<Detection | undefined>,
  options: TrackOptions
): Array<Detection | undefined> => {
  const nextTracks = [...assignedTracks];
  const unusedDetections = new Set(detections);

  for (const assignedTrack of assignedTracks) {
    if (assignedTrack !== undefined) {
      deleteNearbyDetection(unusedDetections, assignedTrack, options.mergeDistance);
    }
  }

  for (let trackIndex = 0; trackIndex < nextTracks.length; trackIndex += 1) {
    if (nextTracks[trackIndex] !== undefined) {
      continue;
    }

    const previousDetection = searchTracks[trackIndex];

    if (previousDetection === undefined) {
      continue;
    }

    const reacquiredDetection = findClosestDetection(previousDetection, [...unusedDetections], options.maxTrackDistance);

    if (reacquiredDetection !== undefined) {
      nextTracks[trackIndex] = reacquiredDetection;
      unusedDetections.delete(reacquiredDetection);
    }
  }

  return nextTracks;
};

const sortInitialDetections = (detections: Detection[]): Detection[] => {
  const rowTolerancePixels = 40;

  return [...detections].sort((left, right) => {
    if (Math.abs(left.y - right.y) > rowTolerancePixels) {
      return left.y - right.y;
    }

    return left.x - right.x;
  });
};

const createSearchWindow = (
  detection: Detection,
  metadata: VideoMetadata,
  searchRadius: number
): SearchWindow => {
  return {
    left: Math.max(0, Math.floor(detection.x - searchRadius)),
    top: Math.max(0, Math.floor(detection.y - searchRadius)),
    right: Math.min(metadata.width, Math.ceil(detection.x + searchRadius)),
    bottom: Math.min(metadata.height, Math.ceil(detection.y + searchRadius))
  };
};

const findClosestDetection = (
  targetDetection: Detection,
  detections: Detection[],
  maxDistance: number
): Detection | undefined => {
  const maxDistanceSquared = maxDistance ** 2;
  let bestDetection: Detection | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const detection of detections) {
    const distance = squaredDistance(targetDetection, detection);

    if (distance < bestDistance && distance <= maxDistanceSquared) {
      bestDistance = distance;
      bestDetection = detection;
    }
  }

  return bestDetection;
};

const isAlreadyAssigned = (
  detection: Detection,
  assignedTracks: Array<Detection | undefined>,
  mergeDistance: number
): boolean => {
  return assignedTracks.some((assignedTrack) => {
    return assignedTrack !== undefined && Math.sqrt(squaredDistance(detection, assignedTrack)) <= mergeDistance;
  });
};

const deleteNearbyDetection = (detections: Set<Detection>, targetDetection: Detection, mergeDistance: number): void => {
  for (const detection of detections) {
    if (Math.sqrt(squaredDistance(detection, targetDetection)) <= mergeDistance) {
      detections.delete(detection);
      return;
    }
  }
};

const mergeNearbyDetections = (detections: Detection[], mergeDistance: number): Detection[] => {
  const mergeDistanceSquared = mergeDistance ** 2;
  const groups: Detection[] = [];

  for (const detection of detections.sort((left, right) => right.area - left.area)) {
    let bestGroup: Detection | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const group of groups) {
      const distance = squaredDistance(group, detection);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestGroup = group;
      }
    }

    if (bestGroup !== undefined && bestDistance <= mergeDistanceSquared) {
      const combinedArea = bestGroup.area + detection.area;
      bestGroup.x = (bestGroup.x * bestGroup.area + detection.x * detection.area) / combinedArea;
      bestGroup.y = (bestGroup.y * bestGroup.area + detection.y * detection.area) / combinedArea;
      bestGroup.area = combinedArea;
      continue;
    }

    groups.push({ ...detection });
  }

  return groups;
};

const squaredDistance = (left: Detection, right: Detection): number => {
  return (left.x - right.x) ** 2 + (left.y - right.y) ** 2;
};

const isCandidatePixel = (frame: Buffer, pixelIndex: number, threshold: number, maxColorSpread: number): boolean => {
  const bufferIndex = pixelIndex * 3;
  const red = frame[bufferIndex] ?? 0;
  const green = frame[bufferIndex + 1] ?? 0;
  const blue = frame[bufferIndex + 2] ?? 0;
  const minChannel = Math.min(red, green, blue);
  const maxChannel = Math.max(red, green, blue);

  return minChannel >= threshold && maxChannel - minChannel <= maxColorSpread;
};

const renderFrame = (
  sourceFrame: Buffer,
  assignedTracks: Array<Detection | undefined>,
  histories: TrackPoint[][],
  frameIndex: number,
  metadata: VideoMetadata,
  threshold: number,
  options: TrackOptions
): Buffer => {
  if (options.videoMode === "pixels") {
    return renderPixelMask(sourceFrame, metadata.width, metadata.height, threshold, MAX_COLOR_SPREAD);
  }

  if (options.videoMode === "copy") {
    return Buffer.from(sourceFrame);
  }

  const outputFrame =
    options.videoMode === "overlay"
      ? Buffer.from(sourceFrame)
      : Buffer.alloc(metadata.width * metadata.height * 3, 0);
  const trailFrameCount = Math.max(1, Math.round(options.trailSeconds * metadata.fps));

  for (let trackIndex = 0; trackIndex < assignedTracks.length; trackIndex += 1) {
    const detection = assignedTracks[trackIndex];
    const history = histories[trackIndex];

    if (history === undefined) {
      continue;
    }

    if (detection !== undefined) {
      history.push({ x: detection.x, y: detection.y, frameIndex });
    }

    while (history.length > 0 && frameIndex - (history[0]?.frameIndex ?? 0) > trailFrameCount) {
      history.shift();
    }

    if (options.videoMode === "trails" || options.videoMode === "overlay") {
      drawTrail(
        outputFrame,
        metadata.width,
        metadata.height,
        history,
        frameIndex,
        trailFrameCount,
        options.trailLineWidth,
        options.trailColorStart,
        options.trailColorEnd
      );
    }

    if (detection !== undefined) {
      drawCircle(outputFrame, metadata.width, metadata.height, detection.x, detection.y, options.circleRadius, options.color, 1);
    }
  }

  return outputFrame;
};

const renderPixelMask = (sourceFrame: Buffer, width: number, height: number, threshold: number, maxColorSpread: number): Buffer => {
  const outputFrame = Buffer.alloc(width * height * 3, 0);
  const pixelCount = width * height;

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    if (!isCandidatePixel(sourceFrame, pixelIndex, threshold, maxColorSpread)) {
      continue;
    }

    const bufferIndex = pixelIndex * 3;
    outputFrame[bufferIndex] = 255;
    outputFrame[bufferIndex + 1] = 255;
    outputFrame[bufferIndex + 2] = 255;
  }

  return outputFrame;
};

const drawTrail = (
  frame: Buffer,
  width: number,
  height: number,
  history: TrackPoint[],
  frameIndex: number,
  trailFrameCount: number,
  lineWidth: number,
  colorStart: RgbColor,
  colorEnd: RgbColor
): void => {
  for (let pointIndex = 1; pointIndex < history.length; pointIndex += 1) {
    const previousPoint = history[pointIndex - 1];
    const currentPoint = history[pointIndex];

    if (previousPoint === undefined || currentPoint === undefined) {
      continue;
    }

    const age = frameIndex - currentPoint.frameIndex;
    const alpha = Math.max(0, 1 - age / trailFrameCount);
    const color = interpolateColor(colorStart, colorEnd, Math.min(1, age / trailFrameCount));
    drawLine(frame, width, height, previousPoint.x, previousPoint.y, currentPoint.x, currentPoint.y, lineWidth, color, alpha);
  }
};

const interpolateColor = (startColor: RgbColor, endColor: RgbColor, progress: number): RgbColor => {
  return {
    red: Math.round(startColor.red + (endColor.red - startColor.red) * progress),
    green: Math.round(startColor.green + (endColor.green - startColor.green) * progress),
    blue: Math.round(startColor.blue + (endColor.blue - startColor.blue) * progress)
  };
};

const drawCircle = (
  frame: Buffer,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radius: number,
  color: RgbColor,
  alpha: number
): void => {
  const roundedCenterX = Math.round(centerX);
  const roundedCenterY = Math.round(centerY);
  const radiusSquared = radius ** 2;

  for (let y = roundedCenterY - radius; y <= roundedCenterY + radius; y += 1) {
    for (let x = roundedCenterX - radius; x <= roundedCenterX + radius; x += 1) {
      if ((x - roundedCenterX) ** 2 + (y - roundedCenterY) ** 2 <= radiusSquared) {
        blendPixel(frame, width, height, x, y, color, alpha);
      }
    }
  }
};

const drawLine = (
  frame: Buffer,
  width: number,
  height: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  lineWidth: number,
  color: RgbColor,
  alpha: number
): void => {
  let x0 = Math.round(startX);
  let y0 = Math.round(startY);
  const x1 = Math.round(endX);
  const y1 = Math.round(endY);
  const deltaX = Math.abs(x1 - x0);
  const stepX = x0 < x1 ? 1 : -1;
  const deltaY = -Math.abs(y1 - y0);
  const stepY = y0 < y1 ? 1 : -1;
  let error = deltaX + deltaY;

  while (true) {
    drawLinePoint(frame, width, height, x0, y0, lineWidth, color, alpha);

    if (x0 === x1 && y0 === y1) {
      break;
    }

    const doubledError = 2 * error;

    if (doubledError >= deltaY) {
      error += deltaY;
      x0 += stepX;
    }

    if (doubledError <= deltaX) {
      error += deltaX;
      y0 += stepY;
    }
  }
};

const drawLinePoint = (
  frame: Buffer,
  width: number,
  height: number,
  x: number,
  y: number,
  lineWidth: number,
  color: RgbColor,
  alpha: number
): void => {
  if (lineWidth <= 1) {
    blendPixel(frame, width, height, x, y, color, alpha);
    return;
  }

  drawCircle(frame, width, height, x, y, Math.floor(lineWidth / 2), color, alpha);
};

const blendPixel = (frame: Buffer, width: number, height: number, x: number, y: number, color: RgbColor, alpha: number): void => {
  if (x < 0 || y < 0 || x >= width || y >= height || alpha <= 0) {
    return;
  }

  const bufferIndex = (y * width + x) * 3;
  frame[bufferIndex] = blendChannel(frame[bufferIndex] ?? 0, color.red, alpha);
  frame[bufferIndex + 1] = blendChannel(frame[bufferIndex + 1] ?? 0, color.green, alpha);
  frame[bufferIndex + 2] = blendChannel(frame[bufferIndex + 2] ?? 0, color.blue, alpha);
};

const blendChannel = (background: number, foreground: number, alpha: number): number => {
  return Math.round(background * (1 - alpha) + foreground * alpha);
};

const createCsvHeader = (markerCount: number): string => {
  const markerColumns = Array.from({ length: markerCount }, (_, markerIndex) => {
    const markerNumber = markerIndex + 1;
    return `marker_${markerNumber}_x,marker_${markerNumber}_y`;
  });

  return ["timestamp_seconds", "frame_index", ...markerColumns].join(",") + "\n";
};

const writeCsvRow = (
  csvStream: ReturnType<typeof createWriteStream>,
  frameIndex: number,
  fps: number,
  assignedTracks: Array<Detection | undefined>
): void => {
  const timestampSeconds = frameIndex / fps;
  const markerColumns = assignedTracks.flatMap((detection) => {
    if (detection === undefined) {
      return ["", ""];
    }

    return [detection.x.toFixed(2), detection.y.toFixed(2)];
  });

  csvStream.write([timestampSeconds.toFixed(6), String(frameIndex), ...markerColumns].join(",") + "\n");
};

const createOutputPaths = async (options: TrackOptions, stopSeconds?: number): Promise<OutputPaths> => {
  const inputBaseName = basename(options.inputPath, extname(options.inputPath));
  const timeLabel = `${formatTimeLabel(options.startSeconds)}-${formatTimeLabel(stopSeconds)}`;
  const outputBaseName = `${inputBaseName}_${timeLabel}`;
  const outputLocation = resolve(options.outputLocation);
  const looksLikeFilePrefix = extname(outputLocation) !== "";
  const outputDirectory = looksLikeFilePrefix ? dirname(outputLocation) : outputLocation;
  const outputPrefix = looksLikeFilePrefix ? outputLocation.slice(0, -extname(outputLocation).length) : join(outputDirectory, outputBaseName);

  await mkdir(outputDirectory, { recursive: true });

  return {
    csvPath: options.debugOneFrame === true ? undefined : `${outputPrefix}_markers.csv`,
    videoPath: options.debugOneFrame === true || options.videoMode === "none" ? undefined : `${outputPrefix}_${options.videoMode}.mp4`,
    debugFramePath:
      options.debugOneFrame === true && options.videoMode !== "none" ? `${outputPrefix}_${options.videoMode}_debug.png` : undefined
  };
};

const formatTimeLabel = (value?: number): string => {
  if (value === undefined) {
    return "end";
  }

  return value.toFixed(3).replace(/\./gu, "p");
};

const probeVideo = async (inputPath: string): Promise<VideoMetadata> => {
  const args = [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_streams",
    "-of",
    "json",
    inputPath
  ];
  const result = await runProcess(ffprobeStatic.path, args, "video probe");
  const parsedResult = JSON.parse(result.stdout) as {
    streams?: Array<{
      width?: number;
      height?: number;
      avg_frame_rate?: string;
      r_frame_rate?: string;
      duration?: string;
      tags?: {
        rotate?: string;
      };
      side_data_list?: Array<{
        rotation?: number;
      }>;
    }>;
  };
  const stream = parsedResult.streams?.[0];

  if (stream?.width === undefined || stream.height === undefined) {
    throw new Error(`Could not read video dimensions from ${inputPath}`);
  }

  const rotationDegrees = parseRotationDegrees(stream);
  const shouldSwapDimensions = rotationDegrees !== undefined && Math.abs(rotationDegrees) % 180 === 90;

  return {
    width: shouldSwapDimensions ? stream.height : stream.width,
    height: shouldSwapDimensions ? stream.width : stream.height,
    fps: parseFrameRate(stream.avg_frame_rate ?? stream.r_frame_rate ?? "30/1"),
    durationSeconds: stream.duration === undefined ? undefined : Number(stream.duration)
  };
};

const parseRotationDegrees = (stream: {
  tags?: {
    rotate?: string;
  };
  side_data_list?: Array<{
    rotation?: number;
  }>;
}): number | undefined => {
  const tagRotation = Number(stream.tags?.rotate);

  if (Number.isFinite(tagRotation)) {
    return tagRotation;
  }

  const sideDataRotation = stream.side_data_list?.find((sideData) => sideData.rotation !== undefined)?.rotation;

  if (sideDataRotation === undefined || !Number.isFinite(sideDataRotation)) {
    return undefined;
  }

  return -sideDataRotation;
};

const parseFrameRate = (value: string): number => {
  const [numeratorValue, denominatorValue] = value.split("/");
  const numerator = Number(numeratorValue);
  const denominator = Number(denominatorValue ?? "1");

  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    throw new Error(`Invalid video frame rate: ${value}`);
  }

  return numerator / denominator;
};

const createFrameReader = (
  inputPath: string,
  startSeconds: number,
  stopSeconds: number | undefined,
  metadata: VideoMetadata,
  expectedFrameCount?: number
) => {
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    String(startSeconds),
    "-i",
    inputPath
  ];

  if (stopSeconds !== undefined) {
    args.push("-t", String(stopSeconds - startSeconds));
  }

  args.push("-map", "0:v:0");

  if (expectedFrameCount !== undefined) {
    args.push("-frames:v", String(expectedFrameCount));
  }

  args.push("-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${metadata.width}x${metadata.height}`, "pipe:1");

  const process = spawn(ffmpegPath ?? "ffmpeg", args, {
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (process.stdout === null) {
    throw new Error("Could not open FFmpeg stdout");
  }

  collectProcessErrors(process, "frame extraction");

  return process as typeof process & { stdout: NonNullable<typeof process.stdout> };
};

type VideoWriter = ReturnType<typeof spawn> & {
  stdin: NonNullable<ReturnType<typeof spawn>["stdin"]>;
  expectedFrameSize: number;
  stderrChunks: Buffer[];
};

const createVideoWriter = (
  outputPath: string,
  width: number,
  height: number,
  fps: number,
  expectedFrameSize: number,
  expectedFrameCount?: number
) => {
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    "-s",
    `${width}x${height}`,
    "-r",
    String(fps),
    "-i",
    "pipe:0",
    "-an",
  ];

  if (expectedFrameCount !== undefined) {
    args.push("-frames:v", String(expectedFrameCount));
  }

  args.push(
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart"
  );

  args.push(outputPath);

  const process = spawn(
    ffmpegPath ?? "ffmpeg",
    args,
    {
      stdio: ["pipe", "ignore", "pipe"]
    }
  );

  if (process.stdin === null) {
    throw new Error("Could not open FFmpeg stdin");
  }

  const videoWriter = process as VideoWriter;
  videoWriter.stdin = process.stdin;
  videoWriter.expectedFrameSize = expectedFrameSize;
  videoWriter.stderrChunks = [];

  process.stderr?.on("data", (chunk: Buffer) => {
    videoWriter.stderrChunks.push(chunk);
  });

  return videoWriter;
};

const writeFrame = async (videoWriter: VideoWriter, frame: Buffer): Promise<void> => {
  if (frame.length !== videoWriter.expectedFrameSize) {
    throw new Error(
      `Rendered frame size mismatch: expected ${videoWriter.expectedFrameSize} bytes, received ${frame.length} bytes.`
    );
  }

  if (videoWriter.killed || videoWriter.exitCode !== null) {
    throw createVideoEncodingError(videoWriter, "FFmpeg encoder exited before the frame could be written.");
  }

  await new Promise<void>((resolvePromise, rejectPromise) => {
    videoWriter.stdin.write(frame, (error) => {
      if (error !== null && error !== undefined) {
        rejectPromise(createVideoEncodingError(videoWriter, error.message));
        return;
      }

      resolvePromise();
    });
  });
};

const finishVideoWriter = async (videoWriter: VideoWriter): Promise<void> => {
  if (!videoWriter.stdin.destroyed && videoWriter.stdin.writable) {
    videoWriter.stdin.end();
  }

  const writerExitCode = await waitForProcessWithTimeout(videoWriter, 120_000, "video encoding");

  if (writerExitCode !== 0) {
    throw createVideoEncodingError(videoWriter, `FFmpeg video encoding failed with exit code ${writerExitCode}`);
  }
};

const writePngFrame = async (outputPath: string, width: number, height: number, frame: Buffer): Promise<void> => {
  const expectedFrameSize = width * height * 3;

  if (frame.length !== expectedFrameSize) {
    throw new Error(`Rendered frame size mismatch: expected ${expectedFrameSize} bytes, received ${frame.length} bytes.`);
  }

  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    "-s",
    `${width}x${height}`,
    "-i",
    "pipe:0",
    "-frames:v",
    "1",
    outputPath
  ];
  const process = spawn(ffmpegPath ?? "ffmpeg", args, {
    stdio: ["pipe", "ignore", "pipe"]
  });
  const stderrChunks: Buffer[] = [];

  if (process.stdin === null) {
    throw new Error("Could not open FFmpeg stdin");
  }

  process.stderr?.on("data", (chunk: Buffer) => {
    stderrChunks.push(chunk);
  });

  await new Promise<void>((resolvePromise, rejectPromise) => {
    process.stdin?.write(frame, (error) => {
      if (error !== null && error !== undefined) {
        rejectPromise(error);
        return;
      }

      process.stdin?.end(resolvePromise);
    });
  });

  const exitCode = await waitForProcessWithTimeout(process, 120_000, "PNG encoding");

  if (exitCode !== 0) {
    throw new Error(`PNG encoding failed: ${Buffer.concat(stderrChunks).toString("utf8")}`);
  }
};

const stopChildProcess = async (childProcess: ReturnType<typeof spawn>, label: string): Promise<number | null> => {
  if (childProcess.stdout !== null && childProcess.stdout !== undefined && !childProcess.stdout.destroyed) {
    childProcess.stdout.destroy();
  }

  if (childProcess.stdin !== null && childProcess.stdin !== undefined && !childProcess.stdin.destroyed) {
    childProcess.stdin.destroy();
  }

  if (childProcess.exitCode === null && !childProcess.killed) {
    childProcess.kill("SIGTERM");
  }

  return waitForProcessWithTimeout(childProcess, 120_000, label);
};

const waitForProcessWithTimeout = async (
  childProcess: ReturnType<typeof spawn>,
  timeoutMs: number,
  label: string
): Promise<number | null> => {
  if (childProcess.exitCode !== null) {
    return childProcess.exitCode;
  }

  return new Promise<number | null>((resolvePromise, rejectPromise) => {
    const timeout = setTimeout(() => {
      if (!childProcess.killed) {
        childProcess.kill("SIGKILL");
      }

      rejectPromise(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    childProcess.once("close", (exitCode) => {
      clearTimeout(timeout);
      resolvePromise(exitCode);
    });

    childProcess.once("error", (error) => {
      clearTimeout(timeout);
      rejectPromise(error);
    });
  });
};

const createVideoEncodingError = (videoWriter: VideoWriter, message: string): Error => {
  const stderr = Buffer.concat(videoWriter.stderrChunks).toString("utf8").trim();

  if (stderr.length === 0) {
    return new Error(message);
  }

  return new Error(`${message}\n${stderr}`);
};

const runProcess = async (
  command: string,
  args: string[],
  label: string
): Promise<{
  stdout: string;
}> => {
  const process = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"]
  });
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];

  process.stdout.on("data", (chunk: Buffer) => {
    stdoutChunks.push(chunk);
  });

  process.stderr.on("data", (chunk: Buffer) => {
    stderrChunks.push(chunk);
  });

  const exitCode = await waitForProcess(process);

  if (exitCode !== 0) {
    throw new Error(`${label} failed: ${Buffer.concat(stderrChunks).toString("utf8")}`);
  }

  return {
    stdout: Buffer.concat(stdoutChunks).toString("utf8")
  };
};

const waitForProcess = async (process: ReturnType<typeof spawn>): Promise<number | null> => {
  const [exitCode] = (await once(process, "close")) as [number | null, NodeJS.Signals | null];

  if (exitCode !== 0 && exitCode !== null) {
    // Stderr is collected separately by callers; this keeps process wait errors contextual.
    return exitCode;
  }

  return exitCode;
};

const collectProcessErrors = (process: ReturnType<typeof spawn>, label: string): void => {
  const stderrChunks: Buffer[] = [];

  process.stderr?.on("data", (chunk: Buffer) => {
    stderrChunks.push(chunk);
  });

  process.on("error", (error) => {
    throw new Error(`${label} failed to start: ${error.message}`);
  });

  process.on("close", (exitCode) => {
    if (exitCode !== 0 && stderrChunks.length > 0) {
      process.emit("tracking-error", new Error(`${label} failed: ${Buffer.concat(stderrChunks).toString("utf8")}`));
    }
  });
};

const assertFfmpegAvailable = (): void => {
  if (ffmpegPath === null) {
    throw new Error("ffmpeg-static did not provide an FFmpeg binary for this platform.");
  }
};
