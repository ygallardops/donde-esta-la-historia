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

if (typeof module !== 'undefined') module.exports = { fechaLimite: fechaLimite };
