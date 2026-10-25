# Hodari School - Gestion scolaire + plateforme d'apprentissage

Stack : **FastAPI** - **PostgreSQL** - **React (Vite)** - **Tailwind CSS** - Docker.

## Lancer
```bash
docker compose up --build
```
Ouvrir **http://localhost:8080** (API : `/api/docs`). Repartir de zéro : `docker compose down -v`.
Une base existante est migrée automatiquement (nouvelles colonnes, comptes élèves et professeurs créés au démarrage).

## Connexion (un seul formulaire, le rôle vient du compte)
| Rôle | Identifiant | Mot de passe initial |
|---|---|---|
| Administrateur | `admin` | `admin123` (changement obligatoire à la première connexion) |
| Professeur (démo) | `t.kalala`, `t.nsimba`, `t.mukendi`, `t.ilunga` | `teacher123` (changement obligatoire) |
| Élève | son **numéro d'élève** (ex. `ST001`) | `12345` (changement obligatoire) |

Les comptes élèves sont créés automatiquement avec l'élève. Les professeurs se créent dans **Users** (mot de passe
temporaire aléatoire affiché une seule fois). Un mot de passe oublié se réinitialise dans **Users** ou dans la liste des élèves.

## Sécurité
- Permissions vérifiées **côté serveur** (un professeur ne voit que ses cours et ses classes, un élève que ses données).
- Changement de mot de passe **obligatoire** au premier accès ; `12345` est refusé comme nouveau mot de passe.
- Verrouillage de 10 minutes après 5 échecs de connexion.
- Fichiers remis : 10 Mo maximum, types limités (PDF, Office, images, texte, ZIP), stockés dans le volume `uploads`.

## Ce que chaque rôle peut faire
**Administrateur** : élèves, classes, utilisateurs (professeurs, admins, réinitialisation), cours et affectation des professeurs,
annonces, calendrier, notes, présences, exports Excel/PDF, bulletins.

**Professeur** : ses cours (contenus, devoirs, **quiz**), correction des remises (texte, lien, fichier) avec notes et
commentaires, résultats et statistiques des quiz, présences et notes de ses classes, annonces pour ses classes.

**Élève** : tableau de bord, cours, **remise des devoirs** (texte, lien, fichier), **quiz** corrigés automatiquement avec
correction détaillée, notes et bulletin PDF, présences, annonces, calendrier.

## Production
Changer `SECRET_KEY` et le mot de passe PostgreSQL dans `docker-compose.yml`. Sauvegarder les volumes `pgdata` et `uploads`.
