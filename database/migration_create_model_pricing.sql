-- Migration: Create model_pricing table for dynamic pricing configuration
-- This table stores pricing information for all AI models used in the system
-- Pricing can be updated without code changes, allowing for easy maintenance

CREATE TABLE IF NOT EXISTS public.model_pricing (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    model_name text NOT NULL UNIQUE,
    model_type text NOT NULL CHECK (model_type IN ('chat', 'image', 'embedding')),
    input_price_per_1m numeric(12, 6) NOT NULL DEFAULT 0,
    output_price_per_1m numeric(12, 6) NOT NULL DEFAULT 0,
    fixed_price_per_unit numeric(12, 6) NOT NULL DEFAULT 0,
    unit_type text NOT NULL DEFAULT 'token' CHECK (unit_type IN ('token', 'image', 'request')),
    provider text NOT NULL DEFAULT 'openai' CHECK (provider IN ('openai', 'google', 'anthropic')),
    is_active boolean NOT NULL DEFAULT true,
    effective_date timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT model_pricing_pkey PRIMARY KEY (id),
    CONSTRAINT model_pricing_model_name_key UNIQUE (model_name)
) TABLESPACE pg_default;

-- Handle column name migration: drop old _1k columns and ensure _1m columns exist
DO $$
BEGIN
    -- Drop old columns if they exist (they have wrong naming)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'model_pricing' 
        AND column_name = 'input_price_per_1k'
    ) THEN
        ALTER TABLE public.model_pricing DROP COLUMN IF EXISTS input_price_per_1k;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'model_pricing' 
        AND column_name = 'output_price_per_1k'
    ) THEN
        ALTER TABLE public.model_pricing DROP COLUMN IF EXISTS output_price_per_1k;
    END IF;
END $$;

-- Add missing columns if table exists but columns are missing
ALTER TABLE public.model_pricing 
ADD COLUMN IF NOT EXISTS model_type text;

ALTER TABLE public.model_pricing 
ADD COLUMN IF NOT EXISTS input_price_per_1m numeric(12, 6) DEFAULT 0;

ALTER TABLE public.model_pricing 
ADD COLUMN IF NOT EXISTS output_price_per_1m numeric(12, 6) DEFAULT 0;

ALTER TABLE public.model_pricing 
ADD COLUMN IF NOT EXISTS fixed_price_per_unit numeric(12, 6) DEFAULT 0;

ALTER TABLE public.model_pricing 
ADD COLUMN IF NOT EXISTS unit_type text DEFAULT 'token';

ALTER TABLE public.model_pricing 
ADD COLUMN IF NOT EXISTS provider text DEFAULT 'openai';

ALTER TABLE public.model_pricing 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

ALTER TABLE public.model_pricing 
ADD COLUMN IF NOT EXISTS effective_date timestamp with time zone DEFAULT now();

ALTER TABLE public.model_pricing 
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

ALTER TABLE public.model_pricing 
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_model_pricing_model_name ON public.model_pricing USING btree (model_name) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_model_pricing_provider ON public.model_pricing USING btree (provider) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_model_pricing_active ON public.model_pricing USING btree (is_active) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_model_pricing_type ON public.model_pricing USING btree (model_type) TABLESPACE pg_default;

-- Add comments for documentation
COMMENT ON TABLE public.model_pricing IS 'Stores pricing configuration for AI models. Prices are per 1M tokens for chat models, per image for image models.';
COMMENT ON COLUMN public.model_pricing.input_price_per_1m IS 'Price per 1 million input tokens (for chat models)';
COMMENT ON COLUMN public.model_pricing.output_price_per_1m IS 'Price per 1 million output tokens (for chat models)';
COMMENT ON COLUMN public.model_pricing.fixed_price_per_unit IS 'Fixed price per unit (for image models, per image)';
COMMENT ON COLUMN public.model_pricing.unit_type IS 'Unit of measurement: token, image, or request';
COMMENT ON COLUMN public.model_pricing.effective_date IS 'Date when this pricing became effective';

-- Insert initial pricing data (OpenAI pricing as of January 2025)
-- Chat Models (per 1M tokens)
-- Use DO UPDATE to update existing records with correct pricing
INSERT INTO public.model_pricing (model_name, model_type, input_price_per_1m, output_price_per_1m, unit_type, provider, is_active, effective_date)
VALUES
    -- GPT-4 (8k context) - Official pricing: $30/$60 per 1M tokens
    ('gpt-4', 'chat', 30.0, 60.0, 'token', 'openai', true, now()),
    -- GPT-4 Turbo (128k context) - Official pricing: $10/$30 per 1M tokens
    ('gpt-4-turbo', 'chat', 10.0, 30.0, 'token', 'openai', true, now()),
    -- GPT-4o (latest version 2024-11-20) - Official pricing: $2.50/$10.00 per 1M tokens
    -- Note: Updated from $5.00/$15.00 to reflect latest pricing reduction
    ('gpt-4o', 'chat', 2.5, 10.0, 'token', 'openai', true, now()),
    -- GPT-3.5-turbo - Official pricing: $0.50/$1.50 per 1M tokens (as of 2024)
    ('gpt-3.5-turbo', 'chat', 0.5, 1.5, 'token', 'openai', true, now()),
    -- GPT-3.5-turbo-16k - Official pricing: $3.00/$4.00 per 1M tokens
    ('gpt-3.5-turbo-16k', 'chat', 3.0, 4.0, 'token', 'openai', true, now()),
    -- GPT-4 32k - Official pricing: $60/$120 per 1M tokens
    ('gpt-4-32k', 'chat', 60.0, 120.0, 'token', 'openai', true, now()),
    -- GPT-4o-mini - Official pricing: $0.15/$0.60 per 1M tokens
    ('gpt-4o-mini', 'chat', 0.15, 0.6, 'token', 'openai', true, now()),
    -- text-davinci-002 - Official pricing: $20/$20 per 1M tokens (deprecated)
    ('text-davinci-002', 'chat', 20.0, 20.0, 'token', 'openai', true, now()),
    -- text-davinci-003 - Official pricing: $20/$20 per 1M tokens (deprecated)
    ('text-davinci-003', 'chat', 20.0, 20.0, 'token', 'openai', true, now())
ON CONFLICT (model_name) DO UPDATE SET
    model_type = EXCLUDED.model_type,
    input_price_per_1m = EXCLUDED.input_price_per_1m,
    output_price_per_1m = EXCLUDED.output_price_per_1m,
    unit_type = EXCLUDED.unit_type,
    provider = EXCLUDED.provider,
    is_active = EXCLUDED.is_active,
    effective_date = EXCLUDED.effective_date,
    updated_at = now();

-- Image Models (per image)
-- Use DO UPDATE to update existing records with correct pricing
INSERT INTO public.model_pricing (model_name, model_type, fixed_price_per_unit, unit_type, provider, is_active, effective_date)
VALUES
    ('dall-e-3', 'image', 0.04, 'image', 'openai', true, now()),
    ('dall-e-3-hd', 'image', 0.08, 'image', 'openai', true, now()),
    ('dall-e-2', 'image', 0.02, 'image', 'openai', true, now())
ON CONFLICT (model_name) DO UPDATE SET
    model_type = EXCLUDED.model_type,
    fixed_price_per_unit = EXCLUDED.fixed_price_per_unit,
    unit_type = EXCLUDED.unit_type,
    provider = EXCLUDED.provider,
    is_active = EXCLUDED.is_active,
    effective_date = EXCLUDED.effective_date,
    updated_at = now();

-- Gemini Chat Models
-- Official pricing from Google (verify at https://ai.google.dev/gemini-api/docs/pricing)
-- Use DO UPDATE to update existing records with correct pricing
INSERT INTO public.model_pricing (model_name, model_type, input_price_per_1m, output_price_per_1m, unit_type, provider, is_active, effective_date)
VALUES
    -- Gemini Pro - Official pricing: $0.50/$1.50 per 1M tokens
    ('gemini-pro', 'chat', 0.5, 1.5, 'token', 'google', true, now()),
    -- Gemini Pro Vision - Official pricing: $0.25/$0.25 per 1M tokens
    ('gemini-pro-vision', 'chat', 0.25, 0.25, 'token', 'google', true, now())
ON CONFLICT (model_name) DO UPDATE SET
    model_type = EXCLUDED.model_type,
    input_price_per_1m = EXCLUDED.input_price_per_1m,
    output_price_per_1m = EXCLUDED.output_price_per_1m,
    unit_type = EXCLUDED.unit_type,
    provider = EXCLUDED.provider,
    is_active = EXCLUDED.is_active,
    effective_date = EXCLUDED.effective_date,
    updated_at = now();

-- Gemini Image Generation Model (gemini-2.5-flash-image-preview)
-- Pricing: TOKEN-BASED (not fixed per image)
-- Official pricing: Input $0.30 per 1M tokens, Output $30.00 per 1M tokens
-- Average: ~1,290 output tokens per 1024x1024 image ≈ $0.039 per image
-- Calculation: (1,290 / 1,000,000) × $30.00 = $0.0387 ≈ $0.039 per image
-- Note: Gemini API doesn't return usage, so we estimate tokens based on image size
-- For 1024x1024: ~1,290 output tokens, for larger images: more tokens
-- Use DO UPDATE to update existing records with correct pricing
INSERT INTO public.model_pricing (model_name, model_type, input_price_per_1m, output_price_per_1m, unit_type, provider, is_active, effective_date)
VALUES
    ('gemini-2.5-flash-image-preview', 'image', 0.3, 30.0, 'token', 'google', true, now())
ON CONFLICT (model_name) DO UPDATE SET
    model_type = EXCLUDED.model_type,
    input_price_per_1m = EXCLUDED.input_price_per_1m,
    output_price_per_1m = EXCLUDED.output_price_per_1m,
    unit_type = EXCLUDED.unit_type,
    provider = EXCLUDED.provider,
    is_active = EXCLUDED.is_active,
    effective_date = EXCLUDED.effective_date,
    updated_at = now();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_model_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        -- Drop trigger if it exists first to avoid conflicts
DROP TRIGGER IF EXISTS trigger_update_model_pricing_updated_at ON public.model_pricing;

CREATE TRIGGER trigger_update_model_pricing_updated_at
    BEFORE UPDATE ON public.model_pricing
    FOR EACH ROW
    EXECUTE FUNCTION update_model_pricing_updated_at();

-- RLS Policies (if RLS is enabled)
-- Allow authenticated users to read pricing
-- Only admins can modify pricing (this will be enforced at application level)

