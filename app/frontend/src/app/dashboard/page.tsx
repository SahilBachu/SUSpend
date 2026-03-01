import Navbar from "@/components/layout/Navbar";
import { UserDTO } from "@/types/user";

export default function Page() {
  const mockUser: UserDTO = {
    id: "1",
    name: "Alex Johnson",
    email: "alex@example.com",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex", // Generic avatar for demo
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar user={mockUser} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
            Dashboard Overview
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Welcome back! Here's what's happening today.
          </p>
        </header>

        {/* Placeholder for dashboard content */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 rounded-2xl border border-zinc-100 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-md"
            >
              <div className="h-4 w-1/3 rounded bg-zinc-100"></div>
              <div className="mt-4 h-8 w-2/3 rounded bg-zinc-50"></div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
