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

// 'AAAA-MM-DDTHH:MM' (campo de fecha y hora de la página) → esa fecha y hora del Perú.
function fechaHoraDeTexto(texto) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(texto)) throw new Error('Fecha y hora no válidas: ' + texto);
  var fecha = new Date(texto + ':00-05:00');
  if (isNaN(fecha)) throw new Error('Fecha y hora no válidas: ' + texto);
  return fecha;
}

// Fecha límite al registrar la salida. null: espera el egreso o el fin de la observación.
// fechaManual ('AAAA-MM-DD') solo para la forma "manual": vence al cierre de ese día.
function limiteAlSalir(plazo, salida, horario, fechaManual) {
  if (plazo.forma === 'horas_desde_alta') return null;
  if (plazo.forma !== 'manual') return fechaLimite(plazo, salida, horario);
  return limiteManual(fechaManual, salida, horario);
}

// Fecha elegida a mano (docencia o retención): vence al cierre del archivo ese día. No puede ser anterior a "desde".
function limiteManual(fechaTexto, desde, horario) {
  if (!fechaTexto) throw new Error('Falta la fecha de devolución');
  var dia = fechaDeTexto(fechaTexto);
  if (dia.getTime() + DIA_MS <= desde.getTime()) throw new Error('La fecha de devolución es anterior a hoy');
  return fechaLimite({ forma: 'fin_del_dia' }, dia, horario);
}

// Cambio de tipo sin nueva salida: solo hacia un tipo que espera el egreso o el fin de la observación.
function validarCambioDeTipo(tipoActual, egreso, tipoNuevo, plazoNuevo) {
  if (!plazoNuevo) throw new Error('Tipo de préstamo no válido');
  if (plazoNuevo.forma !== 'horas_desde_alta') {
    throw new Error('Solo se puede cambiar a un tipo que espera el egreso o el fin de la observación');
  }
  if (tipoNuevo === tipoActual) throw new Error('La historia ya está en ' + tipoNuevo);
  if (egreso) throw new Error('Ya se registró el egreso o el fin de la observación');
}

// Fecha límite al registrar el egreso o el fin de la observación.
function limiteTrasEgreso(plazo, salida, egreso, ahora, horario) {
  if (plazo.forma !== 'horas_desde_alta') throw new Error('Este préstamo no espera un egreso ni el fin de una observación');
  // El campo de la página tiene precisión de minuto: se tolera un egreso en el mismo minuto de la salida.
  if (egreso.getTime() < salida.getTime() - 60000) throw new Error('El egreso es anterior a la salida');
  if (egreso > ahora) throw new Error('El egreso no puede ser posterior a este momento');
  return fechaLimite(plazo, egreso, horario);
}

// Préstamos sin devolución, marcados si vencieron, por servicio y fecha límite (los que no tienen límite, al final).
function prestamosFuera(prestamos, ahora) {
  var fuera = [];
  prestamos.forEach(function (p) {
    if (p.devolucion) return;
    var copia = {};
    Object.keys(p).forEach(function (k) { copia[k] = p[k]; });
    copia.vencida = p.limite instanceof Date && p.limite < ahora;
    fuera.push(copia);
  });
  var tiempo = function (p) { return p.limite instanceof Date ? p.limite.getTime() : Infinity; };
  return fuera.sort(function (a, b) {
    return a.servicio.localeCompare(b.servicio, 'es') || tiempo(a) - tiempo(b);
  });
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

// Lunes 'AAAA-MM-DD' (hora del Perú) de la semana que contiene la fecha.
function inicioDeSemana(fecha) {
  var local = new Date(fecha.getTime() + DESFASE_MS);
  var desdeLunes = (local.getUTCDay() + 6) % 7;
  return new Date(local.getTime() - desdeLunes * DIA_MS).toISOString().slice(0, 10);
}

// Ingresos al archivo por semana (lunes a domingo) y cuántos llegaron sin salida registrada.
// ingresos: [{ fecha: Date, sinSalida: true | false }]. Devuelve las últimas semanas, de la más reciente a la más antigua.
function cumplimientoPorSemana(ingresos, ahora, semanas) {
  var resultado = [];
  for (var i = 0; i < semanas; i++) {
    resultado.push({ semana: inicioDeSemana(new Date(ahora.getTime() - i * 7 * DIA_MS)), ingresos: 0, sinSalida: 0 });
  }
  ingresos.forEach(function (r) {
    if (!(r.fecha instanceof Date)) return;
    var semana = inicioDeSemana(r.fecha);
    var fila = resultado.filter(function (s) { return s.semana === semana; })[0];
    if (!fila) return;
    fila.ingresos++;
    if (r.sinSalida) fila.sinSalida++;
  });
  return resultado;
}

// Texto del aviso diario: solo números de historia vencidos, por servicio. null si no hay vencidas.
function mensajeVencidas(fuera, momento) {
  var vencidas = fuera.filter(function (p) { return p.vencida; });
  if (!vencidas.length) return null;
  var servicios = vencidas.map(function (p) { return p.servicio; })
    .filter(function (s, i, todos) { return todos.indexOf(s) === i; });
  return 'Historias clínicas vencidas al ' + momento + ' (' + vencidas.length + '):\n' + servicios.map(function (s) {
    var numeros = vencidas.filter(function (p) { return p.servicio === s; }).map(function (p) { return p.numero; });
    return '- ' + s + ' (' + numeros.length + '): ' + numeros.join(', ');
  }).join('\n');
}

// Tiempo corrido hasta la fecha límite o desde que venció: menos de 1 h, horas hasta 24 h y luego días completos.
function tiempoRestante(limite, ahora) {
  if (!(limite instanceof Date)) return '—';
  var diferencia = limite.getTime() - ahora.getTime();
  var lapso = Math.abs(diferencia);
  var texto = lapso < HORA_MS ? 'menos de 1 h'
    : lapso < DIA_MS ? Math.floor(lapso / HORA_MS) + ' h'
    : Math.floor(lapso / DIA_MS) + (lapso < 2 * DIA_MS ? ' día' : ' días');
  return (diferencia >= 0 ? 'vence en ' : 'vencida hace ') + texto;
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
    salidasDelCargo: salidasDelCargo,
    fechaHoraDeTexto: fechaHoraDeTexto,
    limiteManual: limiteManual,
    validarCambioDeTipo: validarCambioDeTipo,
    limiteTrasEgreso: limiteTrasEgreso,
    prestamosFuera: prestamosFuera,
    inicioDeSemana: inicioDeSemana,
    cumplimientoPorSemana: cumplimientoPorSemana,
    mensajeVencidas: mensajeVencidas,
    tiempoRestante: tiempoRestante
  };
}
