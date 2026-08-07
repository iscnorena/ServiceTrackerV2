import { expect, type Page } from "@playwright/test";

/// Credenciales del seed de demo. Los E2E corren contra esos datos: si el seed
/// cambia de correos, aquí se entera de inmediato.
export const USERS = {
  superadmin: "superadmin@pacifico.demo",
  corporate: "corporativo@pacifico.demo",
  admin: "admin1@pacifico.demo",
  staff: "staff1@pacifico.demo",
  owner: "owner@servicetracker.demo",
  trialing: "superadmin@costa.demo",
} as const;

export const PASSWORD = "Demo1234!";

export async function login(page: Page, email: string): Promise<void> {
  await page.goto("/es/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  // `/es` redirige de inmediato al hotel o al selector: hay que esperar a que
  // la navegación se asiente o los clics siguientes caen en una página que ya
  // se está desmontando.
  await page.waitForURL((url) => !url.pathname.includes("/login"));
  await page.waitForLoadState("networkidle");
}

/// Entra al primer hotel accesible y devuelve su id, que es lo que arma todas
/// las rutas del contexto de propiedad.
export async function openFirstHotel(page: Page): Promise<string> {
  await page.goto("/es");
  await page.waitForURL(/\/es\/(hoteles|c[a-z0-9]+)/);

  if (page.url().includes("/hoteles")) {
    // Ojo: `/es/corporativo/hoteles` también empieza con `/es/c`, así que el
    // enlace se elige por el patrón exacto del id de hotel.
    const hotelLink = page
      .locator("main a[href]")
      .filter({ hasText: /.+/ })
      .and(page.locator('a[href]'));
    const hrefs = await hotelLink.evaluateAll((nodes) =>
      nodes
        .map((node) => (node as HTMLAnchorElement).getAttribute("href") ?? "")
        .filter((href) => /^\/es\/c[a-z0-9]{20,}$/.test(href)),
    );
    expect(hrefs.length).toBeGreaterThan(0);
    await page.goto(hrefs[0]);
  }

  await page.waitForURL(/\/es\/c[a-z0-9]{20,}/);
  const hotelId = page.url().match(/\/es\/(c[a-z0-9]{20,})/)?.[1];
  expect(hotelId).toBeTruthy();
  return hotelId!;
}
