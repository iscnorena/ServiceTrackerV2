# 004 — Borrado de tickets como permiso otorgable

**Estado**: aceptada

## Contexto

La V1 no permitía borrar tickets. Para la V2 se quería permitirlo, pero no como
un nivel más en la jerarquía.

## Decisión

Eliminar tickets no depende del nivel sino de un permiso explícito:

- `SUPERADMIN` siempre puede, sin que se le otorgue nada.
- `CORPORATE_ADMIN` y `ADMIN` no pueden por defecto; un `SUPERADMIN` puede
  otorgárselos.
- `STAFF` nunca puede, y **no es otorgable**.

Para un `ADMIN` el permiso vive en su `UserHotelAccess` y por lo tanto es por
hotel. Para un `CORPORATE_ADMIN` vive en su `User` y cubre toda la organización.

## Por qué

Sin esto, permitir borrar a algunos administradores obligaría a inventar un nivel
intermedio, y la jerarquía crecería un escalón por cada permiso sensible futuro.

Que a un `STAFF` no sea otorgable no es una restricción de configuración: es una
regla del sistema. La UI lo refleja mostrando un guion y no un interruptor
apagado — el permiso no está en off, es que no aplica.

## Qué se pierde

Un permiso otorgable es más difícil de auditar de un vistazo que un nivel fijo:
hay que revisar usuario por usuario. Se compensa mostrando en la pantalla
corporativa cuántos de los hoteles de cada `ADMIN` lo tienen concedido.

Este patrón queda como precedente para otros permisos sensibles futuros, sin
tener que rediseñar la jerarquía.
