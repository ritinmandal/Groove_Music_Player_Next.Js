"use client";

import React, { createContext, useMemo, useState } from "react";
import type { Song } from "../types/song";            // use one canonical import path
import MusicPlayer from "@/components/MusicPlayer";   // global player only

export type PlayerContextType = {
  currentMusic: Song | null;
  queue: Song[];
  isQueueModalOpen: boolean;
  setQueueModalOpen: (open: boolean) => void;
  playNext: () => void;
  playPrev: () => void;
  playNow: (song: Song, queue?: Song[]) => void;
};

export const PlayerContext = createContext<PlayerContextType | null>(null);

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  const [currentMusic, setCurrentMusic] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [isQueueModalOpen, setQueueModalOpen] = useState(false);

  const indexInQueue = currentMusic ? queue.findIndex((s) => s.id === currentMusic.id) : -1;

  const playNext = () => {
    if (indexInQueue >= 0 && indexInQueue < queue.length - 1) {
      setCurrentMusic(queue[indexInQueue + 1]);
    }
  };

  const playPrev = () => {
    if (indexInQueue > 0) {
      setCurrentMusic(queue[indexInQueue - 1]);
    }
  };

  const playNow = (song: Song, q?: Song[]) => {
    if (q?.length) {
      const exists = q.some((s) => s.id === song.id);
      setQueue(exists ? q : [song, ...q]);
    } else if (!queue.length) {
      setQueue([song]);
    }
    setCurrentMusic(song);
  };

  const value = useMemo(
    () => ({
      currentMusic,
      queue,
      isQueueModalOpen,
      setQueueModalOpen,
      playNext,
      playPrev,
      playNow,
    }),
    [currentMusic, queue, isQueueModalOpen]
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <MusicPlayer />
    </PlayerContext.Provider>
  );
}
