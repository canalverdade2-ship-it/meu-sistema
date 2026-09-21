FROM node:20-bookworm-slim

ARG UID=987
ARG GID=987

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ffmpeg python3 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid ${GID} media-worker \
    && useradd --uid ${UID} --gid ${GID} --home-dir /app --create-home --shell /usr/sbin/nologin media-worker

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts
COPY src/ ./src/

RUN chown -R media-worker:media-worker /app
USER media-worker:media-worker

EXPOSE 9200
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:9200/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "src/app.js"]
