import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3210);
const BASE_URL = `http://localhost:${PORT}`;

/// Los E2E corren contra la app real con el seed de demo cargado, en un puerto
/// aparte para no chocar con el servidor de desarrollo.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    locale: "es-MX",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // `next start` y no `next dev`: se prueba el mismo build que se despliega.
    command: `npm run start -- --port ${PORT}`,
    url: BASE_URL,
    // Cuidado con reutilizar: si ya hay un servidor en este puerto levantado a
    // mano, hereda SU entorno y no el de aquí. Con un NEXTAUTH_URL distinto, el
    // cierre de sesión redirige a un puerto donde no hay nada y la prueba falla
    // con un error de navegación que no explica nada. Si aparece algo así,
    // matar el proceso del puerto y dejar que Playwright levante el suyo.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_APP_URL: BASE_URL,
      NEXTAUTH_URL: BASE_URL,
    },
  },
});
