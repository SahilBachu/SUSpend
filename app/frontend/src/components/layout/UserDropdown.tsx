"use client";

import { useState, useRef, useEffect } from "react";
import { UserDTO } from "@/types/user";

type UserDropdownProps = {
  user: UserDTO;
};

export default function UserDropdown({ user }: UserDropdownProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-zinc-50"
        aria-expanded={isDropdownOpen}
        aria-haspopup="true"
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="h-9 w-9 rounded-full object-cover ring-2 ring-zinc-100"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 font-medium text-white shadow-sm ring-2 ring-zinc-100">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="absolute right-0 z-20 mt-2 w-48 origin-top-right rounded-xl border border-zinc-100 bg-white p-1 shadow-[0_10px_40px_rgba(0,0,0,0.08)] ring-1 ring-black/5 focus:outline-none">
          <div className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            User Menu
          </div>
          <button
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
            onClick={() => {
              console.log("Navigating to settings...");
              setIsDropdownOpen(false);
            }}
          >
            Settings
          </button>
          <div className="my-1 border-t border-zinc-50"></div>
          <button
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 transition-colors hover:bg-red-50/50"
            onClick={() => {
              console.log("Logging out...");
              setIsDropdownOpen(false);
            }}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
