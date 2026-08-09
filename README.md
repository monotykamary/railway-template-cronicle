# Cronicle on Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/cronicle-scheduler?referralCode=ZqgrJ0)

Deploy Cronicle 0.9.126 as a single-node task scheduler with a generated administrator password and persistent scheduling data.

The Deploy on Railway button is added after the published route is verified.

## What this deploys

- Cronicle `0.9.126`, built from a checksum-verified upstream release archive
- Node.js `22.22.0` LTS on a digest-pinned Linux/AMD64 base image
- One daily-backed-up Railway volume for users, schedules, history, and completed job metadata
- An idempotent first-run initializer that replaces the upstream `admin` / `admin` default before serving traffic
- Narrow compatibility patches for the Node.js 22 bundle regex and Cronicle CLI bcrypt prefix used by first-run admin creation
- Cronicle and child jobs running as the unprivileged `node` user

## First login

Open the public domain and sign in with `CRONICLE_ADMIN_USERNAME` and `CRONICLE_ADMIN_PASSWORD` from the service variables. The default generated username is `admin`.

## Supported topology

This template intentionally deploys one Cronicle server. Multi-server auto-discovery uses optional UDP broadcast, direct worker WebSockets, unique LAN hostnames, and shared storage patterns that a one-click Railway template cannot represent honestly. Single-node scheduling and job execution are fully supported.

## Persistence

Cronicle filesystem storage is mounted at `/opt/cronicle/data`. Runtime logs, queues, and PID files are ephemeral under `/tmp`; completed job history and scheduler state are retained by Cronicle's storage layer. The volume receives daily Railway backups.

## Security

Cronicle administrators can execute arbitrary commands by design. Only trusted operators should receive accounts. Jobs run inside the Cronicle container as an unprivileged user but can consume service resources and access networks reachable from that service.

SMTP is not configured by default. Add an external SMTP provider before relying on alert and password-recovery email.

## Updating

Update the Cronicle version, source checksum, Node tag, and image digest together. Review release notes and repeat login, event execution, scheduler timing, history, persistence, redeploy, and delayed log tests.

## Validation

```bash
npm test
BASE_URL=https://your-domain.example ADMIN_USERNAME=admin ADMIN_PASSWORD=... ./scripts/smoke.sh
```

## Upstream

- Source: https://github.com/jhuckaby/Cronicle/tree/v0.9.126
- Release: https://github.com/jhuckaby/Cronicle/releases/tag/v0.9.126
- Documentation: https://github.com/jhuckaby/Cronicle/tree/v0.9.126/docs
- License: MIT

This repository contains only Railway adapters and documentation. Cronicle remains copyright Joseph Huckaby and contributors and is not affiliated with Railway.
