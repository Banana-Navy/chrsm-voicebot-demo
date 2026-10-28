-- Enables synchronous outbound requests for controlled, private agent
-- operations performed from Postgres with API credentials kept in Vault.
create extension if not exists http with schema extensions;
