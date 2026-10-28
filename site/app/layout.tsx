import type { Metadata, Viewport } from "next";
import "@fontsource-variable/mulish";
import "./globals.css";

const assetBasePath = process.env.GITHUB_PAGES === "true" ? "/chrsm-voicebot-demo" : "";

export const metadata: Metadata = {
  title: "Accueil vocal CHRSM — prototype de démonstration",
  description: "Démonstration d’un accueil vocal de première ligne pour informer, orienter et préparer une reprise humaine au CHRSM — site Meuse.",
  applicationName: "Démo Voicebot CHRSM",
  robots: { index: false, follow: false },
  icons: {
    icon: `${assetBasePath}/favicon.png`,
    shortcut: `${assetBasePath}/favicon.png`,
    apple: `${assetBasePath}/favicon.png`,
  },
  openGraph: {
    title: "Un accueil vocal plus simple — CHRSM site Meuse",
    description: "Prototype non officiel d’un voicebot de première ligne pour le CHRSM.",
    type: "website",
    locale: "fr_BE",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#004a71",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr-BE">
      <body>{children}</body>
    </html>
  );
}
