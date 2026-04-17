
-- Table
CREATE TABLE IF NOT EXISTS public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- 'created','status_changed','supplier_assigned','supplier_unassigned','email_sent','supplier_responded','comment','note'
  title text NOT NULL,
  description text,
  supplier_id uuid,
  supplier_name text,
  actor_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_events_order_id_created_at
  ON public.order_events (order_id, created_at DESC);

ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage order events" ON public.order_events;
CREATE POLICY "Admins manage order events" ON public.order_events
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Suppliers view events for assigned orders" ON public.order_events;
CREATE POLICY "Suppliers view events for assigned orders" ON public.order_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.supplier_assignments sa
      WHERE sa.order_id = order_events.order_id AND sa.supplier_id = auth.uid()
    )
  );

-- Allow service role / edge functions / anon with service key to insert events
DROP POLICY IF EXISTS "Service can insert events" ON public.order_events;
CREATE POLICY "Service can insert events" ON public.order_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ===== Triggers =====

-- Order created / status changed
CREATE OR REPLACE FUNCTION public.log_order_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_events (order_id, event_type, title, description, metadata)
    VALUES (
      NEW.id,
      'created',
      'Commande créée',
      'La commande ' || NEW.order_number || ' a été créée pour ' || NEW.client_name || '.',
      jsonb_build_object('status', NEW.status)
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_events (order_id, event_type, title, description, metadata)
    VALUES (
      NEW.id,
      'status_changed',
      'Statut: ' || OLD.status || ' → ' || NEW.status,
      NULL,
      jsonb_build_object('from', OLD.status, 'to', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_order_event ON public.orders;
CREATE TRIGGER trg_log_order_event
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_order_event();

-- Supplier assigned
CREATE OR REPLACE FUNCTION public.log_supplier_assignment_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s_name text;
BEGIN
  SELECT COALESCE(p.company_name, p.full_name)
    INTO s_name
  FROM public.profiles p
  WHERE p.user_id = NEW.supplier_id
  LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_events (order_id, event_type, title, description, supplier_id, supplier_name, metadata)
    VALUES (
      NEW.order_id,
      'supplier_assigned',
      'Fournisseur assigné' || COALESCE(' — ' || s_name, ''),
      'Type: ' || NEW.assignment_type || ', priorité: ' || COALESCE(NEW.priority_rank::text, '1'),
      NEW.supplier_id,
      s_name,
      jsonb_build_object('assignment_type', NEW.assignment_type, 'priority_rank', NEW.priority_rank)
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.order_events (order_id, event_type, title, description, supplier_id, supplier_name)
    VALUES (
      OLD.order_id,
      'supplier_unassigned',
      'Fournisseur retiré' || COALESCE(' — ' || s_name, ''),
      NULL,
      OLD.supplier_id,
      s_name
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_supplier_assignment ON public.supplier_assignments;
CREATE TRIGGER trg_log_supplier_assignment
AFTER INSERT OR DELETE ON public.supplier_assignments
FOR EACH ROW EXECUTE FUNCTION public.log_supplier_assignment_event();

-- Supplier response status changed
CREATE OR REPLACE FUNCTION public.log_supplier_response_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_supplier_id uuid;
  s_name text;
BEGIN
  SELECT sa.order_id, sa.supplier_id
    INTO v_order_id, v_supplier_id
  FROM public.supplier_assignments sa
  WHERE sa.id = NEW.assignment_id;

  IF v_order_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(p.company_name, p.full_name)
    INTO s_name
  FROM public.profiles p
  WHERE p.user_id = v_supplier_id
  LIMIT 1;

  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.order_events (order_id, event_type, title, description, supplier_id, supplier_name, metadata)
    VALUES (
      v_order_id,
      'supplier_responded',
      CASE NEW.status
        WHEN 'confirmed' THEN '✅ Fournisseur a confirmé' || COALESCE(' — ' || s_name, '')
        WHEN 'needs_modification' THEN '✏️ Modification demandée' || COALESCE(' — ' || s_name, '')
        WHEN 'declined' THEN '❌ Fournisseur a refusé' || COALESCE(' — ' || s_name, '')
        WHEN 'pending' THEN 'Réponse réinitialisée' || COALESCE(' — ' || s_name, '')
        ELSE 'Réponse: ' || NEW.status || COALESCE(' — ' || s_name, '')
      END,
      NEW.supplier_general_note,
      v_supplier_id,
      s_name,
      jsonb_build_object('status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_supplier_response ON public.supplier_responses;
CREATE TRIGGER trg_log_supplier_response
AFTER INSERT OR UPDATE ON public.supplier_responses
FOR EACH ROW EXECUTE FUNCTION public.log_supplier_response_event();

-- ===== Backfill =====

-- Order created events
INSERT INTO public.order_events (order_id, event_type, title, description, created_at, metadata)
SELECT o.id, 'created', 'Commande créée',
  'La commande ' || o.order_number || ' a été créée pour ' || o.client_name || '.',
  o.created_at, jsonb_build_object('status', o.status)
FROM public.orders o
WHERE NOT EXISTS (
  SELECT 1 FROM public.order_events e WHERE e.order_id = o.id AND e.event_type = 'created'
);

-- Supplier assignments
INSERT INTO public.order_events (order_id, event_type, title, description, supplier_id, supplier_name, created_at, metadata)
SELECT
  sa.order_id, 'supplier_assigned',
  'Fournisseur assigné' || COALESCE(' — ' || COALESCE(p.company_name, p.full_name), ''),
  'Type: ' || sa.assignment_type || ', priorité: ' || COALESCE(sa.priority_rank::text, '1'),
  sa.supplier_id,
  COALESCE(p.company_name, p.full_name),
  sa.assigned_at,
  jsonb_build_object('assignment_type', sa.assignment_type, 'priority_rank', sa.priority_rank)
FROM public.supplier_assignments sa
LEFT JOIN public.profiles p ON p.user_id = sa.supplier_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.order_events e
  WHERE e.order_id = sa.order_id AND e.event_type = 'supplier_assigned' AND e.supplier_id = sa.supplier_id
);

-- Supplier responses (latest status only)
INSERT INTO public.order_events (order_id, event_type, title, description, supplier_id, supplier_name, created_at, metadata)
SELECT
  sa.order_id, 'supplier_responded',
  CASE sr.status
    WHEN 'confirmed' THEN '✅ Fournisseur a confirmé' || COALESCE(' — ' || COALESCE(p.company_name, p.full_name), '')
    WHEN 'needs_modification' THEN '✏️ Modification demandée' || COALESCE(' — ' || COALESCE(p.company_name, p.full_name), '')
    WHEN 'declined' THEN '❌ Fournisseur a refusé' || COALESCE(' — ' || COALESCE(p.company_name, p.full_name), '')
    ELSE 'Réponse: ' || sr.status || COALESCE(' — ' || COALESCE(p.company_name, p.full_name), '')
  END,
  sr.supplier_general_note,
  sa.supplier_id,
  COALESCE(p.company_name, p.full_name),
  COALESCE(sr.responded_at, sr.confirmed_at, sa.assigned_at),
  jsonb_build_object('status', sr.status)
FROM public.supplier_responses sr
JOIN public.supplier_assignments sa ON sa.id = sr.assignment_id
LEFT JOIN public.profiles p ON p.user_id = sa.supplier_id
WHERE sr.status <> 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM public.order_events e
    WHERE e.order_id = sa.order_id AND e.event_type = 'supplier_responded'
      AND e.supplier_id = sa.supplier_id
      AND (e.metadata->>'status') = sr.status
  );
