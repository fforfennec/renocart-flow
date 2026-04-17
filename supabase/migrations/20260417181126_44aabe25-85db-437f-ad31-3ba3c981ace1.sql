
DROP POLICY IF EXISTS "Service can insert events" ON public.order_events;

CREATE POLICY "Authorized users insert events" ON public.order_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.supplier_assignments sa
      WHERE sa.order_id = order_events.order_id AND sa.supplier_id = auth.uid()
    )
  );
