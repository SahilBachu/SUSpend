import { useState, useEffect } from "react";

interface Transaction {
  transaction_id: string;
  amount: number;
  description?: string;
  purchase_date: string;
  merchant_id: string;
  status: string;
}

interface StatementData {
  account_count: number;
  card_transaction_count: number;
  card_transactions: Transaction[];
  bill_count: number;
}

export default function EmployeeMetrics({
  nessieId,
  userName,
}: {
  nessieId?: string;
  userName: string;
}) {
  const [statement, setStatement] = useState<StatementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!nessieId) {
      setLoading(false);
      return;
    }

    async function fetchStatement() {
      try {
        const res = await fetch(
          `http://localhost:5000/employees/${nessieId}/statement`,
        );
        if (!res.ok) {
          throw new Error("Failed to fetch statement data");
        }
        const data = await res.json();
        setStatement(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchStatement();
  }, [nessieId]);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !nessieId) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-xl mt-6 text-center shadow-sm">
        <p>No financial statements found or an error occurred.</p>
        <p className="text-sm opacity-80 mt-1">
          {error || "Missing Nessie ID"}
        </p>
      </div>
    );
  }

  const transactions = statement?.card_transactions || [];

  return (
    <div className="mt-8 space-y-6">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
          <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-1">
            Total Accounts
          </p>
          <h3 className="text-3xl font-bold text-zinc-900">
            {statement?.account_count || 0}
          </h3>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
          <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-1">
            Card Transactions
          </p>
          <h3 className="text-3xl font-bold text-zinc-900">
            {statement?.card_transaction_count || 0}
          </h3>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
          <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-1">
            Bills Tracked
          </p>
          <h3 className="text-3xl font-bold text-zinc-900">
            {statement?.bill_count || 0}
          </h3>
        </div>
      </div>

      {/* Recent Transactions List */}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="p-6 border-b border-zinc-200">
          <h2 className="text-lg font-bold text-zinc-900">
            Recent Transactions
          </h2>
        </div>

        {transactions.length === 0 ? (
          <div className="p-6 text-center text-zinc-500">
            No recent transactions found.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {transactions.slice(0, 5).map((tx, idx) => (
              <li
                key={idx}
                className="p-6 flex items-center justify-between hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                    {tx.description
                      ? tx.description.charAt(0).toUpperCase()
                      : "$"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 truncate max-w-xs">
                      {tx.description || "Credit Card Transaction"}
                    </p>
                    <p className="text-xs text-zinc-500">{tx.purchase_date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-zinc-900">
                    ${tx.amount.toFixed(2)}
                  </p>
                  <p
                    className={`text-xs font-medium capitalize ${tx.status === "pending" ? "text-amber-500" : "text-emerald-500"}`}
                  >
                    {tx.status}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
