-- Diagnostic SQL to check Supabase Auth setup
-- Run this in Supabase SQL Editor to diagnose OAuth issues

-- 1. Check if handle_new_user function exists and is correct
SELECT 
    proname as function_name,
    prosrc as function_source,
    prosecdef as is_security_definer
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- 2. Check if trigger exists and is enabled
SELECT 
    tgname as trigger_name,
    tgtype,
    tgenabled as is_enabled,
    tgrelid::regclass as table_name
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- 3. Check profiles table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- 4. Check RLS policies on profiles table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles';

-- 5. Check if RLS is enabled
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'profiles';

-- 6. Test the handle_new_user function (this will show if there are any errors)
-- DO NOT RUN THIS IN PRODUCTION - it's just for testing
-- SELECT handle_new_user();

-- 7. Check for any constraints that might block inserts
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    tc.constraint_type
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'profiles'
ORDER BY tc.constraint_type, tc.constraint_name;

