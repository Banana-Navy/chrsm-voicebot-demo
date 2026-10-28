# Backend de démonstration CHRSM — site Meuse

Statut : **démonstrateur déployé et vérifié le 28 octobre 2026**. Les migrations
et les quatre Edge Functions de ce dossier sont actives sur le projet Supabase
décrit ci-dessous. Toute évolution ultérieure doit rester versionnée ici avant
d’être appliquée à distance.

## Plateforme vérifiée

- Projet existant : `voicebot-inondations` (`xqaydfqzhaqksappexdg`), PostgreSQL 17.11.
- Référentiel belge BeSt existant : rues et adresses dans un schéma privé protégé par RLS.
- `pg_net` et `pg_cron` sont installés. `pgvector` est disponible et la migration l’installe dans `extensions`.
- Le Data API expose `public` et `graphql_public`; `best`, `flood_voicebot` et `chrsm_demo` restent privés.
- Le lecteur Vault Microsoft Graph et le résolveur BeSt existants sont réutilisés sans modifier leur module.

## Quatre Edge Functions

| Fonction | Appelant et authentification | Responsabilité |
| --- | --- | --- |
| `chrsm-conversation-token` | Landing page; origine CORS exacte et limite HMAC par IP | Retourner un jeton WebRTC ElevenLabs éphémère pour l’agent privé. |
| `chrsm-search-knowledge` | Outil serveur ElevenLabs; `x-voicebot-token`, portée `search:knowledge` | Rechercher les informations publiques contrôlées et retourner les faits français avec leurs sources. La fonction complète au plus trois embeddings manquants avant une recherche et retombe sur la recherche lexicale en cas d’indisponibilité du modèle. |
| `chrsm-resolve-address` | Outil ElevenLabs avec portée `resolve:address`, ou landing avec origine exacte, honeypot et limite HMAC par IP | Interroger le résolveur BeSt existant sans persister l’adresse. |
| `chrsm-callback` | Outil ElevenLabs avec portée `write:callback`, landing avec origine exacte, ou cron avec `x-notification-token` et portée `dispatch:callback-email` | Enregistrer une demande minimale, créer l’outbox transactionnelle et, uniquement lors de l’action cron `dispatch`, envoyer les e-mails Graph avec reprise sur erreur. |

Il n’existe pas de fonction d’embedding ni de dispatch séparée dans cette architecture. L’enregistrement d’un callback ne tente jamais l’envoi Graph dans la même requête : il retourne l’état `queued`, puis le cron appelle l’action `dispatch` de `chrsm-callback`.

## CORS de la landing page

`CHRSM_ALLOWED_ORIGINS` est recommandé sur l’environnement de production des Edge Functions publiques. Sa valeur est une liste d’origines exactes séparées par des virgules, sans chemin ni slash final. En son absence, le démonstrateur utilise uniquement sa liste de repli versionnée : `https://banana-navy.github.io`, `http://localhost:3000` et `http://127.0.0.1:3000`. Cette liste de repli doit être retirée avant une mise en production institutionnelle.

Pour le GitHub Pages actuel :

```text
CHRSM_ALLOWED_ORIGINS=https://banana-navy.github.io
```

Un navigateur envoie seulement l’origine, pas le chemin `/chrsm-voicebot-demo`; tous les dépôts publiés sous `banana-navy.github.io` partagent donc cette origine. Les limites de débit restent obligatoires et un domaine dédié est préférable pour isoler une mise en production. `http://localhost:3000` et `http://127.0.0.1:3000` sont réservés à la liste de repli de démonstration ou à une variable explicite d’un environnement de développement.

Si la variable est définie, elle remplace entièrement cette liste de démonstration. Les outils serveur ElevenLabs restent protégés par leur jeton privé et ne dépendent pas de CORS.

## Secrets et configuration

Aucun secret brut ne doit se trouver dans GitHub Pages, les migrations ou les fichiers versionnés.

- Supabase Vault, noms fixes : `chrsm_elevenlabs_api_key`, `chrsm_elevenlabs_agent_id`, `chrsm_rate_limit_pepper` et `chrsm_callback_dispatch_token`.
- Edge Function : `CHRSM_ALLOWED_ORIGINS` uniquement pour la liste CORS; `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis par Supabase au runtime.
- Microsoft Graph : les quatre valeurs Vault existantes sont lues par `public.flood_voicebot_get_graph_runtime_config()`.
- Base de données : `chrsm_demo.api_clients` ne contient que les empreintes SHA-256 des jetons.
- ElevenLabs : le jeton brut de l’outil reste dans les en-têtes privés des outils serveur.
- Cron : le jeton brut de dispatch reste dans Vault et est injecté dynamiquement dans l’en-tête `x-notification-token`.

## Recherche sémantique publique

`gte-small` produit des vecteurs normalisés de 384 dimensions mais son modèle officiel est anglophone. Le contenu oral reste français :

- `query_fr` contient la question publique en français, sans donnée personnelle;
- `semantic_query_en` est une normalisation sémantique fidèle en anglais, sans donnée personnelle;
- `embedding_input_en` sert uniquement à l’embedding;
- `answer_fr`, `facts_fr` et `retrieval_text_fr` restent en français.

Contrat de l’outil ElevenLabs :

```json
{
  "query_fr": "Quels sont les horaires de visite en maternité ?",
  "semantic_query_en": "What are the maternity ward visiting hours?",
  "language": "fr",
  "category": "visits"
}
```

Les catégories externes autorisées sont `access`, `parking`, `visits`, `appointments`, `services`, `documents`, `admission`, `contacts`, `emergency` et `other`; la fonction les traduit vers les catégories françaises de la base.

Réponse avec résultat :

```json
{
  "status": "ok",
  "confidence": 0.86,
  "answer_context": "Contexte français contrôlé.",
  "passages": [
    {
      "title": "Titre officiel",
      "content": "Fait contrôlé.",
      "url": "https://meuse.chrsm.be/...",
      "verified_at": "2026-10-28T00:00:00Z",
      "next_review_at": "2027-01-28T00:00:00Z"
    }
  ],
  "sources": [
    {
      "title": "Titre officiel",
      "url": "https://meuse.chrsm.be/...",
      "verified_at": "2026-10-28T00:00:00Z",
      "next_review_at": "2027-01-28T00:00:00Z"
    }
  ],
  "reason_code": null
}
```

Sans résultat fiable, `status` vaut `no_match`, `confidence` vaut numériquement `0`, et les listes sont vides. Une source inactive ou dont `next_review_at` est dépassé est exclue des deux chemins de recherche.

## Demande de rappel

Le bot annonce d’abord que la prise, la modification ou l’annulation réelle d’un rendez-vous n’est pas disponible dans la démo et ne sera possible que dans la version complète après déploiement sécurisé. Il ne promet ni créneau ni délai.

Payload fermé de l’outil ElevenLabs :

```json
{
  "action": "request_callback",
  "language": "fr",
  "contact_first_name": "Jeanne",
  "contact_last_name": "Exemple",
  "callback_phone": "+32470123456",
  "contact_email": "jeanne@example.test",
  "requested_service": "Cardiologie",
  "preferred_callback_time": "demain matin",
  "callback_note": "Demande administrative courte approuvée.",
  "topic": "appointment_request",
  "consent": true,
  "source": "voicebot_demo",
  "conversation_id": "conversation-provider-id"
}
```

`contact_email` est facultatif. `callback_note` est validé mais volontairement écarté : aucun texte libre, contenu clinique ou transcript n’est persisté ni envoyé par e-mail.

Réponse attendue par ElevenLabs :

```json
{
  "status": "accepted",
  "request_reference": "CHRSM-20261028-ABC12345",
  "notification_status": "queued",
  "idempotent_replay": false,
  "reason_code": null
}
```

Payload public de la landing :

```json
{
  "first_name": "Jeanne",
  "last_name": "Exemple",
  "phone": "+32470123456",
  "email": "jeanne@example.test",
  "service": "Cardiologie",
  "callback_preference": "matin",
  "consent": true,
  "source": "landing",
  "website": ""
}
```

La réponse landing contient `status=queued`, `reference`, `created` et un message rappelant qu’aucun rendez-vous n’est confirmé.

## Résolution d’adresse

Le payload contient `street` et au moins `postcode` ou `municipality`, avec `house_number`, `box_number`, `language`, `max_candidates` et le honeypot public `website` facultatifs. La réponse expose `status`, `resolution_status`, `candidates`, `candidate_count`, `dataset_version` et `reason_code`. Une résolution ambiguë doit toujours être reformulée puis confirmée par la personne. Aucun résultat n’est lié à un callback.

## RLS et surface API

- Chaque table `chrsm_demo` a RLS activé et forcé, sans policy client.
- `PUBLIC`, `anon` et `authenticated` n’ont aucun droit sur le schéma, les tables, les séquences ou les RPC.
- `service_role` est le seul rôle autorisé sur les tables privées et les RPC fixes.
- Les RPC métier sont `SECURITY INVOKER` avec `search_path = ''`.
- Deux lecteurs Vault fixes sont `SECURITY DEFINER` : `public.chrsm_demo_get_elevenlabs_runtime_config()` et le lecteur Graph existant `public.flood_voicebot_get_graph_runtime_config()`. Ils n’acceptent aucun nom de secret fourni par l’appelant, utilisent un `search_path` vide et leur exécution est révoquée à `PUBLIC`, `anon` et `authenticated` puis accordée uniquement à `service_role`.
- Le navigateur ne reçoit jamais `service_role`, une clé ElevenLabs ou un jeton d’outil serveur.

## Rétention et exploitation

- Les callbacks sont supprimés après 30 jours par le job quotidien.
- Les buckets de rate-limit expirés sont purgés.
- Les Edge Functions ne journalisent pas les corps de requête.
- Les événements opérationnels ne contiennent que des statuts, identifiants techniques et références.
- Les recherches retournent `verified_at` et `next_review_at`, et refusent les sources arrivées à échéance de revue.
- L’outbox utilise `FOR UPDATE SKIP LOCKED`, un verrou temporaire, un backoff et une dead-letter après huit tentatives.

## Ordre de déploiement proposé

1. Tester les trois migrations sur une base locale jetable et exécuter les advisors.
2. Appliquer la migration de schéma puis le seed de quinze sources/chunks.
3. Configurer une instance active, les clients API limités à leurs scopes et `callback_email_configs`.
4. Créer les quatre secrets Vault CHRSM et vérifier le lecteur Graph existant.
5. Déployer exactement les quatre Edge Functions du tableau avec `verify_jwt=false`, puisqu’elles appliquent leurs propres contrôles.
6. Définir explicitement `CHRSM_ALLOWED_ORIGINS` pour l’environnement visé.
7. Effectuer des recherches contrôlées jusqu’à ce que les embeddings du seed soient renseignés, puis vérifier le fallback lexical.
8. Installer le cron de dispatch et exécuter un callback synthétique; vérifier l’idempotence, la reprise sur erreur et l’e-mail HTML.
9. Tester les limites de débit, les erreurs CORS, l’ambiguïté BeSt, l’exclusion d’une source périmée et la purge de rétention.
