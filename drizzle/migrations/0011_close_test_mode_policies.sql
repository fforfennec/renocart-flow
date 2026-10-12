DO $$ DECLARE r record; BEGIN
FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies
 WHERE schemaname IN ('public','storage') AND (policyname ILIKE '%test mode%' OR policyname = 'Public read for edge functions') LOOP
 EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
END LOOP; END $$;

DROP POLICY IF EXISTS "Suppliers can view assigned orders" ON public.orders;
CREATE POLICY "Suppliers can view assigned orders" ON public.orders FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.supplier_assignments sa WHERE sa.order_id = orders.id AND sa.supplier_id = auth.uid()));

DROP POLICY IF EXISTS "Suppliers can view assigned order items" ON public.order_items;
CREATE POLICY "Suppliers can view assigned order items" ON public.order_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.supplier_assignments sa WHERE sa.order_id = order_items.order_id AND sa.supplier_id = auth.uid()));

DROP POLICY IF EXISTS "Suppliers can view order documents" ON storage.objects;
CREATE POLICY "Staff can view order documents" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'order-documents' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supplier') OR public.has_role(auth.uid(),'partner')));

CREATE POLICY "Staff can view order attachments" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'order-attachments' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supplier') OR public.has_role(auth.uid(),'partner')));