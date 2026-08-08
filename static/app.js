/* El Cado - frontend
   Habla con el backend Flask (app.py) via fetch(). El estado siempre
   vive en el servidor (SQLite) para que todos los socios vean lo mismo
   en tiempo real (se refresca solo cada 8s). */

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const CAT_MOV = ['Alquiler','Luz','Agua','Gas','Mantenimiento','Otros'];
const CAT_INV = ['Cocina','Mobiliario','Electronica','Otros'];
const TIPO_FAMILIA = ['Pareja','Hijo/a','Otro'];
const DIA_LIMITE_CUOTA = 5; // a partir de que dia del mes se avisa de cuota pendiente
let BG_IMAGES = [];
const DEFAULT_BG_IMAGES = ['/static/backgrounds/bg-1.jpg','/static/backgrounds/bg-2.jpg','/static/backgrounds/bg-3.jpg','/static/backgrounds/bg-4.jpg','/static/backgrounds/bg-5.jpg','/static/backgrounds/bg-6.jpg'];
const PENA_LOCATION_URL = 'https://maps.app.goo.gl/z4ZBJix572Trhqf49';
let avatarVersion = Date.now();

/* ============ AYUDA (FAQ con guion, sin IA externa) ============ */
const FAQ_ENTRIES = [
  {id:'entrar', pregunta:'Como entro / inicio sesion?', palabras:['entrar','entro','sesion','login','iniciar','acceder'],
    respuesta:'Escribe tu nombre en el buscador de la pantalla de inicio, elige tu cara entre los resultados y escribe tu PIN de 4 digitos. Si es la primera vez que entras, la app te pedira crear tu propio PIN antes de continuar.'},
  {id:'pin-olvidado', pregunta:'Se me ha olvidado el PIN, que hago?', palabras:['olvide','olvidado','pin','recuperar','restablecer','reset'],
    respuesta:'Pidele al administrador (o a quien gestione socios) que te restablezca el PIN desde la pestana Socios, boton "Restablecer PIN". Te dara uno temporal y tendras que cambiarlo por el tuyo la proxima vez que entres.'},
  {id:'marcar-cuota', pregunta:'Quien puede ver y marcar las cuotas?', palabras:['cuota','cuotas','pagar','pagado','marcar','tesorero'],
    respuesta:'Todos los socios pueden ver la pestana Cuotas (quien ha pagado y quien falta cada mes), pero solo el tesorero y el administrador pueden marcar una cuota como pagada (se marca con una cruz), previa comprobacion.'},
  {id:'reservar', pregunta:'Como reservo la pena?', palabras:['reservar','reserva','reservas','calendario'],
    respuesta:'Ve a la pestana Reservas, rellena la fecha y el evento (las horas son opcionales) y pulsa "Reservar a mi nombre". Puedes cancelar tu propia reserva desde la lista de proximas reservas. En los calendarios (Reservas, Reuniones, Tareas) puedes pulsar la etiqueta de un dia para ver los detalles de ese evento, muy util desde el movil.'},
  {id:'tricount', pregunta:'Como funciona el Tricount (reparto de gastos)?', palabras:['tricount','reparto','gastos','evento','cena'],
    respuesta:'En la pestana Tricount crea un evento; para anadir participantes elige un socio en el desplegable y pulsa "+" (nadie entra automaticamente). Cada participante puede registrar los pagos que hizo y entre quien se reparten; la app calcula sola quien tiene que pagar a quien. Cuando el evento ya esta cerrado puedes ocultarlo con el boton "Ocultar".'},
  {id:'tareas', pregunta:'Como me apunto a una tarea?', palabras:['tarea','tareas','encargado','apuntarme','ticket'],
    respuesta:'En la pestana Tareas puedes crear un ticket para ti mismo, o asignarte uno existente que no tenga responsable. Quien gestiona tareas puede ademas asignar cualquier ticket a cualquier socio.'},
  {id:'foto', pregunta:'Como cambio mi foto de perfil?', palabras:['foto','avatar','imagen','perfil'],
    respuesta:'Desde la pestana Socios (o Mi perfil) pulsa el boton "Foto" junto a tu nombre y elige una imagen. Se recorta sola en cuadrado. Si es una foto de iPhone en formato HEIC, conviertela antes a JPG.'},
  {id:'precios-bebidas', pregunta:'Quien puede ver y cambiar los precios de las bebidas?', palabras:['bebida','bebidas','precio','precios','consumo','tesorero'],
    respuesta:'Cualquier socio puede consultar los precios en Bebidas > Consumo del dia a dia, para saber cuanto le va a costar antes de servirse (el total se calcula solo al elegir la bebida y la cantidad). Anadir precios nuevos o registrar consumos es cosa del administrador o el tesorero.'},
  {id:'gastos-socios', pregunta:'Como registro un gasto que he pagado yo para la pena?', palabras:['gasto','gastos','ticket','abonar','abonado','reembolso'],
    respuesta:'En Gastos e ingresos, tarjeta "Gastos de socios para la pena", rellena el concepto, el importe y la fecha. Una vez creado, puedes subir una foto del ticket (.jpg o .png) desde el propio gasto de la lista. Cuando el tesorero te lo abone, marcalo como "Abonado" (puedes hacerlo tu mismo o el administrador/tesorero). Solo tu o el administrador/tesorero podeis editar o borrar ese gasto; no los de otros socios.'},
  {id:'excel', pregunta:'Como exporto los datos a Excel?', palabras:['excel','exportar','descargar','xlsx','cuentas'],
    respuesta:'Si tienes permiso para exportar datos, veras un boton "Exportar a Excel" en Resumen, Inventario o Bebidas. Descarga un unico archivo con todas las hojas: socios, cuotas, movimientos, Tricount, tareas, etc, con el detalle completo de cada ingreso y gasto.'},
  {id:'roles', pregunta:'Que son los roles y quien los gestiona?', palabras:['rol','roles','permiso','permisos','administrador'],
    respuesta:'Los roles agrupan permisos (ver finanzas, gestionar cuotas, gestionar tareas...). Solo quien tiene permiso para gestionar roles (normalmente el administrador) puede crear roles nuevos y asignarselos a los socios, desde la pestana Roles.'},
  {id:'avisos', pregunta:'Que es la campana de avisos?', palabras:['campana','aviso','avisos','notificacion','alerta'],
    respuesta:'La campanita de la cabecera avisa de cuotas pendientes, bebidas por pagar y actividad reciente (reservas y reuniones). El numero indica cuantos avisos hay ahora mismo; desde ahi tambien puedes exportarlos como un log de texto. Para cerrar el desplegable, pulsa la campanita otra vez o toca en cualquier otro sitio de la pantalla.'},
  {id:'baja', pregunta:'Que pasa si doy de baja a un socio?', palabras:['baja','eliminar','borrar','socio'],
    respuesta:'Dar de baja a un socio no borra su historial (cuotas pagadas, asistencia a reuniones, etc): simplemente deja de aparecer en el buscador de la pantalla de inicio y se marca como "de baja" en la lista de socios.'},
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
  <div class="help-panel">
    <div class="help-panel-header">
      <b>Ayuda rapida</b>
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
    <p class="meta" style="margin:8px 0 0; text-align:center;">Preguntas frecuentes con respuesta ya escrita: si tu duda no aparece, preguntale al administrador o al tesorero.</p>
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

async function loadBackgroundImages(){
  try{
    const res = await fetch('/api/backgrounds');
    if(res.ok){
      const json = await res.json();
      if(Array.isArray(json.backgrounds) && json.backgrounds.length>0){
        
        BG_IMAGES = json.backgrounds;
        
        return;
      }
    }
  }catch(e){/* fallback */}
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
let bebidasSubtab = 'consumo';
let cuotasYear = new Date().getFullYear();
let cuotasMesMovil = new Date().getMonth()+1;
let resumenGraficoYear = new Date().getFullYear();
let resumenStatMes = todayISO().slice(0,7);
let cajaMesFiltro = todayISO().slice(0,7);
let reservasCalFecha = new Date();
let reunionesCalFecha = new Date();
let nuevoEventoParticipantes = [];
let editandoGastoSocioId = null;
let editandoMovimientoId = null;
let ticketVersion = Date.now();
let loaded = false;
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
const apiDelete = (p)=>api(p,{method:'DELETE'});

async function loadState(){
  try{
    state = await apiGet('/api/state');
    loaded = true;
    // Si hay usuario favorito guardado y esta activo, pre-seleccionarlo
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
function fmtDate(iso){
  if(!iso) return '';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function fmtHoras(r){
  if(!r.hora_inicio && !r.hora_fin) return 'Todo el dia';
  if(r.hora_inicio && r.hora_fin) return `${r.hora_inicio} - ${r.hora_fin}`;
  return r.hora_inicio ? `desde las ${r.hora_inicio}` : `hasta las ${r.hora_fin}`;
}
function socioNombre(id){ const s = state.socios.find(s=>s.id===id); return s ? s.nombre : '-'; }
function initials(name){
  return (name||'').trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase();
}
function avatarHtml(socio, size){
  size = size || 'sm';
  return `<div class="avatar avatar-${size}">
    <img src="/static/avatars/${socio.id}.jpg?v=${avatarVersion}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
    <span class="avatar-fallback" style="display:none;">${escapeHtml(initials(socio.nombre))}</span>
  </div>`;
}
async function uploadFoto(socioId, file){
  const fd = new FormData();
  fd.append('foto', file);
  const res = await fetch(`/api/socios/${socioId}/foto`, {method:'POST', body:fd});
  if(!res.ok){
    let msg = 'No se pudo subir la foto.';
    try{ const j = await res.json(); msg = j.error || msg; }catch(e){}
    throw new Error(msg);
  }
  avatarVersion = Date.now();
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
function escapeHtml(str){
  return String(str==null?'':str).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function timeAgoEs(iso){
  if(!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs/86400000);
  if(days<=0) return 'hoy';
  if(days===1) return 'ayer';
  return `hace ${days} dias`;
}

/* ============ RENDER ROOT ============ */
function render(){
  updateBackgroundVisibility();
  const app = document.getElementById('app');
  if(!loaded){ app.innerHTML = `<div class="loading-screen">Abriendo la pena</div>`; return; }
  if(!state.current_user){
    app.innerHTML = renderLogin() + renderAyuda();
    if(!loginDragInitialized){
      loginDragInitialized = true;
      initLoginDrag();
    }
    scrollHelpTranscript();
    return;
  }
  const me = state.socios.find(s=>s.id===state.current_user);
  if(me && me.must_change_pin){ app.innerHTML = renderForcePin(me) + renderAyuda(); scrollHelpTranscript(); return; }
  app.innerHTML = renderApp() + renderAyuda() + renderAlertasPanel();
  scrollHelpTranscript();
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
      <label class="f">Nuevo PIN (4 digitos, el que tu quieras)</label>
      <input type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" name="pin" required placeholder="****" autofocus
        
        style="width:100%; box-sizing:border-box; text-align:center; font-size:1.4rem; letter-spacing:0.5rem; text-indent:0.25rem; margin-bottom:10px;">
      <label class="f">Repite el PIN</label>
      <input type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" name="pin2" required placeholder="****"

        style="width:100%; box-sizing:border-box; text-align:center; font-size:1.4rem; letter-spacing:0.5rem; text-indent:0.25rem; margin-bottom:14px;">
      <button class="btn" type="submit" style="width:100%;">Guardar mi PIN y entrar</button>
    </form>
    <button class="btn ghost small" data-action="logout" style="margin-top:14px;">Cerrar sesion</button>
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
        
            <p class="sub" style="margin-top:10px;">Hola, ${escapeHtml(s.nombre)}. ${s.tiene_pin ? 'Introduce tu PIN' : 'Todavia no tienes PIN configurado, puedes entrar directamente'}</p>
        
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
              <label class="f">Elige un PIN de 4 digitos</label>
              <input type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" name="pin" required placeholder="****" style="margin-bottom:10px;">
              <button class="btn" type="submit" style="width:100%;">Crear pena y entrar como administrador</button>
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
        <button class="btn ghost small" data-action="export-log-eventos">Exportar log</button>
        <button class="help-close" data-action="cerrar-alertas" title="Cerrar">&times;</button>
      </div>
    </div>
    ${alertas.length ? alertas.map(a=>`<div class="alert-item"><span class="dot ${a.tipo}"></span><div>${a.texto}${a.meta?` <span class="meta">- ${a.meta}</span>`:''}</div></div>`).join('') : '<p class="empty">Sin avisos por ahora.</p>'}
  </div>`;
}
function renderApp(){
  const me = state.socios.find(s=>s.id===state.current_user);
  const alertas = construirAlertas();
  return `
  <div class="container">
    <div class="header-panel">
      <div class="masthead">
        
        <div class="logo-row">${logoBadge()}<div><h1>${escapeHtml(state.config.nombre)}</h1><a href="${PENA_LOCATION_URL}" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; gap:5px; color:var(--amber); font-weight:600; text-decoration:none; margin-top:2px; font-size:0.92rem;"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-7.2 7-12a7 7 0 0 0-14 0c0 4.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.4"/></svg>Ver ubicacion</a></div></div>
        
        ${can('manage_config') ? `<div style="display:flex; gap:8px; flex-wrap:wrap;">

          <button class="edit-name-btn" data-action="edit-club-name">renombrar pena</button>

          <button class="edit-name-btn" data-action="edit-cuota">cambiar cuota</button>

        </div>` : ''}
        
        <div class="user-bar">${me?avatarHtml(me,'sm'):''}<span class="live-dot"></span>Conectado como <b>${escapeHtml(me ? me.nombre : '')}</b>${isAdmin() ? '<span class="admin-badge">Admin</span>' : ''} - <button data-action="logout">cerrar sesion</button>
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
        ${tabBtn('caja','Gastos e ingresos','wallet')}
        ${tabBtn('bebidas','Bebidas','cup')}
        ${tabBtn('encargados','Tareas','check')}
        ${tabBtn('reparto','Tricount','split')}
        ${isAdmin() ? tabBtn('roles','Roles','key') : ''}
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
  'check': '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l2.6 2.6L16.5 9"/>',
  'key': '<circle cx="8" cy="15" r="4.2"/><path d="M11 12l9-9"/><path d="M16 6l3 3"/><path d="M13.5 8.5l2.3 2.3"/>',
  'user': '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  'split': '<path d="M4 7h13"/><path d="M13 3l4 4-4 4"/><path d="M20 17H7"/><path d="M11 21l-4-4 4-4"/>',
};
function tabIcon(name){
  const path = TAB_ICON_PATHS[name] || '';
  return `<svg class="tab-icon" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}
function tabBtn(id,label,icon){
  return `<button class="tab-btn ${activeTab===id?'active':''}" data-action="switch-tab" data-tab="${id}">${tabIcon(icon)}<span class="tab-label">${label}</span></button>`;
}
function renderTab(){
  switch(activeTab){
    case 'resumen': return renderResumen();
    case 'socios': return renderSocios();
    case 'cuotas': return renderCuotas();
    case 'reservas': return renderReservas();
    case 'reuniones': return renderReuniones();
    case 'reparto': return renderReparto();
    case 'inventario': return renderInventario();
    case 'caja': return renderCaja();
    case 'bebidas': return renderBebidas();
    case 'encargados': return renderEncargados();
    case 'roles': return renderRoles();
    case 'perfil': return renderPerfil();
    default: return '';
  }
}

function sortedRoles(){
  // Igual que el orden alfabetico del backend, pero dejando "Otro" siempre al final.
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
    ${roles.length===0 ? '<p class="empty">Todavia no hay roles.</p>' : roles.map(role=>renderRoleRow(role, labels)).join('')}
  </div>
  <div class="card">
    <h2><span class="pin"></span>Asignar roles a socios</h2>
    <p class="readonly-note">Un socio puede tener varios roles. Los cambios se aplican al momento.</p>
    ${state.socios.map(s=>`
      <div class="list-item socio-role-row" style="align-items:flex-start; border-left-color:${socioSwatchColor(s.id)};">
        <div style="flex:1;">
          <div style="font-weight:600; margin-bottom:8px;">${escapeHtml(s.nombre)} ${s.id===state.current_user?'<span class="tag ok">tu</span>':''}</div>
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
/* ============ calculos ============ */
function totalIngresosCuotas(){ return state.cuotas.filter(c=>c.pagado).reduce((a,c)=>a+Number(c.importe||0),0); }
function totalIngresosMov(){ return state.movimientos.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+Number(m.importe||0),0); }
function totalGastosMov(){ return state.movimientos.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+Number(m.importe||0),0); }
function totalBebidasIngreso(){ return state.bebidas_consumos.filter(c=>c.pagado).reduce((a,c)=>a+Number(c.importe||0),0); }
function totalBebidasPendiente(){ return state.bebidas_consumos.filter(c=>!c.pagado).reduce((a,c)=>a+Number(c.importe||0),0); }
function misBebidasPendientes(){ return state.bebidas_consumos.filter(c=>c.socio_id===state.current_user && !c.pagado); }
function actualizarTotalConsumo(form){
  const el = form.querySelector('#consumo-total');
  if(!el) return;
  const bebidaId = form.querySelector('[name=bebida_id]').value;
  const cantidad = Number(form.querySelector('[name=cantidad]').value) || 0;
  const esSocio = form.querySelector('[name=consumidorTipo]').value === 'socio';
  const precio = state.bebidas_precios.find(p=>p.id===bebidaId);
  const unit = precio ? Number(esSocio ? precio.precio_socio : precio.precio_no_socio) : 0;
  el.textContent = `Total a pagar: ${money(unit * cantidad)}`;
}
function totalFiestasGasto(){ return state.fiestas_gastos.reduce((a,f)=>a+Number(f.importe||0),0); }
function totalIngresosSociosVerificados(){ return (state.gastos_socios||[]).filter(g=>g.tipo==='ingreso' && g.abonado).reduce((a,g)=>a+Number(g.importe||0),0); }
function totalGastosSociosVerificados(){ return (state.gastos_socios||[]).filter(g=>g.tipo!=='ingreso' && g.abonado).reduce((a,g)=>a+Number(g.importe||0),0); }
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

        alertas.push({tipo:'warn', texto:`${s.nombre} todavia no ha pagado la cuota de ${MESES[now.getMonth()]}`});
      }
    });
  }

  const gastosPendientes = gastosSociosPendientes();
  if(gastosPendientes.length){
    const total = gastosPendientes.reduce((a,g)=>a+Number(g.importe||0),0);
    alertas.push({tipo:'warn', texto:`Hay ${gastosPendientes.length} gasto(s)/ingreso(s) de socios (${money(total)}) pendientes de verificar por el tesorero (pestana Gastos e ingresos).`});
  }

  const misPendientes = misBebidasPendientes();
  if(misPendientes.length){
    const total = misPendientes.reduce((a,c)=>a+Number(c.importe||0),0);
    alertas.push({tipo:'warn', texto:`Tienes ${money(total)} pendientes de pagar en bebidas (pestana Bebidas).`});
  }

  const recientes = [];
  state.reservas.forEach(r=>{
    if(r.creado_en) recientes.push({fecha:r.creado_en, texto:`${socioNombre(r.socio_id)} reservo la pena para el ${fmtDate(r.fecha)} (${escapeHtml(r.evento)})`});
  });
  state.reuniones.forEach(r=>{
    if(r.creado_en) recientes.push({fecha:r.creado_en, texto:`Se convoco una reunion para el ${fmtDate(r.fecha)}: ${escapeHtml(r.evento)}`});
  });
  recientes.sort((a,b)=>b.fecha.localeCompare(a.fecha));
  recientes.slice(0,5).forEach(r=>alertas.push({tipo:'info', texto:r.texto, meta:timeAgoEs(r.fecha)}));

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

/* ============ GRAFICAS: evolucion de ingresos y gastos ============ */
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
function totalesPorMes(year, month){
  const map = movimientosPorMes();
  const key = `${year}-${String(month).padStart(2,'0')}`;
  return map[key] || {ingresos:0, gastos:0};
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
  return `<svg viewBox="0 0 ${W} ${H}" class="chart-svg chart-svg-anual" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Ingresos y gastos por ano">${barras}</svg>`;
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
  if(!mesesResumen.includes(resumenStatMes)) resumenStatMes = mesesResumen[0];
  const [rsYear, rsMonth] = resumenStatMes.split('-').map(Number);
  const totalesMesActual = totalesPorMes(rsYear, rsMonth);

  return `
  <div class="stat-grid">
    <div class="stat"><div class="n">${saldo<0?'- ':''}${money(Math.abs(saldo))}</div><div class="l">SALDO TOTAL</div></div>
    <div class="stat sage"><div class="n">${money(totalesMesActual.ingresos)}</div><div class="l">Ingresos ${labelMes(resumenStatMes)}</div></div>
    <div class="stat rust"><div class="n">- ${money(totalesMesActual.gastos)}</div><div class="l">Gastos ${labelMes(resumenStatMes)}</div></div>
  </div>
  <div class="menu-row" style="margin:-4px 0 14px;">
    <span class="label">Ver Ingresos/Gastos</span>
    <span class="dots"></span>
    <select id="resumen-stat-mes">
      ${mesesResumen.map(k=>`<option value="${k}" ${resumenStatMes===k?'selected':''}>${labelMes(k)}</option>`).join('')}
    </select>
  </div>
  <div class="year-nav">
    <button data-action="resumen-grafico-year" data-dir="-1">&laquo; ${resumenGraficoYear-1}</button>
    <b>${resumenGraficoYear}</b>
    <button data-action="resumen-grafico-year" data-dir="1">${resumenGraficoYear+1} &raquo;</button>
  </div>

  <div class="card">
    <h2><span class="pin"></span>Evolucion de ingresos y gastos en ${resumenGraficoYear}</h2>
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
    <h2><span class="pin"></span>Comparativa por anos</h2>
    <p class="meta" style="margin:0 0 10px;">Para ver como estaba la pena en anos anteriores.</p>
    ${renderGraficoAnual()}
  </div>` : ''}

  <div class="card-grid">
    <div class="card">
      <h2 style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        
        <span><span class="pin"></span>Cuentas</span>

        <span style="display:flex; gap:8px; flex-wrap:wrap;">
          ${can('export_data') ? `<button class="btn ghost small" data-action="export-excel" style="font-family:'Work Sans';">Exportar a Excel</button>` : ''}
          ${isAdmin() ? `<label class="btn ghost small" style="cursor:pointer; font-family:'Work Sans';">Importar Excel<input type="file" accept=".xlsx" data-import-excel style="display:none;"></label>` : ''}
        </span>
      </h2>
      <div class="menu-row"><span class="label">Cuotas</span><span class="dots"></span><span class="value sage">${money(totalIngresosCuotas())}</span></div>
      <div class="menu-row"><span class="label">Otros ingresos</span><span class="dots"></span><span class="value sage">${money(totalIngresosMov())}</span></div>
      <div class="menu-row"><span class="label">Bebidas</span><span class="dots"></span><span class="value sage">${money(totalBebidasIngreso())}</span></div>
      <div class="menu-row"><span class="label">Ingresos de socios (verificados)</span><span class="dots"></span><span class="value sage">${money(totalIngresosSociosVerificados())}</span></div>
      <div class="menu-row"><span class="label">Gastos generales</span><span class="dots"></span><span class="value rust">- ${money(totalGastosMov())}</span></div>
      <div class="menu-row"><span class="label">Gastos de fiestas</span><span class="dots"></span><span class="value rust">- ${money(totalFiestasGasto())}</span></div>
      <div class="menu-row"><span class="label">Gastos de socios (verificados)</span><span class="dots"></span><span class="value rust">- ${money(totalGastosSociosVerificados())}</span></div>
      <div class="menu-row" style="border-top:1px solid var(--line); margin-top:10px; padding-top:10px;"><span class="label"><strong>Saldo neto</strong></span><span class="dots"></span><span class="value ${saldo<0?'rust':'sage'}"><strong>${saldo<0?'- ':'+'}${money(Math.abs(saldo))}</strong></span></div>
      ${pendientesSocios.length ? `<p class="readonly-note" style="margin-top:10px;">${pendientesSocios.length} gasto(s)/ingreso(s) de socios (${money(pendientesSociosTotal)}) pendientes de verificar por el tesorero o el administrador en "Gastos e ingresos". No suman al saldo hasta que se verifiquen.</p>` : ''}
    </div>
    <div class="card">
      <h2><span class="pin"></span>Proxima reunion</h2>
      ${proxima ? `
        
        <p style="margin:0 0 4px; font-weight:600;">${escapeHtml(proxima.evento)}</p>
        
        <p class="meta" style="margin:0;">${fmtDate(proxima.fecha)}</p>
        
        <p style="margin-top:10px; font-size:0.86rem; color:var(--chalk-dim);">${escapeHtml(proxima.notas||'')}</p>
      ` : `<p class="empty">No hay reuniones programadas.</p>`}
    </div>
  </div>

  <div class="card">
    <h2><span class="pin"></span>La pena esta reservada...</h2>
    ${proximasReservas.length===0 ? '<p class="empty">No hay reservas proximas. La pena esta libre.</p>' : proximasReservas.map(r=>`
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
    <h2><span class="pin"></span>Anadir socio</h2>
    <form data-form="add-socio" class="form-row" style="align-items:flex-end;">
      <div><label class="f">Nombre del nuevo socio</label><input type="text" name="nombre" required placeholder="Nombre y apellido"></div>
      <div><label class="f">PIN (opcional)</label><input type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" name="pin" placeholder="en blanco = automatico"></div>
      <div><label class="f">Foto (opcional)</label><input type="file" name="foto" accept="image/*"></div>
      <div style="flex:none;"><button class="btn" type="submit">Anadir socio</button></div>
    </form>
  </div>` : `<p class="readonly-note">Solo lectura, para ver consultar con el administrador.</p>`}
  <div class="card">
    ${state.socios.length===0 ? '<p class="empty">Todavia no hay socios.</p>' : state.socios.map(s=>{
      const perfil = state.perfiles[s.id] || {};
      const familia = perfil.familia || [];
      const puedeCambiarFoto = puedeGestionarSocios || s.id===state.current_user;
      return `<div class="list-item">

        <div class="socio-row-avatar">

          ${avatarHtml(s,'sm')}

          <div>

            <div style="font-weight:600; ${!s.activo?'opacity:0.5; text-decoration:line-through;':''}">${escapeHtml(s.nombre)} ${s.id===state.current_user?'<span class="tag ok">tu</span>':''}${roleNames(s).map(rn=>`<span class="tag">${escapeHtml(rn)}</span>`).join('')}${!s.activo?'<span class="tag warn">de baja</span>':''}${!s.tiene_pin?'<span class="tag warn">sin PIN</span>':''}</div>

            <div class="meta">${perfil.telefono ? '?? '+escapeHtml(perfil.telefono) : 'Sin telefono'} ${familia.length? '- '+familia.length+' familiar(es)':''}</div>

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
    <h2><span class="pin"></span>Cuotas mensuales <span style="font-size:0.9rem; color:var(--chalk-dim); font-family:'Work Sans';">(${money(state.config.cuota_mensual)}/mes)</span></h2>
    <p class="readonly-note">${admin ? 'Solo el tesorero o el administrador pueden marcar una cuota como pagada, previa comprobacion.' : 'Solo lectura: aqui puedes ver quien ha pagado y quien falta. Marcar una cuota como pagada es cosa del tesorero o del administrador.'}</p>
    <div class="year-nav">
      <button data-action="cuota-year" data-dir="-1">&laquo; ${cuotasYear-1}</button>
      <b>${cuotasYear}</b>
      <button data-action="cuota-year" data-dir="1">${cuotasYear+1} &raquo;</button>
    </div>
    ${state.socios.length===0 ? '<p class="empty">Anade socios primero en la pestana Socios.</p>' : `
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
function renderReservas(){
  const proximas = state.reservas.filter(r=>r.fecha >= todayISO()).sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const pasadas = state.reservas.filter(r=>r.fecha < todayISO()).sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,10);
  return `
  <div class="card">
    <h2><span class="pin"></span>Reservar la pena</h2>
    <form data-form="add-reserva">
      <div class="form-row">
        
        <div><label class="f">Fecha</label><input type="date" name="fecha" required value="${todayISO()}"></div>
        
        <div><label class="f">Evento</label><input type="text" name="evento" required placeholder="Ej: Cumpleanos, comida familiar..."></div>
      </div>
      <div class="form-row">
        
        <div><label class="f">Desde las (opcional)</label><input type="time" name="hora_inicio"></div>
        
        <div><label class="f">Hasta las (opcional)</label><input type="time" name="hora_fin"></div>
      </div>
      <p class="meta" style="margin:-4px 0 10px;">Deja las horas en blanco si la reserva es para todo el dia.</p>
      <div class="form-row"><div><label class="f">Notas</label><input type="text" name="notas" placeholder="opcional"></div></div>
      <button class="btn" type="submit">Reservar a mi nombre</button>
    </form>
  </div>
  <div class="card">
    <h2><span class="pin"></span>Proximas reservas</h2>
    ${proximas.length===0 ? '<p class="empty">La pena esta libre por ahora.</p>' : proximas.map(r=>`
      <div class="list-item">
        
        <div>
        
          <div style="font-weight:600;">${escapeHtml(r.evento)} <span class="meta">- ${fmtDate(r.fecha)} - ${fmtHoras(r)}</span></div>
        
          <div class="meta">Reservado por ${escapeHtml(socioNombre(r.socio_id))} ${r.notas?'- '+escapeHtml(r.notas):''}</div>
        
        </div>
        
        ${(r.socio_id===state.current_user || can('manage_events')) ? `<button class="btn danger small" data-action="delete-reserva" data-id="${r.id}">Cancelar</button>` : ''}
      </div>
    `).join('')}
  </div>
  <div class="card">
    <h2><span class="pin"></span>Calendario de reservas</h2>
    ${renderMiniCalendario(reservasCalFecha, state.reservas.map(r=>({fecha:r.fecha, label:r.evento+' - '+socioNombre(r.socio_id), detalle:`${r.evento}\n${fmtDate(r.fecha)} - ${fmtHoras(r)}\nReservado por ${socioNombre(r.socio_id)}${r.notas?'\n'+r.notas:''}`})), 'reservas-mes')}
  </div>
  ${pasadas.length ? `<div class="card">
    <h2><span class="pin"></span>Historial reciente</h2>
    ${pasadas.map(r=>`<div class="list-item"><div><div style="font-weight:600;">${escapeHtml(r.evento)} <span class="meta">- ${fmtDate(r.fecha)} - ${fmtHoras(r)}</span></div><div class="meta">${escapeHtml(socioNombre(r.socio_id))}</div></div></div>`).join('')}
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
    <h2><span class="pin"></span>Convocar reunion</h2>
    <form data-form="add-reunion">
      <div class="form-row">

        <div><label class="f">Fecha</label><input type="date" name="fecha" required value="${todayISO()}"></div>

        <div><label class="f">Tema</label><input type="text" name="evento" required placeholder="Ej: Reparto de gastos verano"></div>
      </div>
      <div class="form-row">

        <div><label class="f">Desde las (opcional)</label><input type="time" name="hora_inicio"></div>

        <div><label class="f">Hasta las (opcional)</label><input type="time" name="hora_fin"></div>
      </div>
      <div class="form-row"><div><label class="f">Notas / orden del dia</label><textarea name="notas" placeholder="De que se va a hablar..."></textarea></div></div>
      <button class="btn" type="submit">Anadir reunion</button>
    </form>
  </div>` : `<p class="readonly-note">Solo lectura, para ver consultar con el administrador.</p>`}
  <div class="card">
    <h2><span class="pin"></span>Calendario de reuniones</h2>
    ${renderMiniCalendario(reunionesCalFecha, state.reuniones.map(r=>({fecha:r.fecha, label:r.evento, detalle:`${r.evento}\n${fmtDate(r.fecha)} - ${fmtHoras(r)}\nConvocada por ${socioNombre(r.socio_id)}${r.notas?'\n'+r.notas:''}`})), 'reuniones-mes')}
  </div>
  <div class="card">
    <h2><span class="pin"></span>Historial</h2>
    ${ordenadas.length===0 ? '<p class="empty">Aun no hay reuniones.</p>' : ordenadas.map(r=>{
      const asistentes = r.asistentes || [];
      return `<div class="list-item">

        <div style="flex:1; min-width:0;">

          <div style="font-weight:600;">${escapeHtml(r.evento)} <span class="meta">- ${fmtDate(r.fecha)} - ${fmtHoras(r)}</span></div>

          <div class="meta" style="margin-top:2px;">Convocada por ${escapeHtml(socioNombre(r.socio_id))}</div>

          ${r.notas ? `<div class="meta" style="margin-top:2px;">${escapeHtml(r.notas)}</div>` : ''}

          <details style="margin-top:8px;">
            <summary>Asistentes (${asistentes.length})</summary>
            <div class="role-options" style="margin-top:8px;">
              ${state.socios.map(s=>`<button class="tag ${asistentes.includes(s.id)?'ok':''}" data-action="toggle-asistencia" data-reunion="${r.id}" data-socio="${s.id}" style="border:none;">${asistentes.includes(s.id)?'&check; ':''}${escapeHtml(s.nombre)}</button>`).join(' ')}
            </div>
          </details>

        </div>

        ${puedeGestionarEventos ? `<button class="btn danger small" data-action="delete-reunion" data-id="${r.id}">Borrar</button>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

/* ============ TRICOUNT (reparto de gastos por evento) ============ */
function renderNuevoEventoParticipantesWrap(){
  const disponibles = state.socios.filter(s=>s.activo && !nuevoEventoParticipantes.includes(s.id));
  return `
    <div class="role-options" style="margin-bottom:8px;">
      ${nuevoEventoParticipantes.length ? nuevoEventoParticipantes.map(sid=>`<span class="role-option">${escapeHtml(socioNombre(sid))}<input type="hidden" name="participantes" value="${sid}"><button type="button" data-action="quitar-participante-nuevo-evento" data-socio="${sid}" title="Quitar" style="background:none; border:none; color:var(--chalk-dim); padding:0; margin-left:2px;">x</button></span>`).join('') : '<span class="empty">Sin participantes anadidos todavia.</span>'}
    </div>
    ${disponibles.length ? `<div class="form-row" style="align-items:flex-end; margin-bottom:0;">
      <div><select id="nuevo-evento-participante-select">${disponibles.map(s=>`<option value="${s.id}">${escapeHtml(s.nombre)}</option>`).join('')}</select></div>
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
        <label class="f">Quien participa (marcate a ti mismo si vas a participar)</label>
        <div id="nuevo-evento-participantes-wrap">${renderNuevoEventoParticipantesWrap()}</div>
      </div>
      <button class="btn" type="submit">Crear evento</button>
    </form>
  </div>
  ${visibles.length===0 ? '<div class="card"><p class="empty">Todavia no hay eventos de Tricount.</p></div>' : visibles.map(ev=>renderGastoEvento(ev)).join('')}
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
      <span><span class="pin"></span>${escapeHtml(ev.nombre)} <span class="meta">- ${fmtDate(ev.fecha)}</span></span>
      <span style="display:flex; align-items:center; gap:10px;">
        <span style="font-family:'JetBrains Mono',monospace; font-weight:600; color:var(--amber);">${money(ev.total)}</span>
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
      <div><label class="f">Anadir participante</label><select data-nuevo-participante="${ev.id}">${noParticipantes.map(s=>`<option value="${s.id}">${escapeHtml(s.nombre)}</option>`).join('')}</select></div>
      <div style="flex:none;"><button type="button" class="btn ghost small" data-action="anadir-participante-evento" data-evento="${ev.id}">+ Anadir</button></div>
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
    ${pagos.length===0 ? '<p class="empty">Sin pagos todavia.</p>' : pagos.map(p=>{
      const puedeBorrarPago = p.pagador_id===state.current_user || puedeGestionarEvento;
      const beneficiarios = (p.beneficiarios&&p.beneficiarios.length) ? p.beneficiarios.map(socioNombre).join(', ') : 'todos los participantes';
      return `<div class="list-item">
        <div>
          <div style="font-weight:600;">${escapeHtml(p.concepto)}</div>
          <div class="meta">Pago de ${escapeHtml(socioNombre(p.pagador_id))} - ${fmtDate(p.fecha)} - reparte entre: ${escapeHtml(beneficiarios)}</div>
          ${p.ticket ? `<a href="/static/tickets/pago-${p.id}.jpg?v=${ticketVersion}" target="_blank" rel="noopener noreferrer" class="meta" style="color:var(--amber); display:inline-block; margin-top:2px;">Ver ticket</a>` : ''}
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
        <div><label class="f">Quien pago</label><select name="pagador_id">${(ev.participantes||[]).map(sid=>`<option value="${sid}" ${sid===state.current_user?'selected':''}>${escapeHtml(socioNombre(sid))}</option>`).join('')}</select></div>
        <div style="flex:2;"><label class="f">Concepto</label><input type="text" name="concepto" required placeholder="Ej: Cena, bebidas, gasolina..."></div>
        <div><label class="f">Importe (&euro;)</label><input type="number" step="0.01" min="0.01" name="importe" required></div>
      </div>
      <label class="f">Entre quien se reparte (deja todo marcado para repartir entre todos)</label>
      <div class="role-options" style="margin-bottom:10px;">
        ${(ev.participantes||[]).map(sid=>`<label class="role-option"><input type="checkbox" name="beneficiarios" value="${sid}" checked> ${escapeHtml(socioNombre(sid))}</label>`).join('')}
      </div>
      <button class="btn ghost" type="submit">Anadir pago</button>
    </form>` : '<p class="readonly-note" style="margin-top:14px;">Solo quien participa en el evento puede anadir pagos.</p>'}
  </div>`;
}

/* ============ INVENTARIO ============ */
function renderInventario(){
  const puedeGestionarInventario = can('manage_inventory');
  const porCategoria = {};
  CAT_INV.forEach(c=>porCategoria[c]=[]);
  state.inventario.forEach(i=>{ (porCategoria[i.categoria]||(porCategoria[i.categoria]=[])).push(i); });
  return `
  ${puedeGestionarInventario ? `
  <div class="card">
    <h2 style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <span><span class="pin"></span>Anadir material</span>
      ${can('export_data') ? `<button class="btn ghost small" data-action="export-excel" style="font-family:'Work Sans';">Exportar a Excel</button>` : ''}
    </h2>
    <form data-form="add-inventario">
      <div class="form-row">

        <div><label class="f">Nombre</label><input type="text" name="nombre" required placeholder="Ej: Nevera, plancha, mesas..."></div>

        <div><label class="f">Categoria</label><select name="categoria">${CAT_INV.map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">

        <div><label class="f">Cantidad</label><input type="number" name="cantidad" value="1" min="0"></div>

        <div><label class="f">Estado</label><select name="estado"><option>Bien</option><option>Necesita revision</option><option>Hay que comprar</option></select></div>

        <div><label class="f">Notas</label><input type="text" name="notas" placeholder="opcional"></div>
      </div>
      <button class="btn" type="submit">Anadir al inventario</button>
    </form>
  </div>` : `<div class="card"><p class="readonly-note">Solo lectura, para ver consultar con el administrador. ${can('export_data') ? `<button class="btn ghost small" data-action="export-excel" style="font-family:'Work Sans';">Exportar a Excel</button>` : ''}</p></div>`}
  ${CAT_INV.map(cat=>{
    const items = porCategoria[cat];
    if(!items || items.length===0) return '';
    return `<div class="card">
      <h2><span class="pin"></span>${cat}</h2>
      ${items.map(i=>`<div class="list-item">

        <div>

          <div style="font-weight:600;">${escapeHtml(i.nombre)} <span class="meta">- ${i.cantidad}</span></div>

          <div class="meta">${i.estado==='Hay que comprar'?'<span class="tag warn">Hay que comprar</span>':i.estado==='Necesita revision'?'<span class="tag warn">Revisar</span>':'<span class="tag ok">Bien</span>'} ${i.notas?escapeHtml(i.notas):''}</div>

        </div>

        ${puedeGestionarInventario ? `<button class="btn danger small" data-action="delete-inventario" data-id="${i.id}">Borrar</button>` : ''}
      </div>`).join('')}
    </div>`;
  }).join('')}
  ${state.inventario.length===0 ? '<div class="card"><p class="empty">Todavia no hay material registrado.</p></div>' : ''}
  `;
}

/* ============ CAJA ============ */
function renderGastoSocioItem(g){
  const puedeModificar = g.socio_id===state.current_user || can('manage_finances');
  const esIngreso = g.tipo==='ingreso';
  const estadoLabel = 'Pagado';
  if(editandoGastoSocioId===g.id){
    return `<form data-form="edit-gasto-socio" data-id="${g.id}" class="list-item" style="display:block;">
      <div class="form-row">
        <div><label class="f">Tipo</label><select name="tipo"><option value="gasto" ${!esIngreso?'selected':''}>Gasto</option><option value="ingreso" ${esIngreso?'selected':''}>Ingreso</option></select></div>
        <div style="flex:2;"><label class="f">Concepto</label><input type="text" name="concepto" required value="${escapeHtml(g.concepto)}"></div>
        <div><label class="f">Importe (EUR)</label><input type="number" name="importe" step="0.01" min="0.01" required value="${g.importe}"></div>
        <div><label class="f">Fecha</label><input type="date" name="fecha" required value="${g.fecha}"></div>
      </div>
      <div class="form-row"><div><label class="f">Notas</label><input type="text" name="notas" value="${escapeHtml(g.notas||'')}"></div></div>
      <div style="display:flex; gap:8px;">
        <button class="btn small" type="submit">Guardar</button>
        <button class="btn ghost small" type="button" data-action="cancelar-editar-gasto-socio">Cancelar</button>
      </div>
    </form>`;
  }
  return `<div class="list-item">
    <div>
      <div style="font-weight:600;">${escapeHtml(g.concepto)} <span class="tag">${esIngreso?'Ingreso':'Gasto'}</span> ${g.abonado?`<span class="tag ok">${estadoLabel}</span>`:'<span class="tag warn">Pendiente</span>'}</div>
      <div class="meta">${escapeHtml(g.socio_nombre||'-')} - ${fmtDate(g.fecha)}${g.notas?' - '+escapeHtml(g.notas):''}</div>
      ${g.ticket ? `<a href="/static/tickets/${g.id}.jpg?v=${ticketVersion}" target="_blank" rel="noopener noreferrer" class="meta" style="color:var(--amber); display:inline-block; margin-top:2px;">Ver ticket</a>` : ''}
    </div>
    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
      <span style="font-family:'JetBrains Mono',monospace; font-weight:600; color:${esIngreso?'var(--sage)':'var(--rust)'};">${esIngreso?'+':'-'} ${money(g.importe)}</span>
      ${can('manage_finances') ? `<button class="btn ghost small" data-action="toggle-abonado-gasto-socio" data-id="${g.id}">${g.abonado?'Marcar pendiente':'Marcar como pagado'}</button>` : ''}
      ${puedeModificar ? `<label class="btn ghost small" style="cursor:pointer;">${g.ticket?'Cambiar ticket (.jpg/.png)':'Subir ticket (.jpg/.png)'}<input type="file" accept="image/png,image/jpeg" data-autoupload-ticket="${g.id}" style="display:none;"></label>` : ''}
      ${puedeModificar ? `<button class="btn ghost small" data-action="editar-gasto-socio" data-id="${g.id}">Editar</button>` : ''}
      ${puedeModificar ? `<button class="btn danger small" data-action="delete-gasto-socio" data-id="${g.id}">Borrar</button>` : ''}
    </div>
  </div>`;
}
function renderMovimientoItem(m){
  const admin = can('manage_finances');
  if(admin && editandoMovimientoId===m.id){
    return `<form data-form="edit-movimiento" data-id="${m.id}" class="list-item" style="display:block;">
      <div class="form-row">
        <div><label class="f">Tipo</label><select name="tipo"><option value="gasto" ${m.tipo!=='ingreso'?'selected':''}>Gasto</option><option value="ingreso" ${m.tipo==='ingreso'?'selected':''}>Ingreso</option></select></div>
        <div><label class="f">Categoria</label><select name="categoria">${CAT_MOV.map(c=>`<option ${m.categoria===c?'selected':''}>${c}</option>`).join('')}</select></div>
        <div><label class="f">Fecha</label><input type="date" name="fecha" value="${m.fecha}" required></div>
      </div>
      <div class="form-row">
        <div><label class="f">Socio</label><select name="socio_id">
          <option value="">(sin socio)</option>
          ${state.socios.filter(s=>s.activo).map(s=>`<option value="${s.id}" ${m.socio_id===s.id?'selected':''}>${escapeHtml(s.nombre)}</option>`).join('')}
        </select></div>
        <div style="flex:2;"><label class="f">Concepto</label><input type="text" name="concepto" required value="${escapeHtml(m.concepto)}"></div>
        <div><label class="f">Importe (EUR)</label><input type="number" name="importe" step="0.01" min="0" required value="${m.importe}"></div>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn small" type="submit">Guardar</button>
        <button class="btn ghost small" type="button" data-action="cancelar-editar-movimiento">Cancelar</button>
      </div>
    </form>`;
  }
  return `<div class="list-item">
    <div>
      <div style="font-weight:600;">${escapeHtml(m.concepto)}</div>
      <div class="meta">
        <span class="tag">${m.categoria}</span>
        ${fmtDate(m.fecha)}
        ${m.socio_id ? `<span class="tag ok">Socio: ${escapeHtml(socioNombre(m.socio_id))}</span>` : ''}
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:10px;">
      <span style="font-family:'JetBrains Mono',monospace; font-weight:600; color:${m.tipo==='ingreso'?'var(--sage)':'var(--rust)'};">${m.tipo==='ingreso'?'+':'-'} ${money(m.importe)}</span>
      ${admin ? `<button class="btn ghost small" data-action="editar-movimiento" data-id="${m.id}">Editar</button>` : ''}
      ${admin ? `<button class="btn danger small" data-action="delete-movimiento" data-id="${m.id}">Borrar</button>` : ''}
    </div>
  </div>`;
}
function renderCaja(){
  const admin = can('manage_finances');
  const ordenados = [...state.movimientos].sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const gastosSocios = [...(state.gastos_socios||[])].sort((a,b)=>b.fecha.localeCompare(a.fecha));
  return `
  <div class="card">
    <h2><span class="pin"></span>Gastos e ingresos de socios</h2>
    <p class="meta" style="margin:-4px 0 10px;">Registra aqui un gasto que hayas pagado de tu bolsillo para la pena (para que el tesorero te lo pueda abonar) o un ingreso para que quede registrado y lo pueda comprobar el tesorero.</p>
    <form data-form="add-gasto-socio">
      <div class="form-row">
        <div><label class="f">Tipo</label><select name="tipo"><option value="gasto">Gasto</option><option value="ingreso">Ingreso</option></select></div>
        <div style="flex:2;"><label class="f">Concepto</label><input type="text" name="concepto" required placeholder="Ej: Bombillas para el salon"></div>
        <div><label class="f">Importe (EUR)</label><input type="number" name="importe" step="0.01" min="0.01" required></div>
        <div><label class="f">Fecha</label><input type="date" name="fecha" value="${todayISO()}" required></div>
      </div>
      <div class="form-row"><div><label class="f">Notas</label><input type="text" name="notas" placeholder="opcional"></div></div>
      <button class="btn" type="submit">Registrar</button>
    </form>
    ${gastosSocios.length===0 ? '<p class="empty" style="margin-top:12px;">Todavia no hay gastos registrados.</p>' : gastosSocios.map(g=>renderGastoSocioItem(g)).join('')}
  </div>
  ${admin ? `
  <div class="card">
    <h2><span class="pin"></span>Registrar movimiento</h2>
    <form data-form="add-movimiento">
      <div class="form-row">
        
        <div><label class="f">Tipo</label><select name="tipo"><option value="gasto">Gasto</option><option value="ingreso">Ingreso</option></select></div>
        
        <div><label class="f">Categoria</label><select name="categoria">${CAT_MOV.map(c=>`<option>${c}</option>`).join('')}</select></div>
        
        <div><label class="f">Fecha</label><input type="date" name="fecha" value="${todayISO()}" required></div>
      </div>
      <div class="form-row">
        
        <div><label class="f">Socio</label><select name="socio_id">
        
          <option value="">(sin socio)</option>
        
          ${state.socios.filter(s=>s.activo).map(s=>`<option value="${s.id}">${escapeHtml(s.nombre)}</option>`).join('')}
        
        </select></div>
        
        <div style="flex:2;"><label class="f">Concepto</label><input type="text" name="concepto" required placeholder="Ej: Factura de la luz - julio"></div>
        
        <div><label class="f">Importe (EUR)</label><input type="number" name="importe" step="0.01" min="0" required></div>
      </div>
      <button class="btn" type="submit">Guardar movimiento</button>
    </form>
  </div>` : `<p class="readonly-note">Solo lectura, para ver consultar con el administrador.</p>`}
  <div class="card">
    <h2 style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <span><span class="pin"></span>Movimientos</span>
      <span style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <select id="caja-mes-filtro">
          <option value="todos" ${cajaMesFiltro==='todos'?'selected':''}>Todos los meses</option>
          ${mesesDisponibles(state.movimientos.map(m=>m.fecha ? m.fecha.slice(0,7) : null)).map(k=>`<option value="${k}" ${cajaMesFiltro===k?'selected':''}>${labelMes(k)}</option>`).join('')}
        </select>
        ${can('export_data') ? `<button class="btn ghost small" data-action="export-excel" style="font-family:'Work Sans';">Exportar a Excel</button>` : ''}
      </span>
    </h2>
    ${(()=>{
      const filtrados = cajaMesFiltro==='todos' ? ordenados : ordenados.filter(m=>m.fecha && m.fecha.slice(0,7)===cajaMesFiltro);
      if(filtrados.length===0) return `<p class="empty">Sin movimientos ${cajaMesFiltro==='todos'?'registrados':'en ese mes'}.</p>`;
      return filtrados.map(m=>renderMovimientoItem(m)).join('');
    })()}
  </div>`;
}

/* ============ BEBIDAS ============ */
function renderBebidas(){
  return `
  <div class="subtabs" style="justify-content:space-between; flex-wrap:wrap;">
    <div style="display:flex; gap:6px;">
      <button class="subtab-btn ${bebidasSubtab==='consumo'?'active':''}" data-action="bebidas-subtab" data-sub="consumo">Consumo del dia a dia</button>
      <button class="subtab-btn ${bebidasSubtab==='fiestas'?'active':''}" data-action="bebidas-subtab" data-sub="fiestas">Fiestas / eventos</button>
    </div>
    <span style="display:flex; gap:8px; flex-wrap:wrap;">
      ${can('export_data') ? `<button class="btn ghost small" data-action="export-excel" style="font-family:'Work Sans';">Exportar a Excel</button>` : ''}
      ${isAdmin() ? `<label class="btn ghost small" style="cursor:pointer; font-family:'Work Sans';">Importar Excel<input type="file" accept=".xlsx" data-import-excel style="display:none;"></label>` : ''}
    </span>
  </div>
  ${bebidasSubtab==='consumo' ? renderBebidasConsumo() : renderBebidasFiestas()}
  `;
}

function renderBebidasConsumo(){
  const puedeGestionarBebidas = can('manage_bebidas');
  const precios = state.bebidas_precios;
  const consumos = [...state.bebidas_consumos].sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const misPendientes = misBebidasPendientes();
  return `
  ${misPendientes.length ? `
  <div class="card">
    <h2><span class="pin"></span>Mi deuda de bebidas pendiente</h2>
    ${misPendientes.map(c=>`<div class="menu-row"><span class="label">${escapeHtml(c.bebida_nombre||'Bebida')}<small>${c.cantidad} x - ${fmtDate(c.fecha)}</small></span><span class="dots"></span><span class="value rust">${money(c.importe)}</span></div>`).join('')}
    <div class="menu-row" style="border-top:1px solid var(--line); margin-top:8px; padding-top:8px;"><span class="label"><strong>Total pendiente</strong></span><span class="dots"></span><span class="value rust"><strong>${money(misPendientes.reduce((a,c)=>a+Number(c.importe||0),0))}</strong></span></div>
  </div>` : ''}
  ${puedeGestionarBebidas ? `
  <div class="card">
    <h2><span class="pin"></span>Precios</h2>
    <form data-form="add-bebida-precio">
      <div class="form-row">

        <div><label class="f">Bebida</label><input type="text" name="nombre" required placeholder="Ej: Cana, agua, refresco"></div>

        <div><label class="f">Unidad</label><input type="text" name="unidad" placeholder="Ej: vaso, botellon" required></div>
      </div>
      <div class="form-row">

        <div><label class="f">Precio socio (EUR)</label><input type="number" step="0.01" min="0" name="precio_socio" required></div>

        <div><label class="f">Precio no socio (EUR)</label><input type="number" step="0.01" min="0" name="precio_no_socio" required></div>
      </div>
      <button class="btn" type="submit">Anadir precio</button>
    </form>
    ${precios.length ? precios.map(p=>`
      <div class="menu-row">

        <span class="label">${escapeHtml(p.nombre)}<small>${escapeHtml(p.unidad)} - socio ${money(p.precio_socio)} / no socio ${money(p.precio_no_socio)}</small></span>

        <span class="dots"></span>

        <button class="btn danger small" data-action="delete-bebida-precio" data-id="${p.id}">Borrar</button>
      </div>`).join('') : '<p class="empty">Anade al menos una bebida con precio.</p>'}
  </div>` : `
  <div class="card">
    <h2><span class="pin"></span>Precios</h2>
    ${precios.length ? precios.map(p=>`
      <div class="menu-row">
        <span class="label">${escapeHtml(p.nombre)}<small>${escapeHtml(p.unidad)}</small></span>
        <span class="dots"></span>
        <span class="value">socio ${money(p.precio_socio)} / no socio ${money(p.precio_no_socio)}</span>
      </div>`).join('') : '<p class="empty">Todavia no hay precios cargados.</p>'}
    <p class="readonly-note" style="margin-top:10px;">Solo lectura: el administrador o el tesorero son quienes anaden precios y registran los consumos.</p>
  </div>`}
  <div class="card">
    <h2><span class="pin"></span>Registrar consumo</h2>
    ${precios.length===0 ? '<p class="empty">Primero anade precios de bebidas arriba.</p>' : `
    <form data-form="add-consumo">
      <div class="form-row">

        <div><label class="f">Quien consume</label>

          <select name="consumidorTipo">

            <option value="socio">Socio</option>

            <option value="invitado">Invitado / no socio</option>

          </select>

        </div>

        <div><label class="f">Nombre</label>

          <select name="socio_id">${state.socios.filter(s=>s.activo).map(s=>`<option value="${s.id}">${escapeHtml(s.nombre)}</option>`).join('')}</select>

          <input type="text" name="nombre_invitado" placeholder="Nombre del invitado" style="display:none; margin-top:6px;">

        </div>
      </div>
      <div class="form-row">

        <div><label class="f">Bebida</label><select name="bebida_id">${precios.map(p=>`<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join('')}</select></div>

        <div><label class="f">Cantidad</label><input type="number" name="cantidad" value="1" min="1"></div>
      </div>
      <div id="consumo-total" class="meta" style="margin:2px 0 12px; font-weight:600; font-size:0.95rem; color:var(--amber);">Total a pagar: ${money(precios.length ? Number(precios[0].precio_socio) : 0)}</div>
      <label class="role-option" style="margin-bottom:10px;"><input type="checkbox" name="pagado" checked> Pagado en el momento (si no, queda pendiente en la deuda del socio)</label>
      <button class="btn" type="submit">Registrar consumo</button>
    </form>
    `}
  </div>
  <div class="card">
    <h2><span class="pin"></span>Ultimos consumos <span style="font-size:0.85rem; color:var(--chalk-dim); font-family:'Work Sans';">- pagado: ${money(totalBebidasIngreso())} - pendiente: ${money(totalBebidasPendiente())}</span></h2>
    ${consumos.length===0 ? '<p class="empty">Sin consumos todavia.</p>' : consumos.slice(0,40).map(c=>{
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

function renderBebidasFiestas(){
  const gastos = [...state.fiestas_gastos].sort((a,b)=>b.fecha.localeCompare(a.fecha));
  return `
  <div class="card">
    <h2><span class="pin"></span>Gasto en bebida para una fiesta</h2>
    <form data-form="add-fiesta-gasto">
      <div class="form-row">

        <div><label class="f">Evento</label><input type="text" name="evento" required placeholder="Ej: Fiestas del pueblo, San Juan..."></div>

        <div><label class="f">Fecha</label><input type="date" name="fecha" value="${todayISO()}" required></div>
      </div>
      <div class="form-row">

        <div style="flex:2;"><label class="f">Concepto</label><input type="text" name="concepto" required placeholder="Ej: Barril de cerveza 30L, agua, refrescos..."></div>

        <div><label class="f">Importe (EUR)</label><input type="number" step="0.01" min="0" name="importe" required></div>
      </div>
      <button class="btn" type="submit">Anadir gasto</button>
    </form>
  </div>
  <div class="card">
    <h2><span class="pin"></span>Gastos de fiestas <span style="font-size:0.85rem; color:var(--chalk-dim); font-family:'Work Sans';">- total: ${money(totalFiestasGasto())}</span></h2>
    ${gastos.length===0 ? '<p class="empty">Sin gastos de fiestas todavia.</p>' : gastos.map(g=>`
      <div class="list-item">

        <div>

          <div style="font-weight:600;">${escapeHtml(g.concepto)}</div>

          <div class="meta"><span class="tag">${escapeHtml(g.evento)}</span> ${fmtDate(g.fecha)}</div>

        </div>

        <div style="display:flex; align-items:center; gap:10px;">

          <span style="font-family:'JetBrains Mono',monospace; color:var(--rust); font-weight:600;">- ${money(g.importe)}</span>

          <button class="btn danger small" data-action="delete-fiesta-gasto" data-id="${g.id}">Borrar</button>

        </div>
      </div>
    `).join('')}
  </div>`;
}

/* ============ TAREAS ============ */
const ESTADO_LABELS = {pendiente:'Pendiente', en_curso:'En curso', hecho:'Hecho'};
const ESTADO_CLASS = {pendiente:'warn', en_curso:'', hecho:'ok'};
const ESTADO_CICLO = {pendiente:'en_curso', en_curso:'hecho', hecho:'pendiente'};
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
    celdas.push(`<div class="cal-day">
      <div class="cal-day-num">${d}</div>
      ${dia.map(it=>`<button type="button" class="cal-ticket ${it.cls||''}" data-action="ver-evento-cal" data-detalle="${escapeHtml(it.detalle||it.label)}" title="${escapeHtml(it.label)}">${escapeHtml(it.label)}</button>`).join('')}
    </div>`);
  }

  return `
  <div class="year-nav">
    <button data-action="${navAction}" data-dir="-1">&larr; anterior</button>
    <b>${MESES[month]} ${year}</b>
    <button data-action="${navAction}" data-dir="1">siguiente &rarr;</button>
  </div>
  <div class="cal-grid">
    ${['Lun','Mar','Mie','Jue','Vie','Sab','Dom'].map(d=>`<div class="cal-weekday">${d}</div>`).join('')}
    ${celdas.join('')}
  </div>`;
}

function renderEncargados(){
  const tareas = state.tareas_tickets || [];
  const activas = tareas.filter(t=>t.estado!=='hecho');
  const historial = [...tareas.filter(t=>t.estado==='hecho')].sort((a,b)=>(b.completado_en||'').localeCompare(a.completado_en||''));
  const sinFecha = activas.filter(t=>!t.fecha && t.turno);
  const calItems = activas.filter(t=>t.fecha).map(t=>({fecha:t.fecha, label:t.tipo+(t.responsable_id?': '+socioNombre(t.responsable_id):''), cls:ESTADO_CLASS[t.estado], detalle:`${t.tipo}\n${fmtDate(t.fecha)}${t.turno?' - '+t.turno:''}\n${t.responsable_id?'Responsable: '+socioNombre(t.responsable_id):'Sin asignar'}\nEstado: ${t.estado}${t.notas?'\n'+t.notas:''}`}));
  return `
  <div class="card">
    <h2><span class="pin"></span>Nueva tarea</h2>
    <form data-form="add-tarea-ticket">
      <div class="form-row">
        <div><label class="f">Tipo</label><input type="text" name="tipo" list="tareas-tipos-list" required placeholder="Ej: Compras, Limpieza..."></div>
        <div><label class="f">Responsable</label><select name="responsable_id"><option value="">(sin asignar)</option>${state.socios.filter(s=>s.activo).map(s=>`<option value="${s.id}" ${s.id===state.current_user?'selected':''}>${escapeHtml(s.nombre)}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">
        <div><label class="f">Fecha (opcional)</label><input type="date" name="fecha"></div>
        <div><label class="f">Turno (opcional)</label><input type="text" name="turno" placeholder="Ej: Manana, tarde, noche..."></div>
        <div><label class="f">Rotacion</label><select name="rotacion">${ROTACION_OPCIONES.map(r=>`<option value="${r}">${r||'Ninguna'}</option>`).join('')}</select></div>
      </div>
      <div class="form-row"><div><label class="f">Notas</label><input type="text" name="notas" placeholder="opcional"></div></div>
      <datalist id="tareas-tipos-list">${state.tareas_fijas.map(t=>`<option value="${escapeHtml(t)}">`).join('')}</datalist>
      <button class="btn" type="submit">Crear tarea</button>
    </form>
  </div>
  <div class="card">
    <h2><span class="pin"></span>Tareas activas</h2>
    ${activas.length===0 ? '<p class="empty">No hay tareas activas.</p>' : activas.map(t=>renderTicketRow(t)).join('')}
  </div>
  ${sinFecha.length ? `<div class="card">
    <h2><span class="pin"></span>Tareas por turno (sin fecha fija)</h2>
    ${sinFecha.map(t=>renderTicketRow(t)).join('')}
  </div>` : ''}
  <div class="card">
    <h2><span class="pin"></span>Calendario de tareas</h2>
    ${renderMiniCalendario(tareasCalFecha, calItems, 'tareas-mes')}
  </div>
  ${historial.length ? `<div class="card">
    <h2><span class="pin"></span>Historial de tareas completadas</h2>
    ${historial.map(t=>renderTicketRow(t)).join('')}
  </div>` : ''}
  `;
}

function renderTicketRow(t){
  const puedeEditar = t.responsable_id===state.current_user || t.creado_por===state.current_user || can('manage_tasks');
  const estadoLabel = ESTADO_LABELS[t.estado]||t.estado;
  const estadoClass = ESTADO_CLASS[t.estado]||'';
  return `<div class="list-item">
    <div>
      <div style="font-weight:600;">${escapeHtml(t.tipo)} <span class="tag ${estadoClass}">${estadoLabel}</span>${t.rotacion?`<span class="tag">rotacion: ${escapeHtml(t.rotacion)}</span>`:''}</div>
      <div class="meta">${t.responsable_id?escapeHtml(socioNombre(t.responsable_id)):'Sin asignar'}${t.fecha?' - '+fmtDate(t.fecha):''}${t.turno?' - '+escapeHtml(t.turno):''}${t.completado_en?' - completada el '+fmtDate(t.completado_en.slice(0,10)):''}</div>
      ${t.notas?`<div class="meta" style="margin-top:2px;">${escapeHtml(t.notas)}</div>`:''}
    </div>
    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
      ${!t.responsable_id ? `<button class="btn ghost small" data-action="asignarme-ticket" data-id="${t.id}">+ Asignarme</button>` : ''}
      ${puedeEditar ? `<button class="btn ghost small" data-action="ciclar-estado-ticket" data-id="${t.id}" data-estado="${t.estado}">Cambiar estado</button>` : ''}
      ${puedeEditar ? `<button class="btn danger small" data-action="delete-tarea-ticket" data-id="${t.id}">Borrar</button>` : ''}
    </div>
  </div>`;
}

/* ============ PERFIL ============ */
function renderPerfil(){
  const me = state.socios.find(s=>s.id===state.current_user) || {nombre:''};
  const perfil = state.perfiles[state.current_user] || {telefono:'', notas:'', familia:[]};
  const familia = perfil.familia || [];
  return `
  <div class="card">
    <h2><span class="pin"></span>Mis datos</h2>
    <div class="foto-upload-row">
      ${avatarHtml(me,'lg')}
      <div>
        
        <label class="btn ghost small" style="cursor:pointer;">Cambiar foto<input type="file" accept="image/*" data-autoupload-foto="${state.current_user}" style="display:none;"></label>
        
        <p class="meta" style="margin-top:6px;">Se recorta en cuadrado automaticamente.</p>
      </div>
    </div>
    <form data-form="save-perfil">
      <div class="form-row">
        
        <div><label class="f">Mi nombre</label><input type="text" name="nombre" value="${escapeHtml(me.nombre||'')}" required></div>
        
        <div><label class="f">Telefono</label><input type="tel" name="telefono" value="${escapeHtml(perfil.telefono||'')}" placeholder="600 000 000"></div>
      </div>
      <div class="form-row"><div><label class="f">Notas (alergias, preferencias, lo que quieras)</label><textarea name="notas" placeholder="Ej: alergico a los frutos secos">${escapeHtml(perfil.notas||'')}</textarea></div></div>
      <button class="btn" type="submit">Guardar mis datos</button>
    </form>
  </div>
  <div class="card">
    <h2><span class="pin"></span>Seguridad</h2>
    <form data-form="change-pin" class="form-row" style="align-items:flex-end;">
      <div><label class="f">Nuevo PIN (4 digitos)</label><input type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" name="pin" required placeholder="****"></div>
      <div><label class="f">Repite el PIN</label><input type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" name="pin2" required placeholder="****"></div>
      <div style="flex:none;"><button class="btn ghost" type="submit">Cambiar mi PIN</button></div>
    </form>
  </div>
  <div class="card">
    <h2><span class="pin"></span>Mi familia</h2>
    ${familia.length===0 ? '<p class="empty">Aun no has anadido a nadie.</p>' : familia.map(f=>`
      <div class="familia-item">
        
        <span>${escapeHtml(f.nombre)} <span class="tag">${f.tipo}</span> ${f.edad?'- '+escapeHtml(String(f.edad))+' anos':''}</span>
        
        <button class="btn danger small" data-action="delete-familiar" data-id="${f.id}">Borrar</button>
      </div>
    `).join('')}
    <form data-form="add-familiar" style="margin-top:14px;">
      <div class="form-row">
        
        <div><label class="f">Nombre</label><input type="text" name="nombre" required></div>
        
        <div><label class="f">Relacion</label><select name="tipo">${TIPO_FAMILIA.map(t=>`<option>${t}</option>`).join('')}</select></div>
        
        <div><label class="f">Edad</label><input type="number" name="edad" min="0"></div>
      </div>
      <button class="btn ghost" type="submit">+ Anadir familiar</button>
    </form>
  </div>
  <div class="card">
    <h2><span class="pin"></span>Otros socios</h2>
    ${state.socios.filter(s=>s.id!==state.current_user).map(s=>{
      const p = state.perfiles[s.id]||{};
      const fam = p.familia||[];
      return `<div class="list-item"><div>
        
        <div style="font-weight:600;">${escapeHtml(s.nombre)}</div>
        
        <div class="meta">${p.telefono?'?? '+escapeHtml(p.telefono):'Sin telefono'} ${fam.length?'- '+fam.map(f=>escapeHtml(f.nombre)).join(', '):''}</div>
      </div></div>`;
    }).join('') || '<p class="empty">No hay mas socios.</p>'}
  </div>
  `;
}

/* ============ EVENTOS: clicks ============ */
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
    else if(action==='logout'){ await apiPost('/api/logout'); pendingLoginId = null; loginSearchQuery = ''; alertasAbiertas = false; await loadState(); render(); }
    else if(action==='edit-club-name'){
      const nombre = prompt('Nombre de la pena:', state.config.nombre);
      if(nombre && nombre.trim()){
        
        await apiPost('/api/config', {nombre: nombre.trim(), cuota_mensual: state.config.cuota_mensual ?? 45});
        
        await loadState(); render();
      }
    }
    else if(action==='edit-cuota'){
      const cuotaInput = prompt('Cuota mensual (EUR):', String(state.config.cuota_mensual ?? 45));
      if(cuotaInput !== null){
        
        const cuotaValue = Number(cuotaInput);
        
        await apiPost('/api/config', {
        
          nombre: state.config.nombre,
        
          cuota_mensual: Number.isFinite(cuotaValue) ? cuotaValue : (state.config.cuota_mensual ?? 45)
        
        });
        
        await loadState(); render();
      }
    }
    else if(action==='switch-tab'){ activeTab = btn.dataset.tab; render(); }
    else if(action==='bebidas-subtab'){ bebidasSubtab = btn.dataset.sub; render(); }
    else if(action==='cuota-year'){ cuotasYear += Number(btn.dataset.dir); render(); }
    else if(action==='resumen-grafico-year'){ resumenGraficoYear += Number(btn.dataset.dir); render(); }
    else if(action==='export-log-eventos'){ exportarLogEventos(); }
    else if(action==='toggle-ayuda'){ ayudaAbierta = !ayudaAbierta; render(); }
    else if(action==='toggle-alertas'){ alertasAbiertas = !alertasAbiertas; render(); }
    else if(action==='cerrar-alertas'){ alertasAbiertas = false; render(); }
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
        
        if(!confirm('Estas seguro de que quieres dar de baja a este socio?')) return;
      }
      await apiPost(`/api/socios/${btn.dataset.id}/activo`);
      await loadState(); render();
    }
    else if(action==='delete-socio'){
      if(!confirm('Eliminar este socio definitivamente? Se perderan sus datos relacionados.')) return;
      await apiDelete(`/api/socios/${btn.dataset.id}`);
      await loadState(); render();
    }
    else if(action==='reset-pin'){
      if(!confirm('Restablecer el PIN de este socio? Se generara uno nuevo y tendra que cambiarlo al entrar.')) return;
      const r = await apiPost(`/api/socios/${btn.dataset.id}/reset-pin`);
      await loadState(); render();
      alert(`Nuevo PIN temporal: ${r.pin}\n\nPasalo al socio - tendra que cambiarlo la proxima vez que entre.`);
    }
    else if(action==='toggle-asistencia'){
      await apiPost(`/api/reuniones/${btn.dataset.reunion}/asistencia`, {socio_id: btn.dataset.socio});
      await loadState(); render();
    }
    else if(action==='ver-evento-cal'){ alert(btn.dataset.detalle); }
    else if(action==='tareas-mes'){ tareasCalFecha.setMonth(tareasCalFecha.getMonth()+Number(btn.dataset.dir)); render(); }
    else if(action==='reservas-mes'){ reservasCalFecha.setMonth(reservasCalFecha.getMonth()+Number(btn.dataset.dir)); render(); }
    else if(action==='reuniones-mes'){ reunionesCalFecha.setMonth(reunionesCalFecha.getMonth()+Number(btn.dataset.dir)); render(); }
    else if(action==='asignarme-ticket'){
      await apiPost(`/api/tareas-tickets/${btn.dataset.id}`, {responsable_id: state.current_user});
      await loadState(); render();
    }
    else if(action==='ciclar-estado-ticket'){
      const siguiente = ESTADO_CICLO[btn.dataset.estado] || 'pendiente';
      const r = await apiPost(`/api/tareas-tickets/${btn.dataset.id}`, {estado: siguiente});
      await loadState(); render();
      if(r && r.nueva_tarea_generada){ alert('Tarea completada. Como tiene rotacion, se ha creado la siguiente automaticamente.'); }
    }
    else if(action==='delete-tarea-ticket'){
      if(confirm('Borrar esta tarea?')){ await apiDelete(`/api/tareas-tickets/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='delete-reunion'){
      if(confirm('Borrar esta reunion?')){ await apiDelete(`/api/reuniones/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='delete-inventario'){
      if(confirm('Borrar este material?')){ await apiDelete(`/api/inventario/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='delete-movimiento'){
      if(confirm('Borrar este movimiento?')){ await apiDelete(`/api/movimientos/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='editar-movimiento'){
      editandoMovimientoId = btn.dataset.id;
      render();
    }
    else if(action==='cancelar-editar-movimiento'){
      editandoMovimientoId = null;
      render();
    }
    else if(action==='toggle-abonado-gasto-socio'){
      await apiPost(`/api/gastos-socios/${btn.dataset.id}/abonado`);
      await loadState(); render();
    }
    else if(action==='editar-gasto-socio'){
      editandoGastoSocioId = btn.dataset.id;
      render();
    }
    else if(action==='cancelar-editar-gasto-socio'){
      editandoGastoSocioId = null;
      render();
    }
    else if(action==='delete-gasto-socio'){
      if(confirm('Borrar este gasto?')){
        editandoGastoSocioId = null;
        await apiDelete(`/api/gastos-socios/${btn.dataset.id}`);
        await loadState(); render();
      }
    }
    else if(action==='delete-bebida-precio'){
      if(confirm('Borrar esta bebida?')){ await apiDelete(`/api/bebidas/precios/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='delete-consumo'){
      if(confirm('Borrar este consumo?')){ await apiDelete(`/api/bebidas/consumos/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='toggle-consumo-pagado'){
      await apiPost(`/api/bebidas/consumos/${btn.dataset.id}/pagado`);
      await loadState(); render();
    }
    else if(action==='delete-fiesta-gasto'){
      if(confirm('Borrar este gasto?')){ await apiDelete(`/api/fiestas/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='delete-reserva'){
      if(confirm('Cancelar esta reserva?')){ await apiDelete(`/api/reservas/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='delete-gasto-evento'){
      if(confirm('Borrar este evento y todos sus pagos?')){ await apiDelete(`/api/gastos-eventos/${btn.dataset.id}`); await loadState(); render(); }
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
      if(confirm('Borrar este pago?')){ await apiDelete(`/api/gastos-eventos/${btn.dataset.evento}/pagos/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='delete-familiar'){
      await apiDelete(`/api/familiares/${btn.dataset.id}`); await loadState(); render();
    }
    else if(action==='export-excel'){
      const original = btn.textContent;
      btn.textContent = 'Generando...'; btn.disabled = true;
      try{
        
        const res = await fetch('/api/export.xlsx');
        
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
  if(e.target.id==='cuota-mes-movil'){
    cuotasMesMovil = Number(e.target.value);
    render();
    return;
  }
  if(e.target.id==='resumen-stat-mes'){
    resumenStatMes = e.target.value;
    render();
    return;
  }
  if(e.target.id==='caja-mes-filtro'){
    cajaMesFiltro = e.target.value;
    render();
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
  if(e.target.matches('[data-autoupload-foto]')){
    const file = e.target.files[0];
    if(!file) return;
    try{
      await uploadFoto(e.target.dataset.autouploadFoto, file);
      await loadState(); render();
    }catch(err){ alert(err.message || 'No se pudo subir la foto'); }
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
      let msg = 'Importacion completada:\n';
      for(const hoja of Object.keys(resumen)){
        const r = resumen[hoja];
        msg += `- ${hoja}: ${r.creados} creados, ${r.actualizados} actualizados`;
        msg += r.errores.length ? `, ${r.errores.length} con error\n` : '\n';
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

  try{
    if(type==='bootstrap-admin'){ await apiPost('/api/socios', data); }
    else if(type==='pin-login'){
      await apiPost('/api/login', {socio_id: pendingLoginId, pin: data.pin});
      saveFavoriteUser(pendingLoginId);
      pendingLoginId = null;
      await loadState(); activeTab='resumen'; render();
      return;
    }
    else if(type==='force-pin'){
      if(data.pin !== data.pin2){ alert('Los dos PIN no coinciden.'); return; }
      if(!/^[0-9]{4}$/.test(data.pin)){ alert('El PIN debe tener 4 digitos.'); return; }
      await apiPost('/api/perfil/pin', {pin: data.pin});
      await loadState(); activeTab='resumen'; render();
      return;
    }
    else if(type==='add-socio'){
      const fileInput = form.querySelector('input[name=foto]');
      const file = fileInput && fileInput.files[0];
      const r = await apiPost('/api/socios', {nombre: data.nombre, pin: data.pin || ''});
      if(file){
        
        try{ await uploadFoto(r.id, file); }
        
        catch(fe){ alert('El socio se creo, pero la foto no se pudo subir: '+fe.message); }
      }
      if(r.pin_generado){
        
        alert(`Socio creado. Su PIN de acceso es: ${r.pin_generado}\n\nApuntalo y pasaselo - podra cambiarlo luego desde "Mi perfil".`);
      }
    }
    else if(type==='add-reunion'){ await apiPost('/api/reuniones', data); }
    else if(type==='add-inventario'){ await apiPost('/api/inventario', data); }
    else if(type==='add-movimiento'){ await apiPost('/api/movimientos', data); }
    else if(type==='add-gasto-socio'){ await apiPost('/api/gastos-socios', data); }
    else if(type==='edit-gasto-socio'){
      await apiPost(`/api/gastos-socios/${form.dataset.id}`, data);
      editandoGastoSocioId = null;
    }
    else if(type==='edit-movimiento'){
      await apiPost(`/api/movimientos/${form.dataset.id}`, data);
      editandoMovimientoId = null;
    }
    else if(type==='add-bebida-precio'){ await apiPost('/api/bebidas/precios', data); }
    else if(type==='add-consumo'){
      data.es_socio = data.consumidorTipo==='socio';
      data.pagado = form.querySelector('[name=pagado]').checked;
      await apiPost('/api/bebidas/consumos', data);
    }
    else if(type==='add-fiesta-gasto'){ await apiPost('/api/fiestas', data); }
    else if(type==='add-reserva'){ await apiPost('/api/reservas', data); }
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
    else if(type==='add-tarea-ticket'){ await apiPost('/api/tareas-tickets', data); }
    else if(type==='add-role'){
      const permisos = new FormData(form).getAll('permisos');
      await apiPost('/api/roles', {nombre: data.nombre, permisos});
    }
    else if(type==='save-perfil'){ await apiPost('/api/perfil', data); }
    else if(type==='change-pin'){
      if(data.pin !== data.pin2){ alert('Los dos PIN no coinciden.'); return; }
      if(!/^[0-9]{4}$/.test(data.pin)){ alert('El PIN debe tener 4 digitos.'); return; }
      await apiPost('/api/perfil/pin', {pin: data.pin});
      form.reset();
      alert('PIN actualizado.');
    }
    else if(type==='add-familiar'){ await apiPost('/api/familiares', data); }

    await loadState();
    render();
  }catch(err){ alert(err.message || 'Ha ocurrido un error'); }
});

/* ============ actualizacion en segundo plano (casi tiempo real) ============ */
function isTyping(){
  const el = document.activeElement;
  if(el && (el.tagName==='INPUT' || el.tagName==='TEXTAREA' || el.tagName==='SELECT')) return true;
  // Si hay un desplegable abierto (elegir permisos, eventos ocultos...) no
  // refresques: el refresco automatico reconstruye el HTML y lo cerraria,
  // haciendo perder lo que se estuviera rellenando.
  if(document.querySelector('details[open]')) return true;
  return false;
}
setInterval(async ()=>{
  if(document.hidden || isTyping()) return;
  await loadState();
  render();
}, 30000);

/* ============ INIT ============ */
(async function init(){
  render();
  await loadBackgroundImages();
  initBackgroundSlideshow();
  await loadState();
  render();
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
  if(!confirm('Borrar este rol? Los socios que lo tengan lo perderan.')) return;
  try{
    await apiDelete(`/api/roles/${btn.dataset.id}`);
    await loadState();
    render();
  }catch(err){ alert(err.message || 'No se pudo borrar el rol.'); }
});