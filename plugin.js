/* ============================================================
   SusejingCloud 1.0.0 «Tu nube en Kino»
   Plugin privado de Susejing: conecta Kino con el Servidor de
   Susejing (Node en su PC) y muestra sus carpetas: navegación,
   búsqueda y descarga. El contenido nunca sale del PC del autor:
   el plugin solo sabe hablar con el servidor que la persona
   escriba en Configurar, y el acceso lo protege la clave.
   ============================================================ */
'use strict';

const VERSION = '1.0.0';

const sinBarra = function (u) { return String(u || '').replace(/\/+$/, ''); };
const base = function () { return sinBarra(kino.config.get('server') || ''); };
const clave = function () { return String(kino.config.get('clave') || '').trim(); };
const enc = encodeURIComponent;

/* ---------- MIME (igual al del servidor) ---------- */
const MIME = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska', '.webm': 'video/webm', '.avi': 'video/x-msvideo',
  '.ts': 'video/mp2t', '.mpg': 'video/mpeg', '.mpeg': 'video/mpeg',
  '.3gp': 'video/3gpp', '.ogv': 'video/ogg', '.wmv': 'video/x-ms-wmv', '.flv': 'video/x-flv',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
  '.flac': 'audio/flac', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg', '.opus': 'audio/opus', '.wma': 'audio/x-ms-wma',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
  '.avif': 'image/avif', '.heic': 'image/heic'
};
function extDe(n) {
  const s = String(n || '').toLowerCase();
  const i = s.lastIndexOf('.');
  return i < 0 ? '' : s.slice(i);
}
function mimeDe(n) { return MIME[extDe(n)] || 'application/octet-stream'; }

/* ---------- Pedidos al servidor ---------- */
function cabeceras() {
  const k = clave();
  return k ? { 'x-clave': k } : {};
}

async function pedir(camino) {
  if (!base()) {
    throw kino.error('unavailable', 'falta la dirección del servidor', {
      userMessage: 'Escribe la dirección de tu servidor en Configurar (la imprime iniciar.bat).'
    });
  }
  let r;
  try {
    r = await kino.fetch(base() + camino, { headers: cabeceras() });
  } catch (e) {
    if (e && (e.code === 'network' || e.code === 'timeout')) {
      throw kino.error('unavailable', 'no se pudo conectar (' + e.code + ')', {
        userMessage: 'No se pudo conectar con tu servidor. Deja correr iniciar.bat en el PC y revisa que estés en la misma WiFi.'
      });
    }
    throw e;
  }
  if (r.status === 401) {
    throw kino.error('auth_required', 'clave incorrecta', {
      userMessage: 'La clave no coincide: revísala en Configurar de SusejingCloud.'
    });
  }
  if (r.status === 404) throw kino.error('not_found', 'el servidor no conoce esa ruta (' + r.status + ')');
  if (!r.ok) throw kino.error('unavailable', 'el servidor respondió ' + r.status);
  return r.json();
}

/* Caché corta (60 s) de listados para no repetir pedidos al navegar.
   Toda llave lleva el servidor y la clave por si cambian bajo nuestros pies. */
function llaveLista(c, r) {
  return 'lista:' + base() + '|' + (clave() ? 'k' : '') + '|' + c + '|' + (r || '');
}
async function lista(c, r) {
  const k = llaveLista(c, r);
  const guardada = kino.storage.get(k);
  if (guardada) {
    try {
      const v = JSON.parse(guardada);
      if (v && v.d && Date.now() - v.t < 60000) return v.d;
    } catch (e) { /* caché rota: se pide de nuevo */ }
  }
  const d = await pedir('/api/lista?c=' + enc(c) + (r ? '&r=' + enc(r) : ''));
  try { kino.storage.set(k, JSON.stringify({ t: Date.now(), d: d })); } catch (e) { /* sin espacio: nada */ }
  return d;
}
async function ping() {
  const k = 'ping:' + base() + '|' + (clave() ? 'k' : '');
  const guardada = kino.storage.get(k);
  if (guardada) {
    try {
      const v = JSON.parse(guardada);
      if (v && v.d && Date.now() - v.t < 60000) return v.d;
    } catch (e) { /* nada */ }
  }
  const d = await pedir('/api/ping');
  try { kino.storage.set(k, JSON.stringify({ t: Date.now(), d: d })); } catch (e) { /* nada */ }
  return d;
}

/* ---------- Refs ---------- */
/* 'carpeta:<c>'          → página completa de una carpeta (desde una fila del Inicio)
   'folder:<c>|<rel>'     → subcarpeta (se abre como serie, sus carpetas son temporadas)
   'ver:<c>|<rel>'        → archivo (película) */
function partirRef(ref) {
  const m = /^([a-z]+):([^|]+)\|([\s\S]*)$/.exec(String(ref || ''));
  return m ? { tipo: m[1], c: m[2], r: m[3] } : null;
}

function archivoItem(c, rel, nombreArchivo, tipo) {
  const r = rel ? rel + '/' + nombreArchivo : nombreArchivo;
  return {
    id: 'ver:' + c + '|' + r,
    ref: 'ver:' + c + '|' + r,
    title: nombreArchivo,
    kind: 'movie'
  };
}

function carpetaItem(c, rel, nombreCarpeta) {
  const r = rel ? rel + '/' + nombreCarpeta : nombreCarpeta;
  const ref = 'folder:' + c + '|' + r;
  return { id: ref, ref: ref, title: nombreCarpeta, kind: 'series' };
}

function pagina(items, cursor, paso) {
  const t = paso || 40;
  const i = Math.max(0, parseInt(cursor, 10) || 0);
  const trozo = items.slice(i, i + t);
  return { items: trozo, next: i + t < items.length ? String(i + t) : undefined };
}

/* ---------- Home: una fila por cada carpeta servida ---------- */
export async function home() {
  const p = await ping();
  const filas = [];
  const hojas = p.carpetas || [];
  for (let i = 0; i < hojas.length; i++) {
    const c = hojas[i];
    let d;
    try {
      d = await lista(c.id, '');
    } catch (e) { continue; /* una carpeta caída no tumba el Inicio */ }
    const items = d.archivos.slice(0, 12).map(function (a) { return archivoItem(c.id, '', a.nombre, a.tipo); });
    if (!items.length && d.carpetas.length) {
      const cuantas = d.carpetas.length;
      const entrada = carpetaItem(c.id, '', d.carpetas[0].nombre);
      entrada.title = cuantas === 1 ? '1 subcarpeta en ' + c.nombre : cuantas + ' subcarpetas en ' + c.nombre;
      items.push(entrada);
    }
    if (!items.length) continue;
    filas.push({ id: 'car' + c.id, title: c.nombre, ref: 'carpeta:' + c.id, items: items });
  }
  if (!filas.length) throw kino.error('unavailable', 'el servidor no tiene carpetas servidas', {
    userMessage: 'Tu servidor está conectado pero no tiene carpetas: abre su página web y agrega algunas.'
  });
  return filas;
}

/* ---------- Navegación (Ver más) ---------- */
export async function browse(ref, cursor) {
  let c = null, r = '';
  if (String(ref).indexOf('carpeta:') === 0) {
    c = String(ref).slice('carpeta:'.length);
  } else {
    const p = partirRef(ref);
    if (!p || p.tipo !== 'folder') throw kino.error('not_found', 'página desconocida');
    c = p.c; r = p.r;
  }
  const d = await lista(c, r);
  const items = d.carpetas.map(function (x) { return carpetaItem(c, r, x.nombre); })
    .concat(d.archivos.map(function (a) { return archivoItem(c, r, a.nombre, a.tipo); }));
  return pagina(items, cursor);
}

/* ---------- Subcarpeta como serie: sus carpetas son temporadas ---------- */
export async function episodes(ref) {
  const p = partirRef(ref);
  if (!p || (p.tipo !== 'folder' && p.tipo !== 'foldera')) throw kino.error('not_found');
  const d = await lista(p.c, p.r);
  const rel = p.r || '';
  const prefijoR = rel ? rel + '/' : '';

  const temporadas = [];
  const puedoAgregarArchivos = (function () {
    // sin archivos y sin carpetas: carpeta vacía
    return d.archivos.length || d.carpetas.length;
  })();
  if (!puedoAgregarArchivos) throw kino.error('not_found', 'carpeta vacía');

  const nombreSerie = rel ? rel.split('/').pop() : 'Mi carpeta';
  const episodios = d.archivos.map(function (a, i) {
    return {
      season: 1,
      number: i + 1,
      ref: 'ver:' + p.c + '|' + prefijoR + a.nombre,
      title: a.nombre
    };
  });
  if (d.archivos.length) {
    temporadas.push({
      id: 'aqui:' + p.c + '|' + rel,
      ref: 'foldera:' + p.c + '|' + rel,
      title: 'Archivos aquí',
      number: d.carpetas.length + 1,
      current: p.tipo === 'foldera'
    });
  }
  d.carpetas.forEach(function (s, i) {
    temporadas.push({
      id: 'temp:' + p.c + '|' + prefijoR + s.nombre,
      ref: 'folder:' + p.c + '|' + prefijoR + s.nombre,
      title: s.nombre,
      number: i + 1,
      current: false
    });
  });

  return {
    series: { title: nombreSerie },
    episodes: episodios,
    seasons: temporadas.length ? temporadas : undefined
  };
}

/* ---------- Búsqueda global en los discos ---------- */
export async function search(query) {
  const q = String((query && query.q) || '').trim();
  if (q.length < 2) return [];
  const p = await pedir('/api/buscar?q=' + enc(q));
  const resultados = (p.resultados || []).slice(0, 50);
  return resultados.map(function (x) {
    /* el servidor manda ruta (relativa completa) + nombre (solo archivo);
       en la raíz, ruta === nombre y la parte de carpetas es vacía */
    const rc = String(x.ruta || '');
    const rel = (rc.length > x.nombre.length && rc.slice(-x.nombre.length - 1) === '/' + x.nombre)
      ? rc.slice(0, rc.length - x.nombre.length - 1) : '';
    const it = archivoItem(x.c, rel, x.nombre, x.tipo);
    return it;
  });
}

/* ---------- Reproducción (y descarga: es declarativa) ---------- */
export async function resolve(ref) {
  const p = partirRef(ref);
  if (!p || p.tipo !== 'ver') throw kino.error('not_found', 'archivo desconocido');
  const nombre = p.r.split('/').pop();
  return {
    url: base() + '/api/archivo?c=' + enc(p.c) + '&r=' + enc(p.r),
    mime: mimeDe(nombre),
    headers: cabeceras()
  };
}

/* ---------- Ajustes: estado y botón de prueba ---------- */
export async function settingsStatus() {
  if (!base()) return { estado: 'Escribe la dirección de tu servidor (la imprime iniciar.bat).' };
  try {
    const p = await pedir('/api/ping');
    const n = (p.carpetas || []).length;
    return { estado: 'Conectado ✓ · ' + (p.nombre || 'SusejingCloud') + ' · ' + n + (n === 1 ? ' carpeta' : ' carpetas') };
  } catch (e) {
    return { estado: 'Sin conexión. ¿Está corriendo iniciar.bat en el PC?' };
  }
}

export async function action(key) {
  if (key !== 'probar') return null;
  if (!base()) return { message: 'Primero escribe la dirección de tu servidor.' };
  try {
    const p = await pedir('/api/ping');
    const n = (p.carpetas || []).length;
    return { message: '¡Conectado! El servidor «' + (p.nombre || 'SusejingCloud') + '» tiene ' + n + (n === 1 ? ' carpeta.' : ' carpetas.') };
  } catch (e) {
    const texto = e && e.message ? 'No se pudo conectar: ' + e.message : 'No se pudo conectar.';
    return { message: texto.slice(0, 300) };
  }
}

export { home, browse, episodes, search, resolve, settingsStatus, action };
