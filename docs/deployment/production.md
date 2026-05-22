# Despliegue En Servidor Propio

## Requisitos

- Dominio apuntando al servidor.
- Docker y Docker Compose instalados.
- HTTPS con Let's Encrypt.
- MongoDB Atlas accesible desde el servidor.
- Variables `.env` con secretos robustos.

## Pasos

1. Configurar `.env` de produccion.
2. Cambiar `WEB_ORIGIN` al dominio real.
3. Configurar `WHATSAPP_MODE=meta` y credenciales de Meta Cloud API: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_VERIFY_TOKEN`.
4. Crear y aprobar una plantilla de WhatsApp para recordatorios. Por defecto el sistema usa `WHATSAPP_APPOINTMENT_REMINDER_TEMPLATE=appointment_reminder` y `WHATSAPP_TEMPLATE_LANGUAGE=es_MX`.
5. La plantilla debe recibir variables en este orden: nombre del paciente, nombre del psicologo, fecha, hora y ubicacion.
6. Configurar `APPOINTMENT_LOCATION` con la direccion del consultorio o enlace de sesion online y `APPOINTMENT_TIMEZONE=America/Mexico_City`.
7. Ejecutar `docker compose -f infra/docker/docker-compose.prod.yml up -d --build`.
8. Configurar certificados TLS.
9. Activar backups de MongoDB Atlas.
10. Revisar logs sin exponer datos clinicos.

## Hardening

- Usar HTTPS obligatorio.
- Restringir CORS al dominio real.
- Rotar secretos periodicamente.
- Habilitar alertas de disponibilidad.
- Proteger el servidor con firewall.
