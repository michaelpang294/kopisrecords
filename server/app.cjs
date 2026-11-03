// cPanel/Passenger loads CommonJS startup files. The backend remains ESM.
if (typeof PhusionPassenger !== "undefined") {
  PhusionPassenger.configure({ autoInstall: false });
}
import("./server.mjs").catch((error) => {
  console.error("API startup failed:", error.code || error.message);
  process.exitCode = 1;
});
