-- ================================================================
-- Migration: Add offered_services + context fields for AI enrichment
-- Date: 2026-05-17
-- Purpose: AI needs richer professional context for better advice
-- ================================================================

-- 1. Serviços que o profissional realiza (texto livre)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS offered_services TEXT;

COMMENT ON COLUMN profiles.offered_services IS 'Lista de serviços realizados pelo profissional (ex: Manicure, Pedicure, Alongamento). Injetado no contexto da IA.';

-- 2. Campos adicionais para enriquecer contexto da IA
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS target_audience TEXT;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS years_experience INTEGER;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS differentials TEXT;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS accepts_home_service BOOLEAN DEFAULT false;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS payment_methods TEXT;

COMMENT ON COLUMN profiles.target_audience IS 'Público-alvo do profissional (ex: Mulheres 25-45 anos)';
COMMENT ON COLUMN profiles.years_experience IS 'Anos de experiência na área';
COMMENT ON COLUMN profiles.differentials IS 'Diferenciais do profissional (ex: Especialista em unhas artísticas)';
COMMENT ON COLUMN profiles.accepts_home_service IS 'Se atende em domicílio';
COMMENT ON COLUMN profiles.payment_methods IS 'Formas de pagamento aceitas (ex: PIX, Cartão, Dinheiro)';
