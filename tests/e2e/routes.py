"""Rutas que se recorren en las pruebas y capturas (SPEC §6: las que existen hoy).

Cada ruta: {"name": nombre corto para ficheros, "hash": "#/…", "what": qué es}.
Los ids salen de los datos (data/map.json, data/index.json, data/grammar_en.json) y de la partida sembrada
(common.seed_plan()): LESSON es la siguiente lección del camino, la que el niño haría ahora.
Las fases nuevas añaden sus rutas con add(name, hash, what); ROUTES y all_routes() las incluyen.
"""
from __future__ import annotations

import json

import common as C

_PLAN = C.seed_plan()
_INDEX = json.loads((C.REPO / "data" / "index.json").read_text(encoding="utf-8"))
_GRAM = json.loads((C.REPO / "data" / "grammar_en.json").read_text(encoding="utf-8"))
_MAP = json.loads((C.REPO / "data" / "map.json").read_text(encoding="utf-8"))

LEVEL = "A1" if "A1" in _MAP else next(iter(_MAP))
LESSON = _PLAN["next_lesson"]                      # A1-010: la siguiente del camino en la partida sembrada
DONE_LESSON = [x for x in _PLAN["done"] if not x.startswith("G-")][-1]   # A1-009: hecha hoy
GRAM_LESSON = _PLAN["next_gram"]                   # G-A1-02: práctica de gramática (prefijo G-)
GRAM_LEVEL = LEVEL if _GRAM.get(LEVEL) else next(k for k, v in _GRAM.items() if v)
_temas = [d for d in _INDEX if d.get("group") == "temas" and "english" in d.get("langs", [])]
_w3000 = [d for d in _INDEX if d.get("group") == "3000" and "english" in d.get("langs", [])]
TOPIC = "animales" if any(d["id"] == "animales" for d in _temas) else _temas[0]["id"]   # tema con dibujos
TOPIC_3000 = "w04" if any(d["id"] == "w04" for d in _w3000) else _w3000[0]["id"]        # un tema de las 3000
ALBUM_DONE = "colores"                             # página del álbum completa en la partida sembrada
GAMES = ["memoria", "lluvia", "globos", "letras"]

# las rutas de hoy (SPEC §6); Aprender › Repasar/Camino/Palabras/Gramática son hoy #/repaso, #/mapa, la lista de
# temas de #/ y #/gramatica
BASE = [
    {"name": "hoy", "hash": "#/", "what": "Inicio / Hoy"},
    {"name": "mapa", "hash": "#/mapa", "what": "Camino (nivel actual)"},
    {"name": f"mapa-{LEVEL}", "hash": f"#/mapa/{LEVEL}", "what": f"Camino, nivel {LEVEL}"},
    {"name": "repaso", "hash": "#/repaso", "what": "Repaso espaciado"},
    {"name": "leccion", "hash": f"#/leccion/{LESSON}", "what": f"Lección {LESSON} (siguiente del camino)"},
    {"name": "leccion-gram", "hash": f"#/leccion/{GRAM_LESSON}", "what": f"Práctica de gramática {GRAM_LESSON}"},
    {"name": f"doc-{TOPIC}", "hash": f"#/doc/{TOPIC}", "what": f"Ficha del tema {TOPIC}"},
    {"name": f"doc-{TOPIC_3000}", "hash": f"#/doc/{TOPIC_3000}", "what": f"Ficha del tema {TOPIC_3000} (3000)"},
    {"name": "gramatica", "hash": "#/gramatica", "what": "Gramática (nivel guardado)"},
    {"name": f"gramatica-{GRAM_LEVEL}", "hash": f"#/gramatica/{GRAM_LEVEL}", "what": f"Gramática {GRAM_LEVEL}"},
    {"name": "juegos", "hash": "#/juegos", "what": "Menú de juegos"},
    *[{"name": f"juego-{g}", "hash": f"#/juegos/{g}", "what": f"Juego {g} (inicio de partida)"} for g in GAMES],
    {"name": "album", "hash": "#/album", "what": "Álbum de pegatinas"},
    {"name": f"album-{ALBUM_DONE}", "hash": f"#/album/{ALBUM_DONE}", "what": "Página del álbum completa"},
    {"name": "album-familia", "hash": "#/album/familia", "what": "Página del álbum con pegatinas nuevas"},
    {"name": "granja", "hash": "#/granja", "what": "Granja y tienda"},
    {"name": "progreso", "hash": "#/progreso", "what": "Premios"},
]

# todas las rutas que se recorren: las de hoy y, detrás, las nuevas de cada fase (add() o NEW.append + ROUTES)
ROUTES: list = list(BASE)
NEW: list = []


def add(name, hash, what=""):
    """Registra una ruta nueva de una fase del rediseño (sin duplicar nombres)."""
    if not any(r["name"] == name for r in ROUTES):
        r = {"name": name, "hash": hash, "what": what}
        NEW.append(r)
        ROUTES.append(r)


def all_routes(only=None):
    """Todas las rutas; only = lista de nombres o subcadenas para quedarse con algunas."""
    rs = list(ROUTES)
    if only:
        rs = [r for r in rs if any(o == r["name"] or o in r["name"] for o in only)]
    return rs
