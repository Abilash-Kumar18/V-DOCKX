import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const sessionCookie = request.cookies.get("vdockx_session");
    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const user = JSON.parse(sessionCookie.value);
    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
