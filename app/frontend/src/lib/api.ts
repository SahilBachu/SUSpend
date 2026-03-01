const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";

// ── Types ──────────────────────────────────────────────────────────────────

export interface Employee {
  customer_id: string;
  name: string;
}

export interface PolicyRole {
  title: string;
  policy: string;
}

export interface AuditResult {
  transaction_id: string;
  risk_level: string;
  finding: string;
  policy_violation: string;
  recommendation: string;
}

export interface AuditResponse {
  status: string;
  customer_id: string;
  audit_results: AuditResult[];
  summary: string;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
}

export interface EmailResponse {
  email_subject: string;
  email_body: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.error ?? body?.message ?? message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

// ── API client ─────────────────────────────────────────────────────────────

export const api = {
  /** GET /employees — list all customers, optionally filtered by exact name */
  getCustomers(name?: string): Promise<{ count: number; employees: Employee[] }> {
    const params = name ? `?name=${encodeURIComponent(name)}` : "";
    return request(`/employees${params}`);
  },

  /** GET /employees/search?query=<query> */
  searchCustomers(query: string): Promise<{ query: string; count: number; employees: Employee[] }> {
    return request(`/employees/search?query=${encodeURIComponent(query)}`);
  },

  /** GET /policy or GET /policy?role=<role> */
  getPolicy(role?: "Associate" | "Manager" | "VP"): Promise<
    { Associate: PolicyRole; Manager: PolicyRole; VP: PolicyRole } | PolicyRole
  > {
    const params = role ? `?role=${encodeURIComponent(role)}` : "";
    return request(`/policy${params}`);
  },

  /** POST /audit/run */
  runAudit(params: {
    customer_id: string;
    policy_text?: string;
    fraud_focus?: boolean;
  }): Promise<AuditResponse> {
    return request("/audit/run", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  /** POST /audit/email */
  generateEmail(params: {
    employee_name: string;
    audit_results: AuditResult[];
    summary: string;
  }): Promise<EmailResponse> {
    return request("/audit/email", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  /** GET /audit/health */
  getAuditHealth(): Promise<{ status: string; ollama_running: boolean; model: string }> {
    return request("/audit/health");
  },
};
