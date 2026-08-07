"use client";

import { useTranslations } from "next-intl";
import {
  Building2,
  ClipboardList,
  CreditCard,
  DoorClosed,
  FileText,
  LayoutDashboard,
  Package,
  Repeat,
  Settings,
  StickyNote,
  Users,
  UsersRound,
} from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { NativeSelect } from "@/components/native-select";
import type { NavModel } from "@/components/shell/navigation";

type NavItem = { href: string; label: string; icon: React.ElementType };

export function SidebarNav({ nav }: { nav: NavModel }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  // El hotel activo sale de la propia URL (/{hotelId}/...), así el menú no
  // necesita estado propio ni duplicar la fuente de verdad.
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  const activeHotelId = nav.hotels.some((hotel) => hotel.id === firstSegment)
    ? firstSegment
    : undefined;

  const hotelItems: NavItem[] = activeHotelId
    ? [
        { href: `/${activeHotelId}`, label: t("dashboard"), icon: LayoutDashboard },
        { href: `/${activeHotelId}/tickets`, label: t("tickets"), icon: ClipboardList },
        { href: `/${activeHotelId}/huespedes`, label: t("guests"), icon: UsersRound },
        { href: `/${activeHotelId}/habitaciones`, label: t("rooms"), icon: DoorClosed },
        { href: `/${activeHotelId}/notas`, label: t("shiftNotes"), icon: StickyNote },
        { href: `/${activeHotelId}/reportes`, label: t("reports"), icon: FileText },
      ]
    : [];

  const adminItems: NavItem[] =
    activeHotelId && nav.manageableHotelIds.includes(activeHotelId)
      ? [
          {
            href: `/${activeHotelId}/admin/departamentos`,
            label: t("departments"),
            icon: Settings,
          },
          { href: `/${activeHotelId}/admin/usuarios`, label: t("users"), icon: Users },
          {
            href: `/${activeHotelId}/admin/insumos`,
            label: t("supplies"),
            icon: Package,
          },
          {
            href: `/${activeHotelId}/admin/recurrentes`,
            label: t("recurring"),
            icon: Repeat,
          },
        ]
      : [];

  const corporateItems: NavItem[] = [
    ...(nav.showCorporate || nav.showHotelsAdmin
      ? [
          {
            href: "/corporativo/hoteles",
            label: t("hotels"),
            icon: Building2,
          },
        ]
      : []),
    ...(nav.showCrossHotelReport
      ? [
          {
            href: "/corporativo/insumos-recurrentes",
            label: t("recurringSupplies"),
            icon: Package,
          },
        ]
      : []),
    ...(nav.showCorporate
      ? [{ href: "/corporativo/usuarios", label: t("users"), icon: Users }]
      : []),
    ...(nav.showBilling
      ? [
          {
            href: "/corporativo/facturacion",
            label: t("billing"),
            icon: CreditCard,
          },
        ]
      : []),
  ];

  const platformItems: NavItem[] = nav.showPlatform
    ? [
        {
          href: "/plataforma/organizaciones",
          label: t("organizations"),
          icon: Building2,
        },
        { href: "/plataforma/configuracion", label: t("settings"), icon: Settings },
        { href: "/plataforma/legal", label: t("legal"), icon: FileText },
      ]
    : [];

  return (
    <nav
      aria-label={t("dashboard")}
      className="shrink-0 border-b bg-muted/20 px-4 py-4 lg:w-60 lg:border-r lg:border-b-0"
    >
      {nav.hotels.length > 1 ? (
        <HotelPicker hotels={nav.hotels} activeHotelId={activeHotelId} />
      ) : null}

      <div className="space-y-6">
        <NavGroup items={hotelItems} pathname={pathname} />
        <NavGroup items={adminItems} pathname={pathname} title={t("admin")} />
        <NavGroup items={corporateItems} pathname={pathname} title={t("corporate")} />
        <NavGroup items={platformItems} pathname={pathname} title={t("platform")} />
      </div>
    </nav>
  );
}

function NavGroup({
  items,
  pathname,
  title,
}: {
  items: NavItem[];
  pathname: string;
  title?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div>
      {title ? (
        <p className="mb-2 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </p>
      ) : null}
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function HotelPicker({
  hotels,
  activeHotelId,
}: {
  hotels: { id: string; name: string }[];
  activeHotelId?: string;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="mb-6 space-y-1.5">
      <label htmlFor="hotel-picker" className="px-2 text-xs text-muted-foreground">
        {t("selectHotel")}
      </label>
      <NativeSelect
        id="hotel-picker"
        value={activeHotelId ?? ""}
        onChange={(event) => {
          const next = event.target.value;
          if (!next) return;
          // Conserva la subsección al cambiar de propiedad: quien está viendo
          // tickets en un hotel quiere ver tickets en el otro, no volver al inicio.
          const rest = activeHotelId ? pathname.replace(`/${activeHotelId}`, "") : "";
          router.push(`/${next}${rest}`);
        }}
      >
        <option value="" disabled>
          {t("selectHotel")}
        </option>
        {hotels.map((hotel) => (
          <option key={hotel.id} value={hotel.id}>
            {hotel.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
