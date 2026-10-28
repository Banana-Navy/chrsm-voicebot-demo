-- Private CHRSM demo module for curated knowledge, callback requests, and email outbox.
-- Reviewed for isolated deployment in the shared Supabase project.

begin;

create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists chrsm_demo;

comment on schema chrsm_demo is
  'Private CHRSM demo knowledge, callback and notification data.';

revoke all on schema chrsm_demo from public, anon, authenticated;
grant usage on schema chrsm_demo to service_role;

alter default privileges in schema chrsm_demo
  revoke all on tables from public, anon, authenticated;
alter default privileges in schema chrsm_demo
  revoke all on sequences from public, anon, authenticated;
alter default privileges in schema chrsm_demo
  revoke execute on functions from public, anon, authenticated;

create function chrsm_demo.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

revoke all on function chrsm_demo.touch_updated_at()
  from public, anon, authenticated;

-- -------------------------------------------------------------------------
-- Private API clients and concrete ElevenLabs instances.
-- -------------------------------------------------------------------------

create table chrsm_demo.voicebot_instances (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'elevenlabs'
    check (provider = 'elevenlabs'),
  provider_agent_id text not null
    check (char_length(provider_agent_id) between 8 and 255),
  provider_branch_id text
    check (provider_branch_id is null or char_length(provider_branch_id) between 8 and 255),
  label text not null check (char_length(label) between 1 and 120),
  enabled boolean not null default true,
  is_test boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index voicebot_instances_provider_identity_uq
  on chrsm_demo.voicebot_instances (
    provider,
    provider_agent_id,
    coalesce(provider_branch_id, '')
  );

create index voicebot_instances_enabled_idx
  on chrsm_demo.voicebot_instances (id)
  where enabled;

create trigger voicebot_instances_touch_updated_at
before update on chrsm_demo.voicebot_instances
for each row execute function chrsm_demo.touch_updated_at();

create table chrsm_demo.api_clients (
  id uuid primary key default gen_random_uuid(),
  voicebot_instance_id uuid
    references chrsm_demo.voicebot_instances(id) on delete restrict,
  label text not null check (char_length(label) between 1 and 120),
  key_prefix text not null check (char_length(key_prefix) between 6 and 24),
  key_hash bytea not null unique check (octet_length(key_hash) = 32),
  scopes text[] not null
    check (
      cardinality(scopes) between 1 and 16
      and array_position(scopes, null) is null
    ),
  enabled boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index api_clients_instance_enabled_idx
  on chrsm_demo.api_clients (voicebot_instance_id, id)
  where enabled;

create trigger api_clients_touch_updated_at
before update on chrsm_demo.api_clients
for each row execute function chrsm_demo.touch_updated_at();

-- -------------------------------------------------------------------------
-- Curated, source-backed knowledge. Vectors are English semantic bridges;
-- factual content and answers remain French.
-- -------------------------------------------------------------------------

create table chrsm_demo.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique
    check (source_key ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  title text not null check (char_length(title) between 1 and 240),
  source_url text not null
    check (char_length(source_url) between 8 and 1200),
  authority text not null
    check (authority in ('chrsm', 'belgian_government', 'public_operator')),
  language_code text not null default 'fr'
    check (language_code in ('fr', 'nl', 'de', 'en')),
  content_sha256 bytea check (
    content_sha256 is null or octet_length(content_sha256) = 32
  ),
  retrieved_at timestamptz not null,
  verified_at timestamptz not null,
  next_review_at timestamptz not null,
  active boolean not null default true,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_sources_review_timeline_check
    check (next_review_at >= verified_at)
);

create index knowledge_sources_review_due_idx
  on chrsm_demo.knowledge_sources (next_review_at, id)
  where active;

create trigger knowledge_sources_touch_updated_at
before update on chrsm_demo.knowledge_sources
for each row execute function chrsm_demo.touch_updated_at();

create table chrsm_demo.knowledge_chunks (
  id bigint generated always as identity primary key,
  source_id uuid not null
    references chrsm_demo.knowledge_sources(id) on delete restrict,
  chunk_key text not null unique
    check (chunk_key ~ '^[a-z0-9][a-z0-9-]{1,119}$'),
  category text not null check (category in (
    'contact', 'urgence', 'acces', 'visites', 'rendez_vous',
    'documents', 'orientation', 'accessibilite', 'services',
    'confidentialite', 'securite', 'adresse'
  )),
  title_fr text not null check (char_length(title_fr) between 1 and 240),
  retrieval_text_fr text not null
    check (char_length(retrieval_text_fr) between 1 and 2000),
  answer_fr text not null
    check (char_length(answer_fr) between 1 and 1400),
  facts_fr text not null
    check (char_length(facts_fr) between 1 and 4000),
  embedding_input_en text not null
    check (char_length(embedding_input_en) between 1 and 1800),
  embedding_input_sha256 bytea generated always as (
    extensions.digest(embedding_input_en, 'sha256')
  ) stored,
  embedding extensions.vector(384),
  embedding_model text not null default 'gte-small'
    check (embedding_model = 'gte-small'),
  embedded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(metadata) = 'object'
      and octet_length(metadata::text) <= 8192
    ),
  valid_from timestamptz,
  valid_until timestamptz,
  verified_at timestamptz not null,
  active boolean not null default true,
  search_vector_fr tsvector generated always as (
    setweight(to_tsvector('pg_catalog.french'::regconfig, coalesce(title_fr, '')), 'A') ||
    setweight(to_tsvector('pg_catalog.french'::regconfig, coalesce(retrieval_text_fr, '')), 'A') ||
    setweight(to_tsvector('pg_catalog.french'::regconfig, coalesce(answer_fr, '')), 'B') ||
    setweight(to_tsvector('pg_catalog.french'::regconfig, coalesce(facts_fr, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_chunks_validity_timeline_check
    check (valid_until is null or valid_from is null or valid_until >= valid_from),
  constraint knowledge_chunks_embedding_state_check
    check (
      (embedding is null and embedded_at is null)
      or (embedding is not null and embedded_at is not null)
    )
);

create index knowledge_chunks_source_id_idx
  on chrsm_demo.knowledge_chunks (source_id);

create index knowledge_chunks_active_category_idx
  on chrsm_demo.knowledge_chunks (category, verified_at desc, id)
  where active;

create index knowledge_chunks_search_fr_idx
  on chrsm_demo.knowledge_chunks using gin (search_vector_fr);

create index knowledge_chunks_retrieval_trgm_idx
  on chrsm_demo.knowledge_chunks using gin (
    retrieval_text_fr extensions.gin_trgm_ops
  );

create index knowledge_chunks_embedding_hnsw_idx
  on chrsm_demo.knowledge_chunks using hnsw (
    embedding extensions.vector_ip_ops
  );

create trigger knowledge_chunks_touch_updated_at
before update on chrsm_demo.knowledge_chunks
for each row execute function chrsm_demo.touch_updated_at();

-- -------------------------------------------------------------------------
-- Minimal callback data. There is intentionally no medical-notes field and
-- no persisted residential address.
-- -------------------------------------------------------------------------

create table chrsm_demo.callback_requests (
  id uuid primary key default gen_random_uuid(),
  voicebot_instance_id uuid not null
    references chrsm_demo.voicebot_instances(id) on delete restrict,
  provider_conversation_id text not null
    check (char_length(provider_conversation_id) between 8 and 255),
  idempotency_key text not null
    check (char_length(idempotency_key) between 12 and 255),
  reference_code text not null unique default (
    'CHRSM-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  request_type text not null check (request_type in (
    'appointment_request', 'appointment_change',
    'administrative_callback', 'general_callback'
  )),
  appointment_action text check (
    appointment_action is null
    or appointment_action in ('new', 'reschedule', 'cancel')
  ),
  first_name text not null check (char_length(first_name) between 1 and 100),
  last_name text not null check (char_length(last_name) between 1 and 120),
  phone_e164 text not null
    check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (
    email is null
    or (
      char_length(email) between 3 and 320
      and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    )
  ),
  service_requested text
    check (service_requested is null or char_length(service_requested) <= 160),
  preferred_day text
    check (preferred_day is null or char_length(preferred_day) <= 160),
  preferred_time_window text check (
    preferred_time_window is null
    or preferred_time_window in ('morning', 'afternoon', 'any')
  ),
  callback_language text not null default 'fr'
    check (callback_language in ('fr', 'nl', 'de', 'en')),
  consent_version text not null
    check (char_length(consent_version) between 3 and 80),
  consent_at timestamptz not null,
  demo_limitation_acknowledged boolean not null
    check (demo_limitation_acknowledged),
  status text not null default 'queued' check (status in (
    'queued', 'notified', 'contacted', 'closed', 'cancelled', 'expired'
  )),
  is_test boolean not null default true,
  retention_delete_after timestamptz not null
    default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint callback_requests_instance_idempotency_uq
    unique (voicebot_instance_id, idempotency_key),
  constraint callback_requests_consent_timeline_check
    check (consent_at <= created_at + interval '5 minutes'),
  constraint callback_requests_retention_check
    check (retention_delete_after > created_at)
);

create index callback_requests_instance_created_idx
  on chrsm_demo.callback_requests (
    voicebot_instance_id,
    created_at desc,
    id
  );

create index callback_requests_retention_idx
  on chrsm_demo.callback_requests (retention_delete_after, id);

create trigger callback_requests_touch_updated_at
before update on chrsm_demo.callback_requests
for each row execute function chrsm_demo.touch_updated_at();

create table chrsm_demo.callback_events (
  id bigint generated always as identity primary key,
  callback_request_id uuid not null
    references chrsm_demo.callback_requests(id) on delete cascade,
  event_type text not null check (event_type in (
    'created', 'email_queued', 'email_sent', 'email_failed',
    'status_changed', 'purged'
  )),
  actor_source text not null
    check (actor_source in ('voicebot', 'operator', 'system')),
  event_data jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(event_data) = 'object'
      and octet_length(event_data::text) <= 4096
    ),
  occurred_at timestamptz not null default now()
);

create index callback_events_request_time_idx
  on chrsm_demo.callback_events (
    callback_request_id,
    occurred_at desc,
    id desc
  );

create table chrsm_demo.callback_email_configs (
  id uuid primary key default gen_random_uuid(),
  event_key text not null default 'callback.created'
    check (event_key = 'callback.created'),
  destination text not null
    check (
      char_length(destination) between 3 and 320
      and destination ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    ),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint callback_email_configs_event_uq unique (event_key)
);

create trigger callback_email_configs_touch_updated_at
before update on chrsm_demo.callback_email_configs
for each row execute function chrsm_demo.touch_updated_at();

create table chrsm_demo.callback_outbox (
  id uuid primary key default gen_random_uuid(),
  callback_request_id uuid not null
    references chrsm_demo.callback_requests(id) on delete cascade,
  callback_email_config_id uuid not null
    references chrsm_demo.callback_email_configs(id) on delete restrict,
  event_key text not null default 'callback.created'
    check (event_key = 'callback.created'),
  recipient_snapshot text not null,
  idempotency_key text not null unique,
  delivery_status text not null default 'pending' check (delivery_status in (
    'pending', 'processing', 'sent', 'retryable_error', 'dead_letter'
  )),
  attempt_count integer not null default 0
    check (attempt_count between 0 and 20),
  available_at timestamptz not null default now(),
  locked_until timestamptz,
  lock_token uuid,
  sent_at timestamptz,
  provider_message_id text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint callback_outbox_request_event_uq
    unique (callback_request_id, event_key),
  constraint callback_outbox_sent_check
    check (delivery_status <> 'sent' or sent_at is not null)
);

create index callback_outbox_claim_idx
  on chrsm_demo.callback_outbox (available_at, created_at, id)
  where delivery_status in ('pending', 'processing', 'retryable_error');

create index callback_outbox_request_idx
  on chrsm_demo.callback_outbox (callback_request_id, created_at desc);

create index callback_outbox_config_idx
  on chrsm_demo.callback_outbox (callback_email_config_id);

create trigger callback_outbox_touch_updated_at
before update on chrsm_demo.callback_outbox
for each row execute function chrsm_demo.touch_updated_at();

-- -------------------------------------------------------------------------
-- Browser rate limit. The subject is an HMAC/SHA-256 digest produced by the
-- Edge Function; raw IP addresses are never stored.
-- -------------------------------------------------------------------------

create table chrsm_demo.rate_limit_buckets (
  purpose text not null check (purpose in (
    'conversation_token', 'address_lookup', 'callback_request'
  )),
  subject_hash bytea not null check (octet_length(subject_hash) = 32),
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count between 1 and 10000),
  updated_at timestamptz not null default now(),
  primary key (purpose, subject_hash, window_started_at)
);

create index rate_limit_buckets_cleanup_idx
  on chrsm_demo.rate_limit_buckets (window_started_at);

-- -------------------------------------------------------------------------
-- RLS and minimum privileges. No client policy is created.
-- -------------------------------------------------------------------------

alter table chrsm_demo.voicebot_instances enable row level security;
alter table chrsm_demo.voicebot_instances force row level security;
alter table chrsm_demo.api_clients enable row level security;
alter table chrsm_demo.api_clients force row level security;
alter table chrsm_demo.knowledge_sources enable row level security;
alter table chrsm_demo.knowledge_sources force row level security;
alter table chrsm_demo.knowledge_chunks enable row level security;
alter table chrsm_demo.knowledge_chunks force row level security;
alter table chrsm_demo.callback_requests enable row level security;
alter table chrsm_demo.callback_requests force row level security;
alter table chrsm_demo.callback_events enable row level security;
alter table chrsm_demo.callback_events force row level security;
alter table chrsm_demo.callback_email_configs enable row level security;
alter table chrsm_demo.callback_email_configs force row level security;
alter table chrsm_demo.callback_outbox enable row level security;
alter table chrsm_demo.callback_outbox force row level security;
alter table chrsm_demo.rate_limit_buckets enable row level security;
alter table chrsm_demo.rate_limit_buckets force row level security;

revoke all on all tables in schema chrsm_demo
  from public, anon, authenticated;
revoke all on all sequences in schema chrsm_demo
  from public, anon, authenticated;

grant select, insert, update, delete on all tables in schema chrsm_demo
  to service_role;
grant usage, select on all sequences in schema chrsm_demo
  to service_role;

-- -------------------------------------------------------------------------
-- Fixed server-only RPC surface.
-- -------------------------------------------------------------------------

create function public.chrsm_demo_authorize(
  p_api_key text,
  p_required_scope text
)
returns table (
  client_id uuid,
  voicebot_instance_id uuid
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.voicebot_instance_id
  from chrsm_demo.api_clients c
  where char_length(p_api_key) between 32 and 256
    and p_required_scope is not null
    and c.key_hash = extensions.digest(convert_to(p_api_key, 'UTF8'), 'sha256')
    and c.enabled
    and (c.expires_at is null or c.expires_at > statement_timestamp())
    and p_required_scope = any(c.scopes)
    and (
      c.voicebot_instance_id is null
      or exists (
        select 1
        from chrsm_demo.voicebot_instances vi
        where vi.id = c.voicebot_instance_id
          and vi.enabled
      )
    );
$$;

revoke all on function public.chrsm_demo_authorize(text, text)
  from public, anon, authenticated;
grant execute on function public.chrsm_demo_authorize(text, text)
  to service_role;

-- Fixed-name Vault reader for the private ElevenLabs agent. The caller cannot
-- request an arbitrary secret name. PUBLIC execution is revoked below.
create function public.chrsm_demo_get_elevenlabs_runtime_config()
returns table (
  elevenlabs_api_key text,
  elevenlabs_agent_id text,
  rate_limit_pepper text
)
language sql
stable
security definer
set search_path = ''
as $$
  with configured as (
    select
      max(secret.decrypted_secret)
        filter (where secret.name = 'chrsm_elevenlabs_api_key') as api_key,
      max(secret.decrypted_secret)
        filter (where secret.name = 'chrsm_elevenlabs_agent_id') as agent_id,
      max(secret.decrypted_secret)
        filter (where secret.name = 'chrsm_rate_limit_pepper') as pepper
    from vault.decrypted_secrets secret
    where secret.name in (
      'chrsm_elevenlabs_api_key',
      'chrsm_elevenlabs_agent_id',
      'chrsm_rate_limit_pepper'
    )
  )
  select configured.api_key, configured.agent_id, configured.pepper
  from configured
  where configured.api_key is not null
    and configured.agent_id is not null
    and configured.pepper is not null;
$$;

revoke all on function public.chrsm_demo_get_elevenlabs_runtime_config()
  from public, anon, authenticated;
grant execute on function public.chrsm_demo_get_elevenlabs_runtime_config()
  to service_role;

-- Resolve the concrete private agent instance for browser-originated callback
-- requests without exposing any database identifier to the landing page.
create function public.chrsm_demo_get_active_instance_id(
  p_provider_agent_id text
)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select vi.id
  from chrsm_demo.voicebot_instances vi
  where vi.provider = 'elevenlabs'
    and vi.provider_agent_id = p_provider_agent_id
    and vi.enabled
  order by vi.updated_at desc, vi.id
  limit 1;
$$;

revoke all on function public.chrsm_demo_get_active_instance_id(text)
  from public, anon, authenticated;
grant execute on function public.chrsm_demo_get_active_instance_id(text)
  to service_role;

create function public.chrsm_demo_list_unembedded_chunks(
  p_limit integer default 20
)
returns table (
  chunk_id bigint,
  embedding_input_en text,
  embedding_input_sha256 bytea
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.embedding_input_en, c.embedding_input_sha256
  from chrsm_demo.knowledge_chunks c
  join chrsm_demo.knowledge_sources s on s.id = c.source_id
  where c.active
    and s.active
    and c.embedding is null
  order by c.id
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

revoke all on function public.chrsm_demo_list_unembedded_chunks(integer)
  from public, anon, authenticated;
grant execute on function public.chrsm_demo_list_unembedded_chunks(integer)
  to service_role;

create function public.chrsm_demo_set_chunk_embedding(
  p_chunk_id bigint,
  p_expected_sha256 bytea,
  p_embedding extensions.vector(384)
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if p_embedding is null or octet_length(p_expected_sha256) <> 32 then
    return false;
  end if;

  update chrsm_demo.knowledge_chunks c
  set
    embedding = p_embedding,
    embedding_model = 'gte-small',
    embedded_at = clock_timestamp()
  where c.id = p_chunk_id
    and c.embedding_input_sha256 = p_expected_sha256;

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

revoke all on function public.chrsm_demo_set_chunk_embedding(
  bigint,
  bytea,
  extensions.vector
) from public, anon, authenticated;
grant execute on function public.chrsm_demo_set_chunk_embedding(
  bigint,
  bytea,
  extensions.vector
) to service_role;

create function public.chrsm_demo_search_knowledge_lexical(
  p_query_fr text,
  p_category text default null,
  p_limit integer default 5
)
returns table (
  chunk_id bigint,
  category text,
  title_fr text,
  answer_fr text,
  facts_fr text,
  source_title text,
  source_url text,
  source_verified_at timestamptz,
  source_next_review_at timestamptz,
  score double precision,
  retrieval_mode text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select nullif(trim(coalesce(p_query_fr, '')), '') as query_fr
  ),
  ranked as (
    select
      c.id,
      c.category,
      c.title_fr,
      c.answer_fr,
      c.facts_fr,
      s.title as source_title,
      s.source_url,
      s.verified_at as source_verified_at,
      s.next_review_at as source_next_review_at,
      greatest(
        ts_rank_cd(
          c.search_vector_fr,
          plainto_tsquery('pg_catalog.french'::regconfig, params.query_fr),
          32
        )::double precision,
        extensions.similarity(c.retrieval_text_fr, params.query_fr)::double precision
      ) as lexical_score
    from chrsm_demo.knowledge_chunks c
    join chrsm_demo.knowledge_sources s on s.id = c.source_id
    cross join params
    where params.query_fr is not null
      and c.active
      and s.active
      and s.next_review_at > statement_timestamp()
      and (c.valid_from is null or c.valid_from <= statement_timestamp())
      and (c.valid_until is null or c.valid_until > statement_timestamp())
      and (p_category is null or c.category = p_category)
      and (
        c.search_vector_fr @@ plainto_tsquery(
          'pg_catalog.french'::regconfig,
          params.query_fr
        )
        or c.retrieval_text_fr OPERATOR(extensions.%) params.query_fr
      )
  )
  select
    ranked.id,
    ranked.category,
    ranked.title_fr,
    ranked.answer_fr,
    ranked.facts_fr,
    ranked.source_title,
    ranked.source_url,
    ranked.source_verified_at,
    ranked.source_next_review_at,
    ranked.lexical_score,
    'lexical'::text
  from ranked
  order by ranked.lexical_score desc, ranked.id
  limit least(greatest(coalesce(p_limit, 5), 1), 10);
$$;

revoke all on function public.chrsm_demo_search_knowledge_lexical(
  text,
  text,
  integer
) from public, anon, authenticated;
grant execute on function public.chrsm_demo_search_knowledge_lexical(
  text,
  text,
  integer
) to service_role;

create function public.chrsm_demo_search_knowledge(
  p_query_embedding extensions.vector(384),
  p_query_fr text,
  p_category text default null,
  p_min_similarity double precision default 0.45,
  p_limit integer default 5
)
returns table (
  chunk_id bigint,
  category text,
  title_fr text,
  answer_fr text,
  facts_fr text,
  source_title text,
  source_url text,
  source_verified_at timestamptz,
  source_next_review_at timestamptz,
  semantic_similarity double precision,
  lexical_score double precision,
  fused_score double precision,
  retrieval_mode text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with eligible as materialized (
    select c.*, s.title as source_title, s.source_url,
      s.verified_at as source_verified_at,
      s.next_review_at as source_next_review_at
    from chrsm_demo.knowledge_chunks c
    join chrsm_demo.knowledge_sources s on s.id = c.source_id
    where c.active
      and s.active
      and s.next_review_at > statement_timestamp()
      and c.embedding is not null
      and (c.valid_from is null or c.valid_from <= statement_timestamp())
      and (c.valid_until is null or c.valid_until > statement_timestamp())
      and (p_category is null or c.category = p_category)
  ),
  semantic as (
    select
      e.id,
      -(e.embedding OPERATOR(extensions.<#>) p_query_embedding)::double precision as similarity,
      row_number() over (
        order by e.embedding OPERATOR(extensions.<#>) p_query_embedding, e.id
      )
        as semantic_rank
    from eligible e
    where -(e.embedding OPERATOR(extensions.<#>) p_query_embedding) >= least(
      greatest(coalesce(p_min_similarity, 0.45), 0.0),
      1.0
    )
    order by e.embedding OPERATOR(extensions.<#>) p_query_embedding, e.id
    limit 30
  ),
  lexical as (
    select
      e.id,
      greatest(
        ts_rank_cd(
          e.search_vector_fr,
          plainto_tsquery(
            'pg_catalog.french'::regconfig,
            nullif(trim(coalesce(p_query_fr, '')), '')
          ),
          32
        )::double precision,
        extensions.similarity(
          e.retrieval_text_fr,
          nullif(trim(coalesce(p_query_fr, '')), '')
        )::double precision
      ) as lexical_score,
      row_number() over (
        order by greatest(
          ts_rank_cd(
            e.search_vector_fr,
            plainto_tsquery(
              'pg_catalog.french'::regconfig,
              nullif(trim(coalesce(p_query_fr, '')), '')
            ),
            32
          )::double precision,
          extensions.similarity(
            e.retrieval_text_fr,
            nullif(trim(coalesce(p_query_fr, '')), '')
          )::double precision
        ) desc,
        e.id
      ) as lexical_rank
    from eligible e
    where nullif(trim(coalesce(p_query_fr, '')), '') is not null
      and (
        e.search_vector_fr @@ plainto_tsquery(
          'pg_catalog.french'::regconfig,
          nullif(trim(coalesce(p_query_fr, '')), '')
        )
        or e.retrieval_text_fr OPERATOR(extensions.%)
          nullif(trim(coalesce(p_query_fr, '')), '')
      )
    order by lexical_score desc, e.id
    limit 30
  ),
  candidate_ids as (
    select semantic.id from semantic
    union
    select lexical.id from lexical
  )
  select
    e.id,
    e.category,
    e.title_fr,
    e.answer_fr,
    e.facts_fr,
    e.source_title,
    e.source_url,
    e.source_verified_at,
    e.source_next_review_at,
    semantic.similarity,
    lexical.lexical_score,
    (
      coalesce(1.0 / (60.0 + semantic.semantic_rank), 0.0)
      + coalesce(1.0 / (60.0 + lexical.lexical_rank), 0.0)
    )::double precision as fused_score,
    case
      when semantic.id is not null and lexical.id is not null then 'hybrid'
      when semantic.id is not null then 'semantic'
      else 'lexical'
    end as retrieval_mode
  from candidate_ids ids
  join eligible e on e.id = ids.id
  left join semantic on semantic.id = ids.id
  left join lexical on lexical.id = ids.id
  order by fused_score desc, semantic.similarity desc nulls last, e.id
  limit least(greatest(coalesce(p_limit, 5), 1), 10);
$$;

revoke all on function public.chrsm_demo_search_knowledge(
  extensions.vector,
  text,
  text,
  double precision,
  integer
) from public, anon, authenticated;
grant execute on function public.chrsm_demo_search_knowledge(
  extensions.vector,
  text,
  text,
  double precision,
  integer
) to service_role;

create function public.chrsm_demo_record_callback(
  p_voicebot_instance_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_config_id uuid;
  v_recipient text;
  v_callback_id uuid;
  v_reference_code text;
  v_created boolean := false;
  v_consent_at timestamptz;
begin
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload_must_be_object' using errcode = '22023';
  end if;

  if coalesce((p_payload ->> 'consent_callback')::boolean, false) is not true
     or coalesce((p_payload ->> 'demo_limitation_acknowledged')::boolean, false) is not true then
    raise exception 'explicit_consent_and_demo_acknowledgement_required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from chrsm_demo.voicebot_instances vi
    where vi.id = p_voicebot_instance_id and vi.enabled
  ) then
    raise exception 'voicebot_instance_not_configured' using errcode = '42501';
  end if;

  select c.id, c.destination
  into v_config_id, v_recipient
  from chrsm_demo.callback_email_configs c
  where c.event_key = 'callback.created'
    and c.enabled
  limit 1;

  if v_config_id is null then
    raise exception 'callback_email_not_configured' using errcode = '55000';
  end if;

  begin
    v_consent_at := (p_payload ->> 'consent_at')::timestamptz;
  exception when others then
    raise exception 'invalid_consent_at' using errcode = '22023';
  end;
  v_consent_at := coalesce(v_consent_at, clock_timestamp());

  insert into chrsm_demo.callback_requests (
    voicebot_instance_id,
    provider_conversation_id,
    idempotency_key,
    request_type,
    appointment_action,
    first_name,
    last_name,
    phone_e164,
    email,
    service_requested,
    preferred_day,
    preferred_time_window,
    callback_language,
    consent_version,
    consent_at,
    demo_limitation_acknowledged,
    is_test
  ) values (
    p_voicebot_instance_id,
    p_payload ->> 'conversation_id',
    p_payload ->> 'idempotency_key',
    p_payload ->> 'request_type',
    nullif(p_payload ->> 'appointment_action', ''),
    p_payload ->> 'first_name',
    p_payload ->> 'last_name',
    p_payload ->> 'phone_e164',
    nullif(lower(p_payload ->> 'email'), ''),
    nullif(p_payload ->> 'service_requested', ''),
    nullif(p_payload ->> 'preferred_day', ''),
    nullif(p_payload ->> 'preferred_time_window', ''),
    coalesce(nullif(p_payload ->> 'language', ''), 'fr'),
    p_payload ->> 'consent_version',
    v_consent_at,
    true,
    coalesce((p_payload ->> 'is_test')::boolean, true)
  )
  on conflict (voicebot_instance_id, idempotency_key) do nothing
  returning id, reference_code into v_callback_id, v_reference_code;

  if v_callback_id is not null then
    v_created := true;

    insert into chrsm_demo.callback_events (
      callback_request_id,
      event_type,
      actor_source
    ) values (
      v_callback_id,
      'created',
      'voicebot'
    );

    insert into chrsm_demo.callback_outbox (
      callback_request_id,
      callback_email_config_id,
      recipient_snapshot,
      idempotency_key
    ) values (
      v_callback_id,
      v_config_id,
      v_recipient,
      'callback.created:' || v_callback_id::text
    );

    insert into chrsm_demo.callback_events (
      callback_request_id,
      event_type,
      actor_source
    ) values (
      v_callback_id,
      'email_queued',
      'system'
    );
  else
    select r.id, r.reference_code
    into v_callback_id, v_reference_code
    from chrsm_demo.callback_requests r
    where r.voicebot_instance_id = p_voicebot_instance_id
      and r.idempotency_key = p_payload ->> 'idempotency_key';
  end if;

  return jsonb_build_object(
    'status', 'queued',
    'reference', v_reference_code,
    'created', v_created
  );
end;
$$;

revoke all on function public.chrsm_demo_record_callback(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.chrsm_demo_record_callback(uuid, jsonb)
  to service_role;

create function public.chrsm_demo_claim_callback_emails(
  p_limit integer default 10
)
returns table (
  outbox_id uuid,
  lock_token uuid,
  recipient text,
  idempotency_key text,
  attempt_count integer,
  reference_code text,
  request_type text,
  appointment_action text,
  first_name text,
  last_name text,
  phone_e164 text,
  email text,
  service_requested text,
  preferred_day text,
  preferred_time_window text,
  callback_language text,
  is_test boolean,
  created_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  with due as (
    select o.id
    from chrsm_demo.callback_outbox o
    where o.available_at <= clock_timestamp()
      and (
        o.delivery_status in ('pending', 'retryable_error')
        or (
          o.delivery_status = 'processing'
          and o.locked_until < clock_timestamp()
        )
      )
    order by o.available_at, o.created_at
    limit least(greatest(coalesce(p_limit, 10), 1), 50)
    for update skip locked
  ),
  claimed as (
    update chrsm_demo.callback_outbox o
    set
      delivery_status = 'processing',
      attempt_count = o.attempt_count + 1,
      lock_token = gen_random_uuid(),
      locked_until = clock_timestamp() + interval '5 minutes'
    from due
    where o.id = due.id
    returning o.*
  )
  select
    c.id,
    c.lock_token,
    c.recipient_snapshot,
    c.idempotency_key,
    c.attempt_count,
    r.reference_code,
    r.request_type,
    r.appointment_action,
    r.first_name,
    r.last_name,
    r.phone_e164,
    r.email,
    r.service_requested,
    r.preferred_day,
    r.preferred_time_window,
    r.callback_language,
    r.is_test,
    r.created_at
  from claimed c
  join chrsm_demo.callback_requests r on r.id = c.callback_request_id;
$$;

revoke all on function public.chrsm_demo_claim_callback_emails(integer)
  from public, anon, authenticated;
grant execute on function public.chrsm_demo_claim_callback_emails(integer)
  to service_role;

create function public.chrsm_demo_mark_callback_email_sent(
  p_outbox_id uuid,
  p_lock_token uuid,
  p_provider_message_id text default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rows integer;
  v_callback_id uuid;
begin
  update chrsm_demo.callback_outbox o
  set
    delivery_status = 'sent',
    sent_at = clock_timestamp(),
    provider_message_id = left(p_provider_message_id, 255),
    locked_until = null,
    lock_token = null,
    last_error_code = null
  where o.id = p_outbox_id
    and o.lock_token = p_lock_token
    and o.delivery_status = 'processing'
  returning o.callback_request_id into v_callback_id;

  get diagnostics v_rows = row_count;
  if v_rows = 1 then
    update chrsm_demo.callback_requests r
    set status = 'notified'
    where r.id = v_callback_id and r.status = 'queued';

    insert into chrsm_demo.callback_events (
      callback_request_id,
      event_type,
      actor_source,
      event_data
    ) values (
      v_callback_id,
      'email_sent',
      'system',
      jsonb_build_object('outbox_id', p_outbox_id)
    );
  end if;
  return v_rows = 1;
end;
$$;

revoke all on function public.chrsm_demo_mark_callback_email_sent(
  uuid,
  uuid,
  text
) from public, anon, authenticated;
grant execute on function public.chrsm_demo_mark_callback_email_sent(
  uuid,
  uuid,
  text
) to service_role;

create function public.chrsm_demo_mark_callback_email_failed(
  p_outbox_id uuid,
  p_lock_token uuid,
  p_error_code text,
  p_retry_after_seconds integer default 60
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rows integer;
  v_callback_id uuid;
  v_dead_letter boolean;
begin
  update chrsm_demo.callback_outbox o
  set
    delivery_status = case
      when o.attempt_count >= 8 then 'dead_letter'
      else 'retryable_error'
    end,
    available_at = clock_timestamp() + make_interval(
      secs => least(greatest(coalesce(p_retry_after_seconds, 60), 30), 86400)
    ),
    locked_until = null,
    lock_token = null,
    last_error_code = left(coalesce(p_error_code, 'delivery_failed'), 160)
  where o.id = p_outbox_id
    and o.lock_token = p_lock_token
    and o.delivery_status = 'processing'
  returning o.callback_request_id, o.delivery_status = 'dead_letter'
  into v_callback_id, v_dead_letter;

  get diagnostics v_rows = row_count;
  if v_rows = 1 then
    insert into chrsm_demo.callback_events (
      callback_request_id,
      event_type,
      actor_source,
      event_data
    ) values (
      v_callback_id,
      'email_failed',
      'system',
      jsonb_build_object(
        'outbox_id', p_outbox_id,
        'dead_letter', v_dead_letter
      )
    );
  end if;
  return v_rows = 1;
end;
$$;

revoke all on function public.chrsm_demo_mark_callback_email_failed(
  uuid,
  uuid,
  text,
  integer
) from public, anon, authenticated;
grant execute on function public.chrsm_demo_mark_callback_email_failed(
  uuid,
  uuid,
  text,
  integer
) to service_role;

create function public.chrsm_demo_consume_rate_limit(
  p_purpose text,
  p_subject_hash bytea,
  p_window_seconds integer,
  p_request_limit integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_window_started_at timestamptz;
  v_accepted boolean := false;
begin
  if p_purpose not in (
       'conversation_token',
       'address_lookup',
       'callback_request'
     )
     or octet_length(p_subject_hash) <> 32
     or p_window_seconds not between 60 and 86400
     or p_request_limit not between 1 and 100 then
    return false;
  end if;

  v_window_started_at := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds)
    * p_window_seconds
  );

  insert into chrsm_demo.rate_limit_buckets (
    purpose,
    subject_hash,
    window_started_at,
    request_count
  ) values (
    p_purpose,
    p_subject_hash,
    v_window_started_at,
    1
  )
  on conflict (purpose, subject_hash, window_started_at)
  do update set
    request_count = chrsm_demo.rate_limit_buckets.request_count + 1,
    updated_at = clock_timestamp()
  where chrsm_demo.rate_limit_buckets.request_count < p_request_limit
  returning true into v_accepted;

  return coalesce(v_accepted, false);
end;
$$;

revoke all on function public.chrsm_demo_consume_rate_limit(
  text,
  bytea,
  integer,
  integer
) from public, anon, authenticated;
grant execute on function public.chrsm_demo_consume_rate_limit(
  text,
  bytea,
  integer,
  integer
) to service_role;

create function chrsm_demo.purge_expired_data()
returns table (
  callbacks_deleted bigint,
  rate_limit_buckets_deleted bigint
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_callbacks bigint;
  v_buckets bigint;
begin
  delete from chrsm_demo.callback_requests r
  where r.retention_delete_after <= clock_timestamp();
  get diagnostics v_callbacks = row_count;

  delete from chrsm_demo.rate_limit_buckets b
  where b.window_started_at < clock_timestamp() - interval '2 days';
  get diagnostics v_buckets = row_count;

  return query select v_callbacks, v_buckets;
end;
$$;

revoke all on function chrsm_demo.purge_expired_data()
  from public, anon, authenticated;
grant execute on function chrsm_demo.purge_expired_data()
  to service_role;

-- Schedule only local database cleanup here. The HTTP dispatcher schedule is
-- installed separately after its raw worker token exists in Vault.
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'chrsm-demo-purge-expired-data'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end;
$$;

select cron.schedule(
  'chrsm-demo-purge-expired-data',
  '17 3 * * *',
  $cleanup$select * from chrsm_demo.purge_expired_data();$cleanup$
);

notify pgrst, 'reload schema';

commit;
