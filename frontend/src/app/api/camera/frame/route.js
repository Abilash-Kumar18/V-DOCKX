import { NextResponse } from "next/server";
import { updateBroadcastData, getLatestBroadcastData } from "@/lib/videoBroadcaster";

export async function POST(request) {
  try {
    const body = await request.json();
    const { frame, pose, obstacle } = body;

    if (!frame && !pose && !obstacle) {
      return NextResponse.json({ error: "No frame, pose, or obstacle provided" }, { status: 400 });
    }

    updateBroadcastData({ frame, pose, obstacle });
    return NextResponse.json({ success: true, timestamp: Date.now() });
  } catch (error) {
    return NextResponse.json({ error: "Failed to broadcast data" }, { status: 500 });
  }
}

export async function GET() {
  const result = getLatestBroadcastData();
  return NextResponse.json(result);
}
