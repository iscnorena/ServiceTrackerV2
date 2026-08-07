/// Errores de dominio con clave de traducción, para que los Server Actions no
/// devuelvan texto en un idioma fijo. La UI traduce `messageKey` con next-intl.
export class AppError extends Error {
  constructor(
    readonly messageKey: string,
    readonly httpStatus = 400,
  ) {
    super(messageKey);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(messageKey = "errors.unauthorized") {
    super(messageKey, 403);
    this.name = "UnauthorizedError";
  }
}

export class NotFoundError extends AppError {
  constructor(messageKey = "errors.notFound") {
    super(messageKey, 404);
    this.name = "NotFoundError";
  }
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; errorKey: string; fieldErrors?: Record<string, string> };

export function actionError(
  errorKey: string,
  fieldErrors?: Record<string, string>,
): ActionResult<never> {
  return { ok: false, errorKey, fieldErrors };
}

export function actionOk(): ActionResult<void>;
export function actionOk<T>(data: T): ActionResult<T>;
export function actionOk<T>(data?: T): ActionResult<T | void> {
  return { ok: true, data: data as T };
}

/// Convierte cualquier excepción en un ActionResult traducible. Los errores
/// inesperados se registran para Sentry y se reportan como genéricos: nunca se
/// filtra un mensaje interno de Prisma o de Stripe al usuario.
export function toActionError(error: unknown): ActionResult<never> {
  if (error instanceof AppError) return actionError(error.messageKey);
  console.error("[action]", error);
  return actionError("errors.generic");
}
