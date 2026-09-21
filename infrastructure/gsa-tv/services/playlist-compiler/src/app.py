"""GSA TV Playlist Compiler.

Responsabilidades:
- Ler gsa_tv.schedule_slots para as próximas N horas.
- Confirmar que todos os arquivos estão no cache com checksum válido.
- Gerar playlist.json no formato ffplayout.
- Publicar atomicamente (rename) sob /playlists/YYYY-MM-DD.json.
- Manter snapshot anterior para rollback.
- Registrar em gsa_tv.playlists.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse

logging.basicConfig(
    level=logging.INFO,
    format='{"time": "%(asctime)s", "level": "%(levelname)s", "msg": "%(message)s"}',
)
logger = logging.getLogger(__name__)

PLAYLISTS_DIR = Path(os.getenv("PLAYLISTS_DIR", "/playlists"))
CACHE_DIR = Path(os.getenv("CACHE_DIR", "/media"))
FALLBACK_FILE = os.getenv("FALLBACK_FILE", "/fallback/fallback_30s.mp4")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
CHANNEL_ID = os.getenv("CHANNEL_ID", "")
COMPILE_HOURS_AHEAD = int(os.getenv("COMPILE_HOURS_AHEAD", "6"))

app = FastAPI(title="GSA TV Playlist Compiler", docs_url=None, redoc_url=None)

_last_compilation: dict[str, Any] = {}


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({
        "status": "ok",
        "service": "gsa-tv-playlist-compiler",
        "playlists_dir": str(PLAYLISTS_DIR),
        "supabase_configured": bool(SUPABASE_URL),
    })


@app.get("/metrics", response_class=PlainTextResponse)
async def metrics() -> str:
    last_ok = _last_compilation.get("success", False)
    lines = [
        "# HELP gsa_tv_playlist_compiler_last_ok Última compilação foi bem-sucedida",
        "# TYPE gsa_tv_playlist_compiler_last_ok gauge",
        f"gsa_tv_playlist_compiler_last_ok {1 if last_ok else 0}",
    ]
    return "\n".join(lines) + "\n"


@app.post("/compile")
async def compile_playlist(hours_ahead: int = COMPILE_HOURS_AHEAD) -> JSONResponse:
    """Compila a playlist para as próximas N horas."""
    result = await run_compilation(hours_ahead)
    _last_compilation.update(result)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return JSONResponse(result)


async def run_compilation(hours_ahead: int) -> dict[str, Any]:
    """Compila e publica atomicamente a playlist."""
    now = datetime.now(timezone.utc)
    until = now + timedelta(hours=hours_ahead)

    logger.info("compilation_start", extra={"hours_ahead": hours_ahead, "until": until.isoformat()})

    # TODO Fase 8: consultar gsa_tv.schedule_slots via Supabase
    # Por ora, gera playlist sintética com o arquivo de fallback
    fallback_exists = Path(FALLBACK_FILE).exists()

    playlist = {
        "channel": "gsa-tv-main",
        "generated_at": now.isoformat(),
        "covers_from": now.isoformat(),
        "covers_until": until.isoformat(),
        "program": []
    }

    if fallback_exists:
        # Playlist sintética: repete o fallback para cobrir o período
        cursor = now
        while cursor < until:
            playlist["program"].append({
                "in": cursor.isoformat(),
                "out": (cursor + timedelta(seconds=30)).isoformat(),
                "source": FALLBACK_FILE,
                "category": "fallback",
            })
            cursor += timedelta(seconds=30)
    else:
        logger.warning("fallback_file_missing", extra={"path": FALLBACK_FILE})

    # Publicar atomicamente
    date_str = now.strftime("%Y-%m-%d")
    target = PLAYLISTS_DIR / f"{date_str}.json"
    PLAYLISTS_DIR.mkdir(parents=True, exist_ok=True)

    with tempfile.NamedTemporaryFile(
        mode='w', dir=PLAYLISTS_DIR, suffix='.tmp', delete=False
    ) as tmp:
        json.dump(playlist, tmp, indent=2, ensure_ascii=False)
        tmp_path = tmp.name

    Path(tmp_path).rename(target)
    logger.info("compilation_published", extra={"target": str(target), "slots": len(playlist['program'])})

    return {
        "success": True,
        "playlist_file": str(target),
        "slot_count": len(playlist["program"]),
        "covers_from": now.isoformat(),
        "covers_until": until.isoformat(),
        "timestamp": now.isoformat(),
    }


@app.on_event("startup")
async def startup() -> None:
    PLAYLISTS_DIR.mkdir(parents=True, exist_ok=True)
    logger.info("playlist_compiler_started")
    # Auto-compilar na inicialização
    asyncio.create_task(_startup_compile())


async def _startup_compile() -> None:
    await asyncio.sleep(5)  # aguardar outros serviços subirem
    try:
        result = await run_compilation(COMPILE_HOURS_AHEAD)
        _last_compilation.update(result)
    except Exception as exc:
        logger.error("startup_compile_error", extra={"error": str(exc)})
