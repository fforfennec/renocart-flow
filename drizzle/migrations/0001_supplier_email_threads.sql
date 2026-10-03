CREATE TABLE public.supplier_email_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL,
  supplier_email text,
  gmail_thread_id text,
  rfc_message_id text,
  subject text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, supplier_id)
);
GRANT SELECT ON public.supplier_email_threads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_email_threads TO authenticated;
GRANT ALL ON public.supplier_email_threads TO service_role;
ALTER TABLE public.supplier_email_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage email threads" ON public.supplier_email_threads FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anon can read email threads (test mode)" ON public.supplier_email_threads FOR SELECT TO anon USING (true);
CREATE INDEX idx_supplier_email_threads_thread ON public.supplier_email_threads(gmail_thread_id);

ALTER TABLE public.order_messages ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'text';

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;