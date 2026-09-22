# Production deployment

The GitHub Actions workflow builds `web/dist`, then deploys it over SSH to
`root@13.143.132.116`. The server keeps releases under
`/var/www/ai-slop-detector/releases/<commit-sha>` and mirrors the active release into the
Docker bind-mounted document root `/opt/hackathon/dist`.

The controlled web runner is a separate Go service. It accepts only validated repository metadata
through `/api/v1`, never arbitrary shell commands, and listens on port `8081`. Nginx proxies
`/api/` to it while serving the static frontend from `current`.

## One-time server setup

The target must have `bash`, `tar`, `readlink`, `ln`, `mv`, `ls` and `tail`. The current production
Docker container serves `/opt/hackathon/dist`; the workflow updates that directory in place after
validating the release symlink. If the server is migrated to host Nginx, point its document root at
`/var/www/ai-slop-detector/current` and remove the `SERVE_ROOT` mirror from the workflow. The workflow
does not change server configuration, DNS, TLS or firewall rules.

## One-time web runner setup

Create a dedicated service account and directories, install the unit from
`web-runner.service.example` as `ai-slop-detector-web-runner.service`, and create an environment file
with mode `0600`:

```bash
install -d -m 0750 /opt/ai-slop-detector/current /var/lib/ai-slop-detector/workspaces
useradd --system --home /var/lib/ai-slop-detector --shell /usr/sbin/nologin ai-slop-detector || true
chown -R ai-slop-detector:ai-slop-detector /opt/ai-slop-detector /var/lib/ai-slop-detector

install -d -m 0750 /etc/ai-slop-detector
cat >/etc/ai-slop-detector/web-runner.env <<'EOF'
WEB_RUNNER_TOKEN=replace-with-a-long-random-token
WEB_RUNNER_ADDR=127.0.0.1:8081
WEB_RUNNER_MAX_ACTIVE=1
AGENT_MODEL=gpt-5.6-luna
AGENT_EFFORT=low
AGENT_BASE_URL=https://ru.cheapvibecode.ru/v1
AGENT_API_KEY=replace-with-the-provider-key
WEB_RUNNER_SEED_BUNDLE_DIR=/opt/ai-slop-detector/current/seed-data
EOF
chmod 0600 /etc/ai-slop-detector/web-runner.env

systemctl daemon-reload
systemctl enable --now ai-slop-detector-web-runner.service
```

For an OpenAI-compatible HTTP provider, set `AGENT_API_KEY`, `AGENT_BASE_URL`,
`AGENT_MODEL` and optionally `AGENT_TIMEOUT_SECONDS` (up to 600) in the protected
service environment file. With `AGENT_API_KEY` set, the web runner uses the HTTP client
and does not require `claude`. Without an API key, it retains the CLI provider selected
by `WEB_RUNNER_PROVIDER_BIN` (default `claude`). Configure CLI credentials separately. Never put the token or provider credentials into git, frontend code or logs.
The browser operator enters `WEB_RUNNER_TOKEN` on the `/run` page; it is kept only in memory.
Successful runs are merged into `/var/lib/ai-slop-detector/public` and served from
`/api/v1/bundle/`. `WEB_RUNNER_SEED_BUNDLE_DIR` is read only when the persistent public bundle is
still empty, so a static deployment cannot erase previously evaluated teams.

### Current Docker deployment

Port `127.0.0.1:8080` is already used by `hackathon-web` and Cloudflare Tunnel.
Do not bind the runner to that port. For the current default Docker bridge, set
`WEB_RUNNER_ADDR=172.17.0.1:8081` in the service environment and use
`nginx.docker.conf.example` inside the container. Verify the container's bridge gateway
with `docker inspect` before applying this address. Keep the configuration on the host at
`/opt/hackathon/nginx.conf` and mount it at `/etc/nginx/conf.d/default.conf:ro` whenever
recreating the container. The host Nginx example instead uses `127.0.0.1:8081`.

After starting the service and reloading Nginx, verify `/healthz` returns JSON with
`data.status=ok` through the public site. An unauthenticated POST to `/api/v1/runs`
must return JSON with HTTP 401, rather than a static-server 404.

The first deploy creates the release directory. To prepare it explicitly:

```bash
ssh root@13.143.132.116 'install -d -m 0755 /var/www/ai-slop-detector/releases'
```

## GitHub Environment configuration

Create an Environment named `production` and add these secrets:

- `DEPLOY_SSH_KEY`: the private ED25519 key used only by GitHub Actions;
- `DEPLOY_KNOWN_HOSTS`: the verified `known_hosts` line for `13.143.132.116`.

Optional Environment variable:

- `DEPLOY_HEALTHCHECK_URL`: public HTTP(S) URL for the site. If it is set and the check fails,
  the workflow automatically runs the rollback script and fails the deploy job.
- `DEPLOY_WEB_RUNNER`: set to `true` only after installing the systemd unit, configuring
  `WEB_RUNNER_TOKEN` and wiring the reverse proxy. When unset or not `true`, CI still builds the
  runner but deploys only the static frontend.

The private key must never be committed or pasted into an issue, pull request or chat. Verify the
server host key out of band before placing it into `DEPLOY_KNOWN_HOSTS`; the deployment workflow
intentionally does not run `ssh-keyscan`.

## Manual rollback

From a checkout containing this directory, run:

```bash
ssh root@13.143.132.116 \
  "DEPLOY_ROOT='/var/www/ai-slop-detector' SERVE_ROOT='/opt/hackathon/dist' bash -s" \
  < deploy/rollback-static.sh
```

Rollback swaps `current` and `previous` atomically and does not rebuild the application.
