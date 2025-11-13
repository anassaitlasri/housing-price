# api/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Dict, List
import pandas as pd
import numpy as np
import joblib, json, os

# --- chemins (adapter si besoin) ---
MODEL_DIR = os.getenv("MODEL_DIR", "./model")
MODEL_PATH = os.path.join(MODEL_DIR, "best_model.joblib")
FEATURE_INFO_PATH = os.path.join(MODEL_DIR, "feature_info.json")

# --- chargements ---
try:
    model = joblib.load(MODEL_PATH)
except Exception as e:
    raise RuntimeError(f"Impossible de charger le modèle: {e}")
# juste après: model = joblib.load(MODEL_PATH)
try:
    REQUIRED_COLS = list(getattr(model, "feature_names_in_", []))
except Exception:
    REQUIRED_COLS = []

feature_info = {}
try:
    with open(FEATURE_INFO_PATH, "r") as f:
        feature_info = json.load(f)
    FEATURE_NAMES: List[str] = feature_info.get("feature_names", [])
except Exception:
    FEATURE_NAMES = []

# --- App FastAPI ---
app = FastAPI(title="Housing Price API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # en prod: restreindre au domaine de votre app Next.js
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- I/O ---
class PredictPayload(BaseModel):
    # Donnez librement un dict {feature: value}; l'API tentera d'aider
    data: Dict[str, Any]
    # Optionnel: renvoyer le vector final passé au modèle
    return_features: bool = False

# --- utilitaires ---
def _as_bool(x):
    if isinstance(x, (bool, np.bool_)):
        return int(bool(x))
    if x is None:
        return 0
    s = str(x).strip().lower()
    return 1 if s in {"1","true","t","yes","y","oui","o","on"} else 0

def _to_float(x, default=np.nan):
    try:
        return float(x)
    except Exception:
        return default

DERIVED_KEYS = {
    # calculs "safe" si inputs bruts existent
    "area_x_mainroad", "luxury_x_area", "bathrooms_x_stories",
    "sqrt_area", "log_area", "area_squared", "total_rooms",
    "area_per_room", "has_heating_cooling", "high_end_parking",
    "multiple_stories", "amenity_score", "volume_score",
}

BASE_HINTS = [
    "area","bedrooms","bathrooms","stories","mainroad","guestroom","basement",
    "hotwaterheating","airconditioning","parking","prefarea","furnishing_numeric",
    # facultatifs si vous les avez:
    "luxury_score","price_per_sqft","size_category"
]

def compute_obvious_derivatives(row: Dict[str, Any]) -> Dict[str, Any]:
    r = dict(row)  # copy

    area = _to_float(r.get("area", np.nan))
    bedrooms = _to_float(r.get("bedrooms", np.nan))
    bathrooms = _to_float(r.get("bathrooms", np.nan))
    stories = _to_float(r.get("stories", np.nan))
    mainroad = _as_bool(r.get("mainroad", 0))
    guestroom = _as_bool(r.get("guestroom", 0))
    basement = _as_bool(r.get("basement", 0))
    hotwater = _as_bool(r.get("hotwaterheating", 0))
    ac = _as_bool(r.get("airconditioning", 0))
    parking = _to_float(r.get("parking", 0))
    prefarea = _as_bool(r.get("prefarea", 0))
    luxury = _to_float(r.get("luxury_score", 0))  # si non fourni, 0

    # Dérivées "évidentes" et génériques (peuvent différer de votre entraînement exact)
    if "area_x_mainroad" not in r and not np.isnan(area):
        r["area_x_mainroad"] = area * mainroad
    if "luxury_x_area" not in r and not np.isnan(area):
        r["luxury_x_area"] = area * luxury
    if "bathrooms_x_stories" not in r and not np.isnan(bathrooms) and not np.isnan(stories):
        r["bathrooms_x_stories"] = bathrooms * stories
    if "sqrt_area" not in r and not np.isnan(area):
        r["sqrt_area"] = np.sqrt(max(area, 0))
    if "log_area" not in r and not np.isnan(area):
        r["log_area"] = np.log1p(max(area, 0))
    if "area_squared" not in r and not np.isnan(area):
        r["area_squared"] = area ** 2
    if "total_rooms" not in r and not np.isnan(bedrooms) and not np.isnan(bathrooms):
        r["total_rooms"] = bedrooms + bathrooms
    if "area_per_room" not in r and not np.isnan(area):
        denom = max(_to_float(r.get("total_rooms", np.nan)), 1)
        r["area_per_room"] = area / denom
    if "has_heating_cooling" not in r:
        r["has_heating_cooling"] = 1 if (hotwater or ac) else 0
    if "multiple_stories" not in r and not np.isnan(stories):
        r["multiple_stories"] = 1 if stories > 1 else 0
    if "high_end_parking" not in r and not np.isnan(parking):
        r["high_end_parking"] = 1 if parking >= 2 else 0
    if "amenity_score" not in r:
        r["amenity_score"] = guestroom + basement + prefarea + r["has_heating_cooling"]
    if "volume_score" not in r and not np.isnan(area) and not np.isnan(stories):
        r["volume_score"] = area * stories

    # Cas compliqués — on laisse tel quel s'ils n'existent pas:
    # - price_per_sqft (souvent dérivé de price → à éviter à l'inférence)
    # - size_category (votre logique d'encodage peut être spécifique)

    return r

def try_predict(row: Dict[str, Any]) -> (float, Dict[str, Any]):
    # 1) normalise les booléens
    bin_keys = ["mainroad","guestroom","basement","hotwaterheating","airconditioning","prefarea"]
    for k in bin_keys:
        if k in row: row[k] = _as_bool(row[k])

    # 2) tentative directe (si ton modèle est un Pipeline qui gère tout)
    df_direct = pd.DataFrame([{k: row[k] for k in row}])
    try:
        y = model.predict(df_direct)[0]
        return float(y), df_direct.iloc[0].to_dict()
    except Exception:
        pass

    # 3) on enrichit (features dérivées) puis on aligne sur les colonnes attendues
    enriched = compute_obvious_derivatives(row)

    # Colonnes finales = priorité à ce que le modèle a vu à l'entraînement
    cols = REQUIRED_COLS or (FEATURE_NAMES if FEATURE_NAMES else list(enriched.keys()))
    final_row = {k: enriched.get(k, np.nan) for k in cols}
    df = pd.DataFrame([final_row])

    # 4) Fallback anti-NaN: remplace NaN/±inf par 0
    df = df.replace([np.inf, -np.inf], np.nan).fillna(0)

    y = model.predict(df)[0]
    return float(y), df.iloc[0].to_dict()

@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": True, "features": FEATURE_NAMES or "unknown"}

@app.post("/predict")
def predict(payload: PredictPayload):
    try:
        pred, used = try_predict(dict(payload.data))
        resp = {"prediction": pred}
        if payload.return_features:
            resp["used_features"] = used
        return resp
    except Exception as e:
        # retour clair avec attentes
        missing = []
        if FEATURE_NAMES:
            missing = [k for k in FEATURE_NAMES if k not in payload.data]
        raise HTTPException(
            status_code=400,
            detail={
                "error": str(e),
                "hint": {
                    "expected_columns": FEATURE_NAMES or "unknown",
                    "recommended_base_inputs": BASE_HINTS
                },
                "missing_keys": missing
            }
        )