# 006 — El estatus del ticket es fijo, no catálogo dinámico

**Estado**: aceptada

## Contexto

Los departamentos pasaron de ser un enum fijo a un catálogo administrable. La
pregunta natural es si el estatus del ticket debería seguir el mismo camino.

## Decisión

No. `TicketStatus` sigue siendo un enum cerrado: `PENDING`, `IN_PROGRESS`,
`RESOLVED`, `CANCELLED`.

## Por qué

Los departamentos son **datos**: agregar "Teléfonos" no cambia cómo se comporta
el sistema. El estatus es **lógica**: define las columnas del Kanban, cuándo se
sella `resolvedAt`, cuándo deja de correr el reloj del SLA y cuándo una
habitación vuelve de mantenimiento.

Volverlo dinámico obligaría a que cada estatus declarara su semántica —
¿"cuenta como cerrado"?, ¿"detiene el SLA"? — y eso es reconstruir un enum con
más pasos y menos garantías del compilador.

## Qué se pierde

Un hotel que quiera un estatus propio, digamos "Esperando refacción", no puede
agregarlo. En la práctica eso se resuelve con `IN_PROGRESS` más un comentario
interno, que además deja rastro de quién lo dijo y cuándo.
