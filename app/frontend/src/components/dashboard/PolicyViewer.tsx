"use client";

import { useEffect, useState } from "react";
import { api, PolicyRole } from "@/lib/api";

export default function PolicyViewer() {
  const [policies, setPolicies] = useState<{
    [key: string]: PolicyRole;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPolicies() {
      try {
        const data = await api.getPolicy();
        setPolicies(data as { [key: string]: PolicyRole });
      } catch (err: any) {
        setError(err.message || "Failed to load policies");
      } finally {
        setLoading(false);
      }
    }
    loadPolicies();
  }, []);

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col max-h-[800px]">
      <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/50 flex-shrink-0">
        <h3 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Company Spending Policy
        </h3>
      </div>
      <div className="p-6 prose prose-zinc prose-sm max-w-none text-zinc-600 flex-grow overflow-y-auto">
        {loading && (
          <div className="flex justify-center items-center py-10">
            <svg
              className="animate-spin h-6 w-6 text-indigo-500"
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
            <span className="ml-3 text-zinc-500">Loading policies...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100">
            {error}
          </div>
        )}

        {!loading && !error && policies && (
          <div className="space-y-6">
            <p className="leading-relaxed text-base">
              Employees are expected to exercise good judgment and discretion
              when incurring business expenses. Policies vary based on the
              employee's role level.
            </p>

            {Object.entries(policies).map(([role, policyData]) => (
              <details
                key={role}
                className="bg-amber-50 rounded-xl p-5 border border-amber-100 shadow-sm mt-4 group"
              >
                <summary className="text-amber-800 font-semibold cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center justify-between outline-none">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {policyData.title}
                  </div>
                  <svg
                    className="w-5 h-5 transition-transform group-open:-rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </summary>
                <div className="text-amber-900/80 text-sm whitespace-pre-wrap leading-relaxed pt-3 mt-3 border-t border-amber-200/60">
                  {policyData.policy}
                </div>
              </details>
            ))}

            <div className="mt-6 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
              <p className="leading-relaxed text-sm text-indigo-900/80">
                <strong className="text-indigo-900">
                  Auditor Instructions:
                </strong>{" "}
                When auditing an employee, verify that all submitted expenses
                adhere to these guidelines based on their role level. Flag any
                transactions that exceed limits, lack proper documentation, or
                appear unrelated to business activities.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
