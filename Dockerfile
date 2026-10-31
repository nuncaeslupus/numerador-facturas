# For MCP directories that inspect a server by running it. Users install the .mcpb or npx instead.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json vite.mcp.config.ts ./
COPY src src
COPY mcp mcp
RUN npm ci --ignore-scripts && npx vite build --config vite.mcp.config.ts

FROM node:22-alpine
COPY --from=build /app/mcp/dist/server.mjs /server.mjs
USER node
ENTRYPOINT ["node", "/server.mjs"]
