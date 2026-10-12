CREATE OR REPLACE FUNCTION public.start_support_thread(_order_id uuid, _content text, _attachments jsonb DEFAULT '[]'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c record; tid uuid; onum text; nm text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF length(trim(coalesce(_content,''))) = 0 AND jsonb_array_length(coalesce(_attachments,'[]')) = 0 THEN RAISE EXCEPTION 'Message vide.'; END IF;
  IF length(_content) > 5000 THEN RAISE EXCEPTION 'Message trop long.'; END IF;
  SELECT * INTO c FROM client_ctx();
  IF _order_id IS NOT NULL THEN
    IF NOT public.client_can_view_order(_order_id) THEN RAISE EXCEPTION 'Commande introuvable.'; END IF;
    SELECT order_number INTO onum FROM orders WHERE id = _order_id;
  END IF;
  SELECT coalesce(nullif(full_name,''), auth.jwt() ->> 'email') INTO nm FROM profiles WHERE user_id = auth.uid();
  INSERT INTO support_threads (owner_id, created_by, customer_email, order_id, subject, last_message_at)
  VALUES (c.owner_id, auth.uid(), lower(auth.jwt() ->> 'email'), _order_id,
          CASE WHEN onum IS NOT NULL THEN 'Commande ' || onum ELSE 'Question générale' END, now())
  RETURNING id INTO tid;
  INSERT INTO support_messages (thread_id, author_user_id, sender_name, sender_role, source, content, attachments)
  VALUES (tid, auth.uid(), coalesce(nm, auth.jwt() ->> 'email'), 'client', 'web', trim(_content), coalesce(_attachments,'[]'));
  RETURN tid;
END $$;