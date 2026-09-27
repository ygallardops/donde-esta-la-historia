// Capa de Apps Script: hoja, página web y registro de movimientos.
// Los plazos y las validaciones están en reglas.js.

var COLUMNAS = ['id', 'numero', 'servicio', 'persona_autorizada', 'tipo_inicial', 'tipo_actual', 'salida',
  'registrado_por', 'cambio_de_tipo', 'fin_observacion_o_egreso', 'fecha_limite', 'motivo_retencion',
  'devolucion', 'recibido_por', 'integridad', 'observacion'];
var COL = {};
COLUMNAS.forEach(function (c, i) { COL[c] = i; });
var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
var INTEGRIDAD = ['conforme', 'con observaciones'];

function doGet() {
  try {
    cuentaActual();
  } catch (e) {
    return HtmlService.createHtmlOutput('Esta cuenta no está autorizada para registrar préstamos.');
  }
  return HtmlService.createHtmlOutputFromFile('pagina').setTitle('¿Dónde está la historia?');
}

// Servicios y tipos de préstamo para llenar la página.
function configuracion() {
  cuentaActual();
  var conf = leerConfiguracion();
  return {
    servicios: conf.servicios,
    tipos: Object.keys(conf.plazos).map(function (t) { return { nombre: t, forma: conf.plazos[t].forma }; })
  };
}

function registrarSalida(datos) {
  var correo = cuentaActual();
  var conf = leerConfiguracion();
  var numero = normalizarNumero(datos.numero, conf.formato);
  var persona = String(datos.persona || '').trim();
  if (!persona) throw new Error('Falta el nombre de la persona autorizada que recibe');
  if (conf.servicios.indexOf(datos.servicio) === -1) throw new Error('Servicio no válido');
  var plazo = conf.plazos[datos.tipo];
  if (!plazo) throw new Error('Tipo de préstamo no válido');

  return conBloqueo(function () {
    var hoja = libro().getSheetByName('movimientos');
    var abierto = buscarAbierto(hoja, numero);
    if (abierto) {
      throw new Error('La historia ' + numero + ' ya figura prestada a ' + abierto[COL.servicio] +
        ' desde el ' + texto(abierto[COL.salida]));
    }
    var salida = new Date();
    var limite = limiteAlSalir(plazo, salida, conf.horario, datos.fechaManual);
    var fila = COLUMNAS.map(function () { return ''; });
    fila[COL.id] = Utilities.getUuid();
    fila[COL.numero] = numero;
    fila[COL.servicio] = datos.servicio;
    fila[COL.persona_autorizada] = persona;
    fila[COL.tipo_inicial] = datos.tipo;
    fila[COL.tipo_actual] = datos.tipo;
    fila[COL.salida] = salida;
    fila[COL.registrado_por] = correo;
    fila[COL.fecha_limite] = limite || '';
    hoja.appendRow(fila);
    return {
      numero: numero, servicio: datos.servicio, persona: persona, entrega: correo,
      salida: texto(salida), limite: textoLimite(limite)
    };
  });
}

function registrarDevolucion(datos) {
  var correo = cuentaActual();
  var numero = normalizarNumero(datos.numero, leerConfiguracion().formato);
  if (INTEGRIDAD.indexOf(datos.integridad) === -1) throw new Error('Integridad no válida');
  var observacion = String(datos.observacion || '').trim();
  if (datos.integridad === 'con observaciones' && !observacion) throw new Error('Falta la observación');

  return conBloqueo(function () {
    var hoja = libro().getSheetByName('movimientos');
    var abierto = buscarAbierto(hoja, numero);
    if (!abierto) throw new Error('La historia ' + numero + ' no figura prestada');
    var devolucion = new Date();
    hoja.getRange(abierto.fila, COL.devolucion + 1, 1, 4)
      .setValues([[devolucion, correo, datos.integridad, observacion]]);
    var limite = abierto[COL.fecha_limite];
    return {
      numero: numero, servicio: abierto[COL.servicio], devolucion: texto(devolucion),
      vencida: limite instanceof Date && devolucion > limite
    };
  });
}

// Salidas de hoy para un servicio y una persona, para reimprimir su cargo.
// Las filas están en orden de registro, así que solo se leen las de hoy, desde el final.
function cargoDeHoy(servicio, persona) {
  cuentaActual();
  var hoja = libro().getSheetByName('movimientos');
  var total = hoja.getLastRow() - 1;
  if (total < 1) return [];
  var hoy = diaLocal(new Date());
  var salidas = hoja.getRange(2, COL.salida + 1, total, 1).getValues();
  var desde = total;
  while (desde > 0 && salidas[desde - 1][0] instanceof Date && diaLocal(salidas[desde - 1][0]) === hoy) desde--;
  if (desde === total) return [];
  var deHoy = hoja.getRange(desde + 2, 1, total - desde, COLUMNAS.length).getValues().map(function (f) {
    return {
      numero: String(f[COL.numero]), servicio: f[COL.servicio], persona: f[COL.persona_autorizada],
      salida: f[COL.salida], limite: f[COL.fecha_limite], entrega: f[COL.registrado_por]
    };
  });
  return salidasDelCargo(deHoy, hoy, servicio, persona).map(function (s) {
    return {
      numero: s.numero, servicio: s.servicio, persona: s.persona, entrega: s.entrega,
      salida: texto(s.salida), limite: textoLimite(s.limite)
    };
  });
}

// Fila del préstamo sin devolución de ese número (con su número de fila en .fila), o null.
// Lee dos columnas completas en cada registro. Si la hoja crece a cientos de miles de filas, usar TextFinder.
function buscarAbierto(hoja, numero) {
  var total = hoja.getLastRow() - 1;
  if (total < 1) return null;
  var numeros = hoja.getRange(2, COL.numero + 1, total, 1).getValues();
  var devoluciones = hoja.getRange(2, COL.devolucion + 1, total, 1).getValues();
  var i = prestamoAbierto(numero, numeros.map(function (n, j) { return [String(n[0]), devoluciones[j][0]]; }));
  if (i === -1) return null;
  var fila = hoja.getRange(i + 2, 1, 1, COLUMNAS.length).getValues()[0];
  fila.fila = i + 2;
  return fila;
}

function cuentaActual() {
  var correo = Session.getActiveUser().getEmail();
  var autorizadas = filas('usuarios').map(function (f) { return f[0]; });
  if (!esAutorizada(correo, autorizadas)) throw new Error('Cuenta no autorizada');
  return correo;
}

function leerConfiguracion() {
  var plazos = {};
  filas('plazos').forEach(function (f) { plazos[f[0]] = { forma: f[1], horas: Number(f[2]) }; });
  var semana = [null, null, null, null, null, null, null];
  var feriados = [];
  filas('horario').forEach(function (f) {
    if (f[0] === 'feriado') feriados.push(f[1]);
    else if (f[1] && f[2]) semana[DIAS.indexOf(f[0])] = [f[1], f[2]];
  });
  var ajustes = {};
  filas('configuracion').forEach(function (f) { ajustes[f[0]] = f[1]; });
  return {
    formato: { patron: ajustes.formato_numero, quitarCeros: siNo(ajustes.quitar_ceros, 'quitar_ceros') },
    plazos: plazos,
    servicios: filas('servicios').map(function (f) { return f[0]; }),
    horario: { semana: semana, feriados: feriados }
  };
}

// Filas de una pestaña de configuración como texto, sin encabezado ni filas vacías.
// Las pestañas se leen juntas y se guardan en caché 10 minutos: leerlas es lo más lento de cada registro.
// El activador limpiarCache borra la caché cuando se edita la hoja, para que los cambios se apliquen al instante.
var PESTANAS_CONFIGURACION = ['usuarios', 'plazos', 'horario', 'servicios', 'configuracion'];
var configuracionLeida = null;
function filas(nombre) {
  if (!configuracionLeida) {
    var cache = CacheService.getScriptCache();
    var guardada = cache.get('configuracion');
    if (guardada) {
      configuracionLeida = JSON.parse(guardada);
    } else {
      configuracionLeida = {};
      PESTANAS_CONFIGURACION.forEach(function (n) {
        configuracionLeida[n] = libro().getSheetByName(n).getDataRange().getDisplayValues().slice(1)
          .filter(function (f) { return f[0] !== ''; });
      });
      cache.put('configuracion', JSON.stringify(configuracionLeida), 600);
    }
  }
  return configuracionLeida[nombre];
}

function limpiarCache() {
  CacheService.getScriptCache().remove('configuracion');
}

// Crea el activador que borra la caché al editar la hoja. prepararHoja lo llama;
// en una hoja creada antes, ejecutarlo una vez desde el editor.
function crearActivador() {
  var existe = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'limpiarCache'; });
  if (existe) return;
  ScriptApp.newTrigger('limpiarCache')
    .forSpreadsheet(PropertiesService.getScriptProperties().getProperty('ID_HOJA')).onEdit().create();
}

// El libro se abre una sola vez por ejecución: abrirlo cuesta más que leerlo.
var libroAbierto = null;
function libro() {
  if (!libroAbierto) {
    libroAbierto = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('ID_HOJA'));
  }
  return libroAbierto;
}

function conBloqueo(fn) {
  var bloqueo = LockService.getScriptLock();
  if (!bloqueo.tryLock(10000)) throw new Error('Otra persona está registrando; intente de nuevo');
  try {
    return fn();
  } finally {
    bloqueo.releaseLock();
  }
}

function texto(fecha) {
  return Utilities.formatDate(fecha, 'America/Lima', 'dd/MM/yyyy HH:mm');
}

function textoLimite(limite) {
  return limite instanceof Date ? texto(limite) : 'en hospitalización';
}

// Se ejecuta una sola vez desde el editor: crea la hoja con la configuración de ejemplo.
function prepararHoja() {
  var propiedades = PropertiesService.getScriptProperties();
  if (propiedades.getProperty('ID_HOJA')) throw new Error('La hoja ya existe: ' + propiedades.getProperty('ID_HOJA'));
  var nuevo = SpreadsheetApp.create('Control de préstamos de historias clínicas');
  nuevo.setSpreadsheetTimeZone('America/Lima');
  var inicial = nuevo.getSheets()[0];

  var movimientos = pestana(nuevo, 'movimientos', [COLUMNAS], false);
  movimientos.getRange('B:B').setNumberFormat('@');
  pestana(nuevo, 'plazos', [
    ['tipo', 'forma', 'horas'],
    ['Consulta ambulatoria', 'fin_del_dia', ''],
    ['Emergencia', 'horas', '24'],
    ['Hospitalización', 'horas_desde_alta', '48'],
    ['Informes médicos y auditoría médica', 'horas', '72'],
    ['Docencia e investigación', 'manual', '']
  ], true);
  pestana(nuevo, 'servicios', [['servicio'], ['Consulta externa'], ['Emergencia'], ['Hospitalización'],
    ['Auditoría médica'], ['Docencia e investigación']], true);
  pestana(nuevo, 'horario', [
    ['dia', 'apertura', 'cierre'],
    ['lunes', '07:00', '19:00'], ['martes', '07:00', '19:00'], ['miércoles', '07:00', '19:00'],
    ['jueves', '07:00', '19:00'], ['viernes', '07:00', '19:00'], ['sábado', '07:00', '13:00'],
    ['domingo', '', ''],
    ['feriado', '2026-12-25', '']
  ], true);
  pestana(nuevo, 'configuracion', [
    ['clave', 'valor'],
    ['formato_numero', '[A-Z0-9-]{1,20}'],
    ['quitar_ceros', 'no']
  ], true);
  pestana(nuevo, 'usuarios', [['correo'], [Session.getEffectiveUser().getEmail()]], true);
  nuevo.deleteSheet(inicial);

  propiedades.setProperty('ID_HOJA', nuevo.getId());
  crearActivador();
  Logger.log('Hoja creada: ' + nuevo.getUrl());
}

// Crea una pestaña con sus valores. Con comoTexto, Sheets no convierte horas ni fechas.
function pestana(destino, nombre, valores, comoTexto) {
  var hoja = destino.insertSheet(nombre);
  if (comoTexto) hoja.getRange(1, 1, hoja.getMaxRows(), valores[0].length).setNumberFormat('@');
  hoja.getRange(1, 1, valores.length, valores[0].length).setValues(valores);
  hoja.setFrozenRows(1);
  hoja.protect().setWarningOnly(true);
  return hoja;
}
