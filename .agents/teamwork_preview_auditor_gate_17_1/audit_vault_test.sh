python3 - << 'EOF'
import sys
sys.path.append('/home/opc/gsa-program-builder')
from builder import load_fish_api_key, FISH_VAULT_PATH

print("FISH_VAULT_PATH exists:", FISH_VAULT_PATH.exists())
try:
    key = load_fish_api_key()
    print("KEY_LEN:", len(key))
    print("KEY_PREFIX:", key[:4] + "...")
    print("VAULT_DECRYPTION_SUCCESS: TRUE")
except Exception as e:
    print("VAULT_DECRYPTION_ERROR:", e)
EOF
