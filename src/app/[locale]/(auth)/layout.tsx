import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/i18n/navigation";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("common");
  const tLegal = await getTranslations("legal");

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          {t("appName")}
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-4 px-6 py-6 text-sm text-muted-foreground">
        <Link href="/legal/terminos" className="hover:underline">
          {tLegal("terms")}
        </Link>
        <Link href="/legal/privacidad" className="hover:underline">
          {tLegal("privacy")}
        </Link>
      </footer>
    </div>
  );
}
