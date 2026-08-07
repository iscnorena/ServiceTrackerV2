import { expect, test } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("autenticación", () => {
  test("un usuario entra con correo y contraseña", async ({ page }) => {
    await login(page, USERS.superadmin);
    await expect(page.getByRole("banner").getByText("Grupo Hotelero Pacífico")).toBeVisible();
  });

  test("rechaza credenciales incorrectas sin decir cuál falló", async ({ page }) => {
    await page.goto("/es/login");
    await page.getByLabel("Correo electrónico").fill(USERS.superadmin);
    await page.getByLabel("Contraseña").fill("incorrecta");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();

    // Se acota al formulario: Next monta su propio elemento con role="alert".
    await expect(
      page.locator("form").getByRole("alert"),
    ).toContainText("Correo o contraseña incorrectos");
    await expect(page).toHaveURL(/\/login/);
  });

  test("sin sesión, el dashboard redirige al login", async ({ page }) => {
    await page.goto("/es");
    await expect(page).toHaveURL(/\/login/);
  });

  test("cerrar sesión devuelve al login", async ({ page }) => {
    await login(page, USERS.admin);
    await page.getByRole("button", { name: /Abrir menú/ }).click();
    await page.locator('[data-slot="dropdown-menu-item"]').click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("el idioma cambia toda la interfaz", async ({ page }) => {
    await page.goto("/en/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("la recuperación de contraseña no delata si el correo existe", async ({ page }) => {
    await page.goto("/es/forgot-password");
    await page.getByLabel("Correo electrónico").fill("nadie@ninguna.test");
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.getByText(/Si el correo existe en el sistema/)).toBeVisible();
  });

  test("las páginas legales son públicas y salen de la base de datos", async ({ page }) => {
    await page.goto("/es/legal/terminos");
    await expect(
      page.getByRole("heading", { name: "Términos y condiciones" }),
    ).toBeVisible();
    await expect(page.getByText(/Última actualización/)).toBeVisible();
  });
});

test.describe("separación de acceso", () => {
  test("una cuenta de plataforma no entra a los datos de un cliente", async ({ page }) => {
    await login(page, USERS.owner);
    // Aterriza en su propia área, no en la de ningún cliente.
    await expect(page).toHaveURL(/\/plataforma\/organizaciones/);
    await expect(page.getByText("Grupo Hotelero Pacífico")).toBeVisible();

    const response = await page.goto("/es/corporativo/hoteles");
    expect(response?.status()).toBe(404);
  });

  test("un cliente no entra al área de plataforma", async ({ page }) => {
    await login(page, USERS.superadmin);
    const response = await page.goto("/es/plataforma/organizaciones");
    expect(response?.status()).toBe(404);
  });

  test("una organización con la prueba vencida ve la pantalla de upgrade", async ({ page }) => {
    await login(page, USERS.trialing);
    await page.goto("/es/corporativo/facturacion");
    await expect(
      page.locator("#contenido").getByText("Hoteles Costa Azul"),
    ).toBeVisible();
  });
});
