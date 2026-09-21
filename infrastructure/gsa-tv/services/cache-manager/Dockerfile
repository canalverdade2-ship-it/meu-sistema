FROM python:3.12-slim-bookworm

ARG UID=988
ARG GID=988

RUN apt-get update \
    && apt-get install --yes --no-install-recommends rclone \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid ${GID} cache-manager \
    && useradd --uid ${UID} --gid ${GID} --home-dir /app --create-home --shell /usr/sbin/nologin cache-manager

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY src/ ./src/

RUN chown -R cache-manager:cache-manager /app
USER cache-manager:cache-manager

EXPOSE 9201
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:9201/health')"

CMD ["python3", "-m", "uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "9201"]
