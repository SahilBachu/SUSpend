"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import EmployeeTransactionsView from "@/components/dashboard/EmployeeTransactionsView";

export default function EmployeeDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{
    id: string;
    name: string;
    nessieId?: string;
    policyRole?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setUser({
              id: data.user.id.toString(),
              name:
                `${data.user.firstName || ""} ${data.user.lastName || ""}`.trim() ||
                data.user.username,
              nessieId: data.user.nessie_id,
              policyRole: data.user.policyRole,
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch session:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout failed", err);
    }
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-zinc-50 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
          <div className="flex items-center space-x-4 mb-4 md:mb-0">
            <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center border border-indigo-100">
              <svg
                className="w-6 h-6 text-indigo-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">
                Welcome, {user?.name || "Employee"}!
              </h1>
              <p className="text-zinc-500 text-sm">
                Here is your employee spending overview.
              </p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl font-medium transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Metrics Component */}
        <EmployeeTransactionsView
          nessieId={user?.nessieId}
          policyRoleStr={user?.policyRole || "Associate"}
        />
      </div>
    </div>
  );
}
