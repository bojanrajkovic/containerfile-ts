FROM node:20-alpine
WORKDIR /app
COPY package*.json .
RUN --mount=type=cache,target=/root/.npm,id=npm,sharing=locked npm ci
RUN --mount=type=secret,id=npm_token,env=NPM_TOKEN,required --mount=type=tmpfs,target=/tmp,size=64m npm publish
RUN --mount=type=bind,source=/dist,target=/src,from=build,rw ["cp", "-r", "/src/dist", "/app/dist"]
RUN --mount=type=cache,target=/var/cache/apk,mode=0755,uid=0,gid=0 apk add curl \
    && curl --version
