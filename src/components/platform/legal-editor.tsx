"use client";

import { useMemo, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormError } from "@/components/form-error";
import { publishLegalDocument } from "@/lib/actions/platform";
import type { LegalDocumentType } from "@/generated/prisma/enums";

type Document = {
  id: string;
  type: LegalDocumentType;
  locale: string;
  version: number;
  content: string | null;
  publishedAt: Date;
};

export function LegalEditor({
  documents,
  locales,
}: {
  documents: Document[];
  locales: string[];
}) {
  const t = useTranslations("platform");
  const tCommon = useTranslations("common");
  const tType = useTranslations("enums.legalType");
  const tLegal = useTranslations("legal");
  const format = useFormatter();
  const router = useRouter();

  const [type, setType] = useState<LegalDocumentType>("TERMS");
  const [locale, setLocale] = useState(locales[0]);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const versions = useMemo(
    () =>
      documents
        .filter((document) => document.type === type && document.locale === locale)
        .sort((a, b) => b.version - a.version),
    [documents, type, locale],
  );
  const current = versions[0];

  // El textarea se remonta al cambiar de documento (key), para que muestre el
  // contenido vigente de la combinación recién elegida y no el anterior.
  const editorKey = `${type}-${locale}-${current?.version ?? 0}`;
  const [draft, setDraft] = useState(current?.content ?? "");

  function switchDocument(nextType: LegalDocumentType, nextLocale: string) {
    const next = documents.find(
      (document) =>
        document.type === nextType &&
        document.locale === nextLocale &&
        document.version ===
          Math.max(
            ...documents
              .filter((d) => d.type === nextType && d.locale === nextLocale)
              .map((d) => d.version),
            0,
          ),
    );
    setType(nextType);
    setLocale(nextLocale);
    setDraft(next?.content ?? "");
  }

  function publish() {
    setErrorKey(null);
    startTransition(async () => {
      const result = await publishLegalDocument({ type, locale, content: draft });
      if (!result.ok) {
        setErrorKey(result.errorKey);
        return;
      }
      toast.success(t("published", { version: result.data.version }));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <div className="min-w-48 space-y-2">
          <Label htmlFor="type">{t("documentType")}</Label>
          <NativeSelect
            id="type"
            value={type}
            onChange={(event) =>
              switchDocument(event.target.value as LegalDocumentType, locale)
            }
          >
            {(["TERMS", "PRIVACY"] as const).map((option) => (
              <option key={option} value={option}>
                {tType(option)}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="min-w-32 space-y-2">
          <Label htmlFor="locale">{t("locale")}</Label>
          <NativeSelect
            id="locale"
            value={locale}
            onChange={(event) => switchDocument(type, event.target.value)}
          >
            {locales.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex items-end">
          <p className="text-sm text-muted-foreground">
            {current
              ? `${t("currentVersion")}: ${current.version} · ${format.dateTime(current.publishedAt, "date")}`
              : t("noDocument")}
          </p>
        </div>
      </div>

      <Tabs defaultValue="edit">
        <TabsList>
          <TabsTrigger value="edit">{tCommon("edit")}</TabsTrigger>
          <TabsTrigger value="preview">{t("preview")}</TabsTrigger>
        </TabsList>

        <TabsContent value="edit">
          <Textarea
            key={editorKey}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={20}
            className="font-mono text-sm"
            aria-label={t("content")}
          />
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none py-6">
              <Markdown remarkPlugins={[remarkGfm]}>{draft}</Markdown>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <FormError errorKey={errorKey} />

      <div className="flex items-center gap-3">
        <Button onClick={publish} disabled={isPending || draft.trim().length === 0}>
          {isPending ? tCommon("saving") : t("publish")}
        </Button>
        <p className="text-sm text-muted-foreground">{t("legalHint")}</p>
      </div>

      {versions.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold">{t("versionHistory")}</h2>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {versions.map((version) => (
              <li key={version.id}>
                {tLegal("version", { version: version.version })} ·{" "}
                {format.dateTime(version.publishedAt, "medium")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
