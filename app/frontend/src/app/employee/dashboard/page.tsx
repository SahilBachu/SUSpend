"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function EmployeeDashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState("Employee");

  useEffect(() => {
    // Optionally fetch user session details here
    // For now, this is a placeholder
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-zinc-200 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100">
          <svg
            className="w-8 h-8 text-indigo-600"
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
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">
          Welcome, {userName}!
        </h1>
        <p className="text-zinc-500 mb-6">
          This is your employee dashboard. Further features will be added here
          soon.
        </p>
        <button
          onClick={async () => {
            try {
              await fetch("/api/auth/logout", { method: "POST" });
            } catch (err) {
              console.error("Logout failed", err);
            }
            router.push("/login");
          }}
          className="w-full py-2.5 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl font-medium transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
