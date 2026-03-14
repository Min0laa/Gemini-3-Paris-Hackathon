#!/bin/bash
# Script pour lancer backend + frontend en développement

cd "$(dirname "$0")/.."

echo "🚀 Démarrage des serveurs de développement..."
echo ""
echo "  Backend (FastAPI): http://127.0.0.1:8000"
echo "  Frontend (Next.js): http://localhost:3000"
echo ""
echo "Appuyez sur Ctrl+C pour arrêter les deux serveurs."
echo ""

# Lancer backend et frontend en parallèle
(cd backend && source venv/bin/activate && uvicorn src.main:app --reload --host 0.0.0.0) &
BACKEND_PID=$!

(cd web-interface && npm run dev) &
FRONTEND_PID=$!

# Gérer Ctrl+C pour arrêter les deux
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait
