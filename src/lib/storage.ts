import "server-only";
import { put } from "@vercel/blob";

/// Almacenamiento de archivos. En la base solo va la URL, nunca el binario.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export function isStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; errorKey: string };

/// Sube una foto de ticket. El tipo se valida contra el MIME real del archivo y
/// no contra su extensión: un `.jpg` renombrado no debe pasar como imagen.
export async function uploadTicketPhoto(
  file: File,
  pathPrefix: string,
): Promise<UploadResult> {
  if (!isStorageConfigured()) return { ok: false, errorKey: "attachments.notConfigured" };
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, errorKey: "attachments.tooLarge" };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { ok: false, errorKey: "attachments.invalidType" };
  }

  const blob = await put(`${pathPrefix}/${crypto.randomUUID()}`, file, {
    access: "public",
    contentType: file.type,
    // El nombre original puede repetirse entre hoteles; el sufijo aleatorio de
    // Vercel Blob evita colisiones y adivinar URLs de otros clientes.
    addRandomSuffix: true,
  });

  return { ok: true, url: blob.url };
}
