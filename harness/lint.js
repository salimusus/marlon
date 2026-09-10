'use strict';
// Vérificateur maison : deux vraies pannes du jeu sont venues d'un commentaire // ajouté au
// MILIEU d'une ligne, qui avalait le code qui suivait (la flottaison du nageur, puis la
// rotation des voitures de police). On relit donc chaque commentaire de fin de ligne et on
// signale ceux qui ressemblent à du JavaScript avalé.
const fs = require('fs'), path = require('path');
const fichier = process.argv[2] || path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(fichier, 'utf8');
const i = src.lastIndexOf('<script>'), j = src.lastIndexOf('</script>');
const lignes = src.slice(i + 8, j).split('\n');
// Une instruction avalée commence par un identifiant suivi d'un « = », d'un « ( » ou d'un
// « += », et contient un point ou une parenthèse. Une phrase française, elle, n'a pas cette
// forme : « FY = dessus de la dalle » ou « nuit de 20 h à 6 h » ne déclenchent rien.
const INSTRUCTION = /^\s*[A-Za-z_$][\w.$\[\]]*\s*(\(|[-+*/]?=[^=])/;
const suspects = [];
lignes.forEach((l, k) => {
  const m = /(?<![:"'`\/])\/\/(?!\/)(.*)$/.exec(l);
  if (!m) return;
  const c = m[1];
  if (!c.includes(';') || /https?:/.test(c)) return;
  const morceaux = c.split(';').slice(1);          // ce qui suit un point-virgule dans le commentaire
  if (!morceaux.some(x => INSTRUCTION.test(x) && (x.includes('.') || x.includes('(')))) return;
  suspects.push([k + 1, l.trim()]);
});
// Vérification de SYNTAXE : une apostrophe non échappée dans une chaîne, une parenthèse
// oubliée, et la page ne démarre plus du tout. Le banc d'essai mettait plusieurs minutes à
// le dire ; ici c'est immédiat.
{
  let dur = false;
  const blocs = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  blocs.forEach((b, i) => {
    try { new Function(b[1]); }
    catch (e) { dur = true; console.log(`❌ erreur de syntaxe dans le script #${i + 1} : ${e.message}`); }
  });
  if (dur) process.exit(1);
  console.log(`✅ syntaxe JavaScript valide (${blocs.length} bloc${blocs.length > 1 ? 's' : ''})`);
}
// Le BANC D'ESSAI lui-même doit se charger. Le HOOK de shot.js est un littéral de gabarit :
// un commentaire écrit avec des accents graves autour d'un mot y ferme la chaîne, et plus
// rien ne démarre. On vérifie donc aussi la syntaxe des deux fichiers du banc.
{
  const { execFileSync } = require('child_process');
  let dur = false;
  for (const f of ['shot.js', 'play.js', 'sonde.js']) {
    const chemin = path.join(__dirname, f);
    if (!fs.existsSync(chemin)) continue;
    try { execFileSync(process.execPath, ['--check', chemin], { stdio: 'pipe' }); }
    catch (e) { dur = true; console.log(`❌ erreur de syntaxe dans harness/${f} : ${String(e.stderr || e.message).split('\n').slice(0, 3).join(' ').trim()}`); }
  }
  if (dur) process.exit(1);
  console.log('✅ le banc d\'essai se charge');
}
if (!suspects.length) { console.log('✅ aucun code avalé par un commentaire'); process.exit(0); }
console.log(`❌ ${suspects.length} ligne(s) où un commentaire semble avaler du code :`);
for (const [n, l] of suspects) console.log(`  ${n} : ${l.slice(0, 180)}`);
process.exit(1);
