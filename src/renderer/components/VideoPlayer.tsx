import { getReelMediaUrl } from '../api.js';

interface VideoPlayerProps {
  reelId: string;
  filename: string;
}

export function VideoPlayer({ reelId, filename }: VideoPlayerProps) {
  const url = getReelMediaUrl(reelId, filename);

  return (
    <div className="video-player">
      <video
        controls
        preload="metadata"
        className="video-player__video"
        src={url}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
