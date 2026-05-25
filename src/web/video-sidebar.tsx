import React from "react";
import { formatDuration, formatFileSize } from "./api-client.js";
import type { VideoListItem } from "./types.js";
import { Sidebar, Subtitle, Title, VideoButton, VideoList, VideoMeta } from "./ui-components.js";

type VideoSidebarProps = {
  selectedVideoId: string;
  videos: VideoListItem[];
  onSelectVideo: (videoId: string) => void;
};

export const VideoSidebar = ({ selectedVideoId, videos, onSelectVideo }: VideoSidebarProps): JSX.Element => {
  return (
    <Sidebar>
      <div>
        <Title>Videos</Title>
        <Subtitle>{videos.length} file{videos.length === 1 ? "" : "s"} in folder</Subtitle>
      </div>
      <VideoList>
        {videos.map((video) => (
          <VideoButton
            key={video.id}
            isSelected={video.id === selectedVideoId}
            onClick={() => {
              onSelectVideo(video.id);
            }}
            type="button"
          >
            <strong>{video.fileName}</strong>
            <VideoMeta>
              {formatFileSize(video.sizeBytes)}
              {video.durationSeconds !== undefined ? ` · ${formatDuration(video.durationSeconds)}` : ""}
              {video.width !== undefined && video.height !== undefined ? ` · ${video.width}×${video.height}` : ""}
            </VideoMeta>
          </VideoButton>
        ))}
      </VideoList>
      {videos.length === 0 && <Subtitle>No videos found. Add files to the server video folder.</Subtitle>}
    </Sidebar>
  );
};
