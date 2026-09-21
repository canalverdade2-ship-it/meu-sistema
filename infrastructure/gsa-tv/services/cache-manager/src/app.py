"""GSA TV Cache Manager.

Responsabilidades:
- Calcular quais itens da grade das próximas 48 h não estão no cache.
- Disparar download via rclone com checksum.
- Verificar integridade dos arquivos já no cache.
- Remover itens expirados (fora das próximas 48 h + já exibidos).
- Expor /health e /metrics para Prometheus.
"""
from __future__ import annotations

import asyncio
import logging
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse

logging.basicConfig(
    level=logging.INFO,
    format='{"time": "%(asctime)s", "level": "%(levelname)s", "msg": "%(message)s"}',
)
logger = logging.getLogger(__name__)

CACHE_DIR = Path(os.getenv("CACHE_DIR", "/media"))
RCLONE_REMOTE = os.getenv("RCLONE_REMOTE", "")  # ex: gdrive:GSA TV/biblioteca
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
WARMUP_HOURS = int(os.getenv("WARMUP_HOURS", "48"))

app = FastAPI(title="GSA TV Cache Manager", docs_url=None, redoc_url=None)

# Métricas simples
_metrics: dict[str, Any] = {
    "cache_files": 0,
    "cache_bytes": 0,
    "pending_downloads": 0,
    "last_warmup_at": None,
    "last_cleanup_at": None,
    "errors": 0,
}


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({
        "status": "ok",
        "service": "gsa-tv-cache-manager",
        "cache_dir": str(CACHE_DIR),
        "rclone_configured": bool(RCLONE_REMOTE),
        "supabase_configured": bool(SUPABASE_URL),
    })


@app.get("/status")
async def status() -> JSONResponse:
    # Calcular tamanho atual do cache
    total_bytes = sum(f.stat().st_size for f in CACHE_DIR.rglob("*") if f.is_file())
    total_files = sum(1 for f in CACHE_DIR.rglob("*") if f.is_file())
    _metrics["cache_files"] = total_files
    _metrics["cache_bytes"] = total_bytes
    return JSONResponse({
        "service": "gsa-tv-cache-manager",
        "cache_dir": str(CACHE_DIR),
        "cache_files": total_files,
        "cache_bytes": total_bytes,
        "cache_gb": round(total_bytes / (1024**3), 2),
        "warmup_hours": WARMUP_HOURS,
        "metrics": _metrics,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


@app.get("/metrics", response_class=PlainTextResponse)
async def metrics() -> str:
    lines = [
        "# HELP gsa_tv_cache_files Número de arquivos no cache",
        "# TYPE gsa_tv_cache_files gauge",
        f"gsa_tv_cache_files {_metrics['cache_files']}",
        "# HELP gsa_tv_cache_bytes Tamanho total do cache em bytes",
        "# TYPE gsa_tv_cache_bytes gauge",
        f"gsa_tv_cache_bytes {_metrics['cache_bytes']}",
        "# HELP gsa_tv_pending_downloads Downloads pendentes",
        "# TYPE gsa_tv_pending_downloads gauge",
        f"gsa_tv_pending_downloads {_metrics['pending_downloads']}",
        "# HELP gsa_tv_cache_errors Erros no cache manager",
        "# TYPE gsa_tv_cache_errors counter",
        f"gsa_tv_cache_errors_total {_metrics['errors']}",
    ]
    return "\n".join(lines) + "\n"


@app.post("/warmup")
async def trigger_warmup() -> JSONResponse:
    """Dispara warmup manual (o automático é feito pelo scheduler em background)."""
    asyncio.create_task(run_warmup())
    return JSONResponse({"status": "warmup_triggered", "timestamp": datetime.now(timezone.utc).isoformat()})


async def run_warmup() -> None:
    """Placeholder — será conectado ao Supabase na Fase 8."""
    logger.info("warmup_start", extra={"warmup_hours": WARMUP_HOURS})
    _metrics["last_warmup_at"] = datetime.now(timezone.utc).isoformat()
    # TODO Fase 8: consultar gsa_tv.schedule_slots e gsa_tv.media_items via Supabase
    #             e disparar rclone copy para itens não presentes no cache
    logger.info("warmup_complete_placeholder")


async def run_cleanup() -> None:
    """Remove arquivos de mídia normalizados mais antigos que WARMUP_HOURS + 24 h."""
    logger.info("cleanup_start")
    _metrics["last_cleanup_at"] = datetime.now(timezone.utc).isoformat()
    # TODO Fase 8: consultar grade e remover arquivos não mais necessários
    logger.info("cleanup_complete_placeholder")


@app.on_event("startup")
async def startup() -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    logger.info("cache_manager_started", extra={"cache_dir": str(CACHE_DIR)})
    # Scheduler simples a cada 15 minutos
    asyncio.create_task(_scheduler())


async def _scheduler() -> None:
    while True:
        await asyncio.sleep(900)  # 15 minutos
        try:
            await run_warmup()
        except Exception as exc:
            logger.error("scheduler_warmup_error", extra={"error": str(exc)})
            _metrics["errors"] += 1
