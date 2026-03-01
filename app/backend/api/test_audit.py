import requests
import json
import os
from dotenv import load_dotenv

load_dotenv('app/backend/api/.env')
key = os.getenv('NESSIE_API_KEY')

# Get a customer
customers = requests.get(f'http://api.nessieisreal.com/customers?key={key}').json()
if customers:
    customer_id = customers[0]['_id']
    print("Testing with customer:", customer_id)
    
    # Run audit
    res = requests.post("http://localhost:5000/audit/run", json={"customer_id": customer_id})
    if res.status_code == 200:
        data = res.json()
        print("Audit Results:")
        for r in data.get('audit_results', [])[:2]:
            print(f"Transaction ID: {r.get('transaction_id')}, Type: {r.get('type')}")
    else:
        print("Audit failed:", res.status_code, res.text)
