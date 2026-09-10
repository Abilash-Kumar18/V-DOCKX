import { NextResponse } from "next/server";
import { registerUser } from "@/lib/authStore";

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Full Name, Email, and Password are all required." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const result = registerUser({ name, email, password });
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    const response = NextResponse.json({
      success: true,
      user: result.user,
      message: "Account registered successfully.",
    });

    response.cookies.set("vdockx_session", JSON.stringify(result.user), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create account." },
      { status: 500 }
    );
  }
}
