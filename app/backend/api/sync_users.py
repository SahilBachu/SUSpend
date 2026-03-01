import os
import sys
import json
import logging

# Ensure we can import from main.py
sys.path.insert(0, os.path.dirname(__file__))
from main import get_customers

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "..", "db.json")

def load_db():
    if not os.path.exists(DB_PATH):
        return {"users": []}
    with open(DB_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def save_db(db_data):
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db_data, f, indent=2)

def generate_username(first_name, last_name, existing_usernames):
    # Base format: firstname.lastname
    base = f"{first_name.lower()}.{last_name.lower()}".replace(" ", "")
    if not base or base == ".":
        base = "user"

    candidate = base
    counter = 1
    while candidate in existing_usernames:
        candidate = f"{base}{counter}"
        counter += 1
    
    return candidate

def run():
    logger.info(f"Loading database from {os.path.abspath(DB_PATH)}")
    db = load_db()
    
    users = db.get("users", [])
    
    # Track existing IDs and Usernames
    existing_usernames = {u.get("username").lower() for u in users if u.get("username")}
    existing_nessie_ids = {u.get("nessie_id") for u in users if u.get("nessie_id")}
    
    # Let's determine the next integer ID
    next_id = 1
    if len(users) > 0:
        max_id = max((u.get("id", 0) for u in users if isinstance(u.get("id"), int)), default=0)
        next_id = max_id + 1

    logger.info("Fetching customers from Nessie API...")
    try:
        customers = get_customers()
    except Exception as e:
        logger.error(f"Failed to fetch Nessie customers: {e}")
        sys.exit(1)
        
    if not customers:
        logger.warning("No customers returned from Nessie API.")
        return

    logger.info(f"Retrieved {len(customers)} customers.")

    added_count = 0
    for customer in customers:
        nessie_id = customer.get("_id")
        
        # Skip if already imported
        if nessie_id and nessie_id in existing_nessie_ids:
            continue
            
        first_name = customer.get("first_name", "").strip()
        last_name = customer.get("last_name", "").strip()
        
        if not first_name and not last_name:
            continue
            
        username = generate_username(first_name, last_name, existing_usernames)
        existing_usernames.add(username)
        
        new_user = {
            "id": next_id,
            "username": username,
            "password": "password123", # simple global password
            "role": "employee", # default role
            "firstName": first_name,
            "lastName": last_name,
            "nessie_id": nessie_id
        }
        
        users.append(new_user)
        existing_nessie_ids.add(nessie_id)
        next_id += 1
        added_count += 1
        
    db["users"] = users
    save_db(db)
    
    logger.info(f"Successfully added {added_count} new users to the database.")

if __name__ == "__main__":
    run()
