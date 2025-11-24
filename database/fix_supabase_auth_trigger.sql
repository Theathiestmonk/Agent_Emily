-- Fix Supabase Auth trigger for Google OAuth
-- Run this in Supabase SQL Editor if handle_new_user trigger is causing issues

-- 1. First, check if the function exists
DO $$
BEGIN
    -- Check if function exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user'
    ) THEN
        RAISE NOTICE 'Creating handle_new_user function...';
        
        -- Create the function
        CREATE OR REPLACE FUNCTION public.handle_new_user()
        RETURNS TRIGGER 
        SECURITY DEFINER
        SET search_path = public
        LANGUAGE plpgsql
        AS $$
        BEGIN
            -- Insert profile for new user
            INSERT INTO public.profiles (id, name, onboarding_completed)
            VALUES (
                NEW.id, 
                COALESCE(
                    NEW.raw_user_meta_data->>'name',
                    NEW.raw_user_meta_data->>'full_name',
                    NEW.email,
                    'User'
                ),
                FALSE
            )
            ON CONFLICT (id) DO NOTHING;
            
            RETURN NEW;
        EXCEPTION
            WHEN OTHERS THEN
                -- Log error but don't fail user creation
                RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
                RETURN NEW;
        END;
        $$;
        
        RAISE NOTICE 'Function created successfully';
    ELSE
        RAISE NOTICE 'Function already exists, updating it...';
        
        -- Update existing function to be more robust
        CREATE OR REPLACE FUNCTION public.handle_new_user()
        RETURNS TRIGGER 
        SECURITY DEFINER
        SET search_path = public
        LANGUAGE plpgsql
        AS $$
        BEGIN
            -- Insert profile for new user
            INSERT INTO public.profiles (id, name, onboarding_completed)
            VALUES (
                NEW.id, 
                COALESCE(
                    NEW.raw_user_meta_data->>'name',
                    NEW.raw_user_meta_data->>'full_name',
                    NEW.email,
                    'User'
                ),
                FALSE
            )
            ON CONFLICT (id) DO NOTHING;
            
            RETURN NEW;
        EXCEPTION
            WHEN OTHERS THEN
                -- Log error but don't fail user creation
                RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
                RETURN NEW;
        END;
        $$;
        
        RAISE NOTICE 'Function updated successfully';
    END IF;
END $$;

-- 2. Drop and recreate trigger to ensure it's correct
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 3. Verify trigger was created
SELECT 
    tgname as trigger_name,
    tgenabled as is_enabled,
    tgrelid::regclass as table_name
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- 4. Test the function (optional - uncomment to test)
-- This will show if there are any syntax errors
-- SELECT public.handle_new_user();

RAISE NOTICE '✅ Supabase Auth trigger setup complete!';

