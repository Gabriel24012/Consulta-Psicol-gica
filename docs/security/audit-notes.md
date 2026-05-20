# Notas De Auditoría De Dependencias

`npm audit --omit=dev` reportó vulnerabilidades que requieren saltos mayores de Angular y NestJS para resolverse automáticamente.

## Recomendación

Antes de producción:

1. Actualizar Angular a la rama estable más reciente compatible.
2. Actualizar NestJS y paquetes oficiales relacionados en bloque.
3. Recompilar y ejecutar pruebas funcionales de auth, agenda, chat y notificaciones.
4. Ejecutar nuevamente `npm audit --omit=dev`.
5. No usar `npm audit fix --force` sin revisar cambios rompientes.

El build actual queda funcional para desarrollo local, pero el hardening de dependencias debe cerrarse antes de operar con pacientes reales.
