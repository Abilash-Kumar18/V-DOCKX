import { NextResponse } from "next/server";
import { updateFrame, getLatestFrame } from "@/lib/videoBroadcaster";

export async function POST(request) {
  try {
    const body = await request.json();
    const { frame } = body;

    if (!frame) {
      return NextResponse.json({ error: "No frame provided" }, { status: 400 });
    }

    updateFrame(frame);
    return NextResponse.json({ success: true, timestamp: Date.now() });
  } catch (error) {
    return NextResponse.json({ error: "Failed to broadcast frame" }, { status: 500 });
  }
}

export async function GET() {
  const result = getLatestFrame();
  return NextResponse.json(result);
}
