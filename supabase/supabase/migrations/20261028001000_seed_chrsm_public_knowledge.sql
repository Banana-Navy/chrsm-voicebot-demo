-- Curated CHRSM public knowledge seed generated from knowledge/official-source-registry.json.
begin;

-- identity-contact
with source_row as (
  insert into chrsm_demo.knowledge_sources (
    source_key, title, source_url, authority, language_code,
    retrieved_at, verified_at, next_review_at, active, notes
  ) values (
    'identity-contact', 'CHRSM — Consultations à Namur', 'https://meuse.chrsm.be/consultations-%C3%A0-namur',
    'chrsm', 'fr', '2026-10-28T00:00:00Z',
    '2026-10-28T00:00:00Z', '2027-10-28T00:00:00Z', true,
    'Information stable, revalidation annuelle.'
  )
  on conflict (source_key) do update set
    title = excluded.title,
    source_url = excluded.source_url,
    authority = excluded.authority,
    language_code = excluded.language_code,
    retrieved_at = excluded.retrieved_at,
    verified_at = excluded.verified_at,
    next_review_at = excluded.next_review_at,
    active = true,
    notes = excluded.notes
  returning id
)
insert into chrsm_demo.knowledge_chunks as existing (
  source_id, chunk_key, category, title_fr, retrieval_text_fr, answer_fr,
  facts_fr, embedding_input_en, metadata, verified_at, active
)
select
  source_row.id, 'identity-contact-v1', 'contact', 'Coordonnées générales du CHRSM — site Meuse',
  'Coordonnées générales du CHRSM — site Meuse. Le CHRSM — site Meuse se trouve Avenue Albert Ier 185, 5000 Namur. Le numéro général et numéro unique des consultations est le 081 72 61 11. Toujours confirmer qu’il s’agit bien du site Meuse à Namur, car le CHRSM comprend plusieurs sites.', 'Le CHRSM — site Meuse se trouve Avenue Albert Ier 185, 5000 Namur. Le numéro général et numéro unique des consultations est le 081 72 61 11. Toujours confirmer qu’il s’agit bien du site Meuse à Namur, car le CHRSM comprend plusieurs sites.', 'Le CHRSM — site Meuse se trouve Avenue Albert Ier 185, 5000 Namur. Le numéro général et numéro unique des consultations est le 081 72 61 11. Toujours confirmer qu’il s’agit bien du site Meuse à Namur, car le CHRSM comprend plusieurs sites.',
  'CHRSM Meuse Namur hospital address general phone number contact site confirmation', '{"dynamic":false,"source_label":"CHRSM — Consultations à Namur"}'::jsonb,
  '2026-10-28T00:00:00Z', true
from source_row
on conflict (chunk_key) do update set
  source_id = excluded.source_id,
  category = excluded.category,
  title_fr = excluded.title_fr,
  retrieval_text_fr = excluded.retrieval_text_fr,
  answer_fr = excluded.answer_fr,
  facts_fr = excluded.facts_fr,
  embedding = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedding
  end,
  embedded_at = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedded_at
  end,
  embedding_input_en = excluded.embedding_input_en,
  metadata = excluded.metadata,
  verified_at = excluded.verified_at,
  active = true;

-- emergency-triage
with source_row as (
  insert into chrsm_demo.knowledge_sources (
    source_key, title, source_url, authority, language_code,
    retrieved_at, verified_at, next_review_at, active, notes
  ) values (
    'emergency-triage', 'SPF Santé publique — Centrale d’urgence 112', 'https://www.health.belgium.be/fr/themes/sante/aide-medicale-urgente/acteurs-laide-medicale-urgente/centrale-durgence-112',
    'belgian_government', 'fr', '2026-10-28T00:00:00Z',
    '2026-10-28T00:00:00Z', '2027-10-28T00:00:00Z', true,
    'Information stable, revalidation annuelle.'
  )
  on conflict (source_key) do update set
    title = excluded.title,
    source_url = excluded.source_url,
    authority = excluded.authority,
    language_code = excluded.language_code,
    retrieved_at = excluded.retrieved_at,
    verified_at = excluded.verified_at,
    next_review_at = excluded.next_review_at,
    active = true,
    notes = excluded.notes
  returning id
)
insert into chrsm_demo.knowledge_chunks as existing (
  source_id, chunk_key, category, title_fr, retrieval_text_fr, answer_fr,
  facts_fr, embedding_input_en, metadata, verified_at, active
)
select
  source_row.id, 'emergency-triage-v1', 'urgence', 'Urgence vitale, médecin de garde et urgences CHRSM',
  'Urgence vitale, médecin de garde et urgences CHRSM. En cas de danger vital ou d’urgence médicale immédiate, appeler le 112 sans attendre. Pour un problème médical non vital qui ne peut pas attendre le retour du médecin habituel, le soir, la nuit, le week-end ou un jour férié, appeler le 1733. Le secrétariat des Urgences du CHRSM — site Meuse est joignable au 081 72 67 00 et suit la route 33. Le voicebot ne réalise aucun diagnostic et ne retarde jamais l’appel au 112.', 'En cas de danger vital ou d’urgence médicale immédiate, appeler le 112 sans attendre. Pour un problème médical non vital qui ne peut pas attendre le retour du médecin habituel, le soir, la nuit, le week-end ou un jour férié, appeler le 1733. Le secrétariat des Urgences du CHRSM — site Meuse est joignable au 081 72 67 00 et suit la route 33. Le voicebot ne réalise aucun diagnostic et ne retarde jamais l’appel au 112.', 'En cas de danger vital ou d’urgence médicale immédiate, appeler le 112 sans attendre. Pour un problème médical non vital qui ne peut pas attendre le retour du médecin habituel, le soir, la nuit, le week-end ou un jour férié, appeler le 1733. Le secrétariat des Urgences du CHRSM — site Meuse est joignable au 081 72 67 00 et suit la route 33. Le voicebot ne réalise aucun diagnostic et ne retarde jamais l’appel au 112.',
  'life threatening emergency call 112 non life threatening out of hours doctor 1733 CHRSM emergency department phone route 33 no diagnosis', '{"dynamic":false,"source_label":"SPF Santé publique — Centrale d’urgence 112","secondary_source_url":"https://www.health.belgium.be/fr/themes/sante/aide-medicale-urgente/acteurs-laide-medicale-urgente/besoin-dun-medecin-garde-composez-1733"}'::jsonb,
  '2026-10-28T00:00:00Z', true
from source_row
on conflict (chunk_key) do update set
  source_id = excluded.source_id,
  category = excluded.category,
  title_fr = excluded.title_fr,
  retrieval_text_fr = excluded.retrieval_text_fr,
  answer_fr = excluded.answer_fr,
  facts_fr = excluded.facts_fr,
  embedding = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedding
  end,
  embedded_at = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedded_at
  end,
  embedding_input_en = excluded.embedding_input_en,
  metadata = excluded.metadata,
  verified_at = excluded.verified_at,
  active = true;

-- access-opening-hours
with source_row as (
  insert into chrsm_demo.knowledge_sources (
    source_key, title, source_url, authority, language_code,
    retrieved_at, verified_at, next_review_at, active, notes
  ) values (
    'access-opening-hours', 'CHRSM — Accès', 'https://meuse.chrsm.be/node/80',
    'chrsm', 'fr', '2026-10-28T00:00:00Z',
    '2026-10-28T00:00:00Z', '2027-01-28T00:00:00Z', true,
    'Information dynamique à revalider.'
  )
  on conflict (source_key) do update set
    title = excluded.title,
    source_url = excluded.source_url,
    authority = excluded.authority,
    language_code = excluded.language_code,
    retrieved_at = excluded.retrieved_at,
    verified_at = excluded.verified_at,
    next_review_at = excluded.next_review_at,
    active = true,
    notes = excluded.notes
  returning id
)
insert into chrsm_demo.knowledge_chunks as existing (
  source_id, chunk_key, category, title_fr, retrieval_text_fr, answer_fr,
  facts_fr, embedding_input_en, metadata, verified_at, active
)
select
  source_row.id, 'access-opening-hours-v1', 'acces', 'Accès au site Meuse et heures d’ouverture des portes',
  'Accès au site Meuse et heures d’ouverture des portes. L’adresse est Avenue Albert Ier 185, 5000 Namur. En voiture par l’E411, prendre la sortie 14 Namur-Centre puis suivre les indications CHR. Les portes principales sont ouvertes de 7 h à 20 h 30. Entre 20 h 30 et 7 h, l’entrée se fait par les Urgences.', 'L’adresse est Avenue Albert Ier 185, 5000 Namur. En voiture par l’E411, prendre la sortie 14 Namur-Centre puis suivre les indications CHR. Les portes principales sont ouvertes de 7 h à 20 h 30. Entre 20 h 30 et 7 h, l’entrée se fait par les Urgences.', 'L’adresse est Avenue Albert Ier 185, 5000 Namur. En voiture par l’E411, prendre la sortie 14 Namur-Centre puis suivre les indications CHR. Les portes principales sont ouvertes de 7 h à 20 h 30. Entre 20 h 30 et 7 h, l’entrée se fait par les Urgences.',
  'how to reach CHRSM Meuse by car E411 exit 14 main doors opening hours night entrance through emergency department', '{"dynamic":true,"source_label":"CHRSM — Accès"}'::jsonb,
  '2026-10-28T00:00:00Z', true
from source_row
on conflict (chunk_key) do update set
  source_id = excluded.source_id,
  category = excluded.category,
  title_fr = excluded.title_fr,
  retrieval_text_fr = excluded.retrieval_text_fr,
  answer_fr = excluded.answer_fr,
  facts_fr = excluded.facts_fr,
  embedding = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedding
  end,
  embedded_at = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedded_at
  end,
  embedding_input_en = excluded.embedding_input_en,
  metadata = excluded.metadata,
  verified_at = excluded.verified_at,
  active = true;

-- parking-public-transport
with source_row as (
  insert into chrsm_demo.knowledge_sources (
    source_key, title, source_url, authority, language_code,
    retrieved_at, verified_at, next_review_at, active, notes
  ) values (
    'parking-public-transport', 'CHRSM — Brochure d’accueil 2025-2026', 'https://meuse.chrsm.be/sites/default/files/portail-content/brochure-accueil-meuse-2025-26_1.pdf',
    'chrsm', 'fr', '2026-10-28T00:00:00Z',
    '2026-10-28T00:00:00Z', '2027-01-28T00:00:00Z', true,
    'Information dynamique à revalider.'
  )
  on conflict (source_key) do update set
    title = excluded.title,
    source_url = excluded.source_url,
    authority = excluded.authority,
    language_code = excluded.language_code,
    retrieved_at = excluded.retrieved_at,
    verified_at = excluded.verified_at,
    next_review_at = excluded.next_review_at,
    active = true,
    notes = excluded.notes
  returning id
)
insert into chrsm_demo.knowledge_chunks as existing (
  source_id, chunk_key, category, title_fr, retrieval_text_fr, answer_fr,
  facts_fr, embedding_input_en, metadata, verified_at, active
)
select
  source_row.id, 'parking-public-transport-v1', 'acces', 'Parkings et transports en commun',
  'Parkings et transports en commun. Les parkings P1 et P2 sont accessibles 24 h sur 24. P1 se trouve devant l’hôpital et P2 à l’arrière via le rond-point de l’Avenue Albert Ier. Un dépose-minute de 15 minutes est prévu devant l’accueil central. Depuis la gare de Namur, les lignes de bus indiquées dans la brochure d’accueil sont 5, 17, 40 et E84. Les lignes et tarifs peuvent changer : le voicebot invite à vérifier l’information actuelle avant le départ.', 'Les parkings P1 et P2 sont accessibles 24 h sur 24. P1 se trouve devant l’hôpital et P2 à l’arrière via le rond-point de l’Avenue Albert Ier. Un dépose-minute de 15 minutes est prévu devant l’accueil central. Depuis la gare de Namur, les lignes de bus indiquées dans la brochure d’accueil sont 5, 17, 40 et E84. Les lignes et tarifs peuvent changer : le voicebot invite à vérifier l’information actuelle avant le départ.', 'Les parkings P1 et P2 sont accessibles 24 h sur 24. P1 se trouve devant l’hôpital et P2 à l’arrière via le rond-point de l’Avenue Albert Ier. Un dépose-minute de 15 minutes est prévu devant l’accueil central. Depuis la gare de Namur, les lignes de bus indiquées dans la brochure d’accueil sont 5, 17, 40 et E84. Les lignes et tarifs peuvent changer : le voicebot invite à vérifier l’information actuelle avant le départ.',
  'CHRSM Meuse parking P1 P2 drop off fifteen minutes buses from Namur train station public transport access', '{"dynamic":true,"source_label":"CHRSM — Brochure d’accueil 2025-2026"}'::jsonb,
  '2026-10-28T00:00:00Z', true
from source_row
on conflict (chunk_key) do update set
  source_id = excluded.source_id,
  category = excluded.category,
  title_fr = excluded.title_fr,
  retrieval_text_fr = excluded.retrieval_text_fr,
  answer_fr = excluded.answer_fr,
  facts_fr = excluded.facts_fr,
  embedding = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedding
  end,
  embedded_at = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedded_at
  end,
  embedding_input_en = excluded.embedding_input_en,
  metadata = excluded.metadata,
  verified_at = excluded.verified_at,
  active = true;

-- visiting-hours
with source_row as (
  insert into chrsm_demo.knowledge_sources (
    source_key, title, source_url, authority, language_code,
    retrieved_at, verified_at, next_review_at, active, notes
  ) values (
    'visiting-hours', 'CHRSM — En pratique, heures de visite', 'https://meuse.chrsm.be/en-pratique/urgences',
    'chrsm', 'fr', '2026-10-28T00:00:00Z',
    '2026-10-28T00:00:00Z', '2027-01-28T00:00:00Z', true,
    'Information dynamique à revalider.'
  )
  on conflict (source_key) do update set
    title = excluded.title,
    source_url = excluded.source_url,
    authority = excluded.authority,
    language_code = excluded.language_code,
    retrieved_at = excluded.retrieved_at,
    verified_at = excluded.verified_at,
    next_review_at = excluded.next_review_at,
    active = true,
    notes = excluded.notes
  returning id
)
insert into chrsm_demo.knowledge_chunks as existing (
  source_id, chunk_key, category, title_fr, retrieval_text_fr, answer_fr,
  facts_fr, embedding_input_en, metadata, verified_at, active
)
select
  source_row.id, 'visiting-hours-v1', 'visites', 'Heures de visite par service',
  'Heures de visite par service. Les horaires généraux publiés sont : hospitalisation et gériatrie de 14 h à 20 h ; maternité, MIC et Kangourou de 16 h à 19 h ; psychiatrie de 16 h 30 à 19 h 30 ; soins intensifs de 14 h 30 à 16 h 30 puis de 17 h 30 à 19 h 30, sur rendez-vous ; unité de crise de 16 h 30 à 19 h 30 en semaine et de 14 h à 19 h 30 le week-end. En pédiatrie, les parents sont admis 24 h sur 24, avec une seule personne la nuit. Ces horaires peuvent être adaptés, notamment selon la situation sanitaire : recommander une confirmation auprès du service.', 'Les horaires généraux publiés sont : hospitalisation et gériatrie de 14 h à 20 h ; maternité, MIC et Kangourou de 16 h à 19 h ; psychiatrie de 16 h 30 à 19 h 30 ; soins intensifs de 14 h 30 à 16 h 30 puis de 17 h 30 à 19 h 30, sur rendez-vous ; unité de crise de 16 h 30 à 19 h 30 en semaine et de 14 h à 19 h 30 le week-end. En pédiatrie, les parents sont admis 24 h sur 24, avec une seule personne la nuit. Ces horaires peuvent être adaptés, notamment selon la situation sanitaire : recommander une confirmation auprès du service.', 'Les horaires généraux publiés sont : hospitalisation et gériatrie de 14 h à 20 h ; maternité, MIC et Kangourou de 16 h à 19 h ; psychiatrie de 16 h 30 à 19 h 30 ; soins intensifs de 14 h 30 à 16 h 30 puis de 17 h 30 à 19 h 30, sur rendez-vous ; unité de crise de 16 h 30 à 19 h 30 en semaine et de 14 h à 19 h 30 le week-end. En pédiatrie, les parents sont admis 24 h sur 24, avec une seule personne la nuit. Ces horaires peuvent être adaptés, notamment selon la situation sanitaire : recommander une confirmation auprès du service.',
  'CHRSM Meuse visiting hours hospital maternity psychiatry intensive care crisis unit geriatrics pediatrics visitors schedule', '{"dynamic":true,"source_label":"CHRSM — En pratique, heures de visite"}'::jsonb,
  '2026-10-28T00:00:00Z', true
from source_row
on conflict (chunk_key) do update set
  source_id = excluded.source_id,
  category = excluded.category,
  title_fr = excluded.title_fr,
  retrieval_text_fr = excluded.retrieval_text_fr,
  answer_fr = excluded.answer_fr,
  facts_fr = excluded.facts_fr,
  embedding = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedding
  end,
  embedded_at = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedded_at
  end,
  embedding_input_en = excluded.embedding_input_en,
  metadata = excluded.metadata,
  verified_at = excluded.verified_at,
  active = true;

-- appointments-demo-policy
with source_row as (
  insert into chrsm_demo.knowledge_sources (
    source_key, title, source_url, authority, language_code,
    retrieved_at, verified_at, next_review_at, active, notes
  ) values (
    'appointments-demo-policy', 'CHRSM — Rendez-vous en ligne pour Namur', 'https://meuse.chrsm.be/rendez-vous-en-ligne-pour-namur',
    'chrsm', 'fr', '2026-10-28T00:00:00Z',
    '2026-10-28T00:00:00Z', '2027-01-28T00:00:00Z', true,
    'Information dynamique à revalider.'
  )
  on conflict (source_key) do update set
    title = excluded.title,
    source_url = excluded.source_url,
    authority = excluded.authority,
    language_code = excluded.language_code,
    retrieved_at = excluded.retrieved_at,
    verified_at = excluded.verified_at,
    next_review_at = excluded.next_review_at,
    active = true,
    notes = excluded.notes
  returning id
)
insert into chrsm_demo.knowledge_chunks as existing (
  source_id, chunk_key, category, title_fr, retrieval_text_fr, answer_fr,
  facts_fr, embedding_input_en, metadata, verified_at, active
)
select
  source_row.id, 'appointments-demo-policy-v1', 'rendez_vous', 'Demander, modifier ou annuler un rendez-vous',
  'Demander, modifier ou annuler un rendez-vous. Le CHRSM permet de demander, modifier ou annuler un rendez-vous via sa page officielle ou par téléphone au 081 72 61 11. Dans cette démonstration, le voicebot ne réserve, ne modifie et n’annule aucun rendez-vous. Il explique que cette fonction sera disponible dans la version complète après déploiement, puis peut recueillir une demande de rappel avec consentement explicite, sans promettre de créneau ni de délai.', 'Le CHRSM permet de demander, modifier ou annuler un rendez-vous via sa page officielle ou par téléphone au 081 72 61 11. Dans cette démonstration, le voicebot ne réserve, ne modifie et n’annule aucun rendez-vous. Il explique que cette fonction sera disponible dans la version complète après déploiement, puis peut recueillir une demande de rappel avec consentement explicite, sans promettre de créneau ni de délai.', 'Le CHRSM permet de demander, modifier ou annuler un rendez-vous via sa page officielle ou par téléphone au 081 72 61 11. Dans cette démonstration, le voicebot ne réserve, ne modifie et n’annule aucun rendez-vous. Il explique que cette fonction sera disponible dans la version complète après déploiement, puis peut recueillir une demande de rappel avec consentement explicite, sans promettre de créneau ni de délai.',
  'book change cancel hospital appointment demo cannot schedule future full version callback request no promise', '{"dynamic":true,"source_label":"CHRSM — Rendez-vous en ligne pour Namur"}'::jsonb,
  '2026-10-28T00:00:00Z', true
from source_row
on conflict (chunk_key) do update set
  source_id = excluded.source_id,
  category = excluded.category,
  title_fr = excluded.title_fr,
  retrieval_text_fr = excluded.retrieval_text_fr,
  answer_fr = excluded.answer_fr,
  facts_fr = excluded.facts_fr,
  embedding = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedding
  end,
  embedded_at = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedded_at
  end,
  embedding_input_en = excluded.embedding_input_en,
  metadata = excluded.metadata,
  verified_at = excluded.verified_at,
  active = true;

-- appointment-reminder-cancellation
with source_row as (
  insert into chrsm_demo.knowledge_sources (
    source_key, title, source_url, authority, language_code,
    retrieved_at, verified_at, next_review_at, active, notes
  ) values (
    'appointment-reminder-cancellation', 'CHRSM — Consultations à Namur', 'https://meuse.chrsm.be/consultations-%C3%A0-namur',
    'chrsm', 'fr', '2026-10-28T00:00:00Z',
    '2026-10-28T00:00:00Z', '2027-01-28T00:00:00Z', true,
    'Information dynamique à revalider.'
  )
  on conflict (source_key) do update set
    title = excluded.title,
    source_url = excluded.source_url,
    authority = excluded.authority,
    language_code = excluded.language_code,
    retrieved_at = excluded.retrieved_at,
    verified_at = excluded.verified_at,
    next_review_at = excluded.next_review_at,
    active = true,
    notes = excluded.notes
  returning id
)
insert into chrsm_demo.knowledge_chunks as existing (
  source_id, chunk_key, category, title_fr, retrieval_text_fr, answer_fr,
  facts_fr, embedding_input_en, metadata, verified_at, active
)
select
  source_row.id, 'appointment-reminder-cancellation-v1', 'rendez_vous', 'Rappel SMS et annulation d’un rendez-vous',
  'Rappel SMS et annulation d’un rendez-vous. Lorsqu’un numéro de GSM est communiqué, le CHRSM annonce un SMS de rappel 72 heures avant le rendez-vous. Une annulation doit être signalée au minimum 48 heures à l’avance ; sinon une indemnité de 15 euros peut être facturée. Ces règles sont celles publiées par le CHRSM et doivent être présentées comme susceptibles d’évoluer.', 'Lorsqu’un numéro de GSM est communiqué, le CHRSM annonce un SMS de rappel 72 heures avant le rendez-vous. Une annulation doit être signalée au minimum 48 heures à l’avance ; sinon une indemnité de 15 euros peut être facturée. Ces règles sont celles publiées par le CHRSM et doivent être présentées comme susceptibles d’évoluer.', 'Lorsqu’un numéro de GSM est communiqué, le CHRSM annonce un SMS de rappel 72 heures avant le rendez-vous. Une annulation doit être signalée au minimum 48 heures à l’avance ; sinon une indemnité de 15 euros peut être facturée. Ces règles sont celles publiées par le CHRSM et doivent être présentées comme susceptibles d’évoluer.',
  'appointment SMS reminder 72 hours cancel at least 48 hours fifteen euro fee CHRSM', '{"dynamic":true,"source_label":"CHRSM — Consultations à Namur"}'::jsonb,
  '2026-10-28T00:00:00Z', true
from source_row
on conflict (chunk_key) do update set
  source_id = excluded.source_id,
  category = excluded.category,
  title_fr = excluded.title_fr,
  retrieval_text_fr = excluded.retrieval_text_fr,
  answer_fr = excluded.answer_fr,
  facts_fr = excluded.facts_fr,
  embedding = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedding
  end,
  embedded_at = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedded_at
  end,
  embedding_input_en = excluded.embedding_input_en,
  metadata = excluded.metadata,
  verified_at = excluded.verified_at,
  active = true;

-- identity-documents
with source_row as (
  insert into chrsm_demo.knowledge_sources (
    source_key, title, source_url, authority, language_code,
    retrieved_at, verified_at, next_review_at, active, notes
  ) values (
    'identity-documents', 'CHRSM — Carte d’identité à l’hôpital', 'https://meuse.chrsm.be/a-la-une/votre-carte-d%E2%80%99identit%C3%A9-un-r%C3%A9flexe-essentiel-%C3%A0-l%E2%80%99h%C3%B4pital-1',
    'chrsm', 'fr', '2026-10-28T00:00:00Z',
    '2026-10-28T00:00:00Z', '2027-10-28T00:00:00Z', true,
    'Information stable, revalidation annuelle.'
  )
  on conflict (source_key) do update set
    title = excluded.title,
    source_url = excluded.source_url,
    authority = excluded.authority,
    language_code = excluded.language_code,
    retrieved_at = excluded.retrieved_at,
    verified_at = excluded.verified_at,
    next_review_at = excluded.next_review_at,
    active = true,
    notes = excluded.notes
  returning id
)
insert into chrsm_demo.knowledge_chunks as existing (
  source_id, chunk_key, category, title_fr, retrieval_text_fr, answer_fr,
  facts_fr, embedding_input_en, metadata, verified_at, active
)
select
  source_row.id, 'identity-documents-v1', 'documents', 'Documents à emporter',
  'Documents à emporter. Le CHRSM demande de présenter la carte d’identité électronique à l’accueil, également pour un enfant, afin de vérifier l’identité et d’appliquer correctement le tiers payant. Selon la consultation, prévoir aussi la prescription, la liste des médicaments et les documents demandés par le service. Le voicebot ne demande jamais le numéro de registre national.', 'Le CHRSM demande de présenter la carte d’identité électronique à l’accueil, également pour un enfant, afin de vérifier l’identité et d’appliquer correctement le tiers payant. Selon la consultation, prévoir aussi la prescription, la liste des médicaments et les documents demandés par le service. Le voicebot ne demande jamais le numéro de registre national.', 'Le CHRSM demande de présenter la carte d’identité électronique à l’accueil, également pour un enfant, afin de vérifier l’identité et d’appliquer correctement le tiers payant. Selon la consultation, prévoir aussi la prescription, la liste des médicaments et les documents demandés par le service. Le voicebot ne demande jamais le numéro de registre national.',
  'what documents to bring hospital electronic identity card child third party payment prescription medication list no national register number', '{"dynamic":false,"source_label":"CHRSM — Carte d’identité à l’hôpital"}'::jsonb,
  '2026-10-28T00:00:00Z', true
from source_row
on conflict (chunk_key) do update set
  source_id = excluded.source_id,
  category = excluded.category,
  title_fr = excluded.title_fr,
  retrieval_text_fr = excluded.retrieval_text_fr,
  answer_fr = excluded.answer_fr,
  facts_fr = excluded.facts_fr,
  embedding = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedding
  end,
  embedded_at = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedded_at
  end,
  embedding_input_en = excluded.embedding_input_en,
  metadata = excluded.metadata,
  verified_at = excluded.verified_at,
  active = true;

-- wayfinding
with source_row as (
  insert into chrsm_demo.knowledge_sources (
    source_key, title, source_url, authority, language_code,
    retrieved_at, verified_at, next_review_at, active, notes
  ) values (
    'wayfinding', 'CHRSM — En pratique, signalétique', 'https://meuse.chrsm.be/en-pratique/urgences',
    'chrsm', 'fr', '2026-10-28T00:00:00Z',
    '2026-10-28T00:00:00Z', '2027-10-28T00:00:00Z', true,
    'Information stable, revalidation annuelle.'
  )
  on conflict (source_key) do update set
    title = excluded.title,
    source_url = excluded.source_url,
    authority = excluded.authority,
    language_code = excluded.language_code,
    retrieved_at = excluded.retrieved_at,
    verified_at = excluded.verified_at,
    next_review_at = excluded.next_review_at,
    active = true,
    notes = excluded.notes
  returning id
)
insert into chrsm_demo.knowledge_chunks as existing (
  source_id, chunk_key, category, title_fr, retrieval_text_fr, answer_fr,
  facts_fr, embedding_input_en, metadata, verified_at, active
)
select
  source_row.id, 'wayfinding-v1', 'orientation', 'Signalétique et routes dans l’hôpital',
  'Signalétique et routes dans l’hôpital. La signalétique du site Meuse fonctionne avec des numéros de route, comme dans un aéroport. Après l’inscription, l’accueil indique une route à suivre plutôt qu’un bâtiment ou un étage. Les panneaux sont multilingues. Le voicebot peut expliquer le principe et orienter vers l’accueil, mais ne doit pas inventer un numéro de route absent de ses sources.', 'La signalétique du site Meuse fonctionne avec des numéros de route, comme dans un aéroport. Après l’inscription, l’accueil indique une route à suivre plutôt qu’un bâtiment ou un étage. Les panneaux sont multilingues. Le voicebot peut expliquer le principe et orienter vers l’accueil, mais ne doit pas inventer un numéro de route absent de ses sources.', 'La signalétique du site Meuse fonctionne avec des numéros de route, comme dans un aéroport. Après l’inscription, l’accueil indique une route à suivre plutôt qu’un bâtiment ou un étage. Les panneaux sont multilingues. Le voicebot peut expliquer le principe et orienter vers l’accueil, mais ne doit pas inventer un numéro de route absent de ses sources.',
  'hospital wayfinding route numbers airport style multilingual signs reception directions do not invent route', '{"dynamic":false,"source_label":"CHRSM — En pratique, signalétique"}'::jsonb,
  '2026-10-28T00:00:00Z', true
from source_row
on conflict (chunk_key) do update set
  source_id = excluded.source_id,
  category = excluded.category,
  title_fr = excluded.title_fr,
  retrieval_text_fr = excluded.retrieval_text_fr,
  answer_fr = excluded.answer_fr,
  facts_fr = excluded.facts_fr,
  embedding = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedding
  end,
  embedded_at = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedded_at
  end,
  embedding_input_en = excluded.embedding_input_en,
  metadata = excluded.metadata,
  verified_at = excluded.verified_at,
  active = true;

-- intercultural-mediation
with source_row as (
  insert into chrsm_demo.knowledge_sources (
    source_key, title, source_url, authority, language_code,
    retrieved_at, verified_at, next_review_at, active, notes
  ) values (
    'intercultural-mediation', 'CHRSM — Médiation interculturelle', 'https://meuse.chrsm.be/a-la-une/m%C3%A9diation-interculturelle-un-accompagnement-linguistique-et-culturel-au-service-de-tous-0',
    'chrsm', 'fr', '2026-10-28T00:00:00Z',
    '2026-10-28T00:00:00Z', '2027-01-28T00:00:00Z', true,
    'Information dynamique à revalider.'
  )
  on conflict (source_key) do update set
    title = excluded.title,
    source_url = excluded.source_url,
    authority = excluded.authority,
    language_code = excluded.language_code,
    retrieved_at = excluded.retrieved_at,
    verified_at = excluded.verified_at,
    next_review_at = excluded.next_review_at,
    active = true,
    notes = excluded.notes
  returning id
)
insert into chrsm_demo.knowledge_chunks as existing (
  source_id, chunk_key, category, title_fr, retrieval_text_fr, answer_fr,
  facts_fr, embedding_input_en, metadata, verified_at, active
)
select
  source_row.id, 'intercultural-mediation-v1', 'accessibilite', 'Médiation interculturelle',
  'Médiation interculturelle. Le service gratuit de médiation interculturelle aide à mieux comprendre et être compris pendant la prise en charge. À Namur, il est joignable au 081 72 61 08 ou à mediation.interculturelle@chrsm.be, du lundi au vendredi de 8 h à 16 h. Plusieurs langues sont disponibles en présentiel et d’autres par visioconférence.', 'Le service gratuit de médiation interculturelle aide à mieux comprendre et être compris pendant la prise en charge. À Namur, il est joignable au 081 72 61 08 ou à mediation.interculturelle@chrsm.be, du lundi au vendredi de 8 h à 16 h. Plusieurs langues sont disponibles en présentiel et d’autres par visioconférence.', 'Le service gratuit de médiation interculturelle aide à mieux comprendre et être compris pendant la prise en charge. À Namur, il est joignable au 081 72 61 08 ou à mediation.interculturelle@chrsm.be, du lundi au vendredi de 8 h à 16 h. Plusieurs langues sont disponibles en présentiel et d’autres par visioconférence.',
  'free intercultural mediation interpreter languages CHRSM Namur phone email opening hours communication support', '{"dynamic":true,"source_label":"CHRSM — Médiation interculturelle"}'::jsonb,
  '2026-10-28T00:00:00Z', true
from source_row
on conflict (chunk_key) do update set
  source_id = excluded.source_id,
  category = excluded.category,
  title_fr = excluded.title_fr,
  retrieval_text_fr = excluded.retrieval_text_fr,
  answer_fr = excluded.answer_fr,
  facts_fr = excluded.facts_fr,
  embedding = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedding
  end,
  embedded_at = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedded_at
  end,
  embedding_input_en = excluded.embedding_input_en,
  metadata = excluded.metadata,
  verified_at = excluded.verified_at,
  active = true;

-- laboratory
with source_row as (
  insert into chrsm_demo.knowledge_sources (
    source_key, title, source_url, authority, language_code,
    retrieved_at, verified_at, next_review_at, active, notes
  ) values (
    'laboratory', 'CHRSM — Biologie clinique', 'https://meuse.chrsm.be/services/biologie-clinique-laboratoire',
    'chrsm', 'fr', '2026-10-28T00:00:00Z',
    '2026-10-28T00:00:00Z', '2027-01-28T00:00:00Z', true,
    'Information dynamique à revalider.'
  )
  on conflict (source_key) do update set
    title = excluded.title,
    source_url = excluded.source_url,
    authority = excluded.authority,
    language_code = excluded.language_code,
    retrieved_at = excluded.retrieved_at,
    verified_at = excluded.verified_at,
    next_review_at = excluded.next_review_at,
    active = true,
    notes = excluded.notes
  returning id
)
insert into chrsm_demo.knowledge_chunks as existing (
  source_id, chunk_key, category, title_fr, retrieval_text_fr, answer_fr,
  facts_fr, embedding_input_en, metadata, verified_at, active
)
select
  source_row.id, 'laboratory-v1', 'services', 'Laboratoire et prises de sang',
  'Laboratoire et prises de sang. Le laboratoire est joignable au 081 72 69 89 et se trouve route 21. Les prises de sang sont réalisées sans rendez-vous, sauf tests hémodynamiques, du lundi au vendredi de 7 h à 18 h 30 et le samedi de 9 h à 11 h 30. Pour les enfants et les tests particuliers, des modalités spécifiques s’appliquent : le voicebot renvoie vers le service pour confirmation.', 'Le laboratoire est joignable au 081 72 69 89 et se trouve route 21. Les prises de sang sont réalisées sans rendez-vous, sauf tests hémodynamiques, du lundi au vendredi de 7 h à 18 h 30 et le samedi de 9 h à 11 h 30. Pour les enfants et les tests particuliers, des modalités spécifiques s’appliquent : le voicebot renvoie vers le service pour confirmation.', 'Le laboratoire est joignable au 081 72 69 89 et se trouve route 21. Les prises de sang sont réalisées sans rendez-vous, sauf tests hémodynamiques, du lundi au vendredi de 7 h à 18 h 30 et le samedi de 9 h à 11 h 30. Pour les enfants et les tests particuliers, des modalités spécifiques s’appliquent : le voicebot renvoie vers le service pour confirmation.',
  'CHRSM laboratory blood draw opening hours no appointment route 21 phone children dynamic tests', '{"dynamic":true,"source_label":"CHRSM — Biologie clinique"}'::jsonb,
  '2026-10-28T00:00:00Z', true
from source_row
on conflict (chunk_key) do update set
  source_id = excluded.source_id,
  category = excluded.category,
  title_fr = excluded.title_fr,
  retrieval_text_fr = excluded.retrieval_text_fr,
  answer_fr = excluded.answer_fr,
  facts_fr = excluded.facts_fr,
  embedding = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedding
  end,
  embedded_at = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedded_at
  end,
  embedding_input_en = excluded.embedding_input_en,
  metadata = excluded.metadata,
  verified_at = excluded.verified_at,
  active = true;

-- service-phones
with source_row as (
  insert into chrsm_demo.knowledge_sources (
    source_key, title, source_url, authority, language_code,
    retrieved_at, verified_at, next_review_at, active, notes
  ) values (
    'service-phones', 'CHRSM — Prise de rendez-vous téléphonique', 'https://meuse.chrsm.be/prise-de-rendez-vous-t%C3%A9l%C3%A9phonique',
    'chrsm', 'fr', '2026-10-28T00:00:00Z',
    '2026-10-28T00:00:00Z', '2027-01-28T00:00:00Z', true,
    'Information dynamique à revalider.'
  )
  on conflict (source_key) do update set
    title = excluded.title,
    source_url = excluded.source_url,
    authority = excluded.authority,
    language_code = excluded.language_code,
    retrieved_at = excluded.retrieved_at,
    verified_at = excluded.verified_at,
    next_review_at = excluded.next_review_at,
    active = true,
    notes = excluded.notes
  returning id
)
insert into chrsm_demo.knowledge_chunks as existing (
  source_id, chunk_key, category, title_fr, retrieval_text_fr, answer_fr,
  facts_fr, embedding_input_en, metadata, verified_at, active
)
select
  source_row.id, 'service-phones-v1', 'services', 'Principaux numéros de secrétariat',
  'Principaux numéros de secrétariat. Numéros publiés : cardiologie, pneumologie, médecine du voyage et allergologie adulte 081 72 69 05 ; gynécologie-obstétrique 081 72 71 50 ; pédiatrie 081 72 71 40 ; radiologie 081 72 60 50 ; laboratoire 081 72 69 89 ; unité multidisciplinaire de cancérologie 081 72 60 30 ; psychiatrie 081 72 66 60. Si le service demandé n’est pas certain, donner le numéro unique 081 72 61 11 plutôt que d’inventer.', 'Numéros publiés : cardiologie, pneumologie, médecine du voyage et allergologie adulte 081 72 69 05 ; gynécologie-obstétrique 081 72 71 50 ; pédiatrie 081 72 71 40 ; radiologie 081 72 60 50 ; laboratoire 081 72 69 89 ; unité multidisciplinaire de cancérologie 081 72 60 30 ; psychiatrie 081 72 66 60. Si le service demandé n’est pas certain, donner le numéro unique 081 72 61 11 plutôt que d’inventer.', 'Numéros publiés : cardiologie, pneumologie, médecine du voyage et allergologie adulte 081 72 69 05 ; gynécologie-obstétrique 081 72 71 50 ; pédiatrie 081 72 71 40 ; radiologie 081 72 60 50 ; laboratoire 081 72 69 89 ; unité multidisciplinaire de cancérologie 081 72 60 30 ; psychiatrie 081 72 66 60. Si le service demandé n’est pas certain, donner le numéro unique 081 72 61 11 plutôt que d’inventer.',
  'hospital department secretariat phone cardiology pulmonology obstetrics pediatrics radiology laboratory oncology psychiatry general number', '{"dynamic":true,"source_label":"CHRSM — Prise de rendez-vous téléphonique"}'::jsonb,
  '2026-10-28T00:00:00Z', true
from source_row
on conflict (chunk_key) do update set
  source_id = excluded.source_id,
  category = excluded.category,
  title_fr = excluded.title_fr,
  retrieval_text_fr = excluded.retrieval_text_fr,
  answer_fr = excluded.answer_fr,
  facts_fr = excluded.facts_fr,
  embedding = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedding
  end,
  embedded_at = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedded_at
  end,
  embedding_input_en = excluded.embedding_input_en,
  metadata = excluded.metadata,
  verified_at = excluded.verified_at,
  active = true;

-- data-protection
with source_row as (
  insert into chrsm_demo.knowledge_sources (
    source_key, title, source_url, authority, language_code,
    retrieved_at, verified_at, next_review_at, active, notes
  ) values (
    'data-protection', 'CHRSM — Information aux patients sur les données personnelles', 'https://meuse.chrsm.be/patients-et-visiteurs',
    'chrsm', 'fr', '2026-10-28T00:00:00Z',
    '2026-10-28T00:00:00Z', '2027-10-28T00:00:00Z', true,
    'Information stable, revalidation annuelle.'
  )
  on conflict (source_key) do update set
    title = excluded.title,
    source_url = excluded.source_url,
    authority = excluded.authority,
    language_code = excluded.language_code,
    retrieved_at = excluded.retrieved_at,
    verified_at = excluded.verified_at,
    next_review_at = excluded.next_review_at,
    active = true,
    notes = excluded.notes
  returning id
)
insert into chrsm_demo.knowledge_chunks as existing (
  source_id, chunk_key, category, title_fr, retrieval_text_fr, answer_fr,
  facts_fr, embedding_input_en, metadata, verified_at, active
)
select
  source_row.id, 'data-protection-v1', 'confidentialite', 'Protection des données et limites de la démonstration',
  'Protection des données et limites de la démonstration. Le voicebot de démonstration est un outil d’information et d’orientation, pas un dossier médical. Il ne demande pas de diagnostic, de symptômes détaillés, de numéro de registre national, de date de naissance ni de données cliniques. Pour un rappel vocal, il limite la collecte au nom, au numéro de téléphone, au service recherché, à une préférence de rappel et au consentement. Il ne demande pas d’adresse e-mail. Le DPO du CHRSM est joignable à dpo@chrsm.be pour les questions officielles sur les traitements du CHRSM.', 'Le voicebot de démonstration est un outil d’information et d’orientation, pas un dossier médical. Il ne demande pas de diagnostic, de symptômes détaillés, de numéro de registre national, de date de naissance ni de données cliniques. Pour un rappel vocal, il limite la collecte au nom, au numéro de téléphone, au service recherché, à une préférence de rappel et au consentement. Il ne demande pas d’adresse e-mail. Le DPO du CHRSM est joignable à dpo@chrsm.be pour les questions officielles sur les traitements du CHRSM.', 'Le voicebot de démonstration est un outil d’information et d’orientation, pas un dossier médical. Il ne demande pas de diagnostic, de symptômes détaillés, de numéro de registre national, de date de naissance ni de données cliniques. Pour un rappel vocal, il limite la collecte au nom, au numéro de téléphone, au service recherché, à une préférence de rappel et au consentement. Il ne demande pas d’adresse e-mail. Le DPO du CHRSM est joignable à dpo@chrsm.be pour les questions officielles sur les traitements du CHRSM.',
  'privacy data minimization demo voicebot no medical diagnosis clinical data national ID date of birth callback consent CHRSM DPO', '{"dynamic":false,"source_label":"CHRSM — Information aux patients sur les données personnelles"}'::jsonb,
  '2026-10-28T00:00:00Z', true
from source_row
on conflict (chunk_key) do update set
  source_id = excluded.source_id,
  category = excluded.category,
  title_fr = excluded.title_fr,
  retrieval_text_fr = excluded.retrieval_text_fr,
  answer_fr = excluded.answer_fr,
  facts_fr = excluded.facts_fr,
  embedding = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedding
  end,
  embedded_at = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedded_at
  end,
  embedding_input_en = excluded.embedding_input_en,
  metadata = excluded.metadata,
  verified_at = excluded.verified_at,
  active = true;

-- results-not-interpreted
with source_row as (
  insert into chrsm_demo.knowledge_sources (
    source_key, title, source_url, authority, language_code,
    retrieved_at, verified_at, next_review_at, active, notes
  ) values (
    'results-not-interpreted', 'CHRSM — Résultats d’analyses sur le RSW', 'https://meuse.chrsm.be/a-la-une/r%C3%A9sultats-d%E2%80%99analyses-accessibles-sur-le-rsw',
    'chrsm', 'fr', '2026-10-28T00:00:00Z',
    '2026-10-28T00:00:00Z', '2027-01-28T00:00:00Z', true,
    'Information dynamique à revalider.'
  )
  on conflict (source_key) do update set
    title = excluded.title,
    source_url = excluded.source_url,
    authority = excluded.authority,
    language_code = excluded.language_code,
    retrieved_at = excluded.retrieved_at,
    verified_at = excluded.verified_at,
    next_review_at = excluded.next_review_at,
    active = true,
    notes = excluded.notes
  returning id
)
insert into chrsm_demo.knowledge_chunks as existing (
  source_id, chunk_key, category, title_fr, retrieval_text_fr, answer_fr,
  facts_fr, embedding_input_en, metadata, verified_at, active
)
select
  source_row.id, 'results-not-interpreted-v1', 'securite', 'Résultats médicaux et absence d’interprétation',
  'Résultats médicaux et absence d’interprétation. Le voicebot ne communique ni n’interprète aucun résultat médical. Les résultats d’analyses peuvent être consultés via le Réseau Santé Wallon selon les modalités publiées par le CHRSM. Toute interprétation relève du médecin ou de l’équipe soignante.', 'Le voicebot ne communique ni n’interprète aucun résultat médical. Les résultats d’analyses peuvent être consultés via le Réseau Santé Wallon selon les modalités publiées par le CHRSM. Toute interprétation relève du médecin ou de l’équipe soignante.', 'Le voicebot ne communique ni n’interprète aucun résultat médical. Les résultats d’analyses peuvent être consultés via le Réseau Santé Wallon selon les modalités publiées par le CHRSM. Toute interprétation relève du médecin ou de l’équipe soignante.',
  'medical test results access Walloon Health Network voicebot must not disclose or interpret clinical results doctor', '{"dynamic":true,"source_label":"CHRSM — Résultats d’analyses sur le RSW"}'::jsonb,
  '2026-10-28T00:00:00Z', true
from source_row
on conflict (chunk_key) do update set
  source_id = excluded.source_id,
  category = excluded.category,
  title_fr = excluded.title_fr,
  retrieval_text_fr = excluded.retrieval_text_fr,
  answer_fr = excluded.answer_fr,
  facts_fr = excluded.facts_fr,
  embedding = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedding
  end,
  embedded_at = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedded_at
  end,
  embedding_input_en = excluded.embedding_input_en,
  metadata = excluded.metadata,
  verified_at = excluded.verified_at,
  active = true;

-- address-resolution-policy
with source_row as (
  insert into chrsm_demo.knowledge_sources (
    source_key, title, source_url, authority, language_code,
    retrieved_at, verified_at, next_review_at, active, notes
  ) values (
    'address-resolution-policy', 'BOSA — BeSt Address Services', 'https://bosa.belgium.be/fr/services/best-address-services',
    'belgian_government', 'fr', '2026-10-28T00:00:00Z',
    '2026-10-28T00:00:00Z', '2027-10-28T00:00:00Z', true,
    'Information stable, revalidation annuelle.'
  )
  on conflict (source_key) do update set
    title = excluded.title,
    source_url = excluded.source_url,
    authority = excluded.authority,
    language_code = excluded.language_code,
    retrieved_at = excluded.retrieved_at,
    verified_at = excluded.verified_at,
    next_review_at = excluded.next_review_at,
    active = true,
    notes = excluded.notes
  returning id
)
insert into chrsm_demo.knowledge_chunks as existing (
  source_id, chunk_key, category, title_fr, retrieval_text_fr, answer_fr,
  facts_fr, embedding_input_en, metadata, verified_at, active
)
select
  source_row.id, 'address-resolution-policy-v1', 'adresse', 'Vérification d’une adresse belge avec BeSt',
  'Vérification d’une adresse belge avec BeSt. L’outil BeSt ne doit être appelé que si une adresse belge complète est réellement nécessaire à une orientation ou si la personne demande explicitement une vérification. Il n’est jamais utilisé pour une demande de rappel. Le résultat est toujours reformulé et confirmé par la personne. Une adresse ambiguë ou introuvable ne bloque jamais l’information générale et ne doit jamais être présentée comme certaine.', 'L’outil BeSt ne doit être appelé que si une adresse belge complète est réellement nécessaire à une orientation ou si la personne demande explicitement une vérification. Il n’est jamais utilisé pour une demande de rappel. Le résultat est toujours reformulé et confirmé par la personne. Une adresse ambiguë ou introuvable ne bloque jamais l’information générale et ne doit jamais être présentée comme certaine.', 'L’outil BeSt ne doit être appelé que si une adresse belge complète est réellement nécessaire à une orientation ou si la personne demande explicitement une vérification. Il n’est jamais utilisé pour une demande de rappel. Le résultat est toujours reformulé et confirmé par la personne. Une adresse ambiguë ou introuvable ne bloque jamais l’information générale et ne doit jamais être présentée comme certaine.',
  'Belgian BeSt address validation only when necessary confirm candidate ambiguity never block general information', '{"dynamic":false,"source_label":"BOSA — BeSt Address Services"}'::jsonb,
  '2026-10-28T00:00:00Z', true
from source_row
on conflict (chunk_key) do update set
  source_id = excluded.source_id,
  category = excluded.category,
  title_fr = excluded.title_fr,
  retrieval_text_fr = excluded.retrieval_text_fr,
  answer_fr = excluded.answer_fr,
  facts_fr = excluded.facts_fr,
  embedding = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedding
  end,
  embedded_at = case
    when existing.embedding_input_en is distinct from excluded.embedding_input_en then null
    else existing.embedded_at
  end,
  embedding_input_en = excluded.embedding_input_en,
  metadata = excluded.metadata,
  verified_at = excluded.verified_at,
  active = true;

commit;
