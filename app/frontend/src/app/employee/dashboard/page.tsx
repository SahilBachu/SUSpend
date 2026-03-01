"use client";

import { useEffect, useState } from "react";
import EmployeeTransactionsView from "@/components/dashboard/EmployeeTransactionsView";
import EmployeeTicketRaising from "@/components/dashboard/EmployeeTicketRaising";
import Navbar from "@/components/layout/Navbar";
import { UserDTO } from "@/types/user";

export default function EmployeeDashboard() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [user, setUser] = useState<{
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    nessieId?: string;
    policyRole?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem("admin-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldUseDark = savedTheme ? savedTheme === "dark" : prefersDark;
    setIsDarkMode(shouldUseDark);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", isDarkMode);
    localStorage.setItem("admin-theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

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
              email:
                data.user.email ||
                `${(data.user.username || "employee").toString()}@example.com`,
              avatarUrl: data.user.avatarUrl,
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

  const navbarUser: UserDTO = {
    id: user?.id || "employee",
    name: user?.name || "Employee",
    email: user?.email || "employee@example.com",
    avatarUrl:
      user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || "Employee"}`,
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 transition-colors dark:bg-zinc-950 dark:text-zinc-100">
      <Navbar
        user={navbarUser}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Metrics Component */}
        <EmployeeTransactionsView
          nessieId={user?.nessieId}
          policyRoleStr={user?.policyRole || "Associate"}
        />
        <div className="mt-8">
          <EmployeeTicketRaising />
        </div>
      </div>
    </div>
  );
}
