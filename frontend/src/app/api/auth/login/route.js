import { NextResponse } from "next/server";
import { verifyCredentials } from "@/lib/authStore";

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const result = verifyCredentials(email, password);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      user: result.user,
      message: "Authentication successful.",
    });

    // Set HTTP-only session cookie
    response.cookies.set("vdockx_session", JSON.stringify(result.user), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login route error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error during authentication." },
      { status: 500 }
    );
  }
}
