import { useState, useEffect } from "react";
import { api, PolicyRole, AuditResponse } from "@/lib/api";

export default function EmployeeAuditView({
  nessieId,
  policyRoleStr,
}: {
  nessieId?: string;
  policyRoleStr: string;
}) {
  const [policy, setPolicy] = useState<PolicyRole | null>(null);
  const [auditData, setAuditData] = useState<AuditResponse | null>(null);
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
        const fetchedPolicy = (await api.getPolicy(safeRole)) as PolicyRole;
        setPolicy(fetchedPolicy);

        // Run the automated AI Audit for the recent transactions
        const audit = await api.runAudit({
          customer_id: nessieId,
          fraud_focus: true,
        });
        setAuditData(audit);
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
      <div className="flex justify-center flex-col items-center mt-12 space-y-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        <p className="text-zinc-500 font-medium">
          Running automated compliance audit...
        </p>
      </div>
    );
  }

  if (error || !nessieId) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-xl mt-6 text-center shadow-sm border border-red-100">
        <p className="font-semibold">Unable to load dashboard profile.</p>
        <p className="text-sm opacity-80 mt-1">
          {error || "Missing Nessie authentication."}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {/* Audit Report Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="p-6 border-b border-zinc-200 bg-zinc-50 flex flex-col md:flex-row md:items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 flex items-center space-x-2">
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
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <span>Automated Compliance Report</span>
            </h2>
            <p className="text-sm text-zinc-500 mt-1">{auditData?.summary}</p>
          </div>

          <div className="mt-4 md:mt-0 flex space-x-3">
            <div className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-semibold border border-red-100 flex items-center space-x-1">
              <span>High:</span> <span>{auditData?.high_risk_count || 0}</span>
            </div>
            <div className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-sm font-semibold border border-amber-100 flex items-center space-x-1">
              <span>Medium:</span>{" "}
              <span>{auditData?.medium_risk_count || 0}</span>
            </div>
            <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-semibold border border-emerald-100 flex items-center space-x-1">
              <span>Low:</span> <span>{auditData?.low_risk_count || 0}</span>
            </div>
          </div>
        </div>

        {auditData?.audit_results && auditData.audit_results.length > 0 ? (
          <div className="divide-y divide-zinc-100">
            {auditData.audit_results.map((result, idx) => (
              <div
                key={idx}
                className="p-6 hover:bg-zinc-50 transition-colors flex flex-col sm:flex-row gap-4"
              >
                <div className="sm:w-32 flex-shrink-0">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      result.risk_level.toLowerCase() === "high"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : result.risk_level.toLowerCase() === "medium"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                  >
                    {result.risk_level.toUpperCase()} RISK
                  </span>
                </div>
                <div className="flex-1 space-y-2">
                  <p className="font-semibold text-zinc-900">
                    {result.finding}
                  </p>
                  <p className="text-sm text-zinc-600">
                    <span className="font-medium text-zinc-700">
                      Violation:{" "}
                    </span>
                    {result.policy_violation}
                  </p>
                  <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                    <p className="text-sm text-indigo-900">
                      <span className="font-medium">Recommendation: </span>
                      {result.recommendation}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-zinc-500 bg-zinc-50/50">
            No transactions found to audit, or all transactions passed
            successfully.
          </div>
        )}
      </div>

      {/* Policy Details Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
        <h2 className="text-lg font-bold text-zinc-900 mb-4 pb-4 border-b border-zinc-100 flex items-center space-x-2">
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
          <div className="prose prose-sm max-w-none text-zinc-600 whitespace-pre-line bg-zinc-50 p-6 rounded-xl border border-zinc-100 leading-relaxed font-mono">
            {policy.policy}
          </div>
        ) : (
          <p className="text-zinc-500 italic">No policy documents found.</p>
        )}
      </div>
    </div>
  );
}
