CREATE TABLE public.staff_accounts (
  user_id uuid PRIMARY KEY,
  email text NOT NULL,
  full_name text,
  company_name text,
  requested_role text NOT NULL DEFAULT 'supplier',
  status text NOT NULL DEFAULT 'pending',
  supplier_company_id uuid,
  admin_notified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
GRANT SELECT ON public.staff_accounts TO authenticated;
GRANT ALL ON public.staff_accounts TO service_role;
ALTER TABLE public.staff_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own staff account readable" ON public.staff_accounts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read staff accounts" ON public.staff_accounts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_staff_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r text := NEW.raw_user_meta_data->>'staff_role';
BEGIN
  IF r IN ('admin','supplier','partner') THEN
    INSERT INTO public.staff_accounts (user_id, email, full_name, company_name, requested_role)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'company_name', r)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_staff_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_staff_signup();

INSERT INTO public.staff_accounts (user_id, email, full_name, company_name, requested_role, status, admin_notified, decided_at)
SELECT DISTINCT ON (ur.user_id) ur.user_id, u.email, p.full_name, p.company_name, ur.role::text, 'active', true, now()
FROM public.user_roles ur JOIN auth.users u ON u.id = ur.user_id LEFT JOIN public.profiles p ON p.user_id = ur.user_id
ORDER BY ur.user_id, (ur.role::text = 'admin') DESC
ON CONFLICT DO NOTHING;