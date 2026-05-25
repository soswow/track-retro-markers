import React, { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  createJob,
  createPixelsPreview,
  fetchJob,
  fetchLayouts,
  fetchSettings,
  fetchUiSettings,
  fetchVideos,
  saveUiSettings
} from "./api-client.js";
import {
  createDefaultFormState,
  createRectangle,
  formatRectangle,
  parseRoiValue,
  parseUiTimeSeconds,
  type Point,
  type Rectangle
} from "./form-helpers.js";
import { JobStatusPanel } from "./job-status-panel.js";
import { PreviewPanel } from "./preview-panel.js";
import { TrackingOptions } from "./tracking-options.js";
import type { JobFormState, LayoutListItem, SettingsResponse, TrackingJob, VideoListItem } from "./types.js";
import { Content, Page, Panel, PreviewColumn, ResizeHandle, Subtitle, Title } from "./ui-components.js";
import { VideoSidebar } from "./video-sidebar.js";

type SettingsTab = "source" | "processing" | "display";
type PreviewTab = "input" | "output";

type FittedContentRect = {
  sourceWidth: number;
  sourceHeight: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

export const App = (): JSX.Element => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const roiOverlayRef = useRef<HTMLDivElement>(null);
  const roiDragStartRef = useRef<Point | null>(null);
  const hasLoadedInitialDataRef = useRef(false);

  const [videos, setVideos] = useState<VideoListItem[]>([]);
  const [layouts, setLayouts] = useState<LayoutListItem[]>([]);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [formState, setFormState] = useState<JobFormState | null>(null);
  const [currentTimeLabel, setCurrentTimeLabel] = useState("0");
  const [activeJob, setActiveJob] = useState<TrackingJob | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRoiDrawingEnabled, setIsRoiDrawingEnabled] = useState(false);
  const [roiDraftRectangle, setRoiDraftRectangle] = useState<Rectangle | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<PreviewTab>("input");
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("source");
  const [previewWidth, setPreviewWidth] = useState(420);
  const [previewHeight, setPreviewHeight] = useState(520);
  const [previewFrameSize, setPreviewFrameSize] = useState({ width: 0, height: 0 });
  const [thresholdPreviewUrl, setThresholdPreviewUrl] = useState<string>("");
  const [isThresholdPreviewLoading, setIsThresholdPreviewLoading] = useState(false);

  const selectedVideo = useMemo(() => {
    return videos.find((video) => video.id === selectedVideoId);
  }, [videos, selectedVideoId]);

  const isVerticalVideo = formState?.isVerticalVideo ?? false;

  const seekVideoToStartTime = useCallback(() => {
    const videoElement = videoRef.current;

    if (videoElement === null || formState === null || videoElement.readyState < HTMLMediaElement.HAVE_METADATA) {
      return;
    }

    const startSeconds = parseUiTimeSeconds(formState.startSeconds);

    if (startSeconds === undefined) {
      return;
    }

    const safeStartSeconds = Math.min(Math.max(startSeconds, 0), videoElement.duration || startSeconds);
    videoElement.currentTime = safeStartSeconds;
    setCurrentTimeLabel(safeStartSeconds.toFixed(3));
  }, [formState?.startSeconds]);

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [videoList, layoutList, settingsResponse, uiSettingsResponse] = await Promise.all([
        fetchVideos(),
        fetchLayouts(),
        fetchSettings(),
        fetchUiSettings()
      ]);

      setVideos(videoList);
      setLayouts(layoutList);
      setSettings(settingsResponse);
      setFormState(uiSettingsResponse.formState);

      const selectedVideoExists = videoList.some((video) => video.id === uiSettingsResponse.selectedVideoId);
      setSelectedVideoId(selectedVideoExists ? uiSettingsResponse.selectedVideoId : videoList[0]?.id ?? "");
      hasLoadedInitialDataRef.current = true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    seekVideoToStartTime();
  }, [seekVideoToStartTime, selectedVideoId]);

  useEffect(() => {
    if (!hasLoadedInitialDataRef.current || formState === null) {
      return;
    }

    const saveTimeout = window.setTimeout(() => {
      void saveUiSettings({
        selectedVideoId,
        isVerticalVideo: formState.isVerticalVideo,
        formState
      }).catch((error: unknown) => {
        setErrorMessage(error instanceof Error ? error.message : "Failed to save UI settings.");
      });
    }, 350);

    return () => {
      window.clearTimeout(saveTimeout);
    };
  }, [formState, selectedVideoId]);

  useEffect(() => {
    if (formState?.thresholdPreviewEnabled === true) {
      return;
    }

    setThresholdPreviewUrl("");
    setIsThresholdPreviewLoading(false);
  }, [formState?.thresholdPreviewEnabled]);

  useEffect(() => {
    if (activeJob?.status === "completed") {
      setActivePreviewTab("output");
    }
  }, [activeJob?.status]);

  const updatePreviewFrameSize = useCallback((): void => {
    const previewFrameElement = previewFrameRef.current;

    if (previewFrameElement === null) {
      return;
    }

    const bounds = previewFrameElement.getBoundingClientRect();

    setPreviewFrameSize({
      width: bounds.width,
      height: bounds.height
    });
  }, []);

  useEffect(() => {
    const previewFrameElement = previewFrameRef.current;

    if (previewFrameElement === null) {
      return;
    }

    const resizeObserver = new ResizeObserver(updatePreviewFrameSize);

    resizeObserver.observe(previewFrameElement);
    updatePreviewFrameSize();

    return () => {
      resizeObserver.disconnect();
    };
  }, [isVerticalVideo, previewHeight, previewWidth, selectedVideoId, updatePreviewFrameSize]);

  useEffect(() => {
    if (activePreviewTab !== "input") {
      return;
    }

    updatePreviewFrameSize();
    const frameId = window.requestAnimationFrame(() => {
      updatePreviewFrameSize();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [activePreviewTab, selectedVideoId, updatePreviewFrameSize]);

  useEffect(() => {
    if (activeJob === null) {
      return;
    }

    if (activeJob.status === "completed" || activeJob.status === "failed") {
      return;
    }

    const pollJob = (): void => {
      void fetchJob(activeJob.jobId)
        .then((updatedJob) => {
          setActiveJob(updatedJob);
        })
        .catch((error: unknown) => {
          setErrorMessage(error instanceof Error ? error.message : "Failed to poll job status.");
        });
    };

    pollJob();
    const pollInterval = window.setInterval(pollJob, 300);

    return () => {
      window.clearInterval(pollInterval);
    };
  }, [activeJob]);

  useEffect(() => {
    if (selectedVideoId.length === 0 || formState === null || !formState.thresholdPreviewEnabled) {
      return;
    }

    const threshold = Number(formState.threshold);

    if (!Number.isInteger(threshold) || threshold < 0 || threshold > 255) {
      return;
    }

    const previewTimeout = window.setTimeout(() => {
      setIsThresholdPreviewLoading(true);

      void createPixelsPreview(selectedVideoId, formState, Number(currentTimeLabel))
        .then((preview) => {
          setThresholdPreviewUrl(preview.imageUrl);
        })
        .catch((error: unknown) => {
          setErrorMessage(error instanceof Error ? error.message : "Failed to generate threshold preview.");
        })
        .finally(() => {
          setIsThresholdPreviewLoading(false);
        });
    }, 450);

    return () => {
      window.clearTimeout(previewTimeout);
    };
  }, [currentTimeLabel, formState, selectedVideoId]);

  const updateFormValue = <K extends keyof JobFormState>(fieldName: K, value: JobFormState[K]): void => {
    setFormState((previousState) => {
      if (previousState === null) {
        return previousState;
      }

      return {
        ...previousState,
        [fieldName]: value
      };
    });
  };

  const setTimeFromPlayer = (fieldName: "startSeconds" | "stopSeconds"): void => {
    const currentTime = videoRef.current?.currentTime ?? 0;

    updateFormValue(fieldName, currentTime.toFixed(3));
  };

  const getFittedContentRect = (): FittedContentRect | undefined => {
    const videoElement = videoRef.current;
    const sourceWidth =
      videoElement !== null && videoElement.videoWidth > 0 ? videoElement.videoWidth : selectedVideo?.width;
    const sourceHeight =
      videoElement !== null && videoElement.videoHeight > 0 ? videoElement.videoHeight : selectedVideo?.height;

    if (
      sourceWidth === undefined ||
      sourceHeight === undefined ||
      sourceWidth <= 0 ||
      sourceHeight <= 0 ||
      previewFrameSize.width <= 0 ||
      previewFrameSize.height <= 0
    ) {
      return undefined;
    }

    const fitScale = Math.min(previewFrameSize.width / sourceWidth, previewFrameSize.height / sourceHeight);
    const width = Math.floor(sourceWidth * fitScale);
    const height = Math.floor(sourceHeight * fitScale);

    return {
      sourceWidth,
      sourceHeight,
      left: Math.floor((previewFrameSize.width - width) / 2),
      top: Math.floor((previewFrameSize.height - height) / 2),
      width,
      height
    };
  };

  const getPointerVideoPoint = (event: PointerEvent<HTMLDivElement>): Point | undefined => {
    const contentRect = getFittedContentRect();

    if (contentRect === undefined) {
      return undefined;
    }

    const overlayBounds = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - overlayBounds.left - contentRect.left;
    const localY = event.clientY - overlayBounds.top - contentRect.top;
    const clampedX = Math.min(Math.max(localX, 0), contentRect.width);
    const clampedY = Math.min(Math.max(localY, 0), contentRect.height);

    return {
      x: (clampedX / contentRect.width) * contentRect.sourceWidth,
      y: (clampedY / contentRect.height) * contentRect.sourceHeight
    };
  };

  const getRoiOverlayStyle = (rectangle: Rectangle): React.CSSProperties => {
    const contentRect = getFittedContentRect();

    if (contentRect === undefined) {
      return {
        left: "0px",
        top: "0px",
        width: "0px",
        height: "0px"
      };
    }

    return {
      left: `${contentRect.left + (rectangle.left / contentRect.sourceWidth) * contentRect.width}px`,
      top: `${contentRect.top + (rectangle.top / contentRect.sourceHeight) * contentRect.height}px`,
      width: `${((rectangle.right - rectangle.left) / contentRect.sourceWidth) * contentRect.width}px`,
      height: `${((rectangle.bottom - rectangle.top) / contentRect.sourceHeight) * contentRect.height}px`
    };
  };

  const getFittedMediaStyle = (): React.CSSProperties => {
    const contentRect = getFittedContentRect();

    if (contentRect === undefined) {
      return {
        height: "100%",
        width: "100%"
      };
    }

    return {
      height: `${contentRect.height}px`,
      width: `${contentRect.width}px`
    };
  };

  const handleRoiPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (!isRoiDrawingEnabled) {
      return;
    }

    const pointerPoint = getPointerVideoPoint(event);

    if (pointerPoint === undefined) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    roiDragStartRef.current = pointerPoint;
    setRoiDraftRectangle(createRectangle(pointerPoint, pointerPoint));
  };

  const handleRoiPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const startPoint = roiDragStartRef.current;

    if (!isRoiDrawingEnabled || startPoint === null) {
      return;
    }

    const pointerPoint = getPointerVideoPoint(event);

    if (pointerPoint === undefined) {
      return;
    }

    setRoiDraftRectangle(createRectangle(startPoint, pointerPoint));
  };

  const handleRoiPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    const startPoint = roiDragStartRef.current;

    if (!isRoiDrawingEnabled || startPoint === null) {
      return;
    }

    const pointerPoint = getPointerVideoPoint(event);
    roiDragStartRef.current = null;

    if (pointerPoint === undefined) {
      setRoiDraftRectangle(null);
      return;
    }

    const nextRectangle = createRectangle(startPoint, pointerPoint);
    setRoiDraftRectangle(null);

    if (nextRectangle.right - nextRectangle.left < 2 || nextRectangle.bottom - nextRectangle.top < 2) {
      return;
    }

    updateFormValue("roi", formatRectangle(nextRectangle));
    setIsRoiDrawingEnabled(false);
  };

  const startPreviewResize = (event: PointerEvent<HTMLDivElement>): void => {
    event.preventDefault();

    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = previewWidth;
    const startHeight = previewHeight;
    const isVerticalLayout = isVerticalVideo;

    const handlePointerMove = (pointerEvent: globalThis.PointerEvent): void => {
      if (isVerticalLayout) {
        const nextWidth = Math.min(760, Math.max(300, startWidth + pointerEvent.clientX - startX));
        setPreviewWidth(nextWidth);
        return;
      }

      const nextHeight = Math.min(900, Math.max(260, startHeight + pointerEvent.clientY - startY));
      setPreviewHeight(nextHeight);
    };

    const handlePointerUp = (): void => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const stepVideoFrames = (frameCount: number): void => {
    const videoElement = videoRef.current;

    if (videoElement === null || selectedVideo === undefined) {
      return;
    }

    const framesPerSecond =
      selectedVideo.fps !== undefined && Number.isFinite(selectedVideo.fps) && selectedVideo.fps > 0
        ? selectedVideo.fps
        : 30;
    const nextTime = videoElement.currentTime + frameCount / framesPerSecond;
    const maxTime = Number.isFinite(videoElement.duration) ? videoElement.duration : nextTime;
    const safeNextTime = Math.min(Math.max(nextTime, 0), maxTime);

    videoElement.pause();
    videoElement.currentTime = safeNextTime;
    setCurrentTimeLabel(safeNextTime.toFixed(3));
  };

  const handleSubmitJob = async (): Promise<void> => {
    if (selectedVideoId.length === 0 || formState === null) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const createdJob = await createJob(selectedVideoId, formState);
      setActiveJob(createdJob);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to start job.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || formState === null || settings === null) {
    return (
      <Page $isVerticalVideo={false} $previewWidth={previewWidth}>
        <Content>
          <Panel>
            <Title>Track Retro Markers</Title>
            <Subtitle>Loading videos and settings...</Subtitle>
          </Panel>
        </Content>
      </Page>
    );
  }

  const persistedRoiRectangle = parseRoiValue(formState.roi);
  const visibleRoiRectangle = roiDraftRectangle ?? persistedRoiRectangle;
  const previewPanel = (
    <PreviewPanel
      activeJob={activeJob}
      activePreviewTab={activePreviewTab}
      formState={formState}
      getFittedMediaStyle={getFittedMediaStyle}
      getRoiOverlayStyle={getRoiOverlayStyle}
      isRoiDrawingEnabled={isRoiDrawingEnabled}
      isThresholdPreviewLoading={isThresholdPreviewLoading}
      isVerticalVideo={isVerticalVideo}
      previewFrameRef={previewFrameRef}
      previewHeight={previewHeight}
      roiOverlayRef={roiOverlayRef}
      selectedVideo={selectedVideo}
      thresholdPreviewUrl={thresholdPreviewUrl}
      videoRef={videoRef}
      visibleRoiRectangle={visibleRoiRectangle}
      onCurrentTimeChange={setCurrentTimeLabel}
      onPreviewTabChange={setActivePreviewTab}
      onRoiPointerDown={handleRoiPointerDown}
      onRoiPointerMove={handleRoiPointerMove}
      onRoiPointerUp={handleRoiPointerUp}
      onStepFrames={stepVideoFrames}
      onVerticalVideoChange={(nextIsVerticalVideo) => {
        updateFormValue("isVerticalVideo", nextIsVerticalVideo);
      }}
      onVideoMetadataLoaded={() => {
        setRoiDraftRectangle(null);
        seekVideoToStartTime();
        updatePreviewFrameSize();
      }}
    />
  );

  return (
    <Page $isVerticalVideo={isVerticalVideo} $previewWidth={previewWidth}>
      <VideoSidebar selectedVideoId={selectedVideoId} videos={videos} onSelectVideo={setSelectedVideoId} />

      {isVerticalVideo && <PreviewColumn>{previewPanel}</PreviewColumn>}
      {isVerticalVideo && (
        <ResizeHandle
          $orientation="vertical"
          aria-label="Resize preview"
          onPointerDown={startPreviewResize}
          role="separator"
          title="Resize preview"
        />
      )}

      <Content>
        {!isVerticalVideo && previewPanel}
        {!isVerticalVideo && (
          <ResizeHandle
            $orientation="horizontal"
            aria-label="Resize preview"
            onPointerDown={startPreviewResize}
            role="separator"
            title="Resize preview"
          />
        )}

        <TrackingOptions
          activeSettingsTab={activeSettingsTab}
          errorMessage={errorMessage}
          formState={formState}
          isRoiDrawingEnabled={isRoiDrawingEnabled}
          isSubmitting={isSubmitting}
          layouts={layouts}
          selectedVideoId={selectedVideoId}
          settings={settings}
          onClearRoi={() => {
            setRoiDraftRectangle(null);
            updateFormValue("roi", "");
          }}
          onResetOptions={() => {
            setFormState(createDefaultFormState(settings));
          }}
          onRunTracking={() => {
            void handleSubmitJob();
          }}
          onSetActiveSettingsTab={setActiveSettingsTab}
          onSetTimeFromPlayer={setTimeFromPlayer}
          onThresholdPreviewReset={() => {
            setThresholdPreviewUrl("");
          }}
          onToggleRoiDrawing={() => {
            setIsRoiDrawingEnabled((previousValue) => !previousValue);
          }}
          onUpdateFormValue={updateFormValue}
        />

        {activeJob !== null && <JobStatusPanel activeJob={activeJob} />}
      </Content>
    </Page>
  );
};
