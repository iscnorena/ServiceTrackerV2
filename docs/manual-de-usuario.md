# Manual de usuario

Una página por rol. Cada quien lee la suya.

Al entrar, el sistema lleva a donde corresponde: con una sola propiedad se entra
directo a ella, con varias aparece el selector, y una cuenta de plataforma
aterriza en su propio panel.

El idioma se cambia desde el ícono de idioma en la barra superior y queda
guardado para la próxima sesión — incluidos los correos que recibas.

---

## Staff

Eres quien atiende los requerimientos en piso.

### Tu pantalla de inicio

Ves **tus tickets**: los de tu departamento y los que te asignaron
personalmente, ordenados por el SLA más próximo a vencer. Arriba, los contadores
del día. Abajo a la derecha, las últimas notas de turno de tu área.

Los tickets con **SLA vencido** llevan borde rojo, ícono de alerta y la palabra
"Vencido". Nunca dependen solo del color.

### Atender un ticket

Al abrirlo verás, en la columna derecha, **el contacto de esa habitación**: el
nombre y teléfono de quien está ahí, no el de quien hizo la reserva. El teléfono
es un enlace: desde el celular marca directo.

Lo que puedes hacer:

- **Cambiar el estatus** conforme avanzas: Pendiente → En proceso → Resuelto.
- **Comentar.** Los comentarios son internos, de staff a staff. El huésped nunca
  los ve. Sirven para "falta refacción, llega mañana".
- **Adjuntar fotos** del problema y del trabajo terminado.
- **Etiquetar los insumos que usaste** al resolver. Toma diez segundos y es lo
  que después permite detectar qué se repone constantemente entre propiedades.

Lo que no puedes: reasignar a otra persona, mover el ticket de departamento, ni
eliminarlo. Eso es de administración.

### Crear un ticket

Botón "Nuevo ticket". Tu departamento viene fijo. Si es de una habitación,
selecciónala para que quede enganchado el contacto correcto.

### Dejar contexto al turno siguiente

En **Notas de turno**. No está atado a ningún ticket: es para lo que se pierde
en el cambio de turno. "El 210 pidió toallas extra, aún no se les lleva."

---

## Admin de hotel

Todo lo del staff, sobre todos los departamentos de tu propiedad.

### Lo que agrega tu inicio

- **Tickets sin asignar**, esperando que alguien los tome.
- **SLA vencido agrupado por departamento**, para ver dónde se está atorando.

### Departamentos

`Administración → Departamentos`. Puedes crear los que necesites; aparecen de
inmediato en los formularios de ticket y de usuarios, sin esperar nada.

Dos campos importan:

- **SLA base en minutos**: el tiempo esperado para prioridad Alta. Media se
  multiplica por 2 y Baja por 4. Con SLA base de 30 minutos, un ticket Alto vence
  en 30, uno Medio en 60 y uno Bajo en 120. Déjalo vacío si el área no maneja SLA.
- **Afecta el estatus de la habitación**: actívalo en Mantenimiento. Al abrir un
  ticket la habitación pasa a mantenimiento, y solo vuelve a la normalidad cuando
  se cierran **todos** los tickets que la tienen bloqueada.

### Usuarios

`Administración → Usuarios`. Invitas por correo: la persona recibe un link y
define su propia contraseña. Nadie asigna contraseñas a nombre de otro.

Puedes cambiar el nivel y el departamento de cada quien directo en la tabla.

### Habitaciones y códigos QR

`Habitaciones`. El botón **Imprimir todos los QR** genera una hoja por
habitación, con el número en grande y la dirección en texto plano debajo del
código. Esa dirección es el respaldo: si el código se despega o queda borroso,
el huésped puede teclearla.

### Mantenimiento preventivo

`Administración → Recurrentes`. Defines una plantilla — "Revisión de A/C",
mensual — y el sistema genera el ticket real en cada ciclo. No hay que acordarse.

### Reportes

`Reportes`: cumplimiento de SLA, tiempo promedio de resolución y tickets por
departamento. El botón de Excel exporta **exactamente lo que estás viendo**, con
los filtros que tengas puestos.

---

## Admin de varias propiedades

Si administras dos o tres hoteles sin ser corporativo, tienes todo lo anterior en
cada uno, más dos cosas:

- **Selector de hotel** en la barra lateral. Al cambiar de propiedad conserva la
  sección donde estabas: si estabas viendo tickets, sigues viendo tickets.
- **Reporte de insumos recurrentes** entre tus propiedades. No es exclusivo del
  corporativo: tienes el mismo problema de compra en volumen, a menor escala.

---

## Admin corporativo

Ves **todos los hoteles de tu organización** automáticamente, incluidos los que
se den de alta después. No hay que asignarte propiedad por propiedad.

### Insumos recurrentes

`Corporativo → Insumos recurrentes`. Es el reporte que motivó el sistema:
detectar que las pilas AA o los controles de TV se reponen constantemente en
varias propiedades, para comprar en volumen en vez de hotel por hotel.

**Lee esto antes de decidir una compra.** Cada hotel nombra sus insumos a su
manera, así que el reporte agrupa por nombre normalizado — sin mayúsculas, sin
acentos, sin espacios de más. Eso une "Pilas AA" con "PILAS AA", pero **no** une
"Toallas de baño" con "Toallas grandes": son palabras distintas y ninguna
normalización puede saber que es lo mismo.

Por eso cada fila se abre a un desglose por hotel con el nombre exacto que
capturó cada uno. Ábrelo y verifica que de verdad se trate del mismo insumo antes
de mandar la orden.

Filtras por rango de fechas, por propiedades específicas y por cuántas veces
tiene que repetirse para considerarlo recurrente. El botón de Excel exporta el
resumen y el desglose en hojas separadas.

### Comparativo entre propiedades

En `Reportes` de cualquier hotel aparece la tabla comparativa: tickets, SLA
vencido, cumplimiento y tiempo promedio de cada propiedad, para ver cuál resuelve
más rápido y cuál se está atorando.

---

## Superadmin

Todo lo del corporativo, más el control de la organización.

### Hoteles

`Corporativo → Hoteles`. Das de alta propiedades nuevas.

**Suspender** un hotel lo deja fuera de operación y de la facturación, pero **no
borra nada**. Sus datos se conservan y se puede reactivar. Sirve para una
propiedad que cierra por temporada.

Durante el periodo de prueba hay un límite de propiedades. Al alcanzarlo, el
sistema te lleva a la pantalla de contratación.

### Usuarios de la organización

`Corporativo → Usuarios`. Aquí promueves a alguien a corporativo, desactivas
cuentas y otorgas el permiso sensible.

**El permiso de eliminar tickets.** Tú siempre puedes. Nadie más puede por
defecto: hay que otorgárselo explícitamente, con confirmación. Para un admin de
hotel el permiso es **por propiedad** — puede tenerlo en una y no en otra.

Un miembro del staff **nunca** puede eliminar tickets, y no es algo que se le
pueda otorgar. En la tabla verás un guion en vez de un interruptor: no está
apagado, es que no aplica.

Eliminar un ticket no lo borra de verdad: desaparece de las listas pero queda
registrado quién lo eliminó y cuándo.

### Facturación

`Corporativo → Facturación`. Se cobra por hotel activo. Al dar de alta o
suspender una propiedad, el cobro se ajusta solo y se prorratea el periodo en
curso.

Si la tarifa de lista sube después de que contrataste, **a ti no te sube**: se
conserva el precio con el que te suscribiste.

---

## Cuenta de plataforma

Operas el producto, no eres cliente.

`Plataforma → Organizaciones` muestra los clientes, su estatus de suscripción y
el MRR estimado. `Configuración` edita el precio por hotel, la moneda, los días
de prueba y cuántas propiedades permite. Los cambios aplican a clientes nuevos;
los que ya pagan conservan su precio.

`Legal` es el editor de términos y aviso de privacidad, con vista previa y
versión por idioma. **Publicar nunca sobreescribe**: crea una versión nueva y
conserva las anteriores, por si alguna vez hay que demostrar qué términos estaban
vigentes en una fecha.

**No tienes acceso a los tickets, huéspedes ni insumos de ningún cliente.** No es
un pendiente: es a propósito. Quien provee el software no debería poder entrar
casualmente a los datos operativos de quienes lo usan.

---

## Para el huésped

No necesita cuenta ni instalar nada.

Escanea el código QR de su habitación, elige de qué se trata en tres botones
grandes, escribe qué pasó y envía. El sistema ya sabe en qué cuarto está y a
quién avisarle.

El reporte llega al tablero del staff etiquetado como **"Reportado por huésped"**,
para que se note que no vino de un compañero sino del cliente.
