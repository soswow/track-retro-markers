type ProgressReporterOptions = {
  enabled: boolean;
  expectedFrameCount?: number;
  fps: number;
  startSeconds: number;
  stopSeconds?: number;
};

const PROGRESS_BAR_WIDTH = 24;
const MIN_UPDATE_INTERVAL_MS = 100;

export class ProgressReporter {
  private readonly enabled: boolean;
  private readonly isInteractive: boolean;
  private readonly expectedFrameCount?: number;
  private readonly fps: number;
  private readonly startSeconds: number;
  private readonly stopSeconds?: number;
  private lastRenderedPercent = -1;
  private lastUpdateTimestampMs = 0;

  public constructor(options: ProgressReporterOptions) {
    this.enabled = options.enabled;
    this.isInteractive = process.stderr.isTTY === true;
    this.expectedFrameCount = options.expectedFrameCount;
    this.fps = options.fps;
    this.startSeconds = options.startSeconds;
    this.stopSeconds = options.stopSeconds;
  }

  public report(frameIndex: number): void {
    if (!this.enabled) {
      return;
    }

    const nowMs = Date.now();

    if (!this.shouldUpdate(frameIndex, nowMs)) {
      return;
    }

    this.lastUpdateTimestampMs = nowMs;
    const message = this.formatMessage(frameIndex);

    if (this.isInteractive) {
      process.stderr.write(`\r${message}`);
      return;
    }

    const percent = this.getPercent(frameIndex);

    if (percent === undefined || percent - this.lastRenderedPercent >= 5 || this.isLastFrame(frameIndex)) {
      this.lastRenderedPercent = percent ?? this.lastRenderedPercent;
      process.stderr.write(`${message}\n`);
    }
  }

  public finish(frameIndex: number): void {
    if (!this.enabled) {
      return;
    }

    const message = this.formatMessage(frameIndex, true);

    if (this.isInteractive) {
      process.stderr.write(`\r${message}\n`);
      return;
    }

    if (this.lastRenderedPercent < 100) {
      process.stderr.write(`${message}\n`);
    }
  }

  public logStatus(message: string): void {
    if (!this.enabled) {
      return;
    }

    if (this.isInteractive) {
      process.stderr.write(`\r${message}\n`);
      return;
    }

    process.stderr.write(`${message}\n`);
  }

  private shouldUpdate(frameIndex: number, nowMs: number): boolean {
    if (frameIndex === 0) {
      return true;
    }

    if (this.isLastFrame(frameIndex)) {
      return true;
    }

    const percent = this.getPercent(frameIndex);

    if (percent !== undefined && percent !== this.lastRenderedPercent) {
      return nowMs - this.lastUpdateTimestampMs >= MIN_UPDATE_INTERVAL_MS;
    }

    return nowMs - this.lastUpdateTimestampMs >= 1000;
  }

  private isLastFrame(frameIndex: number): boolean {
    if (this.expectedFrameCount === undefined) {
      return false;
    }

    return frameIndex + 1 >= this.expectedFrameCount;
  }

  private formatMessage(frameIndex: number, isComplete = false): string {
    const processedFrames = frameIndex + 1;
    const percent = this.getPercent(frameIndex);
    const elapsedSeconds = processedFrames / this.fps;
    const totalSeconds = this.getTotalSeconds();
    const frameLabel =
      this.expectedFrameCount === undefined
        ? `frame ${processedFrames}`
        : `frame ${processedFrames}/${this.expectedFrameCount}`;
    const timeLabel =
      totalSeconds === undefined
        ? `${elapsedSeconds.toFixed(1)}s`
        : `${elapsedSeconds.toFixed(1)}s/${totalSeconds.toFixed(1)}s`;
    const percentLabel = percent === undefined ? "..." : `${percent.toFixed(1)}%`;
    const bar = this.renderBar(percent, isComplete);

    return `Processing ${bar} ${percentLabel} | ${frameLabel} | ${timeLabel}`;
  }

  private getPercent(frameIndex: number): number | undefined {
    if (this.expectedFrameCount === undefined || this.expectedFrameCount <= 0) {
      return undefined;
    }

    return Math.min(100, ((frameIndex + 1) / this.expectedFrameCount) * 100);
  }

  private getTotalSeconds(): number | undefined {
    if (this.stopSeconds !== undefined) {
      return this.stopSeconds - this.startSeconds;
    }

    if (this.expectedFrameCount === undefined) {
      return undefined;
    }

    return this.expectedFrameCount / this.fps;
  }

  private renderBar(percent: number | undefined, isComplete: boolean): string {
    if (percent === undefined) {
      return "|????????????????????????|";
    }

    const filledBlocks = isComplete
      ? PROGRESS_BAR_WIDTH
      : Math.round((percent / 100) * PROGRESS_BAR_WIDTH);
    const emptyBlocks = PROGRESS_BAR_WIDTH - filledBlocks;

    return `|${"█".repeat(filledBlocks)}${"░".repeat(emptyBlocks)}|`;
  }
}

export const estimateExpectedFrameCount = (
  startSeconds: number,
  stopSeconds: number | undefined,
  durationSeconds: number | undefined,
  fps: number
): number | undefined => {
  const clipDurationSeconds =
    stopSeconds !== undefined
      ? stopSeconds - startSeconds
      : durationSeconds !== undefined
        ? durationSeconds - startSeconds
        : undefined;

  if (clipDurationSeconds === undefined || clipDurationSeconds <= 0) {
    return undefined;
  }

  return Math.max(1, Math.round(clipDurationSeconds * fps));
};
