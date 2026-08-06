/* El Cado - frontend
   Habla con el backend Flask (app.py) v�a fetch(). El estado siempre
   vive en el servidor (SQLite) para que todos los socios vean lo mismo
   en tiempo real (se refresca solo cada 8s). */

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const CAT_MOV = ['Alquiler','Luz','Agua','Gas','Mantenimiento','Otros'];
const CAT_INV = ['Cocina','Mobiliario','Electr�nica','Otros'];
const TIPO_FAMILIA = ['Pareja','Hijo/a','Otro'];
const DIA_LIMITE_CUOTA = 5; // a partir de qu� d�a del mes se avisa de cuota pendiente
let BG_IMAGES = [];
const DEFAULT_BG_IMAGES = ['/static/backgrounds/bg-1.jpg','/static/backgrounds/bg-2.jpg','/static/backgrounds/bg-3.jpg','/static/backgrounds/bg-4.jpg','/static/backgrounds/bg-5.jpg','/static/backgrounds/bg-6.jpg'];
const PENA_LOCATION_URL = 'https://maps.app.goo.gl/z4ZBJix572Trhqf49';
let avatarVersion = Date.now();

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
let loaded = false;
let pendingLoginId = null; // socio seleccionado, esperando que escriba su PIN
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
    // Si hay usuario favorito guardado y est� activo, pre-seleccionarlo
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
function money(n){ return (Number(n)||0).toLocaleString('es-ES',{minimumFractionDigits:2, maximumFractionDigits:2}) + ' �'; }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function fmtDate(iso){
  if(!iso) return '';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function fmtHoras(r){
  if(!r.hora_inicio && !r.hora_fin) return 'Todo el d�a';
  if(r.hora_inicio && r.hora_fin) return `${r.hora_inicio} � ${r.hora_fin}`;
  return r.hora_inicio ? `desde las ${r.hora_inicio}` : `hasta las ${r.hora_fin}`;
}
function socioNombre(id){ const s = state.socios.find(s=>s.id===id); return s ? s.nombre : '�'; }
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
function escapeHtml(str){
  return String(str==null?'':str).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function timeAgoEs(iso){
  if(!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs/86400000);
  if(days<=0) return 'hoy';
  if(days===1) return 'ayer';
  return `hace ${days} d�as`;
}

/* ============ RENDER ROOT ============ */
function render(){
  updateBackgroundVisibility();
  const app = document.getElementById('app');
  if(!loaded){ app.innerHTML = `<div class="loading-screen">Abriendo la pe�a�</div>`; return; }
  if(!state.current_user){
    app.innerHTML = renderLogin();
    if(!loginDragInitialized){
      loginDragInitialized = true;
      initLoginDrag();
    }
    return;
  }
  const me = state.socios.find(s=>s.id===state.current_user);
  if(me && me.must_change_pin){ app.innerHTML = renderForcePin(me); return; }
  app.innerHTML = renderApp();
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
      <label class="f">Nuevo PIN (4 d�gitos, el que t� quieras)</label>
      <input type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" name="pin" required placeholder="����" autofocus
        
        style="text-align:center; font-size:1.4rem; letter-spacing:0.5rem; margin-bottom:10px;">
      <label class="f">Repite el PIN</label>
      <input type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" name="pin2" required placeholder="����"
        
        style="text-align:center; font-size:1.4rem; letter-spacing:0.5rem; margin-bottom:14px;">
      <button class="btn" type="submit" style="width:100%;">Guardar mi PIN y entrar</button>
    </form>
    <button class="btn ghost small" data-action="logout" style="margin-top:14px;">Cambiar de usuario</button>
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
        
            <p class="sub" style="margin-top:10px;">Hola, ${escapeHtml(s.nombre)}. ${s.tiene_pin ? 'Introduce tu PIN' : 'Todav�a no tienes PIN configurado, puedes entrar directamente'}</p>
        
            <form data-form="pin-login" style="margin-top:16px; max-width:300px; margin-left:auto; margin-right:auto;">
        
              <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" name="pin" placeholder="����" autofocus
        
                
        style="text-align:center; font-size:1.8rem; letter-spacing:0.8rem; padding:14px; border-radius:8px; border:1px solid var(--line); background:rgba(15,26,21,0.72); color:var(--chalk);">
        
              <button class="btn" type="submit" style="width:100%; margin-top:16px;">${s.tiene_pin ? 'Entrar' : 'Entrar y crear mi PIN luego'}</button>
        
            </form>
        
            <button class="btn ghost small" data-action="cancel-pin-login" style="margin-top:16px;">? Elegir otro socio</button>
        
          </div>
        
        </div>
      </div>`;
    }
    pendingLoginId = null;
  }

  return `
  <div class="login-wrap">
    <div class="login-header">
      <div class="login-header-content">
        
        ${logoBadge()}
        
        <h1>${escapeHtml(state.config.nombre)}</h1>
      </div>
    </div>
    <div class="login-panel">
      <div class="login-content-full">
        
        <div class="login-left-sidebar">
        
          ${socios.slice(0, Math.ceil(socios.length / 2)).map(s=>`<button class="user-chip-photo" data-action="select-user" data-id="${s.id}">${avatarHtml(s,'md')}<span>${escapeHtml(s.nombre)}</span></button>`).join('')}
        
        </div>
        
        <div class="login-center">
        
          ${sinSocios ? `
        
          <div class="login-panel-center">
        
            <div class="login-content">
        
              <form data-form="bootstrap-admin" style="margin-top:24px; text-align:left; max-width:320px; margin-left:auto; margin-right:auto;">
        
                
        <label class="f">Tu nombre</label>
        
                
        <input type="text" name="nombre" required placeholder="Nombre y apellido" style="margin-bottom:10px;">
        
                
        <label class="f">Elige un PIN de 4 d�gitos</label>
        
                
        <input type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" name="pin" required placeholder="����" style="margin-bottom:10px;">
        
                
        <button class="btn" type="submit" style="width:100%;">Crear pe�a y entrar como administrador</button>
        
              </form>
        
            </div>
        
          </div>
        
          ` : ``}
        
        </div>
        
        <div class="login-right-sidebar">
        
          ${socios.slice(Math.ceil(socios.length / 2)).map(s=>`<button class="user-chip-photo" data-action="select-user" data-id="${s.id}">${avatarHtml(s,'md')}<span>${escapeHtml(s.nombre)}</span></button>`).join('')}
        
        </div>
      </div>
    </div>
  </div>`;
}

function renderApp(){
  const me = state.socios.find(s=>s.id===state.current_user);
  return `
  <div class="container">
    <div class="header-panel">
      <div class="masthead">
        
        <div class="logo-row">${logoBadge()}<div><h1>${escapeHtml(state.config.nombre)}</h1><a href="${PENA_LOCATION_URL}" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; gap:6px; color:var(--amber); font-weight:600; text-decoration:none; margin-top:2px; font-size:0.92rem;">?? Ver ubicaci�n</a></div></div>
        
        ${can('manage_config') ? `<div style="display:flex; gap:8px; flex-wrap:wrap;">

          <button class="edit-name-btn" data-action="edit-club-name">? renombrar pe�a</button>

          <button class="edit-name-btn" data-action="edit-cuota">? cambiar cuota</button>

        </div>` : ''}
        
        <div class="user-bar">${me?avatarHtml(me,'sm'):''}<span class="live-dot"></span>Conectado como <b>${escapeHtml(me ? me.nombre : '')}</b>${isAdmin() ? '<span class="admin-badge">Admin</span>' : ''} � <button data-action="logout">cambiar usuario</button></div>
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
    case 'inventario': return renderInventario();
    case 'caja': return renderCaja();
    case 'bebidas': return renderBebidas();
    case 'encargados': return renderEncargados();
    case 'roles': return renderRoles();
    case 'perfil': return renderPerfil();
    default: return '';
  }
}

function renderRoles(){
  if(!isAdmin()) return '<p class="readonly-note">No tienes permiso para gestionar roles.</p>';
  const roles = state.roles || [];
  return `
  <div class="card">
    <h2><span class="pin"></span>Roles y permisos</h2>
    <p class="readonly-note">Un socio puede tener varios roles. Los cambios se aplican al momento y el servidor los comprueba en cada accion.</p>
    ${state.socios.map(s=>`
      <div class="list-item" style="align-items:flex-start;">
        <div style="flex:1;">
          <div style="font-weight:600; margin-bottom:8px;">${escapeHtml(s.nombre)} ${s.id===state.current_user?'<span class="tag ok">tu</span>':''}</div>
          <div class="role-options">
            ${roles.map(role=>`<label class="role-option"><input type="checkbox" data-role-option="${s.id}" value="${role.id}" ${(s.roles||[]).includes(role.id)?'checked':''}> ${escapeHtml(role.nombre)}</label>`).join('')}
          </div>
          <div class="custom-role-box">
            <label class="f">Otro rol personalizado</label>
            <input type="text" data-custom-role-name="${s.id}" placeholder="Ej: Vocal, encargado de compras">
            <div class="role-options permissions-options">
              ${Object.entries(state.permission_labels||{}).map(([id,label])=>`<label class="role-option"><input type="checkbox" data-custom-permission="${s.id}" value="${id}"> ${escapeHtml(label)}</label>`).join('')}
            </div>
            <button class="btn ghost small" data-action="create-custom-role" data-id="${s.id}">Crear y asignar rol</button>
          </div>
        </div>
        <button class="btn ghost small" data-action="save-roles" data-id="${s.id}">Guardar roles</button>
      </div>`).join('')}
  </div>
  <div class="card">
    <h2><span class="pin"></span>Permisos incluidos</h2>
    ${roles.map(role=>`<div class="menu-row"><span class="label">${escapeHtml(role.nombre)}<small>${(role.permisos||[]).map(p=>escapeHtml((state.permission_labels||{})[p]||p)).join(' · ') || 'Sin permisos especiales'}</small></span></div>`).join('')}
  </div>`;
}
/* ============ c�lculos ============ */
function totalIngresosCuotas(){ return state.cuotas.filter(c=>c.pagado).reduce((a,c)=>a+Number(c.importe||0),0); }
function totalIngresosMov(){ return state.movimientos.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+Number(m.importe||0),0); }
function totalGastosMov(){ return state.movimientos.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+Number(m.importe||0),0); }
function totalBebidasIngreso(){ return state.bebidas_consumos.reduce((a,c)=>a+Number(c.importe||0),0); }
function totalFiestasGasto(){ return state.fiestas_gastos.reduce((a,f)=>a+Number(f.importe||0),0); }
function saldoTotal(){
  const ingresos = totalIngresosCuotas() + totalIngresosMov() + totalBebidasIngreso();
  const gastos = totalGastosMov() + totalFiestasGasto();
  return ingresos - gastos;
}
function fiestasPorEvento(){
  const map = {};
  state.fiestas_gastos.forEach(f=>{
    map[f.evento] = (map[f.evento]||0) + Number(f.importe||0);
  });
  return Object.entries(map).sort((a,b)=>b[1]-a[1]);
}

/* ============ ALERTAS ============ */
function construirAlertas(){
  const alertas = [];
  const now = new Date();
  const hoy = now.getDate();

  if(hoy > DIA_LIMITE_CUOTA){
    const activos = state.socios.filter(s=>s.activo);
    activos.forEach(s=>{
      const c = state.cuotas.find(c=>c.socio_id===s.id && c.year===now.getFullYear() && c.month===now.getMonth()+1);
      if(!c || !c.pagado){
        
        alertas.push({tipo:'warn', texto:`${s.nombre} todav�a no ha pagado la cuota de ${MESES[now.getMonth()]}`});
      }
    });
  }

  const recientes = [];
  state.reservas.forEach(r=>{
    if(r.creado_en) recientes.push({fecha:r.creado_en, texto:`${socioNombre(r.socio_id)} reserv� la pe�a para el ${fmtDate(r.fecha)} (${escapeHtml(r.evento)})`});
  });
  state.reuniones.forEach(r=>{
    if(r.creado_en) recientes.push({fecha:r.creado_en, texto:`Se convoc� una reuni�n para el ${fmtDate(r.fecha)}: ${escapeHtml(r.titulo)}`});
  });
  recientes.sort((a,b)=>b.fecha.localeCompare(a.fecha));
  recientes.slice(0,5).forEach(r=>alertas.push({tipo:'info', texto:r.texto, meta:timeAgoEs(r.fecha)}));

  return alertas;
}

/* ============ RESUMEN ============ */
function renderResumen(){
  const now = new Date();
  const miCuota = state.cuotas.find(c=>c.socio_id===state.current_user && c.year===now.getFullYear() && c.month===now.getMonth()+1);
  const proximasReuniones = state.reuniones.filter(r=>r.fecha >= todayISO()).sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const proxima = proximasReuniones[0];
  const proximasReservas = state.reservas.filter(r=>r.fecha >= todayISO()).sort((a,b)=>a.fecha.localeCompare(b.fecha)).slice(0,3);
  const ingresosTotales = totalIngresosCuotas() + totalIngresosMov() + totalBebidasIngreso();
  const gastosTotales = totalGastosMov() + totalFiestasGasto();
  const saldo = ingresosTotales - gastosTotales;
  const alertas = construirAlertas();
  const fiestasEvento = fiestasPorEvento();

  return `
  <div class="stat-grid">
    <div class="stat ${saldo<0?'rust':'sage'}"><div class="n">${money(saldo)}</div><div class="l">Saldo de la pe�a</div></div>
    <div class="stat"><div class="n">${money(ingresosTotales)}</div><div class="l">Ingresos totales</div></div>
    <div class="stat"><div class="n">- ${money(gastosTotales)}</div><div class="l">Gastos totales</div></div>
  </div>

  ${alertas.length ? `
  <div class="card">
    <h2><span class="pin"></span>Avisos</h2>
    ${alertas.map(a=>`<div class="alert-item"><span class="dot ${a.tipo}"></span><div>${a.texto}${a.meta?` <span class="meta">� ${a.meta}</span>`:''}</div></div>`).join('')}
  </div>` : ''}

  <div class="card-grid">
    <div class="card">
      <h2 style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        
        <span><span class="pin"></span>Cuentas</span>

        ${can('export_data') ? `<button class="btn ghost small" data-action="export-excel" style="font-family:'Work Sans';">? Exportar a Excel</button>` : ''}
      </h2>
      <div class="menu-row"><span class="label">Cuotas cobradas</span><span class="dots"></span><span class="value sage">${money(totalIngresosCuotas())}</span></div>
      <div class="menu-row"><span class="label">Otros ingresos</span><span class="dots"></span><span class="value sage">${money(totalIngresosMov())}</span></div>
      <div class="menu-row"><span class="label">Bebidas (recaudado)</span><span class="dots"></span><span class="value sage">${money(totalBebidasIngreso())}</span></div>
      <div class="menu-row"><span class="label">Gastos generales</span><span class="dots"></span><span class="value rust">- ${money(totalGastosMov())}</span></div>
      <div class="menu-row"><span class="label">Gastos de fiestas</span><span class="dots"></span><span class="value rust">- ${money(totalFiestasGasto())}</span></div>
      <div class="menu-row" style="border-top:1px solid var(--line); margin-top:10px; padding-top:10px;"><span class="label"><strong>Saldo neto</strong></span><span class="dots"></span><span class="value ${saldo<0?'rust':'sage'}"><strong>${saldo<0?'- ':'+'}${money(Math.abs(saldo))}</strong></span></div>
    </div>
    <div class="card">
      <h2><span class="pin"></span>Pr�xima reuni�n</h2>
      ${proxima ? `
        
        <p style="margin:0 0 4px; font-weight:600;">${escapeHtml(proxima.titulo)}</p>
        
        <p class="meta" style="margin:0;">${fmtDate(proxima.fecha)}</p>
        
        <p style="margin-top:10px; font-size:0.86rem; color:var(--chalk-dim);">${escapeHtml(proxima.notas||'')}</p>
      ` : `<p class="empty">No hay reuniones programadas.</p>`}
    </div>
  </div>

  <div class="card">
    <h2><span class="pin"></span>La pe�a est� reservada...</h2>
    ${proximasReservas.length===0 ? '<p class="empty">No hay reservas pr�ximas. La pe�a est� libre.</p>' : proximasReservas.map(r=>`
      <div class="menu-row">
        
        <span class="label">${escapeHtml(r.evento)}<small>${socioNombre(r.socio_id)} � ${fmtHoras(r)}</small></span>
        
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
    <h2><span class="pin"></span>A�adir socio</h2>
    <form data-form="add-socio" class="form-row" style="align-items:flex-end;">
      <div><label class="f">Nombre del nuevo socio</label><input type="text" name="nombre" required placeholder="Nombre y apellido"></div>
      <div><label class="f">PIN (opcional)</label><input type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" name="pin" placeholder="en blanco = autom�tico"></div>
      <div><label class="f">Foto (opcional)</label><input type="file" name="foto" accept="image/*"></div>
      <div style="flex:none;"><button class="btn" type="submit">A�adir socio</button></div>
    </form>
  </div>` : `<p class="readonly-note">Solo lectura: quien gestiona socios es quien anade o da de baja socios.</p>`}
  <div class="card">
    ${state.socios.length===0 ? '<p class="empty">Todav�a no hay socios.</p>' : state.socios.map(s=>{
      const perfil = state.perfiles[s.id] || {};
      const familia = perfil.familia || [];
      const puedeCambiarFoto = puedeGestionarSocios || s.id===state.current_user;
      return `<div class="list-item">

        <div class="socio-row-avatar">

          ${avatarHtml(s,'sm')}

          <div>

            <div style="font-weight:600; ${!s.activo?'opacity:0.5; text-decoration:line-through;':''}">${escapeHtml(s.nombre)} ${s.id===state.current_user?'<span class="tag ok">t�</span>':''}${roleNames(s).map(rn=>`<span class="tag">${escapeHtml(rn)}</span>`).join('')}${!s.activo?'<span class="tag warn">de baja</span>':''}${!s.tiene_pin?'<span class="tag warn">sin PIN</span>':''}</div>

            <div class="meta">${perfil.telefono ? '?? '+escapeHtml(perfil.telefono) : 'Sin tel�fono'} ${familia.length? '� '+familia.length+' familiar(es)':''}</div>

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
      const puedeEditar = admin || s.id===state.current_user;
      const mine = s.id===state.current_user ? 'mine' : '';
      if(!puedeEditar){
        
        return `<td><button class="cuota-cell ${paid?'paid':''}" disabled title="Solo ${s.nombre} o el administrador pueden marcar esto"></button></td>`;
      }
      return `<td><button class="cuota-cell ${paid?'paid':''} ${mine}" data-action="toggle-cuota" data-socio="${s.id}" data-year="${cuotasYear}" data-month="${month}" title="${m} ${cuotasYear}">${paid?'?':''}</button></td>`;
    }).join('');
    return `<tr><td>${escapeHtml(s.nombre)}</td>${cells}</tr>`;
  }).join('');
  return `
  <div class="card">
    <h2><span class="pin"></span>Cuotas mensuales <span style="font-size:0.9rem; color:var(--chalk-dim); font-family:'Work Sans';">(${money(state.config.cuota_mensual)}/mes)</span></h2>
    <p class="readonly-note">${admin ? 'Con permiso para gestionar cuotas puedes marcar la cuota de cualquier socio.' : 'Solo puedes marcar tu propia cuota (columna resaltada en tu fila).'}</p>
    <div class="year-nav">
      <button data-action="cuota-year" data-dir="-1">? ${cuotasYear-1}</button>
      <b>${cuotasYear}</b>
      <button data-action="cuota-year" data-dir="1">${cuotasYear+1} ?</button>
    </div>
    ${state.socios.length===0 ? '<p class="empty">A�ade socios primero en la pesta�a Socios.</p>' : `
    <div style="overflow-x:auto;">
    <table class="cuotas-table">
      <thead><tr><th>Socio</th>${MESES.map(m=>`<th>${m}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
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
    <h2><span class="pin"></span>Reservar la pe�a</h2>
    <form data-form="add-reserva">
      <div class="form-row">
        
        <div><label class="f">Fecha</label><input type="date" name="fecha" required value="${todayISO()}"></div>
        
        <div><label class="f">Evento</label><input type="text" name="evento" required placeholder="Ej: Cumplea�os, comida familiar..."></div>
      </div>
      <div class="form-row">
        
        <div><label class="f">Desde las (opcional)</label><input type="time" name="hora_inicio"></div>
        
        <div><label class="f">Hasta las (opcional)</label><input type="time" name="hora_fin"></div>
      </div>
      <p class="meta" style="margin:-4px 0 10px;">Deja las horas en blanco si la reserva es para todo el d�a.</p>
      <div class="form-row"><div><label class="f">Notas</label><input type="text" name="notas" placeholder="opcional"></div></div>
      <button class="btn" type="submit">Reservar a mi nombre</button>
    </form>
  </div>
  <div class="card">
    <h2><span class="pin"></span>Pr�ximas reservas</h2>
    ${proximas.length===0 ? '<p class="empty">La pe�a est� libre por ahora.</p>' : proximas.map(r=>`
      <div class="list-item">
        
        <div>
        
          <div style="font-weight:600;">${escapeHtml(r.evento)} <span class="meta">� ${fmtDate(r.fecha)} � ${fmtHoras(r)}</span></div>
        
          <div class="meta">Reservado por ${escapeHtml(socioNombre(r.socio_id))} ${r.notas?'� '+escapeHtml(r.notas):''}</div>
        
        </div>
        
        ${(r.socio_id===state.current_user || can('manage_events')) ? `<button class="btn danger small" data-action="delete-reserva" data-id="${r.id}">Cancelar</button>` : ''}
      </div>
    `).join('')}
  </div>
  ${pasadas.length ? `<div class="card">
    <h2><span class="pin"></span>Historial reciente</h2>
    ${pasadas.map(r=>`<div class="list-item"><div><div style="font-weight:600;">${escapeHtml(r.evento)} <span class="meta">� ${fmtDate(r.fecha)} � ${fmtHoras(r)}</span></div><div class="meta">${escapeHtml(socioNombre(r.socio_id))}</div></div></div>`).join('')}
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
    <h2><span class="pin"></span>Convocar reuni�n</h2>
    <form data-form="add-reunion">
      <div class="form-row">

        <div><label class="f">Fecha</label><input type="date" name="fecha" required value="${todayISO()}"></div>

        <div><label class="f">Tema</label><input type="text" name="evento" required placeholder="Ej: Reparto de gastos verano"></div>
      </div>
      <div class="form-row">

        <div><label class="f">Desde las (opcional)</label><input type="time" name="hora_inicio"></div>

        <div><label class="f">Hasta las (opcional)</label><input type="time" name="hora_fin"></div>
      </div>
      <div class="form-row"><div><label class="f">Notas / orden del d�a</label><textarea name="notas" placeholder="De qu� se va a hablar..."></textarea></div></div>
      <button class="btn" type="submit">A�adir reuni�n</button>
    </form>
  </div>` : `<p class="readonly-note">Solo lectura: quien gestiona eventos es quien convoca reuniones.</p>`}
  <div class="card">
    <h2><span class="pin"></span>Historial</h2>
    ${ordenadas.length===0 ? '<p class="empty">A�n no hay reuniones.</p>' : ordenadas.map(r=>{
      const asistentes = r.asistentes || [];
      return `<div class="list-item">

        <div style="flex:1;">

          <div style="font-weight:600;">${escapeHtml(r.evento)} <span class="meta">� ${fmtDate(r.fecha)}</span></div>

          ${r.notas ? `<div class="meta" style="margin-top:2px;">${escapeHtml(r.notas)}</div>` : ''}

          <div style="margin-top:8px;">

            ${state.socios.map(s=>`<button class="tag ${asistentes.includes(s.id)?'ok':''}" data-action="toggle-asistencia" data-reunion="${r.id}" data-socio="${s.id}" style="border:none;">${asistentes.includes(s.id)?'? ':''}${escapeHtml(s.nombre)}</button>`).join(' ')}

          </div>

        </div>

        ${puedeGestionarEventos ? `<button class="btn danger small" data-action="delete-reunion" data-id="${r.id}">Borrar</button>` : ''}
      </div>`;
    }).join('')}
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
      <span><span class="pin"></span>A�adir material</span>
      ${can('export_data') ? `<button class="btn ghost small" data-action="export-excel" style="font-family:'Work Sans';">? Exportar a Excel</button>` : ''}
    </h2>
    <form data-form="add-inventario">
      <div class="form-row">

        <div><label class="f">Nombre</label><input type="text" name="nombre" required placeholder="Ej: Nevera, plancha, mesas..."></div>

        <div><label class="f">Categor�a</label><select name="categoria">${CAT_INV.map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">

        <div><label class="f">Cantidad</label><input type="number" name="cantidad" value="1" min="0"></div>

        <div><label class="f">Estado</label><select name="estado"><option>Bien</option><option>Necesita revisi�n</option><option>Hay que comprar</option></select></div>

        <div><label class="f">Notas</label><input type="text" name="notas" placeholder="opcional"></div>
      </div>
      <button class="btn" type="submit">A�adir al inventario</button>
    </form>
  </div>` : `<div class="card"><p class="readonly-note">Solo lectura: quien gestiona inventario es quien anade o borra material. ${can('export_data') ? `<button class="btn ghost small" data-action="export-excel" style="font-family:'Work Sans';">? Exportar a Excel</button>` : ''}</p></div>`}
  ${CAT_INV.map(cat=>{
    const items = porCategoria[cat];
    if(!items || items.length===0) return '';
    return `<div class="card">
      <h2><span class="pin"></span>${cat}</h2>
      ${items.map(i=>`<div class="list-item">

        <div>

          <div style="font-weight:600;">${escapeHtml(i.nombre)} <span class="meta">� ${i.cantidad}</span></div>

          <div class="meta">${i.estado==='Hay que comprar'?'<span class="tag warn">Hay que comprar</span>':i.estado==='Necesita revisi�n'?'<span class="tag warn">Revisar</span>':'<span class="tag ok">Bien</span>'} ${i.notas?escapeHtml(i.notas):''}</div>

        </div>

        ${puedeGestionarInventario ? `<button class="btn danger small" data-action="delete-inventario" data-id="${i.id}">Borrar</button>` : ''}
      </div>`).join('')}
    </div>`;
  }).join('')}
  ${state.inventario.length===0 ? '<div class="card"><p class="empty">Todav�a no hay material registrado.</p></div>' : ''}
  `;
}

/* ============ CAJA ============ */
function renderCaja(){
  const admin = can('manage_finances');
  const ordenados = [...state.movimientos].sort((a,b)=>b.fecha.localeCompare(a.fecha));
  return `
  ${admin ? `
  <div class="card">
    <h2><span class="pin"></span>Registrar movimiento</h2>
    <form data-form="add-movimiento">
      <div class="form-row">
        
        <div><label class="f">Tipo</label><select name="tipo"><option value="gasto">Gasto</option><option value="ingreso">Ingreso</option></select></div>
        
        <div><label class="f">Categor�a</label><select name="categoria">${CAT_MOV.map(c=>`<option>${c}</option>`).join('')}</select></div>
        
        <div><label class="f">Fecha</label><input type="date" name="fecha" value="${todayISO()}" required></div>
      </div>
      <div class="form-row">
        
        <div><label class="f">Socio</label><select name="socio_id">
        
          <option value="">(sin socio)</option>
        
          ${state.socios.filter(s=>s.activo).map(s=>`<option value="${s.id}">${escapeHtml(s.nombre)}</option>`).join('')}
        
        </select></div>
        
        <div style="flex:2;"><label class="f">Concepto</label><input type="text" name="concepto" required placeholder="Ej: Factura de la luz - julio"></div>
        
        <div><label class="f">Importe (�)</label><input type="number" name="importe" step="0.01" min="0" required></div>
      </div>
      <button class="btn" type="submit">Guardar movimiento</button>
    </form>
  </div>` : `<p class="readonly-note">Solo lectura: quien gestiona finanzas es quien registra los gastos e ingresos.</p>`}
  <div class="card">
    <h2 style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <span><span class="pin"></span>Movimientos</span>
      ${can('export_data') ? `<button class="btn ghost small" data-action="export-excel" style="font-family:'Work Sans';">? Exportar a Excel</button>` : ''}
    </h2>
    ${ordenados.length===0 ? '<p class="empty">Sin movimientos registrados.</p>' : ordenados.map(m=>`
      <div class="list-item">
        
        <div>
        
          <div style="font-weight:600;">${escapeHtml(m.concepto)}</div>
        
          <div class="meta">
        
            <span class="tag">${m.categoria}</span>
        
            ${fmtDate(m.fecha)}
        
            <span class="tag ${m.socio_id ? 'ok' : 'warn'}">${m.socio_id ? `Socio: ${escapeHtml(socioNombre(m.socio_id))}` : 'Sin socio'}</span>
        
          </div>
        
        </div>
        
        <div style="display:flex; align-items:center; gap:10px;">
        
          <span style="font-family:'JetBrains Mono',monospace; font-weight:600; color:${m.tipo==='ingreso'?'var(--sage)':'var(--rust)'};">${m.tipo==='ingreso'?'+':'-'} ${money(m.importe)}</span>
        
          ${admin ? `<button class="btn danger small" data-action="delete-movimiento" data-id="${m.id}">Borrar</button>` : ''}
        
        </div>
      </div>
    `).join('')}
  </div>`;
}

/* ============ BEBIDAS ============ */
function renderBebidas(){
  return `
  <div class="subtabs" style="justify-content:space-between; flex-wrap:wrap;">
    <div style="display:flex; gap:6px;">
      <button class="subtab-btn ${bebidasSubtab==='consumo'?'active':''}" data-action="bebidas-subtab" data-sub="consumo">Consumo del d�a a d�a</button>
      <button class="subtab-btn ${bebidasSubtab==='fiestas'?'active':''}" data-action="bebidas-subtab" data-sub="fiestas">Fiestas / eventos</button>
    </div>
    ${can('export_data') ? `<button class="btn ghost small" data-action="export-excel" style="font-family:'Work Sans';">? Exportar a Excel</button>` : ''}
  </div>
  ${bebidasSubtab==='consumo' ? renderBebidasConsumo() : renderBebidasFiestas()}
  `;
}

function renderBebidasConsumo(){
  const puedeGestionarBebidas = can('manage_bebidas');
  const precios = state.bebidas_precios;
  const consumos = [...state.bebidas_consumos].sort((a,b)=>b.fecha.localeCompare(a.fecha));
  return `
  ${puedeGestionarBebidas ? `
  <div class="card">
    <h2><span class="pin"></span>Precios (se paga en el momento)</h2>
    <form data-form="add-bebida-precio">
      <div class="form-row">

        <div><label class="f">Bebida</label><input type="text" name="nombre" required placeholder="Ej: Ca�a, agua, refresco"></div>

        <div><label class="f">Unidad</label><input type="text" name="unidad" placeholder="Ej: vaso, botell�n" required></div>
      </div>
      <div class="form-row">

        <div><label class="f">Precio socio (�)</label><input type="number" step="0.01" min="0" name="precio_socio" required></div>

        <div><label class="f">Precio no socio (�)</label><input type="number" step="0.01" min="0" name="precio_no_socio" required></div>
      </div>
      <button class="btn" type="submit">A�adir precio</button>
    </form>
    ${precios.length ? precios.map(p=>`
      <div class="menu-row">

        <span class="label">${escapeHtml(p.nombre)}<small>${escapeHtml(p.unidad)} � socio ${money(p.precio_socio)} / no socio ${money(p.precio_no_socio)}</small></span>

        <span class="dots"></span>

        <button class="btn danger small" data-action="delete-bebida-precio" data-id="${p.id}">Borrar</button>
      </div>`).join('') : '<p class="empty">A�ade al menos una bebida con precio.</p>'}
  </div>
  <div class="card">
    <h2><span class="pin"></span>Registrar consumo</h2>
    ${precios.length===0 ? '<p class="empty">Primero a�ade precios de bebidas arriba.</p>' : `
    <form data-form="add-consumo">
      <div class="form-row">

        <div><label class="f">Qui�n consume</label>

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
      <button class="btn" type="submit">Registrar (pagado al momento)</button>
    </form>
    `}
  </div>` : `<div class="card"><p class="readonly-note">Solo lectura: quien gestiona bebidas es quien registra precios y consumos.</p></div>`}
  <div class="card">
    <h2><span class="pin"></span>�ltimos consumos <span style="font-size:0.85rem; color:var(--chalk-dim); font-family:'Work Sans';">� recaudado total: ${money(totalBebidasIngreso())}</span></h2>
    ${consumos.length===0 ? '<p class="empty">Sin consumos todav�a.</p>' : consumos.slice(0,40).map(c=>{
      const bebida = precios.find(p=>p.id===c.bebida_id);
      return `<div class="list-item">

        <div>

          <div style="font-weight:600;">${escapeHtml(c.consumidor)} ${c.es_socio?'':'<span class="tag">invitado</span>'}</div>

          <div class="meta">${c.cantidad} � ${bebida?escapeHtml(bebida.nombre):'�'} � ${fmtDate(c.fecha)}</div>

        </div>

        <div style="display:flex; align-items:center; gap:10px;">

          <span style="font-family:'JetBrains Mono',monospace; color:var(--sage); font-weight:600;">+ ${money(c.importe)}</span>

          ${puedeGestionarBebidas ? `<button class="btn danger small" data-action="delete-consumo" data-id="${c.id}">Borrar</button>` : ''}

        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function renderBebidasFiestas(){
  const puedeGestionarFinanzas = can('manage_finances');
  const gastos = [...state.fiestas_gastos].sort((a,b)=>b.fecha.localeCompare(a.fecha));
  return `
  ${puedeGestionarFinanzas ? `
  <div class="card">
    <h2><span class="pin"></span>Gasto en bebida para una fiesta</h2>
    <form data-form="add-fiesta-gasto">
      <div class="form-row">

        <div><label class="f">Evento</label><input type="text" name="evento" required placeholder="Ej: Fiestas del pueblo, San Juan..."></div>

        <div><label class="f">Fecha</label><input type="date" name="fecha" value="${todayISO()}" required></div>
      </div>
      <div class="form-row">

        <div style="flex:2;"><label class="f">Concepto</label><input type="text" name="concepto" required placeholder="Ej: Barril de cerveza 30L, agua, refrescos..."></div>

        <div><label class="f">Importe (�)</label><input type="number" step="0.01" min="0" name="importe" required></div>
      </div>
      <button class="btn" type="submit">A�adir gasto</button>
    </form>
  </div>` : `<div class="card"><p class="readonly-note">Solo lectura: quien gestiona finanzas es quien registra gastos de fiestas.</p></div>`}
  <div class="card">
    <h2><span class="pin"></span>Gastos de fiestas <span style="font-size:0.85rem; color:var(--chalk-dim); font-family:'Work Sans';">� total: ${money(totalFiestasGasto())}</span></h2>
    ${gastos.length===0 ? '<p class="empty">Sin gastos de fiestas todav�a.</p>' : gastos.map(g=>`
      <div class="list-item">

        <div>

          <div style="font-weight:600;">${escapeHtml(g.concepto)}</div>

          <div class="meta"><span class="tag">${escapeHtml(g.evento)}</span> ${fmtDate(g.fecha)}</div>

        </div>

        <div style="display:flex; align-items:center; gap:10px;">

          <span style="font-family:'JetBrains Mono',monospace; color:var(--rust); font-weight:600;">- ${money(g.importe)}</span>

          ${puedeGestionarFinanzas ? `<button class="btn danger small" data-action="delete-fiesta-gasto" data-id="${g.id}">Borrar</button>` : ''}

        </div>
      </div>
    `).join('')}
  </div>`;
}

/* ============ TAREAS ============ */
function renderEncargados(){
  const admin = can('manage_tasks');
  return `
  <div class="card">
    <p class="readonly-note">Ap�ntate a las tareas de las que quieras encargarte. ${admin ? 'Como administrador puedes a�adir o quitar a cualquier socio.' : ''}</p>
  </div>
  ${state.tareas_fijas.map(tarea=>{
    const asignados = state.responsables[tarea] || [];
    const yaApuntado = asignados.includes(state.current_user);
    return `<div class="card tarea-card">
      <h2><span class="pin"></span>${tarea}</h2>
      <div class="chip-row">
        
        ${asignados.length===0 ? '<span class="empty">Nadie encargado todav�a.</span>' : asignados.map(sid=>`
        
          <span class="tarea-chip">${escapeHtml(socioNombre(sid))}
        
            ${(sid===state.current_user || admin) ? `<button data-action="toggle-tarea" data-tarea="${tarea}" data-socio="${sid}" title="Quitar">�</button>` : ''}
        
          </span>
        
        `).join('')}
      </div>
      ${admin ? `
      <div class="task-admin-list" style="margin-top:14px;">
        
        ${state.socios.map(s=>{
        
          const assigned = asignados.includes(s.id);
        
          return `<div class="list-item" style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:8px 0; border-top:1px solid rgba(255,255,255,0.06);">
        
            <div>${escapeHtml(s.nombre)}${assigned ? ' <span class="tag ok">asignado</span>' : ''}</div>
        
            <div>${assigned ? `<button class="btn danger small" data-action="toggle-tarea" data-tarea="${tarea}" data-socio="${s.id}">Quitar</button>` : `<button class="btn ghost small" data-action="toggle-tarea" data-tarea="${tarea}" data-socio="${s.id}">+ A�adir</button>`}</div>
        
          </div>`;
        
        }).join('')}
      </div>` : `
      ${!yaApuntado ? `<button class="btn ghost small" data-action="toggle-tarea" data-tarea="${tarea}" data-socio="${state.current_user}">+ Apuntarme</button>` : ''}`}
    </div>`;
  }).join('')}
  `;
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
        
        <p class="meta" style="margin-top:6px;">Se recorta en cuadrado autom�ticamente.</p>
      </div>
    </div>
    <form data-form="save-perfil">
      <div class="form-row">
        
        <div><label class="f">Mi nombre</label><input type="text" name="nombre" value="${escapeHtml(me.nombre||'')}" required></div>
        
        <div><label class="f">Tel�fono</label><input type="tel" name="telefono" value="${escapeHtml(perfil.telefono||'')}" placeholder="600 000 000"></div>
      </div>
      <div class="form-row"><div><label class="f">Notas (alergias, preferencias, lo que quieras)</label><textarea name="notas" placeholder="Ej: al�rgico a los frutos secos">${escapeHtml(perfil.notas||'')}</textarea></div></div>
      <button class="btn" type="submit">Guardar mis datos</button>
    </form>
  </div>
  <div class="card">
    <h2><span class="pin"></span>Seguridad</h2>
    <form data-form="change-pin" class="form-row" style="align-items:flex-end;">
      <div><label class="f">Nuevo PIN (4 d�gitos)</label><input type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" name="pin" required placeholder="����"></div>
      <div><label class="f">Repite el PIN</label><input type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" name="pin2" required placeholder="����"></div>
      <div style="flex:none;"><button class="btn ghost" type="submit">Cambiar mi PIN</button></div>
    </form>
  </div>
  <div class="card">
    <h2><span class="pin"></span>Mi familia</h2>
    ${familia.length===0 ? '<p class="empty">A�n no has a�adido a nadie.</p>' : familia.map(f=>`
      <div class="familia-item">
        
        <span>${escapeHtml(f.nombre)} <span class="tag">${f.tipo}</span> ${f.edad?'� '+escapeHtml(String(f.edad))+' a�os':''}</span>
        
        <button class="btn danger small" data-action="delete-familiar" data-id="${f.id}">Borrar</button>
      </div>
    `).join('')}
    <form data-form="add-familiar" style="margin-top:14px;">
      <div class="form-row">
        
        <div><label class="f">Nombre</label><input type="text" name="nombre" required></div>
        
        <div><label class="f">Relaci�n</label><select name="tipo">${TIPO_FAMILIA.map(t=>`<option>${t}</option>`).join('')}</select></div>
        
        <div><label class="f">Edad</label><input type="number" name="edad" min="0"></div>
      </div>
      <button class="btn ghost" type="submit">+ A�adir familiar</button>
    </form>
  </div>
  <div class="card">
    <h2><span class="pin"></span>Otros socios</h2>
    ${state.socios.filter(s=>s.id!==state.current_user).map(s=>{
      const p = state.perfiles[s.id]||{};
      const fam = p.familia||[];
      return `<div class="list-item"><div>
        
        <div style="font-weight:600;">${escapeHtml(s.nombre)}</div>
        
        <div class="meta">${p.telefono?'?? '+escapeHtml(p.telefono):'Sin tel�fono'} ${fam.length?'� '+fam.map(f=>escapeHtml(f.nombre)).join(', '):''}</div>
      </div></div>`;
    }).join('') || '<p class="empty">No hay m�s socios.</p>'}
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
    else if(action==='logout'){ await apiPost('/api/logout'); pendingLoginId = null; await loadState(); render(); }
    else if(action==='edit-club-name'){
      const nombre = prompt('Nombre de la pe�a:', state.config.nombre);
      if(nombre && nombre.trim()){
        
        await apiPost('/api/config', {nombre: nombre.trim(), cuota_mensual: state.config.cuota_mensual ?? 45});
        
        await loadState(); render();
      }
    }
    else if(action==='edit-cuota'){
      const cuotaInput = prompt('Cuota mensual (�):', String(state.config.cuota_mensual ?? 45));
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

    else if(action==='toggle-cuota'){
      await apiPost('/api/cuota/toggle', {socio_id: btn.dataset.socio, year: btn.dataset.year, month: btn.dataset.month});
      await loadState(); render();
    }
    else if(action==='toggle-activo'){
      if(btn.dataset.activo === '1'){
        
        if(!confirm('�Est�s seguro de que quieres dar de baja a este socio?')) return;
      }
      await apiPost(`/api/socios/${btn.dataset.id}/activo`);
      await loadState(); render();
    }
    else if(action==='delete-socio'){
      if(!confirm('�Eliminar este socio definitivamente? Se perder�n sus datos relacionados.')) return;
      await apiDelete(`/api/socios/${btn.dataset.id}`);
      await loadState(); render();
    }
    else if(action==='reset-pin'){
      if(!confirm('�Restablecer el PIN de este socio? Se generar� uno nuevo y tendr� que cambiarlo al entrar.')) return;
      const r = await apiPost(`/api/socios/${btn.dataset.id}/reset-pin`);
      await loadState(); render();
      alert(`Nuevo PIN temporal: ${r.pin}\n\nP�selo al socio � tendr� que cambiarlo la pr�xima vez que entre.`);
    }
    else if(action==='toggle-asistencia'){
      await apiPost(`/api/reuniones/${btn.dataset.reunion}/asistencia`, {socio_id: btn.dataset.socio});
      await loadState(); render();
    }
    else if(action==='toggle-tarea'){
      await apiPost('/api/responsables/toggle', {tarea: btn.dataset.tarea, socio_id: btn.dataset.socio});
      await loadState(); render();
    }
    else if(action==='delete-reunion'){
      if(confirm('�Borrar esta reuni�n?')){ await apiDelete(`/api/reuniones/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='delete-inventario'){
      if(confirm('�Borrar este material?')){ await apiDelete(`/api/inventario/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='delete-movimiento'){
      if(confirm('�Borrar este movimiento?')){ await apiDelete(`/api/movimientos/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='delete-bebida-precio'){
      if(confirm('�Borrar esta bebida?')){ await apiDelete(`/api/bebidas/precios/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='delete-consumo'){
      if(confirm('�Borrar este consumo?')){ await apiDelete(`/api/bebidas/consumos/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='delete-fiesta-gasto'){
      if(confirm('�Borrar este gasto?')){ await apiDelete(`/api/fiestas/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='delete-reserva'){
      if(confirm('�Cancelar esta reserva?')){ await apiDelete(`/api/reservas/${btn.dataset.id}`); await loadState(); render(); }
    }
    else if(action==='delete-familiar'){
      await apiDelete(`/api/familiares/${btn.dataset.id}`); await loadState(); render();
    }
    else if(action==='export-excel'){
      const original = btn.textContent;
      btn.textContent = 'Generando�'; btn.disabled = true;
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

document.addEventListener('change', async (e)=>{
  if(e.target.name==='consumidorTipo'){
    const form = e.target.closest('form');
    const isInvitado = e.target.value==='invitado';
    form.querySelector('[name=socio_id]').style.display = isInvitado ? 'none' : '';
    form.querySelector('[name=nombre_invitado]').style.display = isInvitado ? '' : 'none';
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
      if(!/^[0-9]{4}$/.test(data.pin)){ alert('El PIN debe tener 4 d�gitos.'); return; }
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
        
        catch(fe){ alert('El socio se cre�, pero la foto no se pudo subir: '+fe.message); }
      }
      if(r.pin_generado){
        
        alert(`Socio creado. Su PIN de acceso es: ${r.pin_generado}\n\nAp�ntalo y p�saselo � podr� cambiarlo luego desde "Mi perfil".`);
      }
    }
    else if(type==='add-reunion'){ await apiPost('/api/reuniones', data); }
    else if(type==='add-inventario'){ await apiPost('/api/inventario', data); }
    else if(type==='add-movimiento'){ await apiPost('/api/movimientos', data); }
    else if(type==='add-bebida-precio'){ await apiPost('/api/bebidas/precios', data); }
    else if(type==='add-consumo'){
      data.es_socio = data.consumidorTipo==='socio';
      await apiPost('/api/bebidas/consumos', data);
    }
    else if(type==='add-fiesta-gasto'){ await apiPost('/api/fiestas', data); }
    else if(type==='add-reserva'){ await apiPost('/api/reservas', data); }
    else if(type==='save-perfil'){ await apiPost('/api/perfil', data); }
    else if(type==='change-pin'){
      if(data.pin !== data.pin2){ alert('Los dos PIN no coinciden.'); return; }
      if(!/^[0-9]{4}$/.test(data.pin)){ alert('El PIN debe tener 4 d�gitos.'); return; }
      await apiPost('/api/perfil/pin', {pin: data.pin});
      form.reset();
      alert('PIN actualizado.');
    }
    else if(type==='add-familiar'){ await apiPost('/api/familiares', data); }

    await loadState();
    render();
  }catch(err){ alert(err.message || 'Ha ocurrido un error'); }
});

/* ============ actualizaci�n en segundo plano (casi tiempo real) ============ */
function isTyping(){
  const el = document.activeElement;
  return el && (el.tagName==='INPUT' || el.tagName==='TEXTAREA' || el.tagName==='SELECT');
}
setInterval(async ()=>{
  if(document.hidden || isTyping()) return;
  await loadState();
  render();
}, 8000);

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
  const btn = e.target.closest('[data-action="create-custom-role"]');
  if(!btn) return;
  const sid = btn.dataset.id;
  const input = document.querySelector(`input[data-custom-role-name="${sid}"]`);
  const nombre = input ? input.value.trim() : '';
  const permisos = [...document.querySelectorAll(`input[data-custom-permission="${sid}"]:checked`)].map(item=>item.value);
  if(!nombre){ alert('Escribe un nombre para el rol personalizado.'); return; }
  try{
    const created = await apiPost('/api/roles', {nombre, permisos});
    const roles = [...document.querySelectorAll(`input[data-role-option="${sid}"]:checked`)].map(item=>item.value);
    roles.push(created.id);
    await apiPost(`/api/socios/${sid}/roles`, {roles});
    await loadState();
    render();
  }catch(err){ alert(err.message || 'No se pudo crear el rol personalizado.'); }
});