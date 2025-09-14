#!/usr/bin/env python3
"""
Debug script to test Instagram/Facebook access tokens
"""

import httpx
import asyncio
import sys

async def test_token(token):
    """Test the access token with various endpoints"""
    
    print(f"Testing token: {token[:20]}...")
    print("=" * 50)
    
    async with httpx.AsyncClient() as client:
        # Test 1: Basic user info
        print("1. Testing /me endpoint...")
        try:
            response = await client.get(
                "https://graph.facebook.com/v18.0/me",
                params={
                    "access_token": token,
                    "fields": "id,name,email"
                }
            )
            print(f"   Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"   User: {data.get('name', 'Unknown')} (ID: {data.get('id', 'Unknown')})")
            else:
                print(f"   Error: {response.text}")
        except Exception as e:
            print(f"   Exception: {e}")
        
        print()
        
        # Test 2: User accounts
        print("2. Testing /me/accounts endpoint...")
        try:
            response = await client.get(
                "https://graph.facebook.com/v18.0/me/accounts",
                params={
                    "access_token": token,
                    "fields": "id,name,access_token,instagram_business_account"
                }
            )
            print(f"   Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                accounts = data.get('data', [])
                print(f"   Found {len(accounts)} accounts:")
                for i, account in enumerate(accounts):
                    print(f"     {i+1}. {account.get('name', 'Unknown')} (ID: {account.get('id', 'Unknown')})")
                    if account.get('instagram_business_account'):
                        ig_account = account['instagram_business_account']
                        print(f"        Instagram: {ig_account.get('id', 'Unknown')}")
            else:
                print(f"   Error: {response.text}")
        except Exception as e:
            print(f"   Exception: {e}")
        
        print()
        
        # Test 3: Instagram Business Account (if found)
        print("3. Testing Instagram Business Account...")
        try:
            # First get accounts
            accounts_response = await client.get(
                "https://graph.facebook.com/v18.0/me/accounts",
                params={
                    "access_token": token,
                    "fields": "id,name,instagram_business_account"
                }
            )
            
            if accounts_response.status_code == 200:
                accounts_data = accounts_response.json()
                instagram_account = None
                
                for account in accounts_data.get('data', []):
                    if account.get('instagram_business_account'):
                        instagram_account = account['instagram_business_account']
                        break
                
                if instagram_account:
                    print(f"   Found Instagram Business Account: {instagram_account.get('id', 'Unknown')}")
                    
                    # Test Instagram account details
                    ig_response = await client.get(
                        f"https://graph.facebook.com/v18.0/{instagram_account['id']}",
                        params={
                            "access_token": token,
                            "fields": "id,name,username,biography"
                        }
                    )
                    
                    print(f"   Instagram Status: {ig_response.status_code}")
                    if ig_response.status_code == 200:
                        ig_data = ig_response.json()
                        print(f"   Instagram Name: {ig_data.get('name', 'Unknown')}")
                        print(f"   Instagram Username: {ig_data.get('username', 'Unknown')}")
                    else:
                        print(f"   Instagram Error: {ig_response.text}")
                else:
                    print("   No Instagram Business Account found")
            else:
                print(f"   Error getting accounts: {accounts_response.text}")
        except Exception as e:
            print(f"   Exception: {e}")
        
        print()
        
        # Test 4: Token permissions
        print("4. Testing token permissions...")
        try:
            response = await client.get(
                "https://graph.facebook.com/v18.0/me/permissions",
                params={
                    "access_token": token
                }
            )
            print(f"   Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                permissions = data.get('data', [])
                print(f"   Permissions ({len(permissions)}):")
                for perm in permissions:
                    status = "✓" if perm.get('status') == 'granted' else "✗"
                    print(f"     {status} {perm.get('permission', 'Unknown')}")
            else:
                print(f"   Error: {response.text}")
        except Exception as e:
            print(f"   Exception: {e}")

async def main():
    if len(sys.argv) != 2:
        print("Usage: python debug_token.py <access_token>")
        sys.exit(1)
    
    token = sys.argv[1]
    await test_token(token)

if __name__ == "__main__":
    asyncio.run(main())
