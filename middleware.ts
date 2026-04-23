export const config = {
  matcher: ["/", "/pricing", "/beta", "/privacy", "/terms", "/cookies"],
};

type OgMeta = { title: string; description: string; image?: string };

const OG_BY_PATH: Record<string, OgMeta> = {
  "/": {
    title: "Taura OS - Gestionale AI per Agenzie Sportive e Talent Management",
    description:
      "Piattaforma AI-native per agenzie di sport & talent management: atleti, contratti, deal e scadenze in un'unica suite. GDPR-compliant, hosting UE.",
  },
  "/pricing": {
    title: "Pricing - Taura OS",
    description:
      "Prezzi chiari, valore reale. Beta privata aperta: prime 5 agenzie gratis per 6 mesi e prezzo bloccato al rinnovo.",
  },
  "/beta": {
    title: "Partner Beta Taura OS - Ultime 3 agenzie",
    description:
      "Programma beta partner: 3 posti rimasti. 6 mesi gratis, prezzo bloccato al rinnovo, onboarding diretto con il team fondatore.",
  },
  "/privacy": {
    title: "Privacy Policy - Taura OS",
    description:
      "Come trattiamo i tuoi dati: conformita GDPR, hosting UE, diritti dell'interessato, retention e sub-processor.",
  },
  "/terms": {
    title: "Termini di Servizio - Taura OS",
    description: "Condizioni generali di utilizzo della piattaforma Taura OS.",
  },
  "/cookies": {
    title: "Cookie Policy - Taura OS",
    description: "Quali cookie usa Taura OS, finalita e controlli a disposizione dell'utente.",
  },
};

const esc = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const meta = OG_BY_PATH[url.pathname];
  if (!meta) return fetch(`${url.origin}/index.html`);

  const htmlRes = await fetch(`${url.origin}/index.html`);
  if (!htmlRes.ok) return htmlRes;
  let html = await htmlRes.text();

  const absUrl = `${url.origin}${url.pathname}`;
  const image = meta.image ?? `${url.origin}/og-image.png`;
  const t = esc(meta.title);
  const d = esc(meta.description);

  const swap = (pattern: RegExp, replacement: string) => {
    html = html.replace(pattern, replacement);
  };

  swap(/<title>[^<]*<\/title>/, `<title>${t}</title>`);
  swap(/<meta name="description"[^>]*\/>/, `<meta name="description" content="${d}" />`);
  swap(/<link rel="canonical"[^>]*\/>/, `<link rel="canonical" href="${absUrl}" />`);
  swap(/<meta property="og:url"[^>]*\/>/, `<meta property="og:url" content="${absUrl}" />`);
  swap(/<meta property="og:title"[^>]*\/>/, `<meta property="og:title" content="${t}" />`);
  swap(/<meta property="og:description"[^>]*\/>/, `<meta property="og:description" content="${d}" />`);
  swap(/<meta property="og:image"[^>]*\/>/, `<meta property="og:image" content="${image}" />`);
  swap(/<meta name="twitter:title"[^>]*\/>/, `<meta name="twitter:title" content="${t}" />`);
  swap(/<meta name="twitter:description"[^>]*\/>/, `<meta name="twitter:description" content="${d}" />`);
  swap(/<meta name="twitter:image"[^>]*\/>/, `<meta name="twitter:image" content="${image}" />`);

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
