CREATE TABLE public.admin_message_reads (
 user_id uuid NOT NULL,
 conversation_key text NOT NULL,
 read_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id, conversation_key)
);
GRANT SELECT, INSERT, UPDATE ON public.admin_message_reads TO authenticated;
GRANT ALL ON public.admin_message_reads TO service_role;
ALTER TABLE public.admin_message_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read own message receipts" ON public.admin_message_reads FOR SELECT TO authenticated USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert own message receipts" ON public.admin_message_reads FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update own message receipts" ON public.admin_message_reads FOR UPDATE TO authenticated USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin')) WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_message_reads;