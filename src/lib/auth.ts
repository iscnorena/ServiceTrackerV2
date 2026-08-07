import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const googleConfigured = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          select: { id: true, email: true, name: true, passwordHash: true, status: true },
        });

        // Usuario inexistente, invitado sin aceptar, o solo con login de Google
        if (!user?.passwordHash) return null;
        if (user.status !== "ACTIVE") return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    ...(googleConfigured
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    // Si alguien entra con Google y su correo ya existe como User (creado por un
    // admin con rol asignado), se vincula a esa cuenta. Si no existe, se crea sin
    // ningún acceso: podrá autenticarse pero no entrar al dashboard hasta que un
    // admin lo dé de alta en un hotel (ver sección 8 del PLAN).
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user.email) return true;

      const email = user.email.toLowerCase();
      const existing = await prisma.user.findUnique({ where: { email } });

      if (!existing) {
        const created = await prisma.user.create({
          data: {
            email,
            name: user.name ?? email,
            image: user.image,
            status: "ACTIVE",
            emailVerified: new Date(),
          },
        });
        user.id = created.id;
        return true;
      }

      if (existing.status === "DISABLED") return false;

      // Aceptar la invitación implícitamente al entrar con Google
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          status: existing.status === "INVITED" ? "ACTIVE" : existing.status,
          emailVerified: existing.emailVerified ?? new Date(),
          image: existing.image ?? user.image,
        },
      });
      user.id = existing.id;
      return true;
    },

    jwt({ token, user }) {
      // El token solo guarda el id. Rol, organización y accesos se leen frescos de
      // la base en cada request (lib/auth/session.ts) para que un cambio de permisos
      // surta efecto de inmediato, sin esperar a que expire la sesión.
      if (user?.id) token.sub = user.id;
      return token;
    },

    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
