-- Trigger to mark FAQ rows as needing embeddings
CREATE OR REPLACE FUNCTION public.set_faq_embedding_needs_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.embedding_needs_update = true;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_faq_embedding_needs_update ON public.faq_responses;

CREATE TRIGGER trigger_set_faq_embedding_needs_update
    BEFORE INSERT OR UPDATE ON public.faq_responses
    FOR EACH ROW
    EXECUTE FUNCTION public.set_faq_embedding_needs_update();

COMMENT ON FUNCTION public.set_faq_embedding_needs_update() IS 'Flags FAQ rows for embedding generation';

