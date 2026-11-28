#!/usr/bin/env bash
# Have Mozilla sign the Firefox build, so that a normal Firefox will install it. Unlisted: the file is signed, it is not published in the add-ons store, and can be
# installed from any page (serve it as application/x-xpinstall). Needs an account at addons.mozilla.org and its API keys
# (https://addons.mozilla.org/developers/addon/api/key/), in the environment, never in a file of this repository:
#
#   WEB_EXT_API_KEY      the JWT issuer
#   WEB_EXT_API_SECRET   the JWT secret
#
# The signed file is written to dist/signed/ and then put on the site: downloads/vianney-content-blocker-<version>-firefox.xpi, the list of versions that Firefox
# reads to update the add-on (downloads/firefox-updates.json, named by update_url in the manifest), and a "firefox" entry in _data/release.json and downloads/latest.json,
# which makes the install page offer it. Commit those and push; the deploy puts them on the site. Mozilla keeps the ID and the version: a version can be signed
# once, so raise "version" in extension/manifest.json for the next.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${WEB_EXT_API_KEY:?Set WEB_EXT_API_KEY (see the comments of this script)}"
: "${WEB_EXT_API_SECRET:?Set WEB_EXT_API_SECRET (see the comments of this script)}"

node tools/build.mjs firefox
mkdir -p dist/signed
# web-ext 10 needs Node 22 or newer
npx --yes web-ext@10 lint --source-dir dist/firefox --self-hosted
npx --yes web-ext@10 sign --source-dir dist/firefox --artifacts-dir dist/signed --channel unlisted
SIGNED="$(ls -t dist/signed/*.xpi | head -n 1)"
node tools/firefox-release.mjs "$SIGNED"
echo "Now commit downloads/ and _data/, and push: the deploy puts the file on the site."
