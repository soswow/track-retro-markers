import styled from "@emotion/styled";
import type { TrackingJob } from "./types.js";

export const Page = styled.main<{ $isVerticalVideo: boolean; $previewWidth: number }>`
  display: grid;
  grid-template-columns: ${(props) =>
    props.$isVerticalVideo ? `320px ${props.$previewWidth}px 12px minmax(420px, 1fr)` : "320px 1fr"};
  min-height: 100vh;
`;

export const Sidebar = styled.aside`
  background: #151b23;
  border-right: 1px solid #27303d;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export const Content = styled.section`
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

export const PreviewColumn = styled.aside`
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export const Panel = styled.div``;

export const Title = styled.h1`
  margin: 0;
  font-size: 1.25rem;
`;

export const PanelHeader = styled.div`
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
`;

export const Subtitle = styled.p`
  margin: 0;
  color: #9aa7b5;
  font-size: 0.9rem;
`;

export const VideoList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
  max-height: calc(100vh - 120px);
`;

export const VideoButton = styled.button<{ isSelected: boolean }>`
  text-align: left;
  border: 1px solid ${(props) => (props.isSelected ? "#4f8cff" : "#27303d")};
  background: ${(props) => (props.isSelected ? "#1b2a44" : "#11161d")};
  color: inherit;
  border-radius: 10px;
  padding: 12px;
`;

export const VideoMeta = styled.div`
  color: #9aa7b5;
  font-size: 0.8rem;
  margin-top: 4px;
`;

export const VideoPlayer = styled.video`
  display: block;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  background: #000;
  border-radius: 10px;
`;

export const PreviewImage = styled.img`
  display: block;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  background: #000;
  border-radius: 10px;
`;

export const PreviewPlaceholder = styled.div`
  display: grid;
  height: 100%;
  place-items: center;
  background: #000;
  border-radius: 10px;
  color: #9aa7b5;
`;

export const ThresholdPreviewLayer = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border-radius: 10px;
  overflow: hidden;
`;

export const OutputPreviewLayer = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border-radius: 10px;
  overflow: hidden;
`;

export const VideoPreviewFrame = styled.div`
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  overflow: hidden;
  background: #000;
  border-radius: 10px;
`;

export const RoiOverlay = styled.div<{ isDrawingEnabled: boolean }>`
  position: absolute;
  inset: 0;
  border-radius: 10px;
  cursor: crosshair;
  pointer-events: ${(props) => (props.isDrawingEnabled ? "auto" : "none")};
`;

export const RoiBox = styled.div`
  position: absolute;
  border: 2px solid #4f8cff;
  background: rgb(79 140 255 / 18%);
  box-shadow: 0 0 0 9999px rgb(0 0 0 / 18%);
  pointer-events: none;
`;

export const TimeControls = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
`;

export const ActionButton = styled.button`
  border: none;
  border-radius: 8px;
  padding: 10px 14px;
  background: #2d66d7;
  color: white;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const SecondaryButton = styled(ActionButton)`
  background: #27303d;
`;

export const ResizeHandle = styled.div<{ $orientation: "horizontal" | "vertical" }>`
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  touch-action: none;
  cursor: ${(props) => (props.$orientation === "vertical" ? "col-resize" : "row-resize")};
  ${(props) => (props.$orientation === "vertical" ? "width: 12px;" : "height: 12px;")}

  &::before {
    content: "";
    display: block;
    border-radius: 999px;
    background: #27303d;
    transition: background 120ms ease;
    ${(props) => (props.$orientation === "vertical" ? "width: 3px; height: 100%;" : "width: 100%; height: 3px;")}
  }

  &:hover::before {
    background: #4f8cff;
  }
`;

export const TabList = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 2px;
  margin: 16px 0 0;
  border-bottom: 1px solid #27303d;
`;

export const TabButton = styled.button<{ isSelected: boolean }>`
  position: relative;
  bottom: -1px;
  border: 1px solid #27303d;
  border-bottom-color: ${(props) => (props.isSelected ? "#0b0f14" : "#27303d")};
  border-radius: 10px 10px 0 0;
  background: ${(props) => (props.isSelected ? "#0b0f14" : "#151b23")};
  color: ${(props) => (props.isSelected ? "#f3f7fb" : "#9aa7b5")};
  padding: ${(props) => (props.isSelected ? "10px 16px" : "8px 14px")};
  font-weight: ${(props) => (props.isSelected ? 700 : 500)};

  &:hover {
    color: #f3f7fb;
    border-color: #27303d;
    border-bottom-color: ${(props) => (props.isSelected ? "#0b0f14" : "#27303d")};
  }
`;

export const TabBody = styled.div`
  border: 1px solid #27303d;
  border-top: none;
  border-radius: 0 0 10px 10px;
  background: #0b0f14;
  padding: 12px;
`;

export const OptionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
`;

export const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.85rem;
  color: #c5d0db;
`;

export const FieldInput = styled.input`
  border: 1px solid #27303d;
  border-radius: 8px;
  background: #0f1419;
  color: inherit;
  padding: 8px 10px;
`;

export const FieldSelect = styled.select`
  border: 1px solid #27303d;
  border-radius: 8px;
  background: #0f1419;
  color: inherit;
  padding: 8px 10px;
`;

export const CheckboxField = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;

  &:has(input:disabled) {
    opacity: 0.55;
  }
`;

export const CheckboxList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export const SliderRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 58px;
  gap: 10px;
  align-items: center;
`;

export const StatusMessage = styled.div<{ status: TrackingJob["status"] }>`
  padding: 12px;
  border-radius: 10px;
  background: ${(props) => {
    if (props.status === "failed") {
      return "#3a1d1d";
    }

    if (props.status === "completed") {
      return "#16301f";
    }

    return "#1b2430";
  }};
  border: 1px solid #27303d;
`;

export const ProgressTrack = styled.div`
  width: 100%;
  height: 10px;
  margin-top: 10px;
  overflow: hidden;
  border: 1px solid #27303d;
  border-radius: 999px;
  background: #0b0f14;
`;

export const ProgressFill = styled.div<{ $percent: number }>`
  width: ${(props) => props.$percent}%;
  height: 100%;
  border-radius: inherit;
  background: #4f8cff;
  transition: width 160ms ease;
`;

export const ResultVideo = styled.video`
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
  border-radius: 10px;
`;

export const ResultImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
  border-radius: 10px;
`;

export const LinkRow = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

export const ErrorText = styled.p`
  color: #ff8f8f;
  margin: 0;
`;
