import os from "node:os";
import process from "node:process";
import { createRequire } from "node:module";

process.chdir("/opt/cronicle");
const require = createRequire("/opt/cronicle/package.json");
const StandaloneStorage = require("pixl-server-storage/standalone");
const Tools = require("pixl-tools");
const config = require("/opt/cronicle/conf/config.json");

config.Storage.debug = false;
config.Storage.transactions = false;
config.Storage.log_event_types = {};

const hostname = (process.env.HOSTNAME || os.hostname()).toLowerCase();
const addresses = Object.values(os.networkInterfaces()).flat().filter(Boolean);
const address = addresses.find((item) => item.family === "IPv4" && !item.internal);
if (!address) throw new Error("Could not determine Cronicle server IPv4 address");
const ip = address.address;
const configuredUsername = (process.env.CRONICLE_ADMIN_USERNAME || "admin").toLowerCase();
const normalizedUsername = configuredUsername.replace(/\W+/g, "");
if (!normalizedUsername) throw new Error("CRONICLE_ADMIN_USERNAME has no storage-safe characters");

const storage = await new Promise((resolve, reject) => {
  const instance = new StandaloneStorage(config.Storage, (error) => error ? reject(error) : resolve(instance));
});

const call = (method, ...args) => new Promise((resolve, reject) => {
  storage[method](...args, (error, result) => error ? reject(error) : resolve(result));
});
const getOptional = (key) => new Promise((resolve, reject) => {
  storage.get(key, (error, result) => {
    if (error?.code === "NoSuchKey") resolve(null);
    else if (error) reject(error);
    else resolve(result);
  });
});

try {
  if (configuredUsername !== normalizedUsername) {
    const legacyKey = `users/${configuredUsername}`;
    const normalizedKey = `users/${normalizedUsername}`;
    const [legacyUser, normalizedUser] = await Promise.all([
      getOptional(legacyKey),
      getOptional(normalizedKey)
    ]);
    if (legacyUser && normalizedUser) {
      const sameAccount = legacyUser.password === normalizedUser.password
        && legacyUser.salt === normalizedUser.salt;
      if (!sameAccount) throw new Error(`Cronicle username normalization collision: ${configuredUsername}`);
      await call("delete", legacyKey);
    }
    else if (legacyUser) {
      legacyUser.username = normalizedUsername;
      await call("put", normalizedKey, legacyUser);
      await call("delete", legacyKey);
      console.log(`Cronicle administrator storage key migrated to ${normalizedUsername}`);
    }
  }
  await call("listFindUpdate", "global/server_groups", { id: "maingrp" }, {
    regexp: `^(${Tools.escapeRegExp(hostname)})$`
  });
  const servers = await new Promise((resolve, reject) => {
    storage.listGet("global/servers", 0, 100, (error, items) => error ? reject(error) : resolve(items));
  });
  if (!servers.length) throw new Error("Cronicle server list is empty");
  await call("listFindUpdate", "global/servers", { hostname: servers[0].hostname }, { hostname, ip });
} finally {
  await new Promise((resolve) => storage.shutdown(resolve));
}

console.log(`Cronicle single-node identity bound to ${hostname}`);
