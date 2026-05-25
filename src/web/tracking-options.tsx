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
  FieldSelect,
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
  const isTrailMarkersDisabled = selectedLayout === undefined || selectedLayout.markerNames.length === 0;
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
                Start time
                <FieldInput
                  value={formState.startSeconds}
                  onChange={(event) => {
                    onUpdateFormValue("startSeconds", event.target.value);
                  }}
                />
              </Field>
              <Field>
                Stop time
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
                ROI
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
                Marker layout
                <FieldSelect
                  value={formState.markersLayoutPath}
                  onChange={(event) => {
                    onUpdateFormValue("markersLayoutPath", event.target.value);
                    onUpdateFormValue("trailMarkers", "");
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
              Threshold: {formState.threshold}
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
                Preview threshold pixels
              </CheckboxField>
            </Field>
            <Field>
              Min area
              <FieldInput
                value={formState.minArea}
                onChange={(event) => {
                  onUpdateFormValue("minArea", event.target.value);
                }}
              />
            </Field>
            <Field>
              Max area
              <FieldInput
                value={formState.maxArea}
                onChange={(event) => {
                  onUpdateFormValue("maxArea", event.target.value);
                }}
              />
            </Field>
            <Field>
              Merge distance
              <FieldInput
                value={formState.mergeDistance}
                onChange={(event) => {
                  onUpdateFormValue("mergeDistance", event.target.value);
                }}
              />
            </Field>
            <Field>
              Max track distance
              <FieldInput
                value={formState.maxTrackDistance}
                onChange={(event) => {
                  onUpdateFormValue("maxTrackDistance", event.target.value);
                }}
              />
            </Field>
            <Field>
              Search radius
              <FieldInput
                value={formState.searchRadius}
                onChange={(event) => {
                  onUpdateFormValue("searchRadius", event.target.value);
                }}
              />
            </Field>
            <Field>
              Local threshold min
              <FieldInput
                value={formState.localThresholdMin}
                onChange={(event) => {
                  onUpdateFormValue("localThresholdMin", event.target.value);
                }}
              />
            </Field>
            <Field>
              Layout fit tolerance
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
                Video mode
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
                Color
                <FieldInput
                  value={formState.color}
                  onChange={(event) => {
                    onUpdateFormValue("color", event.target.value);
                  }}
                />
              </Field>
              <Field>
                Color start
                <FieldInput
                  value={formState.colorStart}
                  placeholder="defaults to color"
                  onChange={(event) => {
                    onUpdateFormValue("colorStart", event.target.value);
                  }}
                />
              </Field>
              <Field>
                Color end
                <FieldInput
                  value={formState.colorEnd}
                  placeholder="defaults to color"
                  onChange={(event) => {
                    onUpdateFormValue("colorEnd", event.target.value);
                  }}
                />
              </Field>
              <Field>
                Circle radius
                <FieldInput
                  value={formState.circleRadius}
                  onChange={(event) => {
                    onUpdateFormValue("circleRadius", event.target.value);
                  }}
                />
              </Field>
              <Field>
                Trail line width
                <FieldInput
                  value={formState.trailLineWidth}
                  onChange={(event) => {
                    onUpdateFormValue("trailLineWidth", event.target.value);
                  }}
                />
              </Field>
              <Field>
                Trail seconds
                <FieldInput
                  value={formState.trailSeconds}
                  onChange={(event) => {
                    onUpdateFormValue("trailSeconds", event.target.value);
                  }}
                />
              </Field>
              <Field>
                Trail markers
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
            </OptionsGrid>
            <CheckboxList style={{ marginTop: "12px" }}>
              <CheckboxField>
                <input
                  checked={formState.labelMarkers}
                  type="checkbox"
                  onChange={(event) => {
                    onUpdateFormValue("labelMarkers", event.target.checked);
                  }}
                />
                Label markers
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
                Crop to ROI
              </CheckboxField>
              <CheckboxField>
                <input
                  checked={formState.debugOneFrame}
                  type="checkbox"
                  onChange={(event) => {
                    onUpdateFormValue("debugOneFrame", event.target.checked);
                  }}
                />
                Debug one frame
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
