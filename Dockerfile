FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Bake a placeholder so the API origin is chosen per-container at runtime, not at build.
RUN echo "VITE_API_BASE_URL=MIRENAI_API_BASE_URL" > .env
RUN npm run build

# Unprivileged nginx: runs as a non-root user and listens on 8080.
FROM nginxinc/nginx-unprivileged:stable-alpine
USER root
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# env.sh rewrites the placeholder from $MIRENAI_API_BASE_URL at container start;
# chown lets the non-root user patch the assets in place.
COPY --from=build /app/env.sh /docker-entrypoint.d/99-mirenai-env.sh
RUN chmod +x /docker-entrypoint.d/99-mirenai-env.sh \
 && chown -R nginx /usr/share/nginx/html
USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
