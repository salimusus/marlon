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
  // LE HOOK EVALUE. shot.js garde le code injecte dans la page dans un LITTERAL DE GABARIT,
  // que Node evalue avant de l'envoyer au navigateur. Une apostrophe echappee une seule fois
  // (\\' au lieu de \\\\') y devient une apostrophe NUE a l'evaluation : la chaine se referme au
  // milieu d'une phrase et la page entiere ne parse plus (« missing ) after argument list »).
  // Le controle ci-dessus ne le voit pas — il lit le HOOK BRUT — et la sonde non plus, car
  // son extraction tronque avant. Resultat au round 69 : plus AUCUNE capture d'ecran pour
  // AUCUN poste, en silence, pendant des heures. On parse donc le HOOK TEL QU'IL SERA INJECTE.
  try {
    const shot = path.join(__dirname, 'shot.js');
    if (fs.existsSync(shot)) {
      const { HOOK } = require(shot);
      if (typeof HOOK === 'string') new (Object.getPrototypeOf(function () {}).constructor)(HOOK);
    }
  } catch (e) {
    console.log('❌ le code injecte dans la page ne parse plus : ' + String(e.message).split('\n')[0]);
    console.log('   (cherche une apostrophe echappee UNE SEULE fois dans le HOOK de shot.js)');
    process.exit(1);
  }
  console.log('✅ le banc d\'essai se charge, et le code injecte dans la page aussi');
}
// LE JEU DOIT DÉMARRER. Une variable déclarée avec `let` ou `const` en milieu de fichier mais
// lue par une fonction appelée AU CHARGEMENT tombe dans la « zone morte temporelle » : la
// syntaxe est parfaite, et pourtant la page reste NOIRE (« Cannot access 'x' before
// initialization »). C'est arrivé au round 67 avec `marquesMesh` et tout le banc d'essai a
// échoué d'un coup, sans que rien ne dise pourquoi. On exécute donc pour de vrai le script du
// jeu dans Node, avec les bouchons de THREE.js et du DOM, puis on construit la ville : toute
// zone morte, tout appel à une fonction inexistante au chargement, se voit immédiatement.
// LINT_RAPIDE=1 saute cette étape (utile en boucle serrée) ; ne la saute pas avant un commit.
if (!process.env.LINT_RAPIDE) {
  const { execFileSync } = require('child_process');
  const runner = path.join(__dirname, 'run.js');
  const code = 'const { run } = require(' + JSON.stringify(runner) + ');'
    + 'const G = run(); G.loadWorld(4);'
    + 'if (!G.solids.length) { console.error("aucun solide apres loadWorld(4)"); process.exit(3); }';
  try {
    execFileSync(process.execPath, ['-e', code], { stdio: 'pipe', env: Object.assign({}, process.env, { JEU: fichier }), timeout: 180000 });
    console.log('✅ le jeu démarre et la ville se construit (aucune zone morte au chargement)');
  } catch (e) {
    const sortie = String(e.stdout || '') + String(e.stderr || '');
    console.log('❌ le jeu NE DÉMARRE PAS :');
    // les lignes du jeu font parfois 5 000 caracteres : on les coupe pour rester lisible
    console.log(sortie.split('\n').filter(l => l.trim()).slice(0, 12).map(l => l.length > 200 ? l.slice(0, 200) + ' …' : l).join('\n'));
    process.exit(1);
  }
}
if (!suspects.length) { console.log('✅ aucun code avalé par un commentaire'); process.exit(0); }
console.log(`❌ ${suspects.length} ligne(s) où un commentaire semble avaler du code :`);
for (const [n, l] of suspects) console.log(`  ${n} : ${l.slice(0, 180)}`);
process.exit(1);
