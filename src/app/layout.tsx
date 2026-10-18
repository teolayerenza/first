import "@fontsource-variable/hanken-grotesk";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MobileActions } from "@/components/mobile-actions";
import { ThemeToggle, themeInitScript } from "@/components/theme";
import { isDemo } from "@/lib/data";
import "./globals.css";

// En Vercel, si no se configuró el dominio propio, se usa la URL de producción del proyecto.
const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Pocitos LP · El estado real de las calles de La Plata", template: "%s · Pocitos LP" },
  description:
    "Tablero público y anónimo del estado de las calles del casco urbano de La Plata: pozos, parches mal hechos y estado del asfalto, medido por vecinos.",
  applicationName: "Pocitos LP",
  manifest: "/manifest.webmanifest",
  // En modo demo los números son simulados: que los buscadores no los indexen como si fueran reales.
  ...(isDemo() ? { robots: { index: false, follow: false } } : {}),
};

export const viewport: Viewport = { themeColor: "#141414", viewportFit: "cover", width: "device-width", initialScale: 1 };

const NAV = [
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
      <body className="flex min-h-dvh flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-paint focus:px-3 focus:py-2 focus:text-paint-ink">
          Saltar al contenido
        </a>
        {demo && (
          <p className="bg-paint px-5 py-2 text-small text-paint-ink">
            <strong>Modo demo.</strong> Los datos son simulados para diseñar el tablero; no son reales.
          </p>
        )}
        <header className="bg-asphalt text-asphalt-ink">
          <div className="flex items-center gap-2 px-5 py-2 sm:px-8">
            <Link href="/" className="mr-auto text-lead font-semibold tracking-[-0.03em]">
              Pocitos LP
            </Link>
            <nav aria-label="Principal" className="hidden items-center md:flex">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="px-3 py-2.5 text-small text-asphalt-ink-2 hover:bg-asphalt-3 hover:text-asphalt-ink">
                  {n.label}
                </Link>
              ))}
            </nav>
            <ThemeToggle />
            <Link href="/reportar" className="inline-flex h-10 items-center bg-paint px-3 text-small font-semibold text-paint-ink hover:bg-paint-2 sm:px-4">
              Reportar<span className="hidden sm:inline">&nbsp;un pozo</span>
            </Link>
          </div>
        </header>
        <main id="contenido" className="flex-1">
          {children}
        </main>
        <Footer />
        {/* Lee la URL (usePathname): con cacheComponents tiene que ir dentro de Suspense. */}
        <Suspense fallback={null}>
          <MobileActions />
        </Suspense>
      </body>
    </html>
  );
}

/** Cierre en tablero de baldosas: llenas, sin bordes, todas las celdas usadas. */
function Footer() {
  return (
    <footer className="bg-asphalt p-2 text-asphalt-ink sm:p-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-12">
        <div className="col-span-2 flex min-h-48 flex-col justify-between bg-asphalt-2 p-5 lg:col-span-4">
          <p className="text-lead leading-snug">Un proyecto vecinal, anónimo y sin fines de lucro. Sin publicidad, sin rastreadores, sin venta de datos.</p>
          <p className="mt-6 text-small text-asphalt-ink-2">
            Calles © <a className="underline" href="https://www.openstreetmap.org/copyright">colaboradores de OpenStreetMap</a>. Datos bajo licencia ODbL.
          </p>
        </div>
        <nav aria-label="Pie" className="flex min-h-48 flex-col gap-2 bg-asphalt-2 p-5 lg:col-span-3">
          <Link href="/privacidad" className="hover:underline">Tu anonimato</Link>
          <Link href="/metodologia" className="hover:underline">Cómo se calcula cada número</Link>
          <Link href="/datos" className="hover:underline">Datos abiertos</Link>
          <Link href="/moderacion" className="hover:underline">Bitácora de moderación</Link>
          <Link href="/prensa" className="hover:underline">Prensa</Link>
        </nav>
        <div className="flex min-h-48 flex-col justify-end bg-asphalt-2 p-5 lg:col-span-2">
          <p className="text-lead leading-tight">La Plata</p>
          <p className="text-asphalt-ink-2">Casco urbano, de 1 a 31 y de 32 a 72</p>
        </div>
        <div className="col-span-2 flex min-h-48 flex-col justify-end bg-asphalt-2 p-5 lg:col-span-3">
          <p className="text-small text-asphalt-ink-2">Contacto</p>
          <a href="mailto:hola@pocitoslp.com.ar" className="text-lead hover:underline">hola@pocitoslp.com.ar</a>
        </div>
        <div className="col-span-2 flex min-h-40 items-center justify-center bg-asphalt-ink text-asphalt lg:col-span-8 lg:min-h-80">
          <p aria-hidden className="text-[clamp(3.5rem,9vw,9rem)] font-semibold leading-none tracking-[-0.05em]">Pocitos LP</p>
        </div>
        <Link href="/reportar/pozo" className="group col-span-2 flex min-h-40 flex-col justify-between bg-paint p-5 text-paint-ink hover:bg-paint-2 lg:col-span-4 lg:min-h-80">
          <span className="text-head font-semibold leading-none tracking-[-0.04em]">Reportá un pozo</span>
          <svg aria-hidden viewBox="0 0 48 48" className="ml-auto h-12 w-12 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="4">
            <path d="M6 24h34M28 11l13 13-13 13" />
          </svg>
        </Link>
      </div>
    </footer>
  );
}
