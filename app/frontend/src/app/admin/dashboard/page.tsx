"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import { UserDTO } from "@/types/user";
import PolicyViewer from "@/components/dashboard/PolicyViewer";
import EmployeeAuditSearch from "@/components/dashboard/EmployeeAuditSearch";

export default function Page() {
  const [isDarkMode, setIsDarkMode] = useState(false);

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

  const mockUser: UserDTO = {
    id: "1",
    name: "Alex Johnson",
    email: "alex@example.com",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex", // Generic avatar for demo
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 transition-colors dark:bg-zinc-950 dark:text-zinc-100">
      <Navbar
        user={mockUser}
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
