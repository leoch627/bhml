import json
import os
from pathlib import Path
from typing import Any, Dict

from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
ADMIN_TOKEN = os.environ.get("BHML_ADMIN_TOKEN", "dev-token")

app = Flask(__name__, static_folder=None)


def _read_json(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, payload: Dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp_path.replace(path)


def _get_token() -> str:
    header = request.headers.get("Authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    return request.headers.get("X-Admin-Token", "").strip()


def _require_auth() -> bool:
    return _get_token() == ADMIN_TOKEN


ALLOWED_EXTENSIONS = {'.html', '.css', '.js', '.json', '.txt', '.md', '.py'}
IGNORED_DIRS = {'.git', '.venv', '__pycache__', '.idea', '.vscode'}
IGNORED_FILES = {'server.py', 'bhml.db'}

def _is_safe_path(path_str: str) -> bool:
    try:
        requested_path = (BASE_DIR / path_str).resolve()
        return BASE_DIR in requested_path.parents or requested_path.parent == BASE_DIR
    except Exception:
        return False

@app.route("/api/fs/list", methods=["GET"])
def api_fs_list():
    if not _require_auth():
        return jsonify({"error": "unauthorized"}), 401
    
    files_list = []
    for root, dirs, files in os.walk(BASE_DIR):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
        
        rel_root = Path(root).relative_to(BASE_DIR)
        
        for f in files:
            if f in IGNORED_FILES:
                continue
            if Path(f).suffix.lower() in ALLOWED_EXTENSIONS:
                 full_rel_path = rel_root / f
                 path_str = f if str(full_rel_path) == "." else str(full_rel_path).replace("\\", "/")
                 files_list.append(path_str)
                     
    files_list.sort()
    return jsonify({"files": files_list})

@app.route("/api/fs/file", methods=["GET", "POST"])
def api_fs_file():
    if not _require_auth():
        return jsonify({"error": "unauthorized"}), 401
        
    path_param = request.args.get("path")
    if not path_param:
        return jsonify({"error": "missing_path"}), 400
        
    if not _is_safe_path(path_param):
         return jsonify({"error": "invalid_path"}), 403

    target_path = BASE_DIR / path_param
    
    if request.method == "GET":
        if not target_path.exists():
            return jsonify({"error": "not_found"}), 404
        try:
            content = target_path.read_text(encoding="utf-8")
            return jsonify({"content": content})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    if request.method == "POST":
        payload = request.get_json(silent=True)
        if not payload or "content" not in payload:
             return jsonify({"error": "missing_content"}), 400
        
        try:
            target_path.write_text(payload["content"], encoding="utf-8")
            return jsonify({"ok": True})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

@app.route("/api/teams", methods=["GET", "POST"])
def api_teams():
    if not _require_auth():
        return jsonify({"error": "unauthorized"}), 401

    if request.method == "GET":
        return jsonify(_read_json(DATA_DIR / "teams.json"))

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or "teams" not in payload:
        return jsonify({"error": "invalid_payload", "hint": "Expected object with 'teams'."}), 400

    _write_json(DATA_DIR / "teams.json", payload)
    return jsonify({"ok": True})


@app.route("/api/matches", methods=["GET", "POST"])
def api_matches():
    if not _require_auth():
        return jsonify({"error": "unauthorized"}), 401

    if request.method == "GET":
        return jsonify(_read_json(DATA_DIR / "matches.json"))

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or "matches" not in payload:
        return jsonify({"error": "invalid_payload", "hint": "Expected object with 'matches'."}), 400

    _write_json(DATA_DIR / "matches.json", payload)
    return jsonify({"ok": True})


@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/admin")
def admin_redirect():
    return send_from_directory(BASE_DIR, "admin.html")


@app.route("/<path:path>")
def static_files(path: str):
    return send_from_directory(BASE_DIR, path)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
