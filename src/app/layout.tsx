import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { ThemeToggle, themeInitScript } from "@/components/theme";
import { isDemo } from "@/lib/data";
import "./globals.css";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Pocitos LP · El estado real de las calles de La Plata", template: "%s · Pocitos LP" },
  description:
    "Tablero público y anónimo del estado de las calles del casco urbano de La Plata: pozos, parches mal hechos y estado del asfalto, medido por vecinos.",
  applicationName: "Pocitos LP",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#121211" },
  ],
};

const NAV = [
  { href: "/", label: "Tablero" },
  { href: "/datos", label: "Datos abiertos" },
  { href: "/metodologia", label: "Metodología" },
  { href: "/privacidad", label: "Privacidad" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  const demo = isDemo();
  return (
    <html lang="es-AR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh flex flex-col">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
          Saltar al contenido
        </a>
        {demo && (
          <div className="bg-gastada/20 border-b border-line px-4 py-1.5 text-center text-xs text-ink-2">
            <strong className="text-ink">Modo demo</strong> · datos simulados para diseñar el tablero. Los números no son reales.
          </div>
        )}
        <header className="border-b border-line bg-surface/80 backdrop-blur sticky top-0 z-30">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-ink">
              <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-accent text-accent-ink">🕳️</span>
              <span>
                Pocitos <span className="text-ink-3">LP</span>
              </span>
            </Link>
            <nav aria-label="Principal" className="ml-auto hidden items-center gap-1 md:flex">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-full px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2 md:ml-2">
              <ThemeToggle />
            </div>
          </div>
          <nav aria-label="Principal móvil" className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="shrink-0 rounded-full border border-line px-3 py-1 text-xs text-ink-2">
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main id="contenido" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 text-sm text-ink-2 sm:grid-cols-3">
            <div>
              <p className="font-medium text-ink">Pocitos LP</p>
              <p>Un proyecto vecinal, anónimo y sin fines de lucro. Sin publicidad, sin rastreadores, sin venta de datos.</p>
            </div>
            <div className="flex flex-col gap-1">
              <Link href="/privacidad" className="hover:text-ink">🔒 Tu anonimato</Link>
              <Link href="/metodologia" className="hover:text-ink">Cómo se calcula cada número</Link>
              <Link href="/moderacion" className="hover:text-ink">Bitácora de moderación</Link>
              <Link href="/prensa" className="hover:text-ink">Prensa</Link>
            </div>
            <div>
              <p>
                Calles © <a className="underline" href="https://www.openstreetmap.org/copyright">colaboradores de OpenStreetMap</a> (ODbL).
              </p>
              <p>Los aportes de los vecinos se publican como <Link className="underline" href="/datos">datos abiertos</Link> (ODbL).</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
