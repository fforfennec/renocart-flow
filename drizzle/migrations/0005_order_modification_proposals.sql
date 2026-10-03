ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS parent_order_id uuid REFERENCES public.orders(id);
ALTER TABLE public.order_messages ADD COLUMN IF NOT EXISTS proposal_id uuid;

CREATE TABLE public.order_modification_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  supplier_name text,
  status text NOT NULL DEFAULT 'pending',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  proposed_date date,
  proposed_time_window text,
  proposed_truck text,
  note text,
  split_order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
GRANT SELECT ON public.order_modification_proposals TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_modification_proposals TO authenticated;
GRANT ALL ON public.order_modification_proposals TO service_role;
ALTER TABLE public.order_modification_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage proposals" ON public.order_modification_proposals FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Test mode read proposals" ON public.order_modification_proposals FOR SELECT TO anon USING (true);