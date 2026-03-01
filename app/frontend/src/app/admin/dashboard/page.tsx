"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import { UserDTO } from "@/types/user";
import PolicyViewer from "@/components/dashboard/PolicyViewer";
import EmployeeAuditSearch from "@/components/dashboard/EmployeeAuditSearch";

export default function Page() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [user, setUser] = useState<UserDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem("admin-theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const shouldUseDark = savedTheme ? savedTheme === "dark" : prefersDark;
    setIsDarkMode(shouldUseDark);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", isDarkMode);
    localStorage.setItem("admin-theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  useEffect(() => {
    async function fetchUser() {
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
              email: `${data.user.username}@example.com`,
              avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.user.firstName || data.user.username}`,
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch session user:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchUser();
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  // Fallback just in case
  const defaultUser: UserDTO = {
    id: "unknown",
    name: "Admin",
    email: "admin@example.com",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin",
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 transition-colors dark:bg-zinc-950 dark:text-zinc-100">
      <Navbar
        user={user || defaultUser}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
      />
      <main className="mx-auto max-w-7xl px-6 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <PolicyViewer />
          <EmployeeAuditSearch />
        </div>
      </main>
    </div>
  );
}
