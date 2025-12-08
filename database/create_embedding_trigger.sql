-- Create database trigger to automatically flag profiles for embedding generation
-- This trigger sets embedding_needs_update = true whenever a profile is inserted or updated
-- The background worker will then process these profiles and generate embeddings

-- Create function to set embedding_needs_update flag
CREATE OR REPLACE FUNCTION public.set_embedding_needs_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Set flag to indicate embedding needs to be generated/updated
    NEW.embedding_needs_update = true;
    
    -- Return the modified row
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_set_embedding_needs_update ON public.profiles;

-- Create trigger that fires before INSERT or UPDATE on profiles table
CREATE TRIGGER trigger_set_embedding_needs_update
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_embedding_needs_update();

-- Add comment to document the trigger
COMMENT ON FUNCTION public.set_embedding_needs_update() IS 'Automatically sets embedding_needs_update flag when profile is inserted or updated';






