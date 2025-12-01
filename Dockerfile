FROM node:20.19.6-slim
# FROM demonstrationorg/dhi-node-tadashi:20.19.6-dev_corepack

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install

COPY . .

RUN pnpm run build

EXPOSE 3000

CMD ["pnpm", "run", "start:with-db-init"]
