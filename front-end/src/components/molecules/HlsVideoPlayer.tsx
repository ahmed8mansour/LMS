'use client';

import {
  MediaPlayer,
  MediaProvider,
  isHLSProvider,
  type MediaProviderAdapter,
} from '@vidstack/react';
import {
  defaultLayoutIcons,
  DefaultVideoLayout,
} from '@vidstack/react/player/layouts/default';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import HLS from 'hls.js';
import { Loader2, VideoOff } from 'lucide-react';

interface HlsVideoPlayerProps {
  src: string | null;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  title?: string;
  className?: string;
}

export function HlsVideoPlayer({ src, status, title, className }: HlsVideoPlayerProps) {
  if (status !== 'COMPLETED' || !src) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 bg-darkbg text-graytext2 ${className ?? ''}`}>
        {status === 'FAILED' ? (
          <>
            <VideoOff className="h-8 w-8" />
            <p className="text-sm">Video processing failed. Please contact support.</p>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Video is still processing. Check back soon.</p>
          </>
        )}
      </div>
    );
  }

  // Use the locally bundled hls.js instead of Vidstack's default CDN download,
  // so playback has no runtime dependency on an external host.
  function onProviderChange(provider: MediaProviderAdapter | null) {
    if (isHLSProvider(provider)) {
      provider.library = HLS;
    }
  }

  return (
    <MediaPlayer
      className={className}
      src={{ src, type: 'application/x-mpegurl' }}
      title={title}
      onProviderChange={onProviderChange}
      playsInline
      crossOrigin
    >
      <MediaProvider />
      <DefaultVideoLayout icons={defaultLayoutIcons} />
    </MediaPlayer>
  );
}
