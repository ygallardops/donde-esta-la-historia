// Reglas del control de préstamos. No dependen de Google: se ejecutan en
// Apps Script y en Node, donde se prueban con node --test.

// Zona fija UTC-5: el Perú no usa horario de verano. Si se usa fuera del Perú, volverla configurable.
var DESFASE_MS = -5 * 60 * 60 * 1000;
var HORA_MS = 60 * 60 * 1000;
var DIA_MS = 24 * HORA_MS;

// Devuelve la fecha límite, o null cuando la fija quien registra (forma "manual").
// inicio: la salida para fin_del_dia y horas; el egreso para horas_desde_alta.
function fechaLimite(plazo, inicio, horario) {
  if (!(inicio instanceof Date) || isNaN(inicio)) throw new Error('Fecha de inicio no válida');
  var vence;
  switch (plazo.forma) {
    case 'manual':
      return null;
    case 'fin_del_dia':
      vence = cierreDelDia(inicio, horario);
      break;
    case 'horas':
    case 'horas_desde_alta':
      if (!(plazo.horas > 0)) throw new Error('Horas no válidas: ' + plazo.horas);
      vence = new Date(inicio.getTime() + plazo.horas * HORA_MS);
      break;
    default:
      throw new Error('Forma de vencimiento desconocida: ' + plazo.forma);
  }
  return ajustarAlHorario(vence, horario);
}

// Cierre del archivo el día de inicio; si ese día no abre o ya cerró, el propio inicio.
function cierreDelDia(inicio, horario) {
  var tramo = tramoDelDia(inicio, horario);
  return tramo && tramo.cierre >= inicio ? tramo.cierre : inicio;
}

// Si la fecha cae con el archivo cerrado, la corre a la siguiente apertura.
function ajustarAlHorario(fecha, horario) {
  for (var i = 0; i <= 366; i++) {
    var tramo = tramoDelDia(new Date(fecha.getTime() + i * DIA_MS), horario);
    if (!tramo) continue;
    if (i > 0 || fecha < tramo.apertura) return tramo.apertura;
    if (fecha <= tramo.cierre) return fecha;
  }
  throw new Error('El horario no tiene días de atención');
}

// Apertura y cierre del día (hora del Perú) que contiene la fecha, o null si no abre.
function tramoDelDia(fecha, horario) {
  var local = new Date(fecha.getTime() + DESFASE_MS);
  if (horario.feriados.indexOf(local.toISOString().slice(0, 10)) !== -1) return null;
  var horas = horario.semana[local.getUTCDay()];
  if (!horas) return null;
  var medianoche = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - DESFASE_MS;
  return {
    apertura: new Date(medianoche + minutos(horas[0]) * 60000),
    cierre: new Date(medianoche + minutos(horas[1]) * 60000)
  };
}

function minutos(hhmm) {
  var m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) throw new Error('Hora no válida: ' + hhmm);
  return Number(m[1]) * 60 + Number(m[2]);
}

// Número de historia sin espacios y en mayúsculas, validado con el formato que configura la IPRESS.
// formato: { patron: 'expresión regular sin ^ ni $', quitarCeros: true | false }
function normalizarNumero(texto, formato) {
  var numero = String(texto).replace(/\s+/g, '').toUpperCase();
  if (formato.quitarCeros) numero = numero.replace(/^0+(?=.)/, '');
  var patron;
  try {
    patron = new RegExp('^(?:' + formato.patron + ')$');
  } catch (e) {
    throw new Error('Formato de número mal configurado: ' + formato.patron);
  }
  if (!patron.test(numero)) throw new Error('Número de historia no válido: ' + texto);
  return numero;
}

// Valor sí/no de la configuración; admite tilde y mayúsculas. Cualquier otro valor es un error.
function siNo(valor, clave) {
  var v = String(valor).trim().toLowerCase().replace('í', 'i');
  if (v === 'si') return true;
  if (v === 'no') return false;
  throw new Error('Valor no válido en ' + clave + ': ' + valor);
}

// Índice del préstamo sin devolución de ese número, o -1. filas: [[numero, devolucion], ...]
function prestamoAbierto(numero, filas) {
  for (var i = filas.length - 1; i >= 0; i--) {
    if (filas[i][0] === numero && filas[i][1] === '') return i;
  }
  return -1;
}

function esAutorizada(correo, autorizadas) {
  var c = String(correo).trim().toLowerCase();
  return c !== '' && autorizadas.some(function (a) { return String(a).trim().toLowerCase() === c; });
}

// 'AAAA-MM-DD' → medianoche de ese día en hora del Perú.
function fechaDeTexto(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) throw new Error('Fecha no válida: ' + texto);
  var fecha = new Date(texto + 'T00:00:00-05:00');
  if (isNaN(fecha)) throw new Error('Fecha no válida: ' + texto);
  return fecha;
}

// Fecha límite al registrar la salida. null: en hospitalización, hasta registrar el egreso.
// fechaManual ('AAAA-MM-DD') solo para la forma "manual": vence al cierre de ese día.
function limiteAlSalir(plazo, salida, horario, fechaManual) {
  if (plazo.forma === 'horas_desde_alta') return null;
  if (plazo.forma !== 'manual') return fechaLimite(plazo, salida, horario);
  if (!fechaManual) throw new Error('Falta la fecha de devolución');
  var dia = fechaDeTexto(fechaManual);
  if (dia.getTime() + DIA_MS <= salida.getTime()) throw new Error('La fecha de devolución es anterior a la salida');
  return fechaLimite({ forma: 'fin_del_dia' }, dia, horario);
}

// Día 'AAAA-MM-DD' en hora del Perú.
function diaLocal(fecha) {
  return new Date(fecha.getTime() + DESFASE_MS).toISOString().slice(0, 10);
}

// Salidas de un día para un servicio y una persona, en el orden en que se registraron.
// La persona se compara sin distinguir mayúsculas ni espacios de más.
function salidasDelCargo(salidas, dia, servicio, persona) {
  var normal = function (texto) { return String(texto).trim().replace(/\s+/g, ' ').toLowerCase(); };
  return salidas.filter(function (s) {
    return s.salida instanceof Date && diaLocal(s.salida) === dia && s.servicio === servicio &&
      normal(s.persona) === normal(persona);
  });
}

if (typeof module !== 'undefined') {
  module.exports = {
    fechaLimite: fechaLimite,
    normalizarNumero: normalizarNumero,
    prestamoAbierto: prestamoAbierto,
    esAutorizada: esAutorizada,
    limiteAlSalir: limiteAlSalir,
    siNo: siNo,
    diaLocal: diaLocal,
    salidasDelCargo: salidasDelCargo
  };
}
