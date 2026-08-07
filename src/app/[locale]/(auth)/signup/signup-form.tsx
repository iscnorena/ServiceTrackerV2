"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
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
import { FormError } from "@/components/form-error";
import { signUpOrganization } from "@/lib/actions/auth";
import { signInWithCredentials } from "@/lib/actions/sign-in";

export function SignupForm({
  trialDays,
  locale,
}: {
  trialDays: number;
  locale: string;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [errorKey, setErrorKey] = useState<string | null>(null);
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
      const result = await signUpOrganization({
        organizationName: String(form.get("organizationName") ?? ""),
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        password,
        locale,
      });

      if (!result.ok) {
        setErrorKey(result.errorKey);
        return;
      }

      // Entrar directo tras el registro: pedirle la contraseña de nuevo a alguien
      // que la acaba de escribir dos veces es fricción sin ganancia.
      await signInWithCredentials(result.data.email, password);
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("signupTitle")}</CardTitle>
        <CardDescription>{t("signupSubtitle", { days: trialDays })}</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="organizationName">{t("organizationName")}</Label>
            <Input id="organizationName" name="organizationName" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">{t("yourName")}</Label>
            <Input id="name" name="name" autoComplete="name" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>

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
      </CardContent>

      <CardFooter className="flex flex-col items-start gap-3 text-sm text-muted-foreground">
        <p>
          {t.rich("acceptLegal", {
            terms: (chunks) => (
              <Link href="/legal/terminos" className="underline">
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href="/legal/privacidad" className="underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
        <p>
          {t("haveAccount")}{" "}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            {t("signIn")}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
