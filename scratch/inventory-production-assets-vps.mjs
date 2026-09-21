import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(`set -u
echo '=== LOGO FILES ==='
sudo find /home/opc/gsa-ai /opt/gsa-tv/cache/media/1 -type f 2>/dev/null | grep -Ei 'logo.*\.(png|webp|svg)$|\.(png|webp|svg)$' | grep -Ei 'program|gsa[-_ ]?(manha|meio|news|mercado|tempo|cidadania|business|tech|motor|agro|mundo|destinos|bem|sabor|em.fe|historia|hora|music|rede|esporte|cinema|pipoca|desenho|planeta|mister)' | head -n 240
echo '=== CASTING FILES ==='
sudo find /home/opc/gsa-ai/assets/casting -maxdepth 2 -type f -printf '%p\n' 2>/dev/null | sort
echo '=== AUDIO IDENTITY ==='
sudo find /opt/gsa-tv/cache/media/1/identity/audio -maxdepth 1 -type f -printf '%f\n' 2>/dev/null | head -n 80
`, 30000);
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
