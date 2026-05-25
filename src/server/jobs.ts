import { randomUUID } from "node:crypto";
import { buildTrackOptions, type TrackSettingsInput } from "../track-options.js";
import { trackRetroMarkers, type TrackProgress, type TrackResult } from "../tracker.js";
import { resolveLayoutPath, resolveVideoPath } from "./videos.js";
import type { SafePathResolver } from "./safe-path.js";

export type JobStatus = "queued" | "running" | "completed" | "failed";

export type JobOutputUrls = {
  csvUrl?: string;
  videoUrl?: string;
  debugFrameUrl?: string;
};

export type TrackingJob = {
  jobId: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  videoId: string;
  settings: TrackSettingsInput;
  result?: TrackResult;
  progress?: TrackProgress;
  outputUrls?: JobOutputUrls;
  errorMessage?: string;
};

export type CreateJobRequest = {
  videoId: string;
  settings: Omit<TrackSettingsInput, "inputPath">;
};

type JobManagerDependencies = {
  videoPathResolver: SafePathResolver;
  outputPathResolver: SafePathResolver;
  layoutPathResolver: SafePathResolver;
};

export const resolveJobSettings = async (
  dependencies: JobManagerDependencies,
  videoId: string,
  requestSettings: Omit<TrackSettingsInput, "inputPath">
): Promise<TrackSettingsInput> => {
  const inputPath = await resolveVideoPath(dependencies.videoPathResolver, videoId);
  const settings: TrackSettingsInput = {
    ...requestSettings,
    inputPath,
    showProgress: false
  };

  if (settings.markersLayoutPath !== undefined && settings.markersLayoutPath.length > 0) {
    settings.markersLayoutPath = await resolveLayoutPath(dependencies.layoutPathResolver, settings.markersLayoutPath);
  }

  return settings;
};

export class JobManager {
  private readonly jobs = new Map<string, TrackingJob>();
  private readonly queue: string[] = [];
  private isProcessing = false;

  public constructor(private readonly dependencies: JobManagerDependencies) {}

  public listJobs(): TrackingJob[] {
    return [...this.jobs.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  public getJob(jobId: string): TrackingJob | undefined {
    return this.jobs.get(jobId);
  }

  public async createJob(request: CreateJobRequest): Promise<TrackingJob> {
    const settings = await resolveJobSettings(this.dependencies, request.videoId, request.settings);

    buildTrackOptions(settings);

    const job: TrackingJob = {
      jobId: randomUUID(),
      status: "queued",
      createdAt: new Date().toISOString(),
      videoId: request.videoId,
      settings
    };

    this.jobs.set(job.jobId, job);
    this.queue.push(job.jobId);
    void this.processQueue();

    return job;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const jobId = this.queue.shift();

      if (jobId === undefined) {
        continue;
      }

      const job = this.jobs.get(jobId);

      if (job === undefined) {
        continue;
      }

      await this.runJob(job);
    }

    this.isProcessing = false;
  }

  private async runJob(job: TrackingJob): Promise<void> {
    job.status = "running";
    job.startedAt = new Date().toISOString();

    try {
      const settings = { ...job.settings };

      settings.outputLocation = this.dependencies.outputPathResolver.rootDirectory;
      settings.showProgress = false;

      const trackOptions = buildTrackOptions(settings);
      trackOptions.onProgress = (progress) => {
        job.progress = progress;
      };
      const result = await trackRetroMarkers(trackOptions);

      job.status = "completed";
      job.completedAt = new Date().toISOString();
      job.result = result;
      job.progress = {
        framesProcessed: result.framesProcessed,
        totalFrames: result.framesProcessed,
        percent: 100
      };
      job.outputUrls = {
        csvUrl: result.csvPath === undefined ? undefined : this.toOutputUrl(result.csvPath),
        videoUrl: result.videoPath === undefined ? undefined : this.toOutputUrl(result.videoPath),
        debugFrameUrl:
          result.debugFramePath === undefined ? undefined : this.toOutputUrl(result.debugFramePath)
      };
    } catch (error) {
      job.status = "failed";
      job.completedAt = new Date().toISOString();
      job.errorMessage = error instanceof Error ? error.message : "Unknown processing error.";
    }
  }

  private toOutputUrl(absolutePath: string): string {
    const relativePath = this.dependencies.outputPathResolver.toRelativeUrlPath(absolutePath);

    return `/outputs/${relativePath}`;
  }
}
