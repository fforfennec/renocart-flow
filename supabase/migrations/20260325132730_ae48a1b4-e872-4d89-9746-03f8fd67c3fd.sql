
-- Drop the old supplier_response_tokens table (using assignment_id as token instead)
DROP TABLE IF EXISTS public.supplier_response_tokens;

-- Drop and recreate supplier_priority with proper structure
DROP TABLE IF EXISTS public.supplier_priority;

CREATE TABLE public.supplier_priority (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  priority_order integer NOT NULL DEFAULT 1,
  name text NOT NULL,
  email text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(email),
  UNIQUE(priority_order)
);

ALTER TABLE public.supplier_priority ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage supplier priority"
  ON public.supplier_priority FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read for edge functions"
  ON public.supplier_priority FOR SELECT
  TO anon
  USING (true);
