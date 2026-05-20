# Plataforma Web Profesional Para Psicólogo

Monorepo full-stack para una plataforma de agenda, comunicación privada, CRM clínico-administrativo y notificaciones para un psicólogo.

## Stack

- `apps/api`: NestJS, MongoDB Atlas, JWT, Socket.IO, BullMQ/Redis, WhatsApp Cloud API.
- `apps/web`: Angular standalone, SCSS, UI responsiva rosa pastel profesional.
- `packages/shared`: tipos compartidos.
- `infra`: Docker Compose y Nginx para despliegue.

## Desarrollo local

1. Copia `.env.example` a `.env` y configura `MONGODB_URI`.
2. Instala dependencias:

```bash
npm install
```

3. Levanta Redis:

```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d redis
```

4. Inicia API y web:

```bash
npm run dev
```

API: `http://localhost:3000`

Web: `http://localhost:4200`

## Crear admin inicial

Configura `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` y `ADMIN_PHONE` en `.env`, luego ejecuta:

```bash
npm --workspace apps/api run seed:admin
```

Si cambias `ADMIN_PASSWORD` después de crear el admin, actualiza la contraseña en MongoDB:

```bash
npm --workspace apps/api run reset:admin-password
```

## Seguridad

Este proyecto maneja datos sensibles. Antes de producción configura HTTPS, secretos robustos, backups de MongoDB Atlas, llaves de cifrado reales y aviso de privacidad validado legalmente.
