FROM gsa-tv/control-plane:1.6.39
USER root
WORKDIR /app
COPY src/ ./src/
RUN chown -R playout-api:playout-api /app
USER playout-api:playout-api
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
 CMD node -e "require('http').get('http://127.0.0.1:9210/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "src/app.js"]
