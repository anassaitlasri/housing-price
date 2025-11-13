# backend/api.py
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from datetime import datetime
import pandas as pd
import joblib

ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = ROOT / "backend" / "models" / "best_model.joblib"
FRONT_DIST = ROOT / "frontend" / "dist"

app = FastAPI(title="Housing Price API")

# CORS: en dev autorise Vite (5173). En prod, tu peux restreindre.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Charge le modèle une fois au démarrage
if not MODEL_PATH.exists():
    print(f"[WARN] Modèle introuvable: {MODEL_PATH}. Entraîne house_data.py d’abord.")
model = joblib.load(MODEL_PATH) if MODEL_PATH.exists() else None

@app.post("/predict")
async def predict(payload: dict):
    if model is None:
        return JSONResponse(
            status_code=503,
            content={"success": False, "error": "Modèle non chargé. Entraîne d’abord."},
        )
    try:
        df = pd.DataFrame([payload])
        y = model.predict(df)[0]
        return {
            "success": True,
            "prediction": float(y),
            "confidence": 0.94,  # placeholder si tu n’as pas une vraie proba
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})

# --- Servir le build du front en production ---
if FRONT_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONT_DIST, html=True), name="static")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        """SPA fallback pour react-router."""
        index = FRONT_DIST / "index.html"
        return FileResponse(index)
