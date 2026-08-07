# 001 — Next.js full-stack en vez de backend separado

**Estado**: aceptada

## Contexto

La V1 era PHP puro. Para la V2 había que elegir entre un backend separado
(Laravel o Node) con un frontend React aparte, o una sola aplicación full-stack.

## Decisión

Una sola aplicación de Next.js 15 con App Router. La escritura va por Server
Actions y no por una API REST propia.

## Por qué

El único consumidor de los datos es esta misma interfaz. Una API REST separada
implicaría mantener contratos, versionado y una capa de serialización para nadie
más que uno mismo — trabajo real sin beneficio real.

Los Server Actions además obligan a algo sano: como son el equivalente a
endpoints públicos, la validación de permisos tiene que estar en el servidor por
fuerza. No hay forma de "protegerse" ocultando un botón.

## Qué se pierde

Si algún día hace falta una app móvil nativa o una integración de terceros, habrá
que exponer endpoints. No es un rediseño: la lógica ya vive en `lib/`, escopada y
con permisos resueltos; lo que faltaría es la capa HTTP encima.

Se documenta la excepción que ya existe: los webhooks de Stripe y los cron jobs
**sí** son Route Handlers, porque los llama un tercero.
