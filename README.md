# El Cado  -  gestor de la peña

Web para gestionar socios, cuotas, reuniones, inventario, gastos/ingresos,
bebidas, reservas y encargados de tareas de la peña. Backend en Python
(Flask) + base de datos SQLite (un solo archivo, `pena.db`, se crea solo).
Frontend en HTML/CSS/JS sin frameworks, para que sea fácil de tocar en
VS Code.

## Roles: administrador y socios

- **El primer socio que se crea** (cuando la peña está vacía) se convierte
  automáticamente en **administrador**. Esa persona entra desde la
  pantalla de inicio con un formulario especial de "crear peña".
- **Solo el administrador puede**: añadir socios nuevos, dar de baja o
  reactivar a un socio, renombrar la peña, y añadir/borrar movimientos de
  caja (gastos e ingresos).
- **Marcar una cuota como pagada** solo lo pueden hacer el **tesorero** y
  el **administrador**, previa comprobación. El resto de socios ve las
  cuotas en modo lectura (quien ha pagado y quien falta).
- **Cualquier socio puede**: reservar la peña, apuntarse a tareas de
  "Encargados", crear eventos de "Tricount" (reparto de gastos) y
  participar en ellos marcándose a sí mismo, crear y gestionar listas de
  la compra compartidas (añadir, editar, marcar como comprado o quitar
  cualquier producto, no solo el suyo), editar su propio perfil
  (incluido su nombre), y ver todo lo demás en modo lectura (socios y
  caja son de solo lectura para el resto).
- Dar de baja a un socio no borra su historial (cuotas pagadas, asistencia
  a reuniones, etc.)  -  simplemente deja de aparecer en la pantalla de
  login y se marca como "de baja" en la lista de socios.

## Acceso con PIN

Cada socio tiene un PIN de 4 dígitos además de elegir su nombre/foto:

- **Al crear la peña**, tú (el administrador) eliges tu propio PIN.
- **Al añadir un socio nuevo**, puedes escribirle tú un PIN (por ejemplo
  el mismo para todos, para simplificar) o dejarlo en blanco para que se
  genere uno aleatorio  -  en ambos casos, ese socio **tendrá que
  cambiarlo obligatoriamente** la primera vez que entre: en vez del
  panel normal, le aparecerá una pantalla para crear su propio PIN antes
  de poder ver nada más.
- **Si un socio olvida su PIN**, tú puedes restablecérselo desde
  "Socios" -> "Restablecer PIN": se genera uno nuevo temporal que le
  pasas, y al entrar se le volverá a pedir que lo cambie por uno suyo.
- Cada socio puede cambiar su PIN cuando quiera desde "Mi perfil" ->
  "Seguridad".
- Los PIN se guardan siempre cifrados (hash), nunca en texto plano, ni
  siquiera tú puedes verlos una vez creados  -  solo puedes restablecerlos.

Esto es una capa de seguridad razonable para un grupo de confianza, pero
sigue sin ser un sistema de autenticación de nivel bancario (por
ejemplo, no hay límite de intentos ni bloqueo temporal). Para una peña de
amigos es más que suficiente.

> Nota para bases de datos ya existentes: si vienes de una versión sin
> PIN, la próxima vez que arranques `python app.py` se añaden las
> columnas que faltan automáticamente  -  no hace falta borrar `pena.db`.

## 1. Probarlo en local

Necesitas Python 3.9+ instalado. Desde la carpeta del proyecto:

```bash
python -m venv venv
source venv/bin/activate        # en Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Abre el navegador en **http://localhost:5000**. La primera vez la peña
está vacía: el formulario que aparece crea tu cuenta como administrador.

Para que otro dispositivo de tu misma red (wifi de casa, por ejemplo) lo
pruebe, usa la IP de tu ordenador en vez de `localhost`, p.ej.
`http://192.168.1.35:5000` (Flask ya escucha en todas las interfaces).

## 2. El logo

Ya está integrado: `static/logo.png` (línea en color crema, fondo
transparente, pensado para la cabecera oscura, dentro de una insignia
circular con borde ámbar) y `static/logo-dark.png` (línea oscura, por si
algún día haces una versión con fondo claro). Se generaron a partir de tu
imagen original quitándole el fondo blanco. Si quieres cambiarlo, solo
tienes que sustituir `static/logo.png` por otro PNG con fondo
transparente.

## 3. Estructura del proyecto

```
pena_el_cado/
  app.py              -> backend Flask (rutas API + permisos + servidor)
  requirements.txt    -> dependencias
  pena.db             -> se crea solo al arrancar (no se sube a git)
  static/
    style.css          -> estilos
    app.js              -> toda la lógica del frontend
    logo.png            -> logo (fondo transparente, para la cabecera)
    logo-dark.png        -> variante oscura del logo
  templates/
    index.html          -> plantilla HTML base
```

Cada módulo (socios, cuotas, reuniones, inventario, caja, bebidas,
reservas, encargados, perfil) tiene su propia sección de rutas en
`app.py` (busca los comentarios tipo `# ---- socios ----`) y su propia
función `renderX()` en `app.js`. Para añadir un campo nuevo a algo,
normalmente tocas 3 sitios: la tabla en `SCHEMA` (app.py), la ruta que lo
guarda, y el formulario/HTML en `app.js`.

## 4. Funciones nuevas de esta versión

- **Editar tu propio nombre**: en "Mi perfil" ya puedes corregir tu
  nombre si lo pusiste mal, sin tocar la base de datos a mano.
- **Reservas con horario**: al reservar puedes poner hora de inicio y
  fin (opcional). Si las dejas en blanco, se entiende "todo el día".
- **Log de eventos** (pestaña Resumen): los avisos (cuotas pendientes,
  bebidas por pagar, reservas/reuniones recientes...) ya no se muestran
  en pantalla; se descargan como archivo de texto con el botón
  "Exportar log de eventos" cuando se necesiten.
- **Gráficas de ingresos y gastos** (pestaña Resumen): evolución mes a
  mes de un año (con navegador de años) y comparativa del total de
  ingresos/gastos entre años, para ver como estaba la peña antes.
- **Dar de baja a un socio** en vez de borrarlo (mantiene su historial).
- **Exportar a Excel**: botón " Exportar a Excel" en Gastos e ingresos,
  Inventario y Bebidas. Descarga siempre el mismo `.xlsx` completo, con
  hojas de Resumen, Movimientos, Cuotas, Bebidas, Gastos de fiestas e
  Inventario  -  listo para revisar mes a mes o año a año.
- **Gastos de fiestas por evento**: en el Resumen ahora se ve el gasto en
  bebida agrupado por cada fiesta/evento, no como un único número suelto.
- **Encargados**: nueva pestaña con las tareas fijas (Compras, Limpieza,
  Tesorería, Carrozas, Concursos, Comidas, Otros) donde cada socio se
  apunta o se quita.
- **Fondo de fotos de la cuadrilla**: la web va cambiando de foto de
  fondo cada pocos segundos (carpeta `static/backgrounds/`). Para
  cambiarlas, sustituye los archivos `bg-1.jpg` ... `bg-5.jpg` por las
  tuyas (mismo nombre) o añade más y actualiza la lista `BG_IMAGES` al
  principio de `static/app.js`.
- **Foto de perfil por socio**: cada socio puede subir su propia foto
  desde "Mi perfil" (se recorta en cuadrado sola). El administrador
  también puede añadir/cambiar la foto de cualquiera desde "Socios". Se
  usa como avatar en la pantalla de login, así que entrar es tan fácil
  como tocar tu cara en vez de leer una lista de nombres.
- **Lista de la compra** (pestaña nueva): cualquier socio puede crear
  listas compartidas (por ejemplo "Supermercado" o "Fiesta mayor") y
  añadir productos con su cantidad. Todos los socios ven las mismas
  listas y pueden añadir, editar, marcar como comprado o quitar
  cualquier producto  -  no hace falta ser quien lo añadió. Se actualiza
  para todos igual que el resto de la app (ver punto 5).

>  **Privacidad**: las fotos de perfil (`static/avatars/`) se guardan
> en el servidor pero **no se suben a GitHub** (están excluidas en
> `.gitignore`) para no dejar fotos de gente real en un historial de
> código para siempre. Las fotos de fondo (`static/backgrounds/`) sí
> forman parte del proyecto porque las pusiste tú a propósito como
> decoración  -  pero como también son fotos reales de la cuadrilla, te
> recomiendo crear el repositorio de GitHub como **privado** (ver
> siguiente punto), no público.

## 5. Cómo se actualiza "en tiempo real"

El navegador de cada socio vuelve a pedir los datos al servidor cada 8
segundos automáticamente (y también cada vez que alguien guarda algo). No
hace falta recargar la página a mano. Esto es "polling", no es
instantáneo al 100% pero es más que suficiente para consultar cuentas o
ver si la peña está reservada. Si en el futuro quieres que sea instantáneo
de verdad, se puede migrar a WebSockets (Flask-SocketIO) sin rehacer el
resto de la app.

## 6. Compartirlo con la cuadrilla por WhatsApp (desplegarlo con dominio)

En local, la web solo funciona en tu propio ordenador/wifi. Para que todos
la vean desde su móvil con datos fuera de casa necesitas subirla a un
servidor con IP pública. Opciones típicas, de más sencilla a más control:

1. **Render.com / Railway.app / Fly.io** (recomendado para empezar):
   conectas el repositorio de GitHub, ellos instalan `requirements.txt` y
   arrancan la app con un comando tipo `gunicorn app:app`. Tienen plan
   gratuito o muy barato, y te dan una URL tipo `elcado.onrender.com` que
   ya puedes compartir por WhatsApp. Luego puedes apuntar un dominio
   propio (ej. `elcado.com`, comprado en Namecheap/OVH/etc.) a esa URL.
2. **Un VPS propio** (DigitalOcean, Hetzner, OVH...) si luego quieres más
   control: instalas Python, `gunicorn` + `nginx` delante, y `certbot`
   para el HTTPS gratis con Let's Encrypt.
3. **PythonAnywhere**: pensado justo para apps Flask pequeñas, muy fácil
   de subir sin tocar terminal.

Importante antes de desplegar en un servidor real:
- Cambia `SECRET_KEY` (ahora mismo hay un valor de ejemplo en `app.py`) por
  una cadena aleatoria propia, como variable de entorno `SECRET_KEY`.
- El servidor de pruebas que arranca `python app.py` (`Flask dev server`)
  **no es para producción**  -  para eso está `gunicorn`, que ya está en
  `requirements.txt` (arrancas con `gunicorn app:app`).
- Haz copias de seguridad de `pena.db` de vez en cuando (es un solo
  archivo, así que basta con copiarlo).

Cuando quieras dar el paso a producción, dímelo y te ayudo a dejarlo listo
para el proveedor que elijas (fichero de configuración, variables de
entorno, etc.).

## 7. Subirlo a tu GitHub

El proyecto ya viene con un repositorio Git inicializado y un
`.gitignore` (para no subir `pena.db`, `venv/`, etc.). Para subirlo a tu
cuenta de GitHub:

1. Entra en [github.com](https://github.com), pulsa **New repository**,
   ponle un nombre (ej. `el-cado`), marca **Private** (recomendado, ya que
   el proyecto incluye fotos reales de la cuadrilla en
   `static/backgrounds/`) y **no** marques "Add a README" (ya tienes
   uno). Créalo.
2. GitHub te enseñará una URL tipo
   `https://github.com/tu-usuario/el-cado.git`. Desde la carpeta del
   proyecto en tu terminal:
   ```bash
   git remote add origin https://github.com/tu-usuario/el-cado.git
   git branch -M main
   git push -u origin main
   ```
3. La primera vez te pedirá iniciar sesión (usuario + un "personal access
   token", no la contraseña normal  -  GitHub te guía para crearlo la
   primera vez que haces `push`).

A partir de ahí, cada vez que cambies algo:
```bash
git add .
git commit -m "Explica aquí que has cambiado"
git push
```

Esto es justo el flujo de trabajo real con Git, así que te sirve como
primer proyecto para practicarlo. Si quieres, en cualquier momento te
explico ramas (`branches`), cómo deshacer un cambio, o cómo conectar el
repositorio directamente con Render/Railway para que cada `git push`
actualice la web en producción sola (esto se llama *despliegue
continuo*).

## 8. El acceso sigue siendo "de confianza"

Como pediste, entrar es simplemente elegir tu nombre de una lista, sin
contraseña. El servidor sí que impone permisos de verdad por rol
(administrador / socio) en todo lo importante  -  no son solo botones
ocultos en la pantalla, la API rechaza la petición aunque alguien intente
saltárselo a mano.
