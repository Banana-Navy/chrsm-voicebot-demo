begin;

drop function if exists public.chrsm_demo_search_knowledge_lexical(
  text,
  text,
  integer
);

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

drop function if exists public.chrsm_demo_search_knowledge(
  extensions.vector,
  text,
  text,
  double precision,
  integer
);

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
      ) as semantic_rank
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

update chrsm_demo.knowledge_chunks
set category = 'securite'
where chunk_key = 'results-not-interpreted-v1'
  and category is distinct from 'securite';

commit;
