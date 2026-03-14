"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Ad } from "@/lib/ads";
import { PlacementWindow, TranscriptSegment, formatTimestamp } from "@/lib/placement";

interface AnalyzeResult {
  transcript: TranscriptSegment[];
  placement: PlacementWindow;
  ads: Ad[];
}

const NATIVE_SCRIPTS: Record<string, string> = {
  ad_1: `"By the way — this part of my workflow is completely powered by Notion. It's the tool I use to build every system I talk about on this channel. Your notes, your projects, your docs — all in one place. There's a link in the description if you want to try it. Okay, back to it —"`,
  ad_2: `"Quick shoutout to Squarespace for supporting this video. If you've been putting off building your site, they make it genuinely easy — drag, drop, done. Professional result, zero code. Link in the description. Now where were we —"`,
  ad_3: `"Before I go on — NordVPN is sponsoring today's video. I use it whenever I'm working from cafés or traveling. It keeps my connection private and it's literally one click. Use my link for a discount, it's in the description. Alright —"`,
  ad_4: `"This video is brought to you by Skillshare. If you want to go deeper on any of the concepts I cover here, they have thousands of classes on productivity, design, and more. First month is free with my link in the description. Check it out. Now back to the system —"`,
};

function StudioContent() {
  const params = useSearchParams();
  const videoId = params.get("v") ?? "";

  const [data, setData] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!videoId) return;
    fetch(`/api/analyze?v=${videoId}`)
      .then((r) => r.json())
      .then((d: AnalyzeResult) => {
        setData(d);
        setLoading(false);
      });
  }, [videoId]);

  function selectAd(id: string) {
    setSelectedAdId(id);
    setScriptReady(false);
  }

  function generateScript() {
    setGeneratingScript(true);
    setTimeout(() => {
      setGeneratingScript(false);
      setScriptReady(true);
    }, 1200);
  }

  function copyScript() {
    if (!selectedAd) return;
    navigator.clipboard.writeText(NATIVE_SCRIPTS[selectedAd.id] ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#ff0000] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#aaaaaa] text-sm">Analyzing your video…</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { transcript, placement, ads } = data;
  const selectedAd = ads.find((a) => a.id === selectedAdId) ?? null;
  const lastSeg = transcript[transcript.length - 1];
  const videoDuration = lastSeg ? lastSeg.start + lastSeg.duration : 85;
  const startPct = (placement.startTime / videoDuration) * 100;
  const windowPct = ((placement.endTime - placement.startTime) / videoDuration) * 100;

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#3f3f3f] px-6 py-3 flex items-center gap-3 shrink-0">
        <div className="w-7 h-7 bg-[#ff0000] rounded-md flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <span className="text-white font-semibold text-sm">AdBridge Studio</span>
        <div className="h-4 w-px bg-[#3f3f3f]" />
        <span className="text-[#aaaaaa] text-xs font-mono truncate max-w-sm">
          youtube.com/watch?v={videoId}
        </span>
        <div className="ml-auto">
          <span className="text-xs bg-green-900/30 text-green-400 border border-green-800/50 px-2 py-0.5 rounded-full">
            Analysis ready
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left column */}
        <div className="flex-1 flex flex-col gap-4 p-5 overflow-y-auto">

          {/* Video player */}
          <div className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-[#3f3f3f]">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>

          {/* Timeline */}
          <div className="bg-[#1f1f1f] border border-[#3f3f3f] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">Ad placement window</h2>
              <div className="text-xs text-[#aaaaaa] font-mono">
                <span className="text-[#ff0000]">{formatTimestamp(placement.startTime)}</span>
                {" → "}
                <span className="text-[#ff0000]">{formatTimestamp(placement.endTime)}</span>
                <span className="ml-1 text-[#aaaaaa]">
                  ({Math.round(placement.endTime - placement.startTime)}s window)
                </span>
              </div>
            </div>

            {/* Bar */}
            <div className="relative h-6 bg-[#0f0f0f] rounded-full overflow-hidden border border-[#3f3f3f]">
              {[25, 50, 75].map((p) => (
                <div
                  key={p}
                  className="absolute top-0 bottom-0 w-px bg-[#3f3f3f]/60"
                  style={{ left: `${p}%` }}
                />
              ))}
              <div
                className="absolute top-0 bottom-0 bg-[#ff0000]/20 border-x-2 border-[#ff0000] transition-all duration-500 flex items-center justify-center"
                style={{ left: `${startPct}%`, width: `${windowPct}%` }}
              >
                <span className="text-[#ff0000] text-[10px] font-bold tracking-widest uppercase">AD</span>
              </div>
            </div>

            <div className="flex justify-between mt-1 text-[10px] text-[#555] font-mono">
              <span>0:00</span>
              <span>{formatTimestamp(Math.floor(videoDuration / 2))}</span>
              <span>{formatTimestamp(Math.floor(videoDuration))}</span>
            </div>

            <p className="mt-3 text-xs text-[#aaaaaa] bg-[#0f0f0f] rounded-lg px-3 py-2 border border-[#3f3f3f]">
              <span className="text-[#ff0000] font-medium">Why here? </span>
              {placement.reason}
            </p>
          </div>

          {/* Transcript */}
          <div className="bg-[#1f1f1f] border border-[#3f3f3f] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Transcript</h2>
            <div className="space-y-0.5 max-h-64 overflow-y-auto pr-1">
              {transcript.map((seg, i) => {
                const inWindow = seg.start >= placement.startTime && seg.start < placement.endTime;
                const isStart = seg.start <= placement.startTime && seg.start + seg.duration > placement.startTime;
                const isEnd = seg.start < placement.endTime && seg.start + seg.duration >= placement.endTime;

                return (
                  <div key={i}>
                    {isStart && (
                      <div className="flex items-center gap-2 my-2">
                        <div className="flex-1 h-px bg-[#ff0000]/50" />
                        <span className="text-[10px] text-[#ff0000] font-semibold whitespace-nowrap uppercase tracking-wider">
                          ▼ Ad in — {formatTimestamp(placement.startTime)}
                        </span>
                        <div className="flex-1 h-px bg-[#ff0000]/50" />
                      </div>
                    )}
                    <div
                      className={`flex gap-3 px-2 py-1 rounded text-sm ${
                        inWindow ? "bg-[#ff0000]/8 border border-[#ff0000]/15" : "hover:bg-[#0f0f0f]/50"
                      }`}
                    >
                      <span className="text-[#555] font-mono text-xs pt-0.5 w-8 shrink-0">
                        {formatTimestamp(seg.start)}
                      </span>
                      <span className={inWindow ? "text-white/40 line-through" : "text-[#f1f1f1]"}>
                        {seg.text}
                      </span>
                    </div>
                    {isEnd && (
                      <div className="flex items-center gap-2 my-2">
                        <div className="flex-1 h-px bg-[#ff0000]/50" />
                        <span className="text-[10px] text-[#ff0000] font-semibold whitespace-nowrap uppercase tracking-wider">
                          ▲ Video resumes — {formatTimestamp(placement.endTime)}
                        </span>
                        <div className="flex-1 h-px bg-[#ff0000]/50" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column — Ads */}
        <div className="w-80 shrink-0 border-l border-[#3f3f3f] flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-[#3f3f3f]">
            <h2 className="text-sm font-semibold text-white">Matched ads</h2>
            <p className="text-xs text-[#aaaaaa] mt-0.5">Pick the ad to integrate in your video</p>
          </div>

          <div className="flex-1 p-3 space-y-2">
            {ads.map((ad) => (
              <button
                key={ad.id}
                onClick={() => selectAd(ad.id)}
                className={`w-full text-left rounded-xl border p-3.5 transition-all ${
                  selectedAdId === ad.id
                    ? "border-[#ff0000] bg-[#ff0000]/8"
                    : "border-[#3f3f3f] bg-[#1f1f1f] hover:border-[#666]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{ad.logo}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white font-semibold text-sm">{ad.brand}</span>
                      <span
                        className={`text-xs font-mono px-1.5 py-0.5 rounded-full border ${
                          ad.relevanceScore >= 90
                            ? "bg-green-900/30 text-green-400 border-green-800/50"
                            : ad.relevanceScore >= 80
                            ? "bg-yellow-900/30 text-yellow-400 border-yellow-800/50"
                            : "bg-[#0f0f0f] text-[#aaaaaa] border-[#3f3f3f]"
                        }`}
                      >
                        {ad.relevanceScore}%
                      </span>
                    </div>
                    <p className="text-xs text-[#aaaaaa] mt-0.5">{ad.tagline}</p>
                    <p className="text-xs text-[#666] mt-1 leading-relaxed">{ad.description}</p>
                  </div>
                </div>
                {selectedAdId === ad.id && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-[#ff0000]">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                      <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                    </svg>
                    Selected
                  </div>
                )}
              </button>
            ))}
          </div>

          {selectedAd && (
            <div className="p-4 border-t border-[#3f3f3f] space-y-3">
              <button
                onClick={generateScript}
                disabled={generatingScript}
                className="w-full bg-[#ff0000] hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {generatingScript ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Writing script…
                  </>
                ) : scriptReady ? (
                  "Regenerate script"
                ) : (
                  "Generate native script"
                )}
              </button>

              {scriptReady && (
                <div className="bg-[#0f0f0f] border border-[#3f3f3f] rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">
                      Say this at{" "}
                      <span className="text-[#ff0000]">{formatTimestamp(placement.startTime)}</span>
                    </span>
                    <span className="text-xs text-[#555]">{selectedAd.brand}</span>
                  </div>
                  <p className="text-sm text-[#f1f1f1] leading-relaxed italic">
                    {NATIVE_SCRIPTS[selectedAd.id]}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={copyScript}
                      className="flex-1 text-xs bg-[#1f1f1f] border border-[#3f3f3f] hover:border-[#666] text-white py-2 rounded-lg transition-colors"
                    >
                      {copied ? "Copied!" : "Copy script"}
                    </button>
                    <button className="flex-1 text-xs bg-[#ff0000]/10 border border-[#ff0000]/30 hover:bg-[#ff0000]/20 text-[#ff0000] py-2 rounded-lg transition-colors font-semibold">
                      Confirm ✓
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#ff0000] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <StudioContent />
    </Suspense>
  );
}
