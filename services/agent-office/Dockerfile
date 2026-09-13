FROM node:22.23.2-bookworm-slim AS production-dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:22.23.2-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM gcr.io/distroless/nodejs22-debian12:nonroot
WORKDIR /app
ENV NODE_ENV=production
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY server ./server
COPY model-policy.json harnesses.json projects.json ./
COPY project-contexts ./project-contexts
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["server/index.mjs"]
