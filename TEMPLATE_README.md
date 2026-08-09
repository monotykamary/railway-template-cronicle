# Deploy and Host Cronicle on Railway

## About Hosting Cronicle

Cronicle is a web-based task scheduler and runner with event timing, command plugins, live progress, job history, and operator access control. This template deploys stable version 0.9.126 as a supported single-node scheduler.

Sign in using `CRONICLE_ADMIN_USERNAME` and the generated `CRONICLE_ADMIN_PASSWORD` service variable.

## Common Use Cases

- Schedule recurring shell commands and maintenance tasks
- Run manual operational jobs from a web interface
- Track job output, timing, success, and failure history
- Centralize trusted single-node automation

## Dependencies for Cronicle Hosting

### Deployment Dependencies

- One Cronicle service
- One daily-backed-up Railway volume
- Optional external SMTP provider for notifications

### Implementation Details

The adapter builds a checksum-verified Cronicle 0.9.126 source archive on digest-pinned Node.js 22 LTS. First startup initializes filesystem storage and replaces the insecure upstream default administrator password before traffic becomes healthy. Scheduler state is stored at `/opt/cronicle/data`; the application and child jobs run as an unprivileged user.

This is deliberately a single-node topology. Cronicle's optional UDP discovery and LAN-oriented multi-server behavior are not represented. Administrators can run arbitrary commands by design, so access must be limited to trusted operators.

## Why Deploy Cronicle on Railway?

Railway supplies managed HTTPS, generated credentials, persistent storage with backups, health checks, and repeatable deployment for Cronicle's supported single-server mode.
