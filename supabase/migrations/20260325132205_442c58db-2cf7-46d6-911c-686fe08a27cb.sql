
-- Supplier priority list for auto-dispatch chain
CREATE TABLE public.supplier_priority (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_email text NOT NULL,
  supplier_name text NOT NULL,
  priority integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(supplier_email)
);

ALTER TABLE public.supplier_priority ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage supplier priority"
  ON public.supplier_priority FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Insert default suppliers
INSERT INTO public.supplier_priority (supplier_email, supplier_name, priority) VALUES
  ('badis@birouche.ca', 'Pont-Masson', 1),
  ('badis@groupesoli.com', 'Home Depot', 2);

-- Response tokens for no-login email responses
CREATE TABLE public.supplier_response_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.supplier_assignments(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  used_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_response_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view response tokens"
  ON public.supplier_response_tokens FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Add priority_rank to supplier_assignments to track which supplier in the chain
ALTER TABLE public.supplier_assignments ADD COLUMN IF NOT EXISTS priority_rank integer DEFAULT 1;
