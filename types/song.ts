export type Song = {
  id: number;
  title: string;
  artist: string;
  album?: string | null;
  cover_image_url: string;
  audio_url: string;
  duration_sec?: number | null;
  play_count?: number | null;
  video_url?: string | null;
  created_at: string; // ISO timestamp
};
