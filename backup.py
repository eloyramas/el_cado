import shutil
import os
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKUPS_DIR = os.path.join(BASE_DIR, "backups")
os.makedirs(BACKUPS_DIR, exist_ok=True)

fecha = datetime.now().strftime("%Y%m%d_%H%M")
destino = os.path.join(BACKUPS_DIR, f"backup_{fecha}")
os.makedirs(destino, exist_ok=True)

# Copiar la base de datos
db_path = os.path.join(BASE_DIR, "pena.db")
if os.path.exists(db_path):
    shutil.copy2(db_path, destino)

# Copiar fotos y tickets
for carpeta in ["static/avatars", "static/tickets"]:
    origen = os.path.join(BASE_DIR, carpeta)
    if os.path.isdir(origen):
        shutil.copytree(origen, os.path.join(destino, carpeta), dirs_exist_ok=True)

# Empaquetar en un solo zip y borrar la carpeta suelta
shutil.make_archive(destino, "zip", destino)
shutil.rmtree(destino)

# Quedarnos solo con los ultimos 30 backups (aprox 1 mes), para no llenar el disco
backups = sorted([f for f in os.listdir(BACKUPS_DIR) if f.endswith(".zip")])
for viejo in backups[:-30]:
    os.remove(os.path.join(BACKUPS_DIR, viejo))

print(f"Backup creado: {fecha}_backup.zip")