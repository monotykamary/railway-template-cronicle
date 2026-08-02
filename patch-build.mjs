import { readFileSync, writeFileSync } from "node:fs";

const buildPath = "bin/build-tools.js";
const buildSource = readFileSync(buildPath, "utf8");
const originalRegex = "([^]+)";
if (!buildSource.includes(originalRegex)) {
  throw new Error("Expected Cronicle bundle regex was not found");
}
writeFileSync(buildPath, buildSource.replace(originalRegex, "([\\\\s\\\\S]+)"));

const storagePath = "bin/storage-cli.js";
const storageSource = readFileSync(storagePath, "utf8");
const originalHash = "user.password = bcrypt.hashSync( user.password + user.salt );";
const compatibleHash = "user.password = bcrypt.hashSync( user.password + user.salt ).replace(/^\\$2b\\$/, '$2a$');";
if (!storageSource.includes(originalHash)) {
  throw new Error("Expected Cronicle administrator hash statement was not found");
}
writeFileSync(storagePath, storageSource.replace(originalHash, () => compatibleHash));
