import { getTranslations } from "next-intl/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { verifyAuthToken } from "@/lib/tokens";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const verified = await verifyAuthToken(token, "PASSWORD_RESET");

  if (!verified) {
    const t = await getTranslations("auth");
    return (
      <Alert variant="destructive">
        <AlertDescription>{t("tokenInvalid")}</AlertDescription>
      </Alert>
    );
  }

  return <SetPasswordForm token={token} mode="reset" />;
}
