import React from "react";
import type { SettingsResponse, JobFormState, LayoutListItem } from "./types.js";
import type { VideoMode } from "../track-options.js";
import {
  ActionButton,
  CheckboxField,
  CheckboxList,
  ErrorText,
  Field,
  FieldInput,
  FieldLabelText,
  FieldSelect,
  InfoTooltip,
  OptionsGrid,
  Panel,
  SecondaryButton,
  SliderRow,
  TabBody,
  TabButton,
  TabList,
  TimeControls,
  Title
} from "./ui-components.js";
import { parseRoiValue } from "./form-helpers.js";

type SettingsTab = "source" | "processing" | "display";

const fieldDescriptions = {
  startSeconds: "Start processing from this time. Accepts seconds or hh:mm:ss.sss.",
  stopSeconds: "Stop processing at this time. Leave empty to process to the end of the video.",
  roi: "Limit detection to a rectangular region of interest: left,top,right,bottom.",
  markersLayoutPath: "Use a marker layout file to assign detected points to named markers.",
  threshold: "Brightness threshold for marker pixels. Lower values include more pixels; higher values are stricter.",
  thresholdPreviewEnabled: "Show a one-frame preview of pixels selected by the current threshold and processing settings.",
  minArea: "Smallest connected bright region, in pixels, that can be treated as a marker.",
  maxArea: "Largest connected bright region, in pixels, that can be treated as a marker.",
  mergeDistance: "Merge nearby bright regions before calculating marker centers.",
  maxTrackDistance: "Maximum frame-to-frame distance allowed when matching a marker to its previous position.",
  searchRadius: "Local search radius around an existing track after the first frame.",
  localThresholdMin: "Lowest automatic threshold allowed while searching around an existing track.",
  layoutFitTolerance: "Maximum distance allowed when fitting detections to the selected marker layout.",
  videoMode: "Choose the generated video style: overlay, trails, points, pixels, copy, or none.",
  color: "Marker color used for point and overlay rendering.",
  colorStart: "Starting trail color. Leave empty to use the marker color.",
  colorEnd: "Ending trail color. Leave empty to use the marker color.",
  circleRadius: "Radius, in pixels, for rendered marker circles.",
  trailLineWidth: "Width, in pixels, for rendered trail lines.",
  trailSeconds: "How many seconds of marker movement remain visible in trail modes.",
  trailMarkers: "Select named markers to draw trails for. Leave empty to draw trails for all markers.",
  csvExportMarkers: "Select named markers to include in the CSV export. Leave empty to export all markers.",
  includeCsvDiffColumns: "Add diff_ x/y CSV columns for each exported marker, measured from that marker's first exported value.",
  useLayoutUnits: "Scale CSV coordinates into the selected marker layout units and include the per-frame scale.",
  trackLocalYAxisAngle:
    "Add a CSV column for the local Y-axis angle in image coordinates. Requires a layout with isLocalOrigin and isLocalXAxis.",
  labelMarkers: "Draw marker names next to tracked markers in the output video.",
  cropToRoi: "Crop the rendered output video to the region of interest.",
  debugOneFrame: "Process a single frame and write a debug image instead of a full output video."
} satisfies Record<string, string>;

type LabelWithInfoProps = {
  children: React.ReactNode;
  description: string;
};

const LabelWithInfo = ({ children, description }: LabelWithInfoProps): JSX.Element => (
  <FieldLabelText>
    {children}
    <InfoTooltip
      aria-label={`Info: ${description}`}
      data-description={description}
      tabIndex={0}
    >
      i
    </InfoTooltip>
  </FieldLabelText>
);

type TrackingOptionsProps = {
  activeSettingsTab: SettingsTab;
  errorMessage: string;
  formState: JobFormState;
  isRoiDrawingEnabled: boolean;
  isSubmitting: boolean;
  layouts: LayoutListItem[];
  selectedVideoId: string;
  settings: SettingsResponse;
  onClearRoi: () => void;
  onResetOptions: () => void;
  onRunTracking: () => void;
  onSetActiveSettingsTab: (tab: SettingsTab) => void;
  onSetTimeFromPlayer: (fieldName: "startSeconds" | "stopSeconds") => void;
  onThresholdPreviewReset: () => void;
  onToggleRoiDrawing: () => void;
  onUpdateFormValue: <K extends keyof JobFormState>(fieldName: K, value: JobFormState[K]) => void;
};

export const TrackingOptions = ({
  activeSettingsTab,
  errorMessage,
  formState,
  isRoiDrawingEnabled,
  isSubmitting,
  layouts,
  onClearRoi,
  onResetOptions,
  onRunTracking,
  onSetActiveSettingsTab,
  onSetTimeFromPlayer,
  onThresholdPreviewReset,
  onToggleRoiDrawing,
  onUpdateFormValue,
  selectedVideoId,
  settings
}: TrackingOptionsProps): JSX.Element => {
  const selectedLayout = layouts.find((layout) => layout.fileName === formState.markersLayoutPath);
  const selectedTrailMarkers = formState.trailMarkers
    .split(",")
    .map((markerName) => markerName.trim())
    .filter((markerName) => markerName.length > 0);
  const selectedCsvExportMarkers = formState.csvExportMarkers
    .split(",")
    .map((markerName) => markerName.trim())
    .filter((markerName) => markerName.length > 0);
  const isTrailMarkersDisabled = selectedLayout === undefined || selectedLayout.markerNames.length === 0;
  const isCsvExportMarkersDisabled = selectedLayout === undefined || selectedLayout.markerNames.length === 0;
  const hasValidRoi = parseRoiValue(formState.roi) !== undefined;

  return (
    <Panel>
      <Title>Tracking options</Title>
      <TabList>
        <TabButton
          isSelected={activeSettingsTab === "source"}
          type="button"
          onClick={() => {
            onSetActiveSettingsTab("source");
          }}
        >
          Source
        </TabButton>
        <TabButton
          isSelected={activeSettingsTab === "processing"}
          type="button"
          onClick={() => {
            onSetActiveSettingsTab("processing");
          }}
        >
          Processing
        </TabButton>
        <TabButton
          isSelected={activeSettingsTab === "display"}
          type="button"
          onClick={() => {
            onSetActiveSettingsTab("display");
          }}
        >
          Display
        </TabButton>
      </TabList>

      <TabBody>
        {activeSettingsTab === "source" && (
          <>
            <TimeControls data-testid="time-controls" style={{ marginTop: "16px" }}>
              <SecondaryButton
                type="button"
                onClick={() => {
                  onSetTimeFromPlayer("startSeconds");
                }}
              >
                Set start from playhead
              </SecondaryButton>
              <SecondaryButton
                type="button"
                onClick={() => {
                  onSetTimeFromPlayer("stopSeconds");
                }}
              >
                Set stop from playhead
              </SecondaryButton>
            </TimeControls>

            <OptionsGrid style={{ marginTop: "16px" }}>
              <Field>
                <LabelWithInfo description={fieldDescriptions.startSeconds}>Start time</LabelWithInfo>
                <FieldInput
                  value={formState.startSeconds}
                  onChange={(event) => {
                    onUpdateFormValue("startSeconds", event.target.value);
                  }}
                />
              </Field>
              <Field>
                <LabelWithInfo description={fieldDescriptions.stopSeconds}>Stop time</LabelWithInfo>
                <FieldInput
                  value={formState.stopSeconds}
                  placeholder="end of video"
                  onChange={(event) => {
                    onUpdateFormValue("stopSeconds", event.target.value);
                  }}
                />
              </Field>
            </OptionsGrid>

            <TimeControls data-testid="time-controls" style={{ marginTop: "16px" }}>
              <SecondaryButton type="button" onClick={onToggleRoiDrawing}>
                {isRoiDrawingEnabled ? "Cancel ROI drawing" : "Draw ROI"}
              </SecondaryButton>
              <SecondaryButton type="button" onClick={onClearRoi}>
                Clear ROI
              </SecondaryButton>
            </TimeControls>
            <OptionsGrid style={{ marginTop: "16px" }}>
              <Field>
                <LabelWithInfo description={fieldDescriptions.roi}>ROI</LabelWithInfo>
                <FieldInput
                  value={formState.roi}
                  placeholder="left,top,right,bottom"
                  onChange={(event) => {
                    onUpdateFormValue("roi", event.target.value);
                  }}
                />
              </Field>
            </OptionsGrid>
            <OptionsGrid style={{ marginTop: "16px" }}>
              <Field>
                <LabelWithInfo description={fieldDescriptions.markersLayoutPath}>Marker layout</LabelWithInfo>
                <FieldSelect
                  value={formState.markersLayoutPath}
                  onChange={(event) => {
                    const nextMarkersLayoutPath = event.target.value;

                    onUpdateFormValue("markersLayoutPath", nextMarkersLayoutPath);
                    onUpdateFormValue("trailMarkers", "");
                    onUpdateFormValue("csvExportMarkers", "");
                    if (nextMarkersLayoutPath.length === 0) {
                      onUpdateFormValue("useLayoutUnits", false);
                      onUpdateFormValue("trackLocalYAxisAngle", false);
                    }
                  }}
                >
                  <option value="">None</option>
                  {layouts.map((layout) => (
                    <option key={layout.fileName} value={layout.fileName}>
                      {layout.fileName}
                    </option>
                  ))}
                </FieldSelect>
              </Field>
            </OptionsGrid>
          </>
        )}

        {activeSettingsTab === "processing" && (
          <OptionsGrid>
            <Field>
              <LabelWithInfo description={fieldDescriptions.threshold}>Threshold: {formState.threshold}</LabelWithInfo>
              <SliderRow>
                <input
                  max="255"
                  min="0"
                  type="range"
                  value={formState.threshold}
                  onChange={(event) => {
                    onUpdateFormValue("threshold", event.target.value);
                  }}
                />
                <FieldInput
                  max="255"
                  min="0"
                  type="number"
                  value={formState.threshold}
                  onChange={(event) => {
                    onUpdateFormValue("threshold", event.target.value);
                  }}
                />
              </SliderRow>
              <CheckboxField>
                <input
                  checked={formState.thresholdPreviewEnabled}
                  type="checkbox"
                  onChange={(event) => {
                    onThresholdPreviewReset();
                    onUpdateFormValue("thresholdPreviewEnabled", event.target.checked);
                  }}
                />
                <LabelWithInfo description={fieldDescriptions.thresholdPreviewEnabled}>Preview threshold pixels</LabelWithInfo>
              </CheckboxField>
            </Field>
            <Field>
              <LabelWithInfo description={fieldDescriptions.minArea}>Min area</LabelWithInfo>
              <FieldInput
                value={formState.minArea}
                onChange={(event) => {
                  onUpdateFormValue("minArea", event.target.value);
                }}
              />
            </Field>
            <Field>
              <LabelWithInfo description={fieldDescriptions.maxArea}>Max area</LabelWithInfo>
              <FieldInput
                value={formState.maxArea}
                onChange={(event) => {
                  onUpdateFormValue("maxArea", event.target.value);
                }}
              />
            </Field>
            <Field>
              <LabelWithInfo description={fieldDescriptions.mergeDistance}>Merge distance</LabelWithInfo>
              <FieldInput
                value={formState.mergeDistance}
                onChange={(event) => {
                  onUpdateFormValue("mergeDistance", event.target.value);
                }}
              />
            </Field>
            <Field>
              <LabelWithInfo description={fieldDescriptions.maxTrackDistance}>Max track distance</LabelWithInfo>
              <FieldInput
                value={formState.maxTrackDistance}
                onChange={(event) => {
                  onUpdateFormValue("maxTrackDistance", event.target.value);
                }}
              />
            </Field>
            <Field>
              <LabelWithInfo description={fieldDescriptions.searchRadius}>Search radius</LabelWithInfo>
              <FieldInput
                value={formState.searchRadius}
                onChange={(event) => {
                  onUpdateFormValue("searchRadius", event.target.value);
                }}
              />
            </Field>
            <Field>
              <LabelWithInfo description={fieldDescriptions.localThresholdMin}>Local threshold min</LabelWithInfo>
              <FieldInput
                value={formState.localThresholdMin}
                onChange={(event) => {
                  onUpdateFormValue("localThresholdMin", event.target.value);
                }}
              />
            </Field>
            <Field>
              <LabelWithInfo description={fieldDescriptions.layoutFitTolerance}>Layout fit tolerance</LabelWithInfo>
              <FieldInput
                value={formState.layoutFitTolerance}
                onChange={(event) => {
                  onUpdateFormValue("layoutFitTolerance", event.target.value);
                }}
              />
            </Field>
          </OptionsGrid>
        )}

        {activeSettingsTab === "display" && (
          <>
            <OptionsGrid>
              <Field>
                <LabelWithInfo description={fieldDescriptions.videoMode}>Video mode</LabelWithInfo>
                <FieldSelect
                  value={formState.videoMode}
                  onChange={(event) => {
                    onUpdateFormValue("videoMode", event.target.value as VideoMode);
                  }}
                >
                  {settings.videoModes.map((videoMode) => (
                    <option key={videoMode} value={videoMode}>
                      {videoMode}
                    </option>
                  ))}
                </FieldSelect>
              </Field>
              <Field>
                <LabelWithInfo description={fieldDescriptions.color}>Color</LabelWithInfo>
                <FieldInput
                  value={formState.color}
                  onChange={(event) => {
                    onUpdateFormValue("color", event.target.value);
                  }}
                />
              </Field>
              <Field>
                <LabelWithInfo description={fieldDescriptions.colorStart}>Color start</LabelWithInfo>
                <FieldInput
                  value={formState.colorStart}
                  placeholder="defaults to color"
                  onChange={(event) => {
                    onUpdateFormValue("colorStart", event.target.value);
                  }}
                />
              </Field>
              <Field>
                <LabelWithInfo description={fieldDescriptions.colorEnd}>Color end</LabelWithInfo>
                <FieldInput
                  value={formState.colorEnd}
                  placeholder="defaults to color"
                  onChange={(event) => {
                    onUpdateFormValue("colorEnd", event.target.value);
                  }}
                />
              </Field>
              <Field>
                <LabelWithInfo description={fieldDescriptions.circleRadius}>Circle radius</LabelWithInfo>
                <FieldInput
                  value={formState.circleRadius}
                  onChange={(event) => {
                    onUpdateFormValue("circleRadius", event.target.value);
                  }}
                />
              </Field>
              <Field>
                <LabelWithInfo description={fieldDescriptions.trailLineWidth}>Trail line width</LabelWithInfo>
                <FieldInput
                  value={formState.trailLineWidth}
                  onChange={(event) => {
                    onUpdateFormValue("trailLineWidth", event.target.value);
                  }}
                />
              </Field>
              <Field>
                <LabelWithInfo description={fieldDescriptions.trailSeconds}>Trail seconds</LabelWithInfo>
                <FieldInput
                  value={formState.trailSeconds}
                  onChange={(event) => {
                    onUpdateFormValue("trailSeconds", event.target.value);
                  }}
                />
              </Field>
              <Field>
                <LabelWithInfo description={fieldDescriptions.trailMarkers}>Trail markers</LabelWithInfo>
                <FieldSelect
                  disabled={isTrailMarkersDisabled}
                  multiple
                  value={selectedTrailMarkers}
                  onChange={(event) => {
                    const nextTrailMarkers = Array.from(event.target.selectedOptions, (option) => option.value);

                    onUpdateFormValue("trailMarkers", nextTrailMarkers.join(", "));
                  }}
                >
                  {selectedLayout?.markerNames.map((markerName) => (
                    <option key={markerName} value={markerName}>
                      {markerName}
                    </option>
                  ))}
                </FieldSelect>
              </Field>
              <Field>
                <LabelWithInfo description={fieldDescriptions.csvExportMarkers}>CSV Export markers</LabelWithInfo>
                <FieldSelect
                  disabled={isCsvExportMarkersDisabled}
                  multiple
                  value={selectedCsvExportMarkers}
                  onChange={(event) => {
                    const nextCsvExportMarkers = Array.from(event.target.selectedOptions, (option) => option.value);

                    onUpdateFormValue("csvExportMarkers", nextCsvExportMarkers.join(", "));
                  }}
                >
                  {selectedLayout?.markerNames.map((markerName) => (
                    <option key={markerName} value={markerName}>
                      {markerName}
                    </option>
                  ))}
                </FieldSelect>
              </Field>
            </OptionsGrid>
            <CheckboxList style={{ marginTop: "12px" }}>
              <CheckboxField>
                <input
                  checked={formState.includeCsvDiffColumns}
                  type="checkbox"
                  onChange={(event) => {
                    onUpdateFormValue("includeCsvDiffColumns", event.target.checked);
                  }}
                />
                <LabelWithInfo description={fieldDescriptions.includeCsvDiffColumns}>Include CSV diff columns</LabelWithInfo>
              </CheckboxField>
              <CheckboxField>
                <input
                  checked={selectedLayout !== undefined && formState.useLayoutUnits}
                  disabled={selectedLayout === undefined}
                  type="checkbox"
                  onChange={(event) => {
                    onUpdateFormValue("useLayoutUnits", event.target.checked);
                  }}
                />
                <LabelWithInfo description={fieldDescriptions.useLayoutUnits}>Use Layout units</LabelWithInfo>
              </CheckboxField>
              <CheckboxField>
                <input
                  checked={selectedLayout !== undefined && formState.trackLocalYAxisAngle}
                  disabled={selectedLayout === undefined}
                  type="checkbox"
                  onChange={(event) => {
                    onUpdateFormValue("trackLocalYAxisAngle", event.target.checked);
                  }}
                />
                <LabelWithInfo description={fieldDescriptions.trackLocalYAxisAngle}>Track local Y-axis angle</LabelWithInfo>
              </CheckboxField>
              <CheckboxField>
                <input
                  checked={formState.labelMarkers}
                  type="checkbox"
                  onChange={(event) => {
                    onUpdateFormValue("labelMarkers", event.target.checked);
                  }}
                />
                <LabelWithInfo description={fieldDescriptions.labelMarkers}>Label markers</LabelWithInfo>
              </CheckboxField>
              <CheckboxField>
                <input
                  checked={hasValidRoi && formState.cropToRoi}
                  disabled={!hasValidRoi}
                  type="checkbox"
                  onChange={(event) => {
                    onUpdateFormValue("cropToRoi", event.target.checked);
                  }}
                />
                <LabelWithInfo description={fieldDescriptions.cropToRoi}>Crop to ROI</LabelWithInfo>
              </CheckboxField>
              <CheckboxField>
                <input
                  checked={formState.debugOneFrame}
                  type="checkbox"
                  onChange={(event) => {
                    onUpdateFormValue("debugOneFrame", event.target.checked);
                  }}
                />
                <LabelWithInfo description={fieldDescriptions.debugOneFrame}>Debug one frame</LabelWithInfo>
              </CheckboxField>
            </CheckboxList>
          </>
        )}
      </TabBody>
      <TimeControls style={{ marginTop: "16px" }}>
        <ActionButton
          disabled={isSubmitting || selectedVideoId.length === 0}
          type="button"
          onClick={() => {
            onRunTracking();
          }}
        >
          {isSubmitting ? "Starting..." : "Run tracking"}
        </ActionButton>
        <SecondaryButton type="button" onClick={onResetOptions}>
          Reset options
        </SecondaryButton>
      </TimeControls>
      {errorMessage.length > 0 && <ErrorText>{errorMessage}</ErrorText>}
    </Panel>
  );
};
