# 012 — QR imprimible como HTML, no como PDF generado

**Estado**: aceptada

## Contexto

El plan especificaba `@react-pdf/renderer` para generar el PDF con el QR de cada
habitación, una por página, con el número de cuarto y la URL en texto plano.

## Decisión

Una página con CSS de impresión (`habitaciones/imprimir`) en vez de generar el
PDF en el servidor. El navegador imprime o guarda como PDF.

## Por qué

El resultado es el mismo archivo, y sale en el idioma que el usuario tiene
activo sin mantener una segunda plantilla aparte. Generar el PDF en servidor
implicaría duplicar el diseño en el vocabulario de react-pdf y traducirlo por
separado.

Además evita una dependencia pesada para una pantalla que se usa una vez, al
instalar los códigos.

## Qué se pierde

No hay un endpoint que devuelva el PDF directo, así que no se puede enviar por
correo ni generar en un cron sin un navegador. No hace falta hoy.

El requisito de fondo sí se cumple: una habitación por página, el número en
grande, y la URL en texto plano debajo del código para teclearla a mano cuando el
QR no escanea — que es justamente el caso que motivó el requisito.
