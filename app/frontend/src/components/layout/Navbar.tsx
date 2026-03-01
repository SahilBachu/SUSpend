"use client";

import Image from "next/image";
import { UserDTO } from "@/types/user";
import UserDropdown from "./UserDropdown";

type NavbarProps = {
  user: UserDTO;
};

export default function Navbar({ user }: NavbarProps) {
  return (
    <nav className="sticky top-0 z-50 w-full border-b shadow-sm border-zinc-100 bg-white/80 backdrop-blur-md py-3 sm:py-4 lg:py-6">
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
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-semibold text-zinc-900">
            Hello, <span className="text-indigo-600">{user.name}</span>
          </h1>
        </div>

        {/* Right side: User Profile & Dropdown */}
        <UserDropdown user={user} />
      </div>
    </nav>
  );
}
