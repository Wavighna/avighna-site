# Deploy runbook

State as of writing: site builds clean, `npm run check` passes with 0 failures,
2 commits on `main`, **no remote yet**. Domain `avighnawuthoo.com` is registered
at Cloudflare (nameservers already Cloudflare's, no A records set yet).

Fill in these two values before starting:

```bash
GH_USER=                       # your github username
DOMAIN=avighnawuthoo.com
```

---

## 1. Push to GitHub

`gh` is not installed on this machine.

```bash
brew install gh
gh auth login                  # interactive; needs a human
cd ~/Documents/avighna-site
gh repo create avighna-site --public --source=. --push
```

Without `gh`: create an empty public repo named `avighna-site` on github.com
(no README, no .gitignore), then:

```bash
cd ~/Documents/avighna-site
git remote add origin https://github.com/$GH_USER/avighna-site.git
git push -u origin main
```

## 2. Enable Pages (build from Actions)

```bash
gh api -X POST repos/$GH_USER/avighna-site/pages -f build_type=workflow
```

Or in the UI: Settings → Pages → Source: **GitHub Actions**.

The workflow at `.github/workflows/deploy.yml` runs `build.mjs` then `check.mjs`,
and only deploys if checks pass. Wait for the first run to go green:

```bash
gh run watch
```

## 3. Cloudflare DNS

Five records. **All must be unproxied (`"proxied": false` / grey cloud).**
Proxying blocks GitHub's certificate issuance — the domain gets stuck on
"Certificate not yet issued", and with Cloudflare SSL mode "Flexible" you also
get a redirect loop.

### Via API

Needs a token with **Zone → DNS → Edit** on this zone, created at
https://dash.cloudflare.com/profile/api-tokens. `ZONE_ID` is on the zone's
Overview page, bottom right.

```bash
CF_TOKEN=                      # do not commit this
ZONE_ID=

for ip in 185.199.108.153 185.199.109.153 185.199.110.153 185.199.111.153; do
  curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CF_TOKEN" \
    -H "Content-Type: application/json" \
    --data "{\"type\":\"A\",\"name\":\"@\",\"content\":\"$ip\",\"proxied\":false}" \
  | python3 -c "import sys,json; r=json.load(sys.stdin); print('ok' if r['success'] else r['errors'])"
done

curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{\"type\":\"CNAME\",\"name\":\"www\",\"content\":\"$GH_USER.github.io\",\"proxied\":false}" \
| python3 -c "import sys,json; r=json.load(sys.stdin); print('ok' if r['success'] else r['errors'])"
```

### Via dashboard

https://dash.cloudflare.com/?to=/:account/avighnawuthoo.com/dns → Add record:

| Type | Name | Value | Proxy |
|---|---|---|---|
| A | `@` | `185.199.108.153` | DNS only |
| A | `@` | `185.199.109.153` | DNS only |
| A | `@` | `185.199.110.153` | DNS only |
| A | `@` | `185.199.111.153` | DNS only |
| CNAME | `www` | `$GH_USER.github.io` | DNS only |

## 4. Attach the domain

Only after step 3 resolves (check with the verify block below).

```bash
gh api -X PUT repos/$GH_USER/avighna-site/pages -f cname=$DOMAIN
# then, once the cert is issued (can take up to an hour):
gh api -X PUT repos/$GH_USER/avighna-site/pages -F https_enforced=true
```

`https_enforced=true` fails while the certificate is still provisioning. That is
expected — wait and retry, don't go looking for a misconfiguration.

## 5. Verify

```bash
DOMAIN=avighnawuthoo.com
echo "A records:"; dig +short A $DOMAIN
echo "www:";       dig +short CNAME www.$DOMAIN
echo "http:";      curl -sI  http://$DOMAIN  | head -1
echo "https:";     curl -sI  https://$DOMAIN | head -1
echo "cert:";      echo | openssl s_client -connect $DOMAIN:443 -servername $DOMAIN 2>/dev/null | openssl x509 -noout -issuer -dates
echo "llms.txt:";  curl -s https://$DOMAIN/llms.txt | head -3
```

Expect: four A records matching `185.199.10[89].153` / `185.199.11[01].153`,
`http` returning 301 to https, `https` returning 200, and a Let's Encrypt cert.

If `dig` returns Cloudflare IPs (`104.*` or `172.67.*`) instead of the
`185.199.*` set, the records are still proxied — flip them to DNS only.

---

## Not a deployment problem

`content.json` still contains **9 `TODO` placeholders** — bio, work bullets,
email, github, linkedin. The site deploys and works fine with them, it just
says TODO in public. These need Avighna's actual details; no agent can supply
them. Fill in `content.json`, run `npm run check`, commit, push — CI redeploys
in about a minute.
