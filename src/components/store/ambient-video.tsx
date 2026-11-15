"use client";

import { useEffect, useRef, useState } from "react";
import { Photo } from "@/components/ui/photo";

export function AmbientVideo({ src, poster }: { src: string; poster: string }) {
  const [playing, setPlaying] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<number | undefined>(undefined);
  function showPoster() {
    if (frame.current !== undefined)
      video.current?.cancelVideoFrameCallback?.(frame.current);
    frame.current = undefined;
    setPlaying(false);
  }
  useEffect(() => {
    const element = video.current;
    return () => {
      if (frame.current !== undefined)
        element?.cancelVideoFrameCallback?.(frame.current);
    };
  }, []);
  return (
    <div className="relative size-full">
      <video
        ref={video}
        className="vid"
        data-src={src}
        muted
        loop
        playsInline
        disablePictureInPicture
        disableRemotePlayback
        preload="none"
        aria-hidden="true"
        onPlaying={() => {
          // Keep the poster until a decoded frame has reached the compositor.
          if (video.current?.requestVideoFrameCallback)
            frame.current = video.current.requestVideoFrameCallback(() => {
              frame.current = undefined;
              setPlaying(true);
            });
          else setPlaying(true);
        }}
        onPause={showPoster}
        onWaiting={showPoster}
        onError={showPoster}
      />
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-[1200ms] ease-in-out motion-reduce:transition-none ${playing ? "opacity-0" : "opacity-100"}`}
        aria-hidden="true"
      >
        <Photo src={poster} alt="" sizes="(max-width: 640px) 100vw, 50vw" />
      </div>
    </div>
  );
}
