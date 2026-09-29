// Datos sintéticos para la demostración: números de historia, personas y cuentas inventados.
// Solo funciona si la propiedad DEMO del script vale "sí", para que nunca se ejecute en una hoja real.

var PERSONAS_DEMO = ['Ana Ejemplo Uno', 'Luis Ejemplo Dos', 'Rosa Ejemplo Tres', 'Juan Ejemplo Cuatro'];
var CUENTAS_DEMO = ['archivo1@ejemplo.pe', 'archivo2@ejemplo.pe'];

// Genera los préstamos de los últimos `dias` días (por defecto 28) y los agrega a movimientos.
function generarDatosSinteticos(dias) {
  if (!siNo(PropertiesService.getScriptProperties().getProperty('DEMO') || 'no', 'DEMO')) {
    throw new Error('Los datos sintéticos solo se generan si la propiedad DEMO del script vale "sí"');
  }
  var conf = leerConfiguracion();
  var ahora = new Date();
  var tipos = Object.keys(conf.plazos).filter(function (t) { return conf.plazos[t].forma !== 'manual'; });
  var azar = function (n) { return Math.floor(Math.random() * n); };
  var filas = [];
  var numero = 900000;

  for (var d = dias || 28; d >= 0; d--) {
    var dia = new Date(ahora.getTime() - d * DIA_MS);
    var tramo = tramoDelDia(dia, conf.horario);
    if (!tramo) continue;
    for (var k = 0, cantidad = 8 + azar(12); k < cantidad; k++) {
      var salida = new Date(tramo.apertura.getTime() + azar(tramo.cierre - tramo.apertura));
      if (salida > ahora) continue;
      var tipo = tipos[azar(tipos.length)];
      var plazo = conf.plazos[tipo];
      var fila = COLUMNAS.map(function () { return ''; });
      fila[COL.id] = Utilities.getUuid();
      fila[COL.numero] = String(numero++);
      fila[COL.servicio] = conf.servicios[azar(conf.servicios.length)];
      fila[COL.persona_autorizada] = PERSONAS_DEMO[azar(PERSONAS_DEMO.length)];
      fila[COL.tipo_inicial] = tipo;
      fila[COL.tipo_actual] = tipo;
      fila[COL.salida] = salida;
      fila[COL.registrado_por] = CUENTAS_DEMO[azar(CUENTAS_DEMO.length)];
      var limite = limiteAlSalir(plazo, salida, conf.horario);
      if (!limite) {
        var egreso = new Date(salida.getTime() + (1 + azar(96)) * HORA_MS);
        if (egreso < ahora) {
          fila[COL.fin_observacion_o_egreso] = egreso;
          limite = limiteTrasEgreso(plazo, salida, egreso, ahora, conf.horario);
        }
      }
      fila[COL.fecha_limite] = limite || '';
      // Nueve de cada diez vuelven: la mayoría a tiempo y algunas con retraso.
      if (limite && azar(10) < 9) {
        var devolucion = azar(5) === 0
          ? new Date(limite.getTime() + (1 + azar(48)) * HORA_MS)
          : new Date(salida.getTime() + Math.random() * (limite - salida));
        if (devolucion < ahora) {
          fila[COL.devolucion] = devolucion;
          fila[COL.recibido_por] = CUENTAS_DEMO[azar(CUENTAS_DEMO.length)];
          fila[COL.integridad] = azar(15) === 0 ? 'con observaciones' : 'conforme';
          fila[COL.observacion] = fila[COL.integridad] === 'conforme' ? '' : 'Folios desordenados';
        }
      }
      filas.push(fila);
    }
    // Algunos ingresos sin salida registrada por día.
    for (var j = 0, sinSalida = azar(4); j < sinSalida; j++) {
      var ingreso = COLUMNAS.map(function () { return ''; });
      ingreso[COL.id] = Utilities.getUuid();
      ingreso[COL.numero] = String(numero++);
      ingreso[COL.tipo_inicial] = SIN_SALIDA;
      ingreso[COL.tipo_actual] = SIN_SALIDA;
      ingreso[COL.devolucion] = new Date(Math.min(tramo.apertura.getTime() + azar(HORA_MS * 2), ahora.getTime()));
      ingreso[COL.recibido_por] = CUENTAS_DEMO[azar(CUENTAS_DEMO.length)];
      ingreso[COL.integridad] = 'conforme';
      filas.push(ingreso);
    }
  }
  // Se ordenan junto con los movimientos existentes, en orden de registro (la salida, o el ingreso si no hubo),
  // porque la reimpresión del cargo busca las salidas de hoy desde el final.
  var orden = function (f) { return (f[COL.salida] || f[COL.devolucion]).getTime(); };
  var todas = todasLasFilas().concat(filas).sort(function (a, b) { return orden(a) - orden(b); });
  libro().getSheetByName('movimientos').getRange(2, 1, todas.length, COLUMNAS.length).setValues(todas);
  console.log('Movimientos sintéticos agregados: ' + filas.length);
}
