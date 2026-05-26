# Despliegue Temporal Por IP

Este modo permite validar el servidor antes de tener dominio y certificado HTTPS. Es temporal: no uses pacientes reales, documentos clinicos reales ni mensajes privados sensibles mientras el acceso sea por HTTP.

## Variables `.env`

En el servidor, configura `.env` con la IP publica:

```env
NODE_ENV=production
PORT=3000
BODY_LIMIT=1mb

WEB_ORIGIN=http://IP_DEL_SERVIDOR
WEB_PUBLIC_URL=http://IP_DEL_SERVIDOR
COOKIE_DOMAIN=
COOKIE_SECURE=false

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=CAMBIA_ESTA_CLAVE_LARGA

JWT_ACCESS_SECRET=CAMBIA_ESTE_SECRETO_LARGO
JWT_REFRESH_SECRET=CAMBIA_ESTE_OTRO_SECRETO_LARGO
FIELD_ENCRYPTION_KEY=CAMBIA_ESTA_LLAVE_BASE64_DE_32_BYTES
WHATSAPP_VERIFY_TOKEN=CAMBIA_ESTE_TOKEN
```

Mantén `MONGODB_URI`, `ADMIN_*`, `APPOINTMENT_*` y `WHATSAPP_*` con los valores reales que ya use el servidor.

## Nginx Por IP

Usa la configuracion HTTP temporal:

```bash
cp infra/nginx/default.ip.conf.example infra/nginx/default.conf
```

En esta fase no necesitas montar certificado. Puedes dejar el puerto 443 sin uso, pero en firewall solo abras SSH y HTTP.

## Firewall Minimo

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw enable
ufw status
```

Redis y API no deben publicar puertos hacia internet; solo Nginx expone el servicio web. En MongoDB Atlas, permite solo la IP publica del servidor.

## Actualizar Y Levantar

```bash
cd /ruta/del/proyecto/Consulta-Psicol-gica
git pull origin master
docker compose -f infra/docker/docker-compose.prod.yml config
docker compose -f infra/docker/docker-compose.prod.yml up -d --build
docker compose -f infra/docker/docker-compose.prod.yml ps
```

Revisa logs:

```bash
docker compose -f infra/docker/docker-compose.prod.yml logs -f api nginx redis
```

## Validaciones

- Abrir `http://IP_DEL_SERVIDOR`.
- Probar registro/login/logout con usuario de prueba.
- Confirmar que refresh mantiene sesion despues de recargar.
- Probar agenda, mensajes y notificaciones con datos ficticios.
- Probar subida y descarga de material ficticio.
- Revisar `http://IP_DEL_SERVIDOR/api/health`.

## Cuando Llegue El Dominio

1. Apunta el dominio a la IP del servidor.
2. Instala o renueva Let's Encrypt.
3. Cambia `.env`:

```env
WEB_ORIGIN=https://tu-dominio.com
WEB_PUBLIC_URL=https://tu-dominio.com
COOKIE_SECURE=true
COOKIE_DOMAIN=
```

4. Adapta `infra/nginx/default.https.conf.example` con el dominio real y usalo como `infra/nginx/default.conf`.
5. Levanta Nginx:

```bash
docker compose -f infra/docker/docker-compose.prod.yml up -d --build nginx
```

Desde ese momento puedes planear uso real, con backups activos y sin secretos de ejemplo.
