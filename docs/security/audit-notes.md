# Notas De Auditoria De Dependencias

`npm audit --omit=dev` reporto 30 vulnerabilidades de produccion: 11 high y 19 moderate. Varias requieren saltos mayores de Angular y NestJS para resolverse automaticamente.

## Recomendacion

Antes de produccion:

1. Actualizar Angular a la rama estable mas reciente compatible.
2. Actualizar NestJS y paquetes oficiales relacionados en bloque.
3. Recompilar y ejecutar pruebas funcionales de auth, agenda, chat y notificaciones.
4. Ejecutar nuevamente `npm audit --omit=dev`.
5. No usar `npm audit fix --force` sin revisar cambios rompientes.

El build actual queda funcional para desarrollo local, pero el hardening de dependencias debe cerrarse antes de operar con pacientes reales.

## Hardening Inmediato Aplicado

- Helmet, CSP, `trust proxy`, limites de body y cookies centralizadas en la API.
- Rate limit global y limites mas estrictos para login, registro, refresh, invitaciones y webhook publico.
- Redis puede protegerse con `REDIS_PASSWORD` en produccion.
- Nginx incluye headers de seguridad, limite de carga de 25 MB, timeouts y un ejemplo HTTPS con redireccion.
- Las descargas de materiales siguen pasando por autenticacion y usan `Content-Disposition` sanitizado por Express.
