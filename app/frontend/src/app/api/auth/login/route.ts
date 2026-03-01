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
        { status: 400 },
      );
    }

    const dbPath = path.join(process.cwd(), "..", "..", "db.json");
    const raw = fs.readFileSync(dbPath, "utf-8");
    const db = JSON.parse(raw) as {
      users: {
        id: number;
        username: string;
        password: string;
        role: string;
        firstName?: string;
        lastName?: string;
        nessie_id?: string;
      }[];
    };

    // Load Role Mappings for the Employee Policy Dashboard
    const mappingPath = path.join(
      process.cwd(),
      "..",
      "data",
      "employee_role_mapping_nyc_hq_2026.json",
    );
    let mappedRoles: {
      employee_name_roles: Record<string, string>;
      customer_id_roles: Record<string, string>;
    } = { employee_name_roles: {}, customer_id_roles: {} };
    try {
      mappedRoles = JSON.parse(fs.readFileSync(mappingPath, "utf-8"));
    } catch (err) {
      console.error("Could not load role mapping", err);
    }

    const user = db.users?.find(
      (u) => u.username === username && u.password === password,
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 },
      );
    }

    const fullNameStr = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    // Default to 'Associate' if no mapping exists so everyone gets a policy
    const policyRole =
      (user.nessie_id && mappedRoles.customer_id_roles[user.nessie_id]) ||
      (fullNameStr && mappedRoles.employee_name_roles[fullNameStr]) ||
      "Associate";

    const { signToken } = await import("@/lib/auth");
    const token = await signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      nessie_id: user.nessie_id,
      policyRole: policyRole,
    });

    const response = NextResponse.json({ success: true, role: user.role });
    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login Error:", error);
    return NextResponse.json(
      { success: false, error: "Invalid credentials" },
      { status: 401 },
    );
  }
}
