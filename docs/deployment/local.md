# Desarrollo Local

1. Copiar `.env.example` a `.env`.
2. Configurar `MONGODB_URI` con un cluster de MongoDB Atlas de desarrollo.
3. Mantener `WHATSAPP_MODE=mock` mientras se trabaja en localhost.
4. Ejecutar `npm install`.
5. Levantar Redis con `docker compose -f infra/docker/docker-compose.dev.yml up -d redis`.
6. Ejecutar `npm run dev`.

## Admin inicial

El primer usuario admin debe sembrarse manualmente o con un script de seed antes de operar. En producción no debe existir una ruta pública para crear administradores.
