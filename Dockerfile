FROM node:22-slim

# The whole reason this is a container and not a Worker.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

# puppeteer is a local QA dep. Do not download Chrome into the production image.
ENV PUPPETEER_SKIP_DOWNLOAD=1

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build && pnpm prune --prod

EXPOSE 3000
CMD ["pnpm", "start"]
