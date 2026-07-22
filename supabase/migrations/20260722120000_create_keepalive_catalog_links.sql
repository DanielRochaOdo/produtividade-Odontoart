-- Small, non-sensitive endpoint used by the public Supabase keepalive check.
CREATE TABLE IF NOT EXISTS public.catalog_links (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY
);

ALTER TABLE public.catalog_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_links_public_read" ON public.catalog_links;
CREATE POLICY "catalog_links_public_read"
  ON public.catalog_links
  FOR SELECT
  TO anon
  USING (true);
