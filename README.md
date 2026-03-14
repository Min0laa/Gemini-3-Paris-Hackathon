# Gemini-3-Paris-Hackathon

## Environnement de développement

### Prérequis

- **Node.js** (pour le frontend Next.js)
- **Python 3.8+** et pip (pour le backend FastAPI)

### Installation

L'environnement a déjà été configuré. Si tu recommences, exécute :

```bash
# Backend
cd backend && python3 -m venv venv
source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt

# Frontend
cd web-interface && npm install
```

### Lancer les serveurs

**Option 1 – Tout lancer d'un coup :**
```bash
./scripts/dev.sh
```

**Option 2 – Lancer séparément (2 terminaux) :**

Terminal 1 – Backend :
```bash
cd backend && source venv/bin/activate && uvicorn src.main:app --reload --host 0.0.0.0
```

Terminal 2 – Frontend :
```bash
cd web-interface && npm run dev
```

### URLs

| Service   | URL                    |
|----------|------------------------|
| Frontend | http://localhost:3000  |
| Backend  | http://127.0.0.1:8000  |

---

## Extension navigateur (Plasmo)

Extension qui s'insère dans le flux d'upload de **YouTube Studio** pour injecter des divs personnalisées.

### Prérequis

- Node.js 16.14+
- Chrome (ou navigateur Chromium)

### Installation et développement

```bash
cd browser-extension
npm install
npm run dev
```

Le build de développement est généré dans `build/chrome-mv3-dev`.

### Charger l'extension dans Chrome

1. Ouvrir `chrome://extensions`
2. Activer le **mode développeur**
3. Cliquer sur **Charger l'extension non empaquetée**
4. Sélectionner le dossier `browser-extension/build/chrome-mv3-dev`

### Tester l'injection

Aller sur [YouTube Studio – Upload](https://studio.youtube.com/channel/UC913LK1hsmuojOPIqKLxarg/videos/upload) (ou ta propre chaîne). Le panneau de l'extension doit apparaître dans le flux de la page.

### Commandes

| Commande | Description |
|----------|-------------|
| `npm run dev` | Dev avec rechargement automatique |
| `npm run build` | Build de production → `build/chrome-mv3-prod` |
| `npm run package` | Génère un zip pour distribution |

### Déploiement avec Itero

[Itero](https://itero.plasmo.com/) déploie l'extension à tes beta testeurs à chaque push GitHub :

1. Connecter le repo à [itero.plasmo.com](https://itero.plasmo.com/)
2. Configurer le root du projet sur `browser-extension/` si nécessaire (monorepo)