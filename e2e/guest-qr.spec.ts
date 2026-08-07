import { expect, test } from "@playwright/test";
import { login, openFirstHotel, USERS } from "./helpers";

/// El flujo completo del QR: el huésped reporta sin login y el staff lo ve
/// aparecer en su tablero marcado como reportado por huésped.
test.describe("reporte por QR", () => {
  test("un huésped reporta sin iniciar sesión y el staff lo recibe", async ({
    page,
    context,
  }) => {
    await login(page, USERS.superadmin);
    const hotelId = await openFirstHotel(page);

    // Se toma el QR de una habitación ocupada desde la hoja imprimible.
    await page.goto(`/es/${hotelId}/habitaciones/imprimir`);
    const url = await page.locator("p.font-mono").first().textContent();
    const slug = url?.trim().split("/qr/")[1];
    expect(slug).toBeTruthy();

    // Sesión limpia: el huésped no tiene cuenta ni la necesita.
    const guestPage = await context.browser()!.newPage();
    await guestPage.goto(`${process.env.E2E_BASE_URL ?? "http://localhost:3210"}/qr/${slug}`);

    await expect(
      guestPage.getByRole("heading", { name: "Reportar un problema" }),
    ).toBeVisible();

    const description = `Reporte E2E ${Date.now()}: el aire no enfría`;
    await guestPage.getByText("Algo no funciona").click();
    await guestPage.getByLabel("Cuéntanos qué pasó").fill(description);
    await guestPage.getByRole("button", { name: "Enviar reporte" }).click();

    await expect(guestPage.getByText("¡Listo! Tu reporte llegó a recepción.")).toBeVisible();
    await guestPage.close();

    // El staff lo ve etiquetado como reportado por huésped.
    await page.goto(`/es/${hotelId}/tickets`);
    await expect(page.getByText("Huésped").first()).toBeVisible();
  });

  test("la página del QR no filtra datos de otros huéspedes", async ({ page }) => {
    await login(page, USERS.superadmin);
    const hotelId = await openFirstHotel(page);
    await page.goto(`/es/${hotelId}/habitaciones/imprimir`);
    const url = await page.locator("p.font-mono").first().textContent();
    const slug = url?.trim().split("/qr/")[1];

    await page.context().clearCookies();
    await page.goto(`/qr/${slug}`);

    // Solo el número de habitación y el hotel; nada de nombres ni teléfonos.
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/\+52 744/);
    expect(body).not.toMatch(/María Fernanda|Jorge Alberto|Claudia Serrano/);
  });

  test("un código inexistente no revela nada", async ({ page }) => {
    await page.goto("/qr/noexistexx");
    await expect(page.getByText("Este código no corresponde a ninguna habitación.")).toBeVisible();
  });
});

test.describe("reporte corporativo de insumos", () => {
  test("un CORPORATE_ADMIN ve el consumo agrupado entre sus hoteles", async ({ page }) => {
    await login(page, USERS.corporate);
    await page.goto("/es/corporativo/insumos-recurrentes?days=365");

    await expect(
      page.getByRole("heading", { name: "Insumos recurrentes" }),
    ).toBeVisible();
    // La advertencia sobre la aproximación va visible, no en letra chica.
    await expect(page.getByText(/Los nombres se agrupan normalizados/)).toBeVisible();
    await expect(page.getByText(/Aparece en \d+ de \d+ hoteles/).first()).toBeVisible();
  });

  test("un ADMIN de una sola propiedad no alcanza el reporte cruzado", async ({ page }) => {
    await login(page, USERS.admin);
    const response = await page.goto("/es/corporativo/insumos-recurrentes");
    expect(response?.status()).toBe(404);
  });
});
