# Matriz de permisos

Toda esta matriz se resuelve en un solo archivo: [`src/lib/auth/can.ts`](../src/lib/auth/can.ts).
Ningún componente decide por su cuenta qué puede ver alguien, y ninguna acción
confía en que la UI ya haya ocultado el botón — los Server Actions son el
equivalente a endpoints públicos y validan del lado del servidor.

La cobertura de esta matriz está en [`tests/unit/can.test.ts`](../tests/unit/can.test.ts)
y [`tests/integration/tickets.test.ts`](../tests/integration/tickets.test.ts).

## Los dos ejes

El sistema separa **dónde** trabaja alguien de **qué tan lejos** llega:

- **Nivel por hotel** (`UserHotelAccess.permissionLevel`): `STAFF` o `ADMIN`, en
  cada propiedad por separado. Alguien puede ser `ADMIN` en dos hoteles y no
  tener acceso a un tercero.
- **Alcance corporativo** (`User.corporateRole`): `NONE`, `CORPORATE_ADMIN` o
  `SUPERADMIN`. Cubre **todos** los hoteles de su organización automáticamente,
  incluidos los que se den de alta después.

`PLATFORM_OWNER` (`User.isPlatformOwner`) queda fuera de los dos: opera el
producto, no es cliente.

## Matriz

✅ puede · ⚠️ solo si se le otorga · ❌ no puede · — no aplica

| Acción | STAFF | ADMIN | CORPORATE&nbsp;ADMIN | SUPERADMIN | PLATFORM&nbsp;OWNER |
|---|:---:|:---:|:---:|:---:|:---:|
| **Tickets** | | | | | |
| Ver tickets de su departamento | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ver todos los tickets del hotel | ❌ | ✅ | ✅ | ✅ | ❌ |
| Crear ticket | ✅ | ✅ | ✅ | ✅ | ❌ |
| Cambiar estatus y prioridad | ✅¹ | ✅ | ✅ | ✅ | ❌ |
| Reasignar o mover de departamento | ❌ | ✅ | ✅ | ✅ | ❌ |
| Comentar y adjuntar fotos | ✅¹ | ✅ | ✅ | ✅ | ❌ |
| Etiquetar insumos usados | ✅¹ | ✅ | ✅ | ✅ | ❌ |
| **Eliminar ticket** | ❌² | ⚠️³ | ⚠️⁴ | ✅ | ❌ |
| **Catálogos del hotel** | | | | | |
| Crear y editar departamentos | ❌ | ✅ | ✅ | ✅ | ❌ |
| Administrar habitaciones | ❌ | ✅ | ✅ | ✅ | ❌ |
| Administrar catálogo de insumos | ❌ | ✅ | ✅ | ✅ | ❌ |
| Plantillas de tickets recurrentes | ❌ | ✅ | ✅ | ✅ | ❌ |
| **Huéspedes y operación** | | | | | |
| Alta de huéspedes y reservas | ✅ | ✅ | ✅ | ✅ | ❌ |
| Imprimir códigos QR | ✅ | ✅ | ✅ | ✅ | ❌ |
| Dejar notas de cambio de turno | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Usuarios** | | | | | |
| Invitar usuarios a su hotel | ❌ | ✅ | ✅ | ✅ | ❌ |
| Cambiar nivel dentro de su hotel | ❌ | ✅ | ✅ | ✅ | ❌ |
| Asignar alcance corporativo | ❌ | ❌ | ❌ | ✅ | ❌ |
| Otorgar o revocar el borrado de tickets | ❌ | ❌ | ❌ | ✅ | ❌ |
| Desactivar una cuenta | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Organización** | | | | | |
| Dar de alta un hotel | ❌ | ❌ | ❌ | ✅ | ❌ |
| Suspender o reactivar un hotel | ❌ | ❌ | ❌ | ✅ | ❌ |
| Ver reportes de su hotel | ✅ | ✅ | ✅ | ✅ | ❌ |
| Reporte de insumos entre propiedades | ❌ | ⚠️⁵ | ✅ | ✅ | ❌ |
| Exportar a Excel | ✅¹ | ✅ | ✅ | ✅ | ❌ |
| Contratar y administrar la suscripción | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Plataforma** | | | | | |
| Ver organizaciones cliente y MRR | ❌ | ❌ | ❌ | ❌ | ✅ |
| Editar precios y periodo de prueba | ❌ | ❌ | ❌ | ❌ | ✅ |
| Publicar términos y privacidad | ❌ | ❌ | ❌ | ❌ | ✅ |
| Ver datos operativos de un cliente | ❌ | — | — | — | **❌** |

---

¹ Solo sobre tickets de su departamento o asignados a él. Su exportación a Excel
sale filtrada igual: no obtiene el tablero completo del hotel.

² **Sin excepción y sin posibilidad de que se le otorgue.** Bajar a alguien de
`ADMIN` a `STAFF` revoca el permiso automáticamente. En la pantalla de usuarios
un `STAFF` muestra un guion, no un interruptor apagado: el permiso no está en
off, es que no aplica.

³ Vía `UserHotelAccess.canDeleteTickets`, **por hotel**. El mismo `ADMIN` puede
tenerlo en una propiedad y no en otra.

⁴ Vía `User.canDeleteTickets`, y aplica a todos los hoteles de su organización.

⁵ Cualquiera con acceso a **más de un hotel** con nivel `ADMIN`. El gerente
regional de 2 o 3 propiedades tiene el mismo problema de compra en volumen que
el corporativo; el reporte se le da a quien lo necesita, no según el título.

---

## Aislamiento entre organizaciones

Es el límite más crítico del sistema. Un error entre hoteles filtra datos dentro
de una misma empresa; un error entre organizaciones los filtra entre empresas que
no se conocen.

Toda consulta escopada pasa por [`src/lib/hotel-scope.ts`](../src/lib/hotel-scope.ts).
`requireHotelContext` valida en este orden:

1. Hay sesión.
2. El hotel está entre los accesibles del usuario — lo que ya implica que es de
   **su** organización.
3. La suscripción del cliente permite operar.
4. La propiedad no está suspendida.

Ningún Server Action construye filtros de `hotelId` a mano.

## Separación de la plataforma

Un `PLATFORM_OWNER` **no** tiene acceso a los tickets, huéspedes ni insumos de
ningún cliente. Es una decisión de diseño, no un pendiente: un proveedor de SaaS
multi-cliente no debería poder entrar casualmente a los datos operativos de sus
clientes, solo a lo necesario para operar el licenciamiento.

Verificado en ambos sentidos en [`e2e/auth.spec.ts`](../e2e/auth.spec.ts): la
cuenta de plataforma recibe 404 en el área de cualquier cliente, y un
`SUPERADMIN` de cliente recibe 404 en el área de plataforma.
