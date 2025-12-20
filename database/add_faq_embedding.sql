-- Add embedding support columns to faq_responses table
ALTER TABLE public.faq_responses
ADD COLUMN IF NOT EXISTS embedding_needs_update boolean NOT NULL DEFAULT false;

ALTER TABLE public.faq_responses
ADD COLUMN IF NOT EXISTS embedding_updated_at timestamp with time zone NULL;

COMMENT ON COLUMN public.faq_responses.embedding_needs_update IS 'Flag indicating if FAQ embedding needs generation/refresh';
COMMENT ON COLUMN public.faq_responses.embedding_updated_at IS 'Timestamp when the FAQ embedding was last generated';

-- Create index to efficiently query FAQs that need embedding
CREATE INDEX IF NOT EXISTS idx_faq_responses_embedding_needs_update
ON public.faq_responses(embedding_needs_update)
WHERE embedding_needs_update = true;

