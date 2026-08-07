import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getPlatformConfig } from "@/lib/platform-config";
import { SignupForm } from "./signup-form";

export default async function SignupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (user) redirect(`/${locale}`);

  const config = await getPlatformConfig();

  return <SignupForm trialDays={config.trialDays} locale={locale} />;
}
