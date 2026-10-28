-- Retry queued CHRSM demo callback notifications once per minute.
do $$
begin
  if exists (
    select 1 from cron.job where jobname = 'chrsm-demo-callback-dispatch'
  ) then
    perform cron.unschedule('chrsm-demo-callback-dispatch');
  end if;
end;
$$;

select cron.schedule(
  'chrsm-demo-callback-dispatch',
  '* * * * *',
  $dispatch$
    select net.http_post(
      url := 'https://xqaydfqzhaqksappexdg.supabase.co/functions/v1/chrsm-callback',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-notification-token', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'chrsm_callback_dispatch_token'
          limit 1
        )
      ),
      body := '{"action":"dispatch","limit":10}'::jsonb,
      timeout_milliseconds := 10000
    )
    where exists (
      select 1
      from vault.decrypted_secrets
      where name = 'chrsm_callback_dispatch_token'
    );
  $dispatch$
);
