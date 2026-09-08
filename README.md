# SuperObby

Un jeu de plateforme et de ville ouverte en 3D qui tient dans **un seul fichier HTML**
(`index.html`). Pas d'installation, pas de serveur : on ouvre le fichier dans un
navigateur et on joue.

- 4 parcours d'obstacles + une grande ville (banque, commissariat, villas, cinéma,
  armurerie, école, hôpital, parc, plage, circuit de course…)
- Véhicules, hélicoptère, jet-ski, parachute et deltaplane
- Garage custom : peinture (toutes couleurs, métallisé, fluo), aileron, jupes, grosses
  jantes, becquet, vitres teintées, nom sur la portière, double échappement, caisse
  rabaissée, moteur apparent, trois moteurs (100/300/500 ch), amortisseurs et nitro
- Douze habitants qui vivent leur vie : tennis, foot, vélo, moto, cinéma, plage — et
  parfois un chapardage ou un braquage
- Boutique de vêtements complète (chapeaux, bandanas, maillots, débardeur, torse nu,
  baggy, short, chaussures, bottes, bottes de cowboy, bracelet, montre…) et salon de
  tatouage : animaux, symboles, idéogrammes ou texte libre, en six encres, trois
  tailles et onze zones du corps
- Gangs : le joueur recrute ses amis (« Nathan veux-tu venir dans le gang ? ») et leur
  confie des missions — voler de l'argent, braquer la banque ou une boutique, voler une
  voiture, cambrioler une villa, attaquer un gang rival, faire le guet
- Trois gangs rivaux autonomes (bandana rouge, bleu ou jaune, voitures customisées) qui
  s'en prennent aux boutiques, aux joueurs, aux autres gangs — et à ta villa : l'alarme
  achetée chez « Maison & Déco » est livrée avec une montre qui clignote en rouge, et il
  reste à rentrer chez soi (ou à y envoyer son gang) pour faire fuir les cambrioleurs
- « La Zone » : un quartier pauvre avec ses immeubles de trois étages ouverts (escaliers
  extérieurs, coursives, appartements meublés, toits), ses carcasses de voitures, ses
  poubelles, ses tags, ses affiches déchirées et ses chiens errants
- Amis bots qui obéissent aux ordres écrits ou dictés au micro (jusqu'à « tire pour me
  protéger »), chien à adopter
- Braquages, police et armée
- Multijoueur en pair à pair (PeerJS), chacun sur son appareil

## Jouer

Ouvrir `index.html` dans un navigateur récent (Chrome, Edge, Firefox, Safari).
Pour jouer à plusieurs — et pour que les QR codes du mode TV soient utiles — le fichier
doit être servi par une adresse que les autres appareils peuvent atteindre. Le dépôt est
prêt pour GitHub Pages : le jeu étant à la racine sous `index.html`, il suffit d'activer
Pages sur la branche pour obtenir une adresse publique.

### Sur la télé, avec le téléphone comme manette

1. Sur la télé (ou l'ordinateur branché dessus), cliquer sur **📺** en haut de l'écran.
2. Le jeu passe en affichage géant et montre deux QR codes :
   - le premier transforme un téléphone en **manette** (stick, caméra, boutons, chat et micro) ;
   - le second, après « Ouvrir la partie aux amis », permet à d'autres joueurs de
     **rejoindre la ville** d'un simple scan.
3. Sans QR code, il suffit d'ouvrir le jeu sur le téléphone, de choisir
   « 🎮 Servir de manette » et de taper le code à 4 lettres affiché sur la télé.

Une manette de salon (Xbox, PlayStation, générique USB ou Bluetooth) fonctionne aussi :
sticks pour bouger et regarder, A pour sauter, B pour agir, X pour frapper, Y pour
dégainer, gâchettes pour tirer et courir, croix directionnelle pour naviguer dans les
menus.

### Clavier

`Z Q S D` déplacement · `Espace` sauter · `E` agir / monter en voiture · `G` dégainer ·
`X` tirer · `V` frapper · `F` course · `/` chat · `Échap` menu.

## Banc d'essai

Le dossier `harness/` contient une suite de tests jouée dans un vrai Chromium
(Playwright) : chaque comportement du jeu y est mesuré, pas seulement vérifié.

```sh
node harness/play.js                      # toute la suite
FILTRE='parachute' node harness/play.js   # un sous-ensemble
node harness/shot.js                      # captures d'écran
```

`shots/` rassemble les captures de référence.
