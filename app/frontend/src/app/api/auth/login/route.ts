import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = (body.username ?? "").toString().trim();
    const password = (body.password ?? "").toString();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Username and password required" },
        { status: 400 }
      );
    }

    const dbPath = path.join(process.cwd(), "..", "..", "db.json");
    const raw = fs.readFileSync(dbPath, "utf-8");
    const db = JSON.parse(raw) as { users: { id: number; username: string; password: string }[] };

    const user = db.users?.find(
      (u) => u.username === username && u.password === password
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid credentials" },
      { status: 401 }
    );
  }
}
