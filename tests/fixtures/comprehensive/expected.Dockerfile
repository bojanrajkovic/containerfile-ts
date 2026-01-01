ARG NODE_VERSION
ARG APP_ENV=production
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS builder
LABEL maintainer="team@example.com"
LABEL version="1.0.0"
ENV NODE_ENV=${APP_ENV}
ENV PORT=8080
WORKDIR /app
ADD --chown=node:node --chmod=755 https://example.com/config.tar.gz /app/config/
COPY --chown=node:node --chmod=644 package.json package-lock.json tsconfig.json /app/
RUN ["npm", "ci", "--production"]
COPY --from=builder dist/ /app/dist/
EXPOSE 5000-5010/udp
EXPOSE 8080
ENTRYPOINT ["node", "--experimental-specifier-resolution=node"]
CMD ["dist/server.js"]
