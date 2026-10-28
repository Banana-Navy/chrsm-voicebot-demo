# Démonstration voicebot CHRSM — site Meuse

Landing page Next.js exportée en site statique pour GitHub Pages.

## Développement

```bash
npm install
npm run dev
```

Copier `.env.example` vers `.env.local` et renseigner l’endpoint public de session vocale :

- `NEXT_PUBLIC_CHRSM_VOICE_SESSION_URL` : création d’un jeton WebRTC éphémère ElevenLabs ;

Les endpoints de rappel et de résolution BeSt sont appelés par les outils privés du
voicebot et ne sont pas injectés dans le JavaScript public de la landing page.

## Validation et export

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

Pour produire l’export GitHub Pages sous `/chrsm-voicebot-demo` :

```bash
GITHUB_PAGES=true npm run build
```

Le résultat statique est écrit dans `out/`.
