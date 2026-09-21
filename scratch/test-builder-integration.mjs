import { runSshScript } from './ssh2-run.mjs';

const testScript = `python3 - << 'EOF'
import sys, os, json, time
from pathlib import Path

# Add builder directory to sys.path
sys.path.insert(0, '/home/opc/gsa-program-builder')

import builder

print("--- 1. Testing bumper synthesis for GSA Agro (presenting) ---")
t0 = time.time()
p_pres = builder.bumper_path('gsa-agro', 'presenting', program='GSA Agro')
t1 = time.time()
print(f"Presenting bumper path: {p_pres} (took {t1-t0:.2f}s)")
assert p_pres.is_file(), f"File does not exist: {p_pres}"

print("\\n--- 2. Testing bumper synthesis for GSA Agro (return) ---")
t0 = time.time()
p_ret = builder.bumper_path('gsa-agro', 'return', program='GSA Agro')
t1 = time.time()
print(f"Return bumper path: {p_ret} (took {t1-t0:.2f}s)")
assert p_ret.is_file(), f"File does not exist: {p_ret}"

print("\\n--- 3. Testing cache hit (should be instant) ---")
t0 = time.time()
p_pres_cached = builder.bumper_path('gsa-agro', 'presenting', program='GSA Agro')
t1 = time.time()
print(f"Cached presenting path: {p_pres_cached} (took {t1-t0:.4f}s)")
assert str(p_pres) == str(p_pres_cached), "Cache path mismatch!"

print("\\n--- 4. Inspecting presenting bumper with ffprobe ---")
info_pres = builder.probe(p_pres)
print("Presenting probe:", json.dumps(info_pres, indent=2))
stream_pres = info_pres['streams'][0]
dur_pres = float(info_pres['format']['duration'])
sr_pres = int(stream_pres['sample_rate'])
ch_pres = int(stream_pres['channels'])
print(f"Presenting: duration={dur_pres}, sample_rate={sr_pres}, channels={ch_pres}")
assert 3.0 <= dur_pres <= 7.0, f"Duration {dur_pres} outside 3s-7s!"
assert abs(dur_pres - 5.0) < 0.01, f"Expected exactly ~5.0s, got {dur_pres}"
assert sr_pres == 48000, f"Expected 48000 Hz, got {sr_pres}"
assert ch_pres == 2, f"Expected 2 channels stereo, got {ch_pres}"

print("\\n--- 5. Inspecting return bumper with ffprobe ---")
info_ret = builder.probe(p_ret)
print("Return probe:", json.dumps(info_ret, indent=2))
stream_ret = info_ret['streams'][0]
dur_ret = float(info_ret['format']['duration'])
sr_ret = int(stream_ret['sample_rate'])
ch_ret = int(stream_ret['channels'])
print(f"Return: duration={dur_ret}, sample_rate={sr_ret}, channels={ch_ret}")
assert 3.0 <= dur_ret <= 7.0, f"Duration {dur_ret} outside 3s-7s!"
assert abs(dur_ret - 5.0) < 0.01, f"Expected exactly ~5.0s, got {dur_ret}"
assert sr_ret == 48000, f"Expected 48000 Hz, got {sr_ret}"
assert ch_ret == 2, f"Expected 2 channels stereo, got {ch_ret}"

print("\\n--- 6. Testing validate_manifest on teste-curto-gsa-agro.json ---")
manifest = builder.load_manifest('/home/opc/gsa-program-builder/examples/teste-curto-gsa-agro.json')
validation = builder.validate_manifest(manifest)
print("Validation result:")
print(json.dumps({
    'ok': validation['ok'],
    'programa': validation['programa'],
    'slug': validation['slug'],
    'timeline_count': len(validation['timeline']),
    'timeline_items': [{'tipo': it['tipo'], 'papel': it['papel'], 'arquivo': it['arquivo']} for it in validation['timeline']]
}, indent=2))
assert validation['ok'] is True

print("\\n--- ALL TESTS PASSED SUCCESSFULLY! ---")
EOF
`;

async function main() {
  const r = await runSshScript(testScript, 60000);
  console.log('STDOUT:\n' + r.stdout);
  console.log('STDERR:\n' + r.stderr);
}

main().catch(console.error);
