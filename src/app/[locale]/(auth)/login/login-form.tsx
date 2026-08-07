"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
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
import { FormError } from "@/components/form-error";
import { signInWithCredentials, signInWithGoogle } from "@/lib/actions/sign-in";

export function LoginForm({
  googleEnabled,
  callbackUrl,
}: {
  googleEnabled: boolean;
  callbackUrl: string;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrorKey(null);

    startTransition(async () => {
      const result = await signInWithCredentials(
        String(form.get("email") ?? ""),
        String(form.get("password") ?? ""),
      );
      if (!result.ok) {
        setErrorKey(result.errorKey);
        return;
      }
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("loginTitle")}</CardTitle>
        <CardDescription>{t("loginSubtitle")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          <FormError errorKey={errorKey} />

          <Button type="submit" className="w-full" disabled={isPending}>
            {t("signIn")}
          </Button>
        </form>

        {googleEnabled ? (
          <form action={signInWithGoogle.bind(null, callbackUrl)}>
            <Button type="submit" variant="outline" className="w-full">
              {t("signInWithGoogle")}
            </Button>
          </form>
        ) : null}
      </CardContent>

      <CardFooter className="flex flex-col items-start gap-2 text-sm">
        <Link href="/forgot-password" className="text-muted-foreground hover:underline">
          {t("forgotPassword")}
        </Link>
        <p className="text-muted-foreground">
          {t("noAccount")}{" "}
          <Link href="/signup" className="font-medium text-foreground hover:underline">
            {t("signUp")}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
