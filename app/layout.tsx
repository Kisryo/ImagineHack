import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { DemoResetButton } from "@/components/DemoResetButton";

export const metadata: Metadata = {
  title: "Compass — Organisational memory for advisory firms",
  description:
    "Transfer the relationship, not just the records. Compass turns scattered client knowledge into secure organisational memory."
};

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/notes/new", label: "New note" },
  { href: "/commitments", label: "Commitments" },
  { href: "/learning", label: "Learning" },
  { href: "/cpd", label: "CPD" },
  { href: "/partners", label: "Partners" },
  { href: "/admin", label: "Admin" },
  { href: "/audit", label: "Audit" }
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="bg-compass-ink text-white">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
              <Link href="/" className="font-semibold tracking-tight">
                Compass
              </Link>
              <nav className="hidden md:flex gap-4 text-sm opacity-90">
                {nav.map((n) => (
                  <Link key={n.href} href={n.href} className="hover:opacity-100 opacity-80">
                    {n.label}
                  </Link>
                ))}
              </nav>
              <div className="ml-auto flex items-center gap-3">
                <div className="text-xs opacity-70">demo · advisor: Aisyah</div>
                <DemoResetButton />
              </div>
            </div>
          </header>
          <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 pb-24 md:pb-6">{children}</main>
          <nav className="md:hidden no-print fixed bottom-0 inset-x-0 bg-white border-t flex justify-around py-2 text-xs">
            {nav.slice(0, 5).map((n) => (
              <Link key={n.href} href={n.href} className="px-2 py-1">{n.label}</Link>
            ))}
          </nav>
          <footer className="hidden md:block text-xs text-center py-4 opacity-60">
            Compass · institutional memory for SEA advisory firms
          </footer>
        </div>
      </body>
    </html>
  );
}
