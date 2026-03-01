"""
Nessie Data Seeding Script
Populates the Nessie API sandbox with 10 employees and their transactions.
Includes valid expenses and fraudulent patterns for testing the audit engine.

Run once before the presentation:
    python backend/scripts/seed_nessie.py
"""

import os
import requests
import json
from datetime import datetime, timedelta

from dotenv import load_dotenv
load_dotenv()

# Configuration
NESSIE_API_KEY = os.getenv("NESSIE_API_KEY")
NESSIE_BASE_URL = os.getenv("NESSIE_BASE_URL", "http://api.nessieisreal.com")
REQUEST_TIMEOUT = 15

# Color output for better readability
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"
FAIL = "[X]"
PASS = "[OK]"


def make_request(method, path, data=None):
    """Make HTTP request to Nessie API."""
    url = f"{NESSIE_BASE_URL}{path}"
    params = {"key": NESSIE_API_KEY}

    try:
        if method == "GET":
            response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
        elif method == "POST":
            response = requests.post(url, json=data, params=params, timeout=REQUEST_TIMEOUT)
        elif method == "DELETE":
            response = requests.delete(url, params=params, timeout=REQUEST_TIMEOUT)

        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        err_msg = str(e)
        if hasattr(e, "response") and e.response is not None:
            resp = e.response
            try:
                err_body = resp.json()
                err_msg = f"{e}\n  Response: {err_body}"
            except Exception:
                err_msg = f"{e}\n  Response: {getattr(resp, 'text', '')[:300]}"
        print(f"{RED}{FAIL} Request failed: {err_msg}{RESET}")
        return None


def create_customer(first_name, last_name, address, city, state, zip_code):
    """Create a new customer. Nessie API expects address as object with street_number, street_name."""
    # Parse "123 Main St" -> street_number="123", street_name="Main St"
    parts = address.strip().split(None, 1)
    street_number = parts[0] if parts else ""
    street_name = parts[1] if len(parts) > 1 else ""

    data = {
        "first_name": first_name,
        "last_name": last_name,
        "address": {
            "street_number": street_number,
            "street_name": street_name,
            "city": city,
            "state": state,
            "zip": zip_code,
        },
    }
    result = make_request("POST", "/customers", data)
    if result and "objectCreated" in result:
        customer_id = result["objectCreated"]["_id"]
        print(f"{GREEN}{PASS} Created customer: {first_name} {last_name} ({customer_id}){RESET}")
        return customer_id
    print(f"{RED}{FAIL} Failed to create customer: {first_name} {last_name}{RESET}")
    return None


def create_account(customer_id, account_type, nickname, balance=5000):
    """Create an account for a customer."""
    data = {
        "type": account_type,
        "nickname": nickname,
        "balance": balance,
        "rewards": 0
    }
    result = make_request("POST", f"/customers/{customer_id}/accounts", data)
    if result and "objectCreated" in result:
        account_id = result["objectCreated"]["_id"]
        print(f"{GREEN}  {PASS} Created account: {nickname} ({account_id}){RESET}")
        return account_id
    print(f"{RED}  {FAIL} Failed to create account for customer {customer_id}{RESET}")
    return None


def get_merchants():
    """Fetch all merchants from Nessie API. Returns list of merchant dicts with _id and name."""
    try:
        resp = requests.get(
            f"{NESSIE_BASE_URL}/merchants",
            params={"key": NESSIE_API_KEY},
            timeout=REQUEST_TIMEOUT,
        )
        if resp.ok:
            data = resp.json()
            if isinstance(data, list):
                return data
    except Exception:
        pass
    return []


def create_merchant(name, category):
    """Create a merchant. Nessie requires merchants to exist before creating purchases."""
    data = {
        "name": name,
        "category": [category],  # Nessie expects array of category strings
    }
    result = make_request("POST", "/merchants", data)
    if result and "objectCreated" in result:
        merchant_id = result["objectCreated"]["_id"]
        return merchant_id
    return None


def build_merchant_cache():
    """Create or fetch merchants for all unique merchant names in EMPLOYEES."""
    merchant_names = set()
    for emp in EMPLOYEES:
        for merchant, _, _, _ in emp["transactions"]:
            merchant_names.add(merchant)

    # Category mapping for merchant creation
    MERCHANT_CATEGORIES = {
        "Chipotle": "Food",
        "Panera Bread": "Food",
        "Starbucks": "Food",
        "Nobu": "Food",
        "Subway": "Food",
        "Whole Foods": "Food",
        "Uber": "Travel",
        "Lyft": "Travel",
        "Marriott Hotel": "Travel",
        "Hyatt Hotel": "Travel",
        "United Airlines": "Travel",
        "Delta Air Lines": "Travel",
        "Southwest Airlines": "Travel",
        "Office Depot": "Merchandise",
        "Amazon": "Merchandise",
        "Target": "Merchandise",
        "CVS Pharmacy": "Merchandise",
        "Four Seasons": "Food",
        "Ruth's Chris": "Food",
        "Louis Vuitton": "Merchandise",
        "Gucci": "Merchandise",
        "Chanel": "Merchandise",
    }

    cache = {}
    existing = get_merchants()
    name_to_id = {}
    for m in existing:
        mname = m.get("name")
        mid = m.get("_id")
        if mname and mid:
            name_to_id[mname.lower().strip()] = mid

    # Match our merchant names to API merchants (exact or partial)
    fallback_id = existing[0].get("_id") if existing else None
    for name in merchant_names:
        key = name.lower().strip()
        if key in name_to_id:
            cache[name] = name_to_id[key]
        else:
            # Partial match: our "Chipotle" might match "Chipotle Mexican Grill"
            for api_name, mid in name_to_id.items():
                if key in api_name or api_name in key:
                    cache[name] = mid
                    break
        if name not in cache and fallback_id:
            cache[name] = fallback_id

    if cache:
        print(f"{GREEN}  {PASS} Resolved {len(cache)} merchants from API{RESET}")
    return cache


def create_purchase(account_id, merchant_id, amount, description, purchase_date):
    """Create a purchase/transaction for an account. merchant_id must be a valid Nessie merchant ID."""
    data = {
        "merchant_id": merchant_id,
        "amount": amount,
        "description": description,
        "purchase_date": purchase_date,
        "medium": "balance",
    }
    result = make_request("POST", f"/accounts/{account_id}/purchases", data)
    if result and ("message" in result or "objectCreated" in result):
        return True
    return False


# ============================================================================
# TEST DATA - 10 Employees with Valid and Fraudulent Transactions
# ============================================================================

EMPLOYEES = [
    {
        "first_name": "John",
        "last_name": "Smith",
        "address": "123 Main St",
        "city": "Rochester",
        "state": "NY",
        "zip": "14604",
        "account_nickname": "Corporate Card",
        "transactions": [
            ("Chipotle", 14.50, "Lunch", "valid"),
            ("Panera Bread", 12.75, "Lunch", "valid"),
            ("Uber", 18.99, "Business travel", "valid"),
            ("Marriott Hotel", 287.50, "Conference stay", "valid"),
            ("Office Depot", 45.80, "Supplies", "valid"),
        ]
    },
    {
        "first_name": "Sarah",
        "last_name": "Johnson",
        "address": "456 Oak Ave",
        "city": "Rochester",
        "state": "NY",
        "zip": "14605",
        "account_nickname": "Corporate Card",
        "transactions": [
            ("Chipotle", 49.99, "Lunch", "smurf_1"),
            ("Chipotle", 49.99, "Lunch", "smurf_2"),
            ("Chipotle", 49.99, "Lunch", "smurf_3"),
            ("Chipotle", 49.99, "Lunch", "smurf_4"),
            ("Chipotle", 49.99, "Lunch", "smurf_5"),
            ("Panera Bread", 15.00, "Lunch", "valid"),
            ("Starbucks", 6.50, "Coffee", "valid"),
        ]
    },
    {
        "first_name": "Michael",
        "last_name": "Chen",
        "address": "789 Pine Rd",
        "city": "Rochester",
        "state": "NY",
        "zip": "14606",
        "account_nickname": "Corporate Card",
        "transactions": [
            ("Whole Foods", 87.50, "Lunch", "mischaracterization"),
            ("Amazon", 120.00, "Supplies", "mischaracterization"),
            ("Target", 95.00, "Office needs", "mischaracterization"),
            ("Panera Bread", 18.50, "Lunch", "valid"),
            ("CVS Pharmacy", 45.99, "Personal", "invalid"),
        ]
    },
    {
        "first_name": "Emily",
        "last_name": "Williams",
        "address": "321 Elm St",
        "city": "Rochester",
        "state": "NY",
        "zip": "14607",
        "account_nickname": "Corporate Card",
        "transactions": [
            ("Marriott Hotel", 287.50, "Feb 15 stay", "valid"),
            ("Marriott Hotel", 287.50, "Feb 17 stay", "duplicate"),
            ("Marriott Hotel", 289.00, "Feb 20 stay", "valid"),
            ("United Airlines", 450.00, "Flight to NYC", "valid"),
            ("Uber", 25.00, "Ground transport", "valid"),
        ]
    },
    {
        "first_name": "David",
        "last_name": "Brown",
        "address": "654 Maple Dr",
        "city": "Rochester",
        "state": "NY",
        "zip": "14608",
        "account_nickname": "Corporate Card",
        "transactions": [
            ("Nobu", 50.00, "Lunch", "round_number"),
            ("Nobu", 100.00, "Lunch", "round_number"),
            ("Nobu", 150.00, "Lunch", "round_number"),
            ("Chipotle", 12.50, "Lunch", "valid"),
            ("Starbucks", 5.75, "Coffee", "valid"),
        ]
    },
    {
        "first_name": "Jessica",
        "last_name": "Martinez",
        "address": "987 Cedar Ln",
        "city": "Rochester",
        "state": "NY",
        "zip": "14609",
        "account_nickname": "Corporate Card",
        "transactions": [
            ("Four Seasons", 450.00, "Client dinner", "valid"),
            ("Ruth's Chris", 320.00, "Client entertainment", "valid"),
            ("Uber", 22.50, "Transport to client", "valid"),
            ("Starbucks", 6.25, "Coffee", "valid"),
            ("Whole Foods", 150.00, "Personal groceries", "mischaracterization"),
        ]
    },
    {
        "first_name": "Robert",
        "last_name": "Taylor",
        "address": "147 Birch Ct",
        "city": "Rochester",
        "state": "NY",
        "zip": "14610",
        "account_nickname": "Corporate Card",
        "transactions": [
            ("Chipotle", 13.50, "Lunch", "valid"),
            ("Panera Bread", 11.00, "Lunch", "valid"),
            ("Uber", 15.00, "Business travel", "valid"),
            ("Marriott Hotel", 175.00, "Business stay", "valid"),
            ("Southwest Airlines", 220.00, "Flight", "valid"),
        ]
    },
    {
        "first_name": "Laura",
        "last_name": "Anderson",
        "address": "258 Ash Pl",
        "city": "Rochester",
        "state": "NY",
        "zip": "14611",
        "account_nickname": "Corporate Card",
        "transactions": [
            ("Louis Vuitton", 2500.00, "Personal shopping", "luxury_fraud"),
            ("Gucci", 1800.00, "Personal shopping", "luxury_fraud"),
            ("Chanel", 3200.00, "Personal shopping", "luxury_fraud"),
            ("Chipotle", 12.00, "Lunch", "valid"),
            ("Starbucks", 5.50, "Coffee", "valid"),
        ]
    },
    {
        "first_name": "James",
        "last_name": "Wilson",
        "address": "369 Oak Rd",
        "city": "Rochester",
        "state": "NY",
        "zip": "14612",
        "account_nickname": "Corporate Card",
        "transactions": [
            ("Uber", 18.50, "Business travel", "valid"),
            ("Lyft", 19.75, "Business travel", "valid"),
            ("Delta Air Lines", 380.00, "Flight", "valid"),
            ("Hyatt Hotel", 210.00, "Hotel stay", "valid"),
            ("Chipotle", 14.25, "Lunch", "valid"),
        ]
    },
    {
        "first_name": "Patricia",
        "last_name": "Davis",
        "address": "741 Walnut St",
        "city": "Rochester",
        "state": "NY",
        "zip": "14613",
        "account_nickname": "Corporate Card",
        "transactions": [
            ("Chipotle", 49.99, "Lunch", "smurf_1"),
            ("Chipotle", 49.99, "Lunch", "smurf_2"),
            ("Panera Bread", 49.99, "Lunch", "smurf_3"),
            ("Panera Bread", 49.99, "Lunch", "smurf_4"),
            ("Subway", 49.99, "Lunch", "smurf_5"),
            ("Starbucks", 5.50, "Coffee", "valid"),
            ("Uber", 15.00, "Transport", "valid"),
        ]
    },
]


def generate_date(days_ago):
    """Generate a date string days_ago from today."""
    date = datetime.now() - timedelta(days=days_ago)
    return date.strftime("%Y-%m-%d")


def seed_nessie():
    """Main seeding function."""
    print(f"\n{YELLOW}========================================{RESET}")
    print(f"{YELLOW}Nessie API Data Seeding{RESET}")
    print(f"{YELLOW}========================================{RESET}\n")
    
    # Check API key
    if not NESSIE_API_KEY or NESSIE_API_KEY == "YOUR_API_KEY_HERE":
        print(f"{RED}✗ Error: NESSIE_API_KEY not set in environment{RESET}")
        print(f"{YELLOW}Set it with: export NESSIE_API_KEY=your_key_here{RESET}")
        return False

    # Build merchant cache (create merchants before purchases)
    print(f"{YELLOW}Setting up merchants...{RESET}")
    merchant_cache = build_merchant_cache()
    if not merchant_cache:
        print(f"{RED}{FAIL} No merchants available. Cannot create purchases.{RESET}")
    print()

    total_customers = 0
    total_accounts = 0
    total_transactions = 0
    
    # Seed each employee
    for employee in EMPLOYEES:
        print(f"{YELLOW}Creating employee: {employee['first_name']} {employee['last_name']}{RESET}")
        
        # Create customer
        customer_id = create_customer(
            employee["first_name"],
            employee["last_name"],
            employee["address"],
            employee["city"],
            employee["state"],
            employee["zip"]
        )
        
        if not customer_id:
            continue
        
        total_customers += 1
        
        # Create account
        account_id = create_account(
            customer_id,
            "Credit Card",
            employee["account_nickname"],
            balance=10000
        )
        
        if not account_id:
            continue
        
        total_accounts += 1
        
        # Add transactions
        for idx, (merchant, amount, description, pattern_type) in enumerate(employee["transactions"]):
            merchant_id = merchant_cache.get(merchant)
            if not merchant_id:
                print(f"{RED}    ✗ Skipping {merchant}: merchant not in cache{RESET}")
                continue

            days_ago = 45 - (idx * 4)
            purchase_date = generate_date(days_ago)

            success = create_purchase(
                account_id,
                merchant_id,
                amount,
                f"{description} [{pattern_type}]",
                purchase_date,
            )

            if success:
                total_transactions += 1
                print(f"    {PASS} {merchant}: ${amount} ({pattern_type})")
            else:
                print(f"{RED}    ✗ Failed to create transaction: {merchant}{RESET}")
        
        print()
    
    # Summary
    print(f"\n{YELLOW}========================================{RESET}")
    print(f"{GREEN}Seeding Complete!{RESET}")
    print(f"{YELLOW}========================================{RESET}")
    print(f"Customers created: {total_customers}")
    print(f"Accounts created: {total_accounts}")
    print(f"Transactions created: {total_transactions}")
    print(f"\n{GREEN}{PASS} Ready for testing!{RESET}\n")
    
    return True


if __name__ == "__main__":
    seed_nessie()