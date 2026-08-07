"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ImagePlus } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/native-select";
import { FormError } from "@/components/form-error";
import { uploadTicketAttachment } from "@/lib/actions/attachments";
import type { AttachmentType } from "@/generated/prisma/enums";

type Attachment = {
  id: string;
  url: string;
  type: AttachmentType;
  createdAt: Date;
};

export function TicketAttachments({
  hotelId,
  ticketId,
  attachments,
  storageConfigured,
}: {
  hotelId: string;
  ticketId: string;
  attachments: Attachment[];
  storageConfigured: boolean;
}) {
  const t = useTranslations("attachments");
  const tType = useTranslations("enums.attachmentType");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("hotelId", hotelId);
    formData.set("ticketId", ticketId);
    setErrorKey(null);

    startTransition(async () => {
      const result = await uploadTicketAttachment(formData);
      if (!result.ok) {
        setErrorKey(result.errorKey);
        return;
      }
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {attachments.map((attachment) => (
              <li key={attachment.id} className="space-y-1">
                <a href={attachment.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={attachment.url}
                    alt={tType(attachment.type)}
                    className="aspect-square w-full rounded-md border object-cover"
                    loading="lazy"
                  />
                </a>
                <Badge variant="secondary">{tType(attachment.type)}</Badge>
              </li>
            ))}
          </ul>
        )}

        {storageConfigured ? (
          <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1">
                <Label htmlFor="file" className="text-xs">
                  {t("upload")}
                </Label>
                <input
                  id="file"
                  name="file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  required
                  className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="type" className="text-xs">
                  {t("type")}
                </Label>
                <NativeSelect id="type" name="type" defaultValue="BEFORE">
                  {(["BEFORE", "AFTER", "OTHER"] as const).map((option) => (
                    <option key={option} value={option}>
                      {tType(option)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <FormError errorKey={errorKey} />

            <Button type="submit" size="sm" disabled={isPending}>
              <ImagePlus className="size-4" aria-hidden="true" />
              {isPending ? t("uploading") : t("upload")}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">{t("notConfigured")}</p>
        )}
      </CardContent>
    </Card>
  );
}
