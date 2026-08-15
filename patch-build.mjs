import { readFileSync, writeFileSync } from "node:fs";

const buildPath = "bin/build-tools.js";
const buildSource = readFileSync(buildPath, "utf8");
const originalRegex = "([^]+)";
if (!buildSource.includes(originalRegex)) {
  throw new Error("Expected Cronicle bundle regex was not found");
}
writeFileSync(buildPath, buildSource.replace(originalRegex, "([\\\\s\\\\S]+)"));
