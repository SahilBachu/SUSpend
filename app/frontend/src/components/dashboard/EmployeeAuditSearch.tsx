"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, Employee } from "@/lib/api";

export default function EmployeeAuditSearch() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [isSearching, setIsSearching] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSelectedEmployee(null);
    setError(null);

    try {
      const { employees } = await api.searchCustomers(searchQuery);
      setSearchResults(employees);
    } catch (err: any) {
      console.error("Failed to search customers", err);
      setError(
        err.message || "Failed to search for employees. Please try again.",
      );
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchAllUsers = async () => {
    setIsSearching(true);
    setSelectedEmployee(null);
    setError(null);
    try {
      const { employees } = await api.getCustomers();
      setSearchResults(employees);
    } catch (err: any) {
      console.error("Failed to fetch all customers", err);
      setError(err.message || "Failed to fetch employees. Please try again.");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleBeginAudit = async () => {
    if (!selectedEmployee) return;
    setIsAuditing(true);
    setError(null);
    try {
      const response = await api.runAudit({
        customer_id: selectedEmployee.customer_id,
      });
      sessionStorage.setItem(
        "audit_results",
        JSON.stringify({ ...response, employee_name: selectedEmployee.name }),
      );
      router.push("/admin/dashboard/audit");
    } catch (err: any) {
      console.error("Audit failed", err);
      setError(err.message || "Audit failed. Please try again.");
      setIsAuditing(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col h-full transition-colors dark:bg-zinc-900 dark:border-zinc-800">
      <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-lg font-semibold text-zinc-900 flex items-center gap-2 dark:text-zinc-100">
          <svg
            className="w-5 h-5 text-indigo-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          Audit Employee
        </h3>
      </div>
      <div className="p-6 flex-grow flex flex-col min-h-0">
        <form onSubmit={handleSearch} className="mb-6 relative">
          <label htmlFor="search" className="sr-only">
            Search users
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-zinc-400 dark:text-zinc-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              id="search"
              type="text"
              className="block w-full pl-11 pr-[200px] py-3.5 border border-zinc-200 rounded-xl leading-5 bg-zinc-50/50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white sm:text-sm transition-all dark:border-zinc-700 dark:bg-zinc-800 dark:placeholder-zinc-500 dark:text-zinc-100 dark:focus:bg-zinc-800"
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="absolute inset-y-0 right-0 p-1.5 flex gap-2">
              <button
                type="button"
                onClick={fetchAllUsers}
                disabled={isSearching}
                className="inline-flex items-center px-4 py-2 border border-zinc-200 text-sm font-medium rounded-lg shadow-sm text-zinc-700 bg-white hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:border-zinc-700 dark:text-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:focus:ring-offset-zinc-900"
              >
                Fetch All
              </button>
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:focus:ring-offset-zinc-900"
              >
                {isSearching ? (
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : null}
                Search
              </button>
            </div>
          </div>
        </form>

        {/* Results Area */}
        <div className="flex-grow flex flex-col min-h-0">
          {error && (
            <div className="mb-4 bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 flex items-start gap-3 dark:bg-red-950/30 dark:text-red-200 dark:border-red-900/60">
              <svg
                className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="mb-3 text-sm font-medium text-zinc-500 px-1 flex items-center justify-between dark:text-zinc-400">
            <span>
              {searchResults.length > 0
                ? "Search Results"
                : searchQuery && !isSearching
                  ? "No results found"
                  : "Recent Searches"}
            </span>
            {searchResults.length > 0 && (
              <span className="text-xs bg-zinc-100 px-2 py-0.5 rounded-full text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {searchResults.length} found
              </span>
            )}
          </div>

          <div className="relative flex-1 min-h-0">
            <div className="absolute inset-0 border border-zinc-200 rounded-xl bg-white overflow-y-auto w-full dark:border-zinc-700 dark:bg-zinc-900">
              {searchResults.length === 0 && !isSearching ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center min-h-[200px]">
                  <div className="w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center mb-3 border border-zinc-100 dark:bg-zinc-800 dark:border-zinc-700">
                    <svg
                      className="w-6 h-6 text-zinc-400 dark:text-zinc-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-zinc-500 text-sm dark:text-zinc-400">
                    Enter a name or click Fetch All to find employees to audit.
                  </p>
                  <p className="text-zinc-400 text-xs mt-1 dark:text-zinc-500">
                    Try searching for "John" or "Sarah"
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {searchResults.map((emp) => (
                    <li key={emp.customer_id}>
                      <button
                        onClick={() => setSelectedEmployee(emp)}
                        className={`w-full text-left px-5 py-3.5 flex items-center space-x-4 hover:bg-zinc-50 transition-colors dark:hover:bg-zinc-800 ${
                          selectedEmployee?.customer_id === emp.customer_id
                            ? "bg-indigo-50/60 hover:bg-indigo-50/80 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/40 dark:ring-indigo-900/70"
                            : ""
                        }`}
                      >
                        <img
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${emp.name}`}
                          alt=""
                          className="w-10 h-10 rounded-full bg-zinc-100 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700"
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium truncate ${selectedEmployee?.customer_id === emp.customer_id ? "text-indigo-900 dark:text-indigo-200" : "text-zinc-900 dark:text-zinc-100"}`}
                          >
                            {emp.name}
                          </p>
                          <p
                            className={`text-xs truncate ${selectedEmployee?.customer_id === emp.customer_id ? "text-indigo-600 dark:text-indigo-300" : "text-zinc-500 dark:text-zinc-400"}`}
                          >
                            ID: {emp.customer_id}
                          </p>
                        </div>
                        {selectedEmployee?.customer_id === emp.customer_id && (
                          <svg
                            className="w-5 h-5 text-indigo-600 flex-shrink-0"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Action Area */}
        <div className="mt-8 pt-5 border-t border-zinc-100 flex items-center justify-between dark:border-zinc-800">
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            {selectedEmployee ? (
              <span className="flex items-center text-indigo-600 dark:text-indigo-300">
                <span className="w-2 h-2 rounded-full bg-indigo-600 mr-2"></span>
                {selectedEmployee.name} selected
              </span>
            ) : (
              "Select an employee to continue (policy is auto-selected by role)"
            )}
          </div>
          <button
            type="button"
            disabled={!selectedEmployee || isAuditing}
            onClick={handleBeginAudit}
            className="relative inline-flex items-center overflow-hidden px-6 py-2.5 border border-indigo-500/80 text-sm font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-[0_8px_20px_rgba(79,70,229,0.35)] hover:shadow-[0_10px_24px_rgba(79,70,229,0.5)] before:absolute before:inset-x-0 before:top-0 before:h-1/2 before:bg-gradient-to-b before:from-white/40 before:to-transparent before:pointer-events-none disabled:opacity-50 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:border-zinc-200 disabled:shadow-none disabled:before:from-transparent disabled:cursor-not-allowed transition-all dark:focus:ring-offset-zinc-900 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500 dark:disabled:border-zinc-700"
          >
            {isAuditing ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Running Audit…
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
                Begin Audit
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
