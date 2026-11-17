/* ============================================================
   SuseCloud v0.1.0 «La otra punta»
   El cliente de Kino para el servidor que corre en tu PC
   (susejing-server.js). Tus discos, tus archivos, tu red.
   Refs internos:
     'v:<idCarpeta>:<rutaRelativa>'  → archivo reproducible
     'd:<idCarpeta>:<rutaRelativa>'  → carpeta para navegar
   ============================================================ */
const VERSION = '0.1.0';

const MIME = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mkv': 'video/x-matroska',
  '.webm': 'video/webm', '.avi': 'video/x-msvideo', '.mov': 'video/quicktime',
  '.mpg': 'video/mpeg', '.mpeg': 'video/mpeg', '.ts': 'video/mp2t',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
  '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/opus',
  '.flac': 'audio/flac', '.wav': 'audio/wav', '.wma': 'audio/x-ms-wma'
};

const sinBarra = function (u) { return String(u || '').trim().replace(/\/+$/, ''); };
const ef = encodeURIComponent;
const base = function () { return sinBarra(kino.config.get('server')); };
const laClave = function () { return String(kino.config.get('clave') || ''); };

function extDe(nombre) {
  const p = String(nombre || '').lastIndexOf('.');
  return p < 0 ? '' : String(nombre).slice(p).toLowerCase();
}
function mimeDe(nombre) {
  return MIME[extDe(nombre)] || 'application/octet-stream';
}
function sinExtension(nombre) {
  const p = String(nombre).lastIndexOf('.');
  return p <= 0 ? String(nombre) : String(nombre).slice(0, p);
}
function tamanoLegible(n) {
  n = Number(n) || 0;
  if (n >= 1073741824) return (n / 1073741824).toFixed(1) + ' GB';
  if (n >= 1048576) return Math.round(n / 1048576) + ' MB';
  if (n >= 1024) return Math.round(n / 1024) + ' KB';
  return String(Math.round(n)) + ' B';
}

/* Llamada con la clave, como pide el servidor (header x-clave). */
async function api(camino) {
  const r = await kino.fetch(base() + camino, { headers: { 'x-clave': laClave() } });
  if (r.status === 401) throw kino.error('auth_required', 'La clave no sirve: revísala en Configurar.');
  if (!r.ok) throw kino.error('unavailable', 'El servidor respondió ' + r.status + ' a ' + camino);
  return r.json();
}

function partir(ref) {
  const p = String(ref || '').split(':');
  return { tipo: p[0], c: p[1] || '', ruta: p.slice(2).join(':') };
}
function refArchivo(c, ruta, nombre) {
  return 'v:' + c + ':' + (ruta ? ruta + '/' : '') + nombre;
}
function refCarpeta(c, ruta, nombre) {
  return 'd:' + c + ':' + (ruta ? ruta + '/' + nombre : nombre);
}
function texto_de_tipo(tipo) {
  if (tipo === 'video') return 'Video';
  if (tipo === 'audio') return 'Audio';
  return tipo || 'Archivo';
}

function itemDeArchivo(c, ruta, a) {
  const ref = refArchivo(c, ruta, a.nombre);
  return {
    id: ref,
    ref: ref,
    title: sinExtension(a.nombre),
    kind: a.tipo === 'audio' ? 'music' : 'movie',
    overview: texto_de_tipo(a.tipo) + ' · ' + tamanoLegible(a.bytes),
    badges: [texto_de_tipo(a.tipo)]
  };
}
function itemDeCarpeta(c, ruta, nombre) {
  const ref = refCarpeta(c, ruta, nombre);
  return {
    id: ref,
    ref: ref,
    title: nombre,
    kind: 'series',
    overview: 'Carpeta'
  };
}

/* ---------- Home: una fila por cada carpeta servida ---------- */
export async function home() {
  let ping;
  try {
    ping = await api('/api/ping');
  } catch (e) {
    return [];
  }
  const carpetas = Array.isArray(ping.carpetas) ? ping.carpetas : [];
  const filas = [];
  for (let i = 0; i < carpetas.length && i < 8; i++) {
    const c = carpetas[i];
    let l;
    try {
      l = await api('/api/lista?c=' + ef(c.id));
    } catch (e) {
      continue;
    }
    const medios = (l.archivos || []).filter(function (a) { return a.tipo !== 'imagen'; });
    let items = medios.slice(0, 20).map(function (a) { return itemDeArchivo(c.id, l.r, a); });
    if (items.length === 0) {
      items = (l.carpetas || []).slice(0, 12).map(function (cr) { return itemDeCarpeta(c.id, '', cr.nombre); });
    }
    if (items.length === 0) continue;
    filas.push({
      id: 'row-' + c.id,
      title: '☁ ' + c.nombre,
      items: items,
      ref: refCarpeta(c.id, '', '')
    });
  }
  return filas;
}

/* ---------- Browse: explorar una carpeta (Ver más) ---------- */
export async function browse(ref, cursor) {
  const p = partir(ref);
  if (p.tipo !== 'd') throw kino.error('not_found', 'Ese ref no es de carpeta: ' + ref);
  const l = await api('/api/lista?c=' + ef(p.c) + '&r=' + ef(p.ruta));
  const items = [];
  (l.carpetas || []).slice(0, 50).forEach(function (cr) {
    items.push(itemDeCarpeta(p.c, p.ruta, cr.nombre));
  });
  (l.archivos || []).forEach(function (a) {
    if (a.tipo !== 'imagen') items.push(itemDeArchivo(p.c, p.ruta, a));
  });
  return { items: items.slice(0, 100) };
}

/* ---------- Episodes: los medios directos de una carpeta ---------- */
export async function episodes(ref) {
  const p = partir(ref);
  if (p.tipo === 'v') {
    // Un archivo suelto (música, video directo): un solo «episodio» que apunta a él mismo.
    const nombre = (p.ruta.split('/').pop() || '');
    return { episodes: [{ season: 1, number: 1, ref: ref, title: sinExtension(nombre) }] };
  }
  if (p.tipo !== 'd') return { episodes: [] };
  const l = await api('/api/lista?c=' + ef(p.c) + '&r=' + ef(p.ruta));
  const medios = (l.archivos || []).filter(function (a) { return a.tipo !== 'imagen'; });
  return {
    series: { title: p.ruta ? sinExtension(p.ruta.slice(p.ruta.lastIndexOf('/') + 1)) : (l.nombre || '') },
    episodes: medios.map(function (a, i) {
      return {
        season: 1,
        number: i + 1,
        ref: refArchivo(p.c, p.ruta, a.nombre),
        title: sinExtension(a.nombre),
        overview: texto_de_tipo(a.tipo) + ' · ' + tamanoLegible(a.bytes)
      };
    })
  };
}

/* ---------- Búsqueda global en el servidor ---------- */
export async function search(query) {
  const texto = String((query && query.q) || '').trim();
  if (texto.length < 2) return [];
  const r = await api('/api/buscar?q=' + ef(texto));
  const res = Array.isArray(r.resultados) ? r.resultados : [];
  return r
    .filter(function (x) { return x.tipo !== 'imagen' && x.ruta; })
    .slice(0, 100)
    .map(function (x) {
      const barra = x.ruta.lastIndexOf('/');
      const carpeta = barra < 0 ? '' : x.ruta.slice(0, barra);
      return itemDeArchivo(x.c, carpeta, { nombre: x.nombre, tipo: x.tipo, bytes: x.bytes });
    });
}

/* ---------- Resolve: el stream hacia tu PC ---------- */
export async function resolve(ref) {
  const p = partir(ref);
  if (p.tipo !== 'v') throw kino.error('not_found', 'No tengo ese archivo: ' + ref);
  const nombre = p.ruta.split('/').pop() || '';
  return {
    url: base() + '/api/archivo?c=' + ef(p.c) + '&r=' + ef(p.ruta),
    mime: mimeDe(nombre),
    headers: { 'x-clave': laClave() },
    label: 'SuseCloud'
  };
}

/* ---------- Settings: estado y botón Probar ---------- */
export async function settingsStatus() {
  try {
    const ping = await api('/api/ping');
    return { state: 'Listo: ' + ping.nombre + ' · v' + ping.version + ' · ' + (ping.carpetas || []).length + ' carpeta(s)' };
  } catch (e) {
    return { state: 'Sin conexión (¿el servidor está corriendo?)' };
  }
}

export async function action(key) {
  if (key !== 'probar') return null;
  try {
    const ping = await api('/api/ping');
    return { message: '✅ Conectado a ' + ping.nombre + ' (v' + ping.version + '), ' + (ping.carpetas || []).length + ' carpeta(s) servidas' };
  } catch (e) {
    return { message: 'No pude conectarme: ' + (e && e.message ? e.message : 'el servidor no responde') };
  }
}
