// Run from your project root with: node apply-preorder-default.cjs
// Only the known default-tag rule is changed; other server edits are preserved.
const fs = require('node:fs');
const path = require('node:path');
const app = path.resolve('server/app.mjs');
const source = fs.readFileSync(app, 'utf8');
const previous = 'if (creating && !tags.includes("new_arrival")) tags.unshift("new_arrival");';
const replacement = `if (tags.includes("preorder")) {
      tags = tags.filter((tag) => tag !== "new_arrival");
    } else if (creating && !tags.includes("new_arrival")) {
      tags.unshift("new_arrival");
    }`;
if (source.includes(replacement)) {
  console.log('Backend rule already updated.');
} else {
  if (!source.includes(previous) || source.split(previous).length !== 2)
    throw Error('The expected tag rule was not found exactly once. No files changed.');
  fs.writeFileSync(app, source.replace(previous, replacement));
  console.log('Updated server/app.mjs: preorder excludes new_arrival.');
}
