
-- Internal comments (only admins can see/create)
CREATE TABLE public.order_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all comments"
  ON public.order_comments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_order_comments_order ON public.order_comments(order_id, created_at);

-- Order messages (chat between RenoCart + assigned suppliers/DSPs)
CREATE TABLE public.order_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage all messages"
  ON public.order_messages FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Suppliers can view messages on orders they're assigned to
CREATE POLICY "Suppliers can view messages on assigned orders"
  ON public.order_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.supplier_assignments sa
      WHERE sa.order_id = order_messages.order_id
        AND sa.supplier_id = auth.uid()
    )
  );

-- Suppliers can insert messages on orders they're assigned to
CREATE POLICY "Suppliers can send messages on assigned orders"
  ON public.order_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.supplier_assignments sa
      WHERE sa.order_id = order_messages.order_id
        AND sa.supplier_id = auth.uid()
    )
  );

CREATE INDEX idx_order_messages_order ON public.order_messages(order_id, created_at);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_comments;
