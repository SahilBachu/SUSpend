import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listTicketsForEmployee } from "@/lib/tickets";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      tickets: listTicketsForEmployee(String(session.userId)),
    });
  } catch (error) {
    console.error("Failed to fetch employee tickets:", error);
    return NextResponse.json(
      { error: "Failed to fetch your tickets" },
      { status: 500 },
    );
  }
}

