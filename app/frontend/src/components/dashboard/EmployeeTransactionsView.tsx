"use client";

import { useState, useEffect } from "react";
import { api, PolicyRole } from "@/lib/api";

interface Transaction {
  transaction_id?: string;
  _id?: string;
  amount: number;
  description?: string;
  purchase_date: string;
  merchant_id?: string;
  status: string;
  type?: string;
  medium?: string;
  [key: string]: any; // Allow capturing rest of JSON
}

interface StatementData {
  account_count: number;
  card_transaction_count: number;
  card_transactions: Transaction[];
  bill_count: number;
}

export default function EmployeeTransactionsView({
  nessieId,
  policyRoleStr,
}: {
  nessieId?: string;
  policyRoleStr: string;
}) {
  const [statement, setStatement] = useState<StatementData | null>(null);
  const [policy, setPolicy] = useState<PolicyRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!nessieId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch specific Policy Role assigned to user
        const safeRole =
          policyRoleStr === "Manager" ||
          policyRoleStr === "VP" ||
          policyRoleStr === "Associate"
            ? policyRoleStr
            : "Associate";

        const [fetchedPolicy, response] = await Promise.all([
          api.getPolicy(safeRole) as Promise<PolicyRole>,
          fetch(`http://localhost:5000/employees/${nessieId}/statement`),
        ]);

        setPolicy(fetchedPolicy);

        if (!response.ok) {
          throw new Error("Failed to load user statements.");
        }

        const statementData = await response.json();
        setStatement(statementData);
      } catch (err: any) {
        console.error("Dashboard fetch error:", err);
        setError(err.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [nessieId, policyRoleStr]);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !nessieId) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-xl mt-6 text-center shadow-sm border border-red-100 dark:bg-red-950/30 dark:text-red-200 dark:border-red-900/60">
        <p className="font-semibold">Unable to load dashboard profile.</p>
        <p className="text-sm opacity-80 mt-1">
          {error || "Missing Nessie authentication."}
        </p>
      </div>
    );
  }

  const transactions = statement?.card_transactions || [];

  return (
    <div className="mt-8 space-y-6">
      {/* Metric Counters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
          <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-1 dark:text-zinc-400">
            Total Accounts
          </p>
          <h3 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {statement?.account_count || 0}
          </h3>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
          <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-1 dark:text-zinc-400">
            Card Transactions
          </p>
          <h3 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {statement?.card_transaction_count || 0}
          </h3>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
          <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-1 dark:text-zinc-400">
            Bills Tracked
          </p>
          <h3 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {statement?.bill_count || 0}
          </h3>
        </div>
      </div>

      {/* Recent Transactions List */}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
        <div className="p-6 border-b border-zinc-200 flex justify-between items-center dark:border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-900 flex items-center space-x-2 dark:text-zinc-100">
            <svg
              className="w-5 h-5 text-indigo-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            <span>Your Card Transactions</span>
          </h2>
        </div>

        {transactions.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 bg-zinc-50/50 dark:text-zinc-400 dark:bg-zinc-900">
            No recent transactions found.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {transactions.map((tx, idx) => (
              <div key={idx} className="flex flex-col">
                <div className="p-6 flex items-center justify-between hover:bg-zinc-50 transition-colors dark:hover:bg-zinc-800/60">
                  {(() => {
                    const rawDescription = tx.description || "Credit Card Transaction";
                    const cleanDescription = rawDescription
                      .replace(/\s*\[valid\]\s*/gi, " ")
                      .replace(/\s+/g, " ")
                      .trim();
                    return (
                    <div className="flex items-center space-x-4">
                      <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold dark:bg-indigo-900/40 dark:text-indigo-300">
                        {tx.description
                          ? tx.description.charAt(0).toUpperCase()
                          : "$"}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-900 max-w-xs truncate dark:text-zinc-100">
                          {cleanDescription || "Credit Card Transaction"}
                        </h3>
                        <p className="text-xs text-zinc-500 mt-1 dark:text-zinc-400">
                          {tx.purchase_date}
                        </p>
                      </div>
                    </div>
                    );
                  })()}

                    <div className="text-right flex items-center space-x-4">
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-zinc-100">
                          ${tx.amount.toFixed(2)}
                        </p>
                      </div>
                    </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Policy Details Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
        <h2 className="text-lg font-bold text-zinc-900 mb-4 pb-4 border-b border-zinc-100 flex items-center space-x-2 dark:text-zinc-100 dark:border-zinc-800">
          <svg
            className="w-5 h-5 text-indigo-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <span>
            Your Expense Policy Document ({policy?.title || policyRoleStr})
          </span>
        </h2>
        {policy?.policy ? (
          <div className="prose prose-sm max-w-none text-zinc-600 whitespace-pre-line bg-zinc-50 p-6 rounded-xl border border-zinc-100 leading-relaxed font-mono dark:text-zinc-300 dark:bg-zinc-800 dark:border-zinc-700">
            {policy.policy}
          </div>
        ) : (
          <p className="text-zinc-500 italic dark:text-zinc-400">No policy documents found.</p>
        )}
      </div>
    </div>
  );
}
