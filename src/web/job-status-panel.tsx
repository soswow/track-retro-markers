import React from "react";
import type { TrackingJob } from "./types.js";
import { LinkRow, Panel, ProgressFill, ProgressTrack, StatusMessage, Title } from "./ui-components.js";

type JobStatusPanelProps = {
  activeJob: TrackingJob;
};

export const JobStatusPanel = ({ activeJob }: JobStatusPanelProps): JSX.Element => {
  const progressPercent =
    activeJob.progress?.percent === undefined ? undefined : Math.max(0, Math.min(100, activeJob.progress.percent));
  const phaseLabel =
    activeJob.progress?.phase === "finalizing"
      ? "Finalizing video"
      : activeJob.progress?.phase === "preparing"
        ? "Preparing"
        : undefined;
  const progressLabel =
    activeJob.progress === undefined
      ? "Waiting to start"
      : phaseLabel !== undefined
        ? `${phaseLabel} · ${activeJob.progress.totalFrames ?? "?"} frames total`
      : activeJob.progress.totalFrames === undefined
        ? `${activeJob.progress.framesProcessed} frames processed`
        : `${activeJob.progress.framesProcessed}/${activeJob.progress.totalFrames} frames`;

  return (
    <Panel>
      <Title>Job status</Title>
      <StatusMessage status={activeJob.status}>
        <strong>{activeJob.status}</strong>
        {activeJob.status === "running" || activeJob.status === "queued" ? ` · ${progressLabel}` : ""}
        {activeJob.errorMessage !== undefined ? ` · ${activeJob.errorMessage}` : ""}
        {activeJob.result !== undefined
          ? ` · ${activeJob.result.framesProcessed} frames · threshold ${activeJob.result.threshold}`
          : ""}
        {(activeJob.status === "running" || activeJob.status === "queued") && (
          <ProgressTrack>
            <ProgressFill $percent={progressPercent ?? 0} />
          </ProgressTrack>
        )}
      </StatusMessage>

      {activeJob.status === "completed" && (
        <LinkRow style={{ marginTop: "12px" }}>
          {activeJob.outputUrls?.csvUrl !== undefined && <a href={activeJob.outputUrls.csvUrl}>Download CSV</a>}
          {activeJob.outputUrls?.videoUrl !== undefined && (
            <a href={activeJob.outputUrls.videoUrl}>Open result video</a>
          )}
          {activeJob.outputUrls?.debugFrameUrl !== undefined && (
            <a href={activeJob.outputUrls.debugFrameUrl}>Open debug frame</a>
          )}
        </LinkRow>
      )}
    </Panel>
  );
};
