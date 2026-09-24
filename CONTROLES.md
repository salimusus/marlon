# Manettes PS5 et Xbox

Dans le menu, **Déplacement** choisit entre un stick relatif à la caméra (par défaut) et la rotation du personnage. Ce choix est indépendant des commandes du clavier. **Sensibilité** règle la caméra ; **Zone morte** réduit la dérive d'un stick usé (12 % par défaut, réglable de 6 à 30 %). Les réglages sont conservés.

| Action | PS5 | Xbox |
| --- | --- | --- |
| Se déplacer | Stick gauche | Stick gauche |
| Tourner la caméra | Stick droit | Stick droit |
| Courir / marcher | L3 | LS |
| Recentrer la caméra | R3 | RS |
| Agir, monter dans un véhicule | △ | Y |
| Sauter ; monter en hélicoptère | ◯ | B |
| Sortir / ranger l'arme | ✕ | A |
| Frapper ; action spéciale du véhicule | ▢ | X |
| Viser avec une arme ; se baisser sans arme | L2 maintenu | LT maintenu |
| Tirer avec l'arme sortie ; accélérer au volant | R2 | RT |
| Freiner / reculer au volant | L2 | LT |
| Pause / reprendre | Options | Menu |
| Valider un menu | ✕ | A |
| Revenir dans un menu | ◯ | B |

Les boutons de jeu conservent leur attribution précédente. Dans les menus, la croix et le stick gauche sélectionnent ; L1/R1 ou LB/RB changent d'onglet. Gauche/droite ajustent un curseur sélectionné. Une commande déjà tenue lors d'un changement d'écran doit être relâchée avant de reprendre ; les autres commandes restent disponibles.

Le bouton **Tester la manette** affiche les axes, les gâchettes, les boutons et leur rôle. Les boutons affichés suivent la famille Xbox ou PlayStation détectée. Le profil standard du navigateur est utilisé pour les deux familles ; le profil HID brut DualSense connu est normalisé séparément.

## Validation de cette refonte

`node harness/gamepad.js` : 21 vérifications, dont 10 exécutent le script complet et ses véritables gestionnaires d'événements avec les périphériques simulés. Elles couvrent déplacements, caméra à 30/60/120 lectures par seconde, pause, changements d'écran, introduction, dérive, gâchettes, déconnexion et coexistence clavier/téléphone/manette.

`node harness/controls-tv.js` : 16 régressions commandes et liaison TV conservées. Les tests simulés ne constituent pas un essai physique de chaque manette, navigateur ou téléviseur.
