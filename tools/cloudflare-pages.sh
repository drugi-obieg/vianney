#!/usr/bin/env bash
# The Cloudflare side of the website: the Pages project, its custom domains and the DNS records that point the domains at it, and a check of the live site.
# Used by .github/workflows/deploy.yml. Every command can be run again and again: it creates what is missing and changes nothing else.
#
#   tools/cloudflare-pages.sh build     check the built site (_site): the download and its checksum agree, no file is above the limit of Cloudflare Pages
#   tools/cloudflare-pages.sh token     read what the token will have to change (Pages, the zone, its DNS records) and name the permission that is missing, before anything is changed
#   tools/cloudflare-pages.sh project   make sure the Pages project exists (and that its production branch is the one that is deployed)
#   tools/cloudflare-pages.sh domains   make sure every domain is a custom domain of the project and has its CNAME record, then wait until Cloudflare says "active"
#   tools/cloudflare-pages.sh check     compare the live site, on every domain and on the project's own address, with the build in _site
#
# Environment
#   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID   the secrets (project, domains)
#   CF_PROJECT   name of the Pages project (its address is <name>.pages.dev, or what Cloudflare gives if that one is taken)
#   CF_ZONE      the DNS zone of the domains, for example vianney.cc
#   CF_DOMAINS   the custom domains, separated by spaces: the apex and www
#   CF_BRANCH    the production branch of the project (default main): `wrangler pages deploy --branch=` must name it, or the deployment is only a preview
#   CF_ZONE_ID   optional: the id of the zone, if the token may not read zones (Zone > Zone > Read)
#   CF_API       the address of the API (default https://api.cloudflare.com/client/v4); tests/cloudflare-pages.test.js points it at a stand-in on this computer
#   CF_SCHEME    http or https (default https) for the checks of the live site, for the same reason
#   CF_CHECK_HOSTS   optional: the hosts that `check` looks at, instead of the domains and the project's address (the tests use it)
#   CF_WAIT_SECONDS, CF_POLL_SECONDS   how long to wait for a domain to become active or for the live site to show the new build (default 600), and between two tries (15)
#   SITE_DIR     the built site (default _site)
#
# What is printed is kept to what is needed: the answers of the API name the account, and the log of a public repository is public.
set -euo pipefail

API="${CF_API:-https://api.cloudflare.com/client/v4}"
BRANCH="${CF_BRANCH:-main}"
SCHEME="${CF_SCHEME:-https}"
WAIT="${CF_WAIT_SECONDS:-600}"
POLL="${CF_POLL_SECONDS:-15}"
SITE="${SITE_DIR:-_site}"
LIMIT=$((25 * 1024 * 1024))      # Cloudflare Pages refuses a file above 25 MiB
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
BODY="$TMP/body"
CODE=""

die() { echo "::error::$*" >&2; exit 1; }

need() {
  local v
  for v in "$@"; do [ -n "${!v:-}" ] || { echo "::error::$v is not set" >&2; exit 2; }; done
}

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

size_of() { wc -c < "$1" | tr -d ' '; }

# call METHOD PATH [JSON]: the answer goes to the file $BODY, the HTTP status to $CODE
call() {
  local method="$1" path="$2" data="${3:-}"
  local args=(-sS -o "$BODY" -w '%{http_code}' -X "$method" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H 'Content-Type: application/json')
  [ -z "$data" ] || args+=(--data "$data")
  CODE="$(curl "${args[@]}" "$API$path")" || die "no answer from the Cloudflare API ($method ${path%%\?*})"
}

# must WHAT: stop unless the last call went through; says what Cloudflare answered (code and message only)
must() {
  if [ "$CODE" -ge 200 ] && [ "$CODE" -lt 300 ] && jq -e '.success == true' "$BODY" >/dev/null 2>&1; then return 0; fi
  die "$1 failed (HTTP $CODE): $(jq -r '[.errors[]? | "\(.code): \(.message)"] | join("; ")' "$BODY" 2>/dev/null || true)"
}

PAGES=""   # /accounts/<id>/pages/projects/<name>, set by need_cloudflare
need_cloudflare() {
  need CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID CF_PROJECT
  PAGES="/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$CF_PROJECT"
}

# ---- build ------------------------------------------------------------------------------------------------------------------------------------------

build() {
  [ -f "$SITE/index.html" ] || die "$SITE/index.html is missing: the site was not built"
  [ -f "$SITE/downloads/latest.json" ] || die "$SITE/downloads/latest.json is missing"
  local file latest sha bytes
  file="$(jq -r '.file' "$SITE/downloads/latest.json")"
  latest="$(jq -r '.latest' "$SITE/downloads/latest.json")"
  sha="$(jq -r '.sha256' "$SITE/downloads/latest.json")"
  bytes="$(jq -r '.bytes' "$SITE/downloads/latest.json")"
  local f
  for f in "$file" "$latest"; do
    [ -f "$SITE/downloads/$f" ] || die "downloads/latest.json names $f, which is not in the site"
    [ "$(sha256 "$SITE/downloads/$f")" = "$sha" ] || die "downloads/$f does not have the SHA-256 that downloads/latest.json states: run npm run release"
    [ "$(size_of "$SITE/downloads/$f")" = "$bytes" ] || die "downloads/$f does not have the size that downloads/latest.json states: run npm run release"
  done
  local big
  big="$(find "$SITE" -type f -size +"${LIMIT}"c -print | head -3)"
  [ -z "$big" ] || die "Cloudflare Pages refuses files above 25 MiB: $big"
  local count
  count="$(find "$SITE" -type f | wc -l | tr -d ' ')"
  [ "$count" -le 20000 ] || die "Cloudflare Pages takes at most 20000 files, the site has $count"
  echo "the site: $count files, download $file ($bytes bytes, SHA-256 matches)"
}

# ---- token ------------------------------------------------------------------------------------------------------------------------------------------

# A read of everything that the token will have to change, before anything is changed. A token with the wrong permissions is the likeliest mistake (DNS Settings and DNS Views,
# which are for internal DNS, look like the DNS permission that is meant), and it should be named here, not found out after the site was uploaded.
# A read cannot tell Edit from Read: a token that can only read is stopped by the first write, with the message of that step.
token() {
  need_cloudflare
  call GET "/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects?per_page=1"
  must "reading the Pages projects of the account (the token needs Account > Cloudflare Pages > Edit on this account, and CLOUDFLARE_ACCOUNT_ID must be the id of that account)"
  local zone
  zone="$(zone_id)"
  call GET "/zones/$zone/dns_records?per_page=1"
  must "reading the DNS records of $CF_ZONE (the token needs Zone > DNS > Edit on that zone: DNS Settings and DNS Views are for internal DNS and do not do it)"
  echo "the token reaches the Pages projects of the account and the DNS records of $CF_ZONE"
}

# ---- project ----------------------------------------------------------------------------------------------------------------------------------------

project() {
  need_cloudflare
  call GET "$PAGES"
  if [ "$CODE" = 404 ]; then
    call POST "/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects" "$(jq -nc --arg n "$CF_PROJECT" --arg b "$BRANCH" '{name: $n, production_branch: $b}')"
    must "creating the Pages project $CF_PROJECT"
    echo "created the Pages project $CF_PROJECT (production branch $BRANCH)"
    return
  fi
  must "reading the Pages project $CF_PROJECT"
  local branch
  branch="$(jq -r '.result.production_branch // empty' "$BODY")"
  [ "$branch" = "$BRANCH" ] || die "the Pages project $CF_PROJECT has $branch as its production branch, but the deploy names $BRANCH: a deployment of another branch is only a preview, and no domain shows it"
  echo "the Pages project $CF_PROJECT exists (production branch $BRANCH)"
}

# ---- domains ----------------------------------------------------------------------------------------------------------------------------------------

# the address of the project: <name>.pages.dev, or what Cloudflare gave it
target() {
  call GET "$PAGES"
  must "reading the Pages project $CF_PROJECT"
  local t
  t="$(jq -r '.result.subdomain // empty' "$BODY")"
  [ -n "$t" ] || die "Cloudflare gave no address (subdomain) for the Pages project $CF_PROJECT"
  case "$t" in *.pages.dev) ;; *) t="$t.pages.dev" ;; esac
  echo "$t"
}

zone_id() {
  if [ -n "${CF_ZONE_ID:-}" ]; then echo "$CF_ZONE_ID"; return; fi
  need CF_ZONE
  call GET "/zones?name=$CF_ZONE"
  must "looking up the zone $CF_ZONE (the token needs Zone > Zone > Read on that zone)"
  local id
  id="$(jq -r '.result[0].id // empty' "$BODY")"
  [ -n "$id" ] || die "the token sees no zone named $CF_ZONE: the domain must be in this Cloudflare account, and the token needs Zone > Zone > Read on it"
  echo "zone $CF_ZONE: $(jq -r '.result[0].status' "$BODY")" >&2
  echo "$id"
}

attach() {   # attach DOMAIN: a custom domain of the project
  call GET "$PAGES/domains?per_page=25"
  must "listing the custom domains of the project"
  if jq -e --arg d "$1" '.result[]? | select(.name == $d)' "$BODY" >/dev/null; then
    echo "$1: is a custom domain of the project"
    return
  fi
  call POST "$PAGES/domains" "$(jq -nc --arg d "$1" '{name: $d}')"
  must "adding $1 as a custom domain"
  echo "$1: added as a custom domain"
}

point() {   # point ZONE_ID NAME TARGET: NAME is a proxied CNAME to TARGET (at the apex Cloudflare flattens it)
  local zone="$1" name="$2" to="$3"
  call GET "/zones/$zone/dns_records?name=$name&per_page=100"
  must "listing the DNS records of $name"
  if jq -e '.result[] | select(.type == "A" or .type == "AAAA")' "$BODY" >/dev/null; then
    die "$name has an A or AAAA record, which cannot stand beside the CNAME that Pages needs. This script never deletes a record: remove it in the Cloudflare dashboard and run it again."
  fi
  local current id content proxied
  current="$(jq -c '[.result[] | select(.type == "CNAME")][0] // empty' "$BODY")"
  if [ -z "$current" ]; then
    call POST "/zones/$zone/dns_records" "$(jq -nc --arg n "$name" --arg t "$to" --arg c "Cloudflare Pages ($CF_PROJECT), kept by tools/cloudflare-pages.sh" \
      '{type: "CNAME", name: $n, content: $t, proxied: true, ttl: 1, comment: $c}')"
    must "creating the CNAME record of $name"
    echo "$name: CNAME to $to created"
    return
  fi
  id="$(jq -r '.id' <<<"$current")"
  content="$(jq -r '.content' <<<"$current")"
  proxied="$(jq -r '.proxied' <<<"$current")"
  if [ "$content" = "$to" ] && [ "$proxied" = true ]; then
    echo "$name: CNAME to $to is in place"
    return
  fi
  case "$content" in
    *.pages.dev) ;;
    *) die "$name is a CNAME to $content, which is not a Cloudflare Pages address: it is left as it is. Change or remove it in the Cloudflare dashboard and run this again." ;;
  esac
  call PATCH "/zones/$zone/dns_records/$id" "$(jq -nc --arg t "$to" '{content: $t, proxied: true}')"
  must "changing the CNAME record of $name"
  echo "$name: CNAME changed from $content to $to"
}

wait_active() {
  local deadline=$((SECONDS + WAIT)) waiting d st
  while :; do
    call GET "$PAGES/domains?per_page=25"
    must "listing the custom domains of the project"
    waiting=""
    for d in $CF_DOMAINS; do
      st="$(jq -r --arg d "$d" '[.result[]? | select(.name == $d)][0].status // "missing"' "$BODY")"
      [ "$st" = active ] || waiting="$waiting $d=$st"
    done
    if [ -z "$waiting" ]; then echo "every custom domain is active"; return; fi
    if [ "$SECONDS" -ge "$deadline" ]; then
      jq -r '.result[]? | select(.status != "active") | "\(.name): \(.status) \(.validation_data.error_message // .verification_data.error_message // "")"' "$BODY" >&2 || true
      die "not active after ${WAIT} s:$waiting. A new domain can take a while for its certificate: run the workflow again later."
    fi
    echo "waiting for Cloudflare to activate:$waiting"
    sleep "$POLL"
  done
}

domains() {
  need_cloudflare
  need CF_DOMAINS
  local to zone d
  to="$(target)"
  zone="$(zone_id)"
  for d in $CF_DOMAINS; do
    attach "$d"
    point "$zone" "$d" "$to"
  done
  wait_active
}

# ---- check ------------------------------------------------------------------------------------------------------------------------------------------

# check_host HOST: the live site on HOST is the build in $SITE; says what differs (returns 1)
check_host() {
  local host="$1" base="$SCHEME://$1" want got zip
  curl -fsS -o /dev/null --max-time 30 "$base/" 2>"$TMP/err" || { echo "$host: the home page does not answer ($(head -c 200 "$TMP/err"))"; return 1; }
  curl -fsS -o "$TMP/live-latest.json" --max-time 30 "$base/downloads/latest.json" 2>"$TMP/err" || { echo "$host: downloads/latest.json does not answer ($(head -c 200 "$TMP/err"))"; return 1; }
  want="$(sha256 "$SITE/downloads/latest.json")"
  got="$(sha256 "$TMP/live-latest.json")"
  [ "$want" = "$got" ] || { echo "$host: downloads/latest.json is not the one just built (it may be the previous deployment, still cached)"; return 1; }
  zip="$(jq -r '.latest' "$SITE/downloads/latest.json")"
  curl -fsS -o "$TMP/live.zip" --max-time 120 "$base/downloads/$zip" 2>"$TMP/err" || { echo "$host: downloads/$zip does not answer ($(head -c 200 "$TMP/err"))"; return 1; }
  [ "$(sha256 "$TMP/live.zip")" = "$(jq -r '.sha256' "$SITE/downloads/latest.json")" ] || { echo "$host: downloads/$zip has not the SHA-256 that latest.json states"; return 1; }
  return 0
}

check() {
  [ -f "$SITE/downloads/latest.json" ] || die "$SITE/downloads/latest.json is missing: the site was not built"
  local hosts deadline=$((SECONDS + WAIT)) h bad msg
  if [ -n "${CF_CHECK_HOSTS:-}" ]; then
    hosts="$CF_CHECK_HOSTS"
  else
    need_cloudflare
    need CF_DOMAINS
    hosts="$CF_DOMAINS $(target)"
  fi
  while :; do
    bad=""
    for h in $hosts; do
      if msg="$(check_host "$h")"; then echo "$h: the live site is the new build"; else bad="$bad$msg"$'\n'; fi
    done
    [ -z "$bad" ] && return 0
    if [ "$SECONDS" -ge "$deadline" ]; then printf '%s' "$bad" >&2; die "the live site is not the new build after ${WAIT} s"; fi
    echo "waiting for the live site:"; printf '%s' "$bad"
    sleep "$POLL"
  done
}

case "${1:-}" in
  build) build ;;
  token) token ;;
  project) project ;;
  domains) domains ;;
  check) check ;;
  *) echo "usage: $0 build|token|project|domains|check" >&2; exit 2 ;;
esac
