// Reglas del control de préstamos. No dependen de Google: se ejecutan en
// Apps Script y en Node, donde se prueban con node --test.

var HORA_MS = 60 * 60 * 1000;

// Devuelve la fecha límite, o null cuando la fija quien registra (forma "manual").
// inicio: la salida para fin_del_dia y horas; el egreso para horas_desde_alta.
function fechaLimite(plazo, inicio, horario) {
  if (!(inicio instanceof Date) || isNaN(inicio)) throw new Error('Fecha de inicio no válida');
  switch (plazo.forma) {
    case 'manual':
      return null;
    case 'horas':
    case 'horas_desde_alta':
      if (!(plazo.horas > 0)) throw new Error('Horas no válidas: ' + plazo.horas);
      return new Date(inicio.getTime() + plazo.horas * HORA_MS);
    default:
      throw new Error('Forma de vencimiento desconocida: ' + plazo.forma);
  }
}

if (typeof module !== 'undefined') module.exports = { fechaLimite: fechaLimite };
