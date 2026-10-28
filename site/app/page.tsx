"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useEffect, useState } from "react";

const A = "./assets";
const H = `${A}/icons/hospital`;

type VoiceState = "idle" | "requesting" | "connected" | "error";

const projectPillars = [
  {
    icon: `${H}/info.png`,
    number: "1",
    title: "Répondre aux questions générales",
    text: "Un accès vocal aux informations pratiques publiées par le CHRSM et aux réponses les plus fréquentes.",
  },
  {
    icon: `${H}/signpost.png`,
    number: "2",
    title: "Orienter vers le bon service",
    text: "Une première qualification du besoin pour retrouver le bon contact, l’accès ou la démarche utile.",
  },
  {
    icon: `${H}/people.png`,
    number: "3",
    title: "Préparer une reprise humaine",
    text: "Quand la demande le nécessite, le bot collecte le strict nécessaire pour organiser un rappel humain.",
  },
];

const usefulInformation = [
  {
    icon: `${H}/map.png`,
    title: "Accès & itinéraires",
    text: "CHRSM — site Meuse, avenue Albert Ier 185, 5000 Namur.",
  },
  {
    icon: `${H}/car.png`,
    title: "Parking",
    text: "Informations d’accès aux parkings P1 et P2 et à la zone de dépose-minute.",
  },
  {
    icon: `${H}/clock.png`,
    title: "Heures de visite",
    text: "Les plages varient selon le service : l’assistant indique la source à vérifier avant la visite.",
  },
  {
    icon: `${H}/checklist.png`,
    title: "Documents à prévoir",
    text: "Carte d’identité, prescription et documents utiles selon le type de consultation.",
  },
  {
    icon: `${H}/city.png`,
    title: "Services & secrétariats",
    text: "Coordonnées publiques et orientation vers le contact correspondant à la demande.",
  },
  {
    icon: `${H}/bed.png`,
    title: "Admission & séjour",
    text: "Informations générales avant la venue, sans conseil médical ni accès au dossier patient.",
  },
];

const servicePathways = [
  {
    icon: `${H}/info.png`,
    title: "Informer avec précision",
    text: "Accès, horaires, visites et informations pratiques publiées.",
  },
  {
    icon: `${H}/signpost.png`,
    title: "Trouver le bon service",
    text: "La demande est qualifiée pour proposer le contact ou la démarche utile.",
  },
  {
    icon: `${H}/checklist.png`,
    title: "Préparer la venue",
    text: "Documents et modalités publiques à vérifier avant le déplacement.",
  },
  {
    icon: `${H}/map.png`,
    title: "Vérifier l’adresse utile",
    text: "Le référentiel BeSt aide à confirmer la rue, la commune et le code postal.",
  },
  {
    icon: `${H}/telephone.png`,
    title: "Préparer une demande de rappel",
    text: "Coordonnées et service recherché, sans promesse de créneau ni rendez-vous ferme.",
  },
  {
    icon: `${H}/headset.png`,
    title: "Transmettre à l’humain",
    text: "Le contexte administratif utile accompagne la reprise humaine lorsque nécessaire.",
  },
];

const safetyPrinciples = [
  {
    icon: `${H}/check.png`,
    title: "Informations contrôlées",
    text: "Réponses fondées sur des pages institutionnelles identifiées et datées.",
  },
  {
    icon: `${H}/medical-shield.png`,
    title: "Aucun conseil médical",
    text: "Le prototype n’établit pas de diagnostic et ne remplace jamais un professionnel de santé.",
  },
  {
    icon: `${H}/lock.png`,
    title: "Données minimisées",
    text: "Le parcours vocal recueille uniquement les coordonnées nécessaires, sans donnée clinique ni adresse e-mail.",
  },
  {
    icon: `${H}/people.png`,
    title: "Reprise humaine",
    text: "En cas de doute ou de situation sensible, le parcours renvoie vers un interlocuteur ou les urgences.",
  },
];

const deploymentSteps = [
  ["1", "Cadrage", "Périmètres, contenus, garde-fous et indicateurs de réussite."],
  ["2", "Interconnexion", "Connexion contrôlée à la téléphonie et aux outils autorisés."],
  ["3", "Pilote", "Test sur un périmètre défini avec les équipes du CHRSM."],
  ["4", "Déploiement", "Extension progressive, supervision et amélioration continue."],
];

const footerCommitments = [
  [`${H}/info.png`, "Information et orientation"],
  [`${H}/checklist.png`, "Demande de rendez-vous encadrée"],
  [`${H}/people.png`, "Transfert vers un humain"],
  [`${A}/icons/database-complex.png`, "Intégration progressive"],
];

function VoiceConsole() {
  return (
    <ConversationProvider>
      <VoiceConsoleControls />
    </ConversationProvider>
  );
}

function VoiceConsoleControls() {
  const [consent, setConsent] = useState(false);
  const [starting, setStarting] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [message, setMessage] = useState("Prêt pour une conversation de démonstration.");
  const voiceSessionUrl = process.env.NEXT_PUBLIC_CHRSM_VOICE_SESSION_URL;
  const conversation = useConversation({
    onConnect: () => {
      setStarting(false);
      setHasError(false);
      setMessage("Conversation en cours — parlez naturellement.");
    },
    onDisconnect: (details) => {
      setStarting(false);
      if (details.reason === "error") {
        setHasError(true);
        setMessage("La conversation a été interrompue. Réessayez dans un instant.");
        return;
      }
      setHasError(false);
      setMessage("Conversation terminée. Aucune donnée médicale ne doit être communiquée dans cette démo.");
    },
    onError: () => {
      setStarting(false);
      setHasError(true);
      setMessage("La connexion au voicebot n’a pas pu être établie. Réessayez dans un instant.");
    },
  });
  const { endSession } = conversation;

  const status: VoiceState = hasError
    ? "error"
    : conversation.status === "connected"
      ? "connected"
      : starting || conversation.status === "connecting"
        ? "requesting"
        : "idle";

  useEffect(() => {
    const cleanup = () => {
      endSession();
    };
    window.addEventListener("pagehide", cleanup);
    return () => {
      window.removeEventListener("pagehide", cleanup);
    };
  }, [endSession]);

  const startConversation = async () => {
    if (!consent) {
      setMessage("Cochez d’abord l’accord d’utilisation du microphone.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setHasError(true);
      setMessage("Le microphone n’est pas disponible dans ce navigateur.");
      return;
    }

    if (!voiceSessionUrl) {
      setHasError(true);
      setMessage("La session vocale n’est pas configurée sur cet environnement de démonstration.");
      return;
    }

    try {
      setStarting(true);
      setHasError(false);
      setMessage("Autorisez le microphone pour commencer…");
      const permissionStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: { ideal: 1 },
        },
      });
      const inputDeviceId = permissionStream.getAudioTracks()[0]?.getSettings().deviceId;
      permissionStream.getTracks().forEach((track) => track.stop());

      setMessage("Connexion sécurisée au voicebot…");
      const response = await fetch(voiceSessionUrl, {
        method: "GET",
        headers: { Accept: "application/json, text/plain" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("voice_session_unavailable");

      const contentType = response.headers.get("content-type") || "";
      const body: unknown = contentType.includes("application/json")
        ? await response.json()
        : await response.text();
      const token = typeof body === "string"
        ? body.trim()
        : body && typeof body === "object" && "token" in body && typeof body.token === "string"
          ? body.token
          : body && typeof body === "object" && "conversationToken" in body && typeof body.conversationToken === "string"
            ? body.conversationToken
            : body && typeof body === "object" && "conversation_token" in body && typeof body.conversation_token === "string"
              ? body.conversation_token
              : "";
      if (!token) throw new Error("voice_token_missing");

      conversation.startSession({
        conversationToken: token,
        connectionType: "webrtc",
        ...(inputDeviceId ? { inputDeviceId } : {}),
      });
    } catch (error) {
      setStarting(false);
      setHasError(true);
      const denied = error instanceof DOMException && error.name === "NotAllowedError";
      setMessage(
        denied
          ? "Accès au microphone refusé. Vous pouvez l’autoriser dans les réglages du navigateur."
          : "La conversation n’a pas pu démarrer. Réessayez dans un instant.",
      );
    }
  };

  const stopConversation = () => {
    conversation.endSession();
    setStarting(false);
    setHasError(false);
    setMessage("Conversation terminée. Aucune donnée médicale ne doit être communiquée dans cette démo.");
  };

  const toggleMute = () => {
    const next = !conversation.isMuted;
    conversation.setMuted(next);
    setMessage(next ? "Microphone coupé." : "Microphone réactivé.");
  };

  const active = status === "connected";
  const speaking = active && conversation.isSpeaking;

  return (
    <div className="voice-console" data-bento aria-labelledby="voice-console-title">
      <div className="voice-console-top">
        <div>
          <p className="eyebrow eyebrow-light">Démo vocale en ligne</p>
          <h3 id="voice-console-title">Parler à l’assistant vocal</h3>
          <p className="voice-intro">Posez une question sur l’accès, les visites, un service ou la préparation d’une consultation.</p>
        </div>
        <span className={`voice-status status-${status}`} aria-live="polite">
          <i aria-hidden="true" />
          {status === "connected" ? (conversation.isSpeaking ? "Le bot répond" : "À l’écoute") : status === "requesting" ? "Connexion" : status === "error" ? "À vérifier" : "Disponible"}
        </span>
      </div>

      <div className={`voice-orb ${active ? "is-connected" : ""} ${speaking ? "is-speaking" : ""}`} aria-hidden="true">
        <img src={`${H}/phone.png`} alt="" width="256" height="256" />
        <div className="voice-bars">
          {Array.from({ length: 17 }, (_, index) => (
            <span key={index} style={{ animationDelay: `${index * -45}ms` }} />
          ))}
        </div>
      </div>

      <p className="voice-message" aria-live="polite">{message}</p>

      <label className="consent-line">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>J’autorise l’accès au microphone et l’enregistrement de cette conversation de démonstration dans ElevenLabs pendant 30 jours. Je ne communique aucune donnée médicale sensible.</span>
      </label>

      <div className="voice-actions">
        {!active ? (
          <button className="button button-lime" type="button" onClick={startConversation} disabled={status === "requesting"}>
            <img src={`${H}/phone.png`} alt="" width="256" height="256" />
            {status === "requesting" ? "Connexion…" : "Parler à l’assistant vocal"}
          </button>
        ) : (
          <>
            <button className="button button-ghost-light" type="button" onClick={toggleMute} aria-pressed={conversation.isMuted}>{conversation.isMuted ? "Réactiver le micro" : "Couper le micro"}</button>
            <button className="button button-danger" type="button" onClick={stopConversation}>Terminer</button>
          </>
        )}
      </div>

      <p className="voice-note">Prototype non officiel · audio conservé 30 jours · aucune prise de rendez-vous ferme · danger vital : 112</p>
    </div>
  );
}

function AddressCheck() {
  return (
    <article className="address-demo-card" data-bento aria-label="Exemple de vérification d’adresse pendant la conversation">
      <header className="address-demo-heading">
        <span><img src={`${H}/headset.png`} alt="" width="256" height="256" decoding="async" /></span>
        <h3>Pendant la conversation</h3>
      </header>

      <div className="address-demo-flow">
        <blockquote className="address-speech">
          <span className="speech-wave" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span>
          <p>« J’habite rue de la Station, à Namur. »</p>
        </blockquote>

        <span className="address-demo-arrow" aria-hidden="true">→</span>

        <div className="address-result-card">
          <span className="address-result-icon"><img src={`${H}/check.png`} alt="" width="256" height="256" decoding="async" /></span>
          <div>
            <p>Adresse identifiée</p>
            <strong>Rue de la Station · 5000 Namur</strong>
            <span>Libellé officiel retrouvé</span>
          </div>
        </div>
      </div>

      <p className="address-confirmation">Le libellé proposé est toujours confirmé avec l’appelant.</p>
    </article>
  );
}

type RequestPreviewMode = "callback" | "appointment";

const requestPreviewContent = {
  callback: {
    title: "Une demande claire, transmise à votre équipe.",
    paragraphs: [
      "Lorsqu’un appelant souhaite être rappelé, le voicebot recueille les informations utiles et prépare un e-mail structuré pour le service concerné.",
      "Le contenu et les destinataires peuvent être adaptés à l’organisation du CHRSM afin de faciliter la reprise humaine.",
    ],
    bullets: [
      "Les coordonnées de l’appelant",
      "Le service et le motif de la demande",
      "Les préférences de rappel, si précisées",
    ],
    recipient: "Équipe des consultations",
    subject: "Demande de rappel — Consultations",
    introduction: "Un appelant souhaite être recontacté par votre équipe. Voici le récapitulatif de sa demande.",
    rows: [
      ["Appelante", "Marie Dupont"],
      ["Téléphone", "+32 4XX XX XX XX"],
      ["Service souhaité", "Consultations"],
      ["Motif de la demande", "Souhaite organiser un rendez-vous de suivi."],
      ["Moment de rappel souhaité", "En matinée, si possible."],
    ],
    closing: "Merci de prendre le relais pour donner suite à cette demande.",
    footnote: "Exemple fictif · Notification générée à l’issue de l’appel",
  },
  appointment: {
    title: "Une demande de rendez-vous bien préparée.",
    paragraphs: [
      "La prise de rendez-vous en direct n’est pas active dans ce prototype. Le voicebot ne réserve aucun créneau : il recueille les informations utiles et prépare une demande structurée pour le secrétariat concerné.",
      "L’équipe reçoit les coordonnées, le sujet exprimé et les disponibilités indiquées, puis reprend contact pour organiser la suite.",
    ],
    bullets: [
      "Le service ou la spécialité recherchée",
      "Le sujet du rendez-vous souhaité",
      "Les disponibilités de l’appelant",
    ],
    recipient: "Secrétariat des consultations",
    subject: "Demande de rendez-vous — à traiter",
    introduction: "Une appelante souhaite demander un rendez-vous. Voici les informations recueillies pendant l’appel.",
    rows: [
      ["Appelante", "Marie Dupont"],
      ["Téléphone", "+32 4XX XX XX XX"],
      ["Service souhaité", "Cardiologie"],
      ["Type de rendez-vous", "Consultation de suivi"],
      ["Sujet de la demande", "Organiser le suivi conseillé lors de sa dernière consultation."],
      ["Disponibilités indiquées", "Mardi ou jeudi, de préférence en matinée."],
    ],
    closing: "Merci de recontacter l’appelante pour convenir d’un rendez-vous.",
    footnote: "Exemple fictif · Aucun créneau réservé dans cette démonstration",
  },
} as const;

function RequestEmailPreview() {
  const [mode, setMode] = useState<RequestPreviewMode>("callback");
  const content = requestPreviewContent[mode];

  return (
    <>
      <div className="callback-copy" id="request-preview-copy">
        <p className="eyebrow eyebrow-light">Rendez-vous & rappel</p>
        <h2>{content.title}</h2>
        <div className="callback-paragraphs">
          {content.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <ul>
          {content.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
        </ul>
        <p className="callback-caveat">La prise de rendez-vous en direct n’est pas active dans ce prototype. Elle pourra être intégrée à la version complète après validation et déploiement sécurisé. Ici, aucun créneau n’est confirmé.</p>
      </div>

      <article className="email-preview" data-bento aria-labelledby="email-preview-title">
        <p className="email-preview-kicker" id="email-preview-title">Exemple d’e-mail interne</p>
        <div
          className="request-tabs"
          role="tablist"
          aria-label="Choisir le type de demande affiché"
          onKeyDown={(event) => {
            const nextMode = event.key === "ArrowLeft" || event.key === "Home"
              ? "callback"
              : event.key === "ArrowRight" || event.key === "End"
                ? "appointment"
                : null;
            if (!nextMode) return;
            event.preventDefault();
            setMode(nextMode);
            window.requestAnimationFrame(() => document.getElementById(`tab-${nextMode}`)?.focus());
          }}
        >
          <button
            type="button"
            role="tab"
            id="tab-callback"
            aria-controls="request-email-panel"
            aria-selected={mode === "callback"}
            tabIndex={mode === "callback" ? 0 : -1}
            onClick={() => setMode("callback")}
          >
            Demande de rappel
          </button>
          <button
            type="button"
            role="tab"
            id="tab-appointment"
            aria-controls="request-email-panel"
            aria-selected={mode === "appointment"}
            tabIndex={mode === "appointment" ? 0 : -1}
            onClick={() => setMode("appointment")}
          >
            Demande de rendez-vous
          </button>
        </div>

        <div
          className="email-preview-panel"
          id="request-email-panel"
          role="tabpanel"
          aria-labelledby={mode === "callback" ? "tab-callback" : "tab-appointment"}
        >
          <header className="email-preview-head">
            <span className="email-preview-icon" aria-hidden="true">
              <img src={`${A}/icons/email-healthcare.png`} alt="" width="512" height="512" decoding="async" />
            </span>
            <div>
              <p><span>À :</span> {content.recipient}</p>
              <h3>{content.subject}</h3>
            </div>
          </header>
          <div className="email-preview-body">
            <p>Bonjour,<br />{content.introduction}</p>
            <dl className="email-summary">
              {content.rows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="email-preview-closing">{content.closing}</p>
          </div>
          <footer className="email-preview-footer">{content.footnote}</footer>
        </div>
      </article>

    </>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-bento]"));
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const coarsePointer = window.matchMedia("(hover: none), (pointer: coarse)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileStack = window.matchMedia("(max-width: 560px) and (prefers-reduced-motion: no-preference)");
    const cardCleanups: Array<() => void> = [];
    const stackedParents = new Set<HTMLElement>();
    let activeCard: HTMLElement | null = null;

    const resetCard = (card: HTMLElement) => {
      card.classList.remove("is-bento-active");
      card.style.removeProperty("--bento-rx");
      card.style.removeProperty("--bento-ry");
    };

    if (finePointer.matches) {
      cards.forEach((card) => {
        const move = (event: PointerEvent) => {
          if (activeCard && activeCard !== card) resetCard(activeCard);
          activeCard = card;
          const bounds = card.getBoundingClientRect();
          const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
          const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
          card.style.setProperty("--bento-rx", `${((0.5 - y) * 5).toFixed(2)}deg`);
          card.style.setProperty("--bento-ry", `${((x - 0.5) * 6).toFixed(2)}deg`);
          card.classList.add("is-bento-active");
        };
        const leave = () => {
          resetCard(card);
          if (activeCard === card) activeCard = null;
        };
        const out = (event: PointerEvent) => {
          const related = event.relatedTarget;
          if (!related || !(related instanceof Node) || !card.contains(related)) leave();
        };
        card.addEventListener("pointermove", move);
        card.addEventListener("pointerleave", leave);
        card.addEventListener("pointerout", out);
        cardCleanups.push(() => {
          card.removeEventListener("pointermove", move);
          card.removeEventListener("pointerleave", leave);
          card.removeEventListener("pointerout", out);
          resetCard(card);
        });
      });

      const resetOutsideCard = (event: PointerEvent) => {
        if (!activeCard) return;
        const target = event.target;
        if (!target || !(target instanceof Node) || !activeCard.contains(target)) {
          resetCard(activeCard);
          activeCard = null;
        }
      };
      const resetOnBlur = () => {
        if (!activeCard) return;
        resetCard(activeCard);
        activeCard = null;
      };
      window.addEventListener("pointermove", resetOutsideCard, { passive: true });
      window.addEventListener("blur", resetOnBlur);
      cardCleanups.push(() => {
        window.removeEventListener("pointermove", resetOutsideCard);
        window.removeEventListener("blur", resetOnBlur);
        resetOnBlur();
      });
    }

    const clearMobileStacks = () => {
      stackedParents.forEach((parent) => parent.classList.remove("is-bento-stack-parent"));
      stackedParents.clear();
      cards.forEach((card) => {
        card.classList.remove("is-bento-stack");
        card.style.removeProperty("--bento-stack-top");
        card.style.removeProperty("--bento-stack-z");
      });
    };

    const syncMobileStacks = () => {
      clearMobileStacks();
      if (!mobileStack.matches) return;

      const groupedParents = new Set<HTMLElement>();
      cards.forEach((card) => {
        const parent = card.parentElement;
        if (!parent || groupedParents.has(parent)) return;

        const siblingCards = Array.from(parent.children).filter(
          (child): child is HTMLElement => child instanceof HTMLElement && child.matches("[data-bento]"),
        );
        if (siblingCards.length < 2) return;

        groupedParents.add(parent);
        stackedParents.add(parent);
        parent.classList.add("is-bento-stack-parent");
        siblingCards.forEach((sibling, index) => {
          const visibleOffset = Math.min(index, 6) * 6;
          sibling.classList.add("is-bento-stack");
          sibling.style.setProperty("--bento-stack-top", `${76 + visibleOffset}px`);
          sibling.style.setProperty("--bento-stack-z", String(10 + index));
        });
      });
    };

    syncMobileStacks();
    mobileStack.addEventListener("change", syncMobileStacks);
    cardCleanups.push(() => {
      mobileStack.removeEventListener("change", syncMobileStacks);
      clearMobileStacks();
    });

    let observer: IntersectionObserver | null = null;
    if (coarsePointer.matches && !reducedMotion.matches && "IntersectionObserver" in window) {
      cards.forEach((card, index) => {
        card.classList.add("is-bento-observed");
        card.style.setProperty("--bento-order", String(index % 4));
      });
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-bento-visible");
          observer?.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -6%" });
      cards.forEach((card) => observer?.observe(card));
    }

    return () => {
      cardCleanups.forEach((cleanup) => cleanup());
      observer?.disconnect();
      cards.forEach((card) => {
        card.classList.remove("is-bento-observed", "is-bento-visible");
        card.style.removeProperty("--bento-order");
      });
    };
  }, []);

  return (
    <>
      <a className="skip-link" href="#main-content">Aller au contenu principal</a>
      <div className="prototype-strip">
        <span>Prototype de démonstration non officiel</span>
        <span className="strip-separator" aria-hidden="true">•</span>
        <span>Danger vital : <a href="tel:112">112</a></span>
        <span className="strip-separator" aria-hidden="true">•</span>
        <span>Urgences CHRSM : <a href="tel:+3281726700">081 72 67 00</a></span>
      </div>

      <header className="site-header">
        <div className="shell header-inner">
          <a className="brand-card" href="#top" aria-label="Retour en haut de la page">
            <img src={`${A}/chrsm-logo.png`} alt="CHRSM — Centre Hospitalier Régional Sambre et Meuse" width="185" height="108" />
          </a>
          <nav id="main-navigation" className={menuOpen ? "is-open" : ""} aria-label="Navigation principale">
            <a href="#projet" onClick={() => setMenuOpen(false)}>Le projet</a>
            <a href="#informations" onClick={() => setMenuOpen(false)}>Fonctionnalités</a>
            <a href="#architecture" onClick={() => setMenuOpen(false)}>Architecture</a>
            <a href="#securite" onClick={() => setMenuOpen(false)}>Sécurité</a>
            <a href="#deploiement" onClick={() => setMenuOpen(false)}>Déploiement</a>
          </nav>
          <a className="header-contact" href="tel:+3271182473">Contact</a>
          <button className="menu-toggle" type="button" aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(!menuOpen)}>
            <span /><span /><span />
          </button>
        </div>
      </header>

      <main id="main-content">

        <section className="hero" id="top">
          <div className="hero-orbit orbit-one" aria-hidden="true" />
          <div className="hero-orbit orbit-two" aria-hidden="true" />
          <div className="shell hero-grid">
            <div className="hero-copy">
              <p className="hero-kicker">Proposition technique <i aria-hidden="true">•</i> CHRSM — site Meuse <span aria-hidden="true" /></p>
              <h1>Un accueil<br />téléphonique<br />plus simple,<br />mieux orienté</h1>
              <p className="hero-lead">Un voicebot de première ligne pour répondre aux demandes générales et transférer vers le bon service lorsqu’une intervention humaine est nécessaire.</p>
              <div className="hero-actions">
                <a className="button button-cyan" href="#demo">Parler à l’assistant vocal <span aria-hidden="true">→</span></a>
                <a className="button button-ghost-light" href="#architecture">Voir l’architecture</a>
              </div>
              <p className="hero-microcopy">Informations générales uniquement <span aria-hidden="true">•</span> Aucun conseil médical <span aria-hidden="true">•</span> Reprise humaine prévue</p>
            </div>
            <div className="hero-visual">
              <img className="handset-visual" src={`${A}/visuals/handset-routing.png`} alt="Combiné téléphonique relié à des tuiles d’information, d’orientation et de reprise humaine" width="1536" height="1024" fetchPriority="high" decoding="async" />
              <div className="hospital-chip" data-bento>
                <img src={`${A}/hospital-meuse.jpg`} alt="Bâtiment du CHRSM — site Meuse à Namur" width="613" height="345" decoding="async" />
                <span><b>Site Meuse</b>Avenue Albert Ier 185 · Namur</span>
              </div>
            </div>
          </div>
        </section>

      <section className="project-bridge" id="projet">
        <div className="shell">
          <div className="bridge-card" data-bento>
            <div className="section-title compact">
              <p className="eyebrow">Le projet voicebot</p>
              <h2>Une première ligne claire, avec des limites explicites</h2>
            </div>
            <div className="pillar-grid">
              {projectPillars.map((pillar) => (
                <article className="pillar-card" key={pillar.title}>
                  <span className="round-icon"><img src={pillar.icon} alt="" width="256" height="256" loading="lazy" decoding="async" /></span>
                  <div><p className="pillar-number">{pillar.number}.</p><h3>{pillar.title}</h3><p>{pillar.text}</p></div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section demo-section" id="demo">
        <div className="shell demo-layout">
          <VoiceConsole />
          <aside className="demo-aside" data-bento>
            <p className="eyebrow">Exemples de questions</p>
            <h2>Essayez une demande concrète</h2>
            <div className="question-list">
              <span>« Comment venir au site Meuse ? »</span>
              <span>« Quel numéro appeler pour une consultation ? »</span>
              <span>« Quels documents dois-je préparer ? »</span>
              <span>« Puis-je demander un rendez-vous ? »</span>
            </div>
            <div className="emergency-card">
              <img src={`${H}/medical-shield.png`} alt="" width="256" height="256" loading="lazy" decoding="async" />
              <div><strong>Ce voicebot n’est pas un service d’urgence.</strong><p>En cas de danger vital, appelez immédiatement le 112. Pour une urgence au CHRSM, composez le 081 72 67 00.</p></div>
            </div>
          </aside>
        </div>
      </section>

      <section className="section info-section" id="informations">
        <div className="shell">
          <div className="section-title">
            <p className="eyebrow">Des informations utiles, sans attente</p>
            <h2>Les réponses pratiques les plus demandées</h2>
            <p>Le prototype privilégie les informations publiques et renvoie vers la source institutionnelle lorsque les horaires ou modalités peuvent évoluer.</p>
          </div>
          <div className="info-grid">
            {usefulInformation.map((item) => (
              <article className="info-card" data-bento key={item.title}>
                <span className="round-icon"><img src={item.icon} alt="" width="256" height="256" loading="lazy" decoding="async" /></span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
          <section className="pathways-block" aria-labelledby="pathways-title">
            <header className="pathways-header">
              <p className="eyebrow">Un même langage, plusieurs parcours</p>
              <h2 id="pathways-title">De la première question jusqu’à la bonne orientation</h2>
              <p>Le voicebot comprend la demande, applique les limites de la démonstration et accompagne l’appelant jusqu’à la reprise humaine lorsque nécessaire.</p>
            </header>

            <div className="pathways-panel">
              <div className="common-entry">
                <h3>Un point d’entrée vocal commun</h3>
                <div className="entry-orb" aria-hidden="true">
                  <img src={`${H}/phone.png`} alt="" width="256" height="256" decoding="async" />
                </div>
                <div className="entry-actions" aria-label="Capacités de la démonstration">
                  <span>Informer</span>
                  <span>Orienter</span>
                  <span>Préparer un rappel</span>
                </div>
                <p>Une expérience simple pour l’appelant, avec des limites claires et une reprise humaine possible.</p>
              </div>

              <div className="pathway-cards">
                {servicePathways.map((pathway) => (
                  <article data-bento key={pathway.title}>
                    <img src={pathway.icon} alt="" width="256" height="256" loading="lazy" decoding="async" />
                    <div><h3>{pathway.title}</h3><p>{pathway.text}</p></div>
                  </article>
                ))}
              </div>
            </div>

            <div className="progressive-band" data-bento>
              <div className="progressive-copy">
                <p className="eyebrow">Intégration progressive</p>
                <h3>Évoluer sans remplacer l’existant</h3>
                <p>Le voicebot peut être relié progressivement aux sources et outils autorisés, après cadrage avec les équipes du CHRSM.</p>
              </div>
              <div className="progressive-flow" aria-label="Intégration progressive des sources vers le parcours patient">
                <div className="source-stack">
                  <span>Sources publiques</span>
                  <span>Référentiel BeSt</span>
                  <span>Téléphonie cible</span>
                </div>
                <span className="progressive-arrow" aria-hidden="true">→</span>
                <span className="voice-node"><img src={`${H}/phone.png`} alt="" width="256" height="256" />Voicebot</span>
                <span className="progressive-arrow progressive-arrow-lime" aria-hidden="true">→</span>
                <span className="outcome-node"><img src={`${H}/people.png`} alt="" width="256" height="256" />Information, orientation ou rappel</span>
              </div>
              <p className="progressive-assurance"><img src={`${H}/check.png`} alt="" width="256" height="256" />Une seule porte d’entrée pour l’appelant, dans le respect des règles et autorisations de chaque service.</p>
            </div>
          </section>
        </div>
      </section>

      <section className="section wayfinding-section" id="adresse">
        <div className="shell">
          <header className="wayfinding-header">
            <div className="wayfinding-heading">
              <p className="eyebrow">Accès & orientation</p>
              <h2><span>Une adresse</span><span>comprise et vérifiée</span></h2>
            </div>
            <div className="wayfinding-intro">
              <p>Lorsqu’une adresse est nécessaire à la demande, le voicebot l’identifie dans un référentiel officiel des adresses belges.</p>
              <p>Il retrouve le libellé exact de la rue, du code postal et de la commune, même lorsque la prononciation prête à confusion.</p>
            </div>
          </header>

          <div className="wayfinding-layout">
            <div className="wayfinding-visual" data-bento>
            <img src={`${A}/visuals/hospital-wayfinding.png`} alt="Illustration d’un hôpital avec repère d’itinéraire, fiche d’information, confidentialité et support humain" decoding="async" />
            </div>
            <AddressCheck />
          </div>
        </div>
      </section>

      <section className="section callback-section" id="rappel">
        <div className="shell callback-layout">
          <RequestEmailPreview />
        </div>
      </section>

      <section className="section flow-section" id="architecture">
        <div className="shell">
          <div className="section-title">
            <p className="eyebrow">Parcours cible</p>
            <h2>Un accueil vocal relié à l’existant, par étapes</h2>
            <p>La démonstration fonctionne sur le web. L’intégration à la téléphonie Cisco, le transfert direct et la prise de rendez-vous restent des capacités de déploiement à valider avec le CHRSM.</p>
          </div>
          <div className="flow-grid" role="list" aria-label="Parcours cible d’un appel">
            <article data-bento role="listitem"><span className="flow-icon"><img src={`${H}/phone.png`} alt="" width="256" height="256" loading="lazy" decoding="async" /></span><b>1</b><h3>Appel ou accès web</h3><p>Le patient formule sa demande.</p></article>
            <span className="flow-arrow" aria-hidden="true">→</span>
            <article data-bento role="listitem"><span className="flow-icon flow-word">Cisco</span><b>2</b><h3>Téléphonie CHRSM</h3><p>Connexion cible à l’infrastructure existante.</p></article>
            <span className="flow-arrow" aria-hidden="true">→</span>
            <article data-bento role="listitem"><span className="flow-icon"><img src={`${H}/bot.png`} alt="" width="256" height="256" loading="lazy" decoding="async" /></span><b>3</b><h3>Voicebot Banana Navy</h3><p>Comprend, informe et applique les garde-fous.</p></article>
            <span className="flow-arrow" aria-hidden="true">→</span>
            <article data-bento role="listitem"><span className="flow-icon"><img src={`${H}/headset.png`} alt="" width="256" height="256" loading="lazy" decoding="async" /></span><b>4</b><h3>Réponse ou reprise</h3><p>Information, demande de rappel ou transfert cible.</p></article>
          </div>
          <div className="architecture-panel" data-bento>
            <div>
              <p className="eyebrow">Architecture simple à lire</p>
              <h3>Téléphonie hospitalière → liaison contrôlée → plateforme vocale</h3>
              <p>Les flux, accès, journaux et mécanismes de repli sont définis avec les équipes sécurité avant toute mise en production.</p>
            </div>
            <img src={`${A}/visuals/secure-telephony.png`} alt="Schéma d’une téléphonie hospitalière reliée à un voicebot cloud par une liaison sécurisée" loading="lazy" decoding="async" />
          </div>
        </div>
      </section>

      <section className="section safety-section" id="securite">
        <div className="shell">
          <div className="section-title">
            <p className="eyebrow">Conçu pour un environnement hospitalier</p>
            <h2>Des garde-fous visibles dans le parcours</h2>
            <p>La confiance repose autant sur ce que le bot refuse de faire que sur la qualité de ses réponses.</p>
          </div>
          <div className="safety-grid">
            {safetyPrinciples.map((item) => (
              <article data-bento key={item.title}>
                <span className="small-icon"><img src={item.icon} alt="" width="256" height="256" loading="lazy" decoding="async" /></span>
                <div><h3>{item.title}</h3><p>{item.text}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section strike-section">
        <div className="shell strike-card" data-bento>
          <div className="strike-copy">
            <p className="eyebrow">Socle technologique Banana Navy</p>
            <h2>Du prototype à une capacité opérationnelle</h2>
            <p>Indépendamment de ce prototype CHRSM, Voice Bot Navy — développé par Banana Navy avec Sirris — a été sélectionné dans le cadre de STRIKE‑IT 2026, programme de la Défense belge porté par l’IRSD et la Force cyber au sein de la Cyber Defence Factory. Le projet progresse d’un démonstrateur vers une capacité opérationnelle de communication de crise résiliente.</p>
            <p className="strike-caveat">Sa trajectoire vise une solution souveraine. Pour le CHRSM, l’hébergement dans l’Union européenne, la résidence des données, les composants et les niveaux d’accès devront être cadrés et validés avant tout pilote.</p>
          </div>
          <div className="strike-logos" aria-label="Partenaires et programme de référence">
            <img className="banana-logo" src={`${A}/brand/banana-navy-logo.png`} alt="Banana Navy" />
            <span aria-hidden="true" />
            <img className="strike-logo" src={`${A}/brand/badge-strike-it.png`} alt="Programme STRIKE IT — CY.D3F Factory" />
          </div>
        </div>
      </section>

      <section className="section deployment-section" id="deploiement">
        <div className="shell deployment-layout">
          <div className="deployment-copy">
            <p className="eyebrow">Une intégration progressive</p>
            <h2>Avancer avec les équipes du CHRSM</h2>
            <p>Le prototype sert à tester l’expérience avant toute connexion au standard, aux outils internes ou au parcours de rendez-vous.</p>
            <div className="timeline">
              {deploymentSteps.map(([number, title, text]) => (
                <article data-bento key={number}><b>{number}</b><div><h3>{title}</h3><p>{text}</p></div></article>
              ))}
            </div>
          </div>
          <aside className="sources-card" data-bento>
            <p className="eyebrow">Registre public</p>
            <h3>Des informations reliées à leurs sources</h3>
            <p>Le prototype doit distinguer les données stables des informations à vérifier au moment de la demande.</p>
            <div className="source-links">
              <a href="https://meuse.chrsm.be/" target="_blank" rel="noreferrer">Site officiel CHRSM — Meuse <span>↗</span></a>
              <a href="https://meuse.chrsm.be/consultations-%C3%A0-namur" target="_blank" rel="noreferrer">Consultations à Namur <span>↗</span></a>
              <a href="https://meuse.chrsm.be/rendez-vous-en-ligne-pour-namur" target="_blank" rel="noreferrer">Rendez-vous — informations officielles <span>↗</span></a>
              <a href="https://meuse.chrsm.be/urgences" target="_blank" rel="noreferrer">Urgences CHRSM <span>↗</span></a>
            </div>
          </aside>
        </div>
      </section>

      </main>

      <footer id="site-footer" className="site-footer">
        <div className="shell footer-panel">
          <section className="footer-next-step" aria-labelledby="footer-next-title">
            <div>
              <p className="footer-kicker">Prochaine étape</p>
              <h2 id="footer-next-title">Préparons ensemble le pilote technique</h2>
              <p>Un atelier conjoint Banana Navy, SpitUp et CHRSM pour valider les parcours, les agendas prioritaires et l’interconnexion Cisco.</p>
            </div>
            <span className="footer-calendar" aria-hidden="true"><img src={`${H}/checklist.png`} alt="" decoding="async" /></span>
            <div className="footer-next-actions">
              <a className="button footer-workshop-button" href="mailto:marc@banana-navy.com?subject=Atelier%20technique%20CHRSM">Planifier l’atelier technique <span aria-hidden="true">→</span></a>
              <a href="#architecture">Consulter l’architecture <span aria-hidden="true">→</span></a>
            </div>
          </section>

          <div className="footer-main-grid">
            <section className="footer-partnership" aria-labelledby="footer-partnership-title">
              <p className="footer-kicker">Partenariat technologique</p>
              <h3 id="footer-partnership-title"><span>Créé pour SpitUp</span>{" "}<span>par Banana Navy.</span></h3>
              <div className="footer-logo-pair" aria-label="SpitUp et Banana Navy">
                <a className="footer-logo-tile" href="https://spitup.be" target="_blank" rel="noreferrer" aria-label="Visiter le site de SpitUp">
                  <span className="spitup-lockup"><img className="spitup-symbol" src={`${A}/brand/spitup-symbol.png`} alt="" decoding="async" /><img className="spitup-wordmark" src={`${A}/brand/spitup-logo.png`} alt="SpitUp Call Solutions" decoding="async" /></span>
                </a>
                <span className="footer-logo-separator" aria-hidden="true">×</span>
                <a className="footer-logo-tile" href="https://www.banana-navy.ai" target="_blank" rel="noreferrer" aria-label="Visiter le site de Banana Navy"><img className="banana-footer-mark" src={`${A}/brand/banana-navy-logo-trim.png`} alt="Banana Navy" decoding="async" /></a>
              </div>
              <p>Une collaboration réunissant expertise télécom et intelligence conversationnelle, au service d’un accueil téléphonique plus efficace, fiable et évolutif.</p>
            </section>

            <section className="footer-contact-column" data-bento aria-labelledby="spitup-contact-title">
              <p className="footer-kicker">Contact opérationnel</p>
              <h3 id="spitup-contact-title">SpitUp</h3>
              <address>
                <a href="tel:+3271182473"><span><img src={`${H}/phone.png`} alt="" decoding="async" /></span>+32 (0) 71 18 24 73</a>
                <a href="mailto:info@spitup.be"><span><img src={`${A}/icons/email-healthcare.png`} alt="" decoding="async" /></span>info@spitup.be</a>
                <a href="https://spitup.be/contactez-spitup/" target="_blank" rel="noreferrer"><span><img src={`${H}/signpost.png`} alt="" decoding="async" /></span>spitup.be/contact</a>
                <span className="footer-address"><i><img src={`${H}/map.png`} alt="" decoding="async" /></i><b>Rue de la Science 5<br />6000 Charleroi, Belgique</b></span>
              </address>
            </section>

            <section className="footer-contact-column" data-bento aria-labelledby="banana-contact-title">
              <p className="footer-kicker">Stack &amp; intégrations</p>
              <h3 id="banana-contact-title">Banana Navy</h3>
              <address>
                <span className="footer-person"><i><img src={`${H}/people.png`} alt="" decoding="async" /></i><b>Marc-Antoine Cajot</b></span>
                <a href="tel:+32495277044"><span><img src={`${H}/phone.png`} alt="" decoding="async" /></span>+32 495 277 044</a>
                <a href="mailto:marc@banana-navy.com"><span><img src={`${A}/icons/email-healthcare.png`} alt="" decoding="async" /></span>marc@banana-navy.com</a>
                <a href="https://www.banana-navy.ai" target="_blank" rel="noreferrer"><span><img src={`${H}/signpost.png`} alt="" decoding="async" /></span>banana-navy.ai</a>
                <span className="footer-address"><i><img src={`${H}/map.png`} alt="" decoding="async" /></i><b>Rue Antoine de Saint-Exupéry 2<br />6041 Charleroi, Belgique</b></span>
              </address>
            </section>

            <section className="footer-scope" aria-labelledby="footer-scope-title">
              <p className="footer-kicker" id="footer-scope-title">Périmètre de la démo</p>
              <ul>
                {footerCommitments.map(([icon, label]) => (
                  <li data-bento key={label}><span><img src={icon} alt="" decoding="async" /><i aria-hidden="true">✓</i></span><b>{label}</b></li>
                ))}
              </ul>
            </section>
          </div>

          <div className="footer-legal">
            <span>Prototype de démonstration — non officiel</span>
            <span>Aucun conseil médical <i aria-hidden="true">•</i> Aucun rendez-vous ferme</span>
            <span>© 2026 SpitUp × Banana Navy</span>
            <a href="tel:+3271182473"><img src={`${H}/phone.png`} alt="" decoding="async" />Contact SpitUp&nbsp;: +32 (0) 71 18 24 73</a>
          </div>
        </div>

        <div className="shell partner-band">
          <div>
            <p className="footer-kicker">Programme &amp; institutions partenaires</p>
            <div className="partner-logos">
              <img src={`${A}/brand/badge-defence.png`} alt="Défense belge" decoding="async" />
              <img src={`${A}/brand/badge-crest-royal.png`} alt="Écusson royal" decoding="async" />
              <img src={`${A}/brand/badge-strike-it.png`} alt="STRIKE IT" decoding="async" />
              <img src={`${A}/brand/badge-cyberforce.png`} alt="Cyber Force" decoding="async" />
            </div>
          </div>
          <div>
            <p>Banana Navy a été sélectionnée et est soutenue par la Défense belge dans le cadre du programme STRIKE IT, pour le développement d’une technologie de VoiceBot sécurisée et fiable.</p>
            <p lang="en">Banana Navy has been selected and is supported by the Belgian Defence through the STRIKE IT program for the development of a secure and reliable VoiceBot technology.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
