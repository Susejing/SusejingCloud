# SuseCloud

Cliente de Kino para tu propio servidor: **tus videos, tu música y tus fotos del PC**, en Kino, sin que nada salga de tu red.

## Qué es

SuseCloud es un plugin de Kino que se conecta al **servidor de Susejing** (`susejing-server.js`, un Node.js de un solo archivo que corre en tu PC). El plugin no trae contenido: únicamente habla con TU servidor en TU red local.

- **Inicio**: una fila por cada carpeta que hayas servido en el servidor.
- **Ver más**: exploración de subcarpetas dentro de cada carpeta.
- **Búsqueda**: busca en todas tus carpetas servidas a la vez.
- **Reproducción**: streaming por HTTP con soporte de adelantar/retroceder (Range).
- **Descarga**: guarda los archivos para verlos sin conexión.
- **Probar conexión**: un botón en Configurar que le pregunta al servidor si está vivo.

## Instalación

1. Corre el servidor en tu PC (`node susejing-server.js` o `iniciar.bat`) y deja la ventana abierta.
2. Abre la dirección que imprime el servidor en el navegador y agrega tus carpetas (elegirlas con un clic, sin editar nada a mano).
3. En Kino: **Ajustes ▸ Usa un plugin ▸ Por dirección** y pega:

   ```
   https://raw.githubusercontent.com/Susejing/SusejingCloud/main/kino-plugin.json
   ```

4. En **Configurar** del plugin: `Servidor` = la dirección que imprime la ventana del servidor (ej. `http://192.168.1.17:8420`) y `Clave` = la clave de `config.json` (por defecto `susejing`). Toca **Probar conexión**.

## Notas

- La clave viaja en el header `x-clave`; el servidor la exige en todas sus rutas.
- Cada archivo se sirve con `Range`/`206`, así que el adelanto (seek) funciona.
- Las imágenes no se listan en esta versión (verlas será el v0.2): el servidor las sirve, pero el reproductor de Kino es para video/audio.
- Qué pasa si la ventana del PC se cierra: el servidor apaga y Kino dirá "sin conexión". Ábrela otra vez y listo.

## Archivos

- `kino-plugin.json` — manifiesto del plugin (apiVersion 8, capabilities: home, browse, episodes, search, resolve, download).
- `plugin.js` — todo el código, un solo archivo, sin dependencias.

## Privacidad

- El código es público; **tu contenido no está aquí**: solo vive en tu PC.
- El plugin solo habla con la dirección de servidor que TÚ escribes en Configurar.
- El servidor protege sus archivos con la clave; se la puede cambiar en `config.json`.
