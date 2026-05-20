# Despliegue En Servidor Propio

## Requisitos

- Dominio apuntando al servidor.
- Docker y Docker Compose instalados.
- HTTPS con Let's Encrypt.
- MongoDB Atlas accesible desde el servidor.
- Variables `.env` con secretos robustos.

## Pasos

1. Configurar `.env` de producción.
2. Cambiar `WEB_ORIGIN` al dominio real.
3. Configurar `WHATSAPP_MODE=meta` y credenciales de Meta Cloud API.
4. Ejecutar `docker compose -f infra/docker/docker-compose.prod.yml up -d --build`.
5. Configurar certificados TLS.
6. Activar backups de MongoDB Atlas.
7. Revisar logs sin exponer datos clínicos.

## Hardening

- Usar HTTPS obligatorio.
- Restringir CORS al dominio real.
- Rotar secretos periódicamente.
- Habilitar alertas de disponibilidad.
- Proteger el servidor con firewall.
