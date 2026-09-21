import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-control-plane node -e '
const { Pool } = require("pg");
const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const crypto = require("crypto");
const execFileAsync = promisify(execFile);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const CHANNEL_ID = "ch-main";
const MEDIA_DIR = "/media/1";

async function run() {
  const mediaId = "media-f5a6e79b-d245-4d10-b955-fde6dc228d9e";
  const profile = "1080p_pro";

  const { rows } = await pool.query(
    "select * from public.gsa_tv_media_items where id=$1 and channel_id=$2",
    [mediaId, CHANNEL_ID]
  );
  const media = rows[0];
  const sourcePath = media.drive_path;
  console.log("Source path:", sourcePath);

  const enhancedDir = path.join(MEDIA_DIR, "enhanced");
  await fs.mkdir(enhancedDir, { recursive: true, mode: 0o750 });
  const ext = path.extname(sourcePath) || ".mp4";
  const targetFile = path.join(enhancedDir, mediaId + "-" + profile + ext);
  const tempFile = targetFile + "." + crypto.randomUUID() + ".tmp" + ext;

  const is4K = profile === "4k_pro" || profile === "ai_super_res";
  const videoFilters = is4K
    ? "scale=3840:2160:flags=lanczos,pad=3840:2160:(ow-iw)/2:(oh-ih)/2:color=0x07111f,fps=30,eq=contrast=1.07:brightness=-0.012:saturation=1.12,unsharp=5:5:0.75:5:5:0.0,format=yuv420p"
    : "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x07111f,fps=30,eq=contrast=1.07:brightness=-0.012:saturation=1.12,unsharp=5:5:0.85:5:5:0.0,format=yuv420p";

  const ffmpegArgs = [
    "-hide_banner",
    "-nostdin",
    "-loglevel", "error",
    "-y",
    "-i", sourcePath,
    "-vf", videoFilters,
    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo",
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "14",
    "-b:v", "12000k",
    "-maxrate", "14000k",
    "-bufsize", "20000k",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "320k",
    "-movflags", "+faststart",
    tempFile
  ];

  console.log("Executando FFmpeg...");
  await execFileAsync("ffmpeg", ffmpegArgs);
  await fs.rename(tempFile, targetFile);

  const probeOut = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_streams",
    "-show_format",
    "-of", "json",
    targetFile
  ]);
  const probe = JSON.parse(probeOut.stdout || "{}");
  const vStream = probe.streams.find((s) => s.codec_type === "video");
  const aStream = probe.streams.find((s) => s.codec_type === "audio");
  const duration = Math.max(1, Math.round(Number(probe.format?.duration || media.duration_s || 1)));

  await pool.query(
    "update public.gsa_tv_media_items set state=\"ready\", drive_path=$2, duration_s=$3, video_width=$4, video_height=$5, video_codec=$6, video_bitrate_kbps=$7, audio_codec=$8, audio_sample_rate=$9, audio_bitrate_kbps=$10, metadata=coalesce(metadata, \"{}\"::jsonb) || $11::jsonb, updated_at=now() where id=$1",
    [
      mediaId,
      targetFile,
      duration,
      vStream.width,
      vStream.height,
      vStream.codec_name,
      Math.round(Number(vStream.bit_rate || 12000000) / 1000),
      aStream?.codec_name || "aac",
      Number(aStream?.sample_rate || 48000),
      Math.round(Number(aStream?.bit_rate || 320000) / 1000),
      JSON.stringify({
        enhanced: true,
        enhanced_profile: profile,
        enhanced_at: new Date().toISOString()
      })
    ]
  );

  console.log("Sucesso! Nova resolucao:", vStream.width + "x" + vStream.height, "Bitrate:", vStream.bit_rate);
  await pool.end();
}

run().catch(e => { console.error("Erro:", e); process.exit(1); });
'
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
}

main().catch(console.error);
