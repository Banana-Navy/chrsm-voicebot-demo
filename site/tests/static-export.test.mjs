import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);
const outputRoot = new URL("../out/", import.meta.url);

async function readJavaScriptBundle(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(entries.map(async (entry) => {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) return readJavaScriptBundle(child);
    if (!entry.name.endsWith(".js")) return "";
    return readFile(child, "utf8");
  }));
  return contents.join("\n");
}

test("exports the CHRSM landing page with its safety copy", async () => {
  const html = await readFile(new URL("index.html", outputRoot), "utf8");

  assert.match(html, /Accueil vocal CHRSM/);
  assert.match(html, /Prototype de démonstration non officiel/);
  assert.match(html, /danger vital/i);
  assert.match(html, /prise de rendez-vous en direct n.est pas active/i);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/i);
});

test("ships the official visual assets used by the page", async () => {
  await Promise.all([
    access(new URL("assets/chrsm-logo.png", outputRoot)),
    access(new URL("assets/brand/banana-navy-logo.png", outputRoot)),
    access(new URL("assets/brand/badge-strike-it.png", outputRoot)),
    access(new URL("assets/visuals/handset-routing.png", outputRoot)),
    access(new URL("assets/visuals/hospital-wayfinding.png", outputRoot)),
    access(new URL("assets/visuals/secure-telephony.png", outputRoot)),
  ]);
});

test("keeps only the ephemeral voice-session contract in the public client", async () => {
  const source = await readFile(new URL("app/page.tsx", projectRoot), "utf8");

  assert.match(source, /NEXT_PUBLIC_CHRSM_VOICE_SESSION_URL/);
  assert.match(source, /conversationToken/);
  assert.match(source, /conversation_token/);
  assert.match(source, /connectionType:\s*"webrtc"/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_CHRSM_CALLBACK_URL|NEXT_PUBLIC_CHRSM_ADDRESS_URL/);
  assert.doesNotMatch(source, /CallbackRequestForm|callback-request-form/);
});

test("injects the configured public voice endpoint without exposing an agent id", async (t) => {
  const variableName = "NEXT_PUBLIC_CHRSM_VOICE_SESSION_URL";
  const configuredUrl = process.env[variableName];
  if (!configuredUrl) {
    t.skip("No public endpoint URLs were configured for this local export.");
    return;
  }

  assert.ok(configuredUrl.startsWith("https://"), `${variableName} must use HTTPS.`);
  const bundle = await readJavaScriptBundle(new URL("_next/static/", outputRoot));
  assert.ok(bundle.includes(configuredUrl), `${variableName} was not injected into the static bundle.`);
  assert.doesNotMatch(bundle, /NEXT_PUBLIC_ELEVENLABS_AGENT_ID|ELEVENLABS_AGENT_ID/);
});

test("ships the SpitUp and Banana Navy ownership footer", async () => {
  const html = await readFile(new URL("index.html", outputRoot), "utf8");

  assert.match(html, /Créé pour/);
  assert.match(html, /Une collaboration réunissant expertise télécom et intelligence conversationnelle/);
  assert.match(html, /info@spitup\.be/);
  assert.match(html, /marc@banana-navy\.com/);
  await access(new URL("assets/brand/spitup-logo.png", outputRoot));
});

test("links the header contact to SpitUp and ships motion-safe mobile bento stacks", async () => {
  const [html, source, styles] = await Promise.all([
    readFile(new URL("index.html", outputRoot), "utf8"),
    readFile(new URL("app/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/globals.css", projectRoot), "utf8"),
  ]);

  assert.match(html, /class="header-contact" href="tel:\+3271182473"/);
  assert.match(styles, /@media \(max-width: 1040px\)[\s\S]*?\.header-contact \{ margin-left: auto; \}[\s\S]*?\.menu-toggle \{ display: block; margin-left: 0; \}/);
  assert.match(source, /\(max-width: 560px\) and \(prefers-reduced-motion: no-preference\)/);
  assert.match(source, /classList\.add\("is-bento-stack"\)/);
  assert.equal(
    (source.match(/className="footer-contact-column" data-bento/g) ?? []).length,
    2,
    "Both footer contact cards must participate in the mobile bento stack.",
  );
  assert.match(styles, /\.is-bento-stack-parent/);
  assert.match(styles, /position:\s*sticky/);
  assert.match(styles, /opacity:\s*1\s*!important/);
});
