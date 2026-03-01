"use client";

import { useEffect, useState } from "react";

type TicketStatus = "pending" | "approved" | "rejected";

type TicketRecord = {
  id: string;
  category: string;
  overBudgetAmount: number;
  reason: string;
  status: TicketStatus;
  adminNote: string;
  createdAt: string;
  reviewedAt: string | null;
};

const STATUS_STYLES: Record<TicketStatus, string> = {
  pending:
    "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900/50",
  approved:
    "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-900/50",
  rejected:
    "bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-200 dark:border-red-900/50",
};

export default function EmployeeTicketRaising() {
  const [reason, setReason] = useState("");
  const [overBudgetAmount, setOverBudgetAmount] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadData() {
    setIsLoading(true);
    try {
      const [categoriesRes, myTicketsRes] = await Promise.all([
        fetch("/api/tickets/categories"),
        fetch("/api/tickets/my"),
      ]);

      if (!categoriesRes.ok) {
        throw new Error("Failed to load ticket categories");
      }
      if (!myTicketsRes.ok) {
        throw new Error("Failed to load your tickets");
      }

      const categoriesJson = await categoriesRes.json();
      const ticketsJson = await myTicketsRes.json();

      const parsedCategories = Array.isArray(categoriesJson.categories)
        ? categoriesJson.categories
        : [];
      setCategories(parsedCategories);
      setCategory(parsedCategories[0] || "");
      setTickets(Array.isArray(ticketsJson.tickets) ? ticketsJson.tickets : []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load ticket section";
      setFormError(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!reason.trim()) {
      setFormError("Please explain why you are going over the budget guidelines.");
      return;
    }
    const amount = Number(overBudgetAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Please enter a valid over-budget amount greater than 0.");
      return;
    }
    if (!category) {
      setFormError("Please choose a category.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim(),
          overBudgetAmount: amount,
          category,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error || "Failed to raise ticket");
      }

      setReason("");
      setOverBudgetAmount("");
      setSuccessMessage("Ticket raised successfully. Waiting for admin review.");
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to raise ticket");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden transition-colors dark:bg-zinc-900 dark:border-zinc-800">
      <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Ticket Raising
        </h3>
      </div>

      <div className="p-6 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="ticket-reason"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-2"
            >
              Why are you going over budget guidelines?
            </label>
            <textarea
              id="ticket-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/60 px-3 py-2 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              placeholder="Explain business context for this over-budget request..."
            />
          </div>

          <div>
            <label
              htmlFor="ticket-over-budget"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-2"
            >
              How much are you going over budget?
            </label>
            <input
              id="ticket-over-budget"
              type="number"
              min="0.01"
              step="0.01"
              value={overBudgetAmount}
              onChange={(e) => setOverBudgetAmount(e.target.value)}
              required
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/60 px-3 py-2 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              placeholder="e.g. 125.50"
            />
          </div>

          <div>
            <label
              htmlFor="ticket-category"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-2"
            >
              Which expense category is this in?
            </label>
            <select
              id="ticket-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/60 px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          {formError && (
            <p className="text-sm text-red-600 dark:text-red-300">{formError}</p>
          )}
          {successMessage && (
            <p className="text-sm text-emerald-600 dark:text-emerald-300">
              {successMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || isLoading}
            className="inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "Submitting..." : "Raise Ticket"}
          </button>
        </form>

        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Ticket Status
          </h4>

          {tickets.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No tickets raised yet.
            </p>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="rounded-xl border border-zinc-200 bg-zinc-50/70 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/70"
                >
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {ticket.category} • ${ticket.overBudgetAmount.toFixed(2)}
                    </p>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[ticket.status]}`}
                    >
                      {ticket.status}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">
                    {ticket.reason}
                  </p>
                  {ticket.adminNote ? (
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      Admin note: {ticket.adminNote}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200">
          If needed, please send extra proof to the admin by email before they
          verify your ticket.
        </div>
      </div>
    </section>
  );
}

