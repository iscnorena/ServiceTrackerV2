# 003 — Enums en inglés neutral desde el diseño

**Estado**: aceptada

## Contexto

El sistema es bilingüe desde el arranque, con más idiomas posibles después.

## Decisión

Todos los enums se guardan con códigos en inglés neutral: `PENDING`, `HIGH`,
`RESOLVED`. La traducción vive únicamente en los archivos de mensajes de
next-intl.

## Por qué

Si el estatus se guardara como `"PENDIENTE"`, agregar inglés obligaría a
traducir lo ya almacenado — una migración de datos por cada idioma nuevo. Es un
error barato de evitar al inicio y caro de corregir después.

Agregar un idioma ahora significa crear `messages/{locale}.json` y registrarlo en
`lib/i18n/routing.ts`. Cero cambios en componentes o lógica de negocio. Si
agregar un idioma requiriera tocar un componente, algo se escribió a mano y hay
que corregirlo.

## Qué se pierde

Nada en la práctica. Lo que **no** aplica es el contenido que escribe el usuario:
el nombre de un departamento o de un insumo queda en el idioma que cada hotel
prefiera y no se traduce. Traducir contenido generado por usuarios está fuera de
alcance.
