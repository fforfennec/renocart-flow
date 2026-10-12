CREATE TABLE public.support_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  created_by uuid,
  customer_email text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  subject text,
  gmail_thread_id text,
  rfc_message_id text,
  status text NOT NULL DEFAULT 'open',
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_threads_gmail_idx ON public.support_threads (gmail_thread_id);
CREATE INDEX support_threads_owner_idx ON public.support_threads (owner_id);

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  author_user_id uuid,
  sender_name text NOT NULL DEFAULT '',
  sender_role text NOT NULL DEFAULT 'client',
  source text NOT NULL DEFAULT 'web',
  content text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  email_message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_messages_thread_idx ON public.support_messages (thread_id, created_at);

GRANT SELECT ON public.support_threads TO authenticated;
GRANT UPDATE ON public.support_threads TO authenticated;
GRANT ALL ON public.support_threads TO service_role;
GRANT SELECT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;

ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.client_can_view_support_thread(_tid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM support_threads t, client_ctx() c
     WHERE t.id = _tid AND (
       t.created_by = auth.uid()
       OR (t.customer_email IS NOT NULL AND lower(t.customer_email) = lower(auth.jwt() ->> 'email'))
       OR (c.role IN ('owner','super_admin') AND t.owner_id = c.owner_id)
     ))
$$;

CREATE POLICY "Admins manage support threads" ON public.support_threads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Clients view their support threads" ON public.support_threads FOR SELECT TO authenticated
  USING (public.client_can_view_support_thread(id));
CREATE POLICY "Admins view support messages" ON public.support_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Clients view their support messages" ON public.support_messages FOR SELECT TO authenticated
  USING (public.client_can_view_support_thread(thread_id));

CREATE OR REPLACE FUNCTION public.start_support_thread(_order_id uuid, _content text, _attachments jsonb DEFAULT '[]'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c record; tid uuid; o record; nm text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF length(trim(coalesce(_content,''))) = 0 AND jsonb_array_length(coalesce(_attachments,'[]')) = 0 THEN RAISE EXCEPTION 'Message vide.'; END IF;
  IF length(_content) > 5000 THEN RAISE EXCEPTION 'Message trop long.'; END IF;
  SELECT * INTO c FROM client_ctx();
  IF _order_id IS NOT NULL THEN
    IF NOT public.client_can_view_order(_order_id) THEN RAISE EXCEPTION 'Commande introuvable.'; END IF;
    SELECT order_number INTO o FROM orders WHERE id = _order_id;
  END IF;
  SELECT coalesce(nullif(full_name,''), auth.jwt() ->> 'email') INTO nm FROM profiles WHERE user_id = auth.uid();
  INSERT INTO support_threads (owner_id, created_by, customer_email, order_id, subject, last_message_at)
  VALUES (c.owner_id, auth.uid(), lower(auth.jwt() ->> 'email'), _order_id,
          CASE WHEN o.order_number IS NOT NULL THEN 'Commande ' || o.order_number ELSE 'Question générale' END, now())
  RETURNING id INTO tid;
  INSERT INTO support_messages (thread_id, author_user_id, sender_name, sender_role, source, content, attachments)
  VALUES (tid, auth.uid(), coalesce(nm, auth.jwt() ->> 'email'), 'client', 'web', trim(_content), coalesce(_attachments,'[]'));
  RETURN tid;
END $$;

CREATE OR REPLACE FUNCTION public.post_support_message(_thread_id uuid, _content text, _attachments jsonb DEFAULT '[]'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE mid uuid; nm text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.client_can_view_support_thread(_thread_id) THEN RAISE EXCEPTION 'Discussion introuvable.'; END IF;
  IF length(trim(coalesce(_content,''))) = 0 AND jsonb_array_length(coalesce(_attachments,'[]')) = 0 THEN RAISE EXCEPTION 'Message vide.'; END IF;
  IF length(_content) > 5000 THEN RAISE EXCEPTION 'Message trop long.'; END IF;
  SELECT coalesce(nullif(full_name,''), auth.jwt() ->> 'email') INTO nm FROM profiles WHERE user_id = auth.uid();
  INSERT INTO support_messages (thread_id, author_user_id, sender_name, sender_role, source, content, attachments)
  VALUES (_thread_id, auth.uid(), coalesce(nm, auth.jwt() ->> 'email'), 'client', 'web', trim(_content), coalesce(_attachments,'[]'))
  RETURNING id INTO mid;
  UPDATE support_threads SET last_message_at = now(), status = 'open' WHERE id = _thread_id;
  RETURN mid;
END $$;

REVOKE EXECUTE ON FUNCTION public.start_support_thread(uuid, text, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.post_support_message(uuid, text, jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.start_support_thread(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_support_message(uuid, text, jsonb) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;