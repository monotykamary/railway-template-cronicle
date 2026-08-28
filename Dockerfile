FROM docker.io/library/node:22.23.2-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436 AS build

ARG CRONICLE_VERSION=0.9.130
ARG CRONICLE_SHA256=946e3e1498c679248be9bb1e4d82ca17a90250cbb549cf1e9b6b395c46f0e049

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL "https://github.com/jhuckaby/Cronicle/archive/refs/tags/v${CRONICLE_VERSION}.tar.gz" -o /tmp/cronicle.tar.gz \
    && echo "${CRONICLE_SHA256}  /tmp/cronicle.tar.gz" | sha256sum -c - \
    && mkdir -p /opt/cronicle \
    && tar -xzf /tmp/cronicle.tar.gz -C /opt/cronicle --strip-components=1 \
    && rm /tmp/cronicle.tar.gz
COPY patch-build.mjs /tmp/patch-build.mjs
WORKDIR /opt/cronicle
RUN npm ci --omit=dev --ignore-scripts \
    && node /tmp/patch-build.mjs \
    && node --check bin/storage-cli.js \
    && node bin/build.js dist \
    && ! grep -q "Build Error" logs/install.log \
    && test -s htdocs/js/_combo.js \
    && test -s htdocs/css/_combo.css \
    && test -s conf/config.json \
    && npm cache clean --force \
    && rm /tmp/patch-build.mjs

FROM docker.io/library/node:22.23.2-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gosu procps tini tzdata \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /opt/cronicle /opt/cronicle
COPY configure.mjs /usr/local/lib/cronicle-configure.mjs
COPY rebind-host.mjs /usr/local/lib/cronicle-rebind-host.mjs
COPY entrypoint.sh /usr/local/bin/cronicle-entrypoint
RUN chmod +x /usr/local/bin/cronicle-entrypoint \
    && mkdir -p /opt/cronicle/data /tmp/cronicle-logs /tmp/cronicle-queue \
    && chown -R node:node /opt/cronicle /tmp/cronicle-logs /tmp/cronicle-queue

WORKDIR /opt/cronicle
ENV PORT=3012
EXPOSE 3012
ENTRYPOINT ["tini", "--", "/usr/local/bin/cronicle-entrypoint"]
