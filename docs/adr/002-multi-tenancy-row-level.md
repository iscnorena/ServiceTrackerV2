# 002 — Multi-tenancy row-level, no una base por cliente

**Estado**: aceptada

## Contexto

Varios corporativos distintos comparten la misma instalación. Las dos opciones
habituales son una base de datos por cliente, o una sola base donde cada fila
lleva a qué cliente pertenece.

## Decisión

Row-level: una sola base de datos. `Organization` es el límite de aislamiento
principal y `Hotel` el segundo.

## Por qué

ServiceTracker es un SaaS operacional — tickets y habitaciones. Row-level con
buen scoping es el patrón estándar en ese terreno y es mucho más simple de operar
en un entorno serverless, donde una base por cliente implicaría un pool de
conexiones por cliente.

Vale contrastarlo con el caso opuesto: para un sistema de fianzas, con requisitos
de aislamiento más estrictos y menos clientes, *database-per-tenant* sería la
elección correcta. El patrón depende del contexto, no hay un default universal.

## Qué se pierde

El riesgo se concentra en un punto: una consulta sin filtrar no mezcla hoteles de
un mismo cliente, mezcla **empresas distintas**.

La mitigación es estructural, no de disciplina: todo pasa por
`lib/hotel-scope.ts`, y hay tests de integración que intentan explícitamente
leer y escribir datos de otra organización y verifican que fallen.
