import requests
import os
import json
from dotenv import load_dotenv

load_dotenv('app/backend/api/.env')
key = os.getenv('NESSIE_API_KEY')
print("Key:", "loaded" if key else "missing")

url_cust = f'http://api.nessieisreal.com/customers?key={key}'
customers = requests.get(url_cust).json()
if customers:
    c_id = customers[0]['_id']
    url_acc = f'http://api.nessieisreal.com/customers/{c_id}/accounts?key={key}'
    accounts = requests.get(url_acc).json()
    if accounts:
        a_id = accounts[0]['_id']
        url_pur = f'http://api.nessieisreal.com/accounts/{a_id}/purchases?key={key}'
        purchases = requests.get(url_pur).json()
        if purchases:
            print("Purchase object:", json.dumps(purchases[0], indent=2))
        else:
            print("No purchases found for this account")
    else:
        print("No accounts found")
else:
    print("No customers found")
