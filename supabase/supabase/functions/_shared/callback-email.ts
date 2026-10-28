export type CallbackEmailItem = {
  outbox_id: string;
  lock_token: string;
  recipient: string;
  idempotency_key: string;
  attempt_count: number;
  reference_code: string;
  request_type: string;
  appointment_action: string | null;
  first_name: string;
  last_name: string;
  phone_e164: string;
  email: string | null;
  service_requested: string | null;
  preferred_day: string | null;
  preferred_time_window: string | null;
  callback_language: string;
  is_test: boolean;
  created_at: string;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const LABELS: Record<string, string> = {
  appointment_request: "Nouvelle demande de rendez-vous",
  reschedule_request: "Demande de déplacement d’un rendez-vous",
  cancellation_request: "Demande d’annulation d’un rendez-vous",
  general_callback: "Demande générale de rappel",
  new: "Nouveau rendez-vous",
  reschedule: "Déplacement",
  cancel: "Annulation",
  morning: "Matin",
  afternoon: "Après-midi",
  any: "Indifférent",
};

function label(value: string | null): string {
  if (!value) return "Non précisé";
  return LABELS[value] ?? value;
}

function row(name: string, value: unknown): string {
  return `<tr>
    <td style="padding:9px 12px;color:#44546a;border-bottom:1px solid #e4edf2;width:38%;font-weight:700;">${escapeHtml(name)}</td>
    <td style="padding:9px 12px;color:#173b55;border-bottom:1px solid #e4edf2;">${escapeHtml(value || "Non précisé")}</td>
  </tr>`;
}

export function buildCallbackEmail(item: CallbackEmailItem) {
  const subject = `${item.is_test ? "[DÉMO] " : ""}CHRSM — demande de rappel ${item.reference_code}`;
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#f3f4f4;font-family:Arial,sans-serif;color:#173b55;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f4;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 28px rgba(0,74,113,.12);">
        <tr><td style="background:#005e97;padding:22px 28px;color:#ffffff;">
          <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#c5d43f;font-weight:700;">CHRSM — site Meuse</div>
          <div style="font-size:24px;line-height:1.25;font-weight:800;margin-top:6px;">Nouvelle demande de rappel</div>
        </td></tr>
        <tr><td style="padding:24px 28px 8px;">
          <div style="display:inline-block;background:#eef9fc;color:#00659b;border-left:4px solid #3cbcd9;padding:10px 12px;font-size:13px;line-height:1.4;">
            Prototype de démonstration — ceci n’est pas une confirmation de rendez-vous.
          </div>
          <p style="font-size:15px;line-height:1.6;margin:20px 0 14px;">Une personne a demandé à être rappelée. Merci de traiter cette demande via le canal interne approprié.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #d9e6ec;border-radius:10px;border-collapse:separate;overflow:hidden;font-size:14px;">
            ${row("Référence", item.reference_code)}
            ${row("Type", label(item.request_type))}
            ${row("Action", label(item.appointment_action))}
            ${row("Patient", `${item.first_name} ${item.last_name}`)}
            ${row("Téléphone", item.phone_e164)}
            ${row("E-mail", item.email)}
            ${row("Service souhaité", item.service_requested)}
            ${row("Jour souhaité", item.preferred_day)}
            ${row("Moment", label(item.preferred_time_window))}
            ${row("Langue", item.callback_language.toUpperCase())}
            ${row("Reçue le", new Date(item.created_at).toLocaleString("fr-BE", { timeZone: "Europe/Brussels" }))}
          </table>
          <p style="font-size:12px;line-height:1.5;color:#657887;margin:18px 0 0;">Données minimales collectées avec consentement pour organiser un rappel. Aucun contenu médical n’est inclus dans ce message.</p>
        </td></tr>
        <tr><td style="padding:18px 28px 24px;color:#657887;font-size:12px;">CHRSM — site Meuse · Avenue Albert Ier 185 · 5000 Namur</td></tr>
        <tr><td style="height:5px;background:linear-gradient(90deg,#005e97 0 55%,#3cbcd9 55% 82%,#c5d43f 82%);"></td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject, html };
}
