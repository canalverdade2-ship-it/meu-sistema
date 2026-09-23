FROM node:20-bookworm-slim

ARG UID=987
ARG GID=989

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid ${GID} encoder-engine \
    && useradd --uid ${UID} --gid ${GID} --home-dir /app --create-home --shell /usr/sbin/nologin encoder-engine

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts
COPY src/ ./src/

RUN chown -R encoder-engine:encoder-engine /app
USER encoder-engine:encoder-engine

EXPOSE 9210
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:9210/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/app.js"]
