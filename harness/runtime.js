'use strict';
const path = require('path');
let playwright;
// Playwright peut vivre a trois endroits : dans node_modules du projet, dans un dossier
// designe par l'environnement, ou installe GLOBALEMENT (c'est le cas de la machine du banc
// d'essai : /opt/node22/lib/node_modules). On essaie les trois avant de renoncer — sinon
// shot.js, play.js et sonde.js refusent tous de demarrer, et le lint le signale a tort
// comme « le code injecte dans la page ne parse plus ».
const candidats = [
  'playwright',
  process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES && path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright'),
  '/opt/node22/lib/node_modules/playwright',
].filter(Boolean);
let derniere;
for (const c of candidats) { try { playwright = require(c); break; } catch (e) { derniere = e; } }
if (!playwright) throw new Error('Installez Playwright : npm install --save-dev playwright, puis npx playwright install chromium. (' + (derniere && derniere.message.split('\n')[0]) + ')');
module.exports = { playwright };
