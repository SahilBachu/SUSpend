import requests

key = 'f14cb63b78cdfb16e2950ae14c0ca624'
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
            print("Purchase Object:")
            import json
            print(json.dumps(purchases[0], indent=2))
