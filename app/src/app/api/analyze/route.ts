import { NextRequest, NextResponse } from "next/server";
import { findGoldenSpots, findTopPlacements, TranscriptSegment } from "@/lib/placement";
import { getMatchedAds } from "@/lib/ads";

function getMockTranscript(_videoId: string): TranscriptSegment[] {
  return [
    { text: "Welcome back to the channel, today we're talking about productivity.", start: 0, duration: 4 },
    { text: "I've been testing a new system for the past three months.", start: 4, duration: 3.5 },
    { text: "And honestly, it changed the way I work completely.", start: 7.5, duration: 3 },
    { text: "Let's start with the morning routine.", start: 12, duration: 2.5 },
    { text: "Every morning I spend 15 minutes planning my entire day.", start: 14.5, duration: 4 },
    { text: "The key is to prioritize only three tasks.", start: 18.5, duration: 3 },
    { text: "Not ten, not five — just three.", start: 21.5, duration: 2.5 },
    { text: "Alright, now let's talk about the tools I use.", start: 26, duration: 3 },
    { text: "First thing is note-taking. I tried everything on the market.", start: 29, duration: 4 },
    { text: "Obsidian, Notion, Apple Notes — they all have pros and cons.", start: 33, duration: 4 },
    { text: "But the one I keep coming back to is simple and flexible.", start: 37, duration: 3.5 },
    { text: "Okay so moving on to the second part of the system.", start: 42, duration: 3 },
    { text: "This is about deep work blocks. No notifications, no distractions.", start: 45, duration: 4 },
    { text: "I block two to three hours every morning for focused work.", start: 49, duration: 4 },
    { text: "During this time my phone is in another room.", start: 53, duration: 3 },
    { text: "The results after just two weeks were insane.", start: 58, duration: 3 },
    { text: "My output literally doubled. No exaggeration.", start: 61, duration: 3 },
    { text: "Now let's wrap up with the evening review.", start: 66, duration: 3 },
    { text: "Before bed I spend ten minutes reviewing what I did.", start: 69, duration: 3.5 },
    { text: "What worked, what didn't, and what I'll do tomorrow.", start: 72.5, duration: 3.5 },
    { text: "This closes the loop and reduces morning anxiety.", start: 76, duration: 3.5 },
    { text: "If you found this useful, subscribe and I'll see you next week.", start: 81, duration: 4 },
  ];
}

export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get("v");
  if (!videoId) {
    return NextResponse.json({ error: "Missing video ID" }, { status: 400 });
  }

  const transcript  = getMockTranscript(videoId);
  const goldenSpots = findGoldenSpots(transcript, 2);
  const placements  = findTopPlacements(transcript, 3, 30);
  const ads         = getMatchedAds("productivity");

  return NextResponse.json({ transcript, placements, golden_spots: goldenSpots, ads });
}
