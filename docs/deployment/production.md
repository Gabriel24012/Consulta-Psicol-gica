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
8. Configurar certificados TLS. Cuando el certificado de Let's Encrypt ya exista, adaptar `infra/nginx/default.https.conf.example` con el dominio real y usarlo como `infra/nginx/default.conf`.
9. Activar backups de MongoDB Atlas.
10. Revisar logs sin exponer datos clinicos.

## Hardening

- Usar HTTPS obligatorio y redirigir HTTP a HTTPS cuando el certificado este instalado.
- Restringir CORS al dominio real; nunca desplegar produccion con `WEB_ORIGIN=http://localhost:4200`.
- No subir `.env` real al repositorio y no usar secretos de ejemplo.
- Generar secretos largos y unicos para `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `FIELD_ENCRYPTION_KEY`, `REDIS_PASSWORD` y `WHATSAPP_VERIFY_TOKEN`.
- Configurar `NODE_ENV=production`, `WEB_PUBLIC_URL` con el dominio real y `COOKIE_DOMAIN` solo si se usan subdominios compartidos.
- Abrir en firewall solo 80/443 hacia internet; MongoDB Atlas debe permitir solo la IP del servidor y Redis no debe exponerse fuera de Docker.
- Activar backups de MongoDB Atlas antes de operar con pacientes reales.
- Rotar secretos periodicamente y despues de cualquier sospecha de exposicion.
- Habilitar alertas de disponibilidad y revisar logs sin registrar datos clinicos, mensajes privados, tokens ni contrasenas.
- No subir documentos clinicos innecesarios hasta definir backup, retencion y borrado seguro.
- Los filtros de tipo MIME/extension en materiales reducen riesgo, pero no reemplazan un antivirus o escaneo de malware si se aceptan archivos de terceros.
