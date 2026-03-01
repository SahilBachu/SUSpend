import requests
import json
import sys

# Testing the Next.js backend auth logic

LOGIN_URL = 'http://localhost:3000/api/auth/login'
ME_URL = 'http://localhost:3000/api/auth/me'

def run():
    print("Testing Login...")
    session = requests.Session()
    resp = session.post(LOGIN_URL, json={"username": "admin", "password": "password123"})
    if not resp.ok:
        print(f"Login Failed: {resp.status_code} {resp.text}")
        sys.exit(1)
        
    print(f"Login Success: {resp.json()}")
    
    # ensure cookie was mapped
    if 'session' not in session.cookies:
        print("Error: No session cookie set!")
        sys.exit(1)
        
    print("Testing /api/auth/me...")
    me_resp = session.get(ME_URL)
    if not me_resp.ok:
        print(f"Me Endpoint Failed: {me_resp.status_code} {me_resp.text}")
        sys.exit(1)
        
    data = me_resp.json()
    print("Me Endpoint Success!")
    print(json.dumps(data, indent=2))
    
if __name__ == '__main__':
    run()
