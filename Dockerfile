FROM docker.io/library/node:22.23.3-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS build

ARG CRONICLE_VERSION=0.9.137
ARG CRONICLE_SHA256=34f65d8c009830562288e13c77ec3f69530e0528a74523c1b09479fc2dec80e3

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

FROM docker.io/library/node:22.23.3-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392

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
