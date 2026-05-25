import React, { type PointerEvent, type RefObject } from "react";
import type { Rectangle } from "./form-helpers.js";
import type { JobFormState, TrackingJob, VideoListItem } from "./types.js";
import {
  CheckboxField,
  OutputPreviewLayer,
  Panel,
  PanelHeader,
  PreviewImage,
  PreviewPlaceholder,
  ResultImage,
  ResultVideo,
  RoiBox,
  RoiOverlay,
  SecondaryButton,
  TabBody,
  TabButton,
  TabList,
  ThresholdPreviewLayer,
  TimeControls,
  Title,
  VideoPlayer,
  VideoPreviewFrame
} from "./ui-components.js";

type PreviewPanelProps = {
  activeJob: TrackingJob | null;
  activePreviewTab: "input" | "output";
  formState: JobFormState;
  isRoiDrawingEnabled: boolean;
  isThresholdPreviewLoading: boolean;
  isVerticalVideo: boolean;
  previewFrameRef: RefObject<HTMLDivElement>;
  previewHeight: number;
  roiOverlayRef: RefObject<HTMLDivElement>;
  selectedVideo: VideoListItem | undefined;
  thresholdPreviewUrl: string;
  videoRef: RefObject<HTMLVideoElement>;
  visibleRoiRectangle: Rectangle | undefined;
  getFittedMediaStyle: () => React.CSSProperties;
  getRoiOverlayStyle: (rectangle: Rectangle) => React.CSSProperties;
  onCurrentTimeChange: (currentTimeLabel: string) => void;
  onPreviewTabChange: (tab: "input" | "output") => void;
  onRoiPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onRoiPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onRoiPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onStepFrames: (frameCount: number) => void;
  onVideoMetadataLoaded: () => void;
  onVerticalVideoChange: (isVerticalVideo: boolean) => void;
};

export const PreviewPanel = ({
  activeJob,
  activePreviewTab,
  formState,
  getFittedMediaStyle,
  getRoiOverlayStyle,
  isRoiDrawingEnabled,
  isThresholdPreviewLoading,
  isVerticalVideo,
  onCurrentTimeChange,
  onPreviewTabChange,
  onRoiPointerDown,
  onRoiPointerMove,
  onRoiPointerUp,
  onStepFrames,
  onVideoMetadataLoaded,
  onVerticalVideoChange,
  previewFrameRef,
  previewHeight,
  roiOverlayRef,
  selectedVideo,
  thresholdPreviewUrl,
  videoRef,
  visibleRoiRectangle
}: PreviewPanelProps): JSX.Element => {
  return (
    <Panel>
      <PanelHeader>
        <div>
          <Title>Preview</Title>
        </div>
        <CheckboxField>
          <input
            checked={isVerticalVideo}
            type="checkbox"
            onChange={(event) => {
              onVerticalVideoChange(event.target.checked);
            }}
          />
          Is vertical video
        </CheckboxField>
      </PanelHeader>
      <TabList>
        <TabButton
          isSelected={activePreviewTab === "input"}
          type="button"
          onClick={() => {
            onPreviewTabChange("input");
          }}
        >
          Input
        </TabButton>
        <TabButton
          isSelected={activePreviewTab === "output"}
          type="button"
          onClick={() => {
            onPreviewTabChange("output");
          }}
        >
          Output
        </TabButton>
      </TabList>
      <TabBody>
        <VideoPreviewFrame
          ref={previewFrameRef}
          style={{
            height: isVerticalVideo ? "calc(100vh - 220px)" : `${previewHeight}px`
          }}
        >
          {selectedVideo !== undefined && (
            <>
              <VideoPlayer
                ref={videoRef}
                controls
                src={selectedVideo.mediaUrl}
                style={{
                  ...getFittedMediaStyle(),
                  display: activePreviewTab === "input" ? "block" : "none",
                  visibility: formState.thresholdPreviewEnabled ? "hidden" : "visible"
                }}
                onLoadedMetadata={onVideoMetadataLoaded}
                onTimeUpdate={() => {
                  onCurrentTimeChange((videoRef.current?.currentTime ?? 0).toFixed(3));
                }}
              />
              {activePreviewTab === "input" && formState.thresholdPreviewEnabled && (
                <ThresholdPreviewLayer>
                  {thresholdPreviewUrl.length > 0 && (
                    <PreviewImage alt="Threshold pixels preview" src={thresholdPreviewUrl} style={getFittedMediaStyle()} />
                  )}
                  {thresholdPreviewUrl.length === 0 && (
                    <PreviewPlaceholder>
                      {isThresholdPreviewLoading
                        ? "Generating pixels preview..."
                        : "Enable preview to show threshold pixels"}
                    </PreviewPlaceholder>
                  )}
                </ThresholdPreviewLayer>
              )}
              {activePreviewTab === "input" && !formState.thresholdPreviewEnabled && (
                <RoiOverlay
                  ref={roiOverlayRef}
                  isDrawingEnabled={isRoiDrawingEnabled}
                  onPointerDown={onRoiPointerDown}
                  onPointerMove={onRoiPointerMove}
                  onPointerUp={onRoiPointerUp}
                >
                  {visibleRoiRectangle !== undefined && <RoiBox style={getRoiOverlayStyle(visibleRoiRectangle)} />}
                </RoiOverlay>
              )}
            </>
          )}
          {activePreviewTab === "output" && (
            <OutputPreviewLayer>
              {activeJob?.status === "completed" && activeJob.outputUrls?.videoUrl !== undefined && (
                <ResultVideo controls src={activeJob.outputUrls.videoUrl} style={getFittedMediaStyle()} />
              )}
              {activeJob?.status === "completed" &&
                activeJob.outputUrls?.videoUrl === undefined &&
                activeJob.outputUrls?.debugFrameUrl !== undefined && (
                  <ResultImage alt="Debug frame" src={activeJob.outputUrls.debugFrameUrl} style={getFittedMediaStyle()} />
                )}
              {(activeJob === null || activeJob.status !== "completed") && (
                <PreviewPlaceholder>Run tracking to view the result here</PreviewPlaceholder>
              )}
              {activeJob?.status === "completed" &&
                activeJob.outputUrls?.videoUrl === undefined &&
                activeJob.outputUrls?.debugFrameUrl === undefined && (
                  <PreviewPlaceholder>No visual output was generated for this job</PreviewPlaceholder>
                )}
            </OutputPreviewLayer>
          )}
        </VideoPreviewFrame>
        {activePreviewTab === "input" && selectedVideo !== undefined && (
          <TimeControls style={{ marginTop: "12px" }}>
            <SecondaryButton
              type="button"
              onClick={() => {
                onStepFrames(-10);
              }}
            >
              {"<<"}
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={() => {
                onStepFrames(-1);
              }}
            >
              {"<"}
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={() => {
                onStepFrames(1);
              }}
            >
              {">"}
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={() => {
                onStepFrames(10);
              }}
            >
              {">>"}
            </SecondaryButton>
          </TimeControls>
        )}
      </TabBody>
    </Panel>
  );
};
