"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  function extractVideoId(input: string): string | null {
    try {
      const u = new URL(input);
      if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
      return u.searchParams.get("v");
    } catch {
      return null;
    }
  }

  function handleAnalyze() {
    const videoId = extractVideoId(url.trim());
    if (!videoId) {
      setError("Please enter a valid YouTube video URL.");
      return;
    }
    setError("");
    router.push(`/studio?v=${videoId}`);
  }

  return (
    <main className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center px-4">
      <div className="mb-10 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-10 h-10 bg-[#ff0000] rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">AdBridge</h1>
        </div>
        <p className="text-[#aaaaaa] text-lg max-w-lg">
          Stop interrupting your viewers. Let AI find the perfect moment and write the sponsorship for you.
        </p>
      </div>

      <div className="w-full max-w-xl bg-[#1f1f1f] border border-[#3f3f3f] rounded-2xl p-8">
        <label className="block text-sm font-medium text-[#aaaaaa] mb-2">
          Your YouTube video URL
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
          placeholder="https://www.youtube.com/watch?v=..."
          className="w-full bg-[#0f0f0f] border border-[#3f3f3f] rounded-lg px-4 py-3 text-white placeholder-[#555] focus:outline-none focus:border-[#ff0000] transition-colors text-sm"
        />
        {error && <p className="text-[#ff0000] text-sm mt-2">{error}</p>}

        <button
          onClick={handleAnalyze}
          disabled={!url}
          className="mt-4 w-full bg-[#ff0000] hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors text-sm"
        >
          Analyze my video
        </button>
      </div>

      <div className="mt-12 grid grid-cols-3 gap-6 max-w-xl w-full text-center">
        {[
          { icon: "🎯", title: "Smart placement", desc: "AI finds the natural pause in your video" },
          { icon: "📢", title: "Matched ads", desc: "Only ads relevant to your content" },
          { icon: "✍️", title: "Native script", desc: "Reads like your own words, not an ad" },
        ].map((f) => (
          <div key={f.title} className="bg-[#1f1f1f] border border-[#3f3f3f] rounded-xl p-4">
            <div className="text-2xl mb-2">{f.icon}</div>
            <div className="text-white text-sm font-semibold">{f.title}</div>
            <div className="text-[#aaaaaa] text-xs mt-1">{f.desc}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
