# SusejingCloud

Plug-in privado de Kino que conecta tu PC con tu teléfono: mira los videos, escucha la música y ve las fotos que tienes en tu computadora, directo desde Kino.

Tu PC se vuelve una nube pequeña con el **Servidor de Susejing** (un solo archivo de Node.js, sin dependencias, sin cuentas, sin nube externa). El contenido nunca sale de tu red: el plug-in solo le habla a tu servidor, y el acceso viaja protegido con la clave del servidor.

## Qué hace

- **Inicio**: una fila por cada carpeta servida, con sus archivos listos para reproducir.
- **Explorar**: navega carpetas y subcarpetas (una subcarpeta se comporta como una serie: sus subcarpetas son temporadas y sus archivos, episodios).
- **Buscar**: busca en todo lo servido (videos, audio e imágenes) desde un solo cuadro.
- **Ver y descargar**: reproducción con adelanto/retroceso real (seek), y descarga del archivo.

## Requisitos

1. Tener [Node.js](https://nodejs.org) (versión 18 o superior) en el PC.
2. Tener el **Servidor de Susejing** corriendo: carpeta `susejing-server` con `susejing-server.js` e `iniciar.bat`; doble clic en `iniciar.bat`.
3. Agrega carpetas desde la página web del servidor (la que imprime `iniciar.bat`, ej. `http://localhost:8420`).

## Instalación

1. En Kino: **Ajustes ▸ Plugins (Usa un plugin) ▸ Por dirección** y pega:

   ```
   https://raw.githubusercontent.com/Susejing/SusejingCloud/main/kino-plugin.json
   ```

2. Instala el plug-in y abre **Configurar**.
3. Escribe la **dirección del servidor** exacta que imprimió `iniciar.bat` (ejemplo: `http://192.168.1.17:8420`). Usa la que empieza con `192.168.` y no la de un adaptador virtual.
4. Escribe la **clave** del servidor (por defecto: `susejing`).
5. Pulsa **Probar conexión**: debe decir «¡Conectado!».
6. Vuelve al Inicio de Kino: tus carpetas están ahí.

> Importante: el teléfono y el PC deben estar en la **misma WiFi**. Deja abierta la ventana negra de `iniciar.bat`: esa ventana ES el servidor.

## Notas

- El plug-in es privado (`discoverable: false`): no aparece en catálogos públicos; solo lo instala quien pegue esta dirección.
- Si un día no conecta, la IP del PC puede haber cambiado: mira la nueva con `iniciar.bat` y actualízala en Configurar.
- El plug-in solo habla con la dirección que tú escribes en Configurar, con la clave del servidor.

## Licencia

Apache-2.0.
