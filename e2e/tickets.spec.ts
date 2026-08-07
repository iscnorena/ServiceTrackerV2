import { expect, test } from "@playwright/test";
import { login, openFirstHotel, USERS } from "./helpers";

test.describe("ciclo de vida de un ticket", () => {
  test("un STAFF crea un ticket y lo resuelve", async ({ page }) => {
    await login(page, USERS.staff);
    const hotelId = await openFirstHotel(page);

    await page.goto(`/es/${hotelId}/tickets/nuevo`);
    const title = `Prueba E2E ${Date.now()}`;
    await page.getByLabel("Título").fill(title);
    await page.getByLabel("Descripción").fill("Creado desde la suite end-to-end");
    await page.getByRole("button", { name: "Crear" }).click();

    // Aterriza en el detalle del ticket recién creado.
    await page.waitForURL(/\/tickets\/c[a-z0-9]{20,}/);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    await page.getByLabel("Estatus").selectOption("RESOLVED");
    await expect(page.getByText("Ticket actualizado")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Estatus")).toHaveValue("RESOLVED");
  });

  test("el detalle muestra el contacto de ESA habitación", async ({ page }) => {
    // Es la decisión de diseño clave: mantenimiento ve al contacto del cuarto,
    // no al titular que hizo la reserva completa.
    await login(page, USERS.admin);
    const hotelId = await openFirstHotel(page);

    await page.goto(`/es/${hotelId}/tickets`);
    await page.locator('a[href*="/tickets/c"]').first().click();
    await page.waitForURL(/\/tickets\/c[a-z0-9]{20,}/);

    await expect(
      page.getByRole("heading", { name: "Contacto en la habitación" }),
    ).toBeVisible();
  });

  test("un comentario interno queda registrado en el historial", async ({ page }) => {
    await login(page, USERS.admin);
    const hotelId = await openFirstHotel(page);

    await page.goto(`/es/${hotelId}/tickets`);
    await page.locator('a[href*="/tickets/c"]').first().click();
    await page.waitForURL(/\/tickets\/c[a-z0-9]{20,}/);

    const message = `Nota E2E ${Date.now()}`;
    await page.getByLabel("Agregar comentario").fill(message);
    await page.getByRole("button", { name: "Agregar comentario" }).click();

    await expect(page.getByText(message)).toBeVisible();
    await expect(page.getByText("Comentó").first()).toBeVisible();
  });
});

test.describe("permisos de eliminación", () => {
  test("un ADMIN sin el permiso otorgado no ve el botón de eliminar", async ({ page }) => {
    await login(page, USERS.admin);
    const hotelId = await openFirstHotel(page);

    await page.goto(`/es/${hotelId}/tickets`);
    await page.locator('a[href*="/tickets/c"]').first().click();
    await page.waitForURL(/\/tickets\/c[a-z0-9]{20,}/);

    await expect(page.getByRole("button", { name: "Eliminar" })).toHaveCount(0);
  });

  test("un SUPERADMIN elimina un ticket y desaparece del listado", async ({ page }) => {
    await login(page, USERS.superadmin);
    const hotelId = await openFirstHotel(page);

    await page.goto(`/es/${hotelId}/tickets`);
    const firstCard = page.locator('a[href*="/tickets/c"]').first();
    const title = (await firstCard.locator("p").first().textContent())?.trim();
    await firstCard.click();
    await page.waitForURL(/\/tickets\/c[a-z0-9]{20,}/);

    await page.getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByText("¿Eliminar este ticket?")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Eliminar" }).click();

    await page.waitForURL(/\/tickets(\?|$)/);
    if (title) await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  });
});

test.describe("catálogo dinámico de departamentos", () => {
  test("un departamento nuevo aparece de inmediato al crear un ticket", async ({ page }) => {
    await login(page, USERS.superadmin);
    const hotelId = await openFirstHotel(page);

    const name = `Teléfonos ${Date.now()}`;
    await page.goto(`/es/${hotelId}/admin/departamentos`);
    await page.getByRole("button", { name: "Nuevo departamento" }).click();
    await page.getByLabel("Nombre").fill(name);
    await page.getByLabel("SLA base (minutos)").fill("20");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();

    // Sin deploy ni migración: ya es opción en el formulario de ticket.
    await page.goto(`/es/${hotelId}/tickets/nuevo`);
    await expect(page.getByLabel("Departamento")).toContainText(name);
  });

  test("un STAFF no alcanza la administración del hotel", async ({ page }) => {
    await login(page, USERS.staff);
    const hotelId = await openFirstHotel(page);

    const response = await page.goto(`/es/${hotelId}/admin/departamentos`);
    expect(response?.status()).toBe(404);
  });
});
