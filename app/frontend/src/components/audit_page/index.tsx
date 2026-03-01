"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import * as XLSX from "xlsx";
import { api, AuditResult, AuditResponse, EmailResponse } from "@/lib/api";

interface StoredAuditData extends AuditResponse {
  employee_name: string;
}

const PIE_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#6366f1"];

function RiskBadge({ level }: { level: string }) {
  const normalized = level.toLowerCase();
  const styles: Record<string, string> = {
    high: "bg-red-100 text-red-700 border border-red-200",
    medium: "bg-amber-100 text-amber-700 border border-amber-200",
    low: "bg-green-100 text-green-700 border border-green-200",
  };
  const cls =
    styles[normalized] ?? "bg-zinc-100 text-zinc-600 border border-zinc-200";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${cls}`}
    >
      {level}
    </span>
  );
}

export default function AuditPage() {
  const router = useRouter();
  const [data, setData] = useState<StoredAuditData | null>(null);
  const [emailModal, setEmailModal] = useState<EmailResponse | null>(null);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [viewMode, setViewMode] = useState<string>("default");

  useEffect(() => {
    const raw = sessionStorage.getItem("audit_results");
    if (!raw) {
      router.replace("/admin/dashboard");
      return;
    }
    try {
      const parsed: StoredAuditData = JSON.parse(raw);
      setData(parsed);
    } catch {
      router.replace("/admin/dashboard");
    }
  }, [router]);

  if (!data) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const {
    employee_name,
    audit_results,
    summary,
    high_risk_count,
    medium_risk_count,
    low_risk_count,
  } = data;

  const pieData = [
    { name: "High Risk", value: high_risk_count },
    { name: "Medium Risk", value: medium_risk_count },
    { name: "Low Risk", value: low_risk_count },
  ].filter((d) => d.value > 0);

  function isInvalid(r: AuditResult) {
    const lvl = r.risk_level.toLowerCase();
    return lvl === "high" || lvl === "medium" || lvl === "low";
  }

  const riskWeight: Record<string, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  const processedResults = [...audit_results]
    .filter((r) => {
      if (viewMode === "high_only")
        return r.risk_level.toLowerCase() === "high";
      if (viewMode === "medium_only")
        return r.risk_level.toLowerCase() === "medium";
      if (viewMode === "low_only") return r.risk_level.toLowerCase() === "low";
      return true;
    })
    .sort((a, b) => {
      if (viewMode !== "desc" && viewMode !== "asc") return 0;
      const weightA = riskWeight[a.risk_level.toLowerCase()] || 0;
      const weightB = riskWeight[b.risk_level.toLowerCase()] || 0;
      return viewMode === "desc" ? weightB - weightA : weightA - weightB;
    });

  function handleExport() {
    const rows = audit_results.map((r) => ({
      Type: r.type || r.transaction_id,
      "Risk Level": r.risk_level,
      Finding: r.finding,
      "Policy Violation": r.policy_violation,
      Recommendation: r.recommendation,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit Results");
    const safeName = employee_name.replace(/\s+/g, "-").toLowerCase();
    XLSX.writeFile(wb, `audit-results-${safeName}.xlsx`);
  }

  async function handleGenerateEmail() {
    setIsGeneratingEmail(true);
    setEmailError(null);
    try {
      const result = await api.generateEmail({
        employee_name,
        audit_results,
        summary,
      });
      setEmailModal(result);
    } catch (err: unknown) {
      setEmailError(
        err instanceof Error ? err.message : "Failed to generate email.",
      );
    } finally {
      setIsGeneratingEmail(false);
    }
  }

  async function handleCopy() {
    if (!emailModal) return;
    await navigator.clipboard.writeText(
      `Subject: ${emailModal.email_subject}\n\n${emailModal.email_body}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="text-sm text-zinc-500 hover:text-indigo-600 flex items-center gap-1 mb-1 transition-colors"
            >
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold text-zinc-900">
              Audit Report —{" "}
              <span className="text-indigo-600">{employee_name}</span>
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {audit_results.length} transactions reviewed
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-700 bg-white hover:bg-zinc-50 transition-colors"
            >
              <svg
                className="w-4 h-4 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                />
              </svg>
              Export to Excel
            </button>
            <button
              onClick={handleGenerateEmail}
              disabled={isGeneratingEmail}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-transparent rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGeneratingEmail ? (
                <svg
                  className="animate-spin w-4 h-4"
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
              ) : (
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
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              )}
              Write Email
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {emailError && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl border border-red-100 text-sm">
            {emailError}
          </div>
        )}

        {/* Summary cards */}
        <div className="flex justify-center gap-4">
          {[
            {
              label: "High Risk",
              value: high_risk_count,
              color: "text-red-600 bg-red-50 border-red-100",
            },
            {
              label: "Medium Risk",
              value: medium_risk_count,
              color: "text-amber-600 bg-amber-50 border-amber-100",
            },
            {
              label: "Low Risk",
              value: low_risk_count,
              color: "text-green-600 bg-green-50 border-green-100",
            },
          ].map((card) => (
            <div
              key={card.label}
              className={`rounded-2xl border px-5 py-4 w-full max-w-[200px] ${card.color}`}
            >
              <p className="text-xs font-medium uppercase tracking-wide opacity-70">
                {card.label}
              </p>
              <p className="text-3xl font-bold mt-1">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">
              Transactions
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-zinc-700">
                  View:
                </label>
                <select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value)}
                  className="text-sm border-zinc-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-1 pl-2 pr-8"
                >
                  <option value="default">Default</option>
                  <option value="desc">Highest Risk First</option>
                  <option value="asc">Lowest Risk First</option>
                  <option value="high_only">High Risk Only</option>
                  <option value="medium_only">Medium Risk Only</option>
                  <option value="low_only">Low Risk Only</option>
                </select>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-100">
              <thead className="bg-zinc-50">
                <tr>
                  {[
                    "Type",
                    "Risk Level",
                    "Finding",
                    "Policy Violation",
                    "Recommendation",
                  ].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {processedResults.map((r) => (
                  <tr
                    key={r.transaction_id}
                    className="hover:bg-zinc-50/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900 whitespace-nowrap">
                      {r.type || r.transaction_id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <RiskBadge level={r.risk_level} />
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 max-w-xs">
                      {r.finding}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 max-w-xs">
                      {r.policy_violation}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 max-w-xs">
                      {r.recommendation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
          <h2 className="text-base font-semibold text-zinc-900 mb-4">
            Risk Distribution
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={3}
                dataKey="value"
                label={({
                  name,
                  percent,
                }: {
                  name?: string | number;
                  percent?: number;
                }) => `${name || ""} ${((percent || 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [value, "Transactions"]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </main>

      {/* Email Modal */}
      {emailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900">
                Generated Email
              </h2>
              <button
                onClick={() => setEmailModal(null)}
                className="text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">
                  Subject
                </p>
                <p className="text-sm font-medium text-zinc-800 bg-zinc-50 rounded-xl px-4 py-2.5 border border-zinc-200">
                  {emailModal.email_subject}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">
                  Body
                </p>
                <pre className="text-sm text-zinc-700 whitespace-pre-wrap bg-zinc-50 rounded-xl px-4 py-3 border border-zinc-200 font-sans leading-relaxed">
                  {emailModal.email_body}
                </pre>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-end gap-3">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-700 bg-white hover:bg-zinc-50 transition-colors"
              >
                {copied ? (
                  <>
                    <svg
                      className="w-4 h-4 text-green-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
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
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Copy to Clipboard
                  </>
                )}
              </button>
              <button
                onClick={() => setEmailModal(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
