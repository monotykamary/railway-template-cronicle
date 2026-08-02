FROM docker.io/library/node:22.22.0-bookworm-slim@sha256:7cc56ef285a8568121537d17b05e72128f01b89c54607b51acf084a50ef483f3 AS build

ARG CRONICLE_VERSION=0.9.125
ARG CRONICLE_SHA256=3baeebce35d639bb1b47ebbecc131518789b2c81944d483dbd780d1efd85595a

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

FROM docker.io/library/node:22.22.0-bookworm-slim@sha256:7cc56ef285a8568121537d17b05e72128f01b89c54607b51acf084a50ef483f3

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
