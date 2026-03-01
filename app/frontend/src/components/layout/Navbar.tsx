"use client";

import Image from "next/image";
import { UserDTO } from "@/types/user";
import UserDropdown from "./UserDropdown";

type NavbarProps = {
  user: UserDTO;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
};

export default function Navbar({
  user,
  isDarkMode,
  onToggleDarkMode,
}: NavbarProps) {
  return (
    <nav className="sticky top-0 z-50 w-full border-b shadow-sm border-zinc-100 bg-white/80 backdrop-blur-md py-3 sm:py-4 lg:py-6 transition-colors dark:border-zinc-700 dark:bg-zinc-800/90">
      <div className="mx-auto flex h-16 max-w-full items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left side: Greeting */}
        <div className="flex items-center gap-6">
          <Image
            src="/Feeling (5).png"
            alt="SUSpend logo"
            width={112}
            height={112}
            className="object-contain"
            priority
          />
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-semibold text-zinc-900 dark:text-zinc-100">
            Hello, <span className="text-indigo-600">{user.name}</span>
          </h1>
        </div>

        {/* Right side: User Profile & Dropdown */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label="Toggle theme"
            aria-pressed={isDarkMode}
            className="group inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <span>{isDarkMode ? "Dark" : "Light"}</span>
            <span
              className={`relative h-5 w-9 rounded-full transition-colors ${
                isDarkMode ? "bg-indigo-500" : "bg-zinc-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                  isDarkMode ? "right-0.5" : "left-0.5"
                }`}
              />
            </span>
          </button>
          <UserDropdown user={user} />
        </div>
      </div>
    </nav>
  );
}
