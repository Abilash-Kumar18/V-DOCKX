import { NextResponse } from "next/server";
import { updateBroadcastData, getLatestBroadcastData } from "@/lib/videoBroadcaster";

export async function POST(request) {
  try {
    const body = await request.json();
    const { frame, pose, motion, destination, obstacle } = body;

    if (!frame && !pose && !motion && !destination && !obstacle) {
      return NextResponse.json({ error: "No telemetry, frame, or obstacle provided" }, { status: 400 });
    }

    updateBroadcastData({ frame, pose, motion, destination, obstacle });
    const latest = getLatestBroadcastData();

    // Direct server-to-server forward to FastAPI backend on localhost
    if (pose || motion) {
      try {
        fetch("http://127.0.0.1:8000/api/robot/motion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pose, motion }),
        }).catch(() => {});
      } catch (_) {}
    }

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      destination: latest.destination || { x: 1.0, y: 0.35 },
    });
  } catch (error) {
    console.error("Error in POST /api/camera/frame:", error);
    return NextResponse.json({ error: error?.message || "Failed to broadcast data" }, { status: 500 });
  }
}

export async function GET() {
  const result = getLatestBroadcastData();
  return NextResponse.json(result);
}
