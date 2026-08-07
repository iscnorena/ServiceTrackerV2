import { vi } from "vitest";
import { config } from "dotenv";

// La suite corre contra una base de datos aparte: nunca contra la de desarrollo.
// En CI las variables llegan del entorno y este archivo simplemente no existe.
config({ path: ".env.test", override: true });

// Los tests hacen TRUNCATE de todas las tablas antes de cada archivo. Si por un
// .env.test faltante quedara apuntando a la base de desarrollo, se llevaría por
// delante los datos de la demo — así que se rechaza antes de tocar nada.
const databaseUrl = process.env.DATABASE_URL ?? "";
if (!databaseUrl.includes("_test")) {
  throw new Error(
    `Las pruebas exigen una base de datos cuyo nombre contenga "_test". ` +
      `DATABASE_URL apunta a "${databaseUrl.split("/").pop() || "(vacío)"}". ` +
      `Copia .env.test.example a .env.test antes de correrlas.`,
  );
}

/// Los Server Actions llaman a APIs de Next que solo existen dentro de una
/// request real. Se sustituyen por equivalentes inertes para poder ejercitar la
/// lógica de negocio (permisos, scoping, validaciones) sin levantar el servidor.

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

/// Cabeceras controlables desde cada test: el rate-limiting del QR necesita
/// simular IPs distintas.
export const testHeaders = new Map<string, string>();

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (key: string) => testHeaders.get(key.toLowerCase()) ?? null,
  }),
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
}));

/// Sesión falsa: cada test declara con qué usuario corre.
export const testSession = { userId: null as string | null };

vi.mock("@/lib/auth", () => ({
  auth: async () =>
    testSession.userId ? { user: { id: testSession.userId } } : null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));

/// El correo no debe salir en pruebas; se cuenta cuántos se habrían enviado.
export const sentEmails: { to: string; kind: string }[] = [];

vi.mock("@/lib/email", () => ({
  sendInviteEmail: async (recipient: { email: string }) => {
    sentEmails.push({ to: recipient.email, kind: "invite" });
  },
  sendPasswordResetEmail: async (recipient: { email: string }) => {
    sentEmails.push({ to: recipient.email, kind: "reset" });
  },
  sendBillingEmail: async (recipient: { email: string }, key: string) => {
    sentEmails.push({ to: recipient.email, kind: key });
  },
}));
