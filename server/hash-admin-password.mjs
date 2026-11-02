import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { hashPassword } from "./admin-auth.mjs";
const muted = new Writable({
  write(chunk, encoding, callback) {
    callback();
  },
});
const rl = createInterface({
  input: process.stdin,
  output: muted,
  terminal: true,
});
function ask(message) {
  process.stdout.write(message);
  return new Promise((resolve) =>
    rl.question("", (answer) => {
      process.stdout.write("\n");
      resolve(answer);
    }),
  );
}
try {
  const first = await ask(
    "Choose admin password (12–256 characters; input hidden): ",
  );
  const second = await ask("Confirm password: ");
  if (first.length < 12 || first.length > 256)
    throw Error("Use 12–256 characters.");
  if (first !== second) throw Error("Passwords do not match.");
  console.log(
    "\nAdd this line to your existing server/.env, then restart npm start:\n",
  );
  console.log("ADMIN_PASSWORD_HASH=" + (await hashPassword(first)));
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  rl.close();
}
