# 009 — Catálogo de insumos por hotel, no global

**Estado**: aceptada

## Contexto

El reporte corporativo de insumos recurrentes es el caso de uso que originó el
proyecto: detectar que las pilas AA se reponen constantemente en varias
propiedades para comprar en volumen. Un catálogo global lo haría trivial.

## Decisión

Cada hotel administra su propio catálogo. La agregación entre propiedades agrupa
por **nombre normalizado**: minúsculas, sin acentos, sin espacios de más.

## Por qué

Un catálogo global obligaría a que alguien lo curara y a que cada hotel pidiera
permiso para dar de alta un insumo. En una operación hotelera real eso no ocurre:
o se captura libre, o no se captura.

## Qué se pierde

Y aquí está lo importante: **la agrupación es una aproximación, no una
coincidencia exacta.** Normalizar une "Pilas AA", "PILAS AA" y "Pilas  AA", pero
no puede unir "Toallas de baño" con "Toallas grandes" — son palabras distintas.

Por eso el reporte muestra la advertencia arriba y no en letra chica, y cada fila
se despliega al desglose por hotel con el nombre exacto que capturó cada uno.
Quien lo lee está por decidir una compra y necesita poder verificarlo a ojo.

El seed de demo incluye los dos casos a propósito: tres insumos que sí se agrupan
y un sinónimo real que no, para que la limitación se vea en la demo en vez de
esconderse.

Si el ruido llegara a ser demasiado, la salida sería un catálogo global opcional
con alias por hotel. Queda fuera de alcance.
