import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.userId,
        username: session.username,
        role: session.role,
        firstName: session.firstName,
        lastName: session.lastName,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { authenticated: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
