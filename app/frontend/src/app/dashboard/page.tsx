"use client";

import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import { UserDTO } from "@/types/user";
import PolicyViewer from "@/components/dashboard/PolicyViewer";
import EmployeeAuditSearch from "@/components/dashboard/EmployeeAuditSearch";

export default function Page() {
  const [selectedPolicy, setSelectedPolicy] = useState<{
    role: string;
    policyText: string;
  } | null>(null);

  const mockUser: UserDTO = {
    id: "1",
    name: "Alex Johnson",
    email: "alex@example.com",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex", // Generic avatar for demo
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <Navbar user={mockUser} />
      <main className="mx-auto max-w-7xl px-6 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <PolicyViewer
            selectedRole={selectedPolicy?.role ?? null}
            onSelectPolicy={(role, policyText) =>
              setSelectedPolicy({ role, policyText })
            }
          />
          <EmployeeAuditSearch policyText={selectedPolicy?.policyText ?? null} />
        </div>
      </main>
    </div>
  );
}
