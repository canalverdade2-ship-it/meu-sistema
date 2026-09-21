FROM node:20-bookworm-slim

ARG UID=989
ARG GID=989

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ffmpeg fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid ${GID} playout-api \
    && useradd --uid ${UID} --gid ${GID} --home-dir /app --create-home --shell /usr/sbin/nologin playout-api

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts
COPY src/ ./src/

RUN chown -R playout-api:playout-api /app
USER playout-api:playout-api

EXPOSE 9202
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:9202/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "src/app.js"]
