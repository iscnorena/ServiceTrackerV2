# 008 — `Guest` separado de `RoomStay`

**Estado**: aceptada

## Contexto

Un huésped puede reservar varias habitaciones a su nombre — un grupo, un evento
corporativo. El titular no está físicamente en todas.

## Decisión

`Guest` es el titular de la reserva. `RoomStay` es la ocupación puntual de UNA
habitación dentro de esa reserva, con su **propia** persona de contacto. Los
tickets se relacionan con `RoomStay`, nunca con `Guest`.

## Por qué

Es la decisión que resuelve el problema real de la operación. Cuando alguien de
mantenimiento va a la 305, necesita el nombre y teléfono de quien está **en la
305**, no del ejecutivo que reservó las tres habitaciones y está en otro piso.

Modelar el contacto en `Guest` obligaría a llamar al titular para cada cuarto, o
a crear un huésped falso por habitación y perder la noción de que es una sola
reserva.

## Qué se pierde

Una entidad más y una captura más al dar de alta la reserva. El formulario lo
compensa proponiendo el nombre del titular como contacto por defecto, que es lo
correcto en la mayoría de las reservas de una sola habitación.

Consecuencia: el reporte por QR resuelve el contacto desde el `qrSlug` sin que el
huésped indique nada. Y por eso mismo se rechaza traslapar dos ocupaciones del
mismo cuarto — con dos activas no se sabría a cuál pertenece el reporte.
