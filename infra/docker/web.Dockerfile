FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install
COPY . .
RUN npm --workspace apps/web run build

FROM nginx:1.27-alpine
COPY --from=build /app/apps/web/dist/web/browser /usr/share/nginx/html
COPY infra/nginx/web.conf /etc/nginx/conf.d/default.conf
