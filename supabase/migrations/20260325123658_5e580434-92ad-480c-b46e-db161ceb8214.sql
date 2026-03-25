ALTER TABLE public.supplier_responses
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'escalation',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all notifications"
  ON public.notifications FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));