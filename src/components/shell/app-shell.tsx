import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/shell/user-menu";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { TrialBanner } from "@/components/shell/trial-banner";
import { buildNavModel } from "@/components/shell/navigation";
import type { CurrentUser } from "@/lib/auth/session";

export async function AppShell({
  user,
  children,
}: {
  user: CurrentUser;
  children: ReactNode;
}) {
  const t = await getTranslations("common");
  const nav = buildNavModel(user);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
      >
        {t("skipToContent")}
      </a>
      <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 sm:px-6">
        <Link href="/" className="font-semibold tracking-tight">
          {t("appName")}
        </Link>
        {user.organization ? (
          <span className="hidden truncate text-sm text-muted-foreground sm:inline">
            {user.organization.name}
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <LocaleSwitcher />
          <UserMenu name={user.name} email={user.email} />
        </div>
      </header>

      <TrialBanner organization={user.organization} />

      <div className="flex flex-1 flex-col lg:flex-row">
        <SidebarNav nav={nav} />
        <main id="contenido" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
