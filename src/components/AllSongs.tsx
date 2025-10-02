"use client";

import Image from "next/image";
import Link from "next/link";
import { IoMdPlay, IoMdHeart, IoMdHeartEmpty } from "react-icons/io";
import { GoSearch } from "react-icons/go";
import { RxHamburgerMenu, RxCross2 } from "react-icons/rx";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useContext, useEffect, useMemo, useState } from "react";
import getSupabaseClient from "../../api/SupabaseClient";
import type { Song } from "../../types/song";
import { PlayerContext } from "../../layouts/FrontendLayout";
import toast, { Toaster } from "react-hot-toast";

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

type Filter =
  | { type: "artist"; value: string }
  | { type: "album"; value: string }
  | null;

type Playlist = {
  id: number;
  name: string;
  description?: string | null;
};

type LikedRow = {
  song_id: number;
};

export default function AllSongs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<
    "title_asc" | "title_desc" | "artist_asc" | "artist_desc"
  >("title_asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<Filter>(null);
  const [pickerForSong, setPickerForSong] = useState<Song | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [allowAutoplay, setAllowAutoplay] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setAllowAutoplay(!mq.matches);
    handler();
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  const { data: authUser } = useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const handleLogout = async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    if (typeof window !== "undefined") window.location.reload();
  };

  const songsPerPage = 10;

  const getAllSongs = async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("songs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as Song[];
  };

  const {
    data: songs,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ["allSongs"],
    queryFn: getAllSongs,
  });

  const {
    data: playlists,
    isLoading: playlistsLoading,
  } = useQuery({
    queryKey: ["myPlaylists", authUser?.id],
    enabled: !!authUser?.id,
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error: qErr } = await supabase
        .from("playlists")
        .select("id,name,description")
        .eq("user_id", authUser!.id)
        .order("created_at", { ascending: false });
      if (qErr) throw qErr;
      return (data ?? []) as Playlist[];
    },
  });

  const {
    data: likedRows,
    isLoading: likedLoading,
  } = useQuery({
    queryKey: ["likedSongIds", authUser?.id],
    enabled: !!authUser?.id,
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error: qErr } = await supabase
        .from("liked_songs")
        .select("song_id")
        .eq("user_id", authUser!.id);
      if (qErr) throw qErr;
      return (data ?? []) as LikedRow[];
    },
  });

  const likedSet = useMemo(
    () => new Set((likedRows ?? []).map((r) => r.song_id)),
    [likedRows]
  );

  const queryClient = useQueryClient();

  const createPlaylist = useMutation({
    mutationFn: async (name: string) => {
      if (!authUser) throw new Error("Please log in to create a playlist.");
      const supabase = getSupabaseClient();
      const { data, error: mErr } = await supabase
        .from("playlists")
        .insert({
          user_id: authUser.id,
          name: name.trim(),
          description: null,
          is_public: false,
        })
        .select("id,name")
        .single();
      if (mErr) throw mErr;
      return data as Playlist;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myPlaylists", authUser?.id] });
      toast.success("Playlist created.");
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Couldn't create playlist";
      toast.error(msg);
    },
  });

  const addToPlaylist = useMutation({
    mutationFn: async ({
      playlist_id,
      song_id,
    }: {
      playlist_id: number;
      song_id: number;
    }) => {
      const supabase = getSupabaseClient();
      const { error: mErr } = await supabase
        .from("playlist_songs")
        .insert({ playlist_id, song_id });
      if (mErr) {
        const lower = String(mErr.message).toLowerCase();
        if (lower.includes("duplicate")) {
          throw new Error("This song is already in that playlist.");
        }
        throw mErr;
      }
    },
    onSuccess: () => {
      toast.success("Added to playlist");
      setPickerForSong(null);
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Couldn't add to playlist";
      toast.error(msg);
    },
  });

  const toggleLike = useMutation({
    mutationFn: async (song: Song) => {
      if (!authUser) throw new Error("Please log in to like songs.");
      const isLiked = likedSet.has(song.id as unknown as number);
      const supabase = getSupabaseClient();
      if (isLiked) {
        const { error: mErr } = await supabase
          .from("liked_songs")
          .delete()
          .match({ user_id: authUser.id, song_id: song.id });
        if (mErr) throw mErr;
        return { liked: false as const, id: song.id as unknown as number };
      } else {
        const { error: mErr } = await supabase
          .from("liked_songs")
          .insert({ user_id: authUser.id, song_id: song.id });
        if (mErr) {
          const lower = String(mErr.message).toLowerCase();
          if (lower.includes("duplicate")) {
            return { liked: true as const, id: song.id as unknown as number };
          }
          throw mErr;
        }
        return { liked: true as const, id: song.id as unknown as number };
      }
    },
    onMutate: async (song: Song) => {
      await queryClient.cancelQueries({ queryKey: ["likedSongIds", authUser?.id] });
      const prev =
        queryClient.getQueryData<LikedRow[]>(["likedSongIds", authUser?.id]) || [];
      const isAlready = prev.some((r) => r.song_id === (song.id as unknown as number));
      const next = isAlready
        ? prev.filter((r) => r.song_id !== (song.id as unknown as number))
        : [...prev, { song_id: song.id as unknown as number }];
      queryClient.setQueryData(["likedSongIds", authUser?.id], next);
      return { prev };
    },
    onError: (_e: unknown, _song: Song, ctx?: { prev?: LikedRow[] }) => {
      if (ctx?.prev) queryClient.setQueryData(["likedSongIds", authUser?.id], ctx.prev);
      toast.error("Couldn't update like");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["likedSongIds", authUser?.id] });
    },
    onSuccess: (res: { liked: boolean; id: number }) => {
      toast.success(res.liked ? "Added to Liked Songs" : "Removed from Liked Songs");
    },
  });

  const player = useContext(PlayerContext);

  const filteredAndSortedSongs = useMemo(() => {
    if (!songs) return [];
    const q = searchQuery.trim().toLowerCase();
    const filtered = songs.filter((s) => {
      const matchesSearch = q.length
        ? s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
        : true;
      const matchesFilter = activeFilter
        ? activeFilter.type === "artist"
          ? s.artist === activeFilter.value
          : s.album === activeFilter.value
        : true;
      return matchesSearch && matchesFilter;
    });
    const sorted = filtered.sort((a, b) => {
      if (sortOption === "title_asc") return a.title.localeCompare(b.title);
      if (sortOption === "title_desc") return b.title.localeCompare(a.title);
      if (sortOption === "artist_asc") return a.artist.localeCompare(b.artist);
      if (sortOption === "artist_desc") return b.artist.localeCompare(a.artist);
      return 0;
    });
    return sorted;
  }, [songs, searchQuery, sortOption, activeFilter]);

  const totalPages = Math.ceil(filteredAndSortedSongs.length / songsPerPage);
  const startIndex = (currentPage - 1) * songsPerPage;
  const currentSongs = filteredAndSortedSongs.slice(
    startIndex,
    startIndex + songsPerPage
  );

  const artists = useMemo(
    () => (songs ? uniq(songs.map((s) => s.artist)) : []),
    [songs]
  );
  const albums = useMemo(
    () => (songs ? uniq(songs.map((s) => s.album).filter(Boolean) as string[]) : []),
    [songs]
  );

  const playSong = (song: Song) => {
    if (!player) return;
    player.playNow(song, filteredAndSortedSongs);
    try {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    } catch {}
  };

  const handleCardKeyDown =
    (song: Song) => (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        playSong(song);
      }
    };

  const openPicker = (song: Song) => {
    if (!authUser) {
      toast("Please log in to use playlists", { icon: "🔒" });
      return;
    }
    setPickerForSong(song);
  };

  const handleCreateAndAdd = async () => {
    const name = newPlaylistName.trim();
    if (!name) {
      toast.error("Give your playlist a name");
      return;
    }
    try {
      const p = await createPlaylist.mutateAsync(name);
      if (pickerForSong) {
        await addToPlaylist.mutateAsync({
          playlist_id: p.id,
          song_id: pickerForSong.id as unknown as number,
        });
      }
      setNewPlaylistName("");
    } catch {}
  };

  if (isPending) {
    return (
      <div className="min-h-[90vh] bg-neutral-950 p-4 lg:p-6">
        <div className="h-8 w-48 bg-neutral-800 rounded mb-6" />
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_360px]">
          <div className="h-[70vh] bg-neutral-900 rounded" />
          <div className="h-[70vh] bg-neutral-900 rounded" />
          <div className="h-[70vh] bg-neutral-900 rounded" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-[90vh] bg-neutral-950 p-6">
        <h2 className="text-white text-xl">{(error as Error).message}</h2>
      </div>
    );
  }

  const isPlayingSomething = Boolean(player?.currentMusic);
  const previewSong = player?.currentMusic ?? null;

  const getVideoUrl = (s: Song | null): string | null => {
    if (!s) return null;
    const rec = s as unknown as Record<string, unknown>;
    const v = rec["video_url"];
    return typeof v === "string" && v.length > 0 ? v : null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b mb-25 from-neutral-900 to-black text-white">
      <Toaster position="top-center" />
      <header className="sticky top-0 z-50">
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(600px 200px at 10% -30%, rgba(29,185,84,0.15), transparent 60%), radial-gradient(400px 200px at 90% -20%, rgba(29,185,84,0.10), transparent 60%)",
            }}
          />
          <nav
            className="mx-auto max-w-7xl px-4 sm:px-6 py-3
                       bg-white/5 backdrop-blur-xl border-b border-white/10
                       rounded-b-2xl shadow-[0_10px_30px_-15px_rgba(0,0,0,.8)]"
          >
            <div className="flex items-center gap-3 sm:gap-6">
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-8 w-8 rounded-full bg-[#1DB954] grid place-items-center text-black font-extrabold">
                  ♫
                </div>
                <span className="font-extrabold tracking-tight text-lg">
                  <span className="text-[#1DB954]">Groove</span>
                </span>
              </div>
              <div className="hidden md:block flex-1 min-w-0">
                <div className="relative">
                  <GoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300/80 text-lg pointer-events-none" />
                  <input
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="What do you want to play?"
                    aria-label="Search songs or artists"
                    className="w-full rounded-full pl-10 pr-4 h-10
                               bg-white/10 border border-white/10
                               placeholder:text-zinc-400 text-white
                               focus:outline-none focus:border-[rgba(29,185,84,0.7)]
                               focus:ring-2 focus:ring-[rgba(29,185,84,0.25)]
                               transition"
                  />
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  className="md:hidden h-9 w-9 rounded-full bg-white/10 border border-white/10 grid place-items-center hover:bg-white/15 transition"
                  aria-label="Toggle search"
                  onClick={() => {
                    setMobileSearchOpen((s) => !s);
                    if (!mobileSearchOpen) setMobileMenuOpen(false);
                  }}
                >
                  <GoSearch className="text-lg" />
                </button>
                <div className="hidden md:flex items-center gap-2">
                  {!authUser ? (
                    <>
                      <Link
                        href="/signup"
                        className="px-4 pt-1 h-9 rounded-full text-sm bg-white/10 border border-white/10 hover:bg-white/15 transition"
                      >
                        Sign up
                      </Link>
                      <Link
                        href="/login"
                        className="px-4 h-9 pt-2 rounded-full text-sm font-bold bg-[#1DB954] text-black hover:brightness-110 transition"
                      >
                        Log in
                      </Link>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Link
                        href="/user-dashboard"
                        className="flex items-center gap-2 px-3 h-9 rounded-full bg-white/10 border border-white/10 hover:bg-white/15"
                        title="Open your dashboard"
                      >
                        <div className="h-6 w-6 rounded-full bg-[#1DB954] text-black grid place-items-center text-xs font-bold">
                          {(
                            authUser.user_metadata?.display_name ||
                            authUser.email ||
                            "U"
                          )
                            .toString()
                            .trim()
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <span className="text-sm max-w-[140px] truncate">
                          {authUser.user_metadata?.display_name || authUser.email}
                        </span>
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="px-3 h-9 rounded-full text-sm bg-white/10 border border-white/10 hover:bg-white/15 transition"
                      >
                        Log out
                      </button>
                    </div>
                  )}
                </div>
                <button
                  className="md:hidden h-9 w-9 rounded-full bg-white/10 border border-white/10 grid place-items-center hover:bg-white/15 transition"
                  aria-label="Toggle menu"
                  onClick={() => {
                    setMobileMenuOpen((o) => !o);
                    if (!mobileMenuOpen) setMobileSearchOpen(false);
                  }}
                >
                  {mobileMenuOpen ? <RxCross2 /> : <RxHamburgerMenu />}
                </button>
              </div>
            </div>
            <div
              className={`md:hidden overflow-hidden transition-[max-height] duration-300 ${
                mobileSearchOpen ? "max-h-24 mt-3" : "max-h-0"
              }`}
            >
              <div className="relative">
                <GoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300/80 text-lg pointer-events-none" />
                <input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search songs or artists"
                  aria-label="Search songs or artists"
                  className="w-full rounded-full pl-10 pr-4 h-10
                             bg-white/10 border border-white/10
                             placeholder:text-zinc-400 text-white
                             focus:outline-none focus:border-[rgba(29,185,84,0.7)]
                             focus:ring-2 focus:ring-[rgba(29,185,84,0.25)]
                             transition"
                />
              </div>
            </div>
            <div
              className={`md:hidden overflow-hidden transition-[max-height] duration-300 ${
                mobileMenuOpen ? "max-h-40 mt-3" : "max-h-0"
              }`}
            >
              <div className="grid gap-2">
                {!authUser ? (
                  <>
                    <Link
                      href="/signup"
                      className="w-full text-center pt-2 px-4 h-10 rounded-full text-sm bg-white/10 border border-white/10 hover:bg-white/15 transition"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign up
                    </Link>
                    <Link
                      href="/login"
                      className="w-full pt-2 text-center px-4 h-10 rounded-full text-sm font-bold bg-[#1DB954] text-black hover:brightness-110 transition"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Log in
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/user-dashboard"
                      className="flex items-center gap-2 px-3 h-10 rounded-full bg-white/10 border border-white/10 hover:bg-white/15"
                      onClick={() => setMobileMenuOpen(false)}
                      title="Open your dashboard"
                    >
                      <div className="h-6 w-6 rounded-full bg-[#1DB954] text-black grid place-items-center text-xs font-bold">
                        {(
                          authUser.user_metadata?.display_name ||
                          authUser.email ||
                          "U"
                        )
                          .toString()
                          .trim()
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                      <span className="text-sm max-w-[200px] truncate">
                        {authUser.user_metadata?.display_name || authUser.email}
                      </span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 h-10 rounded-full text-sm bg-white/10 border border-white/10 hover:bg-white/15 transition"
                    >
                      Log out
                    </button>
                  </>
                )}
              </div>
            </div>
          </nav>
          <div
            aria-hidden
            className="absolute inset-x-0 top-full h-px"
            style={{
              background:
                "linear-gradient(90deg, rgba(255,255,255,0), rgba(29,185,84,0.7), rgba(255,255,255,0))",
              filter: "blur(.4px)",
            }}
          />
        </div>
      </header>

      <div className="p-4 lg:p-6 pt-6">
        {activeFilter && (
          <div className="mb-4">
            <button
              onClick={() => {
                setActiveFilter(null);
                setCurrentPage(1);
              }}
              className="inline-flex items-center gap-2 text-xs px-3 h-7 rounded-full bg-neutral-900 border border-neutral-800 hover:border-neutral-700"
            >
              <span className="opacity-70">
                {activeFilter.type === "artist" ? "Artist" : "Album"}:
              </span>
              <span className="font-medium">{activeFilter.value}</span>
              <span className="opacity-60">✕</span>
            </button>
          </div>
        )}

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_360px]">
          <aside className="hidden lg:block bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-neutral-300 mb-3">Your Library</h3>
            <div className="space-y-2 mb-4">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as typeof sortOption)}
                aria-label="Sort songs"
                className="w-full h-9 rounded-lg bg-neutral-900 border border-neutral-800 px-3 text-sm"
              >
                <option value="title_asc">Title ↑</option>
                <option value="title_desc">Title ↓</option>
                <option value="artist_asc">Artist ↑</option>
                <option value="artist_desc">Artist ↓</option>
              </select>
            </div>

            <div className="space-y-6">
              <section>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-neutral-400 text-xs uppercase tracking-wide">Playlists</p>
                  <button className="text-xs text-neutral-400 hover:text-white">+ New</button>
                </div>
                <ul className="space-y-2">
                  <li>
                    <Link
                      href="/user-dashboard"
                      className="flex items-center gap-3 text-sm text-neutral-300 rounded-md px-2 py-1.5 hover:bg-neutral-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
                    >
                      <div className="h-8 w-8 rounded bg-neutral-800 grid place-items-center">🎵</div>
                      <span>My Playlist</span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/user-dashboard"
                      className="flex items-center gap-3 text-sm text-neutral-300 rounded-md px-2 py-1.5 hover:bg-neutral-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
                      title="Go to your dashboard"
                    >
                      <div className="h-8 w-8 rounded bg-neutral-800 grid place-items-center">💚</div>
                      <span>Liked Songs</span>
                    </Link>
                  </li>
                </ul>
              </section>

              <section>
                <p className="text-neutral-400 text-xs uppercase tracking-wide mb-2">Albums</p>
                <ul className="max-h-40 overflow-y-auto pr-1 space-y-1">
                  {albums.slice(0, 20).map((al) => (
                    <li key={al}>
                      <button
                        onClick={() => {
                          setActiveFilter({ type: "album", value: al });
                          setCurrentPage(1);
                        }}
                        className={`w-full text-left text-sm truncate rounded px-2 py-1 hover:bg-white/5 ${
                          activeFilter?.type === "album" && activeFilter.value === al
                            ? "bg-white/10"
                            : ""
                        }`}
                      >
                        {al}
                      </button>
                    </li>
                  ))}
                  {albums.length === 0 && (
                    <li className="text-sm text-neutral-500">No albums yet</li>
                  )}
                </ul>
              </section>

              <section>
                <p className="text-neutral-400 text-xs uppercase tracking-wide mb-2">Artists</p>
                <ul className="max-h-40 overflow-y-auto pr-1 space-y-1">
                  {artists.slice(0, 30).map((ar) => (
                    <li key={ar}>
                      <button
                        onClick={() => {
                          setActiveFilter({ type: "artist", value: ar });
                          setCurrentPage(1);
                        }}
                        className={`w-full text-left text-sm truncate rounded px-2 py-1 hover:bg-white/5 ${
                          activeFilter?.type === "artist" && activeFilter.value === ar
                            ? "bg-white/10"
                            : ""
                        }`}
                      >
                        {ar}
                      </button>
                    </li>
                  ))}
                  {artists.length === 0 && (
                    <li className="text-sm text-neutral-500">No artists yet</li>
                  )}
                </ul>
              </section>
            </div>
          </aside>

          <main className="min-w-0">
            <div className="flex items-center gap-2 mb-4">
              {["All", "Music", "Podcasts"].map((chip, i) => (
                <button
                  key={chip}
                  className={`h-8 px-3 rounded-full text-sm border ${
                    i === 0
                      ? "bg-white text-black border-transparent"
                      : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white"
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>

            <section className="mb-8">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-2xl font-bold">Recently played</h2>
                <span className="text-sm text-neutral-400"> </span>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-2 snap-x [&>*]:shrink-0">
                {filteredAndSortedSongs.slice(0, 10).map((song) => {
                  const isLiked = !!authUser && likedSet.has(song.id as unknown as number);
                  return (
                    <div
                      key={`recent-${song.id}`}
                      onClick={() => playSong(song)}
                      onKeyDown={handleCardKeyDown(song)}
                      role="button"
                      tabIndex={0}
                      className="snap-start group relative w-[72vw] sm:w-[190px] max-w-[230px]
                                 bg-neutral-900/70 border border-neutral-800 rounded-xl p-3 text-left
                                 hover:bg-neutral-900 transition cursor-pointer outline-none
                                 focus-visible:ring-2 focus-visible:ring-neutral-500"
                      aria-label={`Play ${song.title}`}
                    >
                      {/* Floating Play Button — visible only ≥sm */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playSong(song);
                        }}
                        className="hidden sm:grid bg-green-600/90 w-11 h-11 sm:w-12 sm:h-12 rounded-full place-items-center
                                   absolute bottom-3 right-3 sm:bottom-20 sm:right-4 opacity-0 group-hover:opacity-100
                                   translate-y-2 group-hover:translate-y-0 transition duration-300 text-white text-xl sm:text-2xl shadow-xl z-10"
                        aria-label={`Play ${song.title}`}
                        title="Play"
                      >
                        <IoMdPlay />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openPicker(song);
                        }}
                        className="absolute right-3 top-3 h-8 px-3 rounded-full text-xs bg-white/10 border border-white/10 hover:bg-white/15 backdrop-blur z-10"
                        aria-label="Add to playlist"
                        title="Add to playlist"
                      >
                        + Playlist
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          authUser
                            ? toggleLike.mutate(song)
                            : toast("Please log in to like songs", { icon: "🔒" });
                        }}
                        className="absolute bottom-16 right-3 sm:bottom-auto sm:right-2 sm:top-48 h-8 w-8 rounded-full grid place-items-center bg-white/10 border border-white/10 hover:bg-white/15 backdrop-blur z-10"
                        aria-label={isLiked ? "Unlike" : "Like"}
                        title={isLiked ? "Unlike" : "Like"}
                        disabled={likedLoading || toggleLike.isPending}
                      >
                        {isLiked ? <IoMdHeart className="text-green-500" /> : <IoMdHeartEmpty />}
                      </button>

                      <div className="relative aspect-square w-full overflow-hidden rounded-md pointer-events-none">
                        <Image
                          src={song.cover_image_url}
                          alt={`${song.title} cover`}
                          fill
                          sizes="(max-width: 640px) 72vw, 190px"
                          className="object-cover"
                          priority={false}
                        />
                      </div>

                      <p className="mt-3 text-sm font-semibold line-clamp-1">{song.title}</p>
                      <p className="text-xs text-neutral-400 line-clamp-1">{song.artist}</p>
                    </div>
                  );
                })}
                {filteredAndSortedSongs.length === 0 && (
                  <div className="text-neutral-500">No songs yet.</div>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-xl font-semibold mb-3">All songs</h3>

              <div className="grid gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 items-stretch">
                {currentSongs.map((song) => {
                  const isLiked = !!authUser && likedSet.has(song.id as unknown as number);
                  return (
                    <div
                      key={song.id}
                      onClick={() => playSong(song)}
                      onKeyDown={handleCardKeyDown(song)}
                      role="button"
                      tabIndex={0}
                      className="group relative bg-neutral-900/70 border border-neutral-800 p-3 rounded-xl hover:bg-neutral-900 transition
                                 flex flex-col text-left h-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
                      aria-label={`Play ${song.title}`}
                      title={`Play ${song.title}`}
                    >
                      {/* Floating Play Button — visible only ≥sm */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playSong(song);
                        }}
                        title="Play"
                        aria-label="Play"
                        className="hidden sm:grid bg-green-600/90 w-12 h-12 rounded-full place-items-center
                                   absolute bottom-20 right-4 opacity-0 group-hover:opacity-100 translate-y-2
                                   group-hover:translate-y-0 transition duration-300 text-white text-2xl shadow-xl"
                      >
                        <IoMdPlay />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openPicker(song);
                        }}
                        className="absolute right-3 top-3 h-8 px-3 rounded-full text-xs bg-white/10 border border-white/10 hover:bg-white/15 backdrop-blur"
                        aria-label="Add to playlist"
                        title="Add to playlist"
                      >
                        + Playlist
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          authUser
                            ? toggleLike.mutate(song)
                            : toast("Please log in to like songs", { icon: "🔒" });
                        }}
                        className="absolute left-3 top-3 h-8 w-8 rounded-full grid place-items-center bg-white/10 border border-white/10 hover:bg-white/15 backdrop-blur"
                        aria-label={isLiked ? "Unlike" : "Like"}
                        title={isLiked ? "Unlike" : "Like"}
                        disabled={likedLoading || toggleLike.isPending}
                      >
                        {isLiked ? <IoMdHeart className="text-green-500" /> : <IoMdHeartEmpty />}
                      </button>

                      <div className="aspect-square w-full overflow-hidden rounded-md pointer-events-none">
                        <Image
                          src={song.cover_image_url}
                          alt={`${song.title} cover`}
                          width={500}
                          height={500}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="mt-3 space-y-1">
                        <p className="font-semibold text-sm line-clamp-1">{song.title}</p>
                        <p className="text-sm text-neutral-400 line-clamp-1">By {song.artist}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-8">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-white disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span className="text-neutral-300 text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-white disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </section>
          </main>

          <aside
            className={`lg:sticky lg:top-20 h-fit bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 transition-all duration-200 ${
              isPlayingSomething ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <h3 className="text-sm font-semibold text-neutral-300 mb-3">Now playing</h3>

            {isPlayingSomething && previewSong ? (
              <div className="space-y-3">
                <div className="relative">
                  <div className="aspect-[4/5] w-full overflow-hidden rounded-xl">
                    {(() => {
                      const vurl = getVideoUrl(previewSong);
                      return vurl ? (
                        <video
                          src={vurl}
                          width={800}
                          height={1000}
                          className="h-full w-full object-cover"
                          muted
                          autoPlay={allowAutoplay}
                          loop
                          playsInline
                          preload="metadata"
                          aria-label={`${previewSong.title} video preview`}
                        />
                      ) : (
                        <Image
                          src={previewSong.cover_image_url}
                          alt={`${previewSong.title} cover`}
                          width={800}
                          height={1000}
                          className="h-full w-full object-cover"
                        />
                      );
                    })()}
                  </div>
                  <button
                    className="absolute bottom-4 left-4 bg-white text-black rounded-full h-10 w-10 grid place-items-center shadow-lg"
                    onClick={() => playSong(previewSong)}
                    aria-label="Play now"
                  >
                    <IoMdPlay />
                  </button>
                </div>

                <div>
                  <h4 className="text-lg font-bold leading-tight line-clamp-2">
                    {previewSong.title}
                  </h4>
                  <p className="text-sm text-neutral-400">{previewSong.artist}</p>
                </div>
              </div>
            ) : (
              <p className="text-neutral-500 text-sm">Start playing to see the preview.</p>
            )}
          </aside>
        </div>
      </div>

      {pickerForSong && (
        <div
          className="fixed inset-0 z-[60] grid place-items-end md:place-items-center p-0 md:p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            className="absolute inset-0 bg-black/70"
            aria-label="Close"
            onClick={() => setPickerForSong(null)}
          />
          <div
            className="
              relative w-full md:max-w-md
              h-[85vh] md:h-auto
              max-h-[85vh] md:max-h-[90vh]
              rounded-t-2xl md:rounded-2xl
              bg-white/10 backdrop-blur-xl border border-white/10 shadow-2xl
              p-4 md:p-5
              flex flex-col
            "
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-bold">Add to playlist</h3>
                <p className="text-sm text-neutral-300 mt-1 line-clamp-1">
                  {pickerForSong.title} — {pickerForSong.artist}
                </p>
              </div>
              <button
                onClick={() => setPickerForSong(null)}
                className="h-9 px-3 rounded-lg bg-white/10 border border-white/10 hover:bg-white/15 text-sm"
              >
                Close
              </button>
            </div>

            {!authUser ? (
              <div className="mt-5">
                <p className="text-neutral-300">Please log in to use playlists.</p>
              </div>
            ) : (
              <>
                <div className="mt-5">
                  <p className="text-sm text-neutral-400 mb-2">Your playlists</p>
                  <div className="flex-1 overflow-y-auto md:max-h-52 space-y-2 pr-1">
                    {playlistsLoading ? (
                      <p className="text-neutral-400 text-sm">Loading…</p>
                    ) : playlists && playlists.length > 0 ? (
                      playlists.map((pl) => (
                        <button
                          key={pl.id}
                          onClick={() =>
                            addToPlaylist.mutate({
                              playlist_id: pl.id,
                              song_id: pickerForSong.id as unknown as number,
                            })
                          }
                          className="w-full text-left px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10"
                        >
                          {pl.name}
                        </button>
                      ))
                    ) : (
                      <p className="text-neutral-400 text-sm">No playlists yet.</p>
                    )}
                  </div>
                </div>

                <div className="mt-5 border-t border-white/10 pt-4">
                  <p className="text-sm text-neutral-400 mb-2">Create new playlist</p>
                  <div className="flex items-center gap-2">
                    <input
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      placeholder="Playlist name"
                      className="flex-1 h-10 rounded-lg bg-white/10 border border-white/10 px-3 outline-none placeholder:text-neutral-400"
                    />
                    <button
                      onClick={handleCreateAndAdd}
                      disabled={createPlaylist.isPending || addToPlaylist.isPending}
                      className="h-10 px-4 rounded-lg bg-[#1DB954] text-black font-semibold hover:brightness-110 disabled:opacity-60"
                    >
                      {createPlaylist.isPending ? "Creating…" : "Create"}
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="mt-5 md:flex md:justify-end hidden gap-2">
              <button
                onClick={() => setPickerForSong(null)}
                className="h-10 px-4 rounded-lg bg-white/10 border border-white/10 hover:bg-white/15"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
