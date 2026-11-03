// cPanel/Passenger loads CommonJS startup files. The backend remains ESM.
const fs = require("node:fs");
const path = require("node:path");
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
if (typeof PhusionPassenger !== "undefined") {
  PhusionPassenger.configure({ autoInstall: false });
}
import("./server.mjs").catch((error) => {
  console.error("API startup failed:", error.code || error.message);
  process.exitCode = 1;
});
