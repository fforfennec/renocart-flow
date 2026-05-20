
CREATE OR REPLACE FUNCTION public.auto_pause_incomplete_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.delivery_date IS NULL
     OR NEW.delivery_time_window IS NULL
     OR NEW.delivery_time_window = ''
     OR NEW.truck_type IS NULL
     OR NEW.truck_type = '' THEN
    NEW.automation_paused := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_pause_incomplete_orders ON public.orders;
CREATE TRIGGER trg_auto_pause_incomplete_orders
BEFORE INSERT OR UPDATE OF delivery_date, delivery_time_window, truck_type
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_pause_incomplete_orders();

-- Backfill: pause any existing orders that are missing these fields
UPDATE public.orders
SET automation_paused = true
WHERE automation_paused = false
  AND (
    delivery_date IS NULL
    OR delivery_time_window IS NULL OR delivery_time_window = ''
    OR truck_type IS NULL OR truck_type = ''
  );
