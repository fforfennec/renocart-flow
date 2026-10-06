CREATE TABLE public.suggestion_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 trigger_kind text NOT NULL CHECK (trigger_kind IN ('product','product_type')),
 trigger_value text NOT NULL,
 variant_id text NOT NULL,
 suggested_units integer NOT NULL DEFAULT 1 CHECK (suggested_units BETWEEN 1 AND 10000),
 trigger_units integer NOT NULL DEFAULT 1 CHECK (trigger_units BETWEEN 1 AND 10000),
 reason text NOT NULL DEFAULT 'Pour tes {n} unités',
 recommended boolean NOT NULL DEFAULT true,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.suggestion_rules TO authenticated;
GRANT ALL ON public.suggestion_rules TO service_role;
ALTER TABLE public.suggestion_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated admins read suggestion rules" ON public.suggestion_rules FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.suggestion_offers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id uuid NOT NULL,
 rule_id uuid NOT NULL REFERENCES public.suggestion_rules(id) ON DELETE CASCADE,
 accepted boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (session_id, rule_id)
);
GRANT SELECT ON public.suggestion_offers TO authenticated;
GRANT ALL ON public.suggestion_offers TO service_role;
ALTER TABLE public.suggestion_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated admins read suggestion offers" ON public.suggestion_offers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX suggestion_offers_rule_id_idx ON public.suggestion_offers(rule_id);