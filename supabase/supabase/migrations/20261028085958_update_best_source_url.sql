begin;

update chrsm_demo.knowledge_sources
set
  title = 'BOSA — BeSt Address Services',
  source_url = 'https://bosa.belgium.be/fr/services/best-address-services',
  notes = 'Source officielle BOSA; information stable, revalidation annuelle.'
where source_key = 'address-resolution-policy';

update chrsm_demo.knowledge_chunks
set metadata = jsonb_set(
  metadata,
  '{source_label}',
  to_jsonb('BOSA — BeSt Address Services'::text),
  true
)
where chunk_key = 'address-resolution-policy-v1';

commit;
