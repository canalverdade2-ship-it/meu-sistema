import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec -i gsa-tv-control-plane node -e '
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const { rows } = await pool.query("select id,title,drive_path,duration_s from public.gsa_tv_media_items where drive_path is not null");
  console.log("Total de midias para gerar thumbnail:", rows.length);

  const thumbDir = "/media/1/thumbnails";
  if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

  for (const item of rows) {
    const thumbPath = path.join(thumbDir, item.id + ".jpg");
    if (!fs.existsSync(item.drive_path)) {
      console.log("Arquivo nao encontrado para", item.id, item.drive_path);
      continue;
    }
    const ssTime = Math.min(2, Math.max(0.5, (item.duration_s || 10) * 0.1));
    try {
      await execFileAsync("ffmpeg", [
        "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-ss", String(ssTime),
        "-i", item.drive_path,
        "-frames:v", "1",
        "-vf", "scale=640:360:force_original_aspect_ratio=increase,crop=640:360",
        "-q:v", "3",
        thumbPath
      ]);
      console.log("OK thumbnail gerada para:", item.title, "->", thumbPath);
    } catch (e) {
      console.error("Falha ao gerar thumb para", item.id, e.message);
    }
  }
  await pool.end();
}

run().catch(console.error);
'
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
