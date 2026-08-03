# Render - Configuración de volumen persistente para El Cado

Esta app usa SQLite y guarda datos en `pena.db`. Para que los datos sobrevivan a despliegues/reinicios en Render, debes montar un volumen persistente y usarlo como ruta de base de datos.

## Pasos recomendados

1. En Render, ve a tu servicio web de la app (o crea uno si no existe).
2. En la sección **Mounts** o **Volumes**, crea un volumen persistente.
   - Nombre sugerido: `el-cado-data`
   - Ruta de montaje sugerida: `/data`
3. Define estas variables de entorno en el servicio:
   - `DATABASE_PATH=/data/pena.db`
   - `AVATARS_DIR=/data/avatars`
4. Asegúrate de que el comando de inicio del servicio arranque la app desde tu carpeta correcta.
   - Si tu app está en `Modulos/El_Cado`, el comando puede ser:
     ```bash
     cd Modulos/El_Cado && python app.py
     ```
   - El comando de build puede ser:
     ```bash
     cd Modulos/El_Cado && pip install -r requirements.txt
     ```

## Qué hace esto

- `DATABASE_PATH` indica a la app dónde crear/abrir `pena.db`.
- `AVATARS_DIR` indica dónde guardar las fotos de socio.
- Al montar `/data` como volumen persistente, esos archivos no se perderán al redeploy.

## Ejemplo de `render.yaml`

Si quieres usar infraestructura como código, puedes crear un archivo `render.yaml` en el directorio del repositorio con este contenido:

```yaml
services:
  - type: web
    name: el-cado-web
    env: python
    plan: starter
    buildCommand: cd Modulos/El_Cado && pip install -r requirements.txt
    startCommand: cd Modulos/El_Cado && python app.py
    mounts:
      - type: volume
        name: el-cado-data
        mountPath: /data
    envVars:
      - key: DATABASE_PATH
        value: /data/pena.db
      - key: AVATARS_DIR
        value: /data/avatars
```

> Nota: Render detecta automáticamente `render.yaml` si está en el repositorio raíz y puede usarlo para configurar el servicio.

## Migrar datos existentes

Si ya tienes datos en una base de datos local (`pena.db`), cópialo al volumen persistente en el servidor:

- Puedes subirlo manualmente al servidor si Render permite acceso SSH/terminal.
- O bien, exporta los datos y vuelve a importarlos desde el servidor.

## Resumen rápido

- No guardes `pena.db` en Git.
- Usa un volumen persistente en Render para `/data`.
- Configura `DATABASE_PATH` y `AVATARS_DIR`.
- Mantén el comando de arranque en `Modulos/El_Cado` si ese es el subdirectorio de la app.
