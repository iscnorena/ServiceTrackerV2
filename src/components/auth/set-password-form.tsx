"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormError } from "@/components/form-error";
import { acceptInvite, resetPassword } from "@/lib/actions/auth";

/// Mismo formulario para aceptar invitación y para restablecer contraseña: en los
/// dos casos el usuario define su propia contraseña contra un token de un solo uso.
export function SetPasswordForm({
  token,
  mode,
}: {
  token: string;
  mode: "invite" | "reset";
}) {
  const t = useTranslations("auth");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirmPassword") ?? "");
    setErrorKey(null);

    if (password !== confirm) {
      setErrorKey("auth.passwordsDontMatch");
      return;
    }

    startTransition(async () => {
      const action = mode === "invite" ? acceptInvite : resetPassword;
      const result = await action({ token, password });
      if (!result.ok) {
        setErrorKey(result.errorKey);
        return;
      }
      setDone(true);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">
          {mode === "invite" ? t("inviteTitle") : t("resetTitle")}
        </CardTitle>
        {mode === "invite" ? (
          <CardDescription>{t("inviteSubtitle")}</CardDescription>
        ) : null}
      </CardHeader>

      <CardContent>
        {done ? (
          <Alert>
            <AlertDescription>
              {mode === "invite" ? t("inviteDone") : t("resetDone")}
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>

            <FormError errorKey={errorKey} />

            <Button type="submit" className="w-full" disabled={isPending}>
              {t("createAccount")}
            </Button>
          </form>
        )}
      </CardContent>

      <CardFooter>
        <Link href="/login" className="text-sm text-muted-foreground hover:underline">
          {t("backToLogin")}
        </Link>
      </CardFooter>
    </Card>
  );
}
