-- Enable RLS on Affiliate Program Core Tables
-- This migration ensures that Row Level Security is explicitly activated
-- on all affiliate core tables created in 20260722040000_affiliate_program.sql.

ALTER TABLE public.gsa_afiliados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsa_afiliado_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsa_afiliado_conversoes ENABLE ROW LEVEL SECURITY;
