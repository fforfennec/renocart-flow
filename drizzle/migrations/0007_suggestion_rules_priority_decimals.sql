ALTER TABLE public.suggestion_rules
  ADD COLUMN priority integer NOT NULL DEFAULT 100 CHECK (priority BETWEEN 1 AND 1000),
  ADD COLUMN note text CHECK (note IS NULL OR char_length(note) <= 1000),
  ADD COLUMN trigger_values text[] NOT NULL DEFAULT '{}',
  ADD COLUMN suggested_qty numeric(10,3) CHECK (suggested_qty IS NULL OR (suggested_qty > 0 AND suggested_qty <= 10000)),
  ADD COLUMN trigger_qty numeric(10,3) CHECK (trigger_qty IS NULL OR (trigger_qty > 0 AND trigger_qty <= 10000));
UPDATE public.suggestion_rules SET trigger_values = ARRAY[trigger_value], suggested_qty = suggested_units, trigger_qty = trigger_units;
ALTER TABLE public.suggestion_rules DROP CONSTRAINT suggestion_rules_trigger_kind_check;
ALTER TABLE public.suggestion_rules ADD CONSTRAINT suggestion_rules_trigger_kind_check CHECK (trigger_kind = ANY (ARRAY['product','product_type','variant']));
COMMENT ON COLUMN public.suggestion_rules.trigger_value IS 'DEPRECATED: replaced by trigger_values';
COMMENT ON COLUMN public.suggestion_rules.suggested_units IS 'DEPRECATED: replaced by suggested_qty';
COMMENT ON COLUMN public.suggestion_rules.trigger_units IS 'DEPRECATED: replaced by trigger_qty';