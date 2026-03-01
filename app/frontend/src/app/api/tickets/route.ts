import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createTicket, listTickets } from "@/lib/tickets";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ tickets: listTickets() });
  } catch (error) {
    console.error("Failed to list tickets:", error);
    return NextResponse.json(
      { error: "Failed to load tickets" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "employee") {
      return NextResponse.json(
        { error: "Only employees can raise tickets" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const reason = (body.reason ?? "").toString().trim();
    const category = (body.category ?? "").toString().trim();
    const overBudgetAmount = Number(body.overBudgetAmount ?? 0);

    if (!reason) {
      return NextResponse.json(
        { error: "Reason is required" },
        { status: 400 },
      );
    }
    if (!category) {
      return NextResponse.json(
        { error: "Category is required" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(overBudgetAmount) || overBudgetAmount <= 0) {
      return NextResponse.json(
        { error: "Over-budget amount must be greater than 0" },
        { status: 400 },
      );
    }

    const firstName = (session.firstName ?? "").toString().trim();
    const lastName = (session.lastName ?? "").toString().trim();
    const employeeName =
      `${firstName} ${lastName}`.trim() || session.username?.toString() || "Employee";
    const nessieId = session.nessie_id?.toString() || "";

    if (!nessieId) {
      return NextResponse.json(
        { error: "No Nessie ID found for this employee" },
        { status: 400 },
      );
    }

    const ticket = createTicket({
      employeeUserId: String(session.userId),
      employeeName,
      employeeUsername: String(session.username || "employee"),
      nessieId,
      category,
      overBudgetAmount,
      reason,
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    console.error("Failed to create ticket:", error);
    return NextResponse.json(
      { error: "Failed to create ticket" },
      { status: 500 },
    );
  }
}

