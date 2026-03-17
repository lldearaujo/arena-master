## Webadmin (Vite) - build + serve via Nginx
## Build context: raiz do repositório (para incluir /web e /shared).

FROM node:20-alpine AS build

WORKDIR /app

# Dependências primeiro (melhor uso de cache)
COPY web/package.json web/package-lock.json ./web/
WORKDIR /app/web
RUN npm ci

# Variável de ambiente de build do Vite
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Código-fonte (web + shared)
WORKDIR /app
COPY shared ./shared
COPY web ./web

WORKDIR /app/web
RUN npm run build


FROM nginx:1.27-alpine AS runtime

COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

