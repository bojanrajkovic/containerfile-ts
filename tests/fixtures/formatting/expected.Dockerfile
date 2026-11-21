# syntax=docker/dockerfile:1
FROM node:20-alpine
# Install dependencies first so the layer caches
#
# between source changes.
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
CMD ["node", "dist/index.js"]
