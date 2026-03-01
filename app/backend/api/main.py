import os

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request

app = Flask(__name__)
load_dotenv()

NESSIE_API_KEY = os.getenv("NESSIE_API_KEY")
NESSIE_BASE_URL = os.getenv("NESSIE_BASE_URL", "http://api.nessieisreal.com")
REQUEST_TIMEOUT_SECONDS = 15


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
            ],
        }
    )


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


if __name__ == "__main__":
    app.run(debug=True, port=5000)
