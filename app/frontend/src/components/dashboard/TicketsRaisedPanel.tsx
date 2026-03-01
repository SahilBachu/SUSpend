"use client";

import { useEffect, useMemo, useState } from "react";

type TicketStatus = "pending" | "approved" | "rejected";

type TicketRecord = {
  id: string;
  employeeName: string;
  employeeUsername: string;
  category: string;
  overBudgetAmount: number;
  reason: string;
  status: TicketStatus;
  adminNote: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

const STATUS_STYLES: Record<TicketStatus, string> = {
  pending:
    "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900/50",
  approved:
    "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-900/50",
  rejected:
    "bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-200 dark:border-red-900/50",
};

export default function TicketsRaisedPanel() {
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewChecked, setReviewChecked] = useState<Record<string, boolean>>(
    {},
  );
  const [noteByTicket, setNoteByTicket] = useState<Record<string, string>>({});
  const [submittingByTicket, setSubmittingByTicket] = useState<
    Record<string, boolean>
  >({});
  const [filterStatus, setFilterStatus] = useState<TicketStatus | "all">("all");

  const counts = useMemo(
    () =>
      tickets.reduce(
        (acc, ticket) => {
          acc[ticket.status]++;
          acc.total++;
          return acc;
        },
        { pending: 0, approved: 0, rejected: 0, total: 0 },
      ),
    [tickets],
  );

  const filteredTickets = useMemo(
    () =>
      filterStatus === "all"
        ? tickets
        : tickets.filter((t) => t.status === filterStatus),
    [tickets, filterStatus],
  );

  async function loadTickets() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tickets");
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error || "Failed to load raised tickets");
      }
      setTickets(Array.isArray(body.tickets) ? body.tickets : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTickets();
  }, []);

  async function reviewTicket(
    ticketId: string,
    status: "approved" | "rejected",
  ) {
    const note = (noteByTicket[ticketId] || "").trim();
    if (!reviewChecked[ticketId]) {
      setError("Please check 'Reviewed' before approving or rejecting.");
      return;
    }
    if (!note) {
      setError("Please add an admin note before approving or rejecting.");
      return;
    }

    setError(null);
    setSubmittingByTicket((prev) => ({ ...prev, [ticketId]: true }));
    try {
      const res = await fetch(`/api/tickets/${ticketId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote: note }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error || "Failed to review ticket");
      }
      setTickets((prev) =>
        prev.map((ticket) => (ticket.id === ticketId ? body.ticket : ticket)),
      );
      setReviewChecked((prev) => ({ ...prev, [ticketId]: false }));
      setNoteByTicket((prev) => ({ ...prev, [ticketId]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to review ticket");
    } finally {
      setSubmittingByTicket((prev) => ({ ...prev, [ticketId]: false }));
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
      <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Tickets Raised
          </h3>
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
            {filterStatus === "all"
              ? `${counts.total} tickets, ${counts.approved} approved, ${counts.rejected} rejected, ${counts.pending} pending`
              : filterStatus === "pending"
                ? `${counts.pending} pending`
                : filterStatus === "approved"
                  ? `${counts.approved} approved`
                  : `${counts.rejected} rejected`}
          </span>
        </div>
        <div className="flex bg-zinc-200/50 dark:bg-zinc-800/50 p-1 rounded-lg">
          {(["all", "pending", "approved", "rejected"] as const).map(
            (status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                  filterStatus === status
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {status}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="p-6 space-y-4">
        {error && (
          <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {tickets.length === 0
              ? "No tickets have been raised yet."
              : "No tickets found for the selected filter."}
          </p>
        ) : (
          filteredTickets.map((ticket) => {
            const isPending = ticket.status === "pending";
            const isSubmitting = !!submittingByTicket[ticket.id];

            return (
              <div
                key={ticket.id}
                className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-700 dark:bg-zinc-800/60"
              >
                <div className="flex flex-wrap gap-2 items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {ticket.employeeName} ({ticket.employeeUsername})
                  </p>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[ticket.status]}`}
                  >
                    {ticket.status}
                  </span>
                </div>

                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <strong>Category:</strong> {ticket.category} &nbsp;•&nbsp;
                  <strong>Over budget:</strong> $
                  {ticket.overBudgetAmount.toFixed(2)}
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  {ticket.reason}
                </p>

                {isPending ? (
                  <div className="mt-4 space-y-3">
                    <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
                      <input
                        type="checkbox"
                        checked={!!reviewChecked[ticket.id]}
                        onChange={(e) =>
                          setReviewChecked((prev) => ({
                            ...prev,
                            [ticket.id]: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Reviewed
                    </label>

                    <textarea
                      rows={2}
                      value={noteByTicket[ticket.id] || ""}
                      onChange={(e) =>
                        setNoteByTicket((prev) => ({
                          ...prev,
                          [ticket.id]: e.target.value,
                        }))
                      }
                      placeholder="Add note for employee..."
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => reviewTicket(ticket.id, "approved")}
                        disabled={isSubmitting}
                        className="inline-flex items-center rounded-xl px-3 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewTicket(ticket.id, "rejected")}
                        disabled={isSubmitting}
                        className="inline-flex items-center rounded-xl px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <p>
                      Reviewed by {ticket.reviewedBy || "admin"} on{" "}
                      {ticket.reviewedAt
                        ? new Date(ticket.reviewedAt).toLocaleString()
                        : "N/A"}
                    </p>
                    {ticket.adminNote ? (
                      <p className="mt-1">Note: {ticket.adminNote}</p>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
