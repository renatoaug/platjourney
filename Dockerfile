# The server and the web app in one image, to run PlatJourney locally with `bun run docker:up`.
# Development stays on `bun run dev`, which reloads on save.
FROM oven/bun:1.4.3 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile
COPY . .
# A plain build: no plugins.
RUN PLUGINS_WEB= bun run build

FROM oven/bun:1.4.3
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/apps/server
EXPOSE 3000
CMD ["bun", "src/index.ts"]
