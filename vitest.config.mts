import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` existe para que el bundler falle si un módulo de servidor
      // se importa desde el cliente. Fuera de Next no hay tal distinción, así
      // que se apunta a un stub vacío para poder probar esos módulos.
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // Los tests de integración comparten una base de datos: en paralelo se
    // pisarían entre sí al limpiar las tablas.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/prisma.ts",
        "src/lib/stripe.ts",
        "src/lib/auth.ts",
        "src/lib/email.ts",
        "src/generated/**",
      ],
      reporter: ["text", "html"],
      // Umbrales fijados en lo que la suite cubre hoy: sirven para que CI
      // detecte una regresión, no como meta aspiracional.
      thresholds: {
        lines: 68,
        functions: 70,
        statements: 64,
        branches: 58,
      },
    },
  },
});
