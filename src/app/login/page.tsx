"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import loginUser from "../../../api/auth/loginUser";
import getSupabaseClient from "../../../api/SupabaseClient";
export const dynamic = "force-dynamic";


export default function Page() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const spotify = useMemo(() => ({ green: "#1DB954" }), []);

  useEffect(() => {
    const checkSession = async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.push("/");
      } else {
        setLoading(false);
      }
    };
    checkSession();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!email.trim() || !password.trim()) {
      setMessage("All fields are required!");
      setLoading(false);
      return;
    }

    const result = await loginUser(email, password);

    if (result?.error) {
      setMessage(result.error);
      setLoading(false);
      return;
    }

    toast.success("Login Successful. Welcome to Groove!");
    setTimeout(() => {
      router.push("/");
    }, 1200);
  };

  if (loading) return null;

  return (
    <div className="relative min-h-screen w-full overflow-hidden p-4 flex items-center justify-center bg-[#0a0a0a]">
      <Toaster position="top-center" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 10% -10%, rgba(29,185,84,0.20), transparent 60%), radial-gradient(900px 500px at 110% 30%, rgba(29,185,84,0.10), transparent 60%), radial-gradient(700px 400px at 50% 120%, rgba(29,185,84,0.12), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12]
                   [background-image:linear-gradient(to_right,rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.12)_1px,transparent_1px)]
                   [background-size:64px_64px]"
      />

      <div
        className="relative w-full max-w-[440px]
                   rounded-2xl border border-white/10
                   bg-white/5 backdrop-blur-xl
                   shadow-[0_10px_60px_-10px_rgba(0,0,0,.8)]
                   px-6 lg:px-10 py-10"
      >
        <div
          aria-hidden
          className="absolute inset-0 rounded-2xl pointer-events-none -z-10"
          style={{
            padding: 1,
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.12), rgba(29,185,84,0.35))",
            mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMask:
              "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            maskComposite: "exclude",
            WebkitMaskComposite: "xor",
          }}
        />

        <header className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight">
            <span style={{ color: spotify.green }}>Groove</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-300/80">
            Log in to keep your groove going 🎧
          </p>
        </header>

        <form className="flex flex-col gap-5" onSubmit={handleLogin} noValidate>
          {message && (
            <p className="bg-[rgba(29,185,84,0.25)] border border-[rgba(29,185,84,0.35)] text-white font-medium text-sm text-center rounded-md py-2 px-4">
              {message}
            </p>
          )}

          <label className="group">
            <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-300/80">
              Email
            </span>
            <input
              onChange={(e) => setEmail(e.target.value)}
              value={email}
              type="email"
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-lg
                         bg-white/7.5 text-white placeholder:text-zinc-400
                         outline-none border border-white/10
                         focus:ring-2 focus:ring-[rgba(29,185,84,0.25)]
                         transition-all duration-300"
              disabled={loading}
              autoComplete="email"
              inputMode="email"
              required
            />
          </label>

          <label className="group">
            <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-300/80">
              Password
            </span>
            <div
              className="w-full flex items-stretch gap-2
                         rounded-lg border border-white/10 bg-white/7.5
                         focus-within:border-[rgba(29,185,84,0.7)]
                         focus-within:ring-2 focus-within:ring-[rgba(29,185,84,0.25)]
                         transition-all duration-300"
            >
              <input
                onChange={(e) => setPassword(e.target.value)}
                value={password}
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                className="flex-1 px-4 py-3 rounded-l-lg bg-transparent text-white placeholder:text-zinc-400 outline-none"
                disabled={loading}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="px-3 text-xs rounded-r-lg bg-white/10 hover:bg-white/15 text-white"
                aria-label={showPw ? "Hide password" : "Show password"}
                disabled={loading}
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <button
            type="submit"
            className="mt-2 w-full py-3 rounded-lg font-bold text-black
                       shadow-lg
                       transition-all duration-300
                       disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: spotify.green,
              boxShadow:
                "0 10px 30px -10px rgba(29,185,84,0.55), inset 0 0 0 1px rgba(0,0,0,0.15)",
            }}
            disabled={loading}
          >
            {loading ? "Logging in..." : "Log In"}
          </button>

          <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <input
                id="remember"
                type="checkbox"
                className="h-4 w-4 rounded border-white/20 bg-transparent text-black focus:ring-0"
                style={{ accentColor: spotify.green }}
                disabled={loading}
              />
              <label htmlFor="remember">Remember me</label>
            </div>
            <Link
              href="/forgot-password"
              className="underline decoration-transparent hover:decoration-inherit transition"
              style={{ color: spotify.green }}
            >
              Forgot password?
            </Link>
          </div>
        </form>

        <div className="text-zinc-300/90 text-center mt-8">
          <span>Don&apos;t have an account?</span>
          <Link
            href="/signup"
            className="ml-2 underline decoration-transparent hover:decoration-inherit transition"
            style={{ color: spotify.green }}
          >
            Sign up now
          </Link>
        </div>

        <div
          aria-hidden
          className="absolute -z-10 left-1/2 -translate-x-1/2 bottom-[-60px] h-40 w-[80%] rounded-full blur-3xl"
          style={{ background: "rgba(29,185,84,0.25)" }}
        />
      </div>
    </div>
  );
}
