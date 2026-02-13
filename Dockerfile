# FROM node:24.13.0-slim
FROM dhi.io/node:24.13.1-dev

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install

COPY . .

RUN pnpm run build

EXPOSE 3000

CMD ["pnpm", "run", "start:with-db-init"]
