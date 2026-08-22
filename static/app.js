/* El Cado - frontend
   Habla con el backend Flask (app.py) via fetch(). El estado siempre
   vive en el servidor (SQLite) para que todos los socios vean lo mismo
   en tiempo real (se refresca solo cada 8s). */

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const TIPO_FAMILIA = ['Pareja','Hijo/a','Otro'];
const DIA_LIMITE_CUOTA = 5; // a partir de qué día del mes se avisa de cuota pendiente
const UMBRAL_STOCK_BAJO = 10; // por debajo de esta cantidad, un material se marca en rojo y avisa
const CATEGORIA_STOCK_BAJO = 'bebidas'; // el aviso de poco stock solo aplica a esta categoría de inventario
function esCategoriaStockBajo(categoria){ return (categoria||'').trim().toLowerCase() === CATEGORIA_STOCK_BAJO; }
let BG_IMAGES = [];
const DEFAULT_BG_IMAGES = ['/static/backgrounds/bg-1.jpg','/static/backgrounds/bg-2.jpg','/static/backgrounds/bg-3.jpg','/static/backgrounds/bg-4.jpg','/static/backgrounds/bg-5.jpg','/static/backgrounds/bg-6.jpg'];
const PENA_LOCATION_URL = 'https://maps.app.goo.gl/z4ZBJix572Trhqf49';
let avatarVersion = Date.now();

/* ============ MODO TABLET (kiosko de bebidas) ============
   Pensado para un dispositivo fijo en la peña: al entrar con
   ?tablet=bebidas se guarda en este dispositivo (localStorage) para que
   siga activo aunque se abra desde un acceso directo sin la URL completa.
   En este modo solo se ve login -> registrar mi consumo -> se cierra la
   sesión sola a los pocos segundos, sin dejar ningún dato a la vista.
   Para desactivarlo en ese dispositivo, abre la web con ?tablet=off. */
(function(){
  const params = new URLSearchParams(location.search);
  const modo = params.get('tablet');
  if(modo==='bebidas') localStorage.setItem('tabletMode', 'bebidas');
  else if(modo==='off') localStorage.removeItem('tabletMode');
})();
const TABLET_MODE = localStorage.getItem('tabletMode')==='bebidas';

/* ============ AYUDA (FAQ con guion, sin IA externa) ============ */
const FAQ_ENTRIES = [
  {id:'entrar', pregunta:'¿Cómo entro / inicio sesión?', palabras:['entrar','entro','sesion','login','iniciar','acceder'],
    respuesta:'Escribe tu nombre en el buscador de la pantalla de inicio, elige tu cara entre los resultados y escribe tu PIN de 4 dígitos. Si es la primera vez que entras, la app te pedirá crear tu propio PIN antes de continuar.'},
  {id:'pin-olvidado', pregunta:'Se me ha olvidado el PIN, ¿qué hago?', palabras:['olvide','olvidado','pin','recuperar','restablecer','reset'],
    respuesta:'Pídele al administrador (o a quien gestione socios) que te restablezca el PIN desde la pestaña Socios, botón "Restablecer PIN". Te dará uno temporal y tendrás que cambiarlo por el tuyo la próxima vez que entres.'},
  {id:'marcar-cuota', pregunta:'¿Quién puede ver y marcar las cuotas?', palabras:['cuota','cuotas','pagar','pagado','marcar','tesorero'],
    respuesta:'Todos los socios pueden ver la pestaña Cuotas (quién ha pagado y quién falta cada mes), pero solo el tesorero y el administrador pueden marcar una cuota como pagada (se marca con una cruz), previa comprobación.'},
  {id:'reservar', pregunta:'¿Cómo reservo la peña?', palabras:['reservar','reserva','reservas','calendario'],
    respuesta:'Ve a la pestaña Reservas, rellena la fecha y el evento (las horas son opcionales) y pulsa "Reservar a mi nombre". Puedes cancelar tu propia reserva desde la lista de próximas reservas. En los calendarios (Reservas, Reuniones, Tareas) puedes pulsar la etiqueta de un día para ver los detalles de ese evento, muy útil desde el móvil.'},
  {id:'tricount', pregunta:'¿Cómo funciona el Tricount (reparto de gastos)?', palabras:['tricount','reparto','gastos','evento','cena'],
    respuesta:'En la pestaña Tricount crea un evento; para añadir participantes elige un socio en el desplegable y pulsa "+" (nadie entra automáticamente). Cada participante puede registrar los pagos que hizo y entre quién se reparten; la app calcula sola quién tiene que pagar a quién. Cada evento tiene su botón "Enviar por WhatsApp" para mandar al grupo los saldos y quién tiene que pagar a quién, sin tener que explicarlo a mano. Cuando el evento ya está cerrado puedes ocultarlo con el botón "Ocultar".'},
  {id:'tareas', pregunta:'¿Cómo me apunto a una tarea?', palabras:['tarea','tareas','encargado','apuntarme','ticket','estado','pendiente','hecha'],
    respuesta:'En la pestaña Tareas cualquier socio puede crear una tarea. En "Quién la hace" puedes añadir con el botón "+" a tantos socios como haga falta (no tiene por qué ser uno solo), o dejarla sin nadie y que alguien se apunte después con "+ Apuntarme". Una vez creada, cualquier socio puede añadir o quitar gente, editarla, cambiarle el estado o borrarla: el estado (Pendiente / En curso / Hecha) se elige directamente en un desplegable, no hace falta ir pasando por los tres en orden. La tarea nunca se borra sola al cambiar de estado: cuando la marcas como "Hecha" simplemente pasa de "Tareas activas" al "Historial de tareas completadas" más abajo en la misma pestaña, y solo desaparece de verdad si alguien pulsa "Borrar". También puedes enviar el listado de tareas activas al grupo de WhatsApp con un botón.'},
  {id:'foto', pregunta:'¿Cómo cambio mi foto de perfil?', palabras:['foto','avatar','imagen','perfil'],
    respuesta:'Desde la pestaña Socios (o Mi perfil) pulsa el botón "Foto" junto a tu nombre y elige una imagen. Se abre un recuadro donde puedes arrastrarla y hacer zoom para encuadrarla a tu gusto antes de guardarla. Si quieres reencuadrar la foto que ya tienes subida (sin elegir una nueva), pulsa el lápiz que aparece en la esquina de la foto. Si es una foto de iPhone en formato HEIC, conviértela antes a JPG.'},
  {id:'precios-bebidas', pregunta:'¿Quién puede ver y cambiar los precios de las bebidas?', palabras:['bebida','bebidas','precio','precios','consumo','tesorero'],
    respuesta:'Cualquier socio puede consultar los precios en la pestaña Bebidas, para saber cuánto le va a costar antes de servirse (el total se calcula solo al elegir la bebida y la cantidad). Añadir precios nuevos, registrar consumo de otro socio o de un invitado, y gestionar el resto de consumos es cosa del administrador o el tesorero; cualquier socio puede registrar su propio consumo.'},
  {id:'gastos-socios', pregunta:'¿Cómo registro un gasto que he pagado yo para la peña?', palabras:['gasto','gastos','ticket','abonar','abonado','reembolso','verificar','movimiento','movimientos','historial'],
    respuesta:'En Caja > "Gastos e ingresos de socios", rellena el concepto, el importe y la fecha (vale tanto para un gasto que hayas pagado tú como para un ingreso que hayas hecho). Una vez creado, puedes subir una foto o PDF del ticket o factura desde el propio gasto de la lista. Solo tú o el administrador/tesorero podéis editar o borrar esa solicitud; no las de otros socios.\n\nEsta lista es provisional, solo para lo que todavía está pendiente de revisar: en cuanto el tesorero o el administrador lo comprueban y lo marcan como "Abonado"/verificado, la app crea automáticamente un Movimiento permanente en Caja > Movimientos con esos mismos datos (y el ticket o factura, si lo habías subido, se copia también allí) y esa solicitud desaparece sola de esta lista, para que se quede siempre limpia y solo con lo pendiente de verdad. A partir de ahí, el Movimiento generado se queda fijo en el historial de Caja como referencia de lo gastado/ingresado, para consultarlo en años posteriores; no depende ya de la solicitud original.'},
  {id:'filtrar-movimientos', pregunta:'¿Puedo filtrar la lista de Movimientos?', palabras:['filtrar','filtro','movimientos','socio','categoria','categoría','caja'],
    respuesta:'Sí. Encima del listado de Caja > Movimientos tienes dos desplegables: uno para quedarte solo con los movimientos de un socio concreto, y otro para quedarte solo con los de una categoría concreta (por ejemplo "Bebidas" o "Cuotas"). Se pueden combinar los dos filtros a la vez, y el botón "Quitar filtros" los limpia. El envío por WhatsApp de esa lista respeta también los filtros que tengas puestos en ese momento.'},
  {id:'duplicados', pregunta:'¿Qué pasa si registro un gasto que ya estaba apuntado?', palabras:['duplicado','duplicar','repetido','repetir','ya existe','aviso'],
    respuesta:'Al añadir o editar un movimiento (Caja > Registrar movimiento) o un gasto/ingreso de socio, la app comprueba si ya hay algo con la misma fecha y el mismo concepto (mirando tanto en Movimientos como en Gastos e ingresos de socios) y te avisa por si es un duplicado antes de guardarlo. No te lo bloquea del todo -si de verdad son dos cosas distintas el mismo día con el mismo nombre, puedes confirmar igualmente y se guarda-, es solo un aviso para evitar que se apunte dos veces lo mismo por error.'},
  {id:'excel', pregunta:'¿Cómo exporto o importo datos con Excel?', palabras:['excel','exportar','importar','descargar','subir','xlsx','cuentas'],
    respuesta:'Si tienes permiso para exportar datos, verás un botón "Exportar a Excel" en Resumen, Inventario, Bebidas y Caja > Movimientos. Descarga un único archivo con todas las hojas: socios, cuotas, movimientos, Tricount, tareas, etc, con el detalle completo de cada ingreso y gasto.\n\nEl botón "Importar Excel" (al lado del de exportar) lo puede usar cualquier socio, no hace falta ser administrador. Al subir un archivo, la app aplica cada hoja según los permisos que ya tengas en esa parte de la app: si por ejemplo no gestionas cuotas ni finanzas, esas hojas del Excel se ignoran (se avisa en el resumen que aparece después de importar cuántas filas se han omitido y por qué), pero si puedes editar tareas, inventario, reservas o Tricount (que están abiertos a todos), esas filas sí se aplican. Así cualquiera puede reutilizar el importador para corregir o cargar datos en lo que ya tiene permiso de tocar, sin arriesgarse a tocar roles, socios o finanzas sin querer.'},
  {id:'whatsapp', pregunta:'¿Cómo envío información al grupo de WhatsApp?', palabras:['whatsapp','enviar','compartir','grupo','mensaje'],
    respuesta:'Verás un botón "Enviar por WhatsApp" en casi todas las pestañas: Tareas, Reservas, Reuniones, Inventario, Lista de compra (uno por cada lista), Tricount (uno por cada evento, con los saldos y quién paga a quién), Bebidas (con la deuda pendiente), y en Caja tanto en "Gastos e ingresos de socios" como en "Movimientos", además de en Resumen > Cuentas. Al pulsarlo se prepara automáticamente un mensaje con la información más útil de esa pestaña (lo pendiente, lo próximo, etc.) y se abre WhatsApp para que elijas tú mismo a qué chat o grupo lo mandas. Está disponible para todos los socios, sin necesidad de ningún permiso especial.'},
  {id:'roles', pregunta:'¿Qué son los roles y quién los gestiona?', palabras:['rol','roles','permiso','permisos','administrador'],
    respuesta:'Los roles agrupan permisos (ver finanzas, gestionar cuotas, gestionar tareas...). Solo quien tiene permiso para gestionar roles (normalmente el administrador) puede crear roles nuevos y asignárselos a los socios, desde la pestaña Roles.'},
  {id:'avisos', pregunta:'¿Qué es la campana de avisos?', palabras:['campana','aviso','avisos','notificacion','alerta'],
    respuesta:'La campanita de la cabecera avisa de cuotas pendientes, bebidas por pagar y actividad reciente (reservas y reuniones). El número indica cuántos avisos hay ahora mismo; desde ahí también puedes exportarlos como un log de texto. Para cerrar el desplegable, pulsa la campanita otra vez o toca en cualquier otro sitio de la pantalla.'},
  {id:'baja', pregunta:'¿Qué pasa si doy de baja a un socio?', palabras:['baja','eliminar','borrar','socio'],
    respuesta:'Dar de baja a un socio no borra su historial (cuotas pagadas, asistencia a reuniones, etc): simplemente deja de aparecer en el buscador de la pantalla de inicio y se marca como "de baja" en la lista de socios.'},
  {id:'lista-compra', pregunta:'¿Cómo funciona la pestaña Listas?', palabras:['compra','lista','listas','producto','productos','supermercado','pago','derrama','pagos','comida','cena','comidas','cenas','restaurante','invitado','invitados'],
    respuesta:'La pestaña Listas tiene tres apartados. En "Lista de la compra" cualquier socio puede crear una lista nueva (por ejemplo "Supermercado" o "Fiesta mayor") y añadir productos con su cantidad; todos los socios ven las mismas listas y pueden añadir, editar o quitar cualquier producto, y marcarlo con el check cuando ya esté comprado. En "Lista para comidas/cenas" se organiza una quedada para comer o cenar: al crearla eliges el nombre, la fecha, la hora, qué se come (con notas para apuntar, por ejemplo, el nombre del bar) y ese dato se ve siempre en una etiqueta destacada, junto con cuánta gente va apuntada; el desplegable "¿Qué se come?" no está limitado a "Bocadillos" o "Hecho por nosotros", con el botón "+" se pueden añadir tantas opciones nuevas como haga falta (y "-" para quitar la seleccionada). Para apuntar o quitar socios, o para añadir invitados que no son socios, hay un desplegable "Apuntar o quitar gente" con un selector para ir añadiendo socios uno a uno. En "Lista para pagos" se usan para derramas o pagos extra: al crear la lista se genera una fila para cada socio activo con el importe indicado, aparece el número de cuenta en la cabecera, y cada uno marca su fila como pagada cuando hace el ingreso. En los tres apartados cualquier socio puede cambiar el título después de creada la lista con "Editar título" (en comidas/cenas hay además un botón "Editar" para cambiar también la fecha, la hora, el tipo y las notas), y cada lista tiene su propio botón "Enviar por WhatsApp".'},
  {id:'inventario', pregunta:'¿Quién puede añadir o editar el material del inventario?', palabras:['inventario','material','estado','revision','comprar'],
    respuesta:'Todos los socios ven el inventario. Añadir material nuevo es cosa de quien tiene el permiso de gestionar inventario, pero una vez que un material ya está creado, cualquier socio puede editarlo (nombre, categoría, cantidad, estado o notas) y también borrarlo, por ejemplo para actualizar su estado a "Necesita revisión" o "Hay que comprar". Hay un botón para enviar por WhatsApp solo lo que está pendiente de revisar o comprar, sin tener que mandar el inventario entero.'},
];
function buscarFaq(query){
  const q = query.toLowerCase().trim();
  if(!q) return FAQ_ENTRIES;
  const terminos = q.split(/\s+/).filter(Boolean);
  return FAQ_ENTRIES
    .map(entry=>{
      let score = 0;
      terminos.forEach(t=>{
        if(entry.palabras.some(p=>p.includes(t) || t.includes(p))) score += 2;
        if(entry.pregunta.toLowerCase().includes(t)) score += 1;
      });
      return {entry, score};
    })
    .filter(r=>r.score>0)
    .sort((a,b)=>b.score-a.score)
    .map(r=>r.entry);
}
let ayudaAbierta = false;
let ayudaQuery = '';
let ayudaTranscript = []; // {pregunta, respuesta}
const HELP_ICON_PATH = '<circle cx="12" cy="12" r="9"/><path d="M9.2 9.2a2.8 2.8 0 0 1 5.4.9c0 1.8-2.6 2-2.6 3.7"/><path d="M12 17.2h.01"/>';
function renderAyuda(){
  const btn = `<button class="help-fab" data-action="toggle-ayuda" title="${ayudaAbierta?'Cerrar ayuda':'Ayuda'}"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${HELP_ICON_PATH}</svg></button>`;
  if(!ayudaAbierta) return btn;
  const sugerencias = buscarFaq(ayudaQuery);
  return `
  <div class="help-backdrop" data-action="toggle-ayuda"></div>
  <div class="help-panel">
    <div class="help-panel-header">
      <b>Ayuda rápida</b>
      <button class="help-close" data-action="toggle-ayuda" title="Cerrar">&times;</button>
    </div>
    <div class="help-transcript" id="help-transcript">
      ${ayudaTranscript.length===0 ? '<p class="empty">Escribe tu duda o elige una pregunta frecuente de abajo.</p>' : ayudaTranscript.map(t=>`
        <div class="help-msg help-msg-q">${escapeHtml(t.pregunta)}</div>
        <div class="help-msg help-msg-a">${escapeHtml(t.respuesta)}</div>
      `).join('')}
    </div>
    <input type="text" id="help-search-input" class="help-search-input" placeholder="Escribe tu duda..." value="${escapeHtml(ayudaQuery)}" autocomplete="off">
    <div class="help-suggestions" id="help-suggestions">${renderHelpSuggestions(sugerencias)}</div>
  </div>
  ${btn}`;
}
function renderHelpSuggestions(entries){
  if(entries.length===0) return '<p class="empty" style="font-size:0.8rem;">No he encontrado nada parecido.</p>';
  return entries.slice(0,6).map(e=>`<button class="help-suggestion" data-action="ask-faq" data-id="${e.id}">${escapeHtml(e.pregunta)}</button>`).join('');
}

function initBackgroundSlideshow(){
  const layerA = document.getElementById('bg-layer-a');
  const layerB = document.getElementById('bg-layer-b');
  if(!layerA || !layerB || BG_IMAGES.length===0) return;
  let idx = 0, active = 'a';

  function setImage(layer, src){
    layer.querySelector('.bg-blur').style.backgroundImage = `url(${src})`;
    layer.querySelector('.bg-photo').src = src;
  }

  setImage(layerA, BG_IMAGES[0]);
  layerA.style.opacity = '1';
  if(BG_IMAGES.length < 2) return;
  setInterval(()=>{
    idx = (idx+1) % BG_IMAGES.length;
    const showLayer = active==='a' ? layerB : layerA;
    const hideLayer = active==='a' ? layerA : layerB;
    setImage(showLayer, BG_IMAGES[idx]);
    showLayer.style.opacity = '1';
    hideLayer.style.opacity = '0';
    active = active==='a' ? 'b' : 'a';
  }, 11000);
}

function updateBackgroundVisibility(){
  const loggedIn = state && state.current_user;
  document.body.classList.toggle('bg-hidden', !!loggedIn);
}

function loadBackgroundImages(){
  BG_IMAGES = DEFAULT_BG_IMAGES;
}

let loginDragState = {
  active: false,
  startX: 0,
  startY: 0,
  originX: 0,
  originY: 0,
};

function initLoginDrag(){
  const wrap = document.querySelector('.login-wrap');
  const handle = wrap ? wrap.querySelector('.masthead') : null;
  if(!wrap || !handle) return;

  handle.addEventListener('pointerdown', (event) => {
    if(event.button !== 0) return;
    if(event.target.closest('button, input, select, textarea, label')) return;
    event.preventDefault();
    const rect = wrap.getBoundingClientRect();
    loginDragState.active = true;
    loginDragState.startX = event.clientX;
    loginDragState.startY = event.clientY;
    loginDragState.originX = rect.left;
    loginDragState.originY = rect.top;
    wrap.classList.add('dragging');
    document.addEventListener('pointermove', onLoginDragMove);
    document.addEventListener('pointerup', stopLoginDrag);
    document.addEventListener('pointercancel', stopLoginDrag);
  });
}

function onLoginDragMove(event){
  if(!loginDragState.active) return;
  event.preventDefault();
  const wrap = document.querySelector('.login-wrap');
  if(!wrap) return;
  const dx = event.clientX - loginDragState.startX;
  const dy = event.clientY - loginDragState.startY;
  wrap.style.left = `${loginDragState.originX + dx}px`;
  wrap.style.top = `${loginDragState.originY + dy}px`;
  wrap.style.transform = 'translate(0, 0)';
}

function stopLoginDrag(){
  if(!loginDragState.active) return;
  loginDragState.active = false;
  const wrap = document.querySelector('.login-wrap');
  if(wrap) wrap.classList.remove('dragging');
  document.removeEventListener('pointermove', onLoginDragMove);
  document.removeEventListener('pointerup', stopLoginDrag);
  document.removeEventListener('pointercancel', stopLoginDrag);
}

let state = null;
let activeTab = 'resumen';
let listasSubTab = 'compra';
let consumosPeriodo = {tipo:'todos', valor:''};
let consumosFiltroSocio = ''; // '' = todos, '__no_socio__' = solo invitados, o un id de socio
let cuotasYear = new Date().getFullYear();
let cuotasMesMovil = new Date().getMonth()+1;
let resumenGraficoYear = new Date().getFullYear();
let resumenPeriodo = {tipo:'mes', valor: todayISO().slice(0,7)};
let cajaPeriodo = {tipo:'mes', valor: todayISO().slice(0,7)};
let cuentasPeriodo = {tipo:'todos', valor:''};
let tareasHistorialPeriodo = {tipo:'todos', valor:''};
let editandoNombreListaId = null;
let reservasCalFecha = new Date();
let reunionesCalFecha = new Date();
let reunionesAsistenciaAbierta = {}; // {reunionId: true} -> desplegable de asistentes abierto
let reunionesActaAbierta = {}; // {reunionId: true} -> desplegable del acta abierto
let editandoActaId = null; // id de la reunión cuya acta se está redactando ahora mismo
let editandoConsumoId = null; // id del consumo de bebida (propio) que se está editando ahora mismo
let editandoReunionId = null; // id de la reunión que se está editando ahora mismo (fecha, tema, horas, notas)
let editandoReservaId = null; // id de la reserva que se está editando ahora mismo
let nuevoEventoParticipantes = [];
let editandoGastoSocioId = null;
let filtroSocioLiquidar = ''; // id de socio para filtrar "Gastos e ingresos de socios" (liquidacion del tesorero)
let seleccionGastosSocios = new Set(); // ids de gastos/ingresos de socios pendientes marcados para pagar en bloque
let editandoMovimientoId = null;
let filtroSocioMovimientos = ''; // id de socio para filtrar "Movimientos"
let filtroCategoriaMovimientos = ''; // nombre de categoría para filtrar "Movimientos"
let editandoItemCompraId = null;
let editandoItemPagoId = null;
let editandoTareaId = null;
let editandoInventarioId = null;
let editandoBebidaPrecioId = null;
let editandoListaComidaId = null;
let estatutosEditando = false;
let nuevaTareaSocios = [];
let viendoSocioId = null; // si está a un id distinto del propio, "Mi perfil" muestra ese socio en modo lectura
let adjuntoAbierto = null; // {url, tipo} del ticket/factura abierto en el visor interno
let ticketVersion = Date.now();
let loaded = false;
let chatMensajes = []; // mensajes cargados en memoria, más recientes al final
let chatLastId = 0; // mayor id ya recibido del servidor
let chatPollTimer = null;
let chatAbierto = false;
let chatArchivoSeleccionado = null; // File pendiente de adjuntar al próximo mensaje
let emojiPickerAbierto = false;
let editandoMensajeId = null; // id del mensaje propio que se está editando ahora mismo
const EMOJIS_CHAT = ['😀','😂','😅','😉','😊','😍','😘','😜','🤔','😎','😴','😭','😡','🥳','🤢','😱',
  '👍','👎','🙏','👏','💪','🤝','❤️','🔥','🎉','🍺','🍻','🍕','☕','⚽','🎲','🃏','☀️','🌧️','⏰','📅','✅','❌','⚠️'];
let pendingLoginId = null; // socio seleccionado, esperando que escriba su PIN
let loginSearchQuery = ''; // texto escrito en "Escribe tu nombre" de la pantalla de login
let loginDragInitialized = false;

// Guardar y recuperar usuario favorito
function saveFavoriteUser(socioId){
  localStorage.setItem('favoriteUserId', socioId);
}
function getFavoriteUser(){
  return localStorage.getItem('favoriteUserId');
}
function clearFavoriteUser(){
  localStorage.removeItem('favoriteUserId');
}

/* ---------- fetch helpers ---------- */
async function api(path, opts){
  opts = Object.assign({}, opts || {});
  const headers = Object.assign({}, opts.headers || {});
  if (!(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(path, Object.assign({headers, credentials:'same-origin'}, opts));
  if(!res.ok){
    let msg = 'Error de red';
    try{ const j = await res.json(); msg = j.error || msg; }catch(e){}
    throw new Error(msg);
  }
  return res.status===204 ? null : res.json();
}
const apiGet = (p)=>api(p);
const apiPost = (p,body)=>api(p,{method:'POST', body:JSON.stringify(body||{})});
const apiPatch = (p,body)=>api(p,{method:'PATCH', body:JSON.stringify(body||{})});
const apiDelete = (p)=>api(p,{method:'DELETE'});

async function loadState(){
  try{
    state = await apiGet('/api/state');
    loaded = true;
    // Si hay usuario favorito guardado y está activo, pre-seleccionarlo
    if(!pendingLoginId){
      const favId = getFavoriteUser();
      if(favId && state.socios.some(s=>s.id===favId && s.activo)){
        
        pendingLoginId = favId;
      }
    }
  }catch(e){ console.error('No se pudo cargar el estado', e); }
}

function can(permission){ return !!(state && (state.permissions || []).includes(permission)); }
function isAdmin(){ return can("manage_roles"); }
function roleNames(socio){
  const roles = state && state.roles ? state.roles : [];
  return (socio.roles || ["socio"]).map(id=>{
    const role = roles.find(r=>r.id===id);
    return role ? role.nombre : id;
  });
}
function uid(){ return Math.random().toString(36).slice(2,10); }
function money(n){ return (Number(n)||0).toLocaleString('es-ES',{minimumFractionDigits:2, maximumFractionDigits:2}) + ' EUR'; }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function enviarWhatsapp(texto){ window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank'); }
/* ---------- filtros de período (mes / semana / día) ---------- */
function isoWeekKey(fechaISO){
  if(!fechaISO) return '';
  const d = new Date(fechaISO+'T00:00:00');
  d.setDate(d.getDate() + 4 - (d.getDay()||7));
  const inicioAnio = new Date(d.getFullYear(),0,1);
  const semana = Math.ceil((((d - inicioAnio) / 86400000) + 1)/7);
  return `${d.getFullYear()}-W${String(semana).padStart(2,'0')}`;
}
function dentroDePeriodo(fechaISO, periodo){
  if(!periodo || periodo.tipo==='todos' || !periodo.valor) return true;
  if(!fechaISO) return false;
  if(periodo.tipo==='anio') return fechaISO.slice(0,4)===periodo.valor;
  if(periodo.tipo==='mes') return fechaISO.slice(0,7)===periodo.valor;
  if(periodo.tipo==='semana') return isoWeekKey(fechaISO)===periodo.valor;
  if(periodo.tipo==='dia') return fechaISO===periodo.valor;
  return true;
}
function labelPeriodo(periodo){
  if(!periodo || periodo.tipo==='todos' || !periodo.valor) return '';
  if(periodo.tipo==='anio') return periodo.valor;
  if(periodo.tipo==='mes') return labelMes(periodo.valor);
  if(periodo.tipo==='semana'){ const [y,w] = periodo.valor.split('-W'); return `semana ${w} de ${y}`; }
  if(periodo.tipo==='dia') return fmtDate(periodo.valor);
  return '';
}
function rangoPeriodo(periodo){
  if(!periodo || periodo.tipo==='todos' || !periodo.valor) return {desde:null, hasta:null};
  if(periodo.tipo==='dia') return {desde:periodo.valor, hasta:periodo.valor};
  const fmt = dt=>`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  if(periodo.tipo==='anio'){
    return {desde:`${periodo.valor}-01-01`, hasta:`${periodo.valor}-12-31`};
  }
  if(periodo.tipo==='mes'){
    const [y,m] = periodo.valor.split('-').map(Number);
    const ultimoDia = new Date(y, m, 0).getDate();
    return {desde:`${periodo.valor}-01`, hasta:`${periodo.valor}-${String(ultimoDia).padStart(2,'0')}`};
  }
  if(periodo.tipo==='semana'){
    const [yStr, wStr] = periodo.valor.split('-W');
    const y = Number(yStr), w = Number(wStr);
    const simple = new Date(y,0,1+(w-1)*7);
    const dow = simple.getDay() || 7;
    const monday = new Date(simple);
    monday.setDate(simple.getDate() - dow + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate()+6);
    return {desde:fmt(monday), hasta:fmt(sunday)};
  }
  return {desde:null, hasta:null};
}
function renderSelectorPeriodo(idPrefix, periodo, mesesOpciones){
  const tipo = periodo.tipo || 'todos';
  const anios = [...new Set(mesesOpciones.map(k=>k.slice(0,4)))].sort((a,b)=>b.localeCompare(a));
  return `<span class="periodo-selector">
    <select id="${idPrefix}-tipo" data-periodo-prefix="${idPrefix}">
      <option value="todos" ${tipo==='todos'?'selected':''}>Todos</option>
      <option value="anio" ${tipo==='anio'?'selected':''}>Por año</option>
      <option value="mes" ${tipo==='mes'?'selected':''}>Por mes</option>
      <option value="semana" ${tipo==='semana'?'selected':''}>Por semana</option>
      <option value="dia" ${tipo==='dia'?'selected':''}>Por día</option>
    </select>
    ${tipo==='anio' ? `<select id="${idPrefix}-valor" data-periodo-prefix="${idPrefix}">${anios.map(a=>`<option value="${a}" ${periodo.valor===a?'selected':''}>${a}</option>`).join('')}</select>` : ''}
    ${tipo==='mes' ? `<select id="${idPrefix}-valor" data-periodo-prefix="${idPrefix}">${mesesOpciones.map(k=>`<option value="${k}" ${periodo.valor===k?'selected':''}>${labelMes(k)}</option>`).join('')}</select>` : ''}
    ${tipo==='semana' ? `<input type="week" id="${idPrefix}-valor" data-periodo-prefix="${idPrefix}" value="${periodo.valor||''}">` : ''}
    ${tipo==='dia' ? `<input type="date" id="${idPrefix}-valor" data-periodo-prefix="${idPrefix}" value="${periodo.valor||''}">` : ''}
  </span>`;
}
function valorPorDefectoPeriodo(tipo){
  if(tipo==='anio') return String(new Date().getFullYear());
  if(tipo==='mes') return todayISO().slice(0,7);
  if(tipo==='semana') return isoWeekKey(todayISO());
  if(tipo==='dia') return todayISO();
  return '';
}
function encontrarPosibleDuplicado(concepto, fecha, excluirId){
  const norm = s=>(s||'').trim().toLowerCase();
  const c = norm(concepto);
  if(!c || !fecha) return null;
  const candidatos = [
    ...state.movimientos.map(m=>({origen:'un movimiento', concepto:m.concepto, fecha:m.fecha, importe:m.importe, id:m.id})),
    ...(state.gastos_socios||[]).map(g=>({origen:'un gasto/ingreso de socio', concepto:g.concepto, fecha:g.fecha, importe:g.importe, id:g.id})),
  ];
  return candidatos.find(x=>x.id!==excluirId && x.fecha===fecha && norm(x.concepto)===c) || null;
}
function confirmarSiPosibleDuplicado(concepto, fecha, excluirId){
  const dup = encontrarPosibleDuplicado(concepto, fecha, excluirId);
  if(!dup) return true;
  return confirm(`Ya existe ${dup.origen} el ${fmtDate(dup.fecha)} con el mismo concepto ("${dup.concepto}", ${money(dup.importe)}). Puede que ya esté registrado. ¿Quieres añadirlo/guardarlo de todas formas?`);
}
function fmtDate(iso){
  if(!iso) return '';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function fmtHoras(r){
  if(!r.hora_inicio && !r.hora_fin) return 'Todo el día';
  if(r.hora_inicio && r.hora_fin) return `${r.hora_inicio} - ${r.hora_fin}`;
  return r.hora_inicio ? `desde las ${r.hora_inicio}` : `hasta las ${r.hora_fin}`;
}
function socioNombre(id){ const s = state.socios.find(s=>s.id===id); return s ? s.nombre : '-'; }
function initials(name){
  return (name||'').trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase();
}
const PENCIL_ICON_PATH = '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>';
const PAPERCLIP_ICON_PATH = '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>';
const SMILE_ICON_PATH = '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>';
function toolIcon(pathD){
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pathD}</svg>`;
}
function miniIcon(pathD){
  return `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pathD}</svg>`;
}
function avatarHtml(socio, size, mode){
  size = size || 'sm';
  const inner = `<div class="avatar avatar-${size}" data-avatar-for="${socio.id}">
    <img src="/static/avatars/${socio.id}.jpg?v=${avatarVersion}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
    <span class="avatar-fallback" style="display:none;">${escapeHtml(initials(socio.nombre))}</span>
  </div>`;
  if(!mode) return inner;
  const viewBtn = `<button type="button" class="avatar-clickable" data-action="ver-foto-grande" title="Ver foto en grande">${inner}</button>`;
  if(mode!=='edit') return viewBtn;
  const editSize = size==='lg' ? 'lg' : 'sm';
  const editBtn = `<button type="button" class="avatar-edit-btn avatar-edit-btn-${editSize}" data-action="editar-foto-existente" data-id="${socio.id}" title="Editar foto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PENCIL_ICON_PATH}</svg></button>`;
  return `<span class="avatar-wrap">${viewBtn}${editBtn}</span>`;
}
async function uploadFoto(socioId, file){
  const fd = new FormData();
  fd.append('foto', file, file.name || 'foto.jpg');
  const res = await fetch(`/api/socios/${socioId}/foto`, {method:'POST', body:fd});
  if(!res.ok){
    let msg = 'No se pudo subir la foto.';
    try{ const j = await res.json(); msg = j.error || msg; }catch(e){}
    throw new Error(msg);
  }
  avatarVersion = Date.now();
}

/* ============ recorte de foto de perfil (encuadre manual, arrastrar y hacer zoom) ============ */
function openFotoCropModal(file, socioId){
  const objectUrl = URL.createObjectURL(file);
  const img = new Image();
  img.onload = ()=>buildCropModal(img, objectUrl, socioId);
  img.onerror = ()=>{
    URL.revokeObjectURL(objectUrl);
    alert('No se pudo leer esa imagen. Prueba con un archivo .jpg o .png.');
  };
  img.src = objectUrl;
}

function editExistingFoto(url, socioId){
  const img = new Image();
  img.onload = ()=>buildCropModal(img, null, socioId);
  img.onerror = ()=>alert('No se pudo cargar la foto actual para reencuadrarla.');
  img.src = url;
}

function buildCropModal(img, objectUrl, socioId){
  const VIEWPORT = 260;
  const natW = img.naturalWidth, natH = img.naturalHeight;
  const baseScale = VIEWPORT / Math.min(natW, natH);
  let zoom = 1, panX = 0, panY = 0;

  const backdrop = document.createElement('div');
  backdrop.className = 'crop-modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'crop-modal';
  modal.innerHTML = `
    <div class="crop-panel">
      <h3>Encuadra tu foto</h3>
      <div class="crop-viewport"></div>
      <p class="meta">Arrastra para mover, usa el control para acercar o alejar.</p>
      <div class="crop-zoom-row">
        <span class="meta">Zoom</span>
        <input type="range" min="100" max="300" value="100" class="crop-zoom-input">
      </div>
      <div class="crop-actions">
        <button type="button" class="btn ghost" data-crop-cancel>Cancelar</button>
        <button type="button" class="btn" data-crop-confirm>Usar esta foto</button>
      </div>
    </div>`;
  const viewport = modal.querySelector('.crop-viewport');
  img.style.position = 'absolute';
  img.style.top = '0';
  img.style.left = '0';
  img.style.transformOrigin = '0 0';
  img.draggable = false;
  viewport.appendChild(img);

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
  document.body.classList.add('no-scroll');

  function clampPan(){
    const scale = baseScale * zoom;
    const dispW = natW * scale, dispH = natH * scale;
    const centeredLeft = (VIEWPORT - dispW) / 2, centeredTop = (VIEWPORT - dispH) / 2;
    let left = centeredLeft + panX, top = centeredTop + panY;
    left = Math.min(0, Math.max(VIEWPORT - dispW, left));
    top = Math.min(0, Math.max(VIEWPORT - dispH, top));
    panX = left - centeredLeft;
    panY = top - centeredTop;
    return {left, top, scale};
  }
  function applyTransform(){
    const {left, top, scale} = clampPan();
    img.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
  }
  applyTransform();

  let dragging = false, startX = 0, startY = 0, startPanX = 0, startPanY = 0;
  viewport.addEventListener('pointerdown', (e)=>{
    dragging = true;
    viewport.classList.add('dragging');
    startX = e.clientX; startY = e.clientY;
    startPanX = panX; startPanY = panY;
    viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener('pointermove', (e)=>{
    if(!dragging) return;
    panX = startPanX + (e.clientX - startX);
    panY = startPanY + (e.clientY - startY);
    applyTransform();
  });
  function stopDrag(){ dragging = false; viewport.classList.remove('dragging'); }
  viewport.addEventListener('pointerup', stopDrag);
  viewport.addEventListener('pointercancel', stopDrag);

  modal.querySelector('.crop-zoom-input').addEventListener('input', (e)=>{
    zoom = Number(e.target.value) / 100;
    applyTransform();
  });

  function cleanup(){
    document.body.classList.remove('no-scroll');
    backdrop.remove();
    modal.remove();
    if(objectUrl) URL.revokeObjectURL(objectUrl);
  }
  modal.querySelector('[data-crop-cancel]').addEventListener('click', cleanup);
  backdrop.addEventListener('click', cleanup);

  modal.querySelector('[data-crop-confirm]').addEventListener('click', async ()=>{
    const confirmBtn = modal.querySelector('[data-crop-confirm]');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Procesando...';
    let blob;
    try{
      const {left, top, scale} = clampPan();
      const sx = -left / scale, sy = -top / scale, sSize = VIEWPORT / scale;
      const OUT = 640;
      const canvas = document.createElement('canvas');
      canvas.width = OUT; canvas.height = OUT;
      canvas.getContext('2d').drawImage(img, sx, sy, sSize, sSize, 0, 0, OUT, OUT);
      blob = await new Promise(resolve=>canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if(!blob) throw new Error('No se pudo recortar la imagen.');
    }catch(err){
      alert(err.message || 'No se pudo recortar la imagen.');
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Usar esta foto';
      return;
    }
    const previewUrl = URL.createObjectURL(blob);
    document.querySelectorAll(`[data-avatar-for="${socioId}"] img`).forEach(im=>{
      im.src = previewUrl;
      im.style.display = '';
      if(im.nextElementSibling) im.nextElementSibling.style.display = 'none';
    });
    cleanup();
    try{
      await uploadFoto(socioId, blob);
      await loadState();
      render();
    }catch(err){
      alert(err.message || 'No se pudo subir la foto.');
    }
  });
}

async function uploadTicketGasto(gastoId, file){
  const fd = new FormData();
  fd.append('ticket', file);
  const res = await fetch(`/api/gastos-socios/${gastoId}/ticket`, {method:'POST', body:fd});
  if(!res.ok){
    let msg = 'No se pudo subir el ticket.';
    try{ const j = await res.json(); msg = j.error || msg; }catch(e){}
    throw new Error(msg);
  }
  ticketVersion = Date.now();
}
async function uploadTicketPago(eventoId, pagoId, file){
  const fd = new FormData();
  fd.append('ticket', file);
  const res = await fetch(`/api/gastos-eventos/${eventoId}/pagos/${pagoId}/ticket`, {method:'POST', body:fd});
  if(!res.ok){
    let msg = 'No se pudo subir el ticket.';
    try{ const j = await res.json(); msg = j.error || msg; }catch(e){}
    throw new Error(msg);
  }
  ticketVersion = Date.now();
}
async function uploadTicketMovimiento(movId, file){
  const fd = new FormData();
  fd.append('ticket', file);
  const res = await fetch(`/api/movimientos/${movId}/ticket`, {method:'POST', body:fd});
  if(!res.ok){
    let msg = 'No se pudo subir el ticket o factura.';
    try{ const j = await res.json(); msg = j.error || msg; }catch(e){}
    throw new Error(msg);
  }
  ticketVersion = Date.now();
}
async function uploadActaArchivo(rid, file){
  const fd = new FormData();
  fd.append('archivo', file);
  const res = await fetch(`/api/reuniones/${rid}/acta-archivo`, {method:'POST', body:fd});
  if(!res.ok){
    let msg = 'No se pudo subir el archivo del acta.';
    try{ const j = await res.json(); msg = j.error || msg; }catch(e){}
    throw new Error(msg);
  }
  ticketVersion = Date.now();
}
async function uploadEstatutosArchivo(file){
  const fd = new FormData();
  fd.append('archivo', file);
  const res = await fetch('/api/estatutos/archivos', {method:'POST', body:fd});
  if(!res.ok){
    let msg = 'No se pudo subir el documento.';
    try{ const j = await res.json(); msg = j.error || msg; }catch(e){}
    throw new Error(msg);
  }
  ticketVersion = Date.now();
}
async function uploadChatArchivo(mid, file){
  const fd = new FormData();
  fd.append('archivo', file);
  const res = await fetch(`/api/chat/${mid}/archivo`, {method:'POST', body:fd});
  if(!res.ok){
    let msg = 'No se pudo subir el archivo adjunto.';
    try{ const j = await res.json(); msg = j.error || msg; }catch(e){}
    throw new Error(msg);
  }
  return res.json();
}
function escapeHtml(str){
  return String(str==null?'':str).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function linkify(str){
  const escaped = escapeHtml(str);
  return escaped.replace(/(\bhttps?:\/\/[^\s<]+|\bwww\.[^\s<]+)/gi, (match)=>{
    const trailMatch = match.match(/[.,;:!?)\]}'"]+$/);
    const trail = trailMatch ? trailMatch[0] : '';
    const core = trail ? match.slice(0, -trail.length) : match;
    const href = /^https?:\/\//i.test(core) ? core : 'https://'+core;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${core}</a>${trail}`;
  });
}
function timeAgoEs(iso){
  if(!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs/86400000);
  if(days<=0) return 'hoy';
  if(days===1) return 'ayer';
  return `hace ${days} días`;
}

/* ============ CHAT DE SOCIOS (polling simple) ============ */
const CHAT_POLL_MS = 12000;
function chatStorageKey(){ return 'chatLeido_' + (state && state.current_user); }
function chatLastReadId(){
  if(!state || !state.current_user) return 0;
  return Number(localStorage.getItem(chatStorageKey())||0);
}
function chatMarkRead(id){
  if(!state || !state.current_user) return;
  localStorage.setItem(chatStorageKey(), String(id));
}
function chatUnreadCount(){
  if(!state || !state.current_user) return 0;
  const leido = chatLastReadId();
  return chatMensajes.filter(m=>m.id>leido && m.socio_id!==state.current_user).length;
}
function fmtHoraCorta(iso){
  if(!iso) return '';
  const d = new Date(iso);
  if(isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-ES',{hour:'2-digit', minute:'2-digit'});
}
const CHAT_NAME_COLORS = ['#7fa88c','#6b8fb0','#c98bd9','#d9a544','#5fbcd3','#e08a8a','#9ac47a','#b09ce0','#4fb894','#d98ab0'];
function chatNombreColor(socioId){
  let hash = 0;
  const s = String(socioId||'');
  for(let i=0;i<s.length;i++){ hash = (hash*31 + s.charCodeAt(i)) >>> 0; }
  return CHAT_NAME_COLORS[hash % CHAT_NAME_COLORS.length];
}
async function loadChatInicial(){
  try{
    const r = await apiGet('/api/chat');
    chatMensajes = r.mensajes || [];
    chatLastId = chatMensajes.reduce((max,m)=>Math.max(max,m.id), 0);
  }catch(e){ console.error('No se pudo cargar el chat', e); }
}
function appendChatMensajesDom(nuevos){
  const wrap = document.getElementById('chat-messages');
  if(!wrap) return;
  const vacio = wrap.querySelector('.empty');
  if(vacio) vacio.remove();
  const cercaDelFinal = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 80;
  nuevos.forEach(m=>{ wrap.insertAdjacentHTML('beforeend', renderChatMsg(m)); });
  if(cercaDelFinal) wrap.scrollTop = wrap.scrollHeight;
}
function rerenderChatMsg(id){
  const m = chatMensajes.find(x=>String(x.id)===String(id));
  const el = document.querySelector(`.chat-msg[data-id="${id}"]`);
  if(m && el) el.outerHTML = renderChatMsg(m);
}
function updateChatBadge(){
  const n = chatUnreadCount();
  const badge = document.getElementById('chat-badge');
  if(badge){
    badge.textContent = n>9 ? '9+' : String(n);
    badge.style.display = n>0 ? '' : 'none';
  }
}
function chatIrAlFinalYMarcar(){
  chatMarkRead(chatLastId);
  updateChatBadge();
  requestAnimationFrame(()=>{
    const wrap = document.getElementById('chat-messages');
    if(wrap) wrap.scrollTop = wrap.scrollHeight;
  });
}
function initChatToastContainer(){
  if(document.getElementById('chat-toast-container')) return;
  const cont = document.createElement('div');
  cont.id = 'chat-toast-container';
  cont.className = 'chat-toast-container';
  document.body.appendChild(cont);
}
function showChatToast(mensaje){
  const cont = document.getElementById('chat-toast-container');
  if(!cont) return;
  const toast = document.createElement('div');
  toast.className = 'chat-toast';
  toast.innerHTML = `<b>${escapeHtml(mensaje.socio_nombre||'Alguien')}</b><span>${escapeHtml((mensaje.texto||'').slice(0,140))}</span>`;
  toast.addEventListener('click', ()=>{
    chatAbierto = true;
    alertasAbiertas = false;
    render();
    chatIrAlFinalYMarcar();
  });
  cont.appendChild(toast);
  requestAnimationFrame(()=>toast.classList.add('visible'));
  setTimeout(()=>{
    toast.classList.remove('visible');
    setTimeout(()=>toast.remove(), 300);
  }, 6000);
}
async function pollChat(){
  if(TABLET_MODE || document.hidden || !state || !state.current_user) return;
  try{
    const r = await apiGet(`/api/chat?since=${chatLastId}`);
    const nuevos = r.mensajes || [];
    if(nuevos.length===0) return;
    chatMensajes = chatMensajes.concat(nuevos).slice(-200);
    chatLastId = nuevos.reduce((max,m)=>Math.max(max,m.id), chatLastId);
    if(chatAbierto){
      appendChatMensajesDom(nuevos);
      chatMarkRead(chatLastId);
      updateChatBadge();
    } else {
      const deOtros = nuevos.filter(m=>m.socio_id!==state.current_user);
      if(deOtros.length===1) showChatToast(deOtros[0]);
      else if(deOtros.length>1) showChatToast({socio_nombre:'Chat de socios', texto:`${deOtros.length} mensajes nuevos`});
      updateChatBadge();
    }
  }catch(e){ console.error('No se pudo actualizar el chat', e); }
}
function startChatPolling(){
  if(TABLET_MODE || chatPollTimer) return;
  chatPollTimer = setInterval(pollChat, CHAT_POLL_MS);
}
function stopChatPolling(){
  if(chatPollTimer){ clearInterval(chatPollTimer); chatPollTimer = null; }
}
async function chatOnLogin(){
  if(TABLET_MODE) return;
  if(chatMensajes.length===0) await loadChatInicial();
  updateChatBadge();
  startChatPolling();
}

// Al editar/cancelar un gasto o movimiento, render() reconstruye toda la
// pantalla y la fila puede quedar más arriba o más abajo que antes (p.ej. si
// el formulario de edición ocupa más o menos que la fila normal). Esto ancla
// la fila con ese id a la misma posición en la pantalla antes y después del
// cambio, para que no "salte" ni haya que volver a buscarla.
function anclarScroll(id){
  if(!id) return ()=>{};
  const sel = `.list-item[data-id="${id}"], .menu-row[data-id="${id}"], .card[data-id="${id}"], form[data-form][data-id="${id}"], [data-anchor-id="${id}"]`;
  const buscar = ()=> document.querySelector(sel);
  const el = buscar();
  if(!el) return ()=>{};
  const y0 = el.getBoundingClientRect().top;
  return ()=>{
    const nuevo = buscar();
    if(nuevo) window.scrollBy(0, nuevo.getBoundingClientRect().top - y0);
  };
}

/* ============ RENDER ROOT ============ */
function render(){
  updateBackgroundVisibility();
  document.body.classList.toggle('no-scroll', !!adjuntoAbierto);
  const app = document.getElementById('app');
  if(!loaded){ app.innerHTML = `<div class="loading-screen">Abriendo la peña</div>`; return; }
  if(!state.current_user){
    app.innerHTML = renderLogin() + (TABLET_MODE ? '' : renderAyuda());
    if(!loginDragInitialized){
      loginDragInitialized = true;
      initLoginDrag();
    }
    scrollHelpTranscript();
    return;
  }
  const me = state.socios.find(s=>s.id===state.current_user);
  if(me && me.must_change_pin){ app.innerHTML = renderForcePin(me) + renderAyuda(); scrollHelpTranscript(); return; }
  if(TABLET_MODE){ app.innerHTML = renderTabletKiosk(me); return; }
  app.innerHTML = renderApp() + renderAyuda() + renderAlertasPanel() + renderChatPanel() + renderAdjuntoViewer();
  scrollHelpTranscript();
  enhanceCardHeaders();
}
/* ============ titulo subrayado (solo el texto, nunca los botones de accion) y
   plegar/desplegar las tarjetas de "crear/anadir algo" ============ */
let cardsColapsadas = {}; // {"add-movimiento|": true} -> plegada
function tituloWrapDe(h2){
  const primero = h2.firstElementChild;
  // mientras se esta editando el titulo (un <form> en vez de texto) no hay nada que subrayar.
  if(primero && primero.tagName==='FORM') return null;
  // exclusion explicita: este titulo no lleva subrayado (p.ej. eventos de tricount).
  if(primero && primero.classList.contains('sin-subrayado')) return null;
  // si el primer hijo ya es un <span> que no es el punto ".pin", es que el titulo
  // (punto + texto) ya viene envuelto junto -> lo reutilizamos tal cual.
  if(primero && primero.tagName==='SPAN' && !primero.classList.contains('pin')){
    primero.classList.add('h2-underline');
    return primero;
  }
  // si no, el titulo es texto suelto (con el punto .pin al lado) -> lo envolvemos.
  const wrap = document.createElement('span');
  wrap.className = 'h2-underline';
  while(h2.firstChild) wrap.appendChild(h2.firstChild);
  h2.appendChild(wrap);
  return wrap;
}
function enhanceCardHeaders(){
  document.querySelectorAll('.card > h2').forEach(h2=>{
    tituloWrapDe(h2);
  });
  document.querySelectorAll('.card:not(.no-collapse) > h2:first-child + form[data-form], .card:not(.no-collapse) > h2:first-child + * + form[data-form]').forEach(form=>{
    // los formularios de edicion de un elemento ya existente (edit-*) no son
    // la tarjeta plegable de "anadir nuevo": si un item editado resulta ser
    // el primer hijo tras el h2 (p.ej. el primer producto de una lista), no
    // debe tratarse como plegable ni quedar oculto por defecto.
    if(form.dataset.form && form.dataset.form.startsWith('edit-')) return;
    const h2 = form.parentElement.querySelector(':scope > h2:first-child');
    if(!h2) return;
    const id = form.dataset.form + '|' + (form.dataset.id || '');
    const arrow = document.createElement('button');
    arrow.type = 'button';
    arrow.className = 'card-toggle-arrow';
    arrow.title = 'Plegar o desplegar';
    arrow.innerHTML = '&#9650;';
    h2.appendChild(arrow);
    h2.style.justifyContent = 'space-between';
    h2.style.cursor = 'pointer';
    const aplicar = (colapsado)=>{
      form.style.display = colapsado ? 'none' : '';
      arrow.classList.toggle('collapsed', colapsado);
    };
    const estaColapsado = ()=> id in cardsColapsadas ? cardsColapsadas[id] : true;
    aplicar(estaColapsado());
    h2.addEventListener('click', ()=>{
      cardsColapsadas[id] = !estaColapsado();
      aplicar(cardsColapsadas[id]);
    });
  });
}
function renderAdjuntoViewer(){
  if(!adjuntoAbierto) return '';
  const {url, tipo} = adjuntoAbierto;
  return `<div class="adjunto-backdrop" data-action="cerrar-adjunto"></div>
  <div class="adjunto-viewer">
    <button type="button" class="adjunto-close" data-action="cerrar-adjunto" title="Cerrar">&times;</button>
    ${tipo==='pdf' ? `<iframe src="${url}" class="adjunto-frame"></iframe>` : `<img src="${url}" class="adjunto-img" alt="Ticket o factura">`}
  </div>`;
}
function scrollHelpTranscript(){
  const t = document.getElementById('help-transcript');
  if(!t) return;
  const preguntas = t.querySelectorAll('.help-msg-q');
  const ultima = preguntas[preguntas.length-1];
  t.scrollTop = ultima ? Math.max(0, ultima.offsetTop - 4) : t.scrollHeight;
}

function renderForcePin(me){
  return `
  <div class="login-wrap">
    <div class="masthead" style="border:none; margin-bottom:0;">
      <div class="logo-row">${logoBadge()}<h1>${escapeHtml(state.config.nombre)}</h1></div>
    </div>
    <div style="margin-top:14px;">${avatarHtml(me,'lg')}</div>
    <p class="sub" style="margin-top:10px;">Hola, ${escapeHtml(me.nombre)}. Por seguridad, tienes que crear tu propio PIN antes de continuar.</p>
    <form data-form="force-pin" style="margin-top:16px; max-width:260px; margin-left:auto; margin-right:auto; text-align:left;">
      <label class="f">Nuevo PIN (4 dígitos, el que tú quieras)</label>
      <input type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" name="pin" required placeholder="****" autofocus
        
        style="width:100%; box-sizing:border-box; text-align:center; font-size:1.4rem; letter-spacing:0.5rem; text-indent:0.25rem; margin-bottom:10px;">
      <label class="f">Repite el PIN</label>
      <input type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" name="pin2" required placeholder="****"

        style="width:100%; box-sizing:border-box; text-align:center; font-size:1.4rem; letter-spacing:0.5rem; text-indent:0.25rem; margin-bottom:14px;">
      <button class="btn" type="submit" style="width:100%;">Guardar mi PIN y entrar</button>
    </form>
    <button class="btn ghost small" data-action="logout" style="margin-top:14px;">Cerrar sesión</button>
  </div>`;
}

function logoBadge(){
  return `<div class="logo-badge"><img src="/static/logo.png" alt="" onerror="this.parentElement.style.display='none'"></div>`;
}

function renderLogin(){
  const socios = state.socios.filter(s=>s.activo);
  const sinSocios = state.socios.length===0;

  if(!sinSocios && pendingLoginId){
    const s = socios.find(s=>s.id===pendingLoginId);
    if(s){
      return `
      <div class="login-wrap">
        
        <div class="login-panel-single">
        
          <div class="login-header-single">
        
            ${logoBadge()}
        
            <h1>${escapeHtml(state.config.nombre)}</h1>
        
          </div>
        
          <div class="login-content-single">
        
            <div style="margin-top:14px;">${avatarHtml(s,'lg')}</div>
        
            <p class="sub" style="margin-top:10px;">Hola, ${escapeHtml(s.nombre)}. ${s.tiene_pin ? 'Introduce tu PIN' : 'Todavía no tienes PIN configurado, puedes entrar directamente'}</p>
        
            <form data-form="pin-login" style="margin-top:16px; max-width:300px; margin-left:auto; margin-right:auto;">
        
              <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" name="pin" placeholder="****" autofocus
        
                
        style="width:100%; box-sizing:border-box; text-align:center; font-size:1.8rem; letter-spacing:0.8rem; text-indent:0.4rem; padding:14px; border-radius:8px; border:1px solid var(--line); background:rgba(15,26,21,0.72); color:var(--chalk);">
        
              <button class="btn" type="submit" style="width:100%; margin-top:16px;">${s.tiene_pin ? 'Entrar' : 'Entrar y crear mi PIN luego'}</button>
        
            </form>
        
            <button class="btn ghost small" data-action="cancel-pin-login" style="margin-top:16px;">Elegir otro socio</button>
        
          </div>
        
        </div>
      </div>`;
    }
    pendingLoginId = null;
  }

  if(sinSocios){
    return `
    <div class="login-wrap">
      <div class="login-header">
        <div class="login-header-content">${logoBadge()}<h1>${escapeHtml(state.config.nombre)}</h1></div>
      </div>
      <div class="login-panel login-panel-search">
        <div class="login-panel-center">
          <div class="login-content">
            <form data-form="bootstrap-admin" style="margin-top:24px; text-align:left; max-width:320px; margin-left:auto; margin-right:auto;">
              <label class="f">Tu nombre</label>
              <input type="text" name="nombre" required placeholder="Nombre y apellido" style="margin-bottom:10px;">
              <label class="f">Elige un PIN de 4 dígitos</label>
              <input type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" name="pin" required placeholder="****" style="margin-bottom:10px;">
              <button class="btn" type="submit" style="width:100%;">Crear peña y entrar como administrador</button>
            </form>
          </div>
        </div>
      </div>
    </div>`;
  }

  const query = loginSearchQuery.trim().toLowerCase();
  const matches = query.length>=2 ? socios.filter(s=>s.nombre.toLowerCase().includes(query)) : [];

  return `
  <div class="login-wrap">
    <div class="login-header">
      <div class="login-header-content">

        ${logoBadge()}

        <h1>${escapeHtml(state.config.nombre)}</h1>
      </div>
    </div>
    <div class="login-panel login-panel-search">
      <div class="login-search-wrap">
        <label class="f" style="text-align:center; display:block;">Escribe tu nombre</label>
        <input type="text" id="login-search-input" class="login-search-input" placeholder="Empieza a escribir..." autocomplete="off" autofocus value="${escapeHtml(loginSearchQuery)}">
        <div id="login-search-results" class="login-search-results">${renderLoginSearchResults(matches, query)}</div>
      </div>
    </div>
  </div>`;
}

function renderLoginSearchResults(matches, query){
  if(!query) return '';
  if(matches.length===0) return '<p class="empty" style="text-align:center;">Nadie coincide con eso.</p>';
  return `<div class="login-grid">${matches.map(s=>`<button class="user-chip-photo" data-action="select-user" data-id="${s.id}">${avatarHtml(s,'md')}<span>${escapeHtml(s.nombre)}</span></button>`).join('')}</div>`;
}

const BELL_ICON_PATH = '<path d="M12 3a5 5 0 0 0-5 5v3.2c0 .6-.2 1.2-.6 1.7L5 15.5V17h14v-1.5l-1.4-2.6a2.8 2.8 0 0 1-.6-1.7V8a5 5 0 0 0-5-5z"/><path d="M9.5 20a2.5 2.5 0 0 0 5 0"/>';
let alertasAbiertas = false;
function renderAlertasPanel(){
  if(!alertasAbiertas) return '';
  const alertas = construirAlertas();
  return `<div class="bell-backdrop" data-action="cerrar-alertas"></div>
  <div class="bell-dropdown">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <b>Avisos</b>
      <div style="display:flex; gap:8px; align-items:center;">
        <button class="btn accent small" data-action="export-log-eventos">Exportar log</button>
        <button class="help-close" data-action="cerrar-alertas" title="Cerrar">&times;</button>
      </div>
    </div>
    ${alertas.length ? alertas.map(a=>`<div class="alert-item"${a.tab?` data-action="ir-a-alerta" data-tab="${a.tab}" style="cursor:pointer;" title="Ir a la pestana"`:''}><span class="dot ${a.tipo}"></span><div>${a.texto}${a.meta?` <span class="meta">- ${a.meta}</span>`:''}</div></div>`).join('') : '<p class="empty">Sin avisos por ahora.</p>'}
  </div>`;
}
function renderApp(){
  const me = state.socios.find(s=>s.id===state.current_user);
  const alertas = construirAlertas();
  return `
  <div class="container">
    <div class="header-panel">
      <div class="masthead">
        
        <div class="logo-row">${logoBadge()}<div><h1>${escapeHtml(state.config.nombre)}</h1><a href="${PENA_LOCATION_URL}" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; gap:5px; color:var(--amber); font-weight:600; text-decoration:none; margin-top:2px; font-size:0.92rem;"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-7.2 7-12a7 7 0 0 0-14 0c0 4.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.4"/></svg>Ver ubicación</a></div></div>

        ${can('manage_config') ? `<div style="display:flex; gap:8px; flex-wrap:wrap;">

          <button class="edit-name-btn" data-action="edit-club-name">renombrar peña</button>

          <button class="edit-name-btn" data-action="edit-cuota">cambiar cuota</button>

          <button class="edit-name-btn" data-action="edit-cuenta">número de cuenta</button>

        </div>` : ''}

        <div class="user-bar">${me?avatarHtml(me,'sm'):''}<span class="live-dot"></span>Conectado como <b>${escapeHtml(me ? me.nombre : '')}</b>${isAdmin() ? '<span class="admin-badge">Admin</span>' : ''} - <button data-action="logout">Cerrar sesión</button>
          ${chatIconBtn()}
          <button type="button" class="bell-btn" data-action="toggle-alertas" title="Avisos">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${BELL_ICON_PATH}</svg>
            ${alertas.length ? `<span class="bell-badge">${alertas.length}</span>` : ''}
          </button>
        </div>
      </div>
      <div class="tabs">
        ${tabBtn('resumen','Resumen','chart')}
        ${tabBtn('socios','Socios','people')}
        ${tabBtn('cuotas','Cuotas','coin')}
        ${tabBtn('reservas','Reservas','calendar-check')}
        ${tabBtn('reuniones','Reuniones','calendar')}
        ${tabBtn('inventario','Inventario','box')}
        ${tabBtn('compra','Listas','cart')}
        ${tabBtn('caja','Gastos e ingresos','wallet')}
        ${tabBtn('bebidas','Bebidas','cup')}
        ${tabBtn('encargados','Tareas','check')}
        ${tabBtn('reparto','Tricount','split')}
        ${isAdmin() ? tabBtn('roles','Roles','key') : ''}
        ${tabBtn('estatutos','Estatutos','doc')}
        ${tabBtn('perfil','Mi perfil','user')}
      </div>
    </div>
    <div id="tab-content">${renderTab()}</div>
  </div>`;
}
const TAB_ICON_PATHS = {
  'chart': '<path d="M4 19V10"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M2 19h20"/>',
  'people': '<circle cx="9" cy="8" r="3"/><path d="M2 20c0-3.3 3-6 7-6s7 2.7 7 6"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2c2.7.4 5 2.4 5 5.8"/>',
  'coin': '<circle cx="12" cy="12" r="9"/><path d="M12 7v10"/><path d="M9.5 9.5c0-1.4 1.2-2.2 2.5-2.2s2.5.8 2.5 2c0 3-5 1.6-5 4.5 0 1.3 1.2 2.2 2.5 2.2s2.5-.8 2.5-2"/>',
  'calendar-check': '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18"/><path d="M8 2.5v4"/><path d="M16 2.5v4"/><path d="M9 14.5l2 2 4-4.3"/>',
  'calendar': '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18"/><path d="M8 2.5v4"/><path d="M16 2.5v4"/><path d="M7.5 13.5h3"/><path d="M13.5 13.5h3"/><path d="M7.5 17h3"/>',
  'box': '<path d="M3 8l9-5 9 5-9 5-9-5z"/><path d="M3 8v9l9 5 9-5V8"/><path d="M12 13v9"/>',
  'wallet': '<rect x="2.5" y="6" width="19" height="14" rx="2.4"/><path d="M2.5 10.5h19"/><circle cx="16.5" cy="14.5" r="1.3"/>',
  'cup': '<path d="M6 3h11l-1 12.5a4.5 4.5 0 0 1-4.5 4.1h-1A4.5 4.5 0 0 1 6 15.5L5 3z"/><path d="M17 6.5h2a2.5 2.5 0 0 1 0 5h-2.4"/><path d="M8 20.5h7"/>',
  'doc': '<path d="M6 2.5h8l4 4v15h-12z"/><path d="M14 2.5v4h4"/><path d="M8.5 12.5h7"/><path d="M8.5 16h7"/><path d="M8.5 9h3"/>',
  'check': '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l2.6 2.6L16.5 9"/>',
  'key': '<circle cx="8" cy="15" r="4.2"/><path d="M11 12l9-9"/><path d="M16 6l3 3"/><path d="M13.5 8.5l2.3 2.3"/>',
  'user': '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  'split': '<path d="M4 7h13"/><path d="M13 3l4 4-4 4"/><path d="M20 17H7"/><path d="M11 21l-4-4 4-4"/>',
  'cart': '<circle cx="9" cy="20" r="1.4"/><circle cx="17.5" cy="20" r="1.4"/><path d="M2 3h2.2l2.2 12.1a2 2 0 0 0 2 1.65h8.4a2 2 0 0 0 2-1.62L21 8H6.1"/>',
};
function tabIcon(name){
  const path = TAB_ICON_PATHS[name] || '';
  return `<svg class="tab-icon" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}
function tabBtn(id,label,icon){
  return `<button class="tab-btn ${activeTab===id?'active':''}" data-action="switch-tab" data-tab="${id}">${tabIcon(icon)}<span class="tab-label">${label}</span></button>`;
}
const CHAT_ICON_PATH = '<path d="M4 5h16v11.5H9.5L5 20.5V16.5H4z"/><path d="M8 9.2h8"/><path d="M8 12.4h5"/>';
function chatIconBtn(){
  const n = chatUnreadCount();
  return `<button type="button" class="bell-btn" data-action="toggle-chat" title="Chat de socios">
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CHAT_ICON_PATH}</svg>
    <span class="bell-badge" id="chat-badge" style="${n>0?'':'display:none;'}">${n>9?'9+':n}</span>
  </button>`;
}
function renderTab(){
  switch(activeTab){
    case 'resumen': return renderResumen();
    case 'socios': return renderSocios();
    case 'cuotas': return renderCuotas();
    case 'reservas': return renderReservas();
    case 'reuniones': return renderReuniones();
    case 'estatutos': return renderEstatutos();
    case 'reparto': return renderReparto();
    case 'inventario': return renderInventario();
    case 'compra': return renderListasTab();
    case 'caja': return renderCaja();
    case 'bebidas': return renderBebidas();
    case 'encargados': return renderEncargados();
    case 'roles': return renderRoles();
    case 'perfil': return renderPerfil();
    default: return '';
  }
}

function sortedRoles(){
  // Igual que el orden alfabético del backend, pero dejando "Otro" siempre al final.
  const roles = [...(state.roles || [])];
  roles.sort((a,b)=>{
    if(a.id==='otro') return 1;
    if(b.id==='otro') return -1;
    return a.nombre.localeCompare(b.nombre, 'es');
  });
  return roles;
}
const SOCIO_SWATCH_COLORS = ['#c1553a','#7fa88c','#e8a33d','#6b8fb0','#a874a8','#4f9d8a','#c98a3a','#8a7fc9'];
function socioSwatchColor(socioId){
  let hash = 0;
  for(let i=0;i<socioId.length;i++){ hash = (hash*31 + socioId.charCodeAt(i)) >>> 0; }
  return SOCIO_SWATCH_COLORS[hash % SOCIO_SWATCH_COLORS.length];
}
function renderRoles(){
  if(!isAdmin()) return '<p class="readonly-note">No tienes permiso para gestionar roles.</p>';
  const roles = sortedRoles();
  const labels = state.permission_labels || {};
  return `
  <div class="card">
    <h2><span class="pin"></span>Crear un rol</h2>
    <form data-form="add-role">
      <div class="form-row"><div><label class="f">Nombre del rol</label><input type="text" name="nombre" required placeholder="Ej: Vocal, encargado de compras"></div></div>
      <details class="permisos-dropdown">
        <summary>Elegir permisos</summary>
        <div class="role-options">
          ${Object.entries(labels).map(([id,label])=>`<label class="role-option"><input type="checkbox" name="permisos" value="${id}"> ${escapeHtml(label)}</label>`).join('')}
        </div>
      </details>
      <button class="btn" type="submit">Crear rol</button>
    </form>
  </div>
  <div class="card">
    ${roles.length===0 ? '<p class="empty">Todavía no hay roles.</p>' : roles.map(role=>renderRoleRow(role, labels)).join('')}
  </div>
  <div class="card">
    <h2><span class="pin"></span>Asignar roles a socios</h2>
    <p class="readonly-note">Un socio puede tener varios roles. Los cambios se aplican al momento.</p>
    ${state.socios.map(s=>`
      <div class="list-item socio-role-row" style="align-items:flex-start; border-left-color:${socioSwatchColor(s.id)};">
        <div style="flex:1;">
          <div style="font-weight:600; margin-bottom:8px;">${escapeHtml(s.nombre)} ${s.id===state.current_user?'<span class="tag ok">tú</span>':''}</div>
          <div class="role-options">
            ${roles.map(role=>`<label class="role-option"><input type="checkbox" data-role-option="${s.id}" value="${role.id}" ${(s.roles||[]).includes(role.id)?'checked':''}> ${escapeHtml(role.nombre)}</label>`).join('')}
          </div>
        </div>
        <button class="btn ghost small" data-action="save-roles" data-id="${s.id}">Guardar roles</button>
      </div>`).join('')}
  </div>`;
}

function renderRoleRow(role, labels){
  const permisos = role.permisos||[];
  return `<div class="list-item">
    <div style="flex:1;">
      <div style="font-weight:600;">${escapeHtml(role.nombre)} ${role.es_sistema?'<span class="tag">rol del sistema</span>':''}</div>
      <div class="meta">${permisos.length ? permisos.map(p=>escapeHtml(labels[p]||p)).join(', ') : 'Sin permisos especiales'}</div>
      <details class="permisos-dropdown" style="margin-top:8px;">
        <summary>Editar permisos</summary>
        <div class="role-options">
          ${Object.entries(labels).map(([id,label])=>`<label class="role-option"><input type="checkbox" data-edit-role-permiso="${role.id}" value="${id}" ${permisos.includes(id)?'checked':''}> ${escapeHtml(label)}</label>`).join('')}
        </div>
        <button class="btn ghost small" data-action="update-role-permisos" data-id="${role.id}" style="margin-top:8px;">Guardar permisos</button>
      </details>
    </div>
    ${!role.es_sistema ? `<button class="btn danger small" data-action="delete-role" data-id="${role.id}">Borrar</button>` : ''}
  </div>`;
}
/* ============ cálculos ============ */
function totalIngresosCuotas(periodo){ return state.cuotas.filter(c=>c.pagado && dentroDePeriodo(c.fecha, periodo)).reduce((a,c)=>a+Number(c.importe||0),0); }
function totalIngresosMov(periodo){ return state.movimientos.filter(m=>m.tipo==='ingreso' && m.categoria!=='Socios' && dentroDePeriodo(m.fecha, periodo)).reduce((a,m)=>a+Number(m.importe||0),0); }
function totalGastosMov(periodo){ return state.movimientos.filter(m=>m.tipo==='gasto' && m.categoria!=='Socios' && dentroDePeriodo(m.fecha, periodo)).reduce((a,m)=>a+Number(m.importe||0),0); }
function totalBebidasIngreso(periodo){ return state.bebidas_consumos.filter(c=>c.pagado && dentroDePeriodo(c.fecha, periodo)).reduce((a,c)=>a+Number(c.importe||0),0); }
function totalBebidasPendiente(){ return state.bebidas_consumos.filter(c=>!c.pagado).reduce((a,c)=>a+Number(c.importe||0),0); }
function misBebidasPendientes(){ return state.bebidas_consumos.filter(c=>c.socio_id===state.current_user && !c.pagado); }
function misBebidasPendientesPorMes(){
  const grupos = {};
  misBebidasPendientes().forEach(c=>{
    const key = (c.fecha||'').slice(0,7);
    (grupos[key] = grupos[key] || []).push(c);
  });
  return Object.keys(grupos).sort((a,b)=>b.localeCompare(a)).map(mes=>({
    mes,
    items: grupos[mes].sort((a,b)=>b.fecha.localeCompare(a.fecha)),
    total: grupos[mes].reduce((a,c)=>a+Number(c.importe||0), 0),
  }));
}
function bebidasPendientesPorSocio(){
  const pendientes = {};
  state.bebidas_consumos.forEach(c=>{
    if(!c.pagado && c.socio_id){
      pendientes[c.socio_id] = (pendientes[c.socio_id]||0) + Number(c.importe||0);
    }
  });
  return Object.keys(pendientes)
    .sort((a,b)=>pendientes[b]-pendientes[a])
    .map(socio_id=>({socio_id, nombre: socioNombre(socio_id), total: pendientes[socio_id]}));
}
function consumosFiltrados(consumos){
  let out = consumos.filter(c=>dentroDePeriodo(c.fecha, consumosPeriodo));
  if(consumosFiltroSocio.startsWith('inv:')) out = out.filter(c=>!c.es_socio && c.consumidor===consumosFiltroSocio.slice(4));
  else if(consumosFiltroSocio) out = out.filter(c=>c.es_socio && c.socio_id===consumosFiltroSocio);
  return out;
}
function consumidoresDisponibles(consumos){
  const vistos = {};
  const lista = [];
  consumos.forEach(c=>{
    const valor = c.es_socio ? c.socio_id : 'inv:'+c.consumidor;
    if(vistos[valor]) return;
    vistos[valor] = true;
    lista.push({valor, nombre: c.consumidor, esSocio: c.es_socio});
  });
  return lista.sort((a,b)=>a.nombre.localeCompare(b.nombre));
}
function actualizarTotalConsumo(form){
  const el = form.querySelector('#consumo-total');
  if(!el) return;
  const bebidaId = form.querySelector('[name=bebida_id]').value;
  const cantidad = Number(form.querySelector('[name=cantidad]').value) || 0;
  const consumidorTipo = form.querySelector('[name=consumidorTipo]');
  const esSocio = consumidorTipo ? consumidorTipo.value === 'socio' : true;
  const precio = state.bebidas_precios.find(p=>p.id===bebidaId);
  const unit = precio ? Number(esSocio ? precio.precio_socio : precio.precio_no_socio) : 0;
  el.textContent = `Total: ${money(unit * cantidad)}`;
}
function totalFiestasGasto(periodo){ return state.fiestas_gastos.filter(f=>dentroDePeriodo(f.fecha, periodo)).reduce((a,f)=>a+Number(f.importe||0),0); }
// Al verificar un gasto/ingreso de socio, el backend lo convierte en un movimiento
// permanente con categoría "Socios" y borra la solicitud provisional: por eso estos
// totales se calculan a partir de movimientos, no de gastos_socios (que solo guarda
// las solicitudes todavía pendientes de verificar).
function totalIngresosSociosVerificados(periodo){ return state.movimientos.filter(m=>m.categoria==='Socios' && m.tipo==='ingreso' && dentroDePeriodo(m.fecha, periodo)).reduce((a,m)=>a+Number(m.importe||0),0); }
function totalGastosSociosVerificados(periodo){ return state.movimientos.filter(m=>m.categoria==='Socios' && m.tipo!=='ingreso' && dentroDePeriodo(m.fecha, periodo)).reduce((a,m)=>a+Number(m.importe||0),0); }
function gastosSociosPendientes(){ return (state.gastos_socios||[]).filter(g=>!g.abonado); }
function saldoTotal(){
  const ingresos = totalIngresosCuotas() + totalIngresosMov() + totalBebidasIngreso() + totalIngresosSociosVerificados();
  const gastos = totalGastosMov() + totalFiestasGasto() + totalGastosSociosVerificados();
  return ingresos - gastos;
}
function fiestasPorEvento(){
  const map = {};
  state.fiestas_gastos.forEach(f=>{
    map[f.evento] = (map[f.evento]||0) + Number(f.importe||0);
  });
  return Object.entries(map).sort((a,b)=>b[1]-a[1]);
}

/* ============ ALERTAS (ya no se muestran en pantalla: se exportan como log) ============ */
function construirAlertas(){
  const alertas = [];
  const now = new Date();
  const hoy = now.getDate();

  const MES_SIN_AVISO_CUOTA = 7; // agosto (0-indexado): la cuota queda cubierta por el gasto de fiestas (100EUR socio / 50EUR no socio)
  if(hoy >= DIA_LIMITE_CUOTA && now.getMonth() !== MES_SIN_AVISO_CUOTA){
    const activos = state.socios.filter(s=>s.activo);
    activos.forEach(s=>{
      const c = state.cuotas.find(c=>c.socio_id===s.id && c.year===now.getFullYear() && c.month===now.getMonth()+1);
      if(!c || !c.pagado){

        alertas.push({tipo:'warn', texto:`${s.nombre} todavía no ha pagado la cuota de ${MESES[now.getMonth()]}`, tab:'cuotas'});
      }
    });
  }

  const gastosPendientes = gastosSociosPendientes();
  if(gastosPendientes.length){
    const total = gastosPendientes.reduce((a,g)=>a+Number(g.importe||0),0);
    alertas.push({tipo:'warn', texto:`Hay ${gastosPendientes.length} gasto(s)/ingreso(s) de socios (${money(total)}) pendientes de verificar por el tesorero (pestaña Gastos e ingresos).`, tab:'caja'});
  }

  const misPendientes = misBebidasPendientes();
  if(misPendientes.length){
    const total = misPendientes.reduce((a,c)=>a+Number(c.importe||0),0);
    alertas.push({tipo:'warn', texto:`Tienes ${money(total)} pendientes de pagar en bebidas (pestana Bebidas).`, tab:'bebidas'});
  }

  if(can('manage_bebidas')){
    bebidasPendientesPorSocio().forEach(p=>{
      alertas.push({tipo:'warn', texto:`${p.nombre} tiene ${money(p.total)} pendientes de bebidas.`, tab:'bebidas'});
    });
  }

  state.inventario.filter(i=>esCategoriaStockBajo(i.categoria) && Number(i.cantidad) < UMBRAL_STOCK_BAJO).sort((a,b)=>a.cantidad-b.cantidad).forEach(i=>{
    alertas.push({tipo:'warn', texto:`Quedan pocas unidades de "${i.nombre}" (${i.cantidad}) - hay que reponer.`, tab:'inventario'});
  });

  const recientes = [];
  state.reservas.forEach(r=>{
    if(r.creado_en) recientes.push({fecha:r.creado_en, texto:`${socioNombre(r.socio_id)} reservó la peña para el ${fmtDate(r.fecha)} (${escapeHtml(r.evento)})`, tab:'reservas'});
  });
  state.reuniones.forEach(r=>{
    if(r.creado_en) recientes.push({fecha:r.creado_en, texto:`Se convocó una reunión para el ${fmtDate(r.fecha)}: ${escapeHtml(r.evento)}`, tab:'reuniones'});
  });
  recientes.sort((a,b)=>b.fecha.localeCompare(a.fecha));
  recientes.slice(0,5).forEach(r=>alertas.push({tipo:'info', texto:r.texto, meta:timeAgoEs(r.fecha), tab:r.tab}));

  return alertas;
}

function exportarLogEventos(){
  const alertas = construirAlertas();
  const ahora = new Date();
  const lineas = [`Log de eventos y avisos - ${state.config.nombre} - generado el ${ahora.toLocaleString('es-ES')}`, ''];
  if(alertas.length===0){
    lineas.push('Sin avisos en este momento.');
  } else {
    alertas.forEach(a=>{
      const etiqueta = a.tipo==='warn' ? '[AVISO]' : '[INFO]';
      lineas.push(`${etiqueta} ${a.texto}${a.meta ? ' ('+a.meta+')' : ''}`);
    });
  }
  const blob = new Blob([lineas.join('\n')], {type:'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `el_cado_log_eventos_${todayISO()}.txt`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function totalesPorPeriodo(periodo){
  let ingresos = 0, gastos = 0;
  function add(fecha, campo, importe){
    if(!dentroDePeriodo(fecha, periodo)) return;
    if(campo==='ingresos') ingresos += Number(importe||0); else gastos += Number(importe||0);
  }
  state.cuotas.forEach(c=>{ if(c.pagado) add(c.fecha, 'ingresos', c.importe); });
  state.movimientos.forEach(m=>add(m.fecha, m.tipo==='ingreso' ? 'ingresos' : 'gastos', m.importe));
  state.bebidas_consumos.forEach(c=>{ if(c.pagado) add(c.fecha, 'ingresos', c.importe); });
  state.fiestas_gastos.forEach(f=>add(f.fecha, 'gastos', f.importe));
  (state.gastos_socios||[]).forEach(g=>{ if(g.abonado) add(g.fecha, g.tipo==='ingreso' ? 'ingresos' : 'gastos', g.importe); });
  return {ingresos, gastos};
}

/* ============ GRÁFICAS: evolución de ingresos y gastos ============ */
function movimientosPorMes(){
  const map = {}; // 'YYYY-MM' -> {ingresos, gastos}
  function add(fecha, campo, importe){
    if(!fecha) return;
    const key = String(fecha).slice(0,7);
    if(!map[key]) map[key] = {ingresos:0, gastos:0};
    map[key][campo] += Number(importe||0);
  }
  state.cuotas.forEach(c=>{ if(c.pagado) add(c.fecha, 'ingresos', c.importe); });
  state.movimientos.forEach(m=>add(m.fecha, m.tipo==='ingreso' ? 'ingresos' : 'gastos', m.importe));
  state.bebidas_consumos.forEach(c=>{ if(c.pagado) add(c.fecha, 'ingresos', c.importe); });
  state.fiestas_gastos.forEach(f=>add(f.fecha, 'gastos', f.importe));
  (state.gastos_socios||[]).forEach(g=>{ if(g.abonado) add(g.fecha, g.tipo==='ingreso' ? 'ingresos' : 'gastos', g.importe); });
  return map;
}
function aniosConDatos(){
  const map = movimientosPorMes();
  const anios = new Set(Object.keys(map).map(k=>Number(k.slice(0,4))));
  anios.add(new Date().getFullYear());
  return [...anios].sort((a,b)=>a-b);
}
function renderGraficoMensual(year){
  const map = movimientosPorMes();
  const datos = MESES.map((m,i)=>{
    const key = `${year}-${String(i+1).padStart(2,'0')}`;
    const d = map[key] || {ingresos:0, gastos:0};
    return {mes:m, ingresos:d.ingresos, gastos:d.gastos, balance:d.ingresos-d.gastos};
  });
  const max = Math.max(1, ...datos.map(d=>Math.max(d.ingresos, d.gastos, Math.abs(d.balance))));
  const W = 760, H = 200, padBottom = 24, padLeft = 4;
  const groupW = (W - padLeft) / 12;
  const barW = Math.min(9, groupW / 4);
  const scale = v => (H - 14 - padBottom) * (v / max);
  const barras = datos.map((d,i)=>{
    const gx = padLeft + i * groupW;
    const hIng = scale(d.ingresos), hGas = scale(d.gastos), hBal = scale(Math.abs(d.balance));
    const xIng = gx + groupW/2 - barW*1.5 - 2, xGas = gx + groupW/2 - barW/2, xBal = gx + groupW/2 + barW/2 + 2;
    const yIng = H - padBottom - hIng, yGas = H - padBottom - hGas, yBal = H - padBottom - hBal;
    const tooltip = `${d.mes} ${year}\nIngresos: ${money(d.ingresos)}\nGastos: ${money(d.gastos)}\nBalance: ${d.balance<0?'- ':'+ '}${money(Math.abs(d.balance))}`;
    return `
      <rect x="${xIng.toFixed(1)}" y="${yIng.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0,hIng).toFixed(1)}" rx="2" class="bar-ingreso"></rect>
      <rect x="${xGas.toFixed(1)}" y="${yGas.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0,hGas).toFixed(1)}" rx="2" class="bar-gasto"></rect>
      <rect x="${xBal.toFixed(1)}" y="${yBal.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0,hBal).toFixed(1)}" rx="2" class="bar-balance ${d.balance<0?'negativo':''}"></rect>
      <rect x="${gx.toFixed(1)}" y="0" width="${groupW.toFixed(1)}" height="${(H-padBottom).toFixed(1)}" class="chart-hit" data-tooltip="${escapeHtml(tooltip)}"></rect>
      <text x="${(gx+groupW/2).toFixed(1)}" y="${H-7}" class="chart-label" text-anchor="middle">${d.mes}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Ingresos, gastos y balance por mes de ${year}">
    <line x1="${padLeft}" y1="${H-padBottom}" x2="${W}" y2="${H-padBottom}" class="chart-axis"></line>
    ${barras}
  </svg>`;
}
function totalesPorAnio(year){
  const map = movimientosPorMes();
  let ingresos = 0, gastos = 0;
  Object.keys(map).forEach(k=>{ if(Number(k.slice(0,4))===year){ ingresos += map[k].ingresos; gastos += map[k].gastos; } });
  return {ingresos, gastos};
}
function mesesDisponibles(claves){
  const set = new Set(claves.filter(Boolean));
  set.add(todayISO().slice(0,7));
  return [...set].sort((a,b)=>b.localeCompare(a));
}
function labelMes(clave){
  const [y,m] = clave.split('-').map(Number);
  return `${MESES[m-1]} ${y}`;
}
function renderGraficoAnual(){
  const map = movimientosPorMes();
  const anios = aniosConDatos();
  const totales = anios.map(anio=>{
    let ingresos = 0, gastos = 0;
    Object.keys(map).forEach(k=>{ if(Number(k.slice(0,4))===anio){ ingresos += map[k].ingresos; gastos += map[k].gastos; } });
    return {anio, ingresos, gastos};
  });
  const max = Math.max(1, ...totales.map(d=>Math.max(d.ingresos, d.gastos)));
  const W = Math.max(280, anios.length * 74), H = 170, padBottom = 24;
  const groupW = W / anios.length;
  const barW = Math.min(22, groupW / 2.6);
  const scale = v => (H - 14 - padBottom) * (v / max);
  const barras = totales.map((d,i)=>{
    const gx = i * groupW;
    const hIng = scale(d.ingresos), hGas = scale(d.gastos);
    const xIng = gx + groupW/2 - barW - 1, xGas = gx + groupW/2 + 1;
    const yIng = H - padBottom - hIng, yGas = H - padBottom - hGas;
    return `
      <rect x="${xIng.toFixed(1)}" y="${yIng.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0,hIng).toFixed(1)}" rx="2" class="bar-ingreso"><title>${d.anio} - Ingresos: ${money(d.ingresos)}</title></rect>
      <rect x="${xGas.toFixed(1)}" y="${yGas.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0,hGas).toFixed(1)}" rx="2" class="bar-gasto"><title>${d.anio} - Gastos: ${money(d.gastos)}</title></rect>
      <text x="${(gx+groupW/2).toFixed(1)}" y="${H-7}" class="chart-label" text-anchor="middle">${d.anio}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart-svg chart-svg-anual" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Ingresos y gastos por año">${barras}</svg>`;
}

/* ============ RESUMEN ============ */
function renderResumen(){
  const now = new Date();
  const miCuota = state.cuotas.find(c=>c.socio_id===state.current_user && c.year===now.getFullYear() && c.month===now.getMonth()+1);
  const proximasReuniones = state.reuniones.filter(r=>r.fecha >= todayISO()).sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const proxima = proximasReuniones[0];
  const proximasReservas = state.reservas.filter(r=>r.fecha >= todayISO()).sort((a,b)=>a.fecha.localeCompare(b.fecha)).slice(0,3);
  const ingresosTotales = totalIngresosCuotas() + totalIngresosMov() + totalBebidasIngreso() + totalIngresosSociosVerificados();
  const gastosTotales = totalGastosMov() + totalFiestasGasto() + totalGastosSociosVerificados();
  const saldo = ingresosTotales - gastosTotales;
  const pendientesSocios = gastosSociosPendientes();
  const pendientesSociosTotal = pendientesSocios.reduce((a,g)=>a+Number(g.importe||0),0);
  const fiestasEvento = fiestasPorEvento();
  const anios = aniosConDatos();
  const totalesAnio = totalesPorAnio(resumenGraficoYear);
  const mesesResumen = mesesDisponibles(Object.keys(movimientosPorMes()));
  if(resumenPeriodo.tipo==='mes' && !mesesResumen.includes(resumenPeriodo.valor)) resumenPeriodo.valor = mesesResumen[0];
  const totalesPeriodoResumen = totalesPorPeriodo(resumenPeriodo);
  const etiquetaPeriodoResumen = labelPeriodo(resumenPeriodo) || 'de todo el historial';

  return `
  <div class="stat-grid">
    <div class="stat"><div class="n">${saldo<0?'- ':''}${money(Math.abs(saldo))}</div><div class="l">SALDO TOTAL</div></div>
    <div class="stat sage"><div class="n">${money(totalesPeriodoResumen.ingresos)}</div><div class="l">Ingresos ${etiquetaPeriodoResumen}</div></div>
    <div class="stat rust"><div class="n">- ${money(totalesPeriodoResumen.gastos)}</div><div class="l">Gastos ${etiquetaPeriodoResumen}</div></div>
  </div>
  <div class="menu-row" style="margin:-4px 0 14px; flex-wrap:wrap;">
    <span class="label">Ver Ingresos/Gastos</span>
    <span class="dots"></span>
    ${renderSelectorPeriodo('resumen', resumenPeriodo, mesesResumen)}
  </div>
  <div class="year-nav">
    <button data-action="resumen-grafico-year" data-dir="-1">&laquo; ${resumenGraficoYear-1}</button>
    <b>${resumenGraficoYear}</b>
    <button data-action="resumen-grafico-year" data-dir="1">${resumenGraficoYear+1} &raquo;</button>
  </div>

  <div class="card">
    <h2><span class="pin"></span>Evolución de ingresos y gastos en ${resumenGraficoYear}</h2>
    <div class="menu-row"><span class="label">Ingresos ${resumenGraficoYear}</span><span class="dots"></span><span class="value sage">${money(totalesAnio.ingresos)}</span></div>
    <div class="menu-row" style="margin-bottom:10px;"><span class="label">Gastos ${resumenGraficoYear}</span><span class="dots"></span><span class="value rust">- ${money(totalesAnio.gastos)}</span></div>
    <div class="chart-legend">
      <span class="chart-legend-item"><span class="chart-dot ingreso"></span>Ingresos</span>
      <span class="chart-legend-item"><span class="chart-dot gasto"></span>Gastos</span>
      <span class="chart-legend-item"><span class="chart-dot balance"></span>Balance</span>
    </div>
    ${renderGraficoMensual(resumenGraficoYear)}
    <div id="chart-tooltip" class="chart-tooltip"></div>
  </div>

  ${anios.length>1 ? `
  <div class="card">
    <h2><span class="pin"></span>Comparativa por años</h2>
    <p class="meta" style="margin:0 0 10px;">Para ver cómo estaba la peña en años anteriores.</p>
    ${renderGraficoAnual()}
  </div>` : ''}

  <div class="card-grid">
    <div class="card">
      <h2 style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">

        <span><span class="pin"></span>Cuentas</span>

        <span style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn accent small" data-action="export-cuentas-whatsapp" style="font-family:'Work Sans';">Enviar por WhatsApp</button>
          ${can('export_data') ? `<button class="btn accent small" data-action="export-excel" data-desde="${rangoPeriodo(cuentasPeriodo).desde||''}" data-hasta="${rangoPeriodo(cuentasPeriodo).hasta||''}" style="font-family:'Work Sans';">Exportar a Excel</button>` : ''}
          <label class="btn accent small" style="cursor:pointer; font-family:'Work Sans';">Importar Excel<input type="file" accept=".xlsx" data-import-excel style="display:none;"></label>
        </span>
      </h2>
      <div class="menu-row" style="margin-bottom:10px; flex-wrap:wrap;">
        <span class="label">Periodo</span>
        <span class="dots"></span>
        ${renderSelectorPeriodo('cuentas', cuentasPeriodo, mesesDisponibles(Object.keys(movimientosPorMes())))}
      </div>
      <div class="menu-row"><span class="label">Cuotas</span><span class="dots"></span><span class="value sage">${money(totalIngresosCuotas(cuentasPeriodo))}</span></div>
      <div class="menu-row"><span class="label">Bebidas</span><span class="dots"></span><span class="value sage">${money(totalBebidasIngreso(cuentasPeriodo))}</span></div>
      <div class="menu-row"><span class="label">Otros ingresos</span><span class="dots"></span><span class="value sage">${money(totalIngresosMov(cuentasPeriodo))}</span></div>
      <div class="menu-row"><span class="label">Ingresos de socios</span><span class="dots"></span><span class="value sage">${money(totalIngresosSociosVerificados(cuentasPeriodo))}</span></div>
      <div class="menu-row"><span class="label">Gastos de socios</span><span class="dots"></span><span class="value rust">- ${money(totalGastosSociosVerificados(cuentasPeriodo))}</span></div>
      <div class="menu-row"><span class="label">Gastos de fiestas</span><span class="dots"></span><span class="value rust">- ${money(totalFiestasGasto(cuentasPeriodo))}</span></div>
      <div class="menu-row"><span class="label">Gastos generales</span><span class="dots"></span><span class="value rust">- ${money(totalGastosMov(cuentasPeriodo))}</span></div>
      <div class="menu-row" style="border-top:1px solid var(--line); margin-top:10px; padding-top:10px;"><span class="label"><strong>Saldo total</strong></span><span class="dots"></span><span class="value ${saldo<0?'rust':'sage'}"><strong>${saldo<0?'- ':'+'}${money(Math.abs(saldo))}</strong></span></div>
      ${cuentasPeriodo.tipo!=='todos' ? '<p class="meta" style="margin-top:6px;">El saldo total es siempre de todo el historial; las demás cifras de arriba son solo del período elegido.</p>' : ''}
      ${pendientesSocios.length ? `<p class="readonly-note" style="margin-top:10px; cursor:pointer;" data-action="switch-tab" data-tab="caja" title="Ir a Gastos e ingresos">${pendientesSocios.length} gasto(s)/ingreso(s) de socios (${money(pendientesSociosTotal)}) pendientes de verificar por el tesorero o el administrador en "Gastos e ingresos". No suman al saldo hasta que se verifiquen.</p>` : ''}
    </div>
    <div class="card">
      <h2><span class="pin"></span>Próxima reunión</h2>
      ${proxima ? `
        
        <p style="margin:0 0 4px; font-weight:600;">${escapeHtml(proxima.evento)}</p>
        
        <p class="meta" style="margin:0;">${fmtDate(proxima.fecha)}</p>
        
        <p style="margin-top:10px; font-size:0.86rem; color:var(--chalk-dim);">${escapeHtml(proxima.notas||'')}</p>
      ` : `<p class="empty">No hay reuniones programadas.</p>`}
    </div>
  </div>

  <div class="card">
    <h2><span class="pin"></span>La peña está reservada...</h2>
    ${proximasReservas.length===0 ? '<p class="empty">No hay reservas próximas. La peña está libre.</p>' : proximasReservas.map(r=>`
      <div class="menu-row">
        
        <span class="label">${escapeHtml(r.evento)}<small>${socioNombre(r.socio_id)} - ${fmtHoras(r)}</small></span>
        
        <span class="dots"></span>
        
        <span class="value">${fmtDate(r.fecha)}</span>
      </div>`).join('')}
  </div>

  ${fiestasEvento.length ? `
  <div class="card">
    <h2><span class="pin"></span>Gasto en bebida por fiesta</h2>
    ${fiestasEvento.map(([evento,total])=>`
      <div class="menu-row"><span class="label">${escapeHtml(evento)}</span><span class="dots"></span><span class="value rust">${money(total)}</span></div>
    `).join('')}
  </div>` : ''}
  `;
}

/* ============ SOCIOS ============ */
function renderSocios(){
  const puedeGestionarSocios = can('manage_socios');
  return `
  ${puedeGestionarSocios ? `
  <div class="card">
    <h2><span class="pin"></span>Añadir socio</h2>
    <form data-form="add-socio" class="form-row" style="align-items:flex-end;">
      <div><label class="f">Nombre del nuevo socio</label><input type="text" name="nombre" required placeholder="Nombre y apellido"></div>
      <div><label class="f">PIN (opcional)</label><input type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" name="pin" placeholder="en blanco = automático"></div>
      <div><label class="f">Foto (opcional)</label><input type="file" name="foto" accept="image/*"></div>
      <div style="flex:none;"><button class="btn" type="submit">Añadir socio</button></div>
    </form>
  </div>` : `<p class="readonly-note">Solo lectura, para ver consultar con el administrador.</p>`}
  <div class="card">
    ${state.socios.length===0 ? '<p class="empty">Todavía no hay socios.</p>' : state.socios.map(s=>{
      const perfil = state.perfiles[s.id] || {};
      const familia = perfil.familia || [];
      const puedeCambiarFoto = puedeGestionarSocios || s.id===state.current_user;
      return `<div class="list-item">

        <div class="socio-row-avatar" data-action="ver-socio" data-id="${s.id}" style="cursor:pointer;" title="Ver perfil de ${escapeHtml(s.nombre)}">

          ${avatarHtml(s,'sm', puedeCambiarFoto ? 'edit' : 'view')}

          <div>

            <div style="font-weight:600; ${!s.activo?'opacity:0.5; text-decoration:line-through;':''}">${escapeHtml(s.nombre)} ${s.id===state.current_user?'<span class="tag ok">tú</span>':''}${roleNames(s).map(rn=>`<span class="tag">${escapeHtml(rn)}</span>`).join('')}${!s.activo?'<span class="tag warn">de baja</span>':''}${!s.tiene_pin?'<span class="tag warn">sin PIN</span>':''}</div>

            <div class="meta">${perfil.telefono ? 'Tel: '+escapeHtml(perfil.telefono) : 'Sin teléfono'} ${familia.length? '- '+familia.length+' familiar(es)':''}</div>

          </div>

        </div>

        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">

          ${puedeCambiarFoto ? `<label class="btn ghost small" style="cursor:pointer;">Foto<input type="file" accept="image/*" data-autoupload-foto="${s.id}" style="display:none;"></label>` : ''}

          ${puedeGestionarSocios ? `<button class="btn ghost small" data-action="reset-pin" data-id="${s.id}">Restablecer PIN</button>` : ''}

          ${puedeGestionarSocios && s.id!==state.current_user ? (s.activo

            ? `<button class="btn danger small" data-action="toggle-activo" data-activo="1" data-id="${s.id}">Dar de baja</button>`

            : `<button class="btn ghost small" data-action="toggle-activo" data-activo="0" data-id="${s.id}">Reactivar</button><button class="btn danger small" data-action="delete-socio" data-id="${s.id}">Eliminar</button>`

          ) : ''}

        </div>
      </div>`;
    }).join('')}
  </div>`;
}

/* ============ CUOTAS ============ */
function renderCuotas(){
  const admin = can('manage_cuotas');
  const rows = state.socios.map(s=>{
    const cells = MESES.map((m,i)=>{
      const month = i+1;
      const c = state.cuotas.find(c=>c.socio_id===s.id && c.year===cuotasYear && c.month===month);
      const paid = c && c.pagado;
      const mine = s.id===state.current_user ? 'mine' : '';
      if(!admin){

        return `<td><button class="cuota-cell ${paid?'paid':''} ${mine}" disabled title="Solo el tesorero o el administrador pueden marcar cuotas">${paid?'&times;':''}</button></td>`;
      }
      return `<td><button class="cuota-cell ${paid?'paid':''} ${mine}" data-action="toggle-cuota" data-socio="${s.id}" data-year="${cuotasYear}" data-month="${month}" title="${m} ${cuotasYear}">${paid?'&times;':''}</button></td>`;
    }).join('');
    return `<tr><td>${escapeHtml(s.nombre)}</td>${cells}</tr>`;
  }).join('');
  return `
  <div class="card">
    <h2><span><span class="pin"></span>Cuotas mensuales</span> <span style="font-size:0.9rem; color:var(--chalk-dim); font-family:'Work Sans';">(${money(state.config.cuota_mensual)}/mes)</span></h2>
    <p class="readonly-note">${admin ? 'Solo el tesorero o el administrador pueden marcar una cuota como pagada, previa comprobación.' : 'Solo lectura: aquí puedes ver quién ha pagado y quién falta. Marcar una cuota como pagada es cosa del tesorero o del administrador.'}</p>
    <div class="year-nav">
      <button data-action="cuota-year" data-dir="-1">&laquo; ${cuotasYear-1}</button>
      <b>${cuotasYear}</b>
      <button data-action="cuota-year" data-dir="1">${cuotasYear+1} &raquo;</button>
    </div>
    ${state.socios.length===0 ? '<p class="empty">Añade socios primero en la pestaña Socios.</p>' : `
    <div class="cuotas-table-wrap">
    <table class="cuotas-table">
      <thead><tr><th>Socio</th>${MESES.map(m=>`<th>${m}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    </div>
    <div class="cuotas-mobile">
      <div><label class="f">Mes</label><select id="cuota-mes-movil">${MESES.map((m,i)=>`<option value="${i+1}" ${cuotasMesMovil===i+1?'selected':''}>${m}</option>`).join('')}</select></div>
      ${state.socios.map(s=>{
        const c = state.cuotas.find(c=>c.socio_id===s.id && c.year===cuotasYear && c.month===cuotasMesMovil);
        const paid = c && c.pagado;
        const mine = s.id===state.current_user ? 'mine' : '';
        const btn = admin
          ? `<button class="cuota-cell ${paid?'paid':''} ${mine}" data-action="toggle-cuota" data-socio="${s.id}" data-year="${cuotasYear}" data-month="${cuotasMesMovil}">${paid?'&times;':''}</button>`
          : `<button class="cuota-cell ${paid?'paid':''} ${mine}" disabled title="Solo el tesorero o el administrador pueden marcar cuotas">${paid?'&times;':''}</button>`;
        return `<div class="list-item"><div>${escapeHtml(s.nombre)}</div>${btn}</div>`;
      }).join('')}
    </div>
    `}
  </div>`;
}

/* ============ RESERVAS ============ */
function renderReservaRow(r){
  const puedeEditar = can('manage_events');
  if(editandoReservaId === r.id){
    return `<form data-form="edit-reserva" data-id="${r.id}" class="list-item" style="display:block;">
      <div class="form-row">
        <div class="field-fecha"><label class="f">Fecha</label><input type="date" name="fecha" required value="${r.fecha}"></div>
        <div class="field-ancho"><label class="f">Evento</label><input type="text" name="evento" required value="${escapeHtml(r.evento)}"></div>
      </div>
      <div class="form-row">
        <div><label class="f">Desde las (opcional)</label><input type="time" name="hora_inicio" value="${r.hora_inicio||''}"></div>
        <div><label class="f">Hasta las (opcional)</label><input type="time" name="hora_fin" value="${r.hora_fin||''}"></div>
      </div>
      <div class="form-row"><div><label class="f">Notas</label><input type="text" name="notas" value="${escapeHtml(r.notas||'')}" placeholder="opcional"></div></div>
      <div style="display:flex; gap:8px;">
        <button class="btn small" type="submit">Guardar</button>
        <button class="btn ghost small" type="button" data-action="cancelar-editar-reserva">Cancelar</button>
      </div>
    </form>`;
  }
  return `<div class="list-item">
    <div>
      <div style="font-weight:600;">${escapeHtml(r.evento)} <span class="meta">- ${fmtDate(r.fecha)} - ${fmtHoras(r)}</span></div>
      <div class="meta">Reservado por ${escapeHtml(socioNombre(r.socio_id))} ${r.notas?'- '+escapeHtml(r.notas):''}</div>
    </div>
    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
      ${puedeEditar ? `<button class="btn ghost small" data-action="editar-reserva" data-id="${r.id}">Editar</button>` : ''}
      ${(r.socio_id===state.current_user || puedeEditar) ? `<button class="btn danger small" data-action="delete-reserva" data-id="${r.id}">Cancelar</button>` : ''}
    </div>
  </div>`;
}
function renderReservas(){
  const proximas = state.reservas.filter(r=>r.fecha >= todayISO()).sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const pasadas = state.reservas.filter(r=>r.fecha < todayISO()).sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,10);
  return `
  <div class="card">
    <h2><span class="pin"></span>Reservar la peña</h2>
    <form data-form="add-reserva">
      <div class="form-row">

        <div class="field-fecha"><label class="f">Fecha</label><input type="date" name="fecha" required value="${todayISO()}"></div>

        <div class="field-ancho"><label class="f">Evento</label><input type="text" name="evento" required placeholder="Ej: Cumpleaños, comida familiar..."></div>
      </div>
      <div class="form-row">
        
        <div><label class="f">Desde las (opcional)</label><input type="time" name="hora_inicio"></div>
        
        <div><label class="f">Hasta las (opcional)</label><input type="time" name="hora_fin"></div>
      </div>
      <p class="meta" style="margin:-4px 0 10px;">Deja las horas en blanco si la reserva es para todo el día.</p>
      <div class="form-row"><div><label class="f">Notas</label><input type="text" name="notas" placeholder="opcional"></div></div>
      <button class="btn" type="submit">Reservar a mi nombre</button>
    </form>
  </div>
  <div class="card">
    <h2 style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <span><span class="pin"></span>Próximas reservas</span>
      ${proximas.length ? `<button class="btn accent small" data-action="export-reservas-whatsapp" style="font-family:'Work Sans';">Enviar por WhatsApp</button>` : ''}
    </h2>
    ${proximas.length===0 ? '<p class="empty">La peña está libre por ahora.</p>' : proximas.map(r=>renderReservaRow(r)).join('')}
  </div>
  <div class="card">
    <h2><span class="pin"></span>Calendario de reservas</h2>
    ${renderMiniCalendario(reservasCalFecha, state.reservas.map(r=>({fecha:r.fecha, label:r.evento+' - '+socioNombre(r.socio_id), detalle:`${r.evento}\n${fmtDate(r.fecha)} - ${fmtHoras(r)}\nReservado por ${socioNombre(r.socio_id)}${r.notas?'\n'+r.notas:''}`})), 'reservas-mes')}
  </div>
  ${pasadas.length ? `<div class="card">
    <h2><span class="pin"></span>Historial reciente</h2>
    ${pasadas.map(r=>renderReservaRow(r)).join('')}
  </div>` : ''}
  `;
}

/* ============ REUNIONES ============ */
function renderReuniones(){
  const puedeGestionarEventos = can('manage_events');
  const ordenadas = [...state.reuniones].sort((a,b)=>b.fecha.localeCompare(a.fecha));
  return `
  ${puedeGestionarEventos ? `
  <div class="card">
    <h2><span class="pin"></span>Convocar reunión</h2>
    <form data-form="add-reunion">
      <div class="form-row">

        <div class="field-fecha"><label class="f">Fecha</label><input type="date" name="fecha" required value="${todayISO()}"></div>

        <div class="field-ancho"><label class="f">Tema</label><input type="text" name="evento" required placeholder="Ej: Reparto de gastos verano"></div>
      </div>
      <div class="form-row">

        <div><label class="f">Desde las (opcional)</label><input type="time" name="hora_inicio"></div>

        <div><label class="f">Hasta las (opcional)</label><input type="time" name="hora_fin"></div>
      </div>
      <div class="form-row"><div><label class="f">Notas / orden del día</label><textarea name="notas" placeholder="¿De qué se va a hablar...?"></textarea></div></div>
      <button class="btn" type="submit">Añadir reunión</button>
    </form>
  </div>` : `<p class="readonly-note">Solo lectura, para ver consultar con el administrador.</p>`}
  <div class="card">
    <h2><span class="pin"></span>Calendario de reuniones</h2>
    ${renderMiniCalendario(reunionesCalFecha, state.reuniones.map(r=>({fecha:r.fecha, label:r.evento, detalle:`${r.evento}\n${fmtDate(r.fecha)} - ${fmtHoras(r)}\nConvocada por ${socioNombre(r.socio_id)}${r.notas?'\n'+r.notas:''}`})), 'reuniones-mes')}
  </div>
  <div class="card">
    <h2 style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <span><span class="pin"></span>Historial</span>
      ${ordenadas.length ? `<button class="btn accent small" data-action="export-reuniones-whatsapp" style="font-family:'Work Sans';">Enviar por WhatsApp</button>` : ''}
    </h2>
    ${ordenadas.length===0 ? '<p class="empty">Aún no hay reuniones.</p>' : ordenadas.map(r=>{
      if(editandoReunionId === r.id){
        return `<form data-form="edit-reunion" data-id="${r.id}" class="list-item" style="display:block;">
          <div class="form-row">
            <div class="field-fecha"><label class="f">Fecha</label><input type="date" name="fecha" required value="${r.fecha}"></div>
            <div class="field-ancho"><label class="f">Tema</label><input type="text" name="evento" required value="${escapeHtml(r.evento)}"></div>
          </div>
          <div class="form-row">
            <div><label class="f">Desde las (opcional)</label><input type="time" name="hora_inicio" value="${r.hora_inicio||''}"></div>
            <div><label class="f">Hasta las (opcional)</label><input type="time" name="hora_fin" value="${r.hora_fin||''}"></div>
          </div>
          <div class="form-row"><div><label class="f">Notas / orden del día</label><textarea name="notas">${escapeHtml(r.notas||'')}</textarea></div></div>
          <div style="display:flex; gap:8px;">
            <button class="btn small" type="submit">Guardar</button>
            <button class="btn ghost small" type="button" data-action="cancelar-editar-reunion">Cancelar</button>
          </div>
        </form>`;
      }
      const asistentes = r.asistentes || [];
      return `<div class="list-item">

        <div style="flex:1; min-width:0;">

          <div style="font-weight:600;">${escapeHtml(r.evento)} <span class="meta">- ${fmtDate(r.fecha)} - ${fmtHoras(r)}</span></div>

          <div class="meta" style="margin-top:2px;">Convocada por ${escapeHtml(socioNombre(r.socio_id))}</div>

          ${r.notas ? `<div class="meta" style="margin-top:2px;">${escapeHtml(r.notas)}</div>` : ''}

          <details data-asistencia-details="${r.id}" style="margin-top:8px;" ${reunionesAsistenciaAbierta[r.id]?'open':''}>
            <summary>Asistentes (${asistentes.length})</summary>
            <div class="role-options" style="margin-top:8px;">
              ${state.socios.map(s=>`<button class="tag ${asistentes.includes(s.id)?'ok':''}" data-action="toggle-asistencia" data-reunion="${r.id}" data-socio="${s.id}" style="border:none;">${asistentes.includes(s.id)?'&check; ':''}${escapeHtml(s.nombre)}</button>`).join(' ')}
            </div>
          </details>

          ${renderActaReunion(r, puedeGestionarEventos)}

        </div>

        ${puedeGestionarEventos ? `<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <button class="btn ghost small" data-action="editar-reunion" data-id="${r.id}">Editar</button>
          <button class="btn danger small" data-action="delete-reunion" data-id="${r.id}">Borrar</button>
        </div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

const ACTA_EXT_PREVISUALIZABLE = ['jpg','jpeg','png','pdf'];
function renderActaReunion(r, puedeGestionar){
  const tieneTexto = !!(r.acta_texto && r.acta_texto.trim());
  const tieneArchivo = !!r.acta_ext;
  if(!tieneTexto && !tieneArchivo && !puedeGestionar) return '';
  const editando = editandoActaId === r.id;
  const urlArchivo = tieneArchivo ? `/static/actas/${r.id}.${r.acta_ext}?v=${ticketVersion}` : '';
  const previsualizable = tieneArchivo && ACTA_EXT_PREVISUALIZABLE.includes(r.acta_ext);
  const nombreArchivo = r.acta_nombre || `documento.${r.acta_ext}`;
  return `
  <details data-acta-details="${r.id}" style="margin-top:8px;" ${reunionesActaAbierta[r.id]?'open':''}>
    <summary>Acta de la reunión${(tieneTexto||tieneArchivo)?'':' (sin redactar)'}</summary>
    <div style="margin-top:8px;">
      ${tieneTexto ? `<div class="meta" style="white-space:pre-wrap;">${escapeHtml(r.acta_texto)}</div>` : ''}
      ${tieneArchivo ? `<div style="margin-top:6px;">${previsualizable
        ? `<button type="button" class="link-btn meta" style="color:var(--amber);" data-action="ver-adjunto" data-url="${urlArchivo}" data-tipo="${r.acta_ext==='pdf'?'pdf':'jpg'}">${escapeHtml(nombreArchivo)}</button>`
        : `<a class="link-btn meta" style="color:var(--amber);" href="${urlArchivo}" target="_blank" rel="noopener noreferrer">${escapeHtml(nombreArchivo)}</a>`}</div>` : ''}
      ${!tieneTexto && !tieneArchivo && !editando ? '<p class="empty" style="margin:0;">Todavía no hay acta de esta reunión.</p>' : ''}
      ${puedeGestionar ? (editando ? `
        <form data-form="edit-acta" data-id="${r.id}" style="margin-top:8px;">
          <textarea name="texto" placeholder="Escribe aquí lo hablado en la reunión...">${escapeHtml(r.acta_texto||'')}</textarea>
          <div style="display:flex; gap:8px; margin-top:6px;">
            <button class="btn small" type="submit">Guardar acta</button>
            <button class="btn ghost small" type="button" data-action="cancelar-edit-acta">Cancelar</button>
          </div>
        </form>
      ` : `
        <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
          <button class="btn ghost small" type="button" data-action="editar-acta" data-id="${r.id}">${tieneTexto?'Editar acta':'Redactar acta'}</button>
          <label class="btn ghost small" style="cursor:pointer;">${tieneArchivo?'Cambiar archivo':'Subir archivo (Word, Excel, imagen)'}<input type="file" accept=".doc,.docx,.xls,.xlsx,.pdf,image/jpeg,image/png" data-autoupload-acta="${r.id}" style="display:none;"></label>
          ${tieneArchivo ? `<button class="btn danger small" type="button" data-action="quitar-acta-archivo" data-id="${r.id}">Quitar archivo</button>` : ''}
        </div>
      `) : ''}
    </div>
  </details>`;
}

/* ============ ESTATUTOS ============ */
const ESTATUTOS_EXT_PREVISUALIZABLE = ['jpg','jpeg','png','pdf'];
function renderEstatutosArchivo(a){
  const url = `/static/estatutos/${a.id}.${a.ext}?v=${ticketVersion}`;
  const previsualizable = ESTATUTOS_EXT_PREVISUALIZABLE.includes(a.ext);
  const nombre = a.nombre_original || `documento.${a.ext}`;
  return `<div class="list-item" data-id="${a.id}">
    ${previsualizable
      ? `<button type="button" class="link-btn meta" style="color:var(--amber); text-align:left;" data-action="ver-adjunto" data-url="${url}" data-tipo="${a.ext==='pdf'?'pdf':'jpg'}">${escapeHtml(nombre)}</button>`
      : `<a class="link-btn meta" style="color:var(--amber);" href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(nombre)}</a>`}
    ${can('manage_estatutos') ? `<button class="btn danger small" type="button" style="font-family:'Work Sans';" data-action="quitar-estatutos-archivo" data-id="${a.id}">Quitar</button>` : ''}
  </div>`;
}
function renderEstatutos(){
  const puedeEditar = can('manage_estatutos');
  const estatutos = state.estatutos || {contenido:'', actualizado_en:null, actualizado_por:null, archivos:[]};
  const tieneContenido = !!(estatutos.contenido && estatutos.contenido.trim());
  const archivos = estatutos.archivos || [];
  return `
  <div class="card">
    <h2 style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <span><span class="pin"></span>Estatutos de la peña</span>
      ${puedeEditar && !estatutosEditando ? `<div style="display:flex; gap:8px; flex-wrap:wrap; font-family:'Work Sans';">
        <button class="btn ghost small" type="button" style="font-family:'Work Sans';" data-action="editar-estatutos">${tieneContenido?'Editar texto':'Redactar texto'}</button>
        ${tieneContenido ? `<button class="btn danger small" type="button" style="font-family:'Work Sans';" data-action="borrar-estatutos-contenido">Eliminar texto</button>` : ''}
      </div>` : ''}
    </h2>
    ${estatutos.actualizado_en ? `<p class="meta" style="margin-top:-6px; margin-bottom:10px;">Última actualización: ${new Date(estatutos.actualizado_en).toLocaleString('es-ES')}${estatutos.actualizado_por?' - '+escapeHtml(socioNombre(estatutos.actualizado_por)):''}</p>` : ''}
    ${puedeEditar && estatutosEditando ? `
      <form data-form="edit-estatutos">
        <textarea name="contenido" rows="18" placeholder="Escribe aquí los estatutos de la peña...">${escapeHtml(estatutos.contenido||'')}</textarea>
        <div style="display:flex; gap:8px; margin-top:8px;">
          <button class="btn small" type="submit">Guardar</button>
          <button class="btn ghost small" type="button" data-action="cancelar-edit-estatutos">Cancelar</button>
        </div>
      </form>
    ` : (tieneContenido
      ? `<div class="meta" style="white-space:pre-wrap; font-size:0.98rem;">${escapeHtml(estatutos.contenido)}</div>`
      : `<p class="empty">${puedeEditar ? 'Todavía no se han redactado los estatutos.' : 'Todavía no hay estatutos publicados.'}</p>`)}

    <div style="margin-top:16px; padding-top:12px; border-top:1px solid var(--line);">
      <div style="font-weight:600; margin-bottom:6px;">Documentos adjuntos</div>
      ${archivos.length ? archivos.map(a=>renderEstatutosArchivo(a)).join('') : `<p class="empty" style="margin:0 0 8px;">No hay ningún documento adjunto.</p>`}
      ${puedeEditar ? `
        <label class="btn ghost small" style="cursor:pointer; font-family:'Work Sans'; margin-top:8px; display:inline-block;">Añadir documento (Word, Excel, JPG, PNG)<input type="file" accept=".doc,.docx,.xls,.xlsx,.pdf,image/jpeg,image/png" data-autoupload-estatutos style="display:none;"></label>
      ` : ''}
    </div>
  </div>`;
}

/* ============ TRICOUNT (reparto de gastos por evento) ============ */
function renderNuevoEventoParticipantesWrap(){
  const disponibles = state.socios.filter(s=>s.activo && !nuevoEventoParticipantes.includes(s.id));
  return `
    <div class="role-options" style="margin-bottom:8px;">
      ${nuevoEventoParticipantes.length ? nuevoEventoParticipantes.map(sid=>`<span class="role-option">${escapeHtml(socioNombre(sid))}<input type="hidden" name="participantes" value="${sid}"><button type="button" data-action="quitar-participante-nuevo-evento" data-socio="${sid}" title="Quitar" style="background:none; border:none; color:var(--chalk-dim); padding:0; margin-left:2px;">x</button></span>`).join('') : '<span class="empty">Sin participantes añadidos todavía.</span>'}
    </div>
    ${disponibles.length ? `<div class="form-row" style="align-items:flex-end; margin-bottom:0;">
      <div><select id="nuevo-evento-participante-select"><option value="" selected>Elige un socio...</option>${disponibles.map(s=>`<option value="${s.id}">${escapeHtml(s.nombre)}</option>`).join('')}</select></div>
      <div style="flex:none;"><button type="button" class="btn ghost small" data-action="anadir-participante-nuevo-evento">+</button></div>
    </div>` : ''}
  `;
}
function renderReparto(){
  const eventos = state.gastos_eventos || [];
  const visibles = eventos.filter(ev=>!ev.oculto);
  const ocultos = eventos.filter(ev=>ev.oculto);
  return `
  <div class="card">
    <h2><span class="pin"></span>Nuevo evento (cena, quedada...)</h2>
    <form data-form="add-gasto-evento">
      <div class="form-row">

        <div><label class="f">Nombre del evento</label><input type="text" name="nombre" required placeholder="Ej: Cena de verano"></div>

        <div><label class="f">Fecha</label><input type="date" name="fecha" required value="${todayISO()}"></div>
      </div>
      <div class="form-row"><div><label class="f">Notas</label><input type="text" name="notas" placeholder="opcional"></div></div>
      <div style="margin-bottom:12px;">
        <label class="f">¿Quién participa? (márcate a ti mismo si vas a participar)</label>
        <div id="nuevo-evento-participantes-wrap">${renderNuevoEventoParticipantesWrap()}</div>
      </div>
      <button class="btn" type="submit">Crear evento</button>
    </form>
  </div>
  ${visibles.length===0 ? '<div class="card"><p class="empty">Todavía no hay eventos de Tricount.</p></div>' : visibles.map(ev=>renderGastoEvento(ev)).join('')}
  ${ocultos.length ? `
  <div class="card">
    <details>
      <summary>Eventos ocultos (${ocultos.length})</summary>
      ${ocultos.map(ev=>{
        const puedeGestionar = ev.creado_por===state.current_user || can('manage_finances');
        return `<div class="list-item">
          <div><div style="font-weight:600;">${escapeHtml(ev.nombre)} <span class="meta">- ${fmtDate(ev.fecha)}</span></div><div class="meta">${money(ev.total)}</div></div>
          ${puedeGestionar ? `<div style="display:flex; gap:8px;"><button class="btn ghost small" data-action="toggle-ocultar-evento" data-id="${ev.id}">Mostrar de nuevo</button><button class="btn danger small" data-action="delete-gasto-evento" data-id="${ev.id}">Borrar</button></div>` : ''}
        </div>`;
      }).join('')}
    </details>
  </div>` : ''}
  `;
}

function renderGastoEvento(ev){
  const participantesSet = new Set(ev.participantes||[]);
  const puedeGestionarEvento = ev.creado_por===state.current_user || can('manage_finances');
  const soyParticipante = participantesSet.has(state.current_user);
  const noParticipantes = state.socios.filter(s=>s.activo && !participantesSet.has(s.id));
  const pagos = ev.pagos||[];
  const balances = ev.balances||{};
  const transferencias = ev.transferencias||[];
  return `
  <div class="card">
    <h2 style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <span class="sin-subrayado"><span class="pin"></span>${escapeHtml(ev.nombre)} <span class="meta">- ${fmtDate(ev.fecha)}</span></span>
      <span style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <span style="font-family:'JetBrains Mono',monospace; font-weight:600; color:var(--amber);">${money(ev.total)}</span>
        <button class="btn accent small" data-action="export-evento-whatsapp" data-id="${ev.id}" style="font-family:'Work Sans';">Enviar por WhatsApp</button>
        ${puedeGestionarEvento ? `<button class="btn ghost small" data-action="toggle-ocultar-evento" data-id="${ev.id}">Ocultar</button>` : ''}
        ${puedeGestionarEvento ? `<button class="btn danger small" data-action="delete-gasto-evento" data-id="${ev.id}">Borrar evento</button>` : ''}
      </span>
    </h2>
    ${ev.notas ? `<p class="meta" style="margin:-4px 0 10px;">${escapeHtml(ev.notas)}</p>` : ''}

    <label class="f">Participantes</label>
    <div class="role-options" style="margin-bottom:10px;">
      ${(ev.participantes||[]).map(sid=>`<span class="role-option">${escapeHtml(socioNombre(sid))} <button data-action="quitar-participante-evento" data-evento="${ev.id}" data-socio="${sid}" title="Quitar" style="background:none; border:none; color:var(--chalk-dim); padding:0; margin-left:2px;">x</button></span>`).join('') || '<span class="empty">Sin participantes.</span>'}
    </div>
    ${noParticipantes.length ? `
    <div class="form-row" style="align-items:flex-end; margin-bottom:14px;">
      <div><label class="f">Añadir participante</label><select data-nuevo-participante="${ev.id}"><option value="" selected>Elige un socio...</option>${noParticipantes.map(s=>`<option value="${s.id}">${escapeHtml(s.nombre)}</option>`).join('')}</select></div>
      <div style="flex:none;"><button type="button" class="btn ghost small" data-action="anadir-participante-evento" data-evento="${ev.id}">+ Añadir</button></div>
    </div>` : ''}

    ${(ev.participantes||[]).length ? `
    <label class="f">Saldos</label>
    <div style="margin-bottom:10px;">
      ${(ev.participantes||[]).map(sid=>{
        const b = balances[sid]||0;
        const cls = b>0.005 ? 'sage' : (b<-0.005 ? 'rust' : '');
        const texto = b>0.005 ? `le deben ${money(b)}` : (b<-0.005 ? `debe ${money(-b)}` : 'en paz');
        return `<div class="menu-row"><span class="label">${escapeHtml(socioNombre(sid))}</span><span class="dots"></span><span class="value ${cls}">${texto}</span></div>`;
      }).join('')}
    </div>` : ''}

    ${transferencias.length ? `
    <label class="f">Quien paga a quien</label>
    <div style="margin-bottom:10px;">
      ${transferencias.map(t=>`<div class="menu-row"><span class="label">${escapeHtml(socioNombre(t.de))} &rarr; ${escapeHtml(socioNombre(t.a))}</span><span class="dots"></span><span class="value amber">${money(t.importe)}</span></div>`).join('')}
    </div>` : ''}

    <label class="f">Pagos registrados</label>
    ${pagos.length===0 ? '<p class="empty">Sin pagos todavía.</p>' : pagos.map(p=>{
      const puedeBorrarPago = p.pagador_id===state.current_user || puedeGestionarEvento;
      const beneficiarios = (p.beneficiarios&&p.beneficiarios.length) ? p.beneficiarios.map(socioNombre).join(', ') : 'todos los participantes';
      return `<div class="list-item">
        <div>
          <div style="font-weight:600;">${escapeHtml(p.concepto)}</div>
          <div class="meta">Pago de ${escapeHtml(socioNombre(p.pagador_id))} - ${fmtDate(p.fecha)} - reparte entre: ${escapeHtml(beneficiarios)}</div>
          ${p.ticket ? `<button type="button" class="link-btn meta" style="color:var(--amber); margin-top:2px;" data-action="ver-adjunto" data-url="/static/tickets/pago-${p.id}.jpg?v=${ticketVersion}" data-tipo="jpg">Ver ticket</button>` : ''}
        </div>
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <span style="font-family:'JetBrains Mono',monospace; font-weight:600; color:var(--sage);">${money(p.importe)}</span>
          ${puedeBorrarPago ? `<label class="btn ghost small" style="cursor:pointer;">${p.ticket?'Cambiar ticket':'Subir ticket'}<input type="file" accept="image/png,image/jpeg" data-autoupload-ticket-pago="${p.id}" data-evento="${ev.id}" style="display:none;"></label>` : ''}
          ${puedeBorrarPago ? `<button class="btn danger small" data-action="delete-pago-evento" data-evento="${ev.id}" data-id="${p.id}">Borrar</button>` : ''}
        </div>
      </div>`;
    }).join('')}

    ${soyParticipante ? `
    <form data-form="add-pago-evento" data-evento="${ev.id}" style="margin-top:14px; padding-top:14px; border-top:1px dashed var(--line);">
      <label class="f">Registrar un pago</label>
      <div class="form-row">
        <div><label class="f">Quién pagó</label><select name="pagador_id">${(ev.participantes||[]).map(sid=>`<option value="${sid}" ${sid===state.current_user?'selected':''}>${escapeHtml(socioNombre(sid))}</option>`).join('')}</select></div>
        <div style="flex:2;"><label class="f">Concepto</label><input type="text" name="concepto" required placeholder="Ej: Cena, bebidas, gasolina..."></div>
        <div><label class="f">Importe (&euro;)</label><input type="number" step="0.01" min="0.01" name="importe" required></div>
      </div>
      <label class="f">Entre quien se reparte (deja todo marcado para repartir entre todos)</label>
      <div class="role-options" style="margin-bottom:10px;">
        ${(ev.participantes||[]).map(sid=>`<label class="role-option"><input type="checkbox" name="beneficiarios" value="${sid}" checked> ${escapeHtml(socioNombre(sid))}</label>`).join('')}
      </div>
      <button class="btn ghost" type="submit">Añadir pago</button>
    </form>` : '<p class="readonly-note" style="margin-top:14px;">Solo quien participa en el evento puede añadir pagos.</p>'}
  </div>`;
}

/* ============ INVENTARIO ============ */
function categoriasInventarioNombres(){
  return (state.categorias_inventario || []).map(c=>c.nombre);
}
// Categorías configuradas + cualquier categoría "huérfana" que tenga algún
// material pero ya no exista en la lista (p.ej. se borró la categoría):
// así ese material no desaparece sin más de la vista.
function todasLasCategoriasInventario(){
  const nombres = categoriasInventarioNombres();
  const huerfanas = [...new Set(state.inventario.map(i=>i.categoria).filter(c=>c && !nombres.includes(c)))].sort((a,b)=>a.localeCompare(b));
  return [...nombres, ...huerfanas];
}
function renderInventario(){
  const puedeGestionarInventario = can('manage_inventory');
  const categorias = todasLasCategoriasInventario();
  const porCategoria = {};
  categorias.forEach(c=>porCategoria[c]=[]);
  state.inventario.forEach(i=>{ (porCategoria[i.categoria]||(porCategoria[i.categoria]=[])).push(i); });
  return `
  ${puedeGestionarInventario ? `
  <div class="card">
    <h2><span class="pin"></span>Añadir</h2>
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin:-6px 0 14px;">
      <button class="btn accent small" data-action="export-inventario-whatsapp" style="font-family:'Work Sans';">Enviar por WhatsApp</button>
      ${can('export_data') ? `<button class="btn accent small" data-action="export-excel" style="font-family:'Work Sans';">Exportar a Excel</button>` : ''}
      <label class="btn accent small" style="cursor:pointer; font-family:'Work Sans';">Importar Excel<input type="file" accept=".xlsx" data-import-excel style="display:none;"></label>
    </div>
    <form data-form="add-inventario">
      <div class="form-row">

        <div><label class="f">Nombre</label><input type="text" name="nombre" required placeholder="Ej: Nevera, plancha, mesas..."></div>

        <div><label class="f">Categoría</label>
          <div style="display:flex; gap:6px;">
            <select name="categoria" style="flex:1;">${categoriasInventarioNombres().map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}</select>
            <button type="button" class="btn ghost small" data-action="add-categoria-inv-inline" title="Añadir categoría nueva">+</button>
            <button type="button" class="btn ghost small" data-action="delete-categoria-inv-inline" title="Quitar la categoría seleccionada">&minus;</button>
          </div>
        </div>
      </div>
      <div class="form-row">

        <div><label class="f">Cantidad</label><input type="number" name="cantidad" value="1" min="0"></div>

        <div><label class="f">Estado (opcional)</label><select name="estado"><option value=""></option><option>Bien</option><option>Necesita revision</option><option>Hay que comprar</option></select></div>

        <div><label class="f">Notas</label><input type="text" name="notas" placeholder="opcional"></div>
      </div>
      <button class="btn" type="submit">Añadir al inventario</button>
    </form>
  </div>` : `<div class="card"><p class="readonly-note">Cualquier socio puede editar el material que ya existe. Solo quien gestiona inventario puede añadir material nuevo. <button class="btn accent small" data-action="export-inventario-whatsapp" style="font-family:'Work Sans';">Enviar por WhatsApp</button> ${can('export_data') ? `<button class="btn accent small" data-action="export-excel" style="font-family:'Work Sans';">Exportar a Excel</button>` : ''} <label class="btn accent small" style="cursor:pointer; font-family:'Work Sans';">Importar Excel<input type="file" accept=".xlsx" data-import-excel style="display:none;"></label></p></div>`}
  ${categorias.map(cat=>{
    const items = porCategoria[cat];
    if(!items || items.length===0) return '';
    return `<div class="card">
      <h2><span class="pin"></span>${escapeHtml(cat)}</h2>
      ${items.map(i=>renderInventarioItem(i)).join('')}
    </div>`;
  }).join('')}
  ${state.inventario.length===0 ? '<div class="card"><p class="empty">Todavía no hay material registrado.</p></div>' : ''}
  `;
}

function renderInventarioItem(i){
  const nombresCategoria = categoriasInventarioNombres();
  if(editandoInventarioId===i.id){
    return `<form data-form="edit-inventario" data-id="${i.id}" class="list-item" style="display:block;">
      <div class="form-row">
        <div><label class="f">Nombre</label><input type="text" name="nombre" required value="${escapeHtml(i.nombre)}"></div>
        <div><label class="f">Categoría</label><select name="categoria">${nombresCategoria.map(c=>`<option value="${escapeHtml(c)}" ${i.categoria===c?'selected':''}>${escapeHtml(c)}</option>`).join('')}${!nombresCategoria.includes(i.categoria)?`<option value="${escapeHtml(i.categoria)}" selected>${escapeHtml(i.categoria)}</option>`:''}</select></div>
      </div>
      <div class="form-row">
        <div><label class="f">Cantidad</label><input type="number" name="cantidad" value="${i.cantidad}" min="0"></div>
        <div><label class="f">Estado (opcional)</label><select name="estado"><option value="" ${!i.estado?'selected':''}></option><option ${i.estado==='Bien'?'selected':''}>Bien</option><option ${i.estado==='Necesita revision'?'selected':''}>Necesita revision</option><option ${i.estado==='Hay que comprar'?'selected':''}>Hay que comprar</option></select></div>
        <div><label class="f">Notas</label><input type="text" name="notas" value="${escapeHtml(i.notas||'')}" placeholder="opcional"></div>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn small" type="submit">Guardar</button>
        <button class="btn ghost small" type="button" data-action="cancelar-editar-inventario">Cancelar</button>
      </div>
    </form>`;
  }
  const stockBajo = esCategoriaStockBajo(i.categoria) && Number(i.cantidad) < UMBRAL_STOCK_BAJO;
  return `<div class="list-item" data-id="${i.id}">
    <div>
      <div style="font-weight:600; overflow-wrap:anywhere;">${escapeHtml(i.nombre)} <span class="meta" style="${stockBajo?'color:var(--rust); font-weight:700;':''}">· ${i.cantidad}</span></div>
      <div class="meta" style="overflow-wrap:anywhere;">${i.estado==='Hay que comprar'?'<span class="tag warn">Hay que comprar</span>':i.estado==='Necesita revision'?'<span class="tag warn">Revisar</span>':i.estado==='Bien'?'<span class="tag ok">Bien</span>':''} ${stockBajo?'<span class="tag warn">Quedan pocas unidades</span>':''} ${i.notas?escapeHtml(i.notas):''}</div>
    </div>
    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
      <button class="btn ghost small" data-action="editar-inventario" data-id="${i.id}">Editar</button>
      <button class="btn danger small" data-action="delete-inventario" data-id="${i.id}">Borrar</button>
    </div>
  </div>`;
}

/* ============ LISTA DE LA COMPRA ============ */
function renderListasTab(){
  return `
  <div class="subtabs" style="margin-bottom:14px;">
    <button type="button" class="subtab-btn ${listasSubTab==='compra'?'active':''}" data-action="listas-subtab" data-sub="compra">Lista de la compra</button>
    <button type="button" class="subtab-btn ${listasSubTab==='comidas'?'active':''}" data-action="listas-subtab" data-sub="comidas">Lista para comidas/cenas</button>
    <button type="button" class="subtab-btn ${listasSubTab==='pago'?'active':''}" data-action="listas-subtab" data-sub="pago">Lista para pagos</button>
  </div>
  ${listasSubTab==='pago' ? renderListasPago() : listasSubTab==='comidas' ? renderListasComidas() : renderListaCompra()}
  `;
}

function renderNombreLista(lista, tipo){
  if(editandoNombreListaId === lista.id){
    return `<form data-form="edit-nombre-lista-${tipo}" data-id="${lista.id}" data-anchor-id="${lista.id}" style="display:flex; gap:6px; align-items:center; flex:1; min-width:200px;">
      <input type="text" name="nombre" required value="${escapeHtml(lista.nombre)}" style="flex:1;">
      <button class="btn small" type="submit">Guardar</button>
      <button class="btn ghost small" type="button" data-action="cancelar-editar-nombre-lista">Cancelar</button>
    </form>`;
  }
  return `<span data-anchor-id="${lista.id}" style="display:contents;"><span><span class="pin"></span>${escapeHtml(lista.nombre)}</span> <button type="button" class="link-btn meta" data-action="editar-nombre-lista" data-id="${lista.id}" title="Cambiar el título de la lista">Editar título</button></span>`;
}

function renderListaCompra(){
  const listas = state.listas_compra || [];
  return `
  <div class="card">
    <h2><span class="pin"></span>Nueva lista de compra</h2>
    <form data-form="add-lista-compra">
      <div class="form-row">
        <div><label class="f">Nombre de la lista</label><input type="text" name="nombre" required placeholder="Ej: Supermercado, Fiesta mayor..."></div>
      </div>
      <button class="btn" type="submit">Crear lista</button>
    </form>
  </div>
  ${listas.length===0 ? '<div class="card"><p class="empty">Todavía no hay listas de la compra. Crea la primera arriba.</p></div>' : ''}
  ${listas.map(renderListaCompraCard).join('')}
  `;
}

function renderListaCompraCard(lista){
  const items = lista.items || [];
  const pendientes = items.filter(i=>!i.comprado);
  const comprados = items.filter(i=>i.comprado);
  return `<div class="card">
    <h2 style="display:flex; align-items:center; flex-wrap:wrap; gap:8px;">
      ${renderNombreLista(lista, 'compra')}
      <span style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-left:auto;">
        <span class="meta">creada por ${escapeHtml(socioNombre(lista.creado_por))}</span>
        <button class="btn accent small" data-action="export-lista-compra-whatsapp" data-id="${lista.id}" style="font-family:'Work Sans';">Enviar por WhatsApp</button>
        <button class="btn danger small" data-action="delete-lista-compra" data-id="${lista.id}">Borrar lista</button>
      </span>
    </h2>
    ${items.length===0 ? '<p class="empty">Todavía no hay productos en esta lista.</p>' : ''}
    ${pendientes.map(i=>renderItemCompra(i)).join('')}
    ${comprados.length ? `<details style="margin-top:8px;">
      <summary>Comprados (${comprados.length})</summary>
      ${comprados.map(i=>renderItemCompra(i)).join('')}
    </details>` : ''}
    <form data-form="add-item-compra" data-lista="${lista.id}" style="margin-top:14px; padding-top:14px; border-top:1px dashed var(--line);">
      <div class="form-row">
        <div style="flex:2;"><label class="f">Producto</label><input type="text" name="nombre" required placeholder="Ej: Leche, pan, hielo..."></div>
        <div><label class="f">Cantidad</label><input type="text" name="cantidad" placeholder="opcional"></div>
      </div>
      <button class="btn ghost small" type="submit">Añadir producto</button>
    </form>
  </div>`;
}

/* ============ LISTA PARA COMIDAS/CENAS ============ */
function renderTipoComidaSelect(valorActual){
  const tipos = state.tipos_comida || [];
  return `<div style="display:flex; gap:6px;">
    <select name="tipo" style="flex:1;">${tipos.map(t=>`<option ${valorActual===t.nombre?'selected':''}>${escapeHtml(t.nombre)}</option>`).join('')}</select>
    <button type="button" class="btn ghost small" data-action="add-tipo-comida-inline" title="Añadir opción nueva">+</button>
    <button type="button" class="btn ghost small" data-action="delete-tipo-comida-inline" title="Quitar la opción seleccionada">&minus;</button>
  </div>`;
}
function renderListasComidas(){
  const listas = state.listas_comida || [];
  return `
  <div class="card">
    <h2><span class="pin"></span>Nueva lista de comida/cena</h2>
    <form data-form="add-lista-comida">
      <div class="form-row">
        <div style="flex:2;"><label class="f">Nombre</label><input type="text" name="nombre" required placeholder="Ej: Cena de fiestas, comida de Nochebuena..."></div>
        <div><label class="f">Fecha</label><input type="date" name="fecha" value="${todayISO()}"></div>
        <div><label class="f">Hora</label><input type="time" name="hora"></div>
      </div>
      <div class="form-row">
        <div><label class="f">¿Qué se come?</label>${renderTipoComidaSelect()}</div>
        <div style="flex:2;"><label class="f">Notas</label><input type="text" name="notas" placeholder="Ej: nombre del bar/restaurante..."></div>
      </div>
      <button class="btn" type="submit">Crear</button>
    </form>
  </div>
  ${listas.length===0 ? '<div class="card"><p class="empty">Todavía no hay comidas o cenas planeadas. Crea la primera arriba.</p></div>' : ''}
  ${listas.map(renderListaComidaCard).join('')}
  `;
}

function renderListaComidaCard(lista){
  if(editandoListaComidaId === lista.id){
    return `<div class="card">
      <form data-form="edit-lista-comida" data-id="${lista.id}">
        <div class="form-row">
          <div style="flex:2;"><label class="f">Nombre</label><input type="text" name="nombre" required value="${escapeHtml(lista.nombre)}"></div>
          <div><label class="f">Fecha</label><input type="date" name="fecha" value="${lista.fecha||''}"></div>
          <div><label class="f">Hora</label><input type="time" name="hora" value="${lista.hora||''}"></div>
        </div>
        <div class="form-row">
          <div><label class="f">¿Qué se come?</label>${renderTipoComidaSelect(lista.tipo)}</div>
          <div style="flex:2;"><label class="f">Notas</label><input type="text" name="notas" value="${escapeHtml(lista.notas||'')}" placeholder="Ej: nombre del bar/restaurante..."></div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn small" type="submit">Guardar</button>
          <button class="btn ghost small" type="button" data-action="cancelar-editar-lista-comida">Cancelar</button>
        </div>
      </form>
    </div>`;
  }
  const asistentes = lista.asistentes || [];
  const invitados = lista.invitados || [];
  const totalPersonas = asistentes.length + invitados.length;
  const disponibles = state.socios.filter(s=>s.activo && !asistentes.includes(s.id));
  return `<div class="card" data-id="${lista.id}">
    <h2 style="display:flex; align-items:center; flex-wrap:wrap; gap:8px;">
      <span><span class="pin"></span>${escapeHtml(lista.nombre)}</span>
      <span style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-left:auto;">
        <span class="meta">creada por ${escapeHtml(socioNombre(lista.creado_por))}</span>
        <button class="btn ghost small" data-action="editar-lista-comida" data-id="${lista.id}">Editar</button>
        <button class="btn accent small" data-action="export-lista-comida-whatsapp" data-id="${lista.id}" style="font-family:'Work Sans';">Enviar por WhatsApp</button>
        <button class="btn danger small" data-action="delete-lista-comida" data-id="${lista.id}">Borrar</button>
      </span>
    </h2>
    ${(lista.fecha || lista.hora) ? `<div class="meta" style="margin:-4px 0 10px;">${lista.fecha ? fmtDate(lista.fecha) : ''}${lista.hora ? ' - '+lista.hora : ''}</div>` : ''}
    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:12px;">
      ${lista.tipo ? `<span class="tag big sky">${escapeHtml(lista.tipo)}</span>` : ''}
      ${lista.notas ? `<span class="meta">${escapeHtml(lista.notas)}</span>` : ''}
    </div>
    <div class="menu-row" style="margin-bottom:10px;">
      <span class="label"><strong>Vienen</strong></span><span class="dots"></span>
      <span class="value ${totalPersonas?'sage':''}"><strong>${totalPersonas} persona${totalPersonas===1?'':'s'}</strong></span>
    </div>
    ${totalPersonas ? `<div class="role-options" style="margin-bottom:12px;">
      ${asistentes.map(sid=>`<span class="role-option">${escapeHtml(socioNombre(sid))}</span>`).join('')}
      ${invitados.map(inv=>`<span class="role-option">${escapeHtml(inv.nombre)} <span class="meta">(invitado)</span></span>`).join('')}
    </div>` : '<p class="empty" style="margin-bottom:12px;">Todavía no se ha apuntado nadie.</p>'}
    <details>
      <summary>Apuntar o quitar gente</summary>
      <div style="margin-top:10px;">
        <label class="f">Socios apuntados</label>
        <div class="role-options" style="margin:6px 0 8px;">
          ${asistentes.length ? asistentes.map(sid=>`<span class="role-option">${escapeHtml(socioNombre(sid))}<button type="button" data-action="toggle-asistencia-comida" data-lista="${lista.id}" data-socio="${sid}" title="Quitar" style="background:none; border:none; color:var(--chalk-dim); padding:0; margin-left:2px;">x</button></span>`).join('') : '<span class="empty">Nadie apuntado todavía.</span>'}
        </div>
        ${disponibles.length ? `<div class="form-row" style="align-items:flex-end; margin-bottom:12px;">
          <div><select id="comida-socio-select-${lista.id}"><option value="" selected>Elige un socio...</option>${disponibles.map(s=>`<option value="${s.id}">${escapeHtml(s.nombre)}</option>`).join('')}</select></div>
          <div style="flex:none;"><button type="button" class="btn ghost small" data-action="anadir-socio-comida" data-lista="${lista.id}">+ Añadir</button></div>
        </div>` : ''}
        <label class="f">Invitados (no socios)</label>
        <div class="role-options" style="margin:6px 0 8px;">
          ${invitados.length ? invitados.map(inv=>`<span class="role-option">${escapeHtml(inv.nombre)}<button type="button" data-action="delete-invitado-comida" data-id="${inv.id}" title="Quitar" style="background:none; border:none; color:var(--chalk-dim); padding:0; margin-left:2px;">x</button></span>`).join('') : '<span class="empty">Sin invitados añadidos.</span>'}
        </div>
        <form data-form="add-invitado-comida" data-lista="${lista.id}" style="display:flex; gap:6px; align-items:flex-end; flex-wrap:wrap;">
          <div style="flex:1; min-width:160px;"><input type="text" name="nombre" placeholder="Nombre del invitado" required></div>
          <button class="btn ghost small" type="submit">+ Añadir invitado</button>
        </form>
      </div>
    </details>
  </div>`;
}

function renderListasPago(){
  const listas = state.listas_pago || [];
  const numeroCuenta = (state.config && state.config.numero_cuenta) || '';
  return `
  <div class="card">
    <h2><span class="pin"></span>Nueva lista de pago</h2>
    <p class="meta" style="margin:-4px 0 10px;">Para derramas o pagos extra</p>
    <form data-form="add-lista-pago">
      <div class="form-row">
        <div style="flex:2;"><label class="f">Asunto</label><input type="text" name="nombre" required placeholder="Ej: Derrama piscina 2026"></div>
        <div><label class="f">Importe por socio (EUR)</label><input type="number" name="importe" step="0.01" min="0" placeholder="opcional"></div>
      </div>
      <button class="btn" type="submit">Crear lista de pago</button>
    </form>
  </div>
  ${listas.length===0 ? '<div class="card"><p class="empty">Todavía no hay listas de pago. Crea la primera arriba.</p></div>' : ''}
  ${listas.map(l=>renderListaPagoCard(l, numeroCuenta)).join('')}
  `;
}

function renderListaPagoCard(lista, numeroCuenta){
  const items = lista.items || [];
  const pendientes = items.filter(i=>!i.pagado);
  const pagados = items.filter(i=>i.pagado);
  const sociosEnLista = new Set(items.map(i=>i.socio_id).filter(Boolean));
  const disponibles = state.socios.filter(s=>s.activo && !sociosEnLista.has(s.id));
  return `<div class="card">
    <h2 style="display:flex; align-items:center; flex-wrap:wrap; gap:8px;">
      ${renderNombreLista(lista, 'pago')}
      <span style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-left:auto;">
        <span class="meta">creada por ${escapeHtml(socioNombre(lista.creado_por))}</span>
        <button class="btn accent small" data-action="export-lista-pago-whatsapp" data-id="${lista.id}" style="font-family:'Work Sans';">Enviar por WhatsApp</button>
        <button class="btn danger small" data-action="delete-lista-pago" data-id="${lista.id}">Borrar lista</button>
      </span>
    </h2>
    ${numeroCuenta ? `<p class="meta" style="margin:-4px 0 10px;">Número de cuenta: <strong>${escapeHtml(numeroCuenta)}</strong></p>` : ''}
    <div class="menu-row" style="margin-bottom:6px;"><span class="label">Pendientes</span><span class="dots"></span><span class="value rust">${pendientes.length}</span></div>
    ${items.length===0 ? '<p class="empty">Todavía no hay filas en esta lista.</p>' : ''}
    ${pendientes.map(i=>renderItemPago(i)).join('')}
    ${pagados.length ? `<details style="margin-top:8px;">
      <summary>Ya han pagado (${pagados.length})</summary>
      ${pagados.map(i=>renderItemPago(i)).join('')}
    </details>` : ''}
    <form data-form="add-item-pago" data-lista="${lista.id}" style="margin-top:14px; padding-top:14px; border-top:1px dashed var(--line);">
      <div class="form-row">
        <div><label class="f">Socio (opcional)</label><select name="socio_id">
          <option value="" selected>Otra persona (no socio)</option>
          ${disponibles.map(s=>`<option value="${s.id}">${escapeHtml(s.nombre)}</option>`).join('')}
        </select></div>
        <div style="flex:2;"><label class="f">Nombre</label><input type="text" name="nombre" required placeholder="Ej: alguien que no era socio al crear la lista"></div>
        <div><label class="f">Importe (EUR)</label><input type="number" name="importe" step="0.01" min="0" placeholder="opcional"></div>
      </div>
      <button class="btn ghost small" type="submit">Añadir fila</button>
    </form>
  </div>`;
}

function renderItemPago(i){
  if(editandoItemPagoId===i.id){
    return `<form data-form="edit-item-pago" data-id="${i.id}" class="list-item" style="display:block;">
      <div class="form-row">
        <div style="flex:2;"><label class="f">Nombre</label><input type="text" name="nombre" required value="${escapeHtml(i.nombre)}"></div>
        <div><label class="f">Importe (EUR)</label><input type="number" name="importe" step="0.01" min="0" value="${i.importe||0}"></div>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn small" type="submit">Guardar</button>
        <button class="btn ghost small" type="button" data-action="cancelar-editar-item-pago">Cancelar</button>
      </div>
    </form>`;
  }
  return `<div class="list-item" data-id="${i.id}">
    <label style="display:flex; align-items:flex-start; gap:10px; flex:1; cursor:pointer;">
      <input type="checkbox" data-action="toggle-item-pago" data-id="${i.id}" ${i.pagado?'checked':''} style="margin-top:4px;">
      <span>
        <div style="font-weight:600; ${i.pagado?'text-decoration:line-through; opacity:.65;':''}">${escapeHtml(i.nombre)} ${i.importe ? `<span class="meta">· ${money(i.importe)}</span>` : ''}</div>
        <div class="meta">${i.pagado ? `Pagado${i.pagado_en?' el '+fmtDate(i.pagado_en.slice(0,10)):''}` : 'Pendiente de pago'}</div>
      </span>
    </label>
    <div style="display:flex; gap:8px;">
      <button class="btn ghost small" data-action="editar-item-pago" data-id="${i.id}">Editar</button>
      <button class="btn danger small" data-action="delete-item-pago" data-id="${i.id}">Quitar</button>
    </div>
  </div>`;
}

function renderItemCompra(i){
  if(editandoItemCompraId===i.id){
    return `<form data-form="edit-item-compra" data-id="${i.id}" class="list-item" style="display:block;">
      <div class="form-row">
        <div style="flex:2;"><label class="f">Producto</label><input type="text" name="nombre" required value="${escapeHtml(i.nombre)}"></div>
        <div><label class="f">Cantidad</label><input type="text" name="cantidad" value="${escapeHtml(i.cantidad||'')}" placeholder="opcional"></div>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn small" type="submit">Guardar</button>
        <button class="btn ghost small" type="button" data-action="cancelar-editar-item-compra">Cancelar</button>
      </div>
    </form>`;
  }
  return `<div class="list-item" data-id="${i.id}">
    <label style="display:flex; align-items:flex-start; gap:10px; flex:1; cursor:pointer;">
      <input type="checkbox" data-action="toggle-item-compra" data-id="${i.id}" ${i.comprado?'checked':''} style="margin-top:4px;">
      <span>
        <div style="font-weight:600; ${i.comprado?'text-decoration:line-through; opacity:.65;':''}">${escapeHtml(i.nombre)} ${i.cantidad ? `<span class="meta">· ${escapeHtml(i.cantidad)}</span>` : ''}</div>
        <div class="meta">${i.comprado ? `Comprado por ${escapeHtml(socioNombre(i.comprado_por))}` : `Añadido por ${escapeHtml(socioNombre(i.anadido_por))}`}</div>
      </span>
    </label>
    <div style="display:flex; gap:8px;">
      <button class="btn ghost small" data-action="editar-item-compra" data-id="${i.id}">Editar</button>
      <button class="btn danger small" data-action="delete-item-compra" data-id="${i.id}">Quitar</button>
    </div>
  </div>`;
}

/* ============ CAJA ============ */
function renderGastoSocioItem(g){
  const puedeModificar = g.socio_id===state.current_user || can('manage_finances');
  const esIngreso = g.tipo==='ingreso';
  const estadoLabel = 'Pagado';
  if(editandoGastoSocioId===g.id){
    const puedeCambiarSocio = can('manage_finances');
    return `<form data-form="edit-gasto-socio" data-id="${g.id}" class="list-item" style="display:block;">
      <div class="form-row">
        <div><label class="f">Tipo</label><select name="tipo"><option value="gasto" ${!esIngreso?'selected':''}>Gasto</option><option value="ingreso" ${esIngreso?'selected':''}>Ingreso</option></select></div>
        <div style="flex:2;"><label class="f">Concepto</label><input type="text" name="concepto" required value="${escapeHtml(g.concepto)}"></div>
        <div><label class="f">Importe (EUR)</label><input type="number" name="importe" step="0.01" min="0.01" required value="${g.importe}"></div>
        <div><label class="f">Fecha</label><input type="date" name="fecha" required value="${g.fecha}"></div>
      </div>
      <div class="form-row">
        <div><label class="f">Socio</label>${puedeCambiarSocio
          ? `<select name="socio_id">${state.socios.map(s=>`<option value="${s.id}" ${g.socio_id===s.id?'selected':''}>${escapeHtml(s.nombre)}</option>`).join('')}</select>`
          : `<input type="text" value="${escapeHtml(g.socio_nombre||'')}" disabled>`}</div>
        <div style="flex:2;"><label class="f">Notas</label><input type="text" name="notas" value="${escapeHtml(g.notas||'')}"></div>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn small" type="submit">Guardar</button>
        <button class="btn ghost small" type="button" data-action="cancelar-editar-gasto-socio">Cancelar</button>
      </div>
    </form>`;
  }
  const puedeSeleccionar = can('manage_finances') && !g.abonado;
  return `<div class="list-item gasto-socio-item" data-id="${g.id}">
    <div style="display:flex; gap:8px; align-items:flex-start; min-width:0;">
      ${puedeSeleccionar ? `<input type="checkbox" data-action="toggle-seleccion-gasto-socio" data-id="${g.id}" ${seleccionGastosSocios.has(g.id)?'checked':''} style="margin-top:4px; flex:none;" title="Seleccionar para marcar en bloque">` : ''}
      <div style="min-width:0; overflow-wrap:anywhere;">
        <div style="font-weight:600;">${escapeHtml(g.concepto)} <span class="tag">${esIngreso?'Ingreso':'Gasto'}</span> ${g.abonado?`<span class="tag ok">${estadoLabel}</span>`:'<span class="tag warn">Pendiente</span>'}</div>
        <div class="meta">${escapeHtml(g.socio_nombre||'-')} - ${fmtDate(g.fecha)}${g.notas?' - '+escapeHtml(g.notas):''}</div>
        ${g.ticket ? `<button type="button" class="link-btn meta" style="color:var(--amber); margin-top:2px;" data-action="ver-adjunto" data-url="/static/tickets/${g.id}.${g.ticket_ext||'jpg'}?v=${ticketVersion}" data-tipo="${g.ticket_ext||'jpg'}">Ver ticket o factura</button>` : ''}
      </div>
    </div>
    <div class="gasto-socio-right">
      <span class="gasto-socio-importe" style="color:${esIngreso?'var(--sage)':'var(--rust)'};">${esIngreso?'+':'-'} ${money(g.importe)}</span>
      <div class="gasto-socio-actions">
        ${can('manage_finances') ? `<button class="btn ghost small" data-action="toggle-abonado-gasto-socio" data-id="${g.id}">${g.abonado?'Marcar pendiente':'Marcar como pagado'}</button>` : ''}
        ${puedeModificar ? `<span class="ticket-upload-wrap">
          ${g.ticket ? `<button type="button" class="ticket-remove-x" data-action="delete-ticket-gasto-socio" data-id="${g.id}" title="Quitar ticket o factura">&times;</button>` : ''}
          <label class="btn ghost small" style="cursor:pointer;">${g.ticket?'Cambiar ticket o factura':'Subir ticket o factura'}<input type="file" accept="image/png,image/jpeg,application/pdf" data-autoupload-ticket="${g.id}" style="display:none;"></label>
        </span>` : ''}
        ${puedeModificar ? `<button class="btn ghost small" data-action="editar-gasto-socio" data-id="${g.id}">Editar</button>` : ''}
        ${puedeModificar ? `<button class="btn danger small" data-action="delete-gasto-socio" data-id="${g.id}">Borrar</button>` : ''}
      </div>
    </div>
  </div>`;
}
function renderMovimientoItem(m){
  const admin = can('manage_finances');
  if(admin && editandoMovimientoId===m.id){
    const categoriasMov = state.categorias_movimiento || [];
    return `<form data-form="edit-movimiento" data-id="${m.id}" class="list-item" style="display:block;">
      <div class="form-row">
        <div><label class="f">Tipo</label><select name="tipo"><option value="gasto" ${m.tipo!=='ingreso'?'selected':''}>Gasto</option><option value="ingreso" ${m.tipo==='ingreso'?'selected':''}>Ingreso</option></select></div>
        <div><label class="f">Categoría</label><select name="categoria">${categoriasMov.map(c=>`<option ${m.categoria===c.nombre?'selected':''}>${escapeHtml(c.nombre)}</option>`).join('')}</select></div>
        <div><label class="f">Fecha</label><input type="date" name="fecha" value="${m.fecha}" required></div>
      </div>
      <div class="form-row">
        <div><label class="f">Socio</label><select name="socio_id">
          <option value="">(sin socio)</option>
          ${state.socios.filter(s=>s.activo).map(s=>`<option value="${s.id}" ${m.socio_id===s.id?'selected':''}>${escapeHtml(s.nombre)}</option>`).join('')}
        </select>
        <input type="text" name="no_socio_nombre" placeholder="Nombre (opcional, si no es socio)" value="${escapeHtml(m.no_socio_nombre||'')}" style="margin-top:6px; ${m.socio_id?'display:none;':''}"></div>
        <div style="flex:2;"><label class="f">Concepto</label><input type="text" name="concepto" required value="${escapeHtml(m.concepto)}"></div>
        <div><label class="f">Importe (EUR)</label><input type="number" name="importe" step="0.01" min="0" required value="${m.importe}"></div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn small" type="submit">Guardar</button>
        <button class="btn ghost small" type="button" data-action="cancelar-editar-movimiento">Cancelar</button>
        ${m.socio_id ? `<button class="btn danger small" type="button" data-action="movimiento-no-pagado" data-id="${m.id}" title="Vuelve a la lista de gastos e ingresos de socios pendientes de verificar">Marcar como no pagado</button>` : ''}
      </div>
    </form>`;
  }
  return `<div class="list-item" data-id="${m.id}" style="flex-wrap:wrap;">
    <div>
      <div style="font-weight:600;">${escapeHtml(m.concepto)}</div>
      <div class="meta">
        <span class="tag">${m.categoria}</span>
        ${fmtDate(m.fecha)}
        ${m.socio_id ? `<span class="tag ok">Socio: ${escapeHtml(socioNombre(m.socio_id))}</span>` : (m.no_socio_nombre ? `<span class="tag">No socio: ${escapeHtml(m.no_socio_nombre)}</span>` : '')}
      </div>
      ${m.ticket ? `<button type="button" class="link-btn meta" style="color:var(--amber); margin-top:2px;" data-action="ver-adjunto" data-url="/static/tickets/mov-${m.id}.${m.ticket_ext||'jpg'}?v=${ticketVersion}" data-tipo="${m.ticket_ext||'jpg'}">Ver ticket o factura</button>` : ''}
    </div>
    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
      <span style="font-family:'JetBrains Mono',monospace; font-weight:600; color:${m.tipo==='ingreso'?'var(--sage)':'var(--rust)'};">${m.tipo==='ingreso'?'+':'-'} ${money(m.importe)}</span>
      ${admin ? `<span class="ticket-upload-wrap">
        ${m.ticket ? `<button type="button" class="ticket-remove-x" data-action="delete-ticket-movimiento" data-id="${m.id}" title="Quitar ticket o factura">&times;</button>` : ''}
        <label class="btn ghost small" style="cursor:pointer;">${m.ticket?'Cambiar ticket o factura':'Subir ticket o factura'}<input type="file" accept="image/png,image/jpeg,application/pdf" data-autoupload-ticket-mov="${m.id}" style="display:none;"></label>
      </span>` : ''}
      ${admin ? `<button class="btn ghost small" data-action="editar-movimiento" data-id="${m.id}">Editar</button>` : ''}
      ${admin ? `<button class="btn danger small" data-action="delete-movimiento" data-id="${m.id}">Borrar</button>` : ''}
    </div>
  </div>`;
}
function renderCaja(){
  const admin = can('manage_finances');
  const ordenados = [...state.movimientos].sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const gastosSocios = [...(state.gastos_socios||[])].sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const categoriasMov = state.categorias_movimiento || [];
  const gastosSociosMostrados = filtroSocioLiquidar ? gastosSocios.filter(g=>g.socio_id===filtroSocioLiquidar) : gastosSocios;
  const totalFiltroNeto = filtroSocioLiquidar
    ? gastosSociosMostrados.filter(g=>!g.abonado).reduce((acc,g)=>acc + (g.tipo==='ingreso' ? -1 : 1) * Number(g.importe||0), 0)
    : 0;
  const sociosConGastos = [];
  const vistosGasto = {};
  gastosSocios.forEach(g=>{
    if(!g.socio_id || vistosGasto[g.socio_id]) return;
    vistosGasto[g.socio_id] = true;
    sociosConGastos.push({id: g.socio_id, nombre: g.socio_nombre || socioNombre(g.socio_id)});
  });
  sociosConGastos.sort((a,b)=>a.nombre.localeCompare(b.nombre));
  const pendientesMostrados = gastosSociosMostrados.filter(g=>!g.abonado);
  const idsPendientesMostrados = pendientesMostrados.map(g=>g.id);
  const numSeleccionados = idsPendientesMostrados.filter(id=>seleccionGastosSocios.has(id)).length;
  const todosSeleccionados = idsPendientesMostrados.length>0 && numSeleccionados===idsPendientesMostrados.length;
  const sociosConMovimientos = [];
  const vistosMov = {};
  state.movimientos.forEach(m=>{
    if(!m.socio_id || vistosMov[m.socio_id]) return;
    vistosMov[m.socio_id] = true;
    sociosConMovimientos.push({id: m.socio_id, nombre: m.socio_nombre || socioNombre(m.socio_id)});
  });
  sociosConMovimientos.sort((a,b)=>a.nombre.localeCompare(b.nombre));
  const categoriasConMovimientos = [];
  const vistasCategoria = {};
  state.movimientos.forEach(m=>{
    if(!m.categoria || vistasCategoria[m.categoria]) return;
    vistasCategoria[m.categoria] = true;
    categoriasConMovimientos.push(m.categoria);
  });
  categoriasConMovimientos.sort((a,b)=>a.localeCompare(b));
  return `
  <div class="card">
    <h2><span class="pin"></span>Gastos e ingresos de socios</h2>
    <div style="margin:-6px 0 10px; display:flex; flex-direction:column; gap:8px;">
      <p class="meta" style="margin:0;">Registra aquí un gasto que hayas pagado de tu bolsillo para la peña (para que el tesorero te lo pueda abonar) o un ingreso para que quede registrado y lo pueda comprobar el tesorero.</p>
      ${gastosSocios.length ? `<button class="btn accent small" data-action="export-gastos-socios-whatsapp" style="font-family:'Work Sans'; align-self:flex-end;">Enviar por WhatsApp</button>` : ''}
    </div>
    <form data-form="add-gasto-socio">
      <div class="form-row">
        <div><label class="f">Tipo</label><select name="tipo"><option value="gasto">Gasto</option><option value="ingreso">Ingreso</option></select></div>
        <div style="flex:2;"><label class="f">Concepto</label><input type="text" name="concepto" required placeholder="Ej: Bombillas para el salón"></div>
        <div><label class="f">Importe (EUR)</label><input type="number" name="importe" step="0.01" min="0.01" required></div>
        <div><label class="f">Fecha</label><input type="date" name="fecha" value="${todayISO()}" required></div>
      </div>
      <div class="form-row"><div><label class="f">Notas</label><input type="text" name="notas" placeholder="opcional"></div></div>
      <button class="btn" type="submit">Registrar</button>
    </form>
    ${admin ? `<div class="consumos-filtro" style="margin-top:10px;">
      <select id="gastos-socios-filtro-socio">
        <option value="">Elige un socio</option>
        ${sociosConGastos.map(s=>`<option value="${s.id}" ${filtroSocioLiquidar===s.id?'selected':''}>${escapeHtml(s.nombre)}</option>`).join('')}
      </select>
      ${filtroSocioLiquidar ? `<button type="button" class="btn ghost small" data-action="limpiar-filtro-gastos-socio">Quitar filtro</button>` : ''}
    </div>` : ''}
    ${admin && idsPendientesMostrados.length>0 ? `<div class="menu-row" style="margin-top:10px; padding:8px 0; border-top:1px solid var(--line); align-items:center; flex-wrap:wrap; gap:8px;">
      <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
        <input type="checkbox" data-action="toggle-seleccion-todos-gastos-socios" ${todosSeleccionados?'checked':''}>
        <span class="meta" style="margin:0;">${numSeleccionados>0 ? `${numSeleccionados} seleccionado${numSeleccionados===1?'':'s'}` : 'Seleccionar todos los pendientes'}</span>
      </label>
      ${numSeleccionados>0 ? `<button type="button" class="btn accent small" data-action="marcar-varios-gastos-socios-pagados">Marcar seleccionados como pagados</button>` : ''}
    </div>` : ''}
    ${gastosSociosMostrados.length===0 ? `<p class="empty" style="margin-top:12px;">${filtroSocioLiquidar ? 'Este socio no tiene gastos o ingresos pendientes.' : 'Todavía no hay gastos registrados.'}</p>` : gastosSociosMostrados.map(g=>renderGastoSocioItem(g)).join('')}
    ${admin && filtroSocioLiquidar && Math.abs(totalFiltroNeto)>0.004 ? `<div class="menu-row" style="margin-top:8px; padding-top:10px; border-top:1px solid var(--line); align-items:center;">
      <span class="label"><strong>Total</strong></span><span class="dots"></span>
      <span class="value ${totalFiltroNeto>=0?'sage':'rust'}"><strong>${totalFiltroNeto>=0?'Le debemos':'Nos debe'} ${money(Math.abs(totalFiltroNeto))}</strong></span>
    </div>` : ''}
  </div>
  ${admin ? `
  <div class="card">
    <h2><span class="pin"></span>Registrar movimiento</h2>
    <form data-form="add-movimiento">
      <div class="form-row">

        <div><label class="f">Tipo</label><select name="tipo"><option value="gasto">Gasto</option><option value="ingreso">Ingreso</option></select></div>

        <div><label class="f">Categoría</label>
          <div style="display:flex; gap:6px;">
            <select name="categoria" style="flex:1;">${categoriasMov.map(c=>`<option>${escapeHtml(c.nombre)}</option>`).join('')}</select>
            <button type="button" class="btn ghost small" data-action="add-categoria-mov-inline" title="Añadir categoría nueva">+</button>
            <button type="button" class="btn ghost small" data-action="delete-categoria-mov-inline" title="Quitar la categoría seleccionada">&minus;</button>
          </div>
        </div>

        <div><label class="f">Fecha</label><input type="date" name="fecha" value="${todayISO()}" required></div>
      </div>
      <div class="form-row">

        <div><label class="f">Socio</label><select name="socio_id">

          <option value="">(sin socio)</option>

          ${state.socios.filter(s=>s.activo).map(s=>`<option value="${s.id}">${escapeHtml(s.nombre)}</option>`).join('')}

        </select>
        <input type="text" name="no_socio_nombre" placeholder="Nombre (opcional, si no es socio)" style="margin-top:6px;">
        </div>

        <div style="flex:2;"><label class="f">Concepto</label><input type="text" name="concepto" required placeholder="Ej: Factura de la luz - julio"></div>

        <div><label class="f">Importe (EUR)</label><input type="number" name="importe" step="0.01" min="0" required></div>
      </div>
      <button class="btn" type="submit">Guardar movimiento</button>
    </form>
  </div>` : `<p class="readonly-note">Solo lectura, para ver consultar con el administrador.</p>`}
  <div class="card no-collapse">
    <h2 style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <span><span class="pin"></span>Movimientos</span>
      <span style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        ${renderSelectorPeriodo('caja', cajaPeriodo, mesesDisponibles(state.movimientos.map(m=>m.fecha ? m.fecha.slice(0,7) : null)))}
        ${ordenados.length ? `<button class="btn accent small" data-action="export-movimientos-whatsapp" style="font-family:'Work Sans';">Enviar por WhatsApp</button>` : ''}
        ${can('export_data') ? `<button class="btn accent small" data-action="export-excel" style="font-family:'Work Sans';">Exportar a Excel</button>` : ''}
        <label class="btn accent small" style="cursor:pointer; font-family:'Work Sans';">Importar Excel<input type="file" accept=".xlsx" data-import-excel style="display:none;"></label>
      </span>
    </h2>
    ${sociosConMovimientos.length || categoriasConMovimientos.length ? `<div class="consumos-filtro" style="margin-bottom:10px;">
      ${sociosConMovimientos.length ? `<select id="movimientos-filtro-socio">
        <option value="">Todos los socios</option>
        ${sociosConMovimientos.map(s=>`<option value="${s.id}" ${filtroSocioMovimientos===s.id?'selected':''}>${escapeHtml(s.nombre)}</option>`).join('')}
      </select>` : ''}
      ${categoriasConMovimientos.length ? `<select id="movimientos-filtro-categoria">
        <option value="">Todas las categorías</option>
        ${categoriasConMovimientos.map(c=>`<option value="${escapeHtml(c)}" ${filtroCategoriaMovimientos===c?'selected':''}>${escapeHtml(c)}</option>`).join('')}
      </select>` : ''}
      ${filtroSocioMovimientos || filtroCategoriaMovimientos ? `<button type="button" class="btn ghost small" data-action="limpiar-filtro-movimientos-socio">Quitar filtros</button>` : ''}
    </div>` : ''}
    ${(()=>{
      let filtrados = ordenados.filter(m=>dentroDePeriodo(m.fecha, cajaPeriodo));
      if(filtroSocioMovimientos) filtrados = filtrados.filter(m=>m.socio_id===filtroSocioMovimientos);
      if(filtroCategoriaMovimientos) filtrados = filtrados.filter(m=>m.categoria===filtroCategoriaMovimientos);
      if(filtrados.length===0) return `<p class="empty">Sin movimientos ${cajaPeriodo.tipo==='todos' && !filtroSocioMovimientos && !filtroCategoriaMovimientos ?'registrados':'para ese filtro'}.</p>`;
      return filtrados.map(m=>renderMovimientoItem(m)).join('');
    })()}
  </div>`;
}

/* ============ BEBIDAS ============ */
function inventarioDeBebida(p){
  return p.inventario_id ? state.inventario.find(i=>i.id===p.inventario_id) : null;
}
function renderBebidaOption(p){
  const item = inventarioDeBebida(p);
  const sinStock = item && item.cantidad<=0;
  return `<option value="${p.id}" ${sinStock?'disabled':''}>${escapeHtml(p.nombre)}${sinStock?' (sin stock)':''}</option>`;
}
function renderInventarioLinkSelect(selectedId){
  return `<select name="inventario_id"><option value="">Sin vincular (stock ilimitado)</option>${state.inventario.map(i=>`<option value="${i.id}" ${selectedId===i.id?'selected':''}>${escapeHtml(i.nombre)} (${i.cantidad} en inventario)</option>`).join('')}</select>`;
}
function renderBebidaPrecioRow(p, puedeGestionar){
  const item = inventarioDeBebida(p);
  const sinStock = item && item.cantidad<=0;
  if(puedeGestionar && editandoBebidaPrecioId===p.id){
    return `<form data-form="edit-bebida-precio" data-id="${p.id}" class="list-item" style="display:block;">
      <div class="form-row">
        <div><label class="f">Bebida</label><input type="text" name="nombre" required value="${escapeHtml(p.nombre)}"></div>
        <div><label class="f">Unidad (opcional)</label><input type="text" name="unidad" placeholder="Por unidad consumida" value="${escapeHtml(p.unidad)}"></div>
      </div>
      <div class="form-row">
        <div><label class="f">Precio socio (EUR)</label><input type="number" step="0.01" min="0" name="precio_socio" required value="${p.precio_socio}"></div>
        <div><label class="f">Precio no socio (EUR)</label><input type="number" step="0.01" min="0" name="precio_no_socio" required value="${p.precio_no_socio}"></div>
      </div>
      <div class="form-row">
        <div><label class="f">Descontar stock de (opcional)</label>${renderInventarioLinkSelect(p.inventario_id||'')}</div>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn small" type="submit">Guardar</button>
        <button class="btn ghost small" type="button" data-action="cancelar-editar-bebida-precio">Cancelar</button>
      </div>
    </form>`;
  }
  return `
      <div class="menu-row" data-id="${p.id}">

        <span class="label">${escapeHtml(p.nombre)}<small>${escapeHtml(p.unidad || 'por unidad')} - socio ${money(p.precio_socio)} / no socio ${money(p.precio_no_socio)}${item?` - stock: ${item.cantidad}`:''}</small></span>

        <span class="dots"></span>

        ${sinStock ? '<span class="tag warn">Sin stock</span>' : ''}
        ${puedeGestionar ? `<button class="btn ghost small" data-action="editar-bebida-precio" data-id="${p.id}">Editar</button>` : ''}
        ${puedeGestionar ? `<button class="btn danger small" data-action="delete-bebida-precio" data-id="${p.id}">Borrar</button>` : ''}
      </div>`;
}

function renderTabletKiosk(me){
  const precios = state.bebidas_precios;
  const hayAlgunaConStock = precios.some(p=>{ const item = inventarioDeBebida(p); return !item || item.cantidad>0; });
  return `
  <div class="login-wrap tablet-kiosk">
    <div class="masthead" style="border:none; margin-bottom:0;">
      <div class="logo-row">${logoBadge()}<h1>${escapeHtml(state.config.nombre)}</h1></div>
    </div>
    <div style="margin-top:14px;">${me?avatarHtml(me,'lg'):''}</div>
    <p class="sub" style="margin-top:10px;">Hola, <strong>${escapeHtml(me?me.nombre:'')}</strong>. Apunta lo que te acabas de servir.</p>
    ${precios.length===0 ? '<p class="empty">Todavía no hay bebidas con precio cargadas. Pide a un administrador que las añada.</p>' : !hayAlgunaConStock ? '<p class="empty">No queda stock de ninguna bebida. Avisa para reponer el inventario.</p>' : `
    <form data-form="add-consumo" style="margin-top:16px; max-width:280px; margin-left:auto; margin-right:auto; text-align:left;">
      <label class="f">Bebida</label>
      <select name="bebida_id" style="width:100%; margin-bottom:10px;">${precios.map(p=>renderBebidaOption(p)).join('')}</select>
      <label class="f">Cantidad</label>
      <input type="number" name="cantidad" value="1" min="1" style="width:100%; box-sizing:border-box; margin-bottom:10px;">
      <div id="consumo-total" class="meta" style="margin:0 0 14px; font-weight:600; font-size:1rem; color:var(--amber); text-align:center;">Total: ${money(precios.length ? Number(precios[0].precio_socio) : 0)}</div>
      <button class="btn" type="submit" style="width:100%;">Apuntar mi consumo</button>
    </form>`}
    <button class="btn ghost small" data-action="logout" style="margin-top:16px;">Cerrar sesión</button>
  </div>`;
}
async function tabletConfirmarYSalir(detalle){
  const app = document.getElementById('app');
  app.innerHTML = `
  <div class="login-wrap tablet-kiosk">
    <div class="masthead" style="border:none; margin-bottom:0;">${logoBadge()}</div>
    <p class="sub" style="margin-top:18px; font-size:1.15rem;">Apuntado: <strong>${escapeHtml(detalle)}</strong></p>
    <p class="meta">Cerrando sesión...</p>
  </div>`;
  await new Promise(resolve=>setTimeout(resolve, 1800));
  try{ await apiPost('/api/logout'); }catch(e){ /* seguimos igualmente a la pantalla de login */ }
  pendingLoginId = null;
  await loadState();
  render();
}

function renderBebidas(){
  return `
  <div class="subtabs" style="justify-content:flex-end; flex-wrap:wrap;">
    <span style="display:flex; gap:8px; flex-wrap:wrap;">
      ${can('export_data') ? `<button class="btn accent small" data-action="export-excel" style="font-family:'Work Sans';">Exportar a Excel</button>` : ''}
      <label class="btn accent small" style="cursor:pointer; font-family:'Work Sans';">Importar Excel<input type="file" accept=".xlsx" data-import-excel style="display:none;"></label>
    </span>
  </div>
  ${renderBebidasConsumo()}
  `;
}

function renderBebidasConsumo(){
  const puedeGestionarBebidas = can('manage_bebidas');
  const precios = state.bebidas_precios;
  const consumos = [...state.bebidas_consumos].sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const misPendientes = misBebidasPendientes();
  const misPendientesPorMes = misBebidasPendientesPorMes();
  const sinFiltro = consumosPeriodo.tipo==='todos' && !consumosFiltroSocio;
  const mesesConsumos = mesesDisponibles(state.bebidas_consumos.map(c=>c.fecha ? c.fecha.slice(0,7) : null));
  const opcionesConsumidores = consumidoresDisponibles(consumos);
  const consumosFiltradosList = consumosFiltrados(consumos);
  const consumosMostrados = sinFiltro ? consumosFiltradosList.slice(0,40) : consumosFiltradosList;
  const totalPagadoFiltrado = consumosFiltradosList.filter(c=>c.pagado).reduce((a,c)=>a+Number(c.importe||0),0);
  const totalPendienteFiltrado = consumosFiltradosList.filter(c=>!c.pagado).reduce((a,c)=>a+Number(c.importe||0),0);
  return `
  ${puedeGestionarBebidas ? `
  <div class="card">
    <h2><span class="pin"></span>Precios</h2>
    <form data-form="add-bebida-precio">
      <div class="form-row">

        <div><label class="f">Bebida</label><input type="text" name="nombre" required placeholder="Ej: Caña, agua, refresco"></div>

        <div><label class="f">Unidad (opcional)</label><input type="text" name="unidad" placeholder="Por unidad consumida"></div>
      </div>
      <div class="form-row">

        <div><label class="f">Precio socio (EUR)</label><input type="number" step="0.01" min="0" name="precio_socio" required></div>

        <div><label class="f">Precio no socio (EUR)</label><input type="number" step="0.01" min="0" name="precio_no_socio" required></div>
      </div>
      <div class="form-row">
        <div><label class="f">Descontar stock de (opcional)</label>${renderInventarioLinkSelect('')}</div>
      </div>
      <p class="readonly-note" style="margin:0 0 10px;">Si la vinculas a un artículo del inventario, cada consumo registrado le restará stock automáticamente y avisará cuando se agote.</p>
      <button class="btn" type="submit">Añadir precio</button>
    </form>
    ${precios.length ? precios.map(p=>renderBebidaPrecioRow(p, true)).join('') : '<p class="empty">Añade al menos una bebida con precio.</p>'}
  </div>` : `
  <div class="card">
    <h2><span class="pin"></span>Precios</h2>
    ${precios.length ? precios.map(p=>renderBebidaPrecioRow(p, false)).join('') : '<p class="empty">Todavía no hay precios cargados.</p>'}
    <p class="readonly-note" style="margin-top:10px;">Solo lectura: el administrador o el tesorero son quienes añaden precios nuevos.</p>
  </div>`}
  <div class="card">
    <h2><span class="pin"></span>${puedeGestionarBebidas ? 'Registrar consumo' : 'Registrar mi consumo'}</h2>
    ${precios.length===0 ? '<p class="empty">Primero añade precios de bebidas arriba.</p>' : `
    <form data-form="add-consumo">
      ${puedeGestionarBebidas ? `
      <div class="form-row">

        <div><label class="f">¿Quién consume?</label>

          <select name="consumidorTipo">

            <option value="socio">Socio</option>

            <option value="invitado">Invitado / no socio</option>

          </select>

        </div>

        <div><label class="f">Nombre</label>

          <select name="socio_id" required><option value="" selected>Elige un socio...</option>${state.socios.filter(s=>s.activo).map(s=>`<option value="${s.id}">${escapeHtml(s.nombre)}</option>`).join('')}</select>

          <input type="text" name="nombre_invitado" placeholder="Nombre del invitado" style="display:none; margin-top:6px;">

        </div>
      </div>` : ''}
      <div class="form-row">

        <div><label class="f">Bebida</label><select name="bebida_id">${precios.map(p=>renderBebidaOption(p)).join('')}</select></div>

        <div><label class="f">Cantidad</label><input type="number" name="cantidad" value="1" min="1"></div>
      </div>
      <div id="consumo-total" class="meta" style="margin:2px 0 6px; font-weight:600; font-size:0.95rem; color:var(--amber);">Total: ${money(precios.length ? Number(precios[0].precio_socio) : 0)}</div>
      <p class="readonly-note" style="margin:0 0 10px;">Se suma a ${puedeGestionarBebidas ? 'la deuda del socio' : 'tu deuda'}: todo el consumo se paga por transferencia junto con la cuota, del 1 al 5 de cada mes.</p>
      <button class="btn" type="submit">${puedeGestionarBebidas ? 'Registrar consumo' : 'Registrar mi consumo'}</button>
    </form>
    `}
  </div>
  ${misPendientes.length ? `
  <div class="card">
    <h2><span class="pin"></span>Mi deuda de bebidas pendiente</h2>
    <p class="readonly-note" style="margin:0 0 10px;">Se paga por transferencia junto con la cuota, del 1 al 5 de cada mes.</p>
    ${misPendientesPorMes.map(g=>`
      <div class="menu-row" style="margin-top:10px;"><span class="label"><strong>${labelMes(g.mes)}</strong></span><span class="dots"></span><span class="value rust"><strong>${money(g.total)}</strong></span></div>
      ${g.items.map(c=>editandoConsumoId===c.id ? `
        <form data-form="edit-consumo" data-id="${c.id}" class="menu-row" style="padding-left:12px; align-items:center; gap:8px;">
          <span class="label">${escapeHtml(c.bebida_nombre||'Bebida')}</span>
          <input type="number" name="cantidad" min="1" value="${c.cantidad}" style="width:64px;">
          <button class="btn ghost small" type="submit">Guardar</button>
          <button class="btn ghost small" type="button" data-action="cancelar-edit-consumo">Cancelar</button>
        </form>
      ` : `<div class="menu-row" style="padding-left:12px; align-items:center;"><span class="label">${escapeHtml(c.bebida_nombre||'Bebida')}<small>${c.cantidad} x - ${fmtDate(c.fecha)}</small></span><span class="dots"></span><span class="value rust">${money(c.importe)}</span><button class="btn ghost small" data-action="toggle-consumo-pagado" data-id="${c.id}">Marcar pagado</button><button class="btn ghost small" data-action="editar-consumo" data-id="${c.id}">Editar</button><button class="btn danger small" data-action="delete-consumo" data-id="${c.id}">Borrar</button></div>`).join('')}
    `).join('')}
    <div class="menu-row" style="border-top:1px solid var(--line); margin-top:8px; padding-top:8px;"><span class="label"><strong>Total pendiente</strong></span><span class="dots"></span><span class="value rust"><strong>${money(misPendientes.reduce((a,c)=>a+Number(c.importe||0),0))}</strong></span></div>
  </div>` : ''}
  <div class="card">
    <h2 style="display:flex; align-items:center; flex-wrap:wrap; gap:8px;">
      <span><span class="pin"></span>Últimos consumos</span> <span style="font-size:0.85rem; color:var(--chalk-dim); font-family:'Work Sans';">- pagado: ${money(totalPagadoFiltrado)} - pendiente: ${money(totalPendienteFiltrado)}</span>
      <button class="btn accent small" data-action="export-bebidas-whatsapp" style="font-family:'Work Sans'; margin-left:auto;">Enviar por WhatsApp</button>
    </h2>
    <div class="consumos-filtro">
      ${renderSelectorPeriodo('consumos', consumosPeriodo, mesesConsumos)}
      <select id="consumos-filtro-socio">
        <option value="">Elige un consumidor</option>
        ${opcionesConsumidores.map(o=>`<option value="${o.valor}" ${consumosFiltroSocio===o.valor?'selected':''}>${escapeHtml(o.nombre)}${o.esSocio?'':' (invitado)'}</option>`).join('')}
      </select>
      ${!sinFiltro ? `<button type="button" class="btn ghost small" data-action="limpiar-filtro-consumos">Quitar filtro</button>` : ''}
    </div>
    ${consumosMostrados.length===0 ? `<p class="empty">${sinFiltro ? 'Sin consumos todavía.' : 'Sin consumos en ese período.'}</p>` : consumosMostrados.map(c=>{
      const nombreBebida = c.bebida_nombre || '-';
      return `<div class="list-item">

        <div>

          <div style="font-weight:600;">${escapeHtml(c.consumidor)} ${c.es_socio?'':'<span class="tag">invitado</span>'} ${c.pagado?'<span class="tag ok">pagado</span>':'<span class="tag warn">pendiente</span>'}</div>

          <div class="meta">${c.cantidad} x ${escapeHtml(nombreBebida)} - ${fmtDate(c.fecha)}</div>

        </div>

        <div style="display:flex; align-items:center; gap:10px;">

          <span style="font-family:'JetBrains Mono',monospace; color:${c.pagado?'var(--sage)':'var(--rust)'}; font-weight:600;">${c.pagado?'+':''} ${money(c.importe)}</span>

          ${puedeGestionarBebidas ? `<button class="btn ghost small" data-action="toggle-consumo-pagado" data-id="${c.id}">${c.pagado?'Marcar pendiente':'Marcar pagado'}</button>` : ''}

          ${puedeGestionarBebidas ? `<button class="btn danger small" data-action="delete-consumo" data-id="${c.id}">Borrar</button>` : ''}

        </div>
      </div>`;
    }).join('')}
  </div>`;
}

/* ============ TAREAS ============ */
const ESTADO_LABELS = {pendiente:'Pendiente', en_curso:'En curso', hecho:'Hecho'};
const ESTADO_CLASS = {pendiente:'warn', en_curso:'', hecho:'ok'};
const ROTACION_OPCIONES = ['', 'Semanal', 'Quincenal', 'Mensual'];
let tareasCalFecha = new Date();

function renderMiniCalendario(fechaRef, items, navAction){
  const year = fechaRef.getFullYear();
  const month = fechaRef.getMonth();
  const totalDias = new Date(year, month+1, 0).getDate();
  const offset = (new Date(year, month, 1).getDay()+6)%7;

  const porDia = {};
  items.forEach(it=>{
    if(!it.fecha) return;
    const partes = it.fecha.split('-').map(Number);
    if(partes[0]===year && (partes[1]-1)===month){
      (porDia[partes[2]] = porDia[partes[2]]||[]).push(it);
    }
  });

  const celdas = [];
  for(let i=0;i<offset;i++) celdas.push('<div class="cal-day cal-day-empty"></div>');
  for(let d=1; d<=totalDias; d++){
    const dia = porDia[d]||[];
    let ticket = '';
    if(dia.length===1){
      const it = dia[0];
      ticket = `<button type="button" class="cal-ticket ${it.cls||''}" data-action="ver-evento-cal" data-detalle="${escapeHtml(it.detalle||it.label)}" title="${escapeHtml(it.label)}">${escapeHtml(it.label)}</button>`;
    } else if(dia.length>1){
      const clases = new Set(dia.map(it=>it.cls).filter(Boolean));
      const cls = clases.size===1 ? [...clases][0] : '';
      const detalle = dia.map(it=>it.detalle||it.label).join('\n\n———\n\n');
      ticket = `<button type="button" class="cal-ticket ${cls}" data-action="ver-evento-cal" data-detalle="${escapeHtml(detalle)}" title="${dia.length} eventos este día">${dia.length} eventos</button>`;
    }
    celdas.push(`<div class="cal-day">
      <div class="cal-day-num">${d}</div>
      ${ticket}
    </div>`);
  }

  return `
  <div class="year-nav">
    <button data-action="${navAction}" data-dir="-1">&larr; anterior</button>
    <b>${MESES[month]} ${year}</b>
    <button data-action="${navAction}" data-dir="1">siguiente &rarr;</button>
  </div>
  <div class="cal-grid">
    ${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>`<div class="cal-weekday">${d}</div>`).join('')}
    ${celdas.join('')}
  </div>`;
}

function renderNuevaTareaSociosWrap(){
  const disponibles = state.socios.filter(s=>s.activo && !nuevaTareaSocios.includes(s.id));
  return `
    <div class="role-options" style="margin-bottom:8px;">
      ${nuevaTareaSocios.map(sid=>`<span class="role-option">${escapeHtml(socioNombre(sid))}<input type="hidden" name="socios" value="${sid}"><button type="button" data-action="quitar-socio-nueva-tarea" data-socio="${sid}" title="Quitar" style="background:none; border:none; color:var(--chalk-dim); padding:0; margin-left:2px;">x</button></span>`).join('')}
    </div>
    ${disponibles.length ? `<div class="form-row" style="align-items:flex-end; margin-bottom:0;">
      <div><select id="nueva-tarea-socio-select"><option value="" selected>Elige un socio...</option>${disponibles.map(s=>`<option value="${s.id}">${escapeHtml(s.nombre)}</option>`).join('')}</select></div>
      <div style="flex:none;"><button type="button" class="btn ghost small" data-action="anadir-socio-nueva-tarea">+</button></div>
    </div>` : ''}
  `;
}

function renderEncargados(){
  const tareas = state.tareas_tickets || [];
  const activas = tareas.filter(t=>t.estado!=='hecho');
  const historialTodas = [...tareas.filter(t=>t.estado==='hecho')].sort((a,b)=>(b.completado_en||'').localeCompare(a.completado_en||''));
  const mesesHistorial = mesesDisponibles(historialTodas.map(t=>t.completado_en ? t.completado_en.slice(0,7) : null));
  const historial = historialTodas.filter(t=>dentroDePeriodo(t.completado_en ? t.completado_en.slice(0,10) : '', tareasHistorialPeriodo));
  const calItems = activas.filter(t=>t.fecha).map(t=>({fecha:t.fecha, label:t.tipo+((t.socios_ids&&t.socios_ids.length)?': '+t.socios_ids.map(socioNombre).join(', '):''), cls:ESTADO_CLASS[t.estado], detalle:`${t.tipo}\n${fmtDate(t.fecha)}\n${(t.socios_ids&&t.socios_ids.length)?'Quién la hace: '+t.socios_ids.map(socioNombre).join(', '):'Sin asignar'}\nEstado: ${t.estado}${t.notas?'\n'+t.notas:''}`}));
  return `
  <div class="card">
    <h2><span class="pin"></span>Nueva tarea</h2>
    <form data-form="add-tarea-ticket">
      <div class="form-row">
        <div><label class="f">Tipo</label><input type="text" name="tipo" list="tareas-tipos-list" required placeholder="Ej: Compras, Limpieza..."></div>
        <div><label class="f">Fecha (opcional)</label><input type="date" name="fecha"></div>
        <div><label class="f">Rotación</label><select name="rotacion">${ROTACION_OPCIONES.map(r=>`<option value="${r}">${r||'Ninguna'}</option>`).join('')}</select></div>
      </div>
      <div class="form-row"><div><label class="f">Notas</label><input type="text" name="notas" placeholder="opcional"></div></div>
      <div style="margin-bottom:12px;">
        <label class="f">¿Quién la hace?</label>
        <div id="nueva-tarea-socios-wrap">${renderNuevaTareaSociosWrap()}</div>
      </div>
      <datalist id="tareas-tipos-list">${state.tareas_fijas.map(t=>`<option value="${escapeHtml(t)}">`).join('')}</datalist>
      <button class="btn" type="submit">Crear tarea</button>
    </form>
  </div>
  <div class="card">
    <h2 style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <span><span class="pin"></span>Tareas activas</span>
      ${activas.length ? `<button class="btn accent small" data-action="export-tareas-whatsapp" style="font-family:'Work Sans';">Enviar por WhatsApp</button>` : ''}
    </h2>
    ${activas.length===0 ? '<p class="empty">No hay tareas activas.</p>' : activas.map(t=>renderTicketRow(t)).join('')}
  </div>
  <div class="card">
    <h2><span class="pin"></span>Calendario de tareas</h2>
    ${renderMiniCalendario(tareasCalFecha, calItems, 'tareas-mes')}
  </div>
  ${historialTodas.length ? `<div class="card">
    <h2 style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <span><span class="pin"></span>Historial de tareas completadas</span>
      ${renderSelectorPeriodo('tareas-historial', tareasHistorialPeriodo, mesesHistorial)}
    </h2>
    ${historial.length===0 ? '<p class="empty">No hay tareas completadas en ese período.</p>' : historial.map(t=>renderTicketRow(t)).join('')}
  </div>` : ''}
  `;
}

function renderTicketRow(t){
  const estadoLabel = ESTADO_LABELS[t.estado]||t.estado;
  const estadoClass = ESTADO_CLASS[t.estado]||'';
  const asignados = t.socios_ids||[];
  const disponibles = state.socios.filter(s=>s.activo && !asignados.includes(s.id));
  const yoAsignado = asignados.includes(state.current_user);
  if(editandoTareaId===t.id){
    return `<form data-form="edit-tarea-ticket" data-id="${t.id}" class="list-item" style="display:block;">
      <div class="form-row">
        <div><label class="f">Tipo</label><input type="text" name="tipo" list="tareas-tipos-list" required value="${escapeHtml(t.tipo)}"></div>
        <div><label class="f">Fecha (opcional)</label><input type="date" name="fecha" value="${t.fecha||''}"></div>
        <div><label class="f">Rotación</label><select name="rotacion">${ROTACION_OPCIONES.map(r=>`<option value="${r}" ${t.rotacion===r?'selected':''}>${r||'Ninguna'}</option>`).join('')}</select></div>
      </div>
      <div class="form-row"><div><label class="f">Notas</label><input type="text" name="notas" value="${escapeHtml(t.notas||'')}" placeholder="opcional"></div></div>
      <div style="display:flex; gap:8px;">
        <button class="btn small" type="submit">Guardar</button>
        <button class="btn ghost small" type="button" data-action="cancelar-editar-tarea">Cancelar</button>
      </div>
    </form>`;
  }
  return `<div class="list-item" data-id="${t.id}" style="display:block;">
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
      <div>
        <div style="font-weight:600; overflow-wrap:anywhere;">${escapeHtml(t.tipo)} <span class="tag ${estadoClass}">${estadoLabel}</span>${t.rotacion?`<span class="tag">rotación: ${escapeHtml(t.rotacion)}</span>`:''}</div>
        <div class="meta">${t.fecha?fmtDate(t.fecha):''}${t.completado_en?' - completada el '+fmtDate(t.completado_en.slice(0,10)):''}</div>
        ${t.notas?`<div class="meta" style="margin-top:2px; overflow-wrap:anywhere;">${escapeHtml(t.notas)}</div>`:''}
      </div>
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        ${!yoAsignado ? `<button class="btn ghost small" data-action="asignarme-ticket" data-id="${t.id}">+ Apuntarme</button>` : ''}
        <select data-estado-tarea="${t.id}">${Object.keys(ESTADO_LABELS).map(k=>`<option value="${k}" ${k===t.estado?'selected':''}>${ESTADO_LABELS[k]}</option>`).join('')}</select>
        <button class="btn ghost small" data-action="editar-tarea" data-id="${t.id}">Editar</button>
        <button class="btn danger small" data-action="delete-tarea-ticket" data-id="${t.id}">Borrar</button>
      </div>
    </div>
    <div style="margin-top:8px;">
      <label class="f">¿Quién la hace?</label>
      <div class="role-options" style="margin-bottom:6px;">
        ${asignados.length ? asignados.map(sid=>`<span class="role-option">${escapeHtml(socioNombre(sid))}<button type="button" data-action="quitar-socio-tarea" data-id="${t.id}" data-socio="${sid}" title="Quitar" style="background:none; border:none; color:var(--chalk-dim); padding:0; margin-left:2px;">x</button></span>`).join('') : '<span class="empty">Sin asignar</span>'}
      </div>
      ${disponibles.length ? `<div class="form-row" style="align-items:flex-end; margin-bottom:0;">
        <div><select data-nuevo-socio-tarea="${t.id}"><option value="" selected>Elige un socio...</option>${disponibles.map(s=>`<option value="${s.id}">${escapeHtml(s.nombre)}</option>`).join('')}</select></div>
        <div style="flex:none;"><button type="button" class="btn ghost small" data-action="anadir-socio-tarea" data-id="${t.id}">+ Añadir</button></div>
      </div>` : ''}
    </div>
  </div>`;
}

/* ============ PERFIL ============ */
function renderPerfil(){
  if(viendoSocioId && viendoSocioId!==state.current_user) return renderPerfilSocio(viendoSocioId);
  const me = state.socios.find(s=>s.id===state.current_user) || {nombre:''};
  const perfil = state.perfiles[state.current_user] || {telefono:'', notas:'', familia:[]};
  const familia = perfil.familia || [];
  return `
  <div class="card no-collapse">
    <h2><span class="pin"></span>Mis datos</h2>
    <div class="foto-upload-row">
      ${avatarHtml(me,'lg','edit')}
      <div>

        <label class="btn ghost small" style="cursor:pointer;">Cambiar foto<input type="file" accept="image/*" data-autoupload-foto="${state.current_user}" style="display:none;"></label>
      </div>
    </div>
    <form data-form="save-perfil">
      <div class="form-row">
        
        <div><label class="f">Mi nombre</label><input type="text" name="nombre" value="${escapeHtml(me.nombre||'')}" required></div>
        
        <div><label class="f">Teléfono</label><input type="tel" name="telefono" value="${escapeHtml(perfil.telefono||'')}" placeholder="600 000 000"></div>
      </div>
      <div class="form-row"><div><label class="f">Notas (alergias, preferencias, lo que quieras)</label><textarea name="notas" placeholder="Ej: alérgico a los frutos secos">${escapeHtml(perfil.notas||'')}</textarea></div></div>
      <button class="btn" type="submit">Guardar mis datos</button>
    </form>
  </div>
  <div class="card">
    <h2><span class="pin"></span>Seguridad</h2>
    <form data-form="change-pin" class="form-row" style="align-items:flex-end;">
      <div><label class="f">Nuevo PIN (4 dígitos)</label><input type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" name="pin" required placeholder="****"></div>
      <div><label class="f">Repite el PIN</label><input type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" name="pin2" required placeholder="****"></div>
      <div style="flex:none;"><button class="btn ghost" type="submit">Cambiar mi PIN</button></div>
    </form>
  </div>
  <div class="card">
    <h2><span class="pin"></span>Mi familia</h2>
    ${familia.length===0 ? '<p class="empty">Aún no has añadido a nadie.</p>' : familia.map(f=>`
      <div class="familia-item">

        <span>${escapeHtml(f.nombre)} <span class="tag">${f.tipo}</span> ${f.edad?'- '+escapeHtml(String(f.edad))+' años':''}</span>
        
        <button class="btn danger small" data-action="delete-familiar" data-id="${f.id}">Borrar</button>
      </div>
    `).join('')}
    <form data-form="add-familiar" style="margin-top:14px;">
      <div class="form-row">
        
        <div><label class="f">Nombre</label><input type="text" name="nombre" required></div>
        
        <div><label class="f">Relación</label><select name="tipo">${TIPO_FAMILIA.map(t=>`<option>${t}</option>`).join('')}</select></div>

        <div><label class="f">Edad</label><input type="number" name="edad" min="0"></div>
      </div>
      <button class="btn ghost" type="submit">+ Añadir familiar</button>
    </form>
  </div>
  <div class="card">
    <h2><span class="pin"></span>Otros socios</h2>
    ${state.socios.filter(s=>s.id!==state.current_user).map(s=>{
      const p = state.perfiles[s.id]||{};
      const fam = p.familia||[];
      return `<div class="list-item" data-action="ver-socio" data-id="${s.id}" style="cursor:pointer;" title="Ver perfil de ${escapeHtml(s.nombre)}"><div>

        <div style="font-weight:600;">${escapeHtml(s.nombre)}</div>

        <div class="meta">${p.telefono?'Tel: '+escapeHtml(p.telefono):'Sin teléfono'} ${fam.length?'- '+fam.map(f=>escapeHtml(f.nombre)).join(', '):''}</div>
      </div></div>`;
    }).join('') || '<p class="empty">No hay más socios.</p>'}
  </div>
  `;
}
function renderPerfilSocio(sid){
  const s = state.socios.find(x=>x.id===sid);
  if(!s){
    viendoSocioId = null;
    return renderPerfil();
  }
  const perfil = state.perfiles[sid] || {telefono:'', notas:'', familia:[]};
  const familia = perfil.familia || [];
  return `
  <div class="card">
    <button class="btn ghost small" data-action="volver-mi-perfil" style="margin-bottom:14px;">&laquo; Volver a mi perfil</button>
    <div class="foto-upload-row">
      ${avatarHtml(s,'lg','view')}
      <div>
        <div style="font-weight:600;">${escapeHtml(s.nombre)} ${roleNames(s).map(rn=>`<span class="tag">${escapeHtml(rn)}</span>`).join('')}${!s.activo?'<span class="tag warn">de baja</span>':''}</div>
        <p class="meta" style="margin-top:6px;">${perfil.telefono ? 'Teléfono: '+escapeHtml(perfil.telefono) : 'Sin teléfono'}</p>
      </div>
    </div>
    ${perfil.notas ? `<p class="meta" style="margin-top:10px;"><b>Notas:</b> ${linkify(perfil.notas)}</p>` : ''}
  </div>
  <div class="card">
    <h2><span class="pin"></span>Familia de ${escapeHtml(s.nombre)}</h2>
    ${familia.length===0 ? '<p class="empty">No ha añadido a nadie.</p>' : familia.map(f=>`
      <div class="familia-item"><span>${escapeHtml(f.nombre)} <span class="tag">${f.tipo}</span> ${f.edad?'- '+escapeHtml(String(f.edad))+' años':''}</span></div>
    `).join('')}
  </div>
  <p class="readonly-note">Solo lectura: para cambiar estos datos tiene que hacerlo ${escapeHtml(s.nombre)} desde su propio "Mi perfil".</p>
  `;
}

/* ============ CHAT ============ */
function renderChatPanel(){
  if(!chatAbierto) return '';
  return `<div class="bell-backdrop" data-action="cerrar-chat"></div>
  <div class="chat-dropdown">
    <div class="chat-dropdown-header">
      <b>Chat de socios</b>
      <button class="help-close" data-action="cerrar-chat" title="Cerrar">&times;</button>
    </div>
    <div class="chat-messages" id="chat-messages">
      ${chatMensajes.length===0 ? '<p class="empty">Todavía no hay mensajes. ¡Escribe el primero!</p>' : chatMensajes.map(renderChatMsg).join('')}
    </div>
    <div class="chat-compose-wrap">
      ${emojiPickerAbierto ? renderEmojiPicker() : ''}
      <form id="chat-compose-form" data-form="send-chat" class="chat-compose">
        ${chatArchivoSeleccionado ? `<div class="chat-attach-preview">
          <span class="chat-attach-name">📎 ${escapeHtml(chatArchivoSeleccionado.name)}</span>
          <button type="button" class="chat-attach-remove" data-action="quitar-adjunto-chat" title="Quitar adjunto">&times;</button>
        </div>` : ''}
        <textarea id="chat-input" name="texto" placeholder="Escribe un mensaje..." rows="1" maxlength="2000"></textarea>
        <div class="chat-compose-row">
          <button type="button" class="chat-tool-btn" data-action="toggle-emoji-picker" title="Emoticonos">${toolIcon(SMILE_ICON_PATH)}</button>
          <button type="button" class="chat-tool-btn" data-action="chat-attach-click" title="Adjuntar archivo">${toolIcon(PAPERCLIP_ICON_PATH)}</button>
          <span class="chat-compose-spacer"></span>
          <button type="submit" class="btn">Enviar</button>
        </div>
      </form>
    </div>
  </div>
  <input type="file" id="chat-file-input" accept="image/*,.pdf" style="display:none;">`;
}
function renderEmojiPicker(){
  return `<div class="emoji-picker-backdrop" data-action="cerrar-emoji"></div>
  <div class="emoji-picker">
    ${EMOJIS_CHAT.map(em=>`<button type="button" class="emoji-btn" data-action="insertar-emoji" data-emoji="${em}">${em}</button>`).join('')}
  </div>`;
}
function renderChatMsg(m){
  const mine = state && m.socio_id===state.current_user;
  const url = m.archivo ? `/static/chat/${m.id}.${m.archivo_ext||'jpg'}?v=${ticketVersion}` : null;
  const adjunto = !m.archivo ? '' : (m.archivo_ext==='pdf'
    ? `<button type="button" class="link-btn chat-attach-link" data-action="ver-adjunto" data-url="${url}" data-tipo="pdf">📄 Ver PDF adjunto</button>`
    : `<button type="button" class="chat-msg-img-btn" data-action="ver-adjunto" data-url="${url}" data-tipo="jpg"><img src="${url}" class="chat-msg-img" alt="Adjunto"></button>`);
  const editando = mine && String(editandoMensajeId)===String(m.id);
  const cuerpo = editando
    ? `<form data-form="edit-chat-msg" data-id="${m.id}" class="chat-edit-form">
        <textarea name="texto" class="chat-edit-textarea" maxlength="2000">${escapeHtml(m.texto)}</textarea>
        <div class="chat-edit-actions">
          <button type="button" class="btn ghost small" data-action="cancelar-editar-chat">Cancelar</button>
          <button type="submit" class="btn small">Guardar</button>
        </div>
      </form>`
    : (m.texto ? `<div class="chat-msg-text">${linkify(m.texto)}</div>` : '');
  return `<div class="chat-msg ${mine?'mine':'theirs'}" data-id="${m.id}">
    ${!mine ? `<div class="chat-msg-autor" style="color:${chatNombreColor(m.socio_id)};">${escapeHtml(m.socio_nombre||'-')}</div>` : ''}
    <div class="chat-msg-bubble">
      ${adjunto}
      ${cuerpo}
      ${editando ? '' : `<div class="chat-msg-meta">${fmtHoraCorta(m.creado_en)}${m.editado?' <span class="chat-msg-edited">(editado)</span>':''}${mine?` <button type="button" class="chat-msg-edit" data-action="editar-chat-msg" data-id="${m.id}" title="Editar mensaje">${miniIcon(PENCIL_ICON_PATH)}</button> <button type="button" class="chat-msg-del" data-action="delete-chat-msg" data-id="${m.id}" title="Borrar mensaje">&times;</button>`:''}</div>`}
    </div>
  </div>`;
}

/* ============ EVENTOS: clicks ============ */
// El evento "toggle" de <details> no burbujea: se escucha en fase de
// captura para recordar qué desplegables de asistentes/acta de reuniones
// dejó el usuario abiertos y que no se cierren solos al re-renderizar.
document.addEventListener('toggle', (e)=>{
  const el = e.target;
  if(el.dataset && el.dataset.asistenciaDetails){
    reunionesAsistenciaAbierta[el.dataset.asistenciaDetails] = el.open;
  } else if(el.dataset && el.dataset.actaDetails){
    reunionesActaAbierta[el.dataset.actaDetails] = el.open;
  }
}, true);

document.addEventListener('click', async (e)=>{
  const btn = e.target.closest('[data-action]');
  if(!btn) return;
  const action = btn.dataset.action;

  try{
    if(action==='select-user'){
      pendingLoginId = btn.dataset.id;
      render();
    }
    else if(action==='cancel-pin-login'){
      clearFavoriteUser();
      pendingLoginId = null;
      render();
    }
    else if(action==='logout'){ await apiPost('/api/logout'); pendingLoginId = null; loginSearchQuery = ''; alertasAbiertas = false; viendoSocioId = null; stopChatPolling(); await loadState(); render(); }
    else if(action==='ver-socio'){ viendoSocioId = btn.dataset.id; activeTab = 'perfil'; render(); }
    else if(action==='volver-mi-perfil'){ viendoSocioId = null; render(); }
    else if(action==='edit-club-name'){
      const nombre = prompt('Nombre de la peña:', state.config.nombre);
      if(nombre && nombre.trim()){

        await apiPost('/api/config', {nombre: nombre.trim(), cuota_mensual: state.config.cuota_mensual ?? 45, numero_cuenta: state.config.numero_cuenta || ''});

        await loadState(); render();
      }
    }
    else if(action==='edit-cuota'){
      const cuotaInput = prompt('Cuota mensual (EUR):', String(state.config.cuota_mensual ?? 45));
      if(cuotaInput !== null){

        const cuotaValue = Number(cuotaInput);

        await apiPost('/api/config', {

          nombre: state.config.nombre,

          cuota_mensual: Number.isFinite(cuotaValue) ? cuotaValue : (state.config.cuota_mensual ?? 45),

          numero_cuenta: state.config.numero_cuenta || ''

        });

        await loadState(); render();
      }
    }
    else if(action==='edit-cuenta'){
      const cuentaInput = prompt('Número de cuenta para pagos (IBAN):', state.config.numero_cuenta || '');
      if(cuentaInput !== null){
        await apiPost('/api/config', {
          nombre: state.config.nombre,
          cuota_mensual: state.config.cuota_mensual ?? 45,
          numero_cuenta: cuentaInput.trim(),
        });
        await loadState(); render();
      }
    }
    else if(action==='switch-tab'){ activeTab = btn.dataset.tab; viendoSocioId = null; render(); }
    else if(action==='toggle-chat'){
      chatAbierto = !chatAbierto;
      if(chatAbierto) alertasAbiertas = false;
      render();
      if(chatAbierto){
        if(chatMensajes.length===0){ await loadChatInicial(); render(); }
        chatIrAlFinalYMarcar();
      }
    }
    else if(action==='cerrar-chat'){ chatAbierto = false; emojiPickerAbierto = false; render(); }
    else if(action==='delete-chat-msg'){
      if(!confirm('¿Borrar este mensaje?')) return;
      await apiDelete(`/api/chat/${btn.dataset.id}`);
      chatMensajes = chatMensajes.filter(m=>String(m.id)!==String(btn.dataset.id));
      const el = document.querySelector(`.chat-msg[data-id="${btn.dataset.id}"]`);
      if(el) el.remove();
    }
    else if(action==='editar-chat-msg'){
      editandoMensajeId = btn.dataset.id;
      rerenderChatMsg(btn.dataset.id);
      const ta = document.querySelector(`.chat-msg[data-id="${btn.dataset.id}"] .chat-edit-textarea`);
      if(ta){ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    }
    else if(action==='cancelar-editar-chat'){
      const id = editandoMensajeId;
      editandoMensajeId = null;
      if(id) rerenderChatMsg(id);
    }
    else if(action==='toggle-emoji-picker'){ emojiPickerAbierto = !emojiPickerAbierto; render(); }
    else if(action==='cerrar-emoji'){ emojiPickerAbierto = false; render(); }
    else if(action==='insertar-emoji'){
      const ta = document.getElementById('chat-input');
      const emoji = btn.dataset.emoji;
      if(ta){
        const start = ta.selectionStart ?? ta.value.length;
        const end = ta.selectionEnd ?? ta.value.length;
        ta.value = ta.value.slice(0, start) + emoji + ta.value.slice(end);
        const pos = start + emoji.length;
        ta.focus();
        ta.setSelectionRange(pos, pos);
      }
    }
    else if(action==='chat-attach-click'){
      const input = document.getElementById('chat-file-input');
      if(input) input.click();
    }
    else if(action==='quitar-adjunto-chat'){
      chatArchivoSeleccionado = null;
      const input = document.getElementById('chat-file-input');
      if(input) input.value = '';
      render();
    }
    else if(action==='limpiar-filtro-consumos'){ consumosPeriodo = {tipo:'todos', valor:''}; consumosFiltroSocio = ''; render(); }
    else if(action==='limpiar-filtro-gastos-socio'){ filtroSocioLiquidar = ''; render(); }
    else if(action==='cuota-year'){ cuotasYear += Number(btn.dataset.dir); render(); }
    else if(action==='resumen-grafico-year'){ resumenGraficoYear += Number(btn.dataset.dir); render(); }
    else if(action==='export-log-eventos'){ exportarLogEventos(); }
    else if(action==='toggle-ayuda'){ ayudaAbierta = !ayudaAbierta; render(); }
    else if(action==='toggle-alertas'){ alertasAbiertas = !alertasAbiertas; if(alertasAbiertas) chatAbierto = false; render(); }
    else if(action==='cerrar-alertas'){ alertasAbiertas = false; render(); }
    else if(action==='ir-a-alerta'){ activeTab = btn.dataset.tab; alertasAbiertas = false; viendoSocioId = null; render(); }
    else if(action==='ver-adjunto'){ adjuntoAbierto = {url: btn.dataset.url, tipo: btn.dataset.tipo}; render(); }
    else if(action==='ver-foto-grande'){
      const img = btn.querySelector('img');
      if(img && img.style.display !== 'none'){ adjuntoAbierto = {url: img.src, tipo:'jpg'}; render(); }
    }
    else if(action==='editar-foto-existente'){
      const sid = btn.dataset.id;
      const wrap = btn.closest('.avatar-wrap');
      const img = wrap ? wrap.querySelector('img') : null;
      if(img && img.style.display !== 'none'){
        editExistingFoto(img.src, sid);
      } else {
        const input = document.querySelector(`[data-autoupload-foto="${sid}"]`);
        if(input) input.click();
      }
    }
    else if(action==='cerrar-adjunto'){ adjuntoAbierto = null; render(); }
    else if(action==='ask-faq'){
      const entry = FAQ_ENTRIES.find(e=>e.id===btn.dataset.id);
      if(entry){
        ayudaTranscript.push({pregunta: entry.pregunta, respuesta: entry.respuesta});
        ayudaQuery = '';
      }
      render();
    }

    else if(action==='toggle-cuota'){
      await apiPost('/api/cuota/toggle', {socio_id: btn.dataset.socio, year: btn.dataset.year, month: btn.dataset.month});
      await loadState(); render();
    }
    else if(action==='toggle-activo'){
      if(btn.dataset.activo === '1'){
        
        if(!confirm('¿Estás seguro de que quieres dar de baja a este socio?')) return;
      }
      await apiPost(`/api/socios/${btn.dataset.id}/activo`);
      await loadState(); render();
    }
    else if(action==='delete-socio'){
      if(!confirm('¿Eliminar este socio definitivamente? Se perderán sus datos relacionados.')) return;
      await apiDelete(`/api/socios/${btn.dataset.id}`);
      await loadState(); render();
    }
    else if(action==='reset-pin'){
      if(!confirm('¿Restablecer el PIN de este socio? Se generará uno nuevo y tendrá que cambiarlo al entrar.')) return;
      const r = await apiPost(`/api/socios/${btn.dataset.id}/reset-pin`);
      await loadState(); render();
      alert(`Nuevo PIN temporal: ${r.pin}\n\nPásalo al socio - tendrá que cambiarlo la próxima vez que entre.`);
    }
    else if(action==='toggle-asistencia'){
      await apiPost(`/api/reuniones/${btn.dataset.reunion}/asistencia`, {socio_id: btn.dataset.socio});
      await loadState(); render();
    }
    else if(action==='editar-acta'){ editandoActaId = btn.dataset.id; render(); }
    else if(action==='cancelar-edit-acta'){ editandoActaId = null; render(); }
    else if(action==='editar-estatutos'){ estatutosEditando = true; render(); }
    else if(action==='cancelar-edit-estatutos'){ estatutosEditando = false; render(); }
    else if(action==='borrar-estatutos-contenido'){
      if(confirm('¿Eliminar el texto de los estatutos? El documento adjunto (si lo hay) no se toca.')){
        await apiPost('/api/estatutos', {contenido:''});
        estatutosEditando = false;
        await loadState(); render();
      }
    }
    else if(action==='quitar-estatutos-archivo'){
      if(confirm('¿Quitar este documento adjunto de los estatutos?')){ await apiDelete(`/api/estatutos/archivos/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='quitar-acta-archivo'){
      if(confirm('¿Quitar el archivo adjunto de esta acta?')){ await apiDelete(`/api/reuniones/${btn.dataset.id}/acta-archivo`); await loadState(); render(); }
    }
    else if(action==='ver-evento-cal'){ alert(btn.dataset.detalle); }
    else if(action==='tareas-mes'){ tareasCalFecha.setMonth(tareasCalFecha.getMonth()+Number(btn.dataset.dir)); render(); }
    else if(action==='reservas-mes'){ reservasCalFecha.setMonth(reservasCalFecha.getMonth()+Number(btn.dataset.dir)); render(); }
    else if(action==='reuniones-mes'){ reunionesCalFecha.setMonth(reunionesCalFecha.getMonth()+Number(btn.dataset.dir)); render(); }
    else if(action==='asignarme-ticket'){
      await apiPost(`/api/tareas-tickets/${btn.dataset.id}/socios/toggle`, {socio_id: state.current_user});
      await loadState(); render();
    }
    else if(action==='anadir-socio-tarea'){
      const select = document.querySelector(`select[data-nuevo-socio-tarea="${btn.dataset.id}"]`);
      if(!select || !select.value) return;
      await apiPost(`/api/tareas-tickets/${btn.dataset.id}/socios/toggle`, {socio_id: select.value});
      await loadState(); render();
    }
    else if(action==='quitar-socio-tarea'){
      await apiPost(`/api/tareas-tickets/${btn.dataset.id}/socios/toggle`, {socio_id: btn.dataset.socio});
      await loadState(); render();
    }
    else if(action==='anadir-socio-nueva-tarea'){
      const select = document.getElementById('nueva-tarea-socio-select');
      if(!select || !select.value) return;
      if(!nuevaTareaSocios.includes(select.value)) nuevaTareaSocios.push(select.value);
      const wrap = document.getElementById('nueva-tarea-socios-wrap');
      if(wrap) wrap.innerHTML = renderNuevaTareaSociosWrap();
    }
    else if(action==='quitar-socio-nueva-tarea'){
      nuevaTareaSocios = nuevaTareaSocios.filter(id=>id!==btn.dataset.socio);
      const wrap = document.getElementById('nueva-tarea-socios-wrap');
      if(wrap) wrap.innerHTML = renderNuevaTareaSociosWrap();
    }
    else if(action==='delete-tarea-ticket'){
      if(confirm('¿Borrar esta tarea?')){
        editandoTareaId = null;
        await apiDelete(`/api/tareas-tickets/${btn.dataset.id}`); await loadState(); render();
      }
    }
    else if(action==='editar-tarea'){
      const restaurar = anclarScroll(btn.dataset.id);
      editandoTareaId = btn.dataset.id;
      render();
      restaurar();
    }
    else if(action==='cancelar-editar-tarea'){
      const restaurar = anclarScroll(editandoTareaId);
      editandoTareaId = null;
      render();
      restaurar();
    }
    else if(action==='export-tareas-whatsapp'){
      const tareas = (state.tareas_tickets||[]).filter(t=>t.estado!=='hecho');
      const porEstado = {pendiente:[], en_curso:[]};
      tareas.forEach(t=>{ (porEstado[t.estado]||(porEstado[t.estado]=[])).push(t); });
      const linea = t=>`- ${t.tipo}${(t.socios_ids&&t.socios_ids.length)?' (' + t.socios_ids.map(socioNombre).join(', ') + ')':' (sin asignar)'}${t.fecha?' - *'+fmtDate(t.fecha)+'*':''}${t.notas?' - '+t.notas:''}`;
      let texto = `*Tareas de la peña* - ${fmtDate(todayISO())}\n`;
      if(porEstado.pendiente && porEstado.pendiente.length){ texto += `\n*Pendientes:*\n${porEstado.pendiente.map(linea).join('\n')}\n`; }
      if(porEstado.en_curso && porEstado.en_curso.length){ texto += `\n*En curso:*\n${porEstado.en_curso.map(linea).join('\n')}\n`; }
      if(tareas.length===0){ texto += '\nNo hay tareas activas.'; }
      enviarWhatsapp(texto);
    }
    else if(action==='export-reservas-whatsapp'){
      const proximas = state.reservas.filter(r=>r.fecha>=todayISO()).sort((a,b)=>a.fecha.localeCompare(b.fecha));
      let texto = `*Reservas de la peña* - ${fmtDate(todayISO())}\n\n`;
      texto += proximas.length ? proximas.map(r=>`- *${fmtDate(r.fecha)}* (${fmtHoras(r)}): ${r.evento} - ${socioNombre(r.socio_id)}${r.notas?' - '+r.notas:''}`).join('\n') : 'No hay reservas próximas.';
      enviarWhatsapp(texto);
    }
    else if(action==='export-reuniones-whatsapp'){
      const proximas = state.reuniones.filter(r=>r.fecha>=todayISO()).sort((a,b)=>a.fecha.localeCompare(b.fecha));
      let texto = `*Reuniones de la peña* - ${fmtDate(todayISO())}\n\n`;
      texto += proximas.length ? proximas.map(r=>`- *${fmtDate(r.fecha)}* (${fmtHoras(r)}): ${r.evento}${r.notas?' - '+r.notas:''}`).join('\n') : 'No hay reuniones próximas.';
      enviarWhatsapp(texto);
    }
    else if(action==='export-inventario-whatsapp'){
      const pendientes = state.inventario.filter(i=>i.estado==='Necesita revision' || i.estado==='Hay que comprar');
      let texto = `*Inventario de la peña* - ${fmtDate(todayISO())}\n\n`;
      if(pendientes.length){
        texto += '*Pendiente de revisar o comprar:*\n' + pendientes.map(i=>`- ${i.nombre} (${i.cantidad}) - ${i.estado}${i.notas?' - '+i.notas:''}`).join('\n');
      } else {
        texto += 'Todo el material está bien, no hay nada pendiente.';
      }
      enviarWhatsapp(texto);
    }
    else if(action==='export-lista-compra-whatsapp'){
      const lista = (state.listas_compra||[]).find(l=>l.id===btn.dataset.id);
      if(!lista) return;
      const pendientes = (lista.items||[]).filter(i=>!i.comprado);
      let texto = `*Lista de la compra: ${lista.nombre}* - ${fmtDate(todayISO())}\n\n`;
      texto += pendientes.length ? pendientes.map(i=>`- ${i.nombre}${i.cantidad?' ('+i.cantidad+')':''}`).join('\n') : 'No queda nada pendiente por comprar.';
      enviarWhatsapp(texto);
    }
    else if(action==='export-lista-pago-whatsapp'){
      const lista = (state.listas_pago||[]).find(l=>l.id===btn.dataset.id);
      if(!lista) return;
      const items = lista.items||[];
      const pendientes = items.filter(i=>!i.pagado);
      const pagados = items.filter(i=>i.pagado);
      let texto = `*Lista de pago: ${lista.nombre}* - ${fmtDate(todayISO())}\n\n`;
      if(state.config && state.config.numero_cuenta){ texto += `Número de cuenta: *${state.config.numero_cuenta}*\n\n`; }
      texto += `*Pendientes de pagar:*\n`;
      texto += pendientes.length ? pendientes.map(i=>`- ${i.nombre}${i.importe?' - *'+money(i.importe)+'*':''}`).join('\n') : 'Nadie pendiente, todos han pagado.';
      if(pagados.length){
        texto += `\n\n*Ya han pagado:*\n` + pagados.map(i=>`- ${i.nombre}${i.importe?' - *'+money(i.importe)+'*':''}`).join('\n');
      }
      enviarWhatsapp(texto);
    }
    else if(action==='export-bebidas-whatsapp'){
      const pendientes = (state.bebidas_consumos||[]).filter(c=>!c.pagado);
      const porConsumidor = {};
      pendientes.forEach(c=>{ porConsumidor[c.consumidor] = (porConsumidor[c.consumidor]||0) + Number(c.importe||0); });
      const nombres = Object.keys(porConsumidor).sort((a,b)=>porConsumidor[b]-porConsumidor[a]);
      let texto = `*Deuda de bebidas pendiente* - ${fmtDate(todayISO())}\n\n`;
      if(nombres.length){
        texto += nombres.map(n=>`- ${n}: *${money(porConsumidor[n])}*`).join('\n');
        texto += `\n\n*Total pendiente: ${money(pendientes.reduce((a,c)=>a+Number(c.importe||0),0))}*`;
      } else {
        texto += 'No hay deuda pendiente, todo está pagado.';
      }
      enviarWhatsapp(texto);
    }
    else if(action==='export-gastos-socios-whatsapp'){
      const pendientes = gastosSociosPendientes();
      let texto = `*Gastos e ingresos de socios* - ${fmtDate(todayISO())}\n\n`;
      if(pendientes.length){
        texto += '*Pendientes de verificar:*\n' + pendientes.map(g=>`- ${g.tipo==='ingreso'?'Ingreso':'Gasto'}: ${g.concepto} - *${money(g.importe)}* - ${g.socio_nombre||'-'} (*${fmtDate(g.fecha)}*)`).join('\n');
        texto += `\n\n*Total pendiente: ${money(pendientes.reduce((a,g)=>a+Number(g.importe||0),0))}*`;
      } else {
        texto += 'No hay gastos ni ingresos de socios pendientes de verificar.';
      }
      enviarWhatsapp(texto);
    }
    else if(action==='export-movimientos-whatsapp'){
      const ordenados = [...state.movimientos].sort((a,b)=>b.fecha.localeCompare(a.fecha));
      let filtrados = ordenados.filter(m=>dentroDePeriodo(m.fecha, cajaPeriodo));
      if(filtroSocioMovimientos) filtrados = filtrados.filter(m=>m.socio_id===filtroSocioMovimientos);
      if(filtroCategoriaMovimientos) filtrados = filtrados.filter(m=>m.categoria===filtroCategoriaMovimientos);
      const socioTexto = filtroSocioMovimientos ? ' - '+socioNombre(filtroSocioMovimientos) : '';
      const categoriaTexto = filtroCategoriaMovimientos ? ' - '+filtroCategoriaMovimientos : '';
      let texto = `*Movimientos${cajaPeriodo.tipo==='todos'?'':' - '+labelPeriodo(cajaPeriodo)}${socioTexto}${categoriaTexto}* - ${fmtDate(todayISO())}\n\n`;
      texto += filtrados.length ? filtrados.map(m=>`- ${m.tipo==='ingreso'?'+':'-'}*${money(m.importe)}* - ${m.categoria} - ${m.concepto}${m.socio_id?' - '+socioNombre(m.socio_id):(m.no_socio_nombre?' - '+m.no_socio_nombre:'')} - *${fmtDate(m.fecha)}*`).join('\n') : 'Sin movimientos.';
      enviarWhatsapp(texto);
    }
    else if(action==='export-cuentas-whatsapp'){
      const periodo = cuentasPeriodo;
      const ingresosTotales = totalIngresosCuotas() + totalIngresosMov() + totalBebidasIngreso() + totalIngresosSociosVerificados();
      const gastosTotales = totalGastosMov() + totalFiestasGasto() + totalGastosSociosVerificados();
      const saldo = ingresosTotales - gastosTotales;
      let texto = `*Cuentas de la peña${periodo.tipo==='todos'?'':' - '+labelPeriodo(periodo)}* - ${fmtDate(todayISO())}\n\n`;

      const cuotasPagadas = state.cuotas.filter(c=>c.pagado && dentroDePeriodo(c.fecha, periodo))
        .sort((a,b)=> (b.year-a.year) || (b.month-a.month) || socioNombre(a.socio_id).localeCompare(socioNombre(b.socio_id)));
      texto += `*Cuotas* (${money(totalIngresosCuotas(periodo))})\n`;
      texto += cuotasPagadas.length
        ? cuotasPagadas.map(c=>`- ${socioNombre(c.socio_id)} - ${MESES[c.month-1]} ${c.year}: *${money(c.importe)}*`).join('\n')
        : 'Sin cuotas pagadas.';
      texto += '\n\n';

      const bebidasPagadas = [...state.bebidas_consumos].filter(c=>c.pagado && dentroDePeriodo(c.fecha, periodo)).sort((a,b)=>b.fecha.localeCompare(a.fecha));
      texto += `*Bebidas* (${money(totalBebidasIngreso(periodo))})\n`;
      texto += bebidasPagadas.length
        ? bebidasPagadas.map(c=>`- ${c.consumidor} - ${c.cantidad} x ${c.bebida_nombre||'bebida'} - *${fmtDate(c.fecha)}*: *${money(c.importe)}*`).join('\n')
        : 'Sin consumos pagados.';
      texto += '\n\n';

      const movsOrdenados = [...state.movimientos].filter(m=>dentroDePeriodo(m.fecha, periodo)).sort((a,b)=>b.fecha.localeCompare(a.fecha));
      const otrosIngresos = movsOrdenados.filter(m=>m.tipo==='ingreso' && m.categoria!=='Socios');
      texto += `*Otros ingresos* (${money(totalIngresosMov(periodo))})\n`;
      texto += otrosIngresos.length
        ? otrosIngresos.map(m=>`- *${fmtDate(m.fecha)}* - ${m.categoria} - ${m.concepto}: *${money(m.importe)}*`).join('\n')
        : 'Sin otros ingresos.';
      texto += '\n\n';

      const ingresosSocios = movsOrdenados.filter(m=>m.categoria==='Socios' && m.tipo==='ingreso');
      texto += `*Ingresos de socios* (${money(totalIngresosSociosVerificados(periodo))})\n`;
      texto += ingresosSocios.length
        ? ingresosSocios.map(m=>`- ${m.socio_nombre||'-'} - ${m.concepto} - *${fmtDate(m.fecha)}*: *${money(m.importe)}*`).join('\n')
        : 'Sin ingresos de socios verificados.';
      texto += '\n\n';

      const gastosSocios = movsOrdenados.filter(m=>m.categoria==='Socios' && m.tipo!=='ingreso');
      texto += `*Gastos de socios* (-${money(totalGastosSociosVerificados(periodo))})\n`;
      texto += gastosSocios.length
        ? gastosSocios.map(m=>`- ${m.socio_nombre||'-'} - ${m.concepto} - *${fmtDate(m.fecha)}*: -*${money(m.importe)}*`).join('\n')
        : 'Sin gastos de socios verificados.';
      texto += '\n\n';

      const fiestasGastos = [...state.fiestas_gastos].filter(f=>dentroDePeriodo(f.fecha, periodo)).sort((a,b)=>b.fecha.localeCompare(a.fecha));
      texto += `*Gastos de fiestas* (-${money(totalFiestasGasto(periodo))})\n`;
      texto += fiestasGastos.length
        ? fiestasGastos.map(f=>`- ${f.evento} - ${f.concepto} - *${fmtDate(f.fecha)}*: -*${money(f.importe)}*`).join('\n')
        : 'Sin gastos de fiestas.';
      texto += '\n\n';

      const gastosGenerales = movsOrdenados.filter(m=>m.tipo==='gasto' && m.categoria!=='Socios');
      texto += `*Gastos generales* (-${money(totalGastosMov(periodo))})\n`;
      texto += gastosGenerales.length
        ? gastosGenerales.map(m=>`- *${fmtDate(m.fecha)}* - ${m.categoria} - ${m.concepto}: -*${money(m.importe)}*`).join('\n')
        : 'Sin gastos generales.';
      texto += '\n\n';

      texto += `*Saldo total: ${saldo<0?'-':'+'}${money(Math.abs(saldo))}*`;
      if(periodo.tipo!=='todos'){ texto += ' (de todo el historial; el resto de cifras de arriba son solo del período elegido)'; }
      const pendientes = gastosSociosPendientes();
      if(pendientes.length){
        texto += `\n\n${pendientes.length} gasto(s)/ingreso(s) de socios (${money(pendientes.reduce((a,g)=>a+Number(g.importe||0),0))}) pendientes de verificar, no suman todavía al saldo.`;
      }
      enviarWhatsapp(texto);
    }
    else if(action==='export-evento-whatsapp'){
      const ev = (state.gastos_eventos||[]).find(e=>e.id===btn.dataset.id);
      if(!ev) return;
      const balances = ev.balances||{};
      const transferencias = ev.transferencias||[];
      let texto = `*Tricount: ${ev.nombre}* - ${fmtDate(ev.fecha)}\n\n`;
      texto += `Total del evento: *${money(ev.total)}*\n\n`;
      if((ev.participantes||[]).length){
        texto += '*Saldos:*\n' + ev.participantes.map(sid=>{
          const b = balances[sid]||0;
          const texto2 = b>0.005 ? `le deben *${money(b)}*` : (b<-0.005 ? `debe *${money(-b)}*` : 'en paz');
          return `- ${socioNombre(sid)}: ${texto2}`;
        }).join('\n') + '\n\n';
      }
      texto += transferencias.length
        ? '*Quién paga a quién:*\n' + transferencias.map(t=>`- ${socioNombre(t.de)} -> ${socioNombre(t.a)}: *${money(t.importe)}*`).join('\n')
        : 'No queda ningún pago pendiente entre los participantes.';
      enviarWhatsapp(texto);
    }
    else if(action==='delete-reunion'){
      if(confirm('¿Borrar esta reunión?')){ await apiDelete(`/api/reuniones/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='editar-reunion'){ editandoReunionId = btn.dataset.id; render(); }
    else if(action==='cancelar-editar-reunion'){ editandoReunionId = null; render(); }
    else if(action==='delete-inventario'){
      if(confirm('¿Borrar este material?')){
        editandoInventarioId = null;
        await apiDelete(`/api/inventario/${btn.dataset.id}`); await loadState(); render();
      }
    }
    else if(action==='editar-inventario'){
      const restaurar = anclarScroll(btn.dataset.id);
      editandoInventarioId = btn.dataset.id;
      render();
      restaurar();
    }
    else if(action==='cancelar-editar-inventario'){
      const restaurar = anclarScroll(editandoInventarioId);
      editandoInventarioId = null;
      render();
      restaurar();
    }
    else if(action==='editar-bebida-precio'){
      const restaurar = anclarScroll(btn.dataset.id);
      editandoBebidaPrecioId = btn.dataset.id;
      render();
      restaurar();
    }
    else if(action==='cancelar-editar-bebida-precio'){
      const restaurar = anclarScroll(editandoBebidaPrecioId);
      editandoBebidaPrecioId = null;
      render();
      restaurar();
    }
    else if(action==='delete-lista-compra'){
      if(confirm('¿Borrar esta lista y todos sus productos?')){ await apiDelete(`/api/listas-compra/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='toggle-item-compra'){
      await apiPost(`/api/listas-compra/items/${btn.dataset.id}/toggle`);
      await loadState(); render();
    }
    else if(action==='delete-item-compra'){
      await apiDelete(`/api/listas-compra/items/${btn.dataset.id}`);
      await loadState(); render();
    }
    else if(action==='editar-item-compra'){
      const restaurar = anclarScroll(btn.dataset.id);
      editandoItemCompraId = btn.dataset.id;
      render();
      restaurar();
    }
    else if(action==='cancelar-editar-item-compra'){
      const restaurar = anclarScroll(editandoItemCompraId);
      editandoItemCompraId = null;
      render();
      restaurar();
    }
    else if(action==='listas-subtab'){
      listasSubTab = btn.dataset.sub;
      editandoNombreListaId = null;
      editandoListaComidaId = null;
      render();
    }
    else if(action==='editar-nombre-lista'){
      const restaurar = anclarScroll(btn.dataset.id);
      editandoNombreListaId = btn.dataset.id;
      render();
      restaurar();
    }
    else if(action==='cancelar-editar-nombre-lista'){
      const restaurar = anclarScroll(editandoNombreListaId);
      editandoNombreListaId = null;
      render();
      restaurar();
    }
    else if(action==='delete-lista-comida'){
      if(confirm('¿Borrar esta comida/cena, con sus asistentes e invitados?')){ await apiDelete(`/api/listas-comida/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='editar-lista-comida'){
      const restaurar = anclarScroll(btn.dataset.id);
      editandoListaComidaId = btn.dataset.id;
      render();
      restaurar();
    }
    else if(action==='cancelar-editar-lista-comida'){
      const restaurar = anclarScroll(editandoListaComidaId);
      editandoListaComidaId = null;
      render();
      restaurar();
    }
    else if(action==='anadir-socio-comida'){
      const select = document.getElementById(`comida-socio-select-${btn.dataset.lista}`);
      if(!select || !select.value) return;
      await apiPost(`/api/listas-comida/${btn.dataset.lista}/asistencia`, {socio_id: select.value});
      await loadState(); render();
    }
    else if(action==='toggle-asistencia-comida'){
      await apiPost(`/api/listas-comida/${btn.dataset.lista}/asistencia`, {socio_id: btn.dataset.socio});
      await loadState(); render();
    }
    else if(action==='delete-invitado-comida'){
      await apiDelete(`/api/listas-comida/invitados/${btn.dataset.id}`);
      await loadState(); render();
    }
    else if(action==='add-tipo-comida-inline'){
      const formType = btn.closest('form').dataset.form;
      const nombre = prompt('Nueva opción (qué se come):');
      if(!nombre || !nombre.trim()) return;
      try{
        await apiPost('/api/tipos-comida', {nombre: nombre.trim()});
      }catch(err){ alert(err.message || 'No se pudo añadir la opción.'); return; }
      await loadState();
      render();
      const sel = document.querySelector(`form[data-form="${formType}"] [name=tipo]`);
      if(sel) sel.value = nombre.trim();
    }
    else if(action==='delete-tipo-comida-inline'){
      const form = btn.closest('form');
      const sel = form ? form.querySelector('[name=tipo]') : null;
      if(!sel || !sel.value) return;
      const tipoObj = (state.tipos_comida||[]).find(t=>t.nombre===sel.value);
      if(!tipoObj) return;
      if(!confirm(`¿Borrar la opción "${sel.value}"?`)) return;
      try{
        await apiDelete(`/api/tipos-comida/${tipoObj.id}`);
      }catch(err){ alert(err.message || 'No se pudo borrar la opción.'); return; }
      await loadState(); render();
    }
    else if(action==='export-lista-comida-whatsapp'){
      const lista = (state.listas_comida||[]).find(l=>l.id===btn.dataset.id);
      if(!lista) return;
      const nombres = [...(lista.asistentes||[]).map(sid=>socioNombre(sid)), ...(lista.invitados||[]).map(inv=>inv.nombre)];
      let texto = `*${lista.nombre}*${lista.fecha ? ' - '+fmtDate(lista.fecha) : ''}${lista.hora ? ' '+lista.hora : ''}\n`;
      texto += lista.tipo==='casero' ? 'Lo hacemos nosotros' : 'De bar o restaurante';
      texto += lista.notas ? ` (${lista.notas})\n\n` : '\n\n';
      texto += nombres.length ? nombres.map(n=>`- ${n}`).join('\n') : 'Todavía no se ha apuntado nadie.';
      enviarWhatsapp(texto);
    }
    else if(action==='delete-lista-pago'){
      if(confirm('¿Borrar esta lista de pago y todas sus filas?')){ await apiDelete(`/api/listas-pago/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='toggle-item-pago'){
      await apiPost(`/api/listas-pago/items/${btn.dataset.id}/toggle`);
      await loadState(); render();
    }
    else if(action==='delete-item-pago'){
      await apiDelete(`/api/listas-pago/items/${btn.dataset.id}`);
      await loadState(); render();
    }
    else if(action==='editar-item-pago'){
      const restaurar = anclarScroll(btn.dataset.id);
      editandoItemPagoId = btn.dataset.id;
      render();
      restaurar();
    }
    else if(action==='cancelar-editar-item-pago'){
      const restaurar = anclarScroll(editandoItemPagoId);
      editandoItemPagoId = null;
      render();
      restaurar();
    }
    else if(action==='delete-movimiento'){
      if(confirm('¿Borrar este movimiento?')){ await apiDelete(`/api/movimientos/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='delete-ticket-movimiento'){
      if(confirm('¿Quitar el ticket o factura de este movimiento?')){ await apiDelete(`/api/movimientos/${btn.dataset.id}/ticket`); await loadState(); render(); }
    }
    else if(action==='editar-movimiento'){
      const restaurar = anclarScroll(btn.dataset.id);
      editandoMovimientoId = btn.dataset.id;
      render();
      restaurar();
    }
    else if(action==='cancelar-editar-movimiento'){
      const restaurar = anclarScroll(editandoMovimientoId);
      editandoMovimientoId = null;
      render();
      restaurar();
    }
    else if(action==='movimiento-no-pagado'){
      if(confirm('Este movimiento volverá a "Gastos e ingresos de socios" como pendiente de verificar. ¿Continuar?')){
        await apiPost(`/api/movimientos/${btn.dataset.id}/no-pagado`);
        editandoMovimientoId = null;
        await loadState(); render();
      }
    }
    else if(action==='toggle-abonado-gasto-socio'){
      await apiPost(`/api/gastos-socios/${btn.dataset.id}/abonado`);
      await loadState(); render();
    }
    else if(action==='toggle-seleccion-gasto-socio'){
      const id = btn.dataset.id;
      if(seleccionGastosSocios.has(id)) seleccionGastosSocios.delete(id); else seleccionGastosSocios.add(id);
      render();
    }
    else if(action==='toggle-seleccion-todos-gastos-socios'){
      const gastosSocios = [...(state.gastos_socios||[])];
      const mostrados = filtroSocioLiquidar ? gastosSocios.filter(g=>g.socio_id===filtroSocioLiquidar) : gastosSocios;
      const idsPendientes = mostrados.filter(g=>!g.abonado).map(g=>g.id);
      const todosYaSeleccionados = idsPendientes.length>0 && idsPendientes.every(id=>seleccionGastosSocios.has(id));
      if(todosYaSeleccionados) idsPendientes.forEach(id=>seleccionGastosSocios.delete(id));
      else idsPendientes.forEach(id=>seleccionGastosSocios.add(id));
      render();
    }
    else if(action==='marcar-varios-gastos-socios-pagados'){
      const ids = [...seleccionGastosSocios];
      if(ids.length===0) return;
      if(confirm(`¿Marcar como pagados los ${ids.length} gastos/ingresos seleccionados?`)){
        await apiPost('/api/gastos-socios/marcar-varios-pagados', {ids});
        seleccionGastosSocios.clear();
        await loadState(); render();
      }
    }
    else if(action==='limpiar-filtro-movimientos-socio'){
      filtroSocioMovimientos = ''; filtroCategoriaMovimientos = ''; render();
    }
    else if(action==='editar-gasto-socio'){
      const restaurar = anclarScroll(btn.dataset.id);
      editandoGastoSocioId = btn.dataset.id;
      render();
      restaurar();
    }
    else if(action==='cancelar-editar-gasto-socio'){
      const restaurar = anclarScroll(editandoGastoSocioId);
      editandoGastoSocioId = null;
      render();
      restaurar();
    }
    else if(action==='delete-gasto-socio'){
      const g = (state.gastos_socios||[]).find(x=>x.id===btn.dataset.id);
      const aviso = g && g.abonado
        ? '¿Borrar esta solicitud de la lista? Ya está pagado/verificado, así que el movimiento correspondiente se queda igualmente en el historial de Movimientos.'
        : '¿Borrar este gasto?';
      if(confirm(aviso)){
        editandoGastoSocioId = null;
        await apiDelete(`/api/gastos-socios/${btn.dataset.id}`);
        await loadState(); render();
      }
    }
    else if(action==='delete-ticket-gasto-socio'){
      if(confirm('¿Quitar el ticket o factura de este gasto?')){ await apiDelete(`/api/gastos-socios/${btn.dataset.id}/ticket`); await loadState(); render(); }
    }
    else if(action==='delete-bebida-precio'){
      if(confirm('¿Borrar esta bebida?')){ await apiDelete(`/api/bebidas/precios/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='add-categoria-mov-inline'){
      const nombre = prompt('Nueva categoría:');
      if(!nombre || !nombre.trim()) return;
      try{
        await apiPost('/api/categorias-movimiento', {nombre: nombre.trim()});
      }catch(err){ alert(err.message || 'No se pudo añadir la categoría.'); return; }
      await loadState();
      render();
      const sel = document.querySelector('form[data-form="add-movimiento"] [name=categoria]');
      if(sel) sel.value = nombre.trim();
    }
    else if(action==='add-categoria-inv-inline'){
      const nombre = prompt('Nueva categoría:');
      if(!nombre || !nombre.trim()) return;
      try{
        await apiPost('/api/categorias-inventario', {nombre: nombre.trim()});
      }catch(err){ alert(err.message || 'No se pudo añadir la categoría.'); return; }
      await loadState();
      render();
      const sel = document.querySelector('form[data-form="add-inventario"] [name=categoria]');
      if(sel) sel.value = nombre.trim();
    }
    else if(action==='delete-categoria-inv-inline'){
      const form = btn.closest('form');
      const sel = form ? form.querySelector('[name=categoria]') : null;
      if(!sel || !sel.value) return;
      const categoria = (state.categorias_inventario||[]).find(c=>c.nombre===sel.value);
      if(!categoria) return;
      if(!confirm(`¿Borrar la categoría "${sel.value}"? El material que ya tenga esta categoría no se moverá ni se borrará.`)) return;
      try{
        await apiDelete(`/api/categorias-inventario/${categoria.id}`);
      }catch(err){ alert(err.message || 'No se pudo borrar la categoría.'); return; }
      await loadState();
      render();
    }
    else if(action==='delete-categoria-mov-inline'){
      const form = btn.closest('form');
      const sel = form ? form.querySelector('[name=categoria]') : null;
      if(!sel || !sel.value) return;
      const categoria = (state.categorias_movimiento||[]).find(c=>c.nombre===sel.value);
      if(!categoria) return;
      if(!confirm(`¿Borrar la categoría "${sel.value}"?`)) return;
      try{
        await apiDelete(`/api/categorias-movimiento/${categoria.id}`);
      }catch(err){ alert(err.message || 'No se pudo borrar la categoría.'); return; }
      await loadState();
      render();
    }
    else if(action==='delete-consumo'){
      if(confirm('¿Borrar este consumo?')){ await apiDelete(`/api/bebidas/consumos/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='editar-consumo'){ editandoConsumoId = btn.dataset.id; render(); }
    else if(action==='cancelar-edit-consumo'){ editandoConsumoId = null; render(); }
    else if(action==='toggle-consumo-pagado'){
      await apiPost(`/api/bebidas/consumos/${btn.dataset.id}/pagado`);
      await loadState(); render();
    }
    else if(action==='delete-reserva'){
      if(confirm('¿Cancelar esta reserva?')){ await apiDelete(`/api/reservas/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='editar-reserva'){ editandoReservaId = btn.dataset.id; render(); }
    else if(action==='cancelar-editar-reserva'){ editandoReservaId = null; render(); }
    else if(action==='delete-gasto-evento'){
      if(confirm('¿Borrar este evento y todos sus pagos?')){ await apiDelete(`/api/gastos-eventos/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='toggle-ocultar-evento'){
      await apiPost(`/api/gastos-eventos/${btn.dataset.id}/ocultar`);
      await loadState(); render();
    }
    else if(action==='quitar-participante-evento'){
      await apiPost(`/api/gastos-eventos/${btn.dataset.evento}/participantes/toggle`, {socio_id: btn.dataset.socio});
      await loadState(); render();
    }
    else if(action==='anadir-participante-evento'){
      const select = document.querySelector(`select[data-nuevo-participante="${btn.dataset.evento}"]`);
      if(!select || !select.value) return;
      await apiPost(`/api/gastos-eventos/${btn.dataset.evento}/participantes/toggle`, {socio_id: select.value});
      await loadState(); render();
    }
    else if(action==='anadir-participante-nuevo-evento'){
      const select = document.getElementById('nuevo-evento-participante-select');
      if(!select || !select.value) return;
      if(!nuevoEventoParticipantes.includes(select.value)) nuevoEventoParticipantes.push(select.value);
      const wrap = document.getElementById('nuevo-evento-participantes-wrap');
      if(wrap) wrap.innerHTML = renderNuevoEventoParticipantesWrap();
    }
    else if(action==='quitar-participante-nuevo-evento'){
      nuevoEventoParticipantes = nuevoEventoParticipantes.filter(id=>id!==btn.dataset.socio);
      const wrap = document.getElementById('nuevo-evento-participantes-wrap');
      if(wrap) wrap.innerHTML = renderNuevoEventoParticipantesWrap();
    }
    else if(action==='delete-pago-evento'){
      if(confirm('¿Borrar este pago?')){ await apiDelete(`/api/gastos-eventos/${btn.dataset.evento}/pagos/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='delete-familiar'){
      await apiDelete(`/api/familiares/${btn.dataset.id}`); await loadState(); render();
    }
    else if(action==='export-excel'){
      const original = btn.textContent;
      btn.textContent = 'Generando...'; btn.disabled = true;
      try{
        const qs = btn.dataset.desde ? `?desde=${btn.dataset.desde}&hasta=${btn.dataset.hasta}` : '';
        const res = await fetch('/api/export.xlsx'+qs);

        if(!res.ok){
        
          let msg = 'No se pudo exportar el Excel.';
        
          try{ const j = await res.json(); msg = j.error || msg; }catch(e){}
        
          throw new Error(msg);
        
        }
        
        const blob = await res.blob();
        
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        
        a.href = url;
        
        a.download = `el_cado_cuentas_${todayISO()}.xlsx`;
        
        document.body.appendChild(a); a.click(); a.remove();
        
        URL.revokeObjectURL(url);
      }finally{
        
        btn.textContent = original; btn.disabled = false;
      }
    }
  }catch(err){ alert(err.message || 'Ha ocurrido un error'); }
});

function mostrarChartTooltip(hit, x, y){
  const tip = document.getElementById('chart-tooltip');
  if(!tip || !hit) return;
  tip.textContent = hit.dataset.tooltip;
  tip.style.display = 'block';
  const pad = 14;
  let left = x + pad, top = y + pad;
  const rect = tip.getBoundingClientRect();
  if(left + rect.width > window.innerWidth - 8) left = x - rect.width - pad;
  if(top + rect.height > window.innerHeight - 8) top = y - rect.height - pad;
  tip.style.left = Math.max(8, left) + 'px';
  tip.style.top = Math.max(8, top) + 'px';
}
function ocultarChartTooltip(){
  const tip = document.getElementById('chart-tooltip');
  if(tip) tip.style.display = 'none';
}
document.addEventListener('mousemove', (e)=>{
  const hit = e.target.closest('[data-tooltip]');
  if(hit) mostrarChartTooltip(hit, e.clientX, e.clientY);
  else ocultarChartTooltip();
});
document.addEventListener('mouseleave', ()=>ocultarChartTooltip());
document.addEventListener('touchstart', (e)=>{
  const hit = e.target.closest('[data-tooltip]');
  const t = e.touches[0];
  if(hit && t) mostrarChartTooltip(hit, t.clientX, t.clientY - 60);
  else ocultarChartTooltip();
}, {passive:true});
document.addEventListener('touchmove', (e)=>{
  const t = e.touches[0];
  if(!t) return;
  const el = document.elementFromPoint(t.clientX, t.clientY);
  const hit = el && el.closest('[data-tooltip]');
  if(hit) mostrarChartTooltip(hit, t.clientX, t.clientY - 60);
  else ocultarChartTooltip();
}, {passive:true});

document.addEventListener('input', (e)=>{
  if(e.target.id==='login-search-input'){
    loginSearchQuery = e.target.value;
    const socios = state.socios.filter(s=>s.activo);
    const query = loginSearchQuery.trim().toLowerCase();
    const matches = query.length>=2 ? socios.filter(s=>s.nombre.toLowerCase().includes(query)) : [];
    const results = document.getElementById('login-search-results');
    if(results) results.innerHTML = renderLoginSearchResults(matches, query);
  }
  else if(e.target.id==='help-search-input'){
    ayudaQuery = e.target.value;
    const suggestions = document.getElementById('help-suggestions');
    if(suggestions) suggestions.innerHTML = renderHelpSuggestions(buscarFaq(ayudaQuery));
  }
  else if(e.target.name==='cantidad' && e.target.form && e.target.form.dataset.form==='add-consumo'){
    actualizarTotalConsumo(e.target.form);
  }
});

document.addEventListener('change', async (e)=>{
  if(e.target.id==='gastos-socios-filtro-socio'){
    filtroSocioLiquidar = e.target.value;
    render();
    return;
  }
  if(e.target.id==='movimientos-filtro-socio'){
    filtroSocioMovimientos = e.target.value;
    render();
    return;
  }
  if(e.target.id==='movimientos-filtro-categoria'){
    filtroCategoriaMovimientos = e.target.value;
    render();
    return;
  }
  if(e.target.id==='chat-file-input'){
    const file = e.target.files[0];
    if(file){
      chatArchivoSeleccionado = file;
      emojiPickerAbierto = false;
      render();
      const ta = document.getElementById('chat-input');
      if(ta) ta.focus();
    }
    return;
  }
  if(e.target.id==='cuota-mes-movil'){
    cuotasMesMovil = Number(e.target.value);
    render();
    return;
  }
  if(e.target.id==='consumos-filtro-socio'){
    consumosFiltroSocio = e.target.value;
    render();
    return;
  }
  if(e.target.dataset && e.target.dataset.periodoPrefix){
    const prefix = e.target.dataset.periodoPrefix;
    const periodos = {caja:cajaPeriodo, cuentas:cuentasPeriodo, consumos:consumosPeriodo, resumen:resumenPeriodo, 'tareas-historial':tareasHistorialPeriodo};
    const periodo = periodos[prefix];
    if(periodo){
      if(e.target.id===`${prefix}-tipo`){
        periodo.tipo = e.target.value;
        periodo.valor = valorPorDefectoPeriodo(periodo.tipo);
      } else if(e.target.id===`${prefix}-valor`){
        periodo.valor = e.target.value;
      }
      render();
    }
    return;
  }
  if(e.target.name==='socio_id' && e.target.form && (e.target.form.dataset.form==='add-movimiento' || e.target.form.dataset.form==='edit-movimiento')){
    const noSocioInput = e.target.form.querySelector('[name=no_socio_nombre]');
    if(noSocioInput) noSocioInput.style.display = e.target.value ? 'none' : '';
    return;
  }
  if(e.target.name==='socio_id' && e.target.form && e.target.form.dataset.form==='add-item-pago'){
    const nombreInput = e.target.form.querySelector('[name=nombre]');
    const opcionElegida = e.target.selectedOptions[0];
    if(nombreInput && e.target.value && opcionElegida){ nombreInput.value = opcionElegida.textContent; }
    return;
  }
  if(e.target.name==='consumidorTipo'){
    const form = e.target.closest('form');
    const isInvitado = e.target.value==='invitado';
    form.querySelector('[name=socio_id]').style.display = isInvitado ? 'none' : '';
    form.querySelector('[name=nombre_invitado]').style.display = isInvitado ? '' : 'none';
    actualizarTotalConsumo(form);
    return;
  }
  if(e.target.name==='bebida_id' && e.target.form && e.target.form.dataset.form==='add-consumo'){
    actualizarTotalConsumo(e.target.form);
    return;
  }
  if(e.target.matches('[data-estado-tarea]')){
    const tid = e.target.dataset.estadoTarea;
    const r = await apiPost(`/api/tareas-tickets/${tid}`, {estado: e.target.value});
    await loadState(); render();
    if(r && r.nueva_tarea_generada){ alert('Tarea completada. Como tiene rotación, se ha creado la siguiente automáticamente.'); }
    return;
  }
  if(e.target.matches('[data-autoupload-foto]')){
    const file = e.target.files[0];
    const socioId = e.target.dataset.autouploadFoto;
    e.target.value = '';
    if(!file) return;
    openFotoCropModal(file, socioId);
  }
  if(e.target.matches('[data-autoupload-ticket]')){
    const file = e.target.files[0];
    if(!file) return;
    try{
      await uploadTicketGasto(e.target.dataset.autouploadTicket, file);
      await loadState(); render();
    }catch(err){ alert(err.message || 'No se pudo subir el ticket'); }
  }
  if(e.target.matches('[data-autoupload-ticket-pago]')){
    const file = e.target.files[0];
    if(!file) return;
    try{
      await uploadTicketPago(e.target.dataset.evento, e.target.dataset.autouploadTicketPago, file);
      await loadState(); render();
    }catch(err){ alert(err.message || 'No se pudo subir el ticket'); }
  }
  if(e.target.matches('[data-autoupload-ticket-mov]')){
    const file = e.target.files[0];
    if(!file) return;
    try{
      await uploadTicketMovimiento(e.target.dataset.autouploadTicketMov, file);
      await loadState(); render();
    }catch(err){ alert(err.message || 'No se pudo subir el ticket o factura'); }
  }
  if(e.target.matches('[data-autoupload-acta]')){
    const file = e.target.files[0];
    if(!file) return;
    try{
      await uploadActaArchivo(e.target.dataset.autouploadActa, file);
      await loadState(); render();
    }catch(err){ alert(err.message || 'No se pudo subir el archivo del acta'); }
  }
  if(e.target.matches('[data-autoupload-estatutos]')){
    const file = e.target.files[0];
    if(!file) return;
    try{
      await uploadEstatutosArchivo(file);
      await loadState(); render();
    }catch(err){ alert(err.message || 'No se pudo subir el documento'); }
  }
  if(e.target.matches('[data-import-excel]')){
    const file = e.target.files[0];
    if(!file) return;
    const fd = new FormData();
    fd.append('archivo', file);
    try{
      const res = await fetch('/api/import.xlsx', {method:'POST', body:fd});
      const resultado = await res.json();
      if(!res.ok) throw new Error(resultado.error || 'No se pudo importar.');
      const resumen = resultado.resumen || {};
      let msg = 'Importación completada:\n';
      for(const hoja of Object.keys(resumen)){
        const r = resumen[hoja];
        msg += `- ${hoja}: ${r.creados} creados, ${r.actualizados} actualizados`;
        msg += r.errores.length ? `, ${r.errores.length} aviso(s)\n` : '\n';
        r.errores.forEach(e=>{ msg += `   · ${e}\n`; });
      }
      await loadState(); render();
      alert(msg);
    }catch(err){ alert(err.message || 'No se pudo importar el archivo.'); }
    e.target.value = '';
  }
});

/* ============ EVENTOS: formularios ============ */
document.addEventListener('submit', async (e)=>{
  const form = e.target.closest('[data-form]');
  if(!form) return;
  e.preventDefault();
  const type = form.dataset.form;
  const data = Object.fromEntries(new FormData(form).entries());
  const idParaAnclar = (type.startsWith('edit-') && type!=='edit-chat-msg') ? form.dataset.id : null;
  const restaurarScroll = anclarScroll(idParaAnclar);

  try{
    if(type==='bootstrap-admin'){ await apiPost('/api/socios', data); }
    else if(type==='pin-login'){
      await apiPost('/api/login', {socio_id: pendingLoginId, pin: data.pin});
      saveFavoriteUser(pendingLoginId);
      pendingLoginId = null;
      await loadState(); activeTab='resumen'; render();
      await chatOnLogin();
      return;
    }
    else if(type==='force-pin'){
      if(data.pin !== data.pin2){ alert('Los dos PIN no coinciden.'); return; }
      if(!/^[0-9]{4}$/.test(data.pin)){ alert('El PIN debe tener 4 dígitos.'); return; }
      await apiPost('/api/perfil/pin', {pin: data.pin});
      await loadState(); activeTab='resumen'; render();
      await chatOnLogin();
      return;
    }
    else if(type==='send-chat'){
      const texto = (data.texto||'').trim();
      const archivo = chatArchivoSeleccionado;
      if(!texto && !archivo) return;
      let msg;
      try{
        msg = await apiPost('/api/chat', {texto, con_archivo: !!archivo});
      }catch(err){ alert(err.message || 'No se pudo enviar el mensaje.'); return; }
      if(archivo){
        try{
          const r = await uploadChatArchivo(msg.id, archivo);
          msg.archivo = 1;
          msg.archivo_ext = r.ext;
        }catch(err){ alert(err.message || 'No se pudo subir el archivo adjunto.'); }
      }
      chatMensajes.push(msg);
      chatLastId = Math.max(chatLastId, msg.id);
      chatArchivoSeleccionado = null;
      emojiPickerAbierto = false;
      const fileInput = document.getElementById('chat-file-input');
      if(fileInput) fileInput.value = '';
      const preview = document.querySelector('.chat-attach-preview');
      if(preview) preview.remove();
      const picker = document.querySelector('.emoji-picker');
      if(picker) picker.remove();
      const pickerBackdrop = document.querySelector('.emoji-picker-backdrop');
      if(pickerBackdrop) pickerBackdrop.remove();
      form.reset();
      appendChatMensajesDom([msg]);
      chatIrAlFinalYMarcar();
      return;
    }
    else if(type==='edit-chat-msg'){
      const id = form.dataset.id;
      const texto = (data.texto||'').trim();
      try{
        const updated = await apiPatch(`/api/chat/${id}`, {texto});
        const idx = chatMensajes.findIndex(m=>String(m.id)===String(id));
        if(idx>-1) chatMensajes[idx] = updated;
      }catch(err){ alert(err.message || 'No se pudo editar el mensaje.'); return; }
      editandoMensajeId = null;
      rerenderChatMsg(id);
      return;
    }
    else if(type==='add-socio'){
      const fileInput = form.querySelector('input[name=foto]');
      const file = fileInput && fileInput.files[0];
      const r = await apiPost('/api/socios', {nombre: data.nombre, pin: data.pin || ''});
      if(file){
        
        try{ await uploadFoto(r.id, file); }
        
        catch(fe){ alert('El socio se creó, pero la foto no se pudo subir: '+fe.message); }
      }
      if(r.pin_generado){

        alert(`Socio creado. Su PIN de acceso es: ${r.pin_generado}\n\nApúntalo y pásaselo - podrá cambiarlo luego desde "Mi perfil".`);
      }
    }
    else if(type==='add-reunion'){ await apiPost('/api/reuniones', data); }
    else if(type==='edit-reunion'){
      await apiPost(`/api/reuniones/${form.dataset.id}`, data);
      editandoReunionId = null;
    }
    else if(type==='edit-acta'){
      await apiPost(`/api/reuniones/${form.dataset.id}/acta`, data);
      editandoActaId = null;
    }
    else if(type==='edit-estatutos'){
      await apiPost('/api/estatutos', data);
      estatutosEditando = false;
    }
    else if(type==='edit-consumo'){
      await apiPost(`/api/bebidas/consumos/${form.dataset.id}/editar`, data);
      editandoConsumoId = null;
    }
    else if(type==='add-inventario'){ await apiPost('/api/inventario', data); }
    else if(type==='edit-inventario'){
      await apiPost(`/api/inventario/${form.dataset.id}`, data);
      editandoInventarioId = null;
    }
    else if(type==='add-movimiento'){
      if(!confirmarSiPosibleDuplicado(data.concepto, data.fecha)) return;
      await apiPost('/api/movimientos', data);
    }
    else if(type==='add-gasto-socio'){
      if(!confirmarSiPosibleDuplicado(data.concepto, data.fecha)) return;
      await apiPost('/api/gastos-socios', data);
    }
    else if(type==='edit-gasto-socio'){
      if(!confirmarSiPosibleDuplicado(data.concepto, data.fecha, form.dataset.id)) return;
      await apiPost(`/api/gastos-socios/${form.dataset.id}`, data);
      editandoGastoSocioId = null;
    }
    else if(type==='edit-movimiento'){
      if(!confirmarSiPosibleDuplicado(data.concepto, data.fecha, form.dataset.id)) return;
      await apiPost(`/api/movimientos/${form.dataset.id}`, data);
      editandoMovimientoId = null;
    }
    else if(type==='add-bebida-precio'){ await apiPost('/api/bebidas/precios', data); }
    else if(type==='edit-bebida-precio'){
      await apiPost(`/api/bebidas/precios/${form.dataset.id}`, data);
      editandoBebidaPrecioId = null;
    }
    else if(type==='add-consumo'){
      data.es_socio = data.consumidorTipo ? data.consumidorTipo==='socio' : true;
      if(TABLET_MODE){ data.socio_id = state.current_user; data.es_socio = true; }
      const bebidaNombre = (state.bebidas_precios.find(p=>p.id===data.bebida_id)||{}).nombre || 'bebida';
      await apiPost('/api/bebidas/consumos', data);
      if(TABLET_MODE){
        await tabletConfirmarYSalir(`${data.cantidad || 1} x ${bebidaNombre}`);
        return;
      }
    }
    else if(type==='add-reserva'){ await apiPost('/api/reservas', data); }
    else if(type==='edit-reserva'){
      await apiPost(`/api/reservas/${form.dataset.id}`, data);
      editandoReservaId = null;
    }
    else if(type==='add-lista-compra'){ await apiPost('/api/listas-compra', data); }
    else if(type==='add-item-compra'){
      await apiPost(`/api/listas-compra/${form.dataset.lista}/items`, data);
      form.reset();
    }
    else if(type==='edit-item-compra'){
      await apiPost(`/api/listas-compra/items/${form.dataset.id}`, data);
      editandoItemCompraId = null;
    }
    else if(type==='edit-nombre-lista-compra'){
      await apiPost(`/api/listas-compra/${form.dataset.id}`, data);
      editandoNombreListaId = null;
    }
    else if(type==='edit-nombre-lista-pago'){
      await apiPost(`/api/listas-pago/${form.dataset.id}`, data);
      editandoNombreListaId = null;
    }
    else if(type==='add-lista-comida'){ await apiPost('/api/listas-comida', data); }
    else if(type==='edit-lista-comida'){
      await apiPost(`/api/listas-comida/${form.dataset.id}`, data);
      editandoListaComidaId = null;
    }
    else if(type==='add-invitado-comida'){
      await apiPost(`/api/listas-comida/${form.dataset.lista}/invitados`, data);
      form.reset();
    }
    else if(type==='add-lista-pago'){ await apiPost('/api/listas-pago', data); }
    else if(type==='add-item-pago'){
      await apiPost(`/api/listas-pago/${form.dataset.lista}/items`, data);
      form.reset();
    }
    else if(type==='edit-item-pago'){
      await apiPost(`/api/listas-pago/items/${form.dataset.id}`, data);
      editandoItemPagoId = null;
    }
    else if(type==='add-gasto-evento'){
      const participantes = new FormData(form).getAll('participantes');
      await apiPost('/api/gastos-eventos', {nombre: data.nombre, fecha: data.fecha, notas: data.notas, participantes});
      nuevoEventoParticipantes = [];
    }
    else if(type==='add-pago-evento'){
      const eid = form.dataset.evento;
      const beneficiarios = new FormData(form).getAll('beneficiarios');
      await apiPost(`/api/gastos-eventos/${eid}/pagos`, {pagador_id: data.pagador_id, concepto: data.concepto, importe: data.importe, beneficiarios});
    }
    else if(type==='add-tarea-ticket'){
      const socios = new FormData(form).getAll('socios');
      await apiPost('/api/tareas-tickets', {tipo: data.tipo, fecha: data.fecha, rotacion: data.rotacion, notas: data.notas, socios});
      nuevaTareaSocios = [];
    }
    else if(type==='edit-tarea-ticket'){
      await apiPost(`/api/tareas-tickets/${form.dataset.id}`, data);
      editandoTareaId = null;
    }
    else if(type==='add-role'){
      const permisos = new FormData(form).getAll('permisos');
      await apiPost('/api/roles', {nombre: data.nombre, permisos});
    }
    else if(type==='save-perfil'){ await apiPost('/api/perfil', data); }
    else if(type==='change-pin'){
      if(data.pin !== data.pin2){ alert('Los dos PIN no coinciden.'); return; }
      if(!/^[0-9]{4}$/.test(data.pin)){ alert('El PIN debe tener 4 dígitos.'); return; }
      await apiPost('/api/perfil/pin', {pin: data.pin});
      form.reset();
      alert('PIN actualizado.');
    }
    else if(type==='add-familiar'){ await apiPost('/api/familiares', data); }

    await loadState();
    render();
    restaurarScroll();
    if(state && state.current_user) chatOnLogin();
  }catch(err){ alert(err.message || 'Ha ocurrido un error'); }
});

document.addEventListener('keydown', (e)=>{
  if(e.target && e.target.id==='chat-input' && e.key==='Enter' && !e.shiftKey){
    e.preventDefault();
    const form = document.getElementById('chat-compose-form');
    if(form) form.requestSubmit();
  }
});

/* ============ actualización en segundo plano (casi tiempo real) ============ */
function isTyping(){
  const el = document.activeElement;
  if(el && (el.tagName==='INPUT' || el.tagName==='TEXTAREA' || el.tagName==='SELECT')) return true;
  // Si hay un desplegable abierto (elegir permisos, eventos ocultos...) no
  // refresques: el refresco automático reconstruye el HTML y lo cerraría,
  // haciendo perder lo que se estuviera rellenando.
  if(document.querySelector('details[open]')) return true;
  if(document.querySelector('.crop-modal')) return true;
  return false;
}
setInterval(async ()=>{
  if(document.hidden || isTyping()) return;
  const restaurar = anclarScroll(editandoMovimientoId || editandoGastoSocioId);
  await loadState();
  render();
  restaurar();
}, 30000);

document.addEventListener('keydown', (e)=>{
  if(e.key==='Escape' && adjuntoAbierto){ adjuntoAbierto = null; render(); }
});

/* ============ botón flotante "subir arriba" ============ */
function initScrollTopButton(){
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'scroll-top-btn';
  btn.title = 'Subir arriba';
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>';
  btn.addEventListener('click', ()=>window.scrollTo({top:0, behavior:'smooth'}));
  document.body.appendChild(btn);
  window.addEventListener('scroll', ()=>{
    btn.classList.toggle('visible', window.scrollY > 300);
  }, {passive:true});
}

/* ============ deslizar hacia abajo para actualizar (la app instalada no tiene botón de recargar) ============ */
function initPullToRefresh(){
  const el = document.createElement('div');
  el.className = 'pull-refresh-indicator';
  el.innerHTML = '<span class="pull-refresh-spinner" style="display:none;"></span><span class="pull-refresh-text">Desliza hacia abajo para actualizar</span>';
  document.body.appendChild(el);
  const textEl = el.querySelector('.pull-refresh-text');
  const spinEl = el.querySelector('.pull-refresh-spinner');

  const THRESHOLD = 70;
  let startY = 0, pulling = false, dy = 0, refreshing = false;

  document.addEventListener('touchstart', (e)=>{
    if(refreshing || document.body.classList.contains('no-scroll')) return;
    if(window.scrollY > 0 || e.touches.length !== 1) return;
    startY = e.touches[0].clientY;
    pulling = true;
    dy = 0;
  }, {passive:true});

  document.addEventListener('touchmove', (e)=>{
    if(!pulling || refreshing) return;
    dy = e.touches[0].clientY - startY;
    if(dy <= 0 || window.scrollY > 0){
      pulling = false;
      el.classList.remove('visible');
      return;
    }
    el.classList.add('visible');
    textEl.textContent = dy > THRESHOLD ? 'Suelta para actualizar' : 'Desliza hacia abajo para actualizar';
  }, {passive:true});

  document.addEventListener('touchend', async ()=>{
    if(!pulling) return;
    pulling = false;
    if(dy > THRESHOLD && !refreshing){
      refreshing = true;
      textEl.textContent = 'Actualizando...';
      spinEl.style.display = '';
      el.classList.add('visible');
      try{ await loadState(); render(); }
      finally{
        refreshing = false;
        spinEl.style.display = 'none';
        el.classList.remove('visible');
      }
    } else {
      el.classList.remove('visible');
    }
    dy = 0;
  }, {passive:true});
}

/* ============ flechitas para mover el cursor en campos de texto largos (movil) ============ */
function initCursorNudge(){
  const wrap = document.createElement('div');
  wrap.className = 'cursor-nudge';
  wrap.innerHTML = `<button type="button" class="cursor-nudge-btn" data-dir="-1" tabindex="-1" title="Mover cursor a la izquierda">&lsaquo;</button><button type="button" class="cursor-nudge-btn" data-dir="1" tabindex="-1" title="Mover cursor a la derecha">&rsaquo;</button>`;
  document.body.appendChild(wrap);
  let target = null;

  function overflowing(el){ return el.scrollWidth > el.clientWidth + 2; }
  function place(el){
    const r = el.getBoundingClientRect();
    wrap.style.left = Math.max(4, Math.min(r.left, window.innerWidth - 84)) + 'px';
    wrap.style.top = (r.bottom + 6) + 'px';
  }
  function hide(){ wrap.classList.remove('visible'); target = null; }
  function refresh(el){
    if(window.innerWidth > 720 || el.type==='password' || !overflowing(el)){ hide(); return; }
    target = el;
    place(el);
    wrap.classList.add('visible');
  }

  document.addEventListener('focusin', (e)=>{
    const el = e.target;
    if(el.matches && el.matches('input[type=text],input[type=tel],input[type=number],textarea')) refresh(el);
    else hide();
  });
  document.addEventListener('focusout', (e)=>{
    if(e.target===target) setTimeout(()=>{ if(document.activeElement!==target) hide(); }, 150);
  });
  document.addEventListener('input', (e)=>{ if(e.target===target) refresh(target); });
  window.addEventListener('resize', ()=>{ if(target) refresh(target); });
  window.addEventListener('scroll', ()=>{ if(target) place(target); }, {passive:true, capture:true});

  wrap.querySelectorAll('.cursor-nudge-btn').forEach(btn=>{
    btn.addEventListener('touchstart', (e)=>e.preventDefault(), {passive:false});
    btn.addEventListener('mousedown', (e)=>e.preventDefault());
    btn.addEventListener('click', ()=>{
      if(!target) return;
      const dir = parseInt(btn.dataset.dir, 10);
      const pos = target.selectionStart==null ? target.value.length : target.selectionStart;
      const next = Math.min(target.value.length, Math.max(0, pos + dir));
      target.focus();
      target.setSelectionRange(next, next);
    });
  });
}

/* ============ INIT ============ */
(async function init(){
  render();
  initChatToastContainer();
  loadBackgroundImages();
  initBackgroundSlideshow();
  initScrollTopButton();
  initPullToRefresh();
  initCursorNudge();
  await loadState();
  render();
  if(state && state.current_user && !TABLET_MODE){
    await loadChatInicial();
    updateChatBadge();
    const n = chatUnreadCount();
    if(n===1){
      const ultimoDeOtro = [...chatMensajes].reverse().find(m=>m.socio_id!==state.current_user);
      if(ultimoDeOtro) showChatToast(ultimoDeOtro);
    } else if(n>1){
      showChatToast({socio_nombre:'Chat de socios', texto:`${n} mensajes nuevos`});
    }
    startChatPolling();
  }
})();

document.addEventListener('click', async (e)=>{
  const btn = e.target.closest('[data-action="save-roles"]');
  if(!btn) return;
  const sid = btn.dataset.id;
  const roles = [...document.querySelectorAll(`input[data-role-option="${sid}"]:checked`)].map(input=>input.value);
  if(!roles.length){ alert('Selecciona al menos un rol.'); return; }
  try{
    await apiPost(`/api/socios/${sid}/roles`, {roles});
    await loadState();
    render();
  }catch(err){ alert(err.message || 'No se pudieron guardar los roles.'); }
});
document.addEventListener('click', async (e)=>{
  const btn = e.target.closest('[data-action="update-role-permisos"]');
  if(!btn) return;
  const rid = btn.dataset.id;
  const permisos = [...document.querySelectorAll(`input[data-edit-role-permiso="${rid}"]:checked`)].map(item=>item.value);
  try{
    await apiPost(`/api/roles/${rid}`, {permisos});
    await loadState();
    render();
  }catch(err){ alert(err.message || 'No se pudieron guardar los permisos.'); }
});
document.addEventListener('click', async (e)=>{
  const btn = e.target.closest('[data-action="delete-role"]');
  if(!btn) return;
  if(!confirm('¿Borrar este rol? Los socios que lo tengan lo perderán.')) return;
  try{
    await apiDelete(`/api/roles/${btn.dataset.id}`);
    await loadState();
    render();
  }catch(err){ alert(err.message || 'No se pudo borrar el rol.'); }
});