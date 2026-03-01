import json
import logging
import os
import sys

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

# ---------------------------------------------------------------------------
# LLM module path — must come before the LLM imports below
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "LLM"))

from audit_engine import run_audit_with_transactions  # noqa: E402
from data_validator import count_risk_levels  # noqa: E402
from ollama_client import (  # noqa: E402
    OllamaConnectionError,
    check_ollama_running,
    call_llama,
)
from prompt import (  # noqa: E402
    EMAIL_RESPONSE_SCHEMA,
    build_email_system_prompt,
    build_email_user_prompt,
)

app = Flask(__name__)
CORS(app)
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

NESSIE_API_KEY = os.getenv("NESSIE_API_KEY")
NESSIE_BASE_URL = os.getenv("NESSIE_BASE_URL", "http://api.nessieisreal.com")
REQUEST_TIMEOUT_SECONDS = 15 
VALID_POLICY_ROLES = {"Associate", "Manager", "VP"}

# Path to policy JSON (app/data/suspend_policy_nyc_hq_2026.json)
POLICY_FILE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "data", "suspend_policy_nyc_hq_2026.json"
)
ROLE_MAPPING_FILE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "data", "employee_role_mapping_nyc_hq_2026.json"
)
TICKETS_FILE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "data", "tickets_raised_nyc_hq_2026.json"
)

DEFAULT_POLICY = (
    "Meals and food expenses must not exceed $50 per transaction. "
    "Any single purchase above $50 requires a receipt. "
    "No personal or luxury items (e.g. clothing, jewelry, spa, gaming) may be expensed. "
    "Travel expenses above $200 require prior manager approval. "
    "Flag duplicate charges: same merchant, similar amount, within 7 days. "
    "Flag smurfing: multiple purchases just below the $50 receipt threshold from the same merchant."
)


def load_policies() -> dict:
    try:
        with open(POLICY_FILE_PATH, encoding="utf-8") as f:
            policies = json.load(f)
    except FileNotFoundError as exc:
        raise ValueError("Policy file not found") from exc
    except json.JSONDecodeError as exc:
        raise ValueError("Invalid policy file") from exc

    for role in VALID_POLICY_ROLES:
        if role not in policies:
            raise ValueError(
                f"Policy file missing role '{role}'. Expected roles: {sorted(VALID_POLICY_ROLES)}"
            )
    return policies


def load_employee_role_mapping() -> tuple[dict[str, str], dict[str, str]]:
    try:
        with open(ROLE_MAPPING_FILE_PATH, encoding="utf-8") as f:
            role_map = json.load(f)
    except FileNotFoundError as exc:
        raise ValueError("Employee role mapping file not found") from exc
    except json.JSONDecodeError as exc:
        raise ValueError("Invalid employee role mapping file") from exc

    customer_id_roles = role_map.get("customer_id_roles") or {}
    employee_name_roles = role_map.get("employee_name_roles") or {}

    normalized_name_roles = {}
    for name, role in employee_name_roles.items():
        if not isinstance(name, str) or not isinstance(role, str):
            continue
        normalized_name_roles[name.strip().lower()] = role.strip()

    for role in list(customer_id_roles.values()) + list(normalized_name_roles.values()):
        if role not in VALID_POLICY_ROLES:
            raise ValueError(
                f"Unknown role in mapping file: {role}. Allowed roles: {sorted(VALID_POLICY_ROLES)}"
            )

    return customer_id_roles, normalized_name_roles


def get_customer_name_by_id(customer_id: str) -> str | None:
    customers = get_customers()
    for customer in customers:
        if str(customer.get("_id")) == customer_id:
            return normalize_full_name(customer)
    return None


def resolve_policy_role(customer_id: str) -> tuple[str | None, str | None]:
    customer_id_roles, employee_name_roles = load_employee_role_mapping()
    role = customer_id_roles.get(customer_id)
    employee_name = None

    if not role:
        employee_name = get_customer_name_by_id(customer_id)
        if employee_name:
            role = employee_name_roles.get(employee_name.strip().lower())

    return role, employee_name


def load_ticket_store() -> dict:
    if not os.path.exists(TICKETS_FILE_PATH):
        return {"tickets": []}
    try:
        with open(TICKETS_FILE_PATH, encoding="utf-8") as f:
            parsed = json.load(f)
    except json.JSONDecodeError:
        logger.warning("Invalid tickets JSON file at %s; ignoring overrides", TICKETS_FILE_PATH)
        return {"tickets": []}
    tickets = parsed.get("tickets")
    if not isinstance(tickets, list):
        return {"tickets": []}
    return {"tickets": tickets}


def _normalize_category(value: str) -> str:
    if not isinstance(value, str):
        return ""
    lowered = value.strip().lower()
    return "".join(ch for ch in lowered if ch.isalnum())


def load_approved_tickets_for_customer(customer_id: str) -> list[dict]:
    store = load_ticket_store()
    approved = []
    for ticket in store["tickets"]:
        if not isinstance(ticket, dict):
            continue
        if str(ticket.get("status", "")).lower() != "approved":
            continue
        if str(ticket.get("nessieId", "")).strip() != customer_id:
            continue
        approved.append(ticket)
    return approved


def apply_approved_ticket_overrides(report, customer_id: str) -> int:
    approved_tickets = load_approved_tickets_for_customer(customer_id)
    if not approved_tickets:
        return 0

    override_count = 0
    for result in report.audit_results:
        if str(result.risk_level).lower() != "high":
            continue

        finding_category = _normalize_category(result.category)
        try:
            finding_overage = float(result.over_budget_amount or 0)
        except (TypeError, ValueError):
            finding_overage = 0.0

        matched_ticket = None
        for ticket in approved_tickets:
            ticket_category = _normalize_category(str(ticket.get("category", "")))
            try:
                approved_overage = float(ticket.get("overBudgetAmount", 0) or 0)
            except (TypeError, ValueError):
                approved_overage = 0.0
            if ticket_category == finding_category and finding_overage <= approved_overage:
                matched_ticket = ticket
                break

        if not matched_ticket:
            continue

        result.risk_level = "low"
        ticket_id = matched_ticket.get("id", "approved-ticket")
        override_note = (
            f"Ticket raised and approved ({ticket_id}) for category '{matched_ticket.get('category', 'N/A')}' "
            f"with approved over-budget amount ${float(matched_ticket.get('overBudgetAmount', 0) or 0):.2f}."
        )
        if override_note not in result.finding:
            result.finding = f"{result.finding} {override_note}".strip()
        if "ticket was raised and approved" not in result.recommendation.lower():
            result.recommendation = (
                f"{result.recommendation} Ticket was raised and approved by admin."
            ).strip()
        override_count += 1

    return override_count


def missing_api_key():
    return jsonify(
        {
            "error": "Missing NESSIE_API_KEY in environment",
            "hint": "Create app/backend/api/.env with NESSIE_API_KEY=your_key",
        }
    ), 500


def nessie_get(path: str, params: dict | None = None):
    query = params.copy() if params else {}
    query["key"] = NESSIE_API_KEY
    url = f"{NESSIE_BASE_URL}{path}"
    response = requests.get(url, params=query, timeout=REQUEST_TIMEOUT_SECONDS)
    response.raise_for_status()
    return response.json()


def normalize_full_name(customer: dict) -> str:
    first_name = customer.get("first_name", "").strip()
    last_name = customer.get("last_name", "").strip()
    return " ".join(part for part in [first_name, last_name] if part).strip() or "Unknown"


def get_customers():
    customers = nessie_get("/customers")
    if customers:
        return customers

    # Fallback for keys with enterprise read permissions.
    return nessie_get("/enterprise/customers")


def get_customer_accounts(customer_id: str):
    try:
        accounts = nessie_get(f"/customers/{customer_id}/accounts")
        if accounts:
            return accounts
    except requests.RequestException:
        pass

    return nessie_get(f"/enterprise/customers/{customer_id}/accounts")


def get_account_purchases(account_id: str):
    try:
        purchases = nessie_get(f"/accounts/{account_id}/purchases")
        if purchases:
            return purchases
    except requests.RequestException:
        pass

    return nessie_get(f"/enterprise/accounts/{account_id}/purchases")


def get_account_bills(account_id: str):
    try:
        bills = nessie_get(f"/accounts/{account_id}/bills")
        if bills:
            return bills
    except requests.RequestException:
        pass

    return nessie_get(f"/enterprise/accounts/{account_id}/bills")


def build_employee_statement(customer_id: str):
    accounts = get_customer_accounts(customer_id)
    statement_accounts = []
    all_card_transactions = []
    all_bills = []

    for account in accounts:
        account_id = account.get("_id")
        if not account_id:
            continue

        try:
            purchases = get_account_purchases(account_id)
        except requests.RequestException:
            purchases = []
        try:
            bills = get_account_bills(account_id)
        except requests.RequestException:
            bills = []

        account_transactions = []
        for purchase in purchases:
            transaction = {
                "transaction_id": purchase.get("_id"),
                "merchant_id": purchase.get("merchant_id"),
                "amount": purchase.get("amount"),
                "status": purchase.get("status"),
                "description": purchase.get("description"),
                "purchase_date": purchase.get("purchase_date"),
            }
            account_transactions.append(transaction)
            all_card_transactions.append(
                {
                    "account_id": account_id,
                    "account_type": account.get("type"),
                    **transaction,
                }
            )

        account_bills = []
        for bill in bills:
            mapped_bill = {
                "bill_id": bill.get("_id"),
                "status": bill.get("status"),
                "payee": bill.get("payee"),
                "nickname": bill.get("nickname"),
                "payment_date": bill.get("payment_date"),
                "recurring_date": bill.get("recurring_date"),
                "upcoming_payment_date": bill.get("upcoming_payment_date"),
                "payment_amount": bill.get("payment_amount"),
            }
            account_bills.append(mapped_bill)
            all_bills.append(
                {
                    "account_id": account_id,
                    "account_type": account.get("type"),
                    **mapped_bill,
                }
            )

        statement_accounts.append(
            {
                "account_id": account_id,
                "nickname": account.get("nickname"),
                "type": account.get("type"),
                "balance": account.get("balance"),
                "rewards": account.get("rewards"),
                "card_transactions": account_transactions,
                "bills": account_bills,
            }
        )

    return {
        "customer_id": customer_id,
        "account_count": len(statement_accounts),
        "accounts": statement_accounts,
        "card_transaction_count": len(all_card_transactions),
        "card_transactions": all_card_transactions,
        "bill_count": len(all_bills),
        "bills": all_bills,
    }


@app.get("/")
def home():
    return jsonify(
        {
            "message": "SUSpend API is running",
            "endpoints": [
                "/employees",
                "/employees/search?query=<name>",
                "/employees/<customer_id>/transactions",
                "/employees/<customer_id>/statement",
                "/employees/by-name/<employee_name>/statement",
                "GET  /policy — Expense policies by role (?role=Associate|Manager|VP optional)",
                "POST /audit/run — LLM audit for an employee (body: {customer_id, policy_text?, fraud_focus?})",
                "POST /audit/email — Generate email from audit results (body: {employee_name, audit_results, summary})",
                "GET  /audit/health — Ollama health check",
            ],
        }
    )


@app.get("/policy")
def get_policy():
    """
    Return expense policies from app/data/suspend_policy_nyc_hq_2026.json.

    Query params:
        role (optional): Filter to one role — Associate, Manager, or VP.

    Returns:
        200 { Associate: {...}, Manager: {...}, VP: {...} } or single role if ?role= specified
        500 if policy file missing or invalid
    """
    try:
        policies = load_policies()
    except ValueError as exc:
        logger.error("Policy load error: %s", exc)
        return jsonify({"error": str(exc)}), 500

    role = request.args.get("role", "").strip()
    if role:
        if role not in policies:
            return (
                jsonify(
                    {
                        "error": f"Unknown role: {role}",
                        "available_roles": list(policies.keys()),
                    }
                ),
                400,
            )
        return jsonify(policies[role])

    return jsonify(policies)


@app.get("/employees")
def get_employees():
    if not NESSIE_API_KEY:
        return missing_api_key()

    try:
        customers = get_customers()
    except requests.RequestException as error:
        return jsonify({"error": "Could not fetch employees", "details": str(error)}), 502

    selected_name = request.args.get("name", "").strip().lower()
    employees = []
    for customer in customers:
        full_name = normalize_full_name(customer)
        if selected_name and full_name.lower() != selected_name:
            continue
        employees.append(
            {
                "customer_id": customer.get("_id"),
                "name": full_name or "Unknown",
            }
        )

    return jsonify({"count": len(employees), "employees": employees})


@app.get("/employees/search")
def search_employees():
    if not NESSIE_API_KEY:
        return missing_api_key()

    query = request.args.get("query", "").strip().lower()
    if not query:
        return (
            jsonify(
                {
                    "error": "Missing required query parameter",
                    "hint": "Use /employees/search?query=<name>",
                }
            ),
            400,
        )

    try:
        customers = get_customers()
    except requests.RequestException as error:
        return jsonify({"error": "Could not fetch employees", "details": str(error)}), 502

    matches = []
    for customer in customers:
        full_name = normalize_full_name(customer)
        if query not in full_name.lower():
            continue
        matches.append(
            {
                "customer_id": customer.get("_id"),
                "name": full_name or "Unknown",
            }
        )

    return jsonify({"query": query, "count": len(matches), "employees": matches})


@app.get("/employees/<customer_id>/transactions")
def get_employee_transactions(customer_id: str):
    if not NESSIE_API_KEY:
        return missing_api_key()

    try:
        accounts = get_customer_accounts(customer_id)
    except requests.RequestException as error:
        return (
            jsonify(
                {
                    "error": "Could not fetch accounts for employee",
                    "customer_id": customer_id,
                    "details": str(error),
                }
            ),
            502,
        )

    transactions = []
    for account in accounts:
        account_id = account.get("_id")
        account_type = account.get("type")
        if not account_id:
            continue

        try:
            purchases = get_account_purchases(account_id)
        except requests.RequestException:
            purchases = []

        for purchase in purchases:
            transactions.append(
                {
                    "account_id": account_id,
                    "account_type": account_type,
                    "transaction_id": purchase.get("_id"),
                    "merchant_id": purchase.get("merchant_id"),
                    "amount": purchase.get("amount"),
                    "status": purchase.get("status"),
                    "description": purchase.get("description"),
                    "purchase_date": purchase.get("purchase_date"),
                }
            )

    return jsonify(
        {
            "customer_id": customer_id,
            "transaction_count": len(transactions),
            "transactions": transactions,
        }
    )


@app.get("/employees/<customer_id>/statement")
def get_employee_statement(customer_id: str):
    if not NESSIE_API_KEY:
        return missing_api_key()

    try:
        statement = build_employee_statement(customer_id)
        return jsonify(statement)
    except requests.RequestException as error:
        return (
            jsonify(
                {
                    "error": "Could not build employee statement",
                    "customer_id": customer_id,
                    "details": str(error),
                }
            ),
            502,
        )


@app.get("/employees/by-name/<employee_name>/statement")
def get_employee_statement_by_name(employee_name: str):
    if not NESSIE_API_KEY:
        return missing_api_key()

    try:
        customers = get_customers()
    except requests.RequestException as error:
        return jsonify({"error": "Could not fetch employees", "details": str(error)}), 502

    chosen = None
    for customer in customers:
        if normalize_full_name(customer).lower() == employee_name.strip().lower():
            chosen = customer
            break

    if not chosen:
        return (
            jsonify(
                {
                    "error": "Employee not found",
                    "selected_name": employee_name,
                }
            ),
            404,
        )

    customer_id = chosen.get("_id")
    if not customer_id:
        return jsonify({"error": "Employee record missing customer_id"}), 500

    try:
        statement = build_employee_statement(customer_id)
    except requests.RequestException as error:
        return (
            jsonify(
                {
                    "error": "Could not build employee statement",
                    "selected_name": employee_name,
                    "customer_id": customer_id,
                    "details": str(error),
                }
            ),
            502,
        )

    return jsonify(
        {
            "selected_name": normalize_full_name(chosen),
            **statement,
        }
    )


@app.post("/audit/run")
def audit_run():
    """
    Run an LLM-powered fraud/compliance audit for an employee.

    Request body (JSON):
        customer_id  (str, required)  — Nessie customer ID.
        policy_text  (str, optional)  — Plain-text spending policy; falls back
                                        to DEFAULT_POLICY when omitted.
        fraud_focus  (bool, optional) — Enable fraud-pattern detection prompt
                                        (default: true).

    Returns:
        200 { status, customer_id, audit_results, summary,
              high_risk_count, medium_risk_count, low_risk_count }
        400  missing / invalid input or bad LLM output
        404  no transactions found for the employee
        502  Nessie API error
        503  Ollama unreachable
        500  unexpected internal error
    """
    if not NESSIE_API_KEY:
        return missing_api_key()

    body = request.get_json(silent=True) or {}
    customer_id = body.get("customer_id", "").strip()
    if not customer_id:
        return jsonify({"error": "Missing required field: customer_id"}), 400

    policy_text = (body.get("policy_text") or "").strip()
    fraud_focus = bool(body.get("fraud_focus", True))
    policy_role = "custom"

    logger.info(
        "POST /audit/run | customer_id=%s | fraud_focus=%s", customer_id, fraud_focus
    )

    if not policy_text:
        try:
            policies = load_policies()
            policy_role, employee_name = resolve_policy_role(customer_id)
        except ValueError as exc:
            logger.error("Policy/role mapping error: %s", exc)
            return jsonify({"error": str(exc)}), 500
        except requests.RequestException as error:
            return (
                jsonify(
                    {
                        "error": "Could not fetch employees for role mapping",
                        "customer_id": customer_id,
                        "details": str(error),
                    }
                ),
                502,
            )

        if policy_role:
            policy_data = policies.get(policy_role) or {}
            policy_text = (policy_data.get("policy") or "").strip()
            if not policy_text:
                return (
                    jsonify(
                        {
                            "error": f"Policy text missing for mapped role '{policy_role}'",
                            "customer_id": customer_id,
                        }
                    ),
                    500,
                )
            logger.info(
                "POST /audit/run | auto-selected role=%s | employee_name=%s | customer_id=%s",
                policy_role,
                employee_name or "unknown",
                customer_id,
            )
        else:
            policy_text = DEFAULT_POLICY
            policy_role = "default"
            logger.warning(
                "POST /audit/run | no role mapping found, falling back to DEFAULT_POLICY | customer_id=%s",
                customer_id,
            )

    # ------------------------------------------------------------------
    # Fetch transactions (same logic as GET /employees/<id>/transactions)
    # ------------------------------------------------------------------
    try:
        accounts = get_customer_accounts(customer_id)
    except requests.RequestException as error:
        return (
            jsonify(
                {
                    "error": "Could not fetch accounts for employee",
                    "customer_id": customer_id,
                    "details": str(error),
                }
            ),
            502,
        )

    transactions = []
    for account in accounts:
        account_id = account.get("_id")
        if not account_id:
            continue
        try:
            purchases = get_account_purchases(account_id)
        except requests.RequestException:
            purchases = []
        for purchase in purchases:
            transactions.append(
                {
                    "transaction_id": purchase.get("_id"),
                    "account_id": account_id,
                    "account_type": account.get("type"),
                    "merchant_id": purchase.get("merchant_id"),
                    "amount": purchase.get("amount"),
                    "status": purchase.get("status"),
                    "description": purchase.get("description"),
                    "purchase_date": purchase.get("purchase_date"),
                }
            )

    if not transactions:
        return (
            jsonify(
                {
                    "error": "No transactions found for this employee",
                    "customer_id": customer_id,
                }
            ),
            404,
        )

    logger.info(
        "POST /audit/run | fetched %d transaction(s) | calling LLM", len(transactions)
    )

    # ------------------------------------------------------------------
    # Run LLM audit
    # ------------------------------------------------------------------
    try:
        report = run_audit_with_transactions(transactions, policy_text, fraud_focus=fraud_focus)
    except ValueError as exc:
        logger.warning("Audit input/validation error: %s", exc)
        return jsonify({"error": str(exc)}), 400
    except ConnectionError as exc:
        logger.error("Ollama unreachable: %s", exc)
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:
        logger.exception("Unexpected audit error: %s", exc)
        return jsonify({"error": f"Internal error: {exc}"}), 500

    ticket_override_applied_count = apply_approved_ticket_overrides(report, customer_id)
    counts = count_risk_levels(report)
    if ticket_override_applied_count:
        logger.info(
            "POST /audit/run | ticket overrides applied=%d | customer_id=%s",
            ticket_override_applied_count,
            customer_id,
        )

    return jsonify(
        {
            "status": "success",
            "customer_id": customer_id,
            "policy_role": policy_role,
            "ticket_override_applied_count": ticket_override_applied_count,
            "audit_results": [r.model_dump() for r in report.audit_results],
            "summary": report.summary,
            **counts,
        }
    )


@app.post("/audit/email")
def audit_email():
    """
    Generate an email to the employee summarizing their audit results.

    Request body (JSON): exactly what the frontend receives from POST /audit/run, plus employee_name:
        employee_name  (str, required) — Employee's name for the salutation.
        audit_results  (list, required) — From audit response.
        summary        (str, required) — From audit response.
        customer_id, status, high_risk_count, etc. are optional (ignored).

    Returns:
        200 { email_subject, email_body }
        400 missing/invalid input
        503 Ollama unreachable
    """
    body = request.get_json(silent=True) or {}
    employee_name = (body.get("employee_name") or "").strip()
    audit_results = body.get("audit_results")
    summary = (body.get("summary") or "").strip()

    if not employee_name:
        return jsonify({"error": "Missing required field: employee_name"}), 400
    if not isinstance(audit_results, list) or len(audit_results) == 0:
        return jsonify({"error": "Missing or empty audit_results"}), 400
    if not summary:
        return jsonify({"error": "Missing required field: summary"}), 400

    logger.info(
        "POST /audit/email | employee_name=%s | results_count=%d",
        employee_name,
        len(audit_results),
    )

    try:
        system_prompt = build_email_system_prompt()
        user_prompt = build_email_user_prompt(employee_name, audit_results, summary)
        result = call_llama(
            system_prompt,
            user_prompt,
            EMAIL_RESPONSE_SCHEMA,
            num_predict=1024,
        )
    except OllamaConnectionError as exc:
        logger.error("Ollama unreachable: %s", exc)
        return jsonify({"error": str(exc)}), 503
    except (ValueError, Exception) as exc:
        logger.exception("Email generation failed: %s", exc)
        return jsonify({"error": f"Email generation failed: {exc}"}), 500

    subject = result.get("email_subject", "Expense Audit Summary")
    body_text = (result.get("email_body") or "").strip()

    if not body_text:
        high_risk = [r for r in audit_results if str(r.get("risk_level", "")).lower() == "high"]
        medium_risk = [r for r in audit_results if str(r.get("risk_level", "")).lower() == "medium"]
        body_lines = [
            f"Dear {employee_name},",
            "",
            f"Your expense audit has been completed. {summary}",
            "",
        ]
        if high_risk or medium_risk:
            body_lines.append("The following transactions require your attention:")
            for r in high_risk + medium_risk:
                body_lines.append(f"- {r.get('finding', 'N/A')} (Recommendation: {r.get('recommendation', 'N/A')})")
            body_lines.extend(["", "Please review and respond to the compliance team.", ""])
        else:
            body_lines.extend(["All reviewed transactions were found to be compliant.", ""])
        body_lines.append("Best regards,")
        body_lines.append("Compliance Team")
        body_text = "\n".join(body_lines)
        logger.info("POST /audit/email | LLM returned empty body, using fallback")

    return jsonify({"email_subject": subject, "email_body": body_text})


@app.get("/audit/health")
def audit_health():
    """
    Health check for the LLM audit service.

    Returns:
        { status: "ok"|"degraded", ollama_running: bool, model: str }
    """
    model = "llama3"
    running = check_ollama_running(model=model)
    logger.info("GET /audit/health | ollama_running=%s", running)
    return jsonify(
        {
            "status": "ok" if running else "degraded",
            "ollama_running": running,
            "model": model,
        }
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000)
