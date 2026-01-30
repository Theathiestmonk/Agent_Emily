#!/usr/bin/env python3
"""
Script to enable Gmail sync for all existing Google connections
"""
import os
from dotenv import load_dotenv
from supabase import create_client

def main():
    # Load environment variables
    load_dotenv()

    # Initialize Supabase client
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    if not supabase_url or not supabase_key:
        print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return

    supabase = create_client(supabase_url, supabase_key)

    try:
        # Get all Google connections
        result = supabase.table('platform_connections').select('id, user_id, metadata').eq('platform', 'google').eq('is_active', True).execute()

        print(f'Found {len(result.data)} Google connections')

        updated_count = 0
        for conn in result.data:
            current_metadata = conn.get('metadata') or {}

            # Enable Gmail sync if not already enabled
            if not current_metadata.get('gmail_sync_enabled'):
                new_metadata = {
                    **current_metadata,
                    'gmail_sync_enabled': True,
                    'gmail_sync_status': 'active'
                }

                supabase.table('platform_connections').update({
                    'metadata': new_metadata
                }).eq('id', conn['id']).execute()

                updated_count += 1
                print(f'[OK] Enabled Gmail sync for user {conn["user_id"][:8]}...')

        print(f'\n[SUCCESS] Updated {updated_count} Google connections')
        print(f'[INFO] All Google connections now have Gmail sync enabled!')

    except Exception as e:
        print(f'[ERROR] Error: {str(e)}')

if __name__ == '__main__':
    main()
