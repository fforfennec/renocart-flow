CREATE OR REPLACE FUNCTION public.client_can_view_support_file(_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM support_messages m
     WHERE m.attachments @> jsonb_build_array(jsonb_build_object('path', _path))
       AND public.client_can_view_support_thread(m.thread_id))
$$;

CREATE POLICY "Support files: clients upload own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'support-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Support files: read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'support-attachments' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR public.client_can_view_support_file(name)));
CREATE POLICY "Support files: admins manage" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'support-attachments' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'support-attachments' AND public.has_role(auth.uid(), 'admin'));