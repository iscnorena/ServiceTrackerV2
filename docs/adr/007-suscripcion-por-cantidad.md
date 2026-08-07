# 007 — Una suscripción por cliente con cantidad variable

**Estado**: aceptada

## Contexto

Se cobra por hotel. Con Stripe caben dos formas: una suscripción por cada hotel,
o una sola suscripción por cliente cuya cantidad sea el número de hoteles.

## Decisión

Una sola suscripción por `Organization`, con `quantity` igual al número de
hoteles con licencia activa. Al dar de alta o suspender una propiedad se ajusta
la cantidad y Stripe prorratea el periodo en curso.

## Por qué

Es el patrón estándar de precio por unidad. Con N suscripciones sueltas habría
que reconciliar N estados por cliente, N webhooks y N fechas de corte, y una
factura ilegible.

## Qué se pierde

No se puede tener un precio distinto por hotel dentro del mismo cliente. No hace
falta: el precio es plano por diseño.

Decisión relacionada — **el precio se congela por cliente**. Al contratar se
guarda `pricePerHotelSnapshot`. Si después cambia la tarifa de lista, aplica a
clientes nuevos y no a los que ya pagan. Es la práctica estándar y evita el peor
correo posible: avisarle a un cliente que le subió el precio sin que él hiciera
nada.
