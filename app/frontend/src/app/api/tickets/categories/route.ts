import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deriveCategoriesFromPolicyRole } from "@/lib/tickets";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const policyRole = (session.policyRole ?? "Associate").toString();
    const categories = deriveCategoriesFromPolicyRole(policyRole);

    return NextResponse.json({ role: policyRole, categories });
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 },
    );
  }
}

