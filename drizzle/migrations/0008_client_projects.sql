CREATE TABLE public.client_projects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL,
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
 code text NOT NULL CHECK (length(trim(code)) BETWEEN 1 AND 40),
 address1 text,
 city text,
 province text DEFAULT 'QC',
 postal_code text,
 contact_name text,
 contact_phone text,
 notes text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (owner_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_projects TO authenticated;
GRANT ALL ON public.client_projects TO service_role;
ALTER TABLE public.client_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage projects" ON public.client_projects FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Admins read projects" ON public.client_projects FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_client_projects_updated_at BEFORE UPDATE ON public.client_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.orders
 ADD COLUMN customer_email text,
 ADD COLUMN project_id uuid REFERENCES public.client_projects(id) ON DELETE SET NULL,
 ADD COLUMN project_name text,
 ADD COLUMN project_code text,
 ADD COLUMN subtotal_price numeric,
 ADD COLUMN total_tax numeric,
 ADD COLUMN shipping_price_total numeric,
 ADD COLUMN total_price numeric,
 ADD COLUMN currency text;
CREATE INDEX orders_customer_email_idx ON public.orders (lower(customer_email));
CREATE INDEX orders_project_id_idx ON public.orders (project_id);
ALTER TABLE public.order_items ADD COLUMN unit_price numeric, ADD COLUMN variant_title text;

CREATE POLICY "Clients view own orders" ON public.orders FOR SELECT TO authenticated
 USING (customer_email IS NOT NULL AND lower(customer_email) = lower(auth.jwt() ->> 'email'));
CREATE POLICY "Clients view own order items" ON public.order_items FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.customer_email IS NOT NULL AND lower(o.customer_email) = lower(auth.jwt() ->> 'email')));

CREATE OR REPLACE FUNCTION public.assign_order_project(_order_id uuid, _project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM orders WHERE id = _order_id AND lower(customer_email) = lower(auth.jwt() ->> 'email')) THEN
    RAISE EXCEPTION 'order not found';
  END IF;
  IF _project_id IS NULL THEN
    UPDATE orders SET project_id = NULL, project_name = NULL, project_code = NULL WHERE id = _order_id;
    RETURN;
  END IF;
  SELECT * INTO p FROM client_projects WHERE id = _project_id AND owner_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'project not found'; END IF;
  UPDATE orders SET project_id = p.id, project_name = p.name, project_code = p.code WHERE id = _order_id;
END $$;
REVOKE ALL ON FUNCTION public.assign_order_project(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.assign_order_project(uuid, uuid) TO authenticated;