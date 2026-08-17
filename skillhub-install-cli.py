import os, json, shutil

home = os.path.expanduser('~')
install_base = os.path.join(home, '.skillhub')
bin_dir = os.path.join(home, '.local', 'bin')
src = r'C:\Users\Administrator\.openclaw\workspace\skillhub-extract\cli'

# Create dirs
os.makedirs(install_base, exist_ok=True)
os.makedirs(bin_dir, exist_ok=True)

# Copy CLI files
shutil.copy2(os.path.join(src, 'skills_store_cli.py'), os.path.join(install_base, 'skills_store_cli.py'))
shutil.copy2(os.path.join(src, 'skills_upgrade.py'), os.path.join(install_base, 'skills_upgrade.py'))
shutil.copy2(os.path.join(src, 'version.json'), os.path.join(install_base, 'version.json'))
shutil.copy2(os.path.join(src, 'metadata.json'), os.path.join(install_base, 'metadata.json'))

# Copy index if exists
idx_src = os.path.join(src, 'skills_index.local.json')
idx_dst = os.path.join(install_base, 'skills_index.local.json')
if os.path.exists(idx_src):
    shutil.copy2(idx_src, idx_dst)

# Create config if not exists
config_path = os.path.join(install_base, 'config.json')
if not os.path.exists(config_path):
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump({'self_update_url': 'https://skillhub-1388575217.cos.ap-guangzhou.myqcloud.com/version.json'}, f, indent=2)

# Create wrapper script (bash)
wrapper_lines = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'BASE="${HOME}/.skillhub"',
    'CLI="${BASE}/skills_store_cli.py"',
    'if [[ ! -f "${CLI}" ]]; then',
    '  echo "Error: CLI not found at ${CLI}" >&2',
    '  exit 1',
    'fi',
    'exec python3 "${CLI}" "$@"',
]
wrapper_path = os.path.join(bin_dir, 'skillhub')
with open(wrapper_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(wrapper_lines) + '\n')

# Legacy wrapper
legacy_lines = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'exec "${HOME}/.local/bin/skillhub" "$@"',
]
legacy_path = os.path.join(bin_dir, 'oc-skills')
with open(legacy_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(legacy_lines) + '\n')

print('CLI installed successfully')
print(f'  CLI: {os.path.join(install_base, "skills_store_cli.py")}')
print(f'  Wrapper: {wrapper_path}')
print(f'  Config: {config_path}')
