"""
El Cado - gestor de la peÃ±a
----------------------------
Backend Flask + SQLite.

Roles:
- El primer socio que se crea (cuando la base de datos estÃ¡ vacÃ­a) se
  convierte automÃ¡ticamente en administrador.
- Solo el administrador puede: aÃ±adir socios, dar de baja/reactivar
  socios, renombrar la peÃ±a, y aÃ±adir/borrar movimientos de caja
  (gastos e ingresos).
- Cualquier socio puede: marcar SU PROPIA cuota (el admin puede marcar
  cualquiera), reservar la peÃ±a, apuntarse a tareas, editar su propio
  perfil (incluido su nombre), y ver todo en modo lectura.

Para arrancar en local:
    pip install -r requirements.txt
    python app.py
"""
import os
import random
import sqlite3
import uuid
import json
from contextlib import closing
from datetime import date, datetime
from io import BytesIO

from flask import Flask, g, jsonify, request, session, send_from_directory, render_template, send_file
from werkzeug.security import generate_password_hash, check_password_hash

try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill
    OPENPYXL_OK = True
except ImportError:
    OPENPYXL_OK = False

try:
    from PIL import Image, ImageOps
    PIL_OK = True
except ImportError:
    PIL_OK = False

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.abspath(os.environ.get("DATABASE_PATH", os.path.join(BASE_DIR, "pena.db")))
AVATARS_DIR = os.path.abspath(os.environ.get("AVATARS_DIR", os.path.join(BASE_DIR, "static", "avatars")))

app = Flask(__name__)
# En producciÃ³n, define la variable de entorno SECRET_KEY con un valor propio.
app.secret_key = os.environ.get("SECRET_KEY", "cambia-esta-clave-en-produccion")

TAREAS_FIJAS = ["Compras", "Limpieza", "TesorerÃ­a", "Carrozas", "Concursos", "Comidas", "Otros"]

PERMISSIONS = {
    "manage_roles": "Manage roles and permissions",
    "manage_socios": "Manage members",
    "manage_config": "Manage club configuration",
    "view_finances": "View finances",
    "manage_finances": "Manage income and expenses",
    "manage_cuotas": "Manage all fees",
    "manage_bebidas": "Manage drinks and prices",
    "manage_inventory": "Manage inventory",
    "manage_events": "Manage meetings and reservations",
    "manage_tasks": "Assign tasks",
    "export_data": "Export data",
}
ALL_PERMISSIONS = list(PERMISSIONS)
DEFAULT_ROLES = [
    ("administrador", "Administrador", ALL_PERMISSIONS, 1),
    ("presidente", "Presidente", ["manage_config", "manage_socios", "view_finances", "manage_events", "manage_tasks", "export_data"], 1),
    ("vicepresidente", "Vicepresidente", ["view_finances", "manage_events", "manage_tasks", "export_data"], 1),
    ("tesorero", "Tesorero", ["view_finances", "manage_finances", "manage_cuotas", "manage_bebidas", "export_data"], 1),
    ("socio", "Socio", [], 1),
    ("otro", "Otro", [], 1),
]
SCHEMA = """
CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    nombre TEXT NOT NULL,
    cuota_mensual REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS socios (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    activo INTEGER NOT NULL DEFAULT 1,
    pin_hash TEXT,
    must_change_pin INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS perfiles (
    socio_id TEXT PRIMARY KEY,
    telefono TEXT DEFAULT '',
    notas TEXT DEFAULT '',
    FOREIGN KEY (socio_id) REFERENCES socios(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS familiares (
    id TEXT PRIMARY KEY,
    socio_id TEXT NOT NULL,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL,
    edad TEXT DEFAULT '',
    FOREIGN KEY (socio_id) REFERENCES socios(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS cuotas (
    id TEXT PRIMARY KEY,
    socio_id TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    importe REAL NOT NULL,
    pagado INTEGER NOT NULL DEFAULT 0,
    fecha TEXT,
    UNIQUE(socio_id, year, month)
);
CREATE TABLE IF NOT EXISTS reuniones (
    id TEXT PRIMARY KEY,
    fecha TEXT NOT NULL,
    hora_inicio TEXT,
    hora_fin TEXT,
    socio_id TEXT,
    evento TEXT NOT NULL,
    notas TEXT DEFAULT '',
    creado_en TEXT
);
CREATE TABLE IF NOT EXISTS asistencia (
    reunion_id TEXT NOT NULL,
    socio_id TEXT NOT NULL,
    PRIMARY KEY (reunion_id, socio_id)
);
CREATE TABLE IF NOT EXISTS inventario (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    categoria TEXT NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1,
    estado TEXT NOT NULL DEFAULT 'Bien',
    notas TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS movimientos (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL,
    categoria TEXT NOT NULL,
    concepto TEXT NOT NULL,
    importe REAL NOT NULL,
    fecha TEXT NOT NULL,
    socio_id TEXT
);
CREATE TABLE IF NOT EXISTS bebidas_precios (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    unidad TEXT NOT NULL,
    precio_socio REAL NOT NULL,
    precio_no_socio REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS bebidas_consumos (
    id TEXT PRIMARY KEY,
    fecha TEXT NOT NULL,
    consumidor TEXT NOT NULL,
    es_socio INTEGER NOT NULL,
    bebida_id TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    importe REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS fiestas_gastos (
    id TEXT PRIMARY KEY,
    fecha TEXT NOT NULL,
    evento TEXT NOT NULL,
    concepto TEXT NOT NULL,
    importe REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS reservas (
    id TEXT PRIMARY KEY,
    fecha TEXT NOT NULL,
    hora_inicio TEXT DEFAULT '',
    hora_fin TEXT DEFAULT '',
    socio_id TEXT NOT NULL,
    evento TEXT NOT NULL,
    notas TEXT DEFAULT '',
    creado_en TEXT
);
CREATE TABLE IF NOT EXISTS tareas_asignadas (
    id TEXT PRIMARY KEY,
    tarea TEXT NOT NULL,
    socio_id TEXT NOT NULL,
    UNIQUE(tarea, socio_id)
);
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    permisos TEXT NOT NULL DEFAULT '[]',
    es_sistema INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS socio_roles (
    socio_id TEXT NOT NULL,
    rol_id TEXT NOT NULL,
    PRIMARY KEY (socio_id, rol_id),
    FOREIGN KEY (socio_id) REFERENCES socios(id) ON DELETE CASCADE,
    FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE
);
"""


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    with closing(sqlite3.connect(DB_PATH)) as db:
        db.row_factory = sqlite3.Row
        db.executescript(SCHEMA)
        try:
            db.execute("ALTER TABLE socios ADD COLUMN pin_hash TEXT")
        except sqlite3.OperationalError:
            pass  # ya existÃ­a (base de datos creada con una versiÃ³n anterior)
        try:
            db.execute("ALTER TABLE socios ADD COLUMN must_change_pin INTEGER NOT NULL DEFAULT 0")
        except sqlite3.OperationalError:
            pass
        try:
            db.execute("ALTER TABLE movimientos ADD COLUMN socio_id TEXT")
        except sqlite3.OperationalError:
            pass
        # MigraciÃ³n: actualizar tabla reuniones si existe con estructura antigua
        try:
            cur = db.execute("PRAGMA table_info(reuniones)")
            columns = [row[1] for row in cur.fetchall()]
            if "titulo" in columns and "evento" not in columns:
                # Migrar estructura antigua a nueva
                db.execute("ALTER TABLE reuniones RENAME TO reuniones_old")
                db.execute("""CREATE TABLE reuniones (
                    id TEXT PRIMARY KEY,
                    fecha TEXT NOT NULL,
                    hora_inicio TEXT,
                    hora_fin TEXT,
                    socio_id TEXT,
                    evento TEXT NOT NULL,
                    notas TEXT DEFAULT '',
                    creado_en TEXT
                )""")
                db.execute("""INSERT INTO reuniones (id, fecha, evento, notas, creado_en, socio_id)
                    SELECT id, fecha, titulo, notas, creado_en, creado_por FROM reuniones_old""")
                db.execute("DROP TABLE reuniones_old")
        except sqlite3.OperationalError:
            pass
        cur = db.execute("SELECT COUNT(*) AS n FROM config")
        if cur.fetchone()["n"] == 0:
            db.execute(
                "INSERT INTO config (id, nombre, cuota_mensual) VALUES (1, ?, ?)",
                ("El Cado", 45),
            )
        else:
            row = db.execute("SELECT cuota_mensual FROM config WHERE id = 1").fetchone()
            if row and (row["cuota_mensual"] in (None, "", 20, 20.0)):
                db.execute("UPDATE config SET cuota_mensual = ? WHERE id = 1", (45,))
        for role_id, nombre, permisos, es_sistema in DEFAULT_ROLES:
            db.execute(
                "INSERT OR IGNORE INTO roles (id, nombre, permisos, es_sistema) VALUES (?, ?, ?, ?)",
                (role_id, nombre, json.dumps(permisos), es_sistema),
            )
        # Las instalaciones previas solo tenían is_admin. Se traduce a un rol asignado.
        for socio in db.execute("SELECT id, is_admin FROM socios"):
            default_role = "administrador" if socio["is_admin"] else "socio"
            db.execute(
                "INSERT OR IGNORE INTO socio_roles (socio_id, rol_id) VALUES (?, ?)",
                (socio["id"], default_role),
            )
        db.commit()


def new_id():
    return uuid.uuid4().hex[:12]


def now_iso():
    return datetime.now().isoformat(timespec="seconds")


def current_socio_id():
    return session.get("socio_id")


def require_login():
    """Devuelve el id del socio en sesiÃ³n, o None. Limpia la sesiÃ³n si el socio ya no existe."""
    sid = current_socio_id()
    if not sid:
        return None
    db = get_db()
    row = db.execute("SELECT id FROM socios WHERE id = ?", (sid,)).fetchone()
    if not row:
        session.pop("socio_id", None)
        return None
    return sid


def is_admin_user(sid):
    return has_permission(sid, "manage_roles")


def permissions_for_user(sid):
    if not sid:
        return set()
    db = get_db()
    rows = db.execute(
        "SELECT r.permisos FROM roles r JOIN socio_roles sr ON sr.rol_id = r.id WHERE sr.socio_id = ?",
        (sid,),
    ).fetchall()
    permisos = set()
    for row in rows:
        try:
            permisos.update(json.loads(row["permisos"]))
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
    return permisos


def has_permission(sid, permission):
    return permission in permissions_for_user(sid)


def require_permission(permission):
    sid = require_login()
    return sid if has_permission(sid, permission) else None


def require_admin():
    sid = require_login()
    return sid if is_admin_user(sid) else None


def err(msg, code=403):
    return jsonify({"error": msg}), code


# ---------------------------------------------------------------- pÃ¡ginas --
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/static/<path:path>")
def static_files(path):
    return send_from_directory(os.path.join(BASE_DIR, "static"), path)


def valid_pin(pin):
    return bool(pin) and len(pin) == 4 and pin.isdigit()


def random_pin():
    return f"{random.randint(0, 9999):04d}"


# ---------------------------------------------------------------- sesiÃ³n --
@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(force=True)
    socio_id = data.get("socio_id")
    pin = (data.get("pin") or "").strip()
    db = get_db()
    row = db.execute("SELECT id, activo, pin_hash FROM socios WHERE id = ?", (socio_id,)).fetchone()
    if not row:
        return err("Socio no encontrado", 404)
    if not row["activo"]:
        return err("Este socio estÃ¡ dado de baja", 403)
    if row["pin_hash"]:
        if not pin or not check_password_hash(row["pin_hash"], pin):
            return err("PIN incorrecto.", 403)
    # Si el socio todavÃ­a no tiene PIN configurado (cuentas antiguas), se deja
    # entrar sin comprobarlo; se le anima a crear uno desde "Mi perfil".
    session["socio_id"] = socio_id
    return jsonify({"ok": True})


@app.route("/api/logout", methods=["POST"])
def logout():
    session.pop("socio_id", None)
    return jsonify({"ok": True})


# ------------------------------------------------------------- estado full --
@app.route("/api/state")
def state():
    db = get_db()
    sid = require_login()

    config = dict(db.execute("SELECT * FROM config WHERE id = 1").fetchone())

    socios_rows = db.execute("SELECT * FROM socios ORDER BY nombre").fetchall()
    roles = []
    for r in db.execute("SELECT * FROM roles ORDER BY nombre"):
        role = dict(r)
        try:
            role["permisos"] = json.loads(role["permisos"])
        except (TypeError, ValueError, json.JSONDecodeError):
            role["permisos"] = []
        roles.append(role)
    roles_por_socio = {}
    for r in db.execute("SELECT socio_id, rol_id FROM socio_roles"):
        roles_por_socio.setdefault(r["socio_id"], []).append(r["rol_id"])

    socios = []
    for r in socios_rows:
        d = dict(r)
        d["tiene_pin"] = bool(d.pop("pin_hash", None))
        d["must_change_pin"] = bool(d.get("must_change_pin", 0))
        d["roles"] = roles_por_socio.get(d["id"], ["socio"])
        socios.append(d)

    perfiles = {}
    for r in db.execute("SELECT * FROM perfiles"):
        perfiles[r["socio_id"]] = {"telefono": r["telefono"], "notas": r["notas"], "familia": []}
    for r in db.execute("SELECT * FROM familiares"):
        perfiles.setdefault(r["socio_id"], {"telefono": "", "notas": "", "familia": []})
        perfiles[r["socio_id"]]["familia"].append(
            {"id": r["id"], "nombre": r["nombre"], "tipo": r["tipo"], "edad": r["edad"]}
        )

    can_view_finances = has_permission(sid, "view_finances")
    can_manage_cuotas = has_permission(sid, "manage_cuotas")
    if can_view_finances or can_manage_cuotas:
        cuotas = [dict(r) for r in db.execute("SELECT * FROM cuotas")]
    elif sid:
        cuotas = [dict(r) for r in db.execute("SELECT * FROM cuotas WHERE socio_id = ?", (sid,))]
    else:
        cuotas = []

    reuniones = []
    for r in db.execute("SELECT * FROM reuniones ORDER BY fecha DESC"):
        asistentes = [
            a["socio_id"]
            for a in db.execute("SELECT socio_id FROM asistencia WHERE reunion_id = ?", (r["id"],))
        ]
        row = dict(r)
        row["asistentes"] = asistentes
        reuniones.append(row)

    inventario = [dict(r) for r in db.execute("SELECT * FROM inventario ORDER BY categoria, nombre")]
    if can_view_finances or has_permission(sid, "manage_finances"):
        movimientos = [dict(r) for r in db.execute("SELECT m.*, s.nombre AS socio_nombre FROM movimientos m LEFT JOIN socios s ON s.id = m.socio_id ORDER BY fecha DESC")]
        bebidas_precios = [dict(r) for r in db.execute("SELECT * FROM bebidas_precios ORDER BY nombre")]
        bebidas_consumos = [dict(r) for r in db.execute("SELECT * FROM bebidas_consumos ORDER BY fecha DESC LIMIT 80")]
        fiestas_gastos = [dict(r) for r in db.execute("SELECT * FROM fiestas_gastos ORDER BY fecha DESC")]
    else:
        movimientos, bebidas_precios, bebidas_consumos, fiestas_gastos = [], [], [], []
    reservas = [dict(r) for r in db.execute("SELECT * FROM reservas ORDER BY fecha")]

    responsables = {t: [] for t in TAREAS_FIJAS}
    for r in db.execute("SELECT * FROM tareas_asignadas"):
        responsables.setdefault(r["tarea"], []).append(r["socio_id"])

    return jsonify(
        {
            "config": config,
            "roles": roles,
            "permission_labels": PERMISSIONS,
            "permissions": sorted(permissions_for_user(sid)),
            "socios": socios,
            "perfiles": perfiles,
            "cuotas": cuotas,
            "reuniones": reuniones,
            "inventario": inventario,
            "movimientos": movimientos,
            "bebidas_precios": bebidas_precios,
            "bebidas_consumos": bebidas_consumos,
            "fiestas_gastos": fiestas_gastos,
            "reservas": reservas,
            "responsables": responsables,
            "tareas_fijas": TAREAS_FIJAS,
            "current_user": sid,
            "is_admin": is_admin_user(sid),
        }
    )


# -------------------------------------------------------------- config (solo admin) --
@app.route("/api/config", methods=["POST"])
def update_config():
    if not require_permission("manage_config"):
        return err("Solo el administrador puede renombrar la peÃ±a o cambiar la cuota.")
    data = request.get_json(force=True)
    db = get_db()
    try:
        cuota = float(data.get("cuota_mensual", 45))
    except (TypeError, ValueError):
        cuota = 45
    db.execute(
        "UPDATE config SET nombre = ?, cuota_mensual = ? WHERE id = 1",
        ((data.get("nombre") or "El Cado").strip(), cuota),
    )
    db.commit()
    return jsonify({"ok": True})


# -------------------------------------------------------------- socios --
@app.route("/api/socios", methods=["POST"])
def add_socio():
    data = request.get_json(force=True)
    nombre = (data.get("nombre") or "").strip()
    if not nombre:
        return err("Nombre requerido", 400)
    pin = (data.get("pin") or "").strip()

    db = get_db()
    total = db.execute("SELECT COUNT(*) AS n FROM socios").fetchone()["n"]

    if total == 0:
        # Bootstrap: el primer socio que se crea es el administrador y DEBE fijar un PIN.
        if not valid_pin(pin):
            return err("El PIN debe tener 4 dÃ­gitos.", 400)
        is_admin = 1
        pin_generado = None
        must_change = 0  # el propio admin ha elegido su PIN, no hace falta forzar cambio
    else:
        if not require_permission("manage_socios"):
            return err("Solo el administrador puede aÃ±adir socios nuevos.")
        is_admin = 0
        must_change = 1  # el PIN lo ha puesto el administrador: se le obligarÃ¡ a cambiarlo
        if pin:
            if not valid_pin(pin):
                return err("El PIN debe tener 4 dÃ­gitos.", 400)
            pin_generado = None
        else:
            pin = random_pin()
            pin_generado = pin

    sid = new_id()
    db.execute(
        "INSERT INTO socios (id, nombre, is_admin, activo, pin_hash, must_change_pin) VALUES (?, ?, ?, 1, ?, ?)",
        (sid, nombre, is_admin, generate_password_hash(pin), must_change),
    )
    db.execute("INSERT INTO perfiles (socio_id, telefono, notas) VALUES (?, '', '')", (sid,))
    db.execute("INSERT INTO socio_roles (socio_id, rol_id) VALUES (?, ?)", (sid, 'administrador' if is_admin else 'socio'))
    db.commit()

    if total == 0:
        session["socio_id"] = sid  # login automÃ¡tico del primer administrador

    return jsonify({"ok": True, "id": sid, "is_admin": bool(is_admin), "pin_generado": pin_generado})


@app.route("/api/socios/<sid>/reset-pin", methods=["POST"])
def reset_pin(sid):
    if not require_permission("manage_socios"):
        return err("Solo el administrador puede restablecer un PIN.")
    db = get_db()
    if not db.execute("SELECT 1 FROM socios WHERE id = ?", (sid,)).fetchone():
        return err("Socio no encontrado", 404)
    nuevo_pin = random_pin()
    db.execute(
        "UPDATE socios SET pin_hash = ?, must_change_pin = 1 WHERE id = ?",
        (generate_password_hash(nuevo_pin), sid),
    )
    db.commit()
    return jsonify({"ok": True, "pin": nuevo_pin})


@app.route("/api/socios/<sid>/activo", methods=["POST"])
def toggle_activo(sid):
    if not require_permission("manage_socios"):
        return err("Solo el administrador puede dar de alta o de baja a un socio.")
    db = get_db()
    row = db.execute("SELECT activo FROM socios WHERE id = ?", (sid,)).fetchone()
    if not row:
        return err("Socio no encontrado", 404)
    nuevo = 0 if row["activo"] else 1
    db.execute("UPDATE socios SET activo = ? WHERE id = ?", (nuevo, sid))
    db.commit()
    return jsonify({"ok": True, "activo": bool(nuevo)})


@app.route("/api/socios/<sid>", methods=["DELETE"])
def delete_socio(sid):
    if not require_permission("manage_socios"):
        return err("Solo el administrador puede eliminar un socio.")
    db = get_db()
    row = db.execute("SELECT id, is_admin FROM socios WHERE id = ?", (sid,)).fetchone()
    if not row:
        return err("Socio no encontrado", 404)
    if row["is_admin"]:
        return err("No se puede eliminar a un administrador.", 403)

    db.execute("DELETE FROM cuotas WHERE socio_id = ?", (sid,))
    db.execute("DELETE FROM reservas WHERE socio_id = ?", (sid,))
    db.execute("DELETE FROM asistencia WHERE socio_id = ?", (sid,))
    db.execute("DELETE FROM tareas_asignadas WHERE socio_id = ?", (sid,))
    db.execute("DELETE FROM socios WHERE id = ?", (sid,))
    db.commit()

    avatar_path = os.path.join(AVATARS_DIR, f"{sid}.jpg")
    try:
        if os.path.exists(avatar_path):
            os.remove(avatar_path)
    except OSError:
        pass

    return jsonify({"ok": True})


# -------------------------------------------------------------- roles y permisos --
@app.route("/api/socios/<sid>/roles", methods=["POST"])
def update_socio_roles(sid):
    if not require_permission("manage_roles"):
        return err("No tienes permiso para gestionar roles.")
    data = request.get_json(force=True)
    role_ids = data.get("roles") or []
    if not isinstance(role_ids, list) or not role_ids:
        return err("Cada socio debe tener al menos un rol.", 400)
    db = get_db()
    if not db.execute("SELECT 1 FROM socios WHERE id = ?", (sid,)).fetchone():
        return err("Socio no encontrado", 404)
    valid_ids = {r["id"] for r in db.execute("SELECT id FROM roles")}
    if any(role_id not in valid_ids for role_id in role_ids):
        return err("Uno de los roles no existe.", 400)
    # Evita que alguien se quite a s� mismo el �ltimo rol con permiso para administrar roles.
    if sid == current_socio_id():
        permitted = set()
        for role in db.execute("SELECT permisos FROM roles WHERE id IN ({})".format(",".join("?" for _ in role_ids)), role_ids):
            permitted.update(json.loads(role["permisos"]))
        if "manage_roles" not in permitted:
            return err("No puedes quitarte a ti mismo el permiso de gestionar roles.", 400)
    db.execute("DELETE FROM socio_roles WHERE socio_id = ?", (sid,))
    db.executemany("INSERT INTO socio_roles (socio_id, rol_id) VALUES (?, ?)", [(sid, role_id) for role_id in role_ids])
    db.execute("UPDATE socios SET is_admin = ? WHERE id = ?", (int("administrador" in role_ids), sid))
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/roles", methods=["POST"])
def create_role():
    if not require_permission("manage_roles"):
        return err("No tienes permiso para gestionar roles.")
    data = request.get_json(force=True)
    nombre = (data.get("nombre") or "").strip()
    permisos = data.get("permisos") or []
    if not nombre:
        return err("El nombre del rol es obligatorio.", 400)
    if not isinstance(permisos, list) or any(p not in PERMISSIONS for p in permisos):
        return err("La lista de permisos no es v�lida.", 400)
    db = get_db()
    role_id = new_id()
    try:
        db.execute("INSERT INTO roles (id, nombre, permisos) VALUES (?, ?, ?)", (role_id, nombre, json.dumps(permisos)))
        db.commit()
    except sqlite3.IntegrityError:
        return err("Ya existe un rol con ese nombre.", 400)
    return jsonify({"ok": True, "id": role_id})


@app.route("/api/roles/<role_id>", methods=["POST"])
def update_role(role_id):
    if not require_permission("manage_roles"):
        return err("No tienes permiso para gestionar roles.")
    data = request.get_json(force=True)
    permisos = data.get("permisos") or []
    if not isinstance(permisos, list) or any(p not in PERMISSIONS for p in permisos):
        return err("La lista de permisos no es v�lida.", 400)
    if role_id == "administrador" and "manage_roles" not in permisos:
        return err("El rol Administrador debe conservar la gesti�n de roles.", 400)
    db = get_db()
    if not db.execute("SELECT 1 FROM roles WHERE id = ?", (role_id,)).fetchone():
        return err("Rol no encontrado", 404)
    db.execute("UPDATE roles SET permisos = ? WHERE id = ?", (json.dumps(permisos), role_id))
    db.commit()
    return jsonify({"ok": True})

# -------------------------------------------------------------- perfil (solo el propio) --
@app.route("/api/perfil", methods=["POST"])
def update_perfil():
    sid = require_login()
    if not sid:
        return err("No has iniciado sesiÃ³n.", 401)
    data = request.get_json(force=True)
    db = get_db()

    nombre = (data.get("nombre") or "").strip()
    if nombre:
        db.execute("UPDATE socios SET nombre = ? WHERE id = ?", (nombre, sid))

    pin = (data.get("pin") or "").strip()
    if pin:
        if not valid_pin(pin):
            return err("El PIN debe tener 4 dÃ­gitos.", 400)
        db.execute("UPDATE socios SET pin_hash = ?, must_change_pin = 0 WHERE id = ?", (generate_password_hash(pin), sid))

    db.execute(
        "UPDATE perfiles SET telefono = ?, notas = ? WHERE socio_id = ?",
        (data.get("telefono", ""), data.get("notas", ""), sid),
    )
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/perfil/pin", methods=["POST"])
def change_own_pin():
    sid = require_login()
    if not sid:
        return err("No has iniciado sesiÃ³n.", 401)
    data = request.get_json(force=True)
    pin = (data.get("pin") or "").strip()
    if not valid_pin(pin):
        return err("El PIN debe tener 4 dÃ­gitos.", 400)
    db = get_db()
    db.execute("UPDATE socios SET pin_hash = ?, must_change_pin = 0 WHERE id = ?", (generate_password_hash(pin), sid))
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/familiares", methods=["POST"])
def add_familiar():
    sid = require_login()
    if not sid:
        return err("No has iniciado sesiÃ³n.", 401)
    data = request.get_json(force=True)
    nombre = (data.get("nombre") or "").strip()
    if not nombre:
        return err("Nombre requerido", 400)
    db = get_db()
    fid = new_id()
    db.execute(
        "INSERT INTO familiares (id, socio_id, nombre, tipo, edad) VALUES (?, ?, ?, ?, ?)",
        (fid, sid, nombre, data.get("tipo", "Otro"), str(data.get("edad", ""))),
    )
    db.commit()
    return jsonify({"ok": True, "id": fid})


@app.route("/api/familiares/<fid>", methods=["DELETE"])
def delete_familiar(fid):
    sid = require_login()
    if not sid:
        return err("No has iniciado sesiÃ³n.", 401)
    db = get_db()
    db.execute("DELETE FROM familiares WHERE id = ? AND socio_id = ?", (fid, sid))
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/socios/<sid>/foto", methods=["POST"])
def upload_foto(sid):
    sid_session = require_login()
    if not sid_session:
        return err("No has iniciado sesiÃ³n.", 401)
    if sid_session != sid and not has_permission(sid_session, "manage_socios"):
        return err("No puedes cambiar la foto de otro socio.")
    if not PIL_OK:
        return err(
            "Falta instalar una dependencia en el servidor: ejecuta "
            "'pip install -r requirements.txt' (o 'pip install Pillow') "
            "y reinicia la aplicaciÃ³n.",
            500,
        )
    if "foto" not in request.files or request.files["foto"].filename == "":
        return err("No se ha recibido ninguna imagen.", 400)

    db = get_db()
    if not db.execute("SELECT 1 FROM socios WHERE id = ?", (sid,)).fetchone():
        return err("Socio no encontrado", 404)

    try:
        file = request.files["foto"]
        raw = file.read()
        try:
            im = Image.open(BytesIO(raw))
            im.load()
        except Exception:
            return err(
                "No se pudo leer esa imagen. Prueba con un archivo .jpg o .png "
                "(si es una foto de iPhone en formato HEIC, conviÃ©rtela a JPG antes de subirla).",
                400,
            )
        im = ImageOps.exif_transpose(im).convert("RGB")
        w, h = im.size
        side = min(w, h)
        left, top = (w - side) // 2, (h - side) // 2
        im = im.crop((left, top, left + side, top + side)).resize((320, 320), Image.LANCZOS)
        os.makedirs(AVATARS_DIR, exist_ok=True)
        im.save(os.path.join(AVATARS_DIR, f"{sid}.jpg"), "JPEG", quality=85)
    except Exception as e:
        return err(f"No se pudo procesar la imagen: {e}", 400)

    return jsonify({"ok": True})


# -------------------------------------------------------------- cuotas --
@app.route("/api/cuota/toggle", methods=["POST"])
def toggle_cuota():
    sid = require_login()
    if not sid:
        return err("No has iniciado sesiÃ³n.", 401)
    data = request.get_json(force=True)
    socio_id, year, month = data.get("socio_id"), int(data.get("year")), int(data.get("month"))

    if socio_id != sid and not has_permission(sid, "manage_cuotas"):
        return err("Solo puedes marcar tu propia cuota. PÃ­deselo al administrador si es de otro socio.")

    db = get_db()
    row = db.execute(
        "SELECT * FROM cuotas WHERE socio_id = ? AND year = ? AND month = ?",
        (socio_id, year, month),
    ).fetchone()
    config = db.execute("SELECT cuota_mensual FROM config WHERE id = 1").fetchone()
    if row:
        nuevo_estado = 0 if row["pagado"] else 1
        db.execute(
            "UPDATE cuotas SET pagado = ?, fecha = ? WHERE id = ?",
            (nuevo_estado, date.today().isoformat() if nuevo_estado else None, row["id"]),
        )
    else:
        db.execute(
            "INSERT INTO cuotas (id, socio_id, year, month, importe, pagado, fecha) VALUES (?,?,?,?,?,1,?)",
            (new_id(), socio_id, year, month, config["cuota_mensual"], date.today().isoformat()),
        )
    db.commit()
    return jsonify({"ok": True})


# -------------------------------------------------------------- reuniones --
@app.route("/api/reuniones", methods=["POST"])
def add_reunion():
    sid = require_permission("manage_events")
    data = request.get_json(force=True)
    db = get_db()
    rid = new_id()
    db.execute(
        "INSERT INTO reuniones (id, fecha, hora_inicio, hora_fin, socio_id, evento, notas, creado_en) VALUES (?,?,?,?,?,?,?,?)",
        (
            rid,
            data.get("fecha"),
            (data.get("hora_inicio") or "").strip(),
            (data.get("hora_fin") or "").strip(),
            sid,
            (data.get("evento") or "").strip(),
            (data.get("notas") or "").strip(),
            now_iso(),
        ),
    )
    db.commit()
    return jsonify({"ok": True, "id": rid})


@app.route("/api/reuniones/<rid>", methods=["DELETE"])
def delete_reunion(rid):
    if not require_permission("manage_events"):
        return err("No tienes permiso para gestionar reuniones.")
    db = get_db()
    db.execute("DELETE FROM reuniones WHERE id = ?", (rid,))
    db.execute("DELETE FROM asistencia WHERE reunion_id = ?", (rid,))
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/reuniones/<rid>/asistencia", methods=["POST"])
def toggle_asistencia(rid):
    data = request.get_json(force=True)
    socio_id = data.get("socio_id")
    db = get_db()
    row = db.execute("SELECT 1 FROM asistencia WHERE reunion_id = ? AND socio_id = ?", (rid, socio_id)).fetchone()
    if row:
        db.execute("DELETE FROM asistencia WHERE reunion_id = ? AND socio_id = ?", (rid, socio_id))
    else:
        db.execute("INSERT INTO asistencia (reunion_id, socio_id) VALUES (?, ?)", (rid, socio_id))
    db.commit()
    return jsonify({"ok": True})


# -------------------------------------------------------------- inventario --
@app.route("/api/inventario", methods=["POST"])
def add_inventario():
    if not require_permission("manage_inventory"):
        return err("No tienes permiso para gestionar inventario.")
    data = request.get_json(force=True)
    db = get_db()
    iid = new_id()
    db.execute(
        "INSERT INTO inventario (id, nombre, categoria, cantidad, estado, notas) VALUES (?,?,?,?,?,?)",
        (
            iid,
            (data.get("nombre") or "").strip(),
            data.get("categoria", "Otros"),
            int(data.get("cantidad") or 1),
            data.get("estado", "Bien"),
            (data.get("notas") or "").strip(),
        ),
    )
    db.commit()
    return jsonify({"ok": True, "id": iid})


@app.route("/api/inventario/<iid>", methods=["DELETE"])
def delete_inventario(iid):
    if not require_permission("manage_inventory"):
        return err("No tienes permiso para gestionar inventario.")
    db = get_db()
    db.execute("DELETE FROM inventario WHERE id = ?", (iid,))
    db.commit()
    return jsonify({"ok": True})


# -------------------------------------------------------------- movimientos (solo admin) --
@app.route("/api/movimientos", methods=["POST"])
def add_movimiento():
    if not require_permission("manage_finances"):
        return err("Solo el administrador puede aÃ±adir gastos o ingresos.")
    data = request.get_json(force=True)
    db = get_db()
    socio_id = data.get("socio_id") or None
    if socio_id:
        if not db.execute("SELECT 1 FROM socios WHERE id = ?", (socio_id,)).fetchone():
            return err("Socio no encontrado", 404)
    mid = new_id()
    db.execute(
        "INSERT INTO movimientos (id, tipo, categoria, concepto, importe, fecha, socio_id) VALUES (?,?,?,?,?,?,?)",
        (
            mid,
            data.get("tipo", "gasto"),
            data.get("categoria", "Otros"),
            (data.get("concepto") or "").strip(),
            float(data.get("importe") or 0),
            data.get("fecha"),
            socio_id,
        ),
    )
    db.commit()
    return jsonify({"ok": True, "id": mid})


@app.route("/api/movimientos/<mid>", methods=["DELETE"])
def delete_movimiento(mid):
    if not require_permission("manage_finances"):
        return err("Solo el administrador puede borrar gastos o ingresos.")
    db = get_db()
    db.execute("DELETE FROM movimientos WHERE id = ?", (mid,))
    db.commit()
    return jsonify({"ok": True})


# -------------------------------------------------------------- bebidas: precios --
@app.route("/api/bebidas/precios", methods=["POST"])
def add_bebida_precio():
    if not require_permission("manage_bebidas"):
        return err("No tienes permiso para gestionar bebidas.")
    data = request.get_json(force=True)
    db = get_db()
    bid = new_id()
    db.execute(
        "INSERT INTO bebidas_precios (id, nombre, unidad, precio_socio, precio_no_socio) VALUES (?,?,?,?,?)",
        (
            bid,
            (data.get("nombre") or "").strip(),
            (data.get("unidad") or "").strip(),
            float(data.get("precio_socio") or 0),
            float(data.get("precio_no_socio") or 0),
        ),
    )
    db.commit()
    return jsonify({"ok": True, "id": bid})


@app.route("/api/bebidas/precios/<bid>", methods=["DELETE"])
def delete_bebida_precio(bid):
    if not require_permission("manage_bebidas"):
        return err("No tienes permiso para gestionar bebidas.")
    db = get_db()
    db.execute("DELETE FROM bebidas_precios WHERE id = ?", (bid,))
    db.commit()
    return jsonify({"ok": True})


# -------------------------------------------------------------- bebidas: consumos --
@app.route("/api/bebidas/consumos", methods=["POST"])
def add_consumo():
    if not require_permission("manage_bebidas"):
        return err("No tienes permiso para gestionar bebidas.")
    data = request.get_json(force=True)
    db = get_db()
    bebida = db.execute("SELECT * FROM bebidas_precios WHERE id = ?", (data.get("bebida_id"),)).fetchone()
    if not bebida:
        return err("Bebida no encontrada", 404)

    es_socio = bool(data.get("es_socio"))
    cantidad = int(data.get("cantidad") or 1)
    if es_socio:
        consumidor_row = db.execute("SELECT nombre FROM socios WHERE id = ?", (data.get("socio_id"),)).fetchone()
        consumidor = consumidor_row["nombre"] if consumidor_row else "Socio"
        precio_unit = bebida["precio_socio"]
    else:
        consumidor = (data.get("nombre_invitado") or "Invitado").strip()
        precio_unit = bebida["precio_no_socio"]

    cid = new_id()
    db.execute(
        "INSERT INTO bebidas_consumos (id, fecha, consumidor, es_socio, bebida_id, cantidad, importe) VALUES (?,?,?,?,?,?,?)",
        (cid, date.today().isoformat(), consumidor, int(es_socio), bebida["id"], cantidad, precio_unit * cantidad),
    )
    db.commit()
    return jsonify({"ok": True, "id": cid})


@app.route("/api/bebidas/consumos/<cid>", methods=["DELETE"])
def delete_consumo(cid):
    if not require_permission("manage_bebidas"):
        return err("No tienes permiso para gestionar bebidas.")
    db = get_db()
    db.execute("DELETE FROM bebidas_consumos WHERE id = ?", (cid,))
    db.commit()
    return jsonify({"ok": True})


# -------------------------------------------------------------- fiestas (gasto bebida evento) --
@app.route("/api/fiestas", methods=["POST"])
def add_fiesta_gasto():
    if not require_permission("manage_finances"):
        return err("No tienes permiso para registrar gastos.")
    data = request.get_json(force=True)
    db = get_db()
    fid = new_id()
    db.execute(
        "INSERT INTO fiestas_gastos (id, fecha, evento, concepto, importe) VALUES (?,?,?,?,?)",
        (
            fid,
            data.get("fecha"),
            (data.get("evento") or "").strip(),
            (data.get("concepto") or "").strip(),
            float(data.get("importe") or 0),
        ),
    )
    db.commit()
    return jsonify({"ok": True, "id": fid})


@app.route("/api/fiestas/<fid>", methods=["DELETE"])
def delete_fiesta_gasto(fid):
    if not require_permission("manage_finances"):
        return err("No tienes permiso para borrar gastos.")
    db = get_db()
    db.execute("DELETE FROM fiestas_gastos WHERE id = ?", (fid,))
    db.commit()
    return jsonify({"ok": True})


# -------------------------------------------------------------- reservas --
@app.route("/api/reservas", methods=["POST"])
def add_reserva():
    sid = require_login()
    if not sid:
        return err("No has iniciado sesiÃ³n.", 401)
    data = request.get_json(force=True)
    db = get_db()
    rid = new_id()
    db.execute(
        "INSERT INTO reservas (id, fecha, hora_inicio, hora_fin, socio_id, evento, notas, creado_en) VALUES (?,?,?,?,?,?,?,?)",
        (
            rid,
            data.get("fecha"),
            (data.get("hora_inicio") or "").strip(),
            (data.get("hora_fin") or "").strip(),
            sid,
            (data.get("evento") or "").strip(),
            (data.get("notas") or "").strip(),
            now_iso(),
        ),
    )
    db.commit()
    return jsonify({"ok": True, "id": rid})


@app.route("/api/reservas/<rid>", methods=["DELETE"])
def delete_reserva(rid):
    sid = require_login()
    if not sid:
        return err("No has iniciado sesiÃ³n.", 401)
    db = get_db()
    row = db.execute("SELECT socio_id FROM reservas WHERE id = ?", (rid,)).fetchone()
    if not row:
        return err("Reserva no encontrada", 404)
    if row["socio_id"] != sid and not has_permission(sid, "manage_events"):
        return err("No puedes cancelar la reserva de otro socio.")
    db.execute("DELETE FROM reservas WHERE id = ?", (rid,))
    db.commit()
    return jsonify({"ok": True})


# -------------------------------------------------------------- encargados/tareas --
@app.route("/api/responsables/toggle", methods=["POST"])
def toggle_responsable():
    sid = require_login()
    if not sid:
        return err("No has iniciado sesiÃ³n.", 401)
    data = request.get_json(force=True)
    tarea = data.get("tarea")
    target = data.get("socio_id")
    if tarea not in TAREAS_FIJAS:
        return err("Tarea no vÃ¡lida", 400)
    if target != sid and not has_permission(sid, "manage_tasks"):
        return err("Solo puedes apuntarte a ti mismo (el administrador puede gestionar a cualquiera).")

    db = get_db()
    row = db.execute("SELECT id FROM tareas_asignadas WHERE tarea = ? AND socio_id = ?", (tarea, target)).fetchone()
    if row:
        db.execute("DELETE FROM tareas_asignadas WHERE id = ?", (row["id"],))
    else:
        db.execute("INSERT INTO tareas_asignadas (id, tarea, socio_id) VALUES (?, ?, ?)", (new_id(), tarea, target))
    db.commit()
    return jsonify({"ok": True})


# -------------------------------------------------------------- exportar a Excel --
@app.route("/api/export.xlsx")
def export_excel():
    if not require_permission("export_data"):
        return err("No has iniciado sesiÃ³n.", 401)
    if not OPENPYXL_OK:
        return err(
            "Falta instalar una dependencia en el servidor: ejecuta "
            "'pip install -r requirements.txt' (o 'pip install openpyxl') "
            "y reinicia la aplicaciÃ³n.",
            500,
        )

    try:
        return _build_excel()
    except Exception as e:
        app.logger.exception("Error generando el Excel")
        return err(f"No se pudo generar el Excel: {e}", 500)


def _build_excel():
    db = get_db()
    wb = openpyxl.Workbook()
    header_fill = PatternFill(start_color="21332B", end_color="21332B", fill_type="solid")
    header_font = Font(color="F1EDE4", bold=True)

    def write_sheet(ws, headers, rows):
        ws.append(headers)
        for cell in ws[1]:
            cell.fill = header_fill
            cell.font = header_font
        for r in rows:
            ws.append(r)
        for i, h in enumerate(headers, start=1):
            ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = max(14, len(h) + 4)

    ws1 = wb.active
    ws1.title = "Movimientos"
    movs = db.execute(
        "SELECT m.*, s.nombre as socio_nombre FROM movimientos m LEFT JOIN socios s ON s.id = m.socio_id ORDER BY fecha"
    ).fetchall()
    write_sheet(
        ws1,
        ["Fecha", "Tipo", "CategorÃ­a", "Socio", "Concepto", "Importe (â‚¬)"],
        [[m["fecha"], m["tipo"], m["categoria"], m["socio_nombre"] or "", m["concepto"], m["importe"]] for m in movs],
    )

    ws2 = wb.create_sheet("Cuotas")
    cuotas = db.execute(
        "SELECT c.*, s.nombre as socio_nombre FROM cuotas c JOIN socios s ON s.id = c.socio_id ORDER BY c.year, c.month, s.nombre"
    ).fetchall()
    write_sheet(
        ws2,
        ["Socio", "AÃ±o", "Mes", "Importe (â‚¬)", "Pagado", "Fecha de pago"],
        [[c["socio_nombre"], c["year"], c["month"], c["importe"], "SÃ­" if c["pagado"] else "No", c["fecha"] or ""] for c in cuotas],
    )

    ws3 = wb.create_sheet("Bebidas")
    consumos = db.execute("SELECT * FROM bebidas_consumos ORDER BY fecha").fetchall()
    write_sheet(
        ws3,
        ["Fecha", "Consumidor", "Socio", "Cantidad", "Importe (â‚¬)"],
        [[c["fecha"], c["consumidor"], "SÃ­" if c["es_socio"] else "No", c["cantidad"], c["importe"]] for c in consumos],
    )

    ws4 = wb.create_sheet("Gastos fiestas")
    fiestas = db.execute("SELECT * FROM fiestas_gastos ORDER BY fecha").fetchall()
    write_sheet(
        ws4,
        ["Fecha", "Evento", "Concepto", "Importe (â‚¬)"],
        [[f["fecha"], f["evento"], f["concepto"], f["importe"]] for f in fiestas],
    )

    ws4b = wb.create_sheet("Inventario")
    inventario = db.execute("SELECT * FROM inventario ORDER BY categoria, nombre").fetchall()
    write_sheet(
        ws4b,
        ["CategorÃ­a", "Nombre", "Cantidad", "Estado", "Notas"],
        [[i["categoria"], i["nombre"], i["cantidad"], i["estado"], i["notas"] or ""] for i in inventario],
    )

    ingresos_cuotas = sum(c["importe"] for c in cuotas if c["pagado"])
    ingresos_mov = sum(m["importe"] for m in movs if m["tipo"] == "ingreso")
    gastos_mov = sum(m["importe"] for m in movs if m["tipo"] == "gasto")
    ingresos_bebidas = sum(c["importe"] for c in consumos)
    gastos_fiestas = sum(f["importe"] for f in fiestas)
    saldo = ingresos_cuotas + ingresos_mov + ingresos_bebidas - gastos_mov - gastos_fiestas

    ws5 = wb.create_sheet("Resumen")
    ws5.append(["Concepto", "Importe (â‚¬)"])
    for cell in ws5[1]:
        cell.fill = header_fill
        cell.font = header_font
    for concepto, importe in [
        ("Cuotas cobradas", ingresos_cuotas),
        ("Otros ingresos", ingresos_mov),
        ("Bebidas recaudadas", ingresos_bebidas),
        ("Gastos generales", -gastos_mov),
        ("Gastos de fiestas", -gastos_fiestas),
        ("SALDO TOTAL", saldo),
    ]:
        ws5.append([concepto, importe])
    ws5.column_dimensions["A"].width = 24
    ws5.column_dimensions["B"].width = 16
    wb.move_sheet("Resumen", offset=-5)  # dejarla la primera

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    filename = f"el_cado_cuentas_{date.today().isoformat()}.xlsx"
    return send_file(
        buf,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=filename,
    )


if __name__ == "__main__":
    init_db()
    app.run(debug=True, host="0.0.0.0", port=5000)
else:
    init_db()
