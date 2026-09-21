FROM node:20-bookworm-slim
ARG UID=988
ARG GID=989
RUN apt-get update && apt-get install --yes --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/* \
  && groupadd --gid ${GID} watchdog && useradd --uid ${UID} --gid ${GID} --home-dir /app --create-home --shell /usr/sbin/nologin watchdog
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts
COPY src/ ./src/
RUN chown -R watchdog:watchdog /app
USER watchdog:watchdog
EXPOSE 9204
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "require('http').get('http://localhost:9204/health',r=>process.exit(r.statusCode===200?0:1))"
CMD ["node","src/app.js"]
