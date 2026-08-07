# 010 — La sesión no guarda el rol

**Estado**: aceptada

## Contexto

Lo habitual con JWT es meter el rol en el token y leerlo de ahí, evitando una
consulta por request.

## Decisión

El token guarda solo el id del usuario. Rol, organización y hoteles accesibles se
leen de la base en cada request, memoizados por request con `cache` de React.

## Por qué

Con el rol en el token, revocar un permiso no surte efecto hasta que la sesión
expire. Alguien a quien se le quitó el borrado de tickets seguiría pudiendo
borrarlos durante horas, y peor: alguien desactivado seguiría entrando.

Para un sistema donde los permisos son el punto sensible, esa ventana no vale la
consulta que ahorra.

## Qué se pierde

Una consulta a la base por request. Es una lectura por id con índice, memoizada
dentro del request, contra una aplicación que ya consulta datos en cada pantalla.

Consecuencia positiva: `lib/auth.ts` no necesita callbacks que sincronicen el
token cuando cambian los permisos, que es una fuente clásica de bugs sutiles.
