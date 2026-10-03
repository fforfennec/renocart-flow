-- lovable-cron-fallback-reviewed: Gmail inbox has no push webhook in this setup; replies must appear in chat within 2 min (existing cadence, only fixing auth)
CREATE TABLE public.internal_cron_tokens (
  name text PRIMARY KEY,
  token text NOT NULL DEFAULT (gen_random_uuid()::text || gen_random_uuid()::text)
);
GRANT ALL ON public.internal_cron_tokens TO service_role;
ALTER TABLE public.internal_cron_tokens ENABLE ROW LEVEL SECURITY;
INSERT INTO public.internal_cron_tokens (name) VALUES ('poll_supplier_emails') ON CONFLICT DO NOTHING;

SELECT cron.unschedule('poll-supplier-emails');
SELECT cron.schedule('poll-supplier-emails', '*/2 * * * *', $cron$
  SELECT net.http_post(
    url := 'https://bknqsrwgnefkxwzmspej.supabase.co/functions/v1/poll-supplier-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-token', (SELECT token FROM public.internal_cron_tokens WHERE name = 'poll_supplier_emails')
    ),
    body := '{}'::jsonb
  );
$cron$);