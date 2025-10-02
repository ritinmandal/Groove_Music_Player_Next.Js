"use client";

import React, { useContext, useEffect, useState } from "react";
import { PlayerContext } from "../../layouts/FrontendLayout";
import { Song } from "../../types/song";

export default function Queue() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("player context must be within a provider");
  }

  const { isQueueModalOpen, currentMusic, queue, playNow } = context;

  const [allowAutoplay, setAllowAutoplay] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setAllowAutoplay(!mq.matches);
    handler();
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  const startPlayingSong = (song: Song) => {
    playNow(song, queue);
  };

  if (!isQueueModalOpen) return null;

  return (
    <div
      className="
        fixed z-40
        max-w-[300px] w-full h-[70vh]
        bg-gradient-to-b from-black via-gray-900 to-black
        border border-gray-700 p-4 overflow-y-auto rounded-lg shadow-lg
        scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent

        bottom-24 right-6
        sm:bottom-24 sm:right-6
        max-sm:bottom-28 max-sm:left-1/2 max-sm:-translate-x-1/2 max-sm:w-[90%] max-sm:h-[60vh]
      "
    >
      <h2 className="text-xl font-bold text-white">Queue</h2>

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">Now Playing</h2>
        <div className="flex items-center gap-2 cursor-default mb-2 p-2 rounded-lg hover:bg-gray-800/60 transition">
          {currentMusic?.video_url && (
            <video
              src={currentMusic.video_url}
              width={300}
              height={300}
              className="w-10 h-10 object-cover rounded-md"
              muted
              autoPlay={allowAutoplay}
              loop
              playsInline
              preload="metadata"
              aria-label="Now playing preview video"
            />
          )}
          <div className="min-w-0">
            <p className="text-green-400 font-semibold truncate">{currentMusic?.title}</p>
            <p className="text-sm text-gray-400 truncate">{currentMusic?.artist}</p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">Queue List</h2>
        {queue.map((song: Song) => {
          const isCurrentSong = currentMusic?.id === song.id;
          return (
            <div
              key={song.id}
              onClick={() => startPlayingSong(song)}
              className="flex items-center gap-2 cursor-pointer mb-2 p-2 rounded-lg hover:bg-gray-800/60 transition"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && startPlayingSong(song)}
              aria-label={`Play ${song.title} by ${song.artist || "unknown"}`}
            >
              {song.video_url && (
                <video
                  src={song.video_url}
                  width={300}
                  height={300}
                  className="w-10 h-10 object-cover rounded-md"
                  muted
                  autoPlay={allowAutoplay}
                  loop
                  playsInline
                  preload="metadata"
                  aria-label={`${song.title} video preview`}
                />
              )}

              <div className="min-w-0">
                <p
                  className={`font-semibold truncate ${
                    isCurrentSong ? "text-green-400" : "text-white"
                  }`}
                >
                  {song.title}
                </p>
                <p className="text-sm text-gray-400 truncate">{song.artist}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
