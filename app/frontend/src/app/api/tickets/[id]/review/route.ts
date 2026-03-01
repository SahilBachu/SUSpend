import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { reviewTicket } from "@/lib/tickets";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Ticket id is required" }, { status: 400 });
    }

    const body = await request.json();
    const status = (body.status ?? "").toString().toLowerCase();
    const adminNote = (body.adminNote ?? "").toString().trim();
    if (status !== "approved" && status !== "rejected") {
      return NextResponse.json(
        { error: "Status must be approved or rejected" },
        { status: 400 },
      );
    }
    if (!adminNote) {
      return NextResponse.json(
        { error: "Admin note is required for review" },
        { status: 400 },
      );
    }

    const reviewedBy =
      session.username?.toString() ||
      `${session.firstName || ""} ${session.lastName || ""}`.trim() ||
      "admin";

    const updated = reviewTicket(id, {
      status,
      adminNote,
      reviewedBy,
    });

    if (!updated) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json({ ticket: updated });
  } catch (error) {
    console.error("Failed to review ticket:", error);
    return NextResponse.json(
      { error: "Failed to review ticket" },
      { status: 500 },
    );
  }
}

