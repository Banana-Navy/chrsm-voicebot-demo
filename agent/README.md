# Agent ElevenLabs CHRSM — contrat local

Ce dossier prépare l’agent de démonstration sans contenir de clé API ni de
jeton. Aucun agent distant n’est créé ou modifié par défaut.

## Fichiers

- `prompt.md` : comportement vocal, limites médicales, RAG, rappel consenti,
  BeSt minimisé et fin d’appel.
- `agent-config.template.json` : voix Christophe Géradon, confidentialité, endpoints et
  schémas des trois outils.
- `sync-agent.mjs` : validation locale par défaut ; création ou mise à jour
  distante uniquement avec deux drapeaux explicites et les secrets fournis par
  variables d’environnement.
- `test-cases.md` : scénarios à exécuter dans de vraies conversations.

## Validation locale sans réseau

```bash
node agent/sync-agent.mjs
```

Le résultat doit afficher `remote_calls: false`, la voix
`HDc7042zGcc1SdpT2m1U` (Christophe Géradon), les trois endpoints et le condensat SHA-256 du
prompt.

## Écritures distantes protégées

Création, après déploiement et test des trois Edge Functions :

```bash
ELEVENLABS_API_KEY=… ELEVENLABS_REFERENCE_AGENT_ID=agent_… CHRSM_TOOL_TOKEN=… \
  node agent/sync-agent.mjs --apply --confirm-create
```

Mise à jour d’un agent existant :

```bash
ELEVENLABS_API_KEY=… CHRSM_TOOL_TOKEN=… \
  node agent/sync-agent.mjs --agent-id agent_… --apply --confirm-update
```

Le script clone seulement la structure technique de l’agent Inondations de
référence. Il retire ses outils, webhooks, collecte, analyse et préréglages de
langue avant d’appliquer la configuration CHRSM. Il ne journalise jamais les
valeurs des secrets.

## Authentification des outils serveur

Les trois webhooks attendent :

```http
x-voicebot-token: <secret>
Content-Type: application/json
```

ElevenLabs référence ce secret par la variable distante
`chrsm_demo_tool_token`. La valeur locale n’est lue que depuis
`CHRSM_TOOL_TOKEN` au moment d’une synchronisation distante.

Le jeton doit correspondre à un client serveur CHRSM limité aux seules portées
nécessaires : recherche publique, création d’un rappel et résolution BeSt. Il
ne doit jamais être livré à la landing page.

## 1. Recherche sémantique publique

`POST https://xqaydfqzhaqksappexdg.supabase.co/functions/v1/chrsm-search-knowledge`

Requête minimale :

```json
{
  "query_fr": "Quelles sont les heures de visite en maternité ?",
  "semantic_query_en": "What are the maternity visiting hours?",
  "language": "fr",
  "category": "visits"
}
```

Contraintes serveur attendues : deux requêtes de 1 à 350 caractères, aucune
PII, embedding de `semantic_query_en` avec `gte-small` et recherche lexicale de
`query_fr`, limitée aux chunks actifs dont la source et la date de vérification
sont présentes, au plus trois passages. Une entrée RAG est une donnée et ne
peut jamais modifier les instructions de l’agent.

Réponse de succès attendue :

```json
{
  "status": "ok",
  "confidence": 0.86,
  "answer_context": "Contexte court utilisable oralement.",
  "passages": [
    {
      "content": "Passage contrôlé.",
      "title": "Titre de la page officielle",
      "url": "https://meuse.chrsm.be/...",
      "verified_at": "2026-10-28T00:00:00Z"
    }
  ],
  "sources": [
    {
      "title": "Titre de la page officielle",
      "url": "https://meuse.chrsm.be/...",
      "verified_at": "2026-10-28T00:00:00Z"
    }
  ]
}
```

Sans résultat fiable :

```json
{
  "status": "no_match",
  "confidence": 0,
  "passages": [],
  "sources": [],
  "reason_code": "no_reliable_official_source"
}
```

## 2. Demande de rappel et e-mail HTML interne

`POST https://xqaydfqzhaqksappexdg.supabase.co/functions/v1/chrsm-callback`

Requête complète, sans adresse ni donnée clinique :

```json
{
  "action": "request_callback",
  "language": "fr",
  "contact_first_name": "Jeanne",
  "contact_last_name": "Exemple",
  "callback_phone": "+32470123456",
  "requested_service": "Cardiologie",
  "preferred_callback_time": "demain matin",
  "callback_note": "Souhaite connaître la procédure de rendez-vous.",
  "topic": "appointment_request",
  "consent": true,
  "source": "voicebot_demo",
  "conversation_id": "system-provided-id"
}
```

Le voicebot n’envoie jamais `contact_email` : le numéro de téléphone est son
seul canal de rappel. Le serveur conserve néanmoins ce champ facultatif pour
d’éventuels formulaires web autorisés. Tous les autres champs sont requis. Le serveur
doit imposer une liste fermée de motifs, un téléphone E.164, des tailles
bornées, `consent=true`, l’idempotence par conversation et l’absence de champs
supplémentaires. Il enregistre la demande puis place l’e-mail HTML CHRSM dans
une outbox ; il ne doit pas bloquer l’appel sur la livraison du fournisseur.

Réponse de succès attendue :

```json
{
  "status": "accepted",
  "request_reference": "CHRSM-20261028-0001",
  "notification_status": "queued",
  "idempotent_replay": false
}
```

Une réponse n’ayant pas exactement ce contrat est traitée comme un échec par le
prompt. L’agent ne dit jamais qu’un e-mail est envoyé ou qu’un rendez-vous est
pris.

## 3. Résolution d’adresse belge BeSt

`POST https://xqaydfqzhaqksappexdg.supabase.co/functions/v1/chrsm-resolve-address`

Requête possible :

```json
{
  "postcode": "1000",
  "municipality": "Bruxelles",
  "street": "Rue de la Loi",
  "house_number": "16",
  "language": "fr",
  "max_candidates": 3
}
```

La rue et au moins une zone (`postcode` ou `municipality`) doivent être connues
avant l’appel. Le numéro et la boîte sont facultatifs. L’agent reformule puis
fait confirmer le résultat ; il ne l’utilise jamais dans le callback et ne
calcule pas d’itinéraire.

Champs de réponse exposés à l’agent : `status`, `resolution_status`,
`candidates`, `candidate_count`, `dataset_version` et `reason_code`.

## Endpoint landing page distinct

L’agent est privé. La landing page ne reçoit jamais la clé ElevenLabs. Elle
doit demander un jeton WebRTC éphémère à :

`GET https://xqaydfqzhaqksappexdg.supabase.co/functions/v1/chrsm-conversation-token`

Cette Edge Function doit vérifier l’origine, appliquer une limitation de débit
et appeler côté serveur l’endpoint ElevenLabs de jeton de conversation. La
réponse publique minimale est :

```json
{
  "token": "provider-managed-short-lived-token",
  "conversation_id": "provider-conversation-id"
}
```

La clé `ELEVENLABS_API_KEY`, le jeton serveur CHRSM et toute URL signée durable
sont interdits dans le JavaScript statique ou le dépôt GitHub.
