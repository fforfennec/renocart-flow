CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'poll-supplier-emails',
  '*/2 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://bknqsrwgnefkxwzmspej.supabase.co/functions/v1/poll-supplier-emails',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);