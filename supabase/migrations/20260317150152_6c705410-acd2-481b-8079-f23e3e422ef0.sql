CREATE OR REPLACE FUNCTION public.archive_old_delivered_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  archived_count integer;
  cutoff_date timestamp with time zone;
  days_counted integer := 0;
BEGIN
  cutoff_date := now();
  WHILE days_counted < 3 LOOP
    cutoff_date := cutoff_date - interval '1 day';
    IF EXTRACT(DOW FROM cutoff_date) NOT IN (0, 6) THEN
      days_counted := days_counted + 1;
    END IF;
  END LOOP;

  UPDATE orders
  SET status = 'archived', updated_at = now()
  WHERE status = 'delivered'
    AND updated_at <= cutoff_date;

  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$;