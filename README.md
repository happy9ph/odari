# Hodari School – Gestion scolaire + plateforme d'apprentissage (type Moodle)

Stack : **FastAPI** · **PostgreSQL** · **React (Vite)** · **Tailwind CSS** · Docker.

## Lancer
```bash
sudo docker compose up --build
```
Ouvrir **http://localhost:8080** (API : `/api/docs`). Repartir de zéro : `sudo docker compose down -v`.

## Connexion (un seul compte : administrateur)
| Identifiant | Mot de passe |
|---|---|
| `admin` | `admin123` |

Il n'y a plus de comptes Teacher / Student : l'administrateur gère tout. Les anciens comptes `teacher` et `student`
sont supprimés automatiquement au démarrage. Le mot de passe se change dans le menu (icône clé).

## Fonctionnalités
**Gestion scolaire**
- Tableau de bord · élèves (CRUD, recherche, pagination) · classes
- Notes par classe / matière / trimestre · bulletin PDF · export Excel et PDF

**Plateforme d'apprentissage (type Moodle)**
- **Cours** : une page par cours (classe, enseignant, couleur) avec **contenus** (leçon, fichier, vidéo, lien, note),
  **devoirs** (date limite, note max) et **participants**
- **Devoirs** : suivi des remises (manquant / remis / en retard), **notation et commentaires** élève par élève
- **Présences** : registre quotidien par classe (présent / absent / retard / excusé) et **statistiques** par élève
- **Annonces** : pour toute l'école ou une classe, épinglage
- **Calendrier** : examens, congés, réunions + dates limites des devoirs ajoutées automatiquement
- Tableau de bord enrichi : cours, devoirs ouverts, copies à noter, taux de présence, annonces, prochains événements
- Interface sans emojis (icônes Lucide), polices auto-hébergées (Inter + Plus Jakarta Sans), mode sombre, responsive, notifications et confirmations

## Production
Changer `SECRET_KEY`, le mot de passe `admin` (menu) et celui de PostgreSQL ; retirer le pré-remplissage des
identifiants dans `frontend/src/App.jsx` (constante `DEMO`).
