# 005 — Borrado lógico en tickets

**Estado**: aceptada

## Contexto

Al permitir eliminar tickets hacía falta decidir si el registro desaparece de la
base o solo de las vistas.

## Decisión

Borrado lógico: `deletedAt` y `deletedById`. El ticket sale de todos los
listados, métricas y exportaciones, pero el registro permanece.

## Por qué

Un ticket es evidencia de trabajo. Que alguien pueda hacerlo desaparecer sin
rastro es justo lo que no se quiere en un sistema donde se mide desempeño por
SLA. Con borrado lógico queda quién lo eliminó y cuándo, y un `SUPERADMIN` puede
revisarlo.

## Qué se pierde

Las consultas cargan un `deletedAt: null` en todas partes; olvidarlo mostraría
tickets borrados. Por eso el filtro está en `hotel-scope.ts` como constante
`notDeleted` y no escrito a mano en cada consulta, y hay un test que verifica que
los listados y los contadores lo excluyan.

Tampoco libera espacio. Para el volumen de este sistema es irrelevante.
