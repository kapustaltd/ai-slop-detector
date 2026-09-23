# Production deployment

The GitHub Actions workflow builds `web/dist`, then deploys it over SSH to
`root@13.143.132.116`. The server keeps releases under
`/var/www/ai-slop-detector/releases/<commit-sha>` and mirrors the active release into the
Docker bind-mounted document root `/opt/hackathon/dist`.

The static site and a small registry API are deployed separately. Evaluation still runs through
the pipeline CLI (`agent/cmd/runner`), which reads the registry YAML before a run and writes the
data bundle into `web/data/` before the build.

The registry API serves `GET` and `POST /api/teams` without a token so visitors can add a team.
`PUT` and `DELETE` require `REGISTRY_API_TOKEN` and are disabled when it is unset. Public additions
must be monitored because anyone who can reach the site can submit a team.

## One-time server setup

The target must have `bash`, `tar`, `readlink`, `ln`, `mv`, `ls` and `tail`. The current production
Docker container serves `/opt/hackathon/dist`; the workflow updates that directory in place after
validating the release symlink. If the server is migrated to host Nginx, point its document root at
`/var/www/ai-slop-detector/current` and remove the `SERVE_ROOT` mirror from the workflow. The workflow
does not change server configuration, DNS, TLS or firewall rules.

### Current Docker deployment

Port `127.0.0.1:8080` is already used by `hackathon-web` and Cloudflare Tunnel. The container
serves the static release from `/opt/hackathon/dist`; keep its Nginx configuration on the host at
`/opt/hackathon/nginx.conf` and mount it at `/etc/nginx/conf.d/default.conf:ro` whenever recreating
the container.

After a deploy, verify that the public site serves the new release: the leaderboard must open and
`index.json` must carry the expected build timestamp.

## Registry API

Build `agent/cmd/registry-api` for the server, install it as
`/opt/ai-slop-detector/registry-api`, and install `deploy/registry-api.service.example` as
`/etc/systemd/system/ai-slop-detector-registry-api.service`. Create
`/var/lib/ai-slop-detector/registry.yaml` with `version: "1"` and `teams: []`, owned by the
`ai-slop-detector` service account. Enable the service and proxy `/api/teams` through Nginx to
`172.17.0.1:8082` on the current Docker bridge (or `127.0.0.1:8082` on host Nginx). The sample
configuration is `deploy/nginx.docker.conf.example`. Keep `/api/v1/` routed to the web runner.

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
