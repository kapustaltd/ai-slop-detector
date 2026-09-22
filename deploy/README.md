# Production deployment

The GitHub Actions workflow builds `web/dist`, then deploys it over SSH to
`root@13.143.132.116`. The server keeps releases under
`/var/www/ai-slop-detector/releases/<commit-sha>` and serves the `current` symlink.

The controlled web runner is a separate Go service. It accepts only validated repository metadata
through `/api/v1`, never arbitrary shell commands, and listens on `127.0.0.1:8080`. Nginx proxies
`/api/` to it while serving the static frontend from `current`.

## One-time server setup

The target must have `bash`, `tar`, `readlink`, `ln`, `mv`, `ls` and `tail`. A static web server must be
configured to use this document root. For Nginx, adapt `nginx.conf.example`, install it as a site,
and reload Nginx. The workflow does not change server configuration, DNS, TLS or firewall rules.

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
WEB_RUNNER_MAX_ACTIVE=1
AGENT_MODEL=gpt-5.6-luna
AGENT_EFFORT=none
EOF
chmod 0600 /etc/ai-slop-detector/web-runner.env

systemctl daemon-reload
systemctl enable --now ai-slop-detector-web-runner.service
```

The provider credentials and the `claude` executable must be configured for the service account
outside the repository. Never put the token or provider credentials into git, frontend code or logs.
The browser operator enters `WEB_RUNNER_TOKEN` on the `/run` page; it is kept only in memory.

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
  "DEPLOY_ROOT='/var/www/ai-slop-detector' bash -s" \
  < deploy/rollback-static.sh
```

Rollback swaps `current` and `previous` atomically and does not rebuild the application.
