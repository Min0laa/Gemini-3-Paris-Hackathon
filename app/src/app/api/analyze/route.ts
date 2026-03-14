import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";
import { findBestPlacement, findGoldenSpots, TranscriptSegment } from "@/lib/placement";
import { getMatchedAds } from "@/lib/ads";

async function fetchTranscript(videoId: string): Promise<TranscriptSegment[]> {
  const toSegments = (raw: Awaited<ReturnType<typeof YoutubeTranscript.fetchTranscript>>) =>
    raw.map((e) => ({ text: e.text, start: e.offset / 1000, duration: e.duration / 1000 }));

  // Try English first, then French, then whatever YouTube defaults to.
  // This avoids getting a dubbed/translated transcript when the original is EN.
  for (const lang of ["en", "fr", undefined] as const) {
    try {
      const raw = await YoutubeTranscript.fetchTranscript(videoId, lang ? { lang } : undefined);
      if (raw.length) return toSegments(raw);
    } catch { /* try next */ }
  }
  throw new Error("No transcript available for this video.");
}

export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get("v");
  if (!videoId) {
    return NextResponse.json({ error: "Missing video ID (?v=...)" }, { status: 400 });
  }

  let transcript: TranscriptSegment[];
  try {
    transcript = await fetchTranscript(videoId);
  } catch {
    return NextResponse.json(
      { error: `Could not fetch transcript for "${videoId}". Captions may be disabled.` },
      { status: 422 }
    );
  }

  if (transcript.length < 2) {
    return NextResponse.json({ error: "Transcript too short to analyze." }, { status: 422 });
  }

  // `placement` (singular) is consumed by the studio UI (PlacementWindow shape).
  // `golden_spots` is the richer output for the teammate frame-extraction pipeline.
  const placement    = findBestPlacement(transcript, 30);
  const golden_spots = findGoldenSpots(transcript, 2);
  const ads          = getMatchedAds("general");

  return NextResponse.json({ video_id: videoId, transcript, placement, golden_spots, ads });
}
