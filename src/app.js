// Capa de Apps Script: hoja, página web y registro de movimientos.
// Los plazos y las validaciones están en reglas.js.

var COLUMNAS = ['id', 'numero', 'servicio', 'persona_autorizada', 'tipo_inicial', 'tipo_actual', 'salida',
  'registrado_por', 'cambio_de_tipo', 'fin_observacion_o_egreso', 'fecha_limite', 'motivo_retencion',
  'devolucion', 'recibido_por', 'integridad', 'observacion'];
var COL = {};
COLUMNAS.forEach(function (c, i) { COL[c] = i; });
var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
var INTEGRIDAD = ['conforme', 'con observaciones'];
var SIN_SALIDA = 'Ingreso sin salida registrada';

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
    motivos: conf.motivos,
    tipos: Object.keys(conf.plazos).map(function (t) {
      return { nombre: t, forma: conf.plazos[t].forma, plazo: descripcionPlazo(conf.plazos[t]) };
    })
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
  var observacion = observacionDeIntegridad(datos);

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
  // Los ingresos sin salida no tienen fecha de salida: se saltan sin cortar la búsqueda.
  while (desde > 0 && (!(salidas[desde - 1][0] instanceof Date) || diaLocal(salidas[desde - 1][0]) === hoy)) desde--;
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

// Historia que vuelve al archivo sin una salida registrada: queda como un ingreso marcado, para medir el cumplimiento.
function registrarIngresoSinSalida(datos) {
  var correo = cuentaActual();
  var numero = normalizarNumero(datos.numero, leerConfiguracion().formato);
  var observacion = observacionDeIntegridad(datos);
  return conBloqueo(function () {
    var hoja = libro().getSheetByName('movimientos');
    if (buscarAbierto(hoja, numero)) throw new Error('La historia ' + numero + ' figura prestada: registre su devolución');
    var fila = COLUMNAS.map(function () { return ''; });
    fila[COL.id] = Utilities.getUuid();
    fila[COL.numero] = numero;
    fila[COL.tipo_inicial] = SIN_SALIDA;
    fila[COL.tipo_actual] = SIN_SALIDA;
    fila[COL.devolucion] = new Date();
    fila[COL.recibido_por] = correo;
    fila[COL.integridad] = datos.integridad;
    fila[COL.observacion] = observacion;
    hoja.appendRow(fila);
    return 'Ingreso sin salida registrada: ' + numero + '.';
  });
}

function observacionDeIntegridad(datos) {
  if (INTEGRIDAD.indexOf(datos.integridad) === -1) throw new Error('Integridad no válida');
  var observacion = String(datos.observacion || '').trim();
  if (datos.integridad === 'con observaciones' && !observacion) throw new Error('Falta la observación');
  return observacion;
}

// Ingresos por semana y cuántos llegaron sin salida registrada, en las últimas 8 semanas.
function cumplimientoSemanal() {
  cuentaActual();
  return cumplimientoPorSemana(todasLasFilas().map(function (f) {
    return { fecha: f[COL.devolucion], sinSalida: f[COL.tipo_actual] === SIN_SALIDA };
  }), new Date(), 8);
}

// Aviso diario de vencidas. Con la propiedad WEBHOOK_CHAT lo envía a un espacio de Google Chat
// (requiere Google Workspace); sin ella, lo deja en el registro de ejecución.
function avisoDiario() {
  var ahora = new Date();
  var mensaje = mensajeVencidas(fueraDeLaHoja(ahora), ahora, texto(ahora));
  if (!mensaje) return;
  var webhook = PropertiesService.getScriptProperties().getProperty('WEBHOOK_CHAT');
  if (!webhook) {
    console.log(mensaje);
    return;
  }
  UrlFetchApp.fetch(webhook, {
    method: 'post', contentType: 'application/json; charset=UTF-8', payload: JSON.stringify({ text: mensaje })
  });
}

// Activador diario del aviso: Apps Script lo ejecuta en algún momento entre las 8:00 y las 9:00.
function crearActivadorAviso() {
  var existe = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'avisoDiario'; });
  if (!existe) ScriptApp.newTrigger('avisoDiario').timeBased().everyDays(1).atHour(8).create();
}

// Cambia el tipo de un préstamo abierto a uno que espera el egreso o el fin de la observación.
function cambiarTipo(datos) {
  cuentaActual();
  var conf = leerConfiguracion();
  var numero = normalizarNumero(datos.numero, conf.formato);
  return conBloqueo(function () {
    var hoja = libro().getSheetByName('movimientos');
    var abierto = abiertoOError(hoja, numero);
    validarCambioDeTipo(abierto[COL.tipo_actual], abierto[COL.fin_observacion_o_egreso], datos.tipo, conf.plazos[datos.tipo]);
    escribir(hoja, abierto.fila, { tipo_actual: datos.tipo, cambio_de_tipo: new Date(), fecha_limite: '' });
    return 'La historia ' + numero + ' pasó a ' + datos.tipo + '. Queda sin fecha límite hasta registrar el egreso o el fin de la observación.';
  });
}

// Registra el egreso o el fin de la observación y calcula la fecha límite desde ese momento.
function registrarEgreso(datos) {
  cuentaActual();
  var conf = leerConfiguracion();
  var numero = normalizarNumero(datos.numero, conf.formato);
  var egreso = fechaHoraDeTexto(datos.egreso);
  return conBloqueo(function () {
    var hoja = libro().getSheetByName('movimientos');
    var abierto = abiertoOError(hoja, numero);
    if (abierto[COL.fin_observacion_o_egreso]) throw new Error('Ya se registró el egreso o el fin de la observación');
    var limite = limiteTrasEgreso(conf.plazos[abierto[COL.tipo_actual]], abierto[COL.salida], egreso, new Date(), conf.horario);
    escribir(hoja, abierto.fila, { fin_observacion_o_egreso: egreso, fecha_limite: limite });
    return 'Egreso registrado para la historia ' + numero + '. Fecha límite: ' + texto(limite) + '.';
  });
}

// Retención justificada: guarda el motivo con su fecha y reemplaza la fecha límite.
function registrarRetencion(datos) {
  cuentaActual();
  var conf = leerConfiguracion();
  var numero = normalizarNumero(datos.numero, conf.formato);
  var motivo = String(datos.motivo || '').trim();
  if (!motivo) throw new Error('Falta el motivo de la retención');
  return conBloqueo(function () {
    var hoja = libro().getSheetByName('movimientos');
    var abierto = abiertoOError(hoja, numero);
    if (!(abierto[COL.fecha_limite] instanceof Date)) {
      throw new Error('La historia ' + numero + ' no tiene fecha límite: espera el egreso o el fin de la observación');
    }
    var ahora = new Date();
    var limite = limiteManual(datos.fecha, ahora, conf.horario);
    var anterior = abierto[COL.motivo_retencion];
    escribir(hoja, abierto.fila, {
      motivo_retencion: (anterior ? anterior + ' | ' : '') + texto(ahora) + ': ' + motivo,
      fecha_limite: limite
    });
    return 'Retención registrada para la historia ' + numero + '. Nueva fecha límite: ' + texto(limite) + '.';
  });
}

// Historias prestadas ahora, por servicio, con las vencidas marcadas.
// Lee la pestaña completa: con un archivo por año se mantiene en decenas de miles de filas.
// Cuántas historias están fuera y cuántas vencidas, para el resumen de la pestaña Salida.
function resumenFuera() {
  cuentaActual();
  var ahora = new Date();
  var fuera = fueraDeLaHoja(ahora);
  return {
    fuera: fuera.length,
    vencidas: fuera.filter(function (p) { return p.vencida; }).length,
    hora: Utilities.formatDate(ahora, 'America/Lima', 'HH:mm')
  };
}

function fueraAhora() {
  cuentaActual();
  var ahora = new Date();
  return fueraDeLaHoja(ahora).map(function (p) {
    return {
      numero: p.numero, servicio: p.servicio, persona: p.persona,
      tipo: p.tipo + (p.egreso instanceof Date ? ' (egreso ' + texto(p.egreso) + ')' : ''),
      salida: texto(p.salida), limite: textoLimite(p.limite), estado: tiempoRestante(p.limite, ahora), vencida: p.vencida
    };
  });
}

function fueraDeLaHoja(ahora) {
  return prestamosFuera(todasLasFilas().map(function (f) {
    return {
      numero: String(f[COL.numero]), servicio: f[COL.servicio], persona: f[COL.persona_autorizada],
      tipo: f[COL.tipo_actual], salida: f[COL.salida], limite: f[COL.fecha_limite], devolucion: f[COL.devolucion],
      egreso: f[COL.fin_observacion_o_egreso]
    };
  }), ahora);
}

// Todos los préstamos de un número de historia, del más reciente al más antiguo.
function historial(numeroEscrito) {
  cuentaActual();
  var numero = normalizarNumero(numeroEscrito, leerConfiguracion().formato);
  var fecha = function (v) { return v instanceof Date ? texto(v) : ''; };
  return todasLasFilas().filter(function (f) { return String(f[COL.numero]) === numero; }).reverse().map(function (f) {
    return {
      servicio: f[COL.servicio], persona: f[COL.persona_autorizada],
      tipo: f[COL.tipo_inicial] === f[COL.tipo_actual] ? f[COL.tipo_actual] : f[COL.tipo_inicial] + ' → ' + f[COL.tipo_actual],
      salida: fecha(f[COL.salida]), entrega: f[COL.registrado_por], egreso: fecha(f[COL.fin_observacion_o_egreso]),
      limite: textoLimite(f[COL.fecha_limite]), retencion: f[COL.motivo_retencion],
      devolucion: fecha(f[COL.devolucion]), recibe: f[COL.recibido_por],
      integridad: f[COL.integridad] + (f[COL.observacion] ? ': ' + f[COL.observacion] : '')
    };
  });
}

function todasLasFilas() {
  var hoja = libro().getSheetByName('movimientos');
  var total = hoja.getLastRow() - 1;
  return total < 1 ? [] : hoja.getRange(2, 1, total, COLUMNAS.length).getValues();
}

function abiertoOError(hoja, numero) {
  var abierto = buscarAbierto(hoja, numero);
  if (!abierto) throw new Error('La historia ' + numero + ' no figura prestada');
  return abierto;
}

// Escribe en una fila las columnas indicadas por nombre.
function escribir(hoja, fila, valores) {
  Object.keys(valores).forEach(function (columna) {
    hoja.getRange(fila, COL[columna] + 1).setValue(valores[columna]);
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
    motivos: motivosPorServicio(filas('servicios'), plazos),
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
  return limite instanceof Date ? texto(limite) : 'sin fecha límite (espera el egreso)';
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
    ['Observación de emergencia', 'horas_desde_alta', '24'],
    ['Informes médicos y auditoría médica', 'horas', '72'],
    ['Docencia e investigación', 'manual', '']
  ], true);
  pestana(nuevo, 'servicios', [
    ['servicio', 'motivo'],
    ['Consulta externa', 'Consulta ambulatoria'],
    ['Emergencia', 'Emergencia'],
    ['Hospitalización', 'Hospitalización'],
    ['Auditoría médica', 'Informes médicos y auditoría médica'],
    ['Docencia e investigación', 'Docencia e investigación']
  ], true);
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
  crearActivadorAviso();
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
