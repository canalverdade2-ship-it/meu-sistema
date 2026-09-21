FROM python:3.12-slim-bookworm

ARG UID=990
ARG GID=990

RUN groupadd --gid ${GID} playlist-compiler \
    && useradd --uid ${UID} --gid ${GID} --home-dir /app --create-home --shell /usr/sbin/nologin playlist-compiler

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY src/ ./src/

RUN chown -R playlist-compiler:playlist-compiler /app
USER playlist-compiler:playlist-compiler

EXPOSE 9203
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:9203/health')"

CMD ["python3", "-m", "uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "9203"]
