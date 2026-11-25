// pruebas/servidor.js — Sirve el proyecto por http y abre index.html en el navegador
// ================================================================================================
// PROPÓSITO
//   Abrir el diseño por http (no con doble clic, file://): la pestaña Pruebas y las cargas de
//   cartuchos leen ficheros del proyecto por URL y eso falla en file://. Sirve la RAÍZ del
//   proyecto en 127.0.0.1 (solo este equipo) y abre el navegador en index.html.
//
// USO
//   pruebas\Servidor.bat [puerto]     (por defecto 8080; si está ocupado, prueba los siguientes)
//   node pruebas\servidor.js [puerto] (igual, sin el .bat)
//   Ctrl+C para parar.
// ================================================================================================
'use strict';
const { exec } = require('child_process');

const puertoPedido = Number(process.argv[2]) || 8080;
const lanzador = require('./lanzador.js');

(async () => {
  let srv = null;
  for (let p = puertoPedido; p < puertoPedido + 10 && !srv; p++) {
    try { srv = await lanzador.servidor(lanzador.raiz, {}, p); }
    catch (e) { if (p === puertoPedido + 9) throw e; }
  }
  const url = 'http://localhost:' + srv.address().port + '/index.html';
  console.log('Servidor local activo (solo este equipo): ' + url);
  console.log('Ctrl+C para parar');
  const abrir = process.platform === 'win32' ? 'start "" "' + url + '"' :
    process.platform === 'darwin' ? 'open "' + url + '"' : 'xdg-open "' + url + '"';
  exec(abrir, () => {});
})().catch((e) => {
  console.log('No se pudo arrancar el servidor: ' + (e && e.message ? e.message : e));
  process.exit(1);
});
