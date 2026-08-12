BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.gsa_hero_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  image_url text NOT NULL,
  image_mobile_url text,
  link_url text,
  button_text text DEFAULT 'Confira agora',
  background_color text DEFAULT '#17345f',
  display_order integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gsa_hero_banners_title_check CHECK (char_length(trim(title)) BETWEEN 2 AND 160),
  CONSTRAINT gsa_hero_banners_display_order_check CHECK (display_order BETWEEN 1 AND 999),
  CONSTRAINT gsa_hero_banners_period_check CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

-- Enable RLS
ALTER TABLE public.gsa_hero_banners ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access to active banners within validity period
DROP POLICY IF EXISTS "Public can view active hero banners" ON public.gsa_hero_banners;
CREATE POLICY "Public can view active hero banners"
  ON public.gsa_hero_banners
  FOR SELECT
  TO public
  USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );

-- Policy: Service Role and Authenticated Admins have full access
DROP POLICY IF EXISTS "Admins and Service Role full access hero banners" ON public.gsa_hero_banners;
CREATE POLICY "Admins and Service Role full access hero banners"
  ON public.gsa_hero_banners
  FOR ALL
  TO authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- Insert initial default banners if table is empty
INSERT INTO public.gsa_hero_banners (title, subtitle, image_url, link_url, background_color, display_order, is_active)
SELECT 'Ofertas Exclusivas', 'Aproveite os melhores preços em tecnologia', '/images/marketplace/produtos-assinaturas-hero.jpg', '/marketplace/produtos-assinaturas', '#17345f', 1, true
WHERE NOT EXISTS (SELECT 1 FROM public.gsa_hero_banners WHERE title = 'Ofertas Exclusivas');

INSERT INTO public.gsa_hero_banners (title, subtitle, image_url, link_url, background_color, display_order, is_active)
SELECT 'Semana do Consumidor', 'Até 50% de desconto e pontos em dobro', 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=2000&q=80', '/marketplace/produtos-assinaturas', '#d8bd73', 2, true
WHERE NOT EXISTS (SELECT 1 FROM public.gsa_hero_banners WHERE title = 'Semana do Consumidor');

INSERT INTO public.gsa_hero_banners (title, subtitle, image_url, link_url, background_color, display_order, is_active)
SELECT 'Novidades da Estação', 'Confira os lançamentos que acabaram de chegar', 'https://images.unsplash.com/photo-1572584642822-8f6a4597d22b?auto=format&fit=crop&w=2000&q=80', '/marketplace/produtos-assinaturas', '#e8a838', 3, true
WHERE NOT EXISTS (SELECT 1 FROM public.gsa_hero_banners WHERE title = 'Novidades da Estação');

COMMIT;
