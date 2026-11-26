"""Make a copy of the extension for the end-to-end test of the local model, and print its path.

  python3 tools/kev-test-ext.py <folder> [--hf]

The copy is the extension as it is, except for the manifest: it also names the local test server (http://127.0.0.1/*), so that the download
of the model files can be tried against tools/kev-mirror.mjs without any permission question. With --hf it also names Hugging Face
(https://huggingface.co/*, https://*.hf.co/*) as required hosts, for the one run against the real server. Nothing else differs; the copy is
what `E2E_EXT_DIR=<folder> python3 tools/e2e.py kev` loads (restart Chrome first: tools/e2e-chrome.sh).
"""
import json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'extension')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        sys.exit(__doc__)
    dest = os.path.abspath(args[0])
    shutil.rmtree(dest, ignore_errors=True)
    shutil.copytree(SRC, dest, ignore=shutil.ignore_patterns('.DS_Store'))
    path = os.path.join(dest, 'manifest.json')
    m = json.load(open(path, encoding='utf-8'))
    hosts = list(m.get('host_permissions', []))
    hosts.append('http://127.0.0.1/*')
    if '--hf' in sys.argv:
        hosts += m.pop('optional_host_permissions', [])      # the same two addresses, now granted at install: the test cannot click a permission prompt
    m['host_permissions'] = hosts
    m['name'] = m.get('name', '') + ' (test copy)'
    json.dump(m, open(path, 'w', encoding='utf-8'), indent=2)
    print(dest)


main()
