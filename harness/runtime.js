'use strict';
const path = require('path');
let playwright;
try { playwright = require('playwright'); }
catch (e) {
  const root = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  if (!root) throw new Error('Installez Playwright : npm install --save-dev playwright, puis npx playwright install chromium.');
  playwright = require(path.join(root, 'playwright'));
}
module.exports = { playwright };
