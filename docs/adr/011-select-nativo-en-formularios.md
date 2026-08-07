# 011 — `<select>` nativo en formularios

**Estado**: aceptada

## Contexto

shadcn/ui incluye un componente Select construido sobre Base UI. Los formularios
del sistema tienen muchos desplegables: departamento, prioridad, habitación,
responsable, frecuencia.

## Decisión

Un `<select>` nativo estilizado (`components/native-select.tsx`) en los
formularios. El Select de shadcn queda disponible para casos que lo necesiten.

## Por qué

El nativo ya trae navegación por teclado, búsqueda escribiendo, y el selector del
sistema operativo en móvil. Eso último importa: el staff opera desde tablet y
celular, y el control nativo es el que mejor funciona ahí.

Un desplegable reconstruido tiene que reimplementar todo eso, y cada
reimplementación es una oportunidad de romper accesibilidad.

## Qué se pierde

No se puede poner contenido enriquecido en las opciones — íconos, dos líneas de
texto. Ninguno de los desplegables de este sistema lo necesita.

Nota relacionada: el plan pedía usar shadcn tal cual. Esta es una desviación
deliberada, igual que la de `CardTitle`, que se cambió para renderizar un
elemento de encabezado en vez de un `div` — sin eso las pantallas de login y
registro no tenían ningún encabezado y quedaban sin esquema navegable para un
lector de pantalla. Lo encontró la suite E2E.
