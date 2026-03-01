import fs from "fs";
import path from "path";

export type TicketStatus = "pending" | "approved" | "rejected";

export interface TicketRecord {
  id: string;
  employeeUserId: string;
  employeeName: string;
  employeeUsername: string;
  nessieId: string;
  category: string;
  overBudgetAmount: number;
  reason: string;
  status: TicketStatus;
  adminNote: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

type TicketsStore = {
  tickets: TicketRecord[];
};

const DATA_DIR = path.join(process.cwd(), "..", "data");
const TICKETS_FILE_PATH = path.join(DATA_DIR, "tickets_raised_nyc_hq_2026.json");
const POLICY_FILE_PATH = path.join(DATA_DIR, "suspend_policy_nyc_hq_2026.json");

const DEFAULT_CATEGORIES = [
  "Meals & Dining",
  "Travel",
  "Office Supplies & Equipment",
  "Entertainment",
  "Other",
];

function ensureTicketsStore(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(TICKETS_FILE_PATH)) {
    fs.writeFileSync(
      TICKETS_FILE_PATH,
      JSON.stringify({ tickets: [] }, null, 2),
      "utf-8",
    );
  }
}

function readStore(): TicketsStore {
  ensureTicketsStore();
  const raw = fs.readFileSync(TICKETS_FILE_PATH, "utf-8");
  const parsed = JSON.parse(raw) as Partial<TicketsStore>;
  return { tickets: Array.isArray(parsed.tickets) ? parsed.tickets : [] };
}

function writeStore(store: TicketsStore): void {
  fs.writeFileSync(TICKETS_FILE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

function normalizeCategoryLabel(value: string): string {
  return value.replace(/\s+/g, " ").replace(/^\d+\.\s*/, "").trim();
}

function uniqueCategories(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeCategoryLabel(value);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

export function deriveCategoriesFromPolicyRole(policyRole: string): string[] {
  try {
    const raw = fs.readFileSync(POLICY_FILE_PATH, "utf-8");
    const policies = JSON.parse(raw) as Record<string, { policy?: string }>;
    const policyText = (policies[policyRole]?.policy || "").trim();
    if (!policyText) return DEFAULT_CATEGORIES;

    const sectionMatches = Array.from(
      policyText.matchAll(/^\s*\d+\.\s+([A-Z][A-Z &/,-]+)\s*$/gm),
    ).map((m) => m[1]);

    const categories = uniqueCategories(sectionMatches);
    return categories.length > 0 ? categories : DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export function listTickets(): TicketRecord[] {
  const store = readStore();
  return [...store.tickets].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function listTicketsForEmployee(employeeUserId: string): TicketRecord[] {
  return listTickets().filter((ticket) => ticket.employeeUserId === employeeUserId);
}

export function createTicket(input: {
  employeeUserId: string;
  employeeName: string;
  employeeUsername: string;
  nessieId: string;
  category: string;
  overBudgetAmount: number;
  reason: string;
}): TicketRecord {
  const store = readStore();
  const now = new Date().toISOString();
  const ticket: TicketRecord = {
    id: `ticket_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    employeeUserId: input.employeeUserId,
    employeeName: input.employeeName,
    employeeUsername: input.employeeUsername,
    nessieId: input.nessieId,
    category: normalizeCategoryLabel(input.category),
    overBudgetAmount: Number(input.overBudgetAmount),
    reason: input.reason.trim(),
    status: "pending",
    adminNote: "",
    createdAt: now,
    reviewedAt: null,
    reviewedBy: null,
  };
  store.tickets.push(ticket);
  writeStore(store);
  return ticket;
}

export function reviewTicket(
  ticketId: string,
  update: { status: "approved" | "rejected"; adminNote: string; reviewedBy: string },
): TicketRecord | null {
  const store = readStore();
  const idx = store.tickets.findIndex((ticket) => ticket.id === ticketId);
  if (idx < 0) return null;

  const current = store.tickets[idx];
  const reviewedTicket: TicketRecord = {
    ...current,
    status: update.status,
    adminNote: update.adminNote.trim(),
    reviewedBy: update.reviewedBy,
    reviewedAt: new Date().toISOString(),
  };

  store.tickets[idx] = reviewedTicket;
  writeStore(store);
  return reviewedTicket;
}

