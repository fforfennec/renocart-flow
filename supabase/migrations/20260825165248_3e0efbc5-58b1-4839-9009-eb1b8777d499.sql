ALTER TABLE public.order_messages
ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app',
ADD COLUMN IF NOT EXISTS email_message_id text,
ADD COLUMN IF NOT EXISTS is_broadcast boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_order_messages_order_supplier_created
ON public.order_messages(order_id, supplier_id, created_at);

DROP POLICY IF EXISTS "Suppliers can send messages on assigned orders" ON public.order_messages;
DROP POLICY IF EXISTS "Suppliers can view messages on assigned orders" ON public.order_messages;

CREATE POLICY "Suppliers can send messages on assigned orders"
ON public.order_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND source = 'app'
  AND EXISTS (
    SELECT 1 FROM public.supplier_assignments sa
    WHERE sa.order_id = order_messages.order_id
      AND sa.supplier_id = auth.uid()
  )
);

CREATE POLICY "Suppliers can view messages on assigned orders"
ON public.order_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.supplier_assignments sa
    WHERE sa.order_id = order_messages.order_id
      AND sa.supplier_id = auth.uid()
      AND (
        order_messages.supplier_id IS NULL
        OR order_messages.supplier_id = auth.uid()
        OR order_messages.is_broadcast = true
      )
  )
);