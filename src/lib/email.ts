import "server-only";
import { Resend } from "resend";
import { getTranslations } from "next-intl/server";
import { defaultLocale, isLocale, type Locale } from "@/i18n/routing";

/// Todo el correo transaccional pasa por aquí (sección 4.7). Las plantillas
/// reutilizan los mismos archivos de traducción de next-intl, así que agregar un
/// idioma no implica escribir plantillas de correo nuevas.

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function localeOf(preferred: string | null | undefined): Locale {
  return isLocale(preferred) ? preferred : defaultLocale;
}

type EmailPayload = {
  to: string;
  subject: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footnote?: string;
  footer: string;
};

function renderEmail(payload: EmailPayload): string {
  const cta =
    payload.ctaUrl && payload.ctaLabel
      ? `<p style="margin:32px 0"><a href="${payload.ctaUrl}" style="background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${payload.ctaLabel}</a></p>
         <p style="font-size:12px;color:#64748b;word-break:break-all">${payload.ctaUrl}</p>`
      : "";
  const footnote = payload.footnote
    ? `<p style="font-size:13px;color:#64748b">${payload.footnote}</p>`
    : "";

  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px">
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px">
        <h1 style="font-size:20px;margin:0 0 16px">${payload.heading}</h1>
        <p style="font-size:15px;line-height:1.6;margin:0">${payload.body}</p>
        ${cta}
        ${footnote}
      </div>
      <p style="font-size:12px;color:#94a3b8;text-align:center;margin-top:24px">${payload.footer}</p>
    </div>
  </body></html>`;
}

async function send(payload: EmailPayload): Promise<void> {
  const html = renderEmail(payload);

  // En desarrollo sin llave de Resend no se manda nada real: el correo del seed
  // es ficticio y no debe recibir tráfico. Se registra en consola para poder
  // copiar el link de invitación o de reset a mano.
  if (!resend) {
    console.info(
      `[email] (sin RESEND_API_KEY) → ${payload.to}\n  ${payload.subject}\n  ${payload.ctaUrl ?? ""}`,
    );
    return;
  }

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "ServiceTracker <onboarding@resend.dev>",
      to: payload.to,
      subject: payload.subject,
      html,
    });
  } catch (error) {
    // Un fallo de correo no debe tumbar la acción que lo disparó (crear un
    // usuario, procesar un webhook). Se registra para Sentry y se sigue.
    console.error("[email] envío fallido", error);
  }
}

type Recipient = { name: string; email: string; preferredLocale?: string | null };

export async function sendInviteEmail(
  recipient: Recipient,
  params: { token: string; organizationName: string; inviterName: string },
): Promise<void> {
  const locale = localeOf(recipient.preferredLocale);
  const t = await getTranslations({ locale, namespace: "emails" });

  await send({
    to: recipient.email,
    subject: t("invite.subject", { organization: params.organizationName }),
    heading: t("invite.heading", { name: recipient.name }),
    body: t("invite.body", {
      inviter: params.inviterName,
      organization: params.organizationName,
    }),
    ctaLabel: t("invite.cta"),
    ctaUrl: `${appUrl()}/${locale}/invite/${params.token}`,
    footnote: t("invite.expiry"),
    footer: t("footer"),
  });
}

export async function sendPasswordResetEmail(
  recipient: Recipient,
  params: { token: string },
): Promise<void> {
  const locale = localeOf(recipient.preferredLocale);
  const t = await getTranslations({ locale, namespace: "emails" });

  await send({
    to: recipient.email,
    subject: t("passwordReset.subject"),
    heading: t("passwordReset.heading", { name: recipient.name }),
    body: t("passwordReset.body"),
    ctaLabel: t("passwordReset.cta"),
    ctaUrl: `${appUrl()}/${locale}/reset-password/${params.token}`,
    footnote: t("passwordReset.expiry"),
    footer: t("footer"),
  });
}

type BillingEmailKey =
  | "trialEnding"
  | "trialExpired"
  | "paymentFailed"
  | "subscriptionCancelled";

export async function sendBillingEmail(
  recipient: Recipient,
  key: BillingEmailKey,
  params: { organizationName: string; days?: number },
): Promise<void> {
  const locale = localeOf(recipient.preferredLocale);
  const t = await getTranslations({ locale, namespace: "emails" });

  await send({
    to: recipient.email,
    subject: t(`${key}.subject`),
    heading: t(`${key}.heading`, { name: recipient.name }),
    body: t(`${key}.body`, {
      organization: params.organizationName,
      days: params.days ?? 0,
    }),
    ctaLabel: t(`${key}.cta`),
    ctaUrl: `${appUrl()}/${locale}/corporativo/facturacion`,
    footer: t("footer"),
  });
}
