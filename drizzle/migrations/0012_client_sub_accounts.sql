CREATE TABLE public.client_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  email text NOT NULL,
  user_id uuid,
  role text NOT NULL CHECK (role IN ('super_admin','project_manager','employee')),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active')),
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX client_members_email_uniq ON public.client_members (lower(email));
CREATE INDEX client_members_owner_idx ON public.client_members (owner_id);
CREATE INDEX client_members_user_idx ON public.client_members (user_id);
GRANT SELECT ON public.client_members TO authenticated;
GRANT ALL ON public.client_members TO service_role;
ALTER TABLE public.client_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.client_project_members (
  project_id uuid NOT NULL REFERENCES public.client_projects(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.client_members(id) ON DELETE CASCADE,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, member_id)
);
GRANT SELECT ON public.client_project_members TO authenticated;
GRANT ALL ON public.client_project_members TO service_role;
ALTER TABLE public.client_project_members ENABLE ROW LEVEL SECURITY;

-- Caller's client account: owner id, membership id and role ('owner' when not a sub-account).
CREATE OR REPLACE FUNCTION public.client_ctx()
RETURNS TABLE(owner_id uuid, member_id uuid, role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.owner_id, m.id, m.role FROM client_members m
   WHERE m.user_id = auth.uid() AND m.status = 'active'
  UNION ALL
  SELECT auth.uid(), NULL::uuid, 'owner'
   WHERE auth.uid() IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM client_members m WHERE m.user_id = auth.uid() AND m.status = 'active')
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.client_can_view_project(_pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM client_projects p, client_ctx() c
     WHERE p.id = _pid AND p.owner_id = c.owner_id
       AND (c.role IN ('owner','super_admin')
            OR EXISTS (SELECT 1 FROM client_project_members pm WHERE pm.project_id = p.id AND pm.member_id = c.member_id)))
$$;

CREATE OR REPLACE FUNCTION public.client_can_order_project(_pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.client_can_view_project(_pid)
     AND (SELECT role FROM public.client_ctx()) IN ('owner','super_admin','project_manager')
$$;

CREATE OR REPLACE FUNCTION public.client_can_manage_project_team(_pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.client_can_view_project(_pid)
     AND (SELECT role FROM public.client_ctx()) IN ('owner','super_admin','project_manager')
$$;

CREATE OR REPLACE FUNCTION public.client_can_view_order(_oid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM orders o, client_ctx() c
     WHERE o.id = _oid AND (
       (o.customer_email IS NOT NULL AND lower(o.customer_email) = lower(auth.jwt() ->> 'email'))
       OR (o.project_id IS NOT NULL AND public.client_can_view_project(o.project_id))
       OR (c.role IN ('owner','super_admin') AND o.customer_email IS NOT NULL AND lower(o.customer_email) IN (
            SELECT lower(u.email) FROM auth.users u WHERE u.id = c.owner_id
            UNION SELECT lower(m.email) FROM client_members m WHERE m.owner_id = c.owner_id AND m.status = 'active'))
     ))
$$;

CREATE POLICY "Account members view team" ON public.client_members FOR SELECT TO authenticated
  USING (owner_id = (SELECT owner_id FROM public.client_ctx()) OR user_id = auth.uid());
CREATE POLICY "Account members view project assignments" ON public.client_project_members FOR SELECT TO authenticated
  USING (public.client_can_view_project(project_id));
CREATE POLICY "Team members view projects" ON public.client_projects FOR SELECT TO authenticated
  USING (public.client_can_view_project(id));
CREATE POLICY "Super admins manage account projects" ON public.client_projects FOR ALL TO authenticated
  USING (owner_id = (SELECT c.owner_id FROM public.client_ctx() c WHERE c.role = 'super_admin'))
  WITH CHECK (owner_id = (SELECT c.owner_id FROM public.client_ctx() c WHERE c.role = 'super_admin'));
CREATE POLICY "Client team views orders" ON public.orders FOR SELECT TO authenticated
  USING (public.client_can_view_order(id));
CREATE POLICY "Client team views order items" ON public.order_items FOR SELECT TO authenticated
  USING (public.client_can_view_order(order_id));

CREATE OR REPLACE FUNCTION public.claim_client_invites()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE client_members SET user_id = auth.uid(), status = 'active'
   WHERE user_id IS NULL AND lower(email) = lower(auth.jwt() ->> 'email') AND owner_id <> auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.invite_client_member(_email text, _role text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; e text := lower(trim(_email)); new_id uuid;
BEGIN
  SELECT * INTO c FROM client_ctx();
  IF c.role IS NULL OR c.role NOT IN ('owner','super_admin') THEN RAISE EXCEPTION 'Permission refusée.'; END IF;
  IF _role NOT IN ('super_admin','project_manager','employee') THEN RAISE EXCEPTION 'Rôle invalide.'; END IF;
  IF e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(e) > 255 THEN RAISE EXCEPTION 'Courriel invalide.'; END IF;
  IF e = lower(auth.jwt() ->> 'email') OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.owner_id AND lower(u.email) = e) THEN
    RAISE EXCEPTION 'Ce courriel est déjà le compte principal.'; END IF;
  IF EXISTS (SELECT 1 FROM client_members WHERE lower(email) = e) THEN RAISE EXCEPTION 'Ce courriel fait déjà partie d''un compte.'; END IF;
  INSERT INTO client_members (owner_id, email, role, invited_by, user_id, status)
  SELECT c.owner_id, e, _role, auth.uid(), u.id, CASE WHEN u.id IS NULL THEN 'invited' ELSE 'active' END
    FROM (SELECT NULL) x LEFT JOIN auth.users u ON lower(u.email) = e
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.update_client_member(_member_id uuid, _role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  SELECT * INTO c FROM client_ctx();
  IF c.role IS NULL OR c.role NOT IN ('owner','super_admin') THEN RAISE EXCEPTION 'Permission refusée.'; END IF;
  IF _member_id = c.member_id THEN RAISE EXCEPTION 'Tu ne peux pas modifier ton propre accès.'; END IF;
  IF _role IS NULL THEN
    DELETE FROM client_members WHERE id = _member_id AND owner_id = c.owner_id;
  ELSE
    IF _role NOT IN ('super_admin','project_manager','employee') THEN RAISE EXCEPTION 'Rôle invalide.'; END IF;
    UPDATE client_members SET role = _role WHERE id = _member_id AND owner_id = c.owner_id;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membre introuvable.'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_project_member(_project_id uuid, _member_id uuid, _assigned boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; m record;
BEGIN
  SELECT * INTO c FROM client_ctx();
  IF NOT public.client_can_manage_project_team(_project_id) THEN RAISE EXCEPTION 'Permission refusée.'; END IF;
  SELECT * INTO m FROM client_members WHERE id = _member_id AND owner_id = c.owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membre introuvable.'; END IF;
  IF c.role = 'project_manager' AND m.role <> 'employee' THEN RAISE EXCEPTION 'Un gestionnaire peut seulement assigner des employés.'; END IF;
  IF _assigned THEN
    INSERT INTO client_project_members (project_id, member_id, assigned_by) VALUES (_project_id, _member_id, auth.uid()) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM client_project_members WHERE project_id = _project_id AND member_id = _member_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.my_client_projects()
RETURNS SETOF public.client_projects LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.* FROM client_projects p WHERE public.client_can_view_project(p.id) ORDER BY p.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.my_client_order_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id FROM orders o, client_ctx() c
   WHERE (o.customer_email IS NOT NULL AND lower(o.customer_email) = lower(auth.jwt() ->> 'email'))
      OR (o.project_id IS NOT NULL AND public.client_can_view_project(o.project_id))
      OR (c.role IN ('owner','super_admin') AND o.customer_email IS NOT NULL AND lower(o.customer_email) IN (
            SELECT lower(u.email) FROM auth.users u WHERE u.id = c.owner_id
            UNION SELECT lower(m.email) FROM client_members m WHERE m.owner_id = c.owner_id AND m.status = 'active'))
$$;

CREATE OR REPLACE FUNCTION public.assign_order_project(_order_id uuid, _project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; c record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO c FROM client_ctx();
  IF c.role = 'employee' THEN RAISE EXCEPTION 'Permission refusée.'; END IF;
  IF NOT public.client_can_view_order(_order_id) THEN RAISE EXCEPTION 'order not found'; END IF;
  IF _project_id IS NULL THEN
    UPDATE orders SET project_id = NULL, project_name = NULL, project_code = NULL WHERE id = _order_id;
    RETURN;
  END IF;
  IF NOT public.client_can_order_project(_project_id) THEN RAISE EXCEPTION 'project not found'; END IF;
  SELECT * INTO p FROM client_projects WHERE id = _project_id;
  UPDATE orders SET project_id = p.id, project_name = p.name, project_code = p.code WHERE id = _order_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.client_ctx(), public.client_can_view_project(uuid), public.client_can_order_project(uuid),
  public.client_can_manage_project_team(uuid), public.client_can_view_order(uuid), public.claim_client_invites(),
  public.invite_client_member(text, text), public.update_client_member(uuid, text), public.set_project_member(uuid, uuid, boolean),
  public.my_client_projects(), public.my_client_order_ids() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.client_ctx(), public.client_can_view_project(uuid), public.client_can_order_project(uuid),
  public.client_can_manage_project_team(uuid), public.client_can_view_order(uuid), public.claim_client_invites(),
  public.invite_client_member(text, text), public.update_client_member(uuid, text), public.set_project_member(uuid, uuid, boolean),
  public.my_client_projects(), public.my_client_order_ids() TO authenticated, service_role;