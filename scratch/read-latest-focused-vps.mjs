import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(`set -eu
changelog_file=/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
stat -c '%s bytes | modificado: %y' "$changelog_file"
printf '\n--- ULTIMOS TITULOS ---\n'
grep -n '^## ' "$changelog_file" | tail -n 12
printf '\n--- FINAL DO ARQUIVO ---\n'
tail -n 120 "$changelog_file"
`);
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
process.exitCode = result.code;
