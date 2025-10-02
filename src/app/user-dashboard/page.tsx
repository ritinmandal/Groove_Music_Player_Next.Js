"use client";

import { useEffect, useMemo, useRef, useState, useContext, useCallback } from "react";
import getSupabaseClient from "../../../api/SupabaseClient";
import { motion } from "framer-motion";
import Image from "next/image";
import { PlayerContext } from "../../../layouts/FrontendLayout";
import type { Song } from "../../../types/song";

type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at?: string;
};


type Playlist = {
  id: number;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  cover_image_url: string | null;
  playlist_songs?: { song_id: string }[];
};

type PlaylistSongRow = {
  song: Song;
  added_at: string;
  position: number | null;
};

type SupabasePlaylistSongResponse = {
  added_at: string;
  position: number | null;
  song: Song | Song[];
};

type Bucket = "songs" | "covers";

type InsertSong = Pick<Song, "title" | "artist" | "audio_url" | "cover_image_url">;

export default function UserDashboard() {
  const [me, setMe] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const titleRef = useRef<HTMLInputElement>(null);
  const artistRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [plBusy, setPlBusy] = useState(false);
  const [plName, setPlName] = useState("");
  const [plDesc, setPlDesc] = useState("");
  const plCoverRef = useRef<HTMLInputElement>(null);
  const [openPlaylistId, setOpenPlaylistId] = useState<number | null>(null);
  const [openPlaylistSongs, setOpenPlaylistSongs] = useState<PlaylistSongRow[] | null>(null);

  const spotify = { green: "#1DB954" };
  const player = useContext(PlayerContext);

  const loadPlaylists = useCallback(async (uid: string) => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("playlists")
      .select("id,user_id,name,description,is_public,created_at,cover_image_url, playlist_songs ( song_id )")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (error) {
      setMsg(error.message || "Failed to load playlists");
      return;
    }
    setPlaylists((data ?? []) as Playlist[]);
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setLoading(false);
        return;
      }
      const { id, email, user_metadata } = auth.user;
      const profile: Profile = {
        id,
        email: email ?? null,
        display_name: user_metadata?.display_name ?? null,
      };
      setMe(profile);
      await loadPlaylists(id);
      setLoading(false);
    })();
  }, [loadPlaylists]);

  const displayName = useMemo(() => me?.display_name || me?.email || "You", [me]);

  async function uploadTo(bucket: Bucket, file: File, prefix?: string) {
    const supabase = getSupabaseClient();
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const id = crypto.randomUUID();
    const path = prefix ? `${prefix}/${id}.${ext}` : `${id}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleAddSong(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const title = titleRef.current?.value?.trim() || "";
      const artist = artistRef.current?.value?.trim() || "";
      const audioFile = audioRef.current?.files?.[0];
      const coverFile = coverRef.current?.files?.[0];
      if (!title || !artist || !audioFile || !coverFile) throw new Error("Title, Artist, Audio, and Cover are required.");
      const audio_url = await uploadTo("songs", audioFile);
      const cover_image_url = await uploadTo("covers", coverFile, "songs");
      const insertPayload: InsertSong = { title, artist, audio_url, cover_image_url };
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("songs").insert(insertPayload);
      if (error) throw error;
      if (titleRef.current) titleRef.current.value = "";
      if (artistRef.current) artistRef.current.value = "";
      if (audioRef.current) audioRef.current.value = "";
      if (coverRef.current) coverRef.current.value = "";
      setMsg("Song added");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add song";
      setMsg(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreatePlaylist(e: React.FormEvent) {
    e.preventDefault();
    if (!me?.id) return;
    setPlBusy(true);
    setMsg("");
    try {
      const coverFile = plCoverRef.current?.files?.[0] || null;
      const cover_image_url = coverFile ? await uploadTo("covers", coverFile, `playlists/${me.id}`) : null;
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("playlists").insert({
        user_id: me.id,
        name: plName.trim(),
        description: plDesc.trim() || null,
        cover_image_url,
      });
      if (error) throw error;
      setPlName("");
      setPlDesc("");
      if (plCoverRef.current) plCoverRef.current.value = "";
      await loadPlaylists(me.id);
      setMsg("Playlist created");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create playlist";
      setMsg(message);
    } finally {
      setPlBusy(false);
    }
  }

  async function openPlaylist(playlistId: number) {
    setOpenPlaylistId(playlistId);
    setOpenPlaylistSongs(null);
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("playlist_songs")
      .select("added_at, position, song:songs(*)")
      .eq("playlist_id", playlistId)
      .order("position", { ascending: true })
      .order("added_at", { ascending: true });
    if (error) {
      setMsg(error.message || "Failed to load playlist songs");
      return;
    }
    // Transform the data to match PlaylistSongRow type
    const transformedData = (data ?? []).map((row: SupabasePlaylistSongResponse) => ({
      added_at: row.added_at,
      position: row.position,
      song: Array.isArray(row.song) ? row.song[0] : row.song
    })) as PlaylistSongRow[];
    setOpenPlaylistSongs(transformedData);
  }

  async function removeSongFromPlaylist(playlistId: number, songId: number) {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("playlist_songs").delete().match({ playlist_id: playlistId, song_id: songId });
    if (error) {
      setMsg(error.message || "Failed to remove");
      return;
    }
    setMsg("Removed from playlist");
    await openPlaylist(playlistId);
    await loadPlaylists(me!.id);
  }

  async function deletePlaylist(playlistId: number) {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("playlists").delete().eq("id", playlistId);
    if (error) {
      setMsg(error.message || "Failed to delete playlist");
      return;
    }
    setMsg("Playlist deleted");
    if (openPlaylistId === playlistId) {
      setOpenPlaylistId(null);
      setOpenPlaylistSongs(null);
    }
    setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
  }

  function playFromModal(song: Song) {
    if (!player) return;
    const queue = (openPlaylistSongs?.map((r) => r.song) ?? [song]) as Song[];
    player.playNow(song, queue);
  }

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center bg-[#0a0a0a] text-white">
        <p className="opacity-80">Loading…</p>
      </main>
    );
  }

  if (!me) {
    return (
      <main className="min-h-screen grid place-items-center bg-[#0a0a0a] text-white p-4 sm:p-6 relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(1000px 500px at 10% -10%, rgba(29,185,84,0.20), transparent 60%), radial-gradient(800px 450px at 110% 20%, rgba(29,185,84,0.12), transparent 60%), radial-gradient(600px 400px at 50% 120%, rgba(29,185,84,0.10), transparent 60%)",
          }}
        />
        <div className="max-w-md px-4 text-center relative">
          <h1 className="text-2xl sm:text-3xl font-extrabold mb-2">Please sign in to access your dashboard</h1>
          <p className="text-zinc-300">You need an account to upload and manage your songs.</p>
        </div>
      </main>
    );
  }

  const currentPlaylist = openPlaylistId ? playlists.find((p) => p.id === openPlaylistId) || null : null;

  return (
    <main className="min-h-screen mb-25 bg-[#0a0a0a] text-white relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1100px 550px at 10% -10%, rgba(29,185,84,0.18), transparent 60%), radial-gradient(900px 520px at 110% 15%, rgba(29,185,84,0.12), transparent 60%), radial-gradient(700px 420px at 50% 120%, rgba(29,185,84,0.10), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.10]
          [background-image:linear-gradient(to_right,rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.12)_1px,transparent_1px)]
          [background-size:64px_64px]"
      />

      <section className="relative mx-auto max-w-6xl p-4 sm:p-6 space-y-6 sm:space-y-10">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              <span>Lets</span>
              <span style={{ color: spotify.green }}>Groove</span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400">Welcome back, {displayName}. Upload and manage your tracks.</p>
          </div>
        </header>

        {msg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl px-3 py-2 sm:px-4 sm:py-2 text-sm text-white shadow-lg"
          >
            {msg}
          </motion.div>
        )}

        <motion.form
          onSubmit={handleAddSong}
          className="grid grid-cols-1 gap-3 sm:gap-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 sm:p-6 shadow-[0_10px_60px_-10px_rgba(0,0,0,.8)] md:grid-cols-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="col-span-1 md:col-span-2 text-lg sm:text-xl font-semibold text-white/90">Add a new song</h2>

          <input ref={titleRef} placeholder="Title" className="rounded-lg bg-white/7.5 text-white placeholder:text-zinc-400 outline-none border border-white/10 px-3 py-2 focus:border-[rgba(29,185,84,0.7)] focus:ring-2 focus:ring-[rgba(29,185,84,0.25)] transition w-full" />

          <input ref={artistRef} placeholder="Artist" className="rounded-lg bg-white/7.5 text-white placeholder:text-zinc-400 outline-none border border-white/10 px-3 py-2 focus:border-[rgba(29,185,84,0.7)] focus:ring-2 focus:ring-[rgba(29,185,84,0.25)] transition w-full" />

          <div className="flex flex-col gap-1">
            <label className="text-xs sm:text-sm text-zinc-400">Audio (mp3/m4a)</label>
            <input ref={audioRef} type="file" accept="audio/*" className="rounded-lg bg-white/7.5 text-white outline-none border border-white/10 px-3 py-2 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-sm file:text-white hover:file:bg-white/15 w-full" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs sm:text-sm text-zinc-400">Cover image</label>
            <input ref={coverRef} type="file" accept="image/*" className="rounded-lg bg-white/7.5 text-white outline-none border border-white/10 px-3 py-2 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-sm file:text-white hover:file:bg-white/15 w-full" />
          </div>

          <div className="col-span-1 md:col-span-2">
            <button disabled={busy} className="w-full rounded-lg font-bold text-black px-4 py-2 disabled:opacity-60 disabled:cursor-not-allowed text-sm sm:text-base" style={{ background: spotify.green, boxShadow: "0 10px 30px -10px rgba(29,185,84,0.55), inset 0 0 0 1px rgba(0,0,0,0.15)" }}>
              {busy ? "Working…" : "Add Song"}
            </button>
          </div>
        </motion.form>

        <section className="relative">
          <div className="mb-4 h-24 sm:h-32 rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-r from-emerald-500/20 via-emerald-400/10 to-transparent relative">
            <div className="absolute inset-0 [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] opacity-10" />
            <div className="absolute inset-0 bg-[radial-gradient(1200px_300px_at_-10%_-40%,rgba(29,185,84,0.25),transparent_60%)]" />
            <div className="h-full w-full grid content-center px-4 sm:px-6">
              <h2 className="text-xl sm:text-2xl font-semibold">My Playlists</h2>
              <p className="text-xs sm:text-sm text-zinc-300">Organize your tracks and share your vibe.</p>
            </div>
          </div>

          <form onSubmit={handleCreatePlaylist} className="mb-6 grid gap-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 md:grid-cols-[1fr_2fr_1fr_auto]">
            <input value={plName} onChange={(e) => setPlName(e.target.value)} placeholder="Playlist name" required className="h-10 rounded-lg bg-white/7.5 text-white placeholder:text-zinc-400 outline-none border border-white/10 px-3 focus:border-[rgba(29,185,84,0.7)] focus:ring-2 focus:ring-[rgba(29,185,84,0.25)]" />
            <input value={plDesc} onChange={(e) => setPlDesc(e.target.value)} placeholder="Description (optional)" className="h-10 rounded-lg bg-white/7.5 text-white placeholder:text-zinc-400 outline-none border border-white/10 px-3 focus:border-[rgba(29,185,84,0.7)] focus:ring-2 focus:ring-[rgba(29,185,84,0.25)]" />
            <input ref={plCoverRef} type="file" accept="image/*" className="h-10 pt-1 rounded-lg bg-white/7.5 text-white outline-none border border-white/10 px-3 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-sm file:text-white hover:file:bg-white/15" />
            <button disabled={plBusy || !plName.trim()} className="h-10 rounded-lg font-semibold text-black px-4 disabled:opacity-60 disabled:cursor-not-allowed" style={{ background: spotify.green, boxShadow: "0 10px 30px -10px rgba(29,185,84,0.55), inset 0 0 0 1px rgba(0,0,0,0.15)" }}>
              {plBusy ? "Creating…" : "Create"}
            </button>
          </form>

          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {playlists.map((p) => {
              const count = p.playlist_songs?.length ?? 0;
              return (
                <div key={p.id} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_10px_50px_-15px_rgba(0,0,0,.8)] overflow-hidden flex flex-col">
                  <div className="relative w-full">
                    <div className="relative aspect-[16/9] sm:aspect-[4/3]">
                      {p.cover_image_url ? (
                        <Image src={p.cover_image_url} alt={p.name} unoptimized fill sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw" className="object-cover" />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/80 to-zinc-900/80">
                          <div className="absolute inset-0 opacity-10 [background-image:linear-gradient(45deg,#fff_1px,transparent_1px),linear-gradient(-45deg,#fff_1px,transparent_1px)] [background-size:16px_16px]" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-base sm:text-lg truncate">{p.name}</h3>
                        <p className="text-sm text-zinc-400 truncate">{p.description ?? "—"}</p>
                      </div>
                      <span className="shrink-0 text-[10px] sm:text-xs px-2 py-1 rounded-full border border-white/10 bg-white/5">{p.is_public ? "Public" : "Private"}</span>
                    </div>

                    <div className="mt-3 text-sm text-zinc-400">{count} song{count === 1 ? "" : "s"}</div>

                    <div className="mt-4 flex items-center gap-2 sm:gap-3">
                      <button onClick={() => openPlaylist(p.id)} className="h-9 px-3 rounded-lg text-black text-sm font-semibold" style={{ background: spotify.green, boxShadow: "0 10px 30px -10px rgba(29,185,84,0.55), inset 0 0 0 1px rgba(0,0,0,0.15)" }}>
                        Open
                      </button>
                      <button onClick={() => deletePlaylist(p.id)} className="h-9 px-3 rounded-lg border border-white/10 bg-white/10 hover:bg-white/20 text-sm">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {playlists.length === 0 && <p className="text-zinc-400 mt-4">No playlists yet. Create your first one above.</p>}
        </section>
      </section>

      {openPlaylistId !== null && (
        <div
          className="fixed inset-0 z-50 grid place-items-end md:place-items-center p-0 md:p-4"
          onClick={() => {
            setOpenPlaylistId(null);
            setOpenPlaylistSongs(null);
          }}
        >
          <div className="absolute inset-0 bg-black/60" />

          <div
            className="relative w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-28 sm:h-40 w-full border-b border-white/10">
              {currentPlaylist?.cover_image_url ? (
                <Image src={currentPlaylist.cover_image_url} alt={currentPlaylist.name} unoptimized fill sizes="100vw" className="object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-zinc-800/80 to-zinc-900/80" />
              )}
              <div className="absolute inset-0 bg-black/30" />
              <div className="absolute bottom-2 left-4 sm:left-5">
                <h3 className="text-lg sm:text-xl font-semibold">{currentPlaylist?.name || "Playlist"}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpenPlaylistId(null);
                  setOpenPlaylistSongs(null);
                }}
                className="absolute top-3 right-3 h-9 px-3 rounded-lg border border-white/10 bg-white/10 hover:bg-white/20 text-sm"
              >
                Close
              </button>
            </div>

            <div className="max-h-[70vh] md:max-h-[60vh] overflow-y-auto p-3 sm:p-4 space-y-3">
              {!openPlaylistSongs && <p className="text-zinc-400 text-sm">Loading…</p>}
              {openPlaylistSongs?.length === 0 && <p className="text-zinc-400 text-sm">No songs in this playlist yet.</p>}

              {openPlaylistSongs?.map(({ song }) => (
                <div key={song.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="w-12 h-12 overflow-hidden rounded-md bg-zinc-800">
                    <Image src={song.cover_image_url} alt={song.title} width={96} height={96} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{song.title}</p>
                    <p className="text-sm text-zinc-400 truncate">{song.artist}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => playFromModal(song)}
                      className="shrink-0 h-9 py-2 px-3 rounded-lg text-black text-sm font-semibold"
                      style={{ background: spotify.green, boxShadow: "0 10px 30px -10px rgba(29,185,84,0.55), inset 0 0 0 1px rgba(0,0,0,0.15)" }}
                    >
                      Play
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSongFromPlaylist(openPlaylistId!, song.id)}
                      className="shrink-0 h-9 px-3 rounded-lg border border-white/10 bg-white/10 hover:bg-white/20 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
