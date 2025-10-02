"use client";

import Image from "next/image";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  IoMdPause,
  IoMdPlay,
  IoMdSkipBackward,
  IoMdSkipForward,
  IoMdVolumeHigh,
  IoMdVolumeOff,
} from "react-icons/io";
import { LuRepeat, LuRepeat1 } from "react-icons/lu";
import { MdOutlineQueueMusic } from "react-icons/md";
import { PlayerContext } from "../../layouts/FrontendLayout";
import Queue from "./Queue";

function formatTime(t: number) {
  if (!Number.isFinite(t) || t <= 0) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function MusicPlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("MusicPlayer must be used inside PlayerContext.Provider");

  const { currentMusic, playNext, playPrev, isQueueModalOpen, setQueueModalOpen } = ctx;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [repeatSong, setRepeatSong] = useState(false);

  const initialVolume = useMemo(() => {
    if (typeof window === "undefined") return 50;
    const v = Number(localStorage.getItem("bh_volume"));
    return Number.isFinite(v) ? Math.min(Math.max(v, 0), 100) : 50;
  }, []);
  const [volume, setVolume] = useState(initialVolume);
  const [previousVolume, setPreviousVolume] = useState(initialVolume);

  const currentTrackId = currentMusic?.id ?? "none";
  const audioSrc: string | undefined = currentMusic?.audio_url || undefined;
  const cover = currentMusic?.cover_image_url ?? "";
  const title = currentMusic?.title ?? "";
  const artist = currentMusic?.artist ?? "";

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTime = () => setCurrentTime(audio.currentTime || 0);
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onDur = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnded = () => {
      if (!audio.loop) playNext();
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onDur);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onDur);
      audio.removeEventListener("ended", onEnded);
    };
  }, [playNext]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
    if (typeof window !== "undefined") localStorage.setItem("bh_volume", String(volume));
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = repeatSong;
  }, [repeatSong]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(0);
    if (audioSrc) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    } else {
      audio.pause();
      setIsPlaying(false);
      setDuration(0);
    }
  }, [currentTrackId, audioSrc]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };

  const onSeek = (val: number) => {
    const a = audioRef.current;
    if (!a || !Number.isFinite(val)) return;
    a.currentTime = val;
    setCurrentTime(val);
  };

  const onVolume = (val: number) => {
    if (!Number.isFinite(val)) return;
    setVolume(val);
    if (audioRef.current) audioRef.current.volume = val / 100;
    if (val > 0) setPreviousVolume(val);
  };

  const toggleMute = () => {
    if (volume === 0) onVolume(previousVolume || 50);
    else {
      setPreviousVolume(volume);
      onVolume(0);
    }
  };

  const isVisible = Boolean(currentMusic && audioSrc);
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const safeCurrent = Math.min(currentTime, safeDuration);

  return (
    <>
      <Queue />
      <div
        className={`fixed bottom-0 left-0 w-full px-3 sm:px-6 py-2 sm:py-4 z-50
                    pb-[calc(env(safe-area-inset-bottom)+0.5rem)]
                    bg-gradient-to-r from-black/40 to-black/10 
                    backdrop-blur-md border-t border-white/20
                    transition-all duration-300
                    ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-full pointer-events-none"}`}
      >
        <audio
          key={`audio-${currentTrackId}`}
          ref={audioRef}
          src={audioSrc}
          preload="metadata"
          controls={false}
          crossOrigin="anonymous"
        />

        <div className="max-w-7xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-5">
          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
            <Image
              src={cover || "/favicon.ico"}
              alt={title ? `${title} cover` : "cover"}
              width={56}
              height={56}
              className="w-10 h-10 sm:w-14 sm:h-14 object-cover rounded-md shadow"
              priority
            />
            <div className="min-w-0">
              <p className="font-semibold text-[13px] sm:text-base truncate">{title || "\u00A0"}</p>
              <p className="text-neutral-400 text-xs sm:text-sm truncate">{artist || "\u00A0"}</p>
            </div>
          </div>

          <div className="w-full sm:max-w-[480px] flex flex-col items-center gap-1.5 sm:gap-2">
            <div className="flex gap-3 sm:gap-6 items-center">
              <button
                className="text-lg sm:text-2xl text-neutral-400 hover:text-white disabled:opacity-40"
                onClick={playPrev}
                disabled={!isVisible}
                aria-label="Previous"
              >
                <IoMdSkipBackward />
              </button>

              <button
                className="bg-white text-black text-lg sm:text-2xl w-10 h-10 sm:w-14 sm:h-14 rounded-full grid place-items-center shadow-2xl hover:scale-110 transition-all duration-200 disabled:opacity-60"
                onClick={togglePlay}
                disabled={!isVisible}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <IoMdPause /> : <IoMdPlay className="translate-x-[1px]" />}
              </button>

              <button
                className="text-lg sm:text-2xl text-neutral-400 hover:text-white disabled:opacity-40"
                onClick={playNext}
                disabled={!isVisible}
                aria-label="Next"
              >
                <IoMdSkipForward />
              </button>
            </div>

            <div className="w-full flex items-center gap-2 text-xs sm:text-sm">
              <span className="hidden sm:block text-neutral-400 w-10 text-right">
                {formatTime(safeCurrent)}
              </span>
              <input
                type="range"
                min={0}
                max={safeDuration}
                step={0.1}
                value={safeCurrent}
                onChange={(e) => onSeek(Number(e.target.value))}
                onInput={(e) => onSeek(Number((e.target as HTMLInputElement).value))}
                className="
                  w-full h-1.5 rounded-full cursor-pointer appearance-none
                  bg-zinc-700
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:h-3
                  [&::-webkit-slider-thumb]:w-3
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-white
                  [&::-moz-range-thumb]:h-3
                  [&::-moz-range-thumb]:w-3
                  [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:bg-white
                "
              />
              <span className="hidden sm:block text-neutral-400 w-10">
                {formatTime(safeDuration)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-4">
            <button
              className={`text-base sm:text-xl ${repeatSong ? "text-purple-400" : "text-neutral-400 hover:text-white"}`}
              onClick={() => setRepeatSong((r) => !r)}
              title="Repeat"
              aria-pressed={repeatSong}
            >
              {repeatSong ? <LuRepeat1 /> : <LuRepeat />}
            </button>

            <button
  className="text-neutral-400 text-base sm:text-xl hover:text-white"
  onClick={() => setQueueModalOpen(!isQueueModalOpen)}
  title="Open queue"
  aria-expanded={isQueueModalOpen}
>
  <MdOutlineQueueMusic />
</button>

            <button
              className="text-neutral-400 text-base sm:text-xl hover:text-white"
              onClick={toggleMute}
              title={volume === 0 ? "Unmute" : "Mute"}
              aria-pressed={volume === 0}
            >
              {volume === 0 ? <IoMdVolumeOff /> : <IoMdVolumeHigh />}
            </button>

            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => onVolume(Number(e.target.value))}
              onInput={(e) => onVolume(Number((e.target as HTMLInputElement).value))}
              className="
                hidden sm:block
                w-[120px] h-1.5 rounded-full cursor-pointer appearance-none
                bg-zinc-700
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:h-3
                [&::-webkit-slider-thumb]:w-3
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-white
                [&::-moz-range-thumb]:h-3
                [&::-moz-range-thumb]:w-3
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-white
              "
            />
          </div>
        </div>
      </div>
    </>
  );
}
