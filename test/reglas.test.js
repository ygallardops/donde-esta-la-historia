const test = require('node:test');
const assert = require('node:assert');
const { fechaLimite, normalizarNumero, prestamoAbierto, esAutorizada, limiteAlSalir, siNo, diaLocal, salidasDelCargo,
  fechaHoraDeTexto, limiteManual, validarCambioDeTipo, limiteTrasEgreso, prestamosFuera,
  inicioDeSemana, cumplimientoPorSemana, mensajeVencidas } = require('../src/reglas.js');

// Horario de ejemplo: lunes a viernes de 7:00 a 19:00 y sábados de 7:00 a 13:00.
const LV = ['07:00', '19:00'];
const HORARIO = { semana: [null, LV, LV, LV, LV, LV, ['07:00', '13:00']], feriados: ['2026-12-25'] };
const lima = (s) => new Date(s + '-05:00');
const vence = (plazo, inicio) => fechaLimite(plazo, lima(inicio), HORARIO);
const igual = (real, esperado) => assert.strictEqual(real.toISOString(), lima(esperado).toISOString());

// 2026-09-28 es lunes.
test('horas dentro del horario', () => igual(vence({ forma: 'horas', horas: 24 }, '2026-09-28T10:00'), '2026-09-29T10:00'));
test('horas desde el egreso', () => igual(vence({ forma: 'horas_desde_alta', horas: 48 }, '2026-09-28T10:00'), '2026-09-30T10:00'));
test('docencia: fecha manual', () => assert.strictEqual(vence({ forma: 'manual' }, '2026-09-28T10:00'), null));
test('forma desconocida', () => assert.throws(() => vence({ forma: 'semanas' }, '2026-09-28T10:00'), /desconocida/));
test('horas no válidas', () => assert.throws(() => vence({ forma: 'horas', horas: 0 }, '2026-09-28T10:00'), /Horas/));
test('inicio no válido', () => assert.throws(() => fechaLimite({ forma: 'horas', horas: 24 }, new Date('x'), HORARIO), /inicio/));

// 2026-09-25 es viernes, 2026-09-26 sábado, 2026-12-24 jueves y 2026-12-25 feriado.
test('noche: pasa a la apertura del día siguiente', () => igual(vence({ forma: 'horas', horas: 24 }, '2026-09-28T20:00'), '2026-09-30T07:00'));
test('madrugada: pasa a la apertura del mismo día', () => igual(vence({ forma: 'horas', horas: 24 }, '2026-09-28T05:00'), '2026-09-29T07:00'));
test('sábado por la tarde: pasa al lunes', () => igual(vence({ forma: 'horas', horas: 24 }, '2026-09-25T15:00'), '2026-09-28T07:00'));
test('domingo: pasa al lunes', () => igual(vence({ forma: 'horas', horas: 24 }, '2026-09-26T12:00'), '2026-09-28T07:00'));
test('feriado: pasa al día siguiente', () => igual(vence({ forma: 'horas', horas: 24 }, '2026-12-24T10:00'), '2026-12-26T07:00'));
test('vence justo al cierre: no se corre', () => igual(vence({ forma: 'horas', horas: 9 }, '2026-09-28T10:00'), '2026-09-28T19:00'));
test('horario sin días de atención', () => assert.throws(() => fechaLimite({ forma: 'horas', horas: 1 }, lima('2026-09-28T10:00'), { semana: [null, null, null, null, null, null, null], feriados: [] }), /días de atención/));
test('hora mal escrita en el horario', () => assert.throws(() => fechaLimite({ forma: 'horas', horas: 1 }, lima('2026-09-28T10:00'), { semana: [null, ['7:00', '19:00'], LV, LV, LV, LV, null], feriados: [] }), /Hora no válida/));

// 2026-09-27 es domingo.
test('fin del día: lunes', () => igual(vence({ forma: 'fin_del_dia' }, '2026-09-28T10:00'), '2026-09-28T19:00'));
test('fin del día: sábado', () => igual(vence({ forma: 'fin_del_dia' }, '2026-09-26T09:00'), '2026-09-26T13:00'));
test('fin del día: salida con el archivo cerrado pasa a la siguiente apertura', () => igual(vence({ forma: 'fin_del_dia' }, '2026-09-27T10:00'), '2026-09-28T07:00'));

const GENERICO = { patron: '[A-Z0-9-]{1,20}', quitarCeros: false };
const NUMERICO = { patron: '[0-9]{1,6}', quitarCeros: true };
test('número: quita espacios y pasa a mayúsculas', () => assert.strictEqual(normalizarNumero(' ab-12 34 ', GENERICO), 'AB-1234'));
test('número: conserva los ceros si el formato no los quita', () => assert.strictEqual(normalizarNumero('00012345', GENERICO), '00012345'));
test('número: quita los ceros a la izquierda si el formato lo indica', () => assert.strictEqual(normalizarNumero('000123', NUMERICO), '123'));
test('número: el cero solo se conserva', () => assert.strictEqual(normalizarNumero('000', NUMERICO), '0'));
test('número: el patrón se aplica completo', () => assert.throws(() => normalizarNumero('1234567', NUMERICO), /no válido/));
test('número vacío o con símbolos', () => {
  assert.throws(() => normalizarNumero('  ', GENERICO), /no válido/);
  assert.throws(() => normalizarNumero('12/34', GENERICO), /no válido/);
  assert.throws(() => normalizarNumero('A1', NUMERICO), /no válido/);
});
test('formato mal configurado', () => assert.throws(() => normalizarNumero('1', { patron: '[0-9', quitarCeros: false }), /mal configurado/));

const FILAS = [['111', '2026-09-01'], ['222', ''], ['111', '']];
test('préstamo abierto: encuentra el que no tiene devolución', () => assert.strictEqual(prestamoAbierto('111', FILAS), 2));
test('préstamo abierto: devuelto o inexistente', () => {
  assert.strictEqual(prestamoAbierto('333', FILAS), -1);
  assert.strictEqual(prestamoAbierto('111', [['111', '2026-09-01']]), -1);
});

test('cuenta autorizada sin distinguir mayúsculas', () => assert.ok(esAutorizada('Ana@Ipress.pe', ['ana@ipress.pe'])));
test('cuenta no autorizada o vacía', () => {
  assert.ok(!esAutorizada('otra@ipress.pe', ['ana@ipress.pe']));
  assert.ok(!esAutorizada('', ['']));
});

test('al salir: hospitalización queda sin fecha límite', () => assert.strictEqual(limiteAlSalir({ forma: 'horas_desde_alta', horas: 48 }, lima('2026-09-28T10:00'), HORARIO), null));
test('al salir: horas usa el cálculo normal', () => igual(limiteAlSalir({ forma: 'horas', horas: 24 }, lima('2026-09-28T10:00'), HORARIO), '2026-09-29T10:00'));
test('al salir: manual vence al cierre del día elegido', () => igual(limiteAlSalir({ forma: 'manual' }, lima('2026-09-28T10:00'), HORARIO, '2026-10-02'), '2026-10-02T19:00'));
test('al salir: manual en domingo pasa al lunes', () => igual(limiteAlSalir({ forma: 'manual' }, lima('2026-09-28T10:00'), HORARIO, '2026-10-04'), '2026-10-05T07:00'));
test('al salir: manual el mismo día de la salida', () => igual(limiteAlSalir({ forma: 'manual' }, lima('2026-09-28T10:00'), HORARIO, '2026-09-28'), '2026-09-28T19:00'));
test('al salir: manual sin fecha o anterior a la salida', () => {
  assert.throws(() => limiteAlSalir({ forma: 'manual' }, lima('2026-09-28T10:00'), HORARIO), /Falta/);
  assert.throws(() => limiteAlSalir({ forma: 'manual' }, lima('2026-09-28T10:00'), HORARIO, '2026-09-27'), /anterior/);
  assert.throws(() => limiteAlSalir({ forma: 'manual' }, lima('2026-09-28T10:00'), HORARIO, '28/09/2026'), /Fecha no válida/);
});

test('sí o no: acepta tilde y mayúsculas', () => {
  ['sí', 'si', 'SÍ', ' Si '].forEach((v) => assert.strictEqual(siNo(v, 'quitar_ceros'), true));
  ['no', 'NO', ' No '].forEach((v) => assert.strictEqual(siNo(v, 'quitar_ceros'), false));
});
test('sí o no: otro valor es un error', () => {
  assert.throws(() => siNo('', 'quitar_ceros'), /Valor no válido en quitar_ceros/);
  assert.throws(() => siNo('tal vez', 'quitar_ceros'), /Valor no válido en quitar_ceros/);
});

test('día local: las 23:30 del Perú siguen siendo el mismo día', () => assert.strictEqual(diaLocal(lima('2026-09-28T23:30')), '2026-09-28'));

const SALIDAS = [
  { numero: '1', servicio: 'Emergencia', persona: 'Ana Soto', salida: lima('2026-09-27T23:50') },
  { numero: '2', servicio: 'Emergencia', persona: 'Ana Soto', salida: lima('2026-09-28T08:00') },
  { numero: '3', servicio: 'Emergencia', persona: 'Luis Díaz', salida: lima('2026-09-28T08:05') },
  { numero: '4', servicio: 'Consulta externa', persona: 'Ana Soto', salida: lima('2026-09-28T08:10') },
  { numero: '5', servicio: 'Emergencia', persona: '  ana   SOTO ', salida: lima('2026-09-28T09:00') }
];
test('cargo: solo el día, el servicio y la persona indicados, en orden', () =>
  assert.deepStrictEqual(salidasDelCargo(SALIDAS, '2026-09-28', 'Emergencia', 'Ana Soto').map((s) => s.numero), ['2', '5']));
test('cargo: sin salidas que coincidan', () =>
  assert.deepStrictEqual(salidasDelCargo(SALIDAS, '2026-09-29', 'Emergencia', 'Ana Soto'), []));

test('fecha y hora del campo de la página', () => {
  igual(fechaHoraDeTexto('2026-09-28T14:30'), '2026-09-28T14:30');
  assert.throws(() => fechaHoraDeTexto('28/09/2026 14:30'), /no válidas/);
});

test('retención: vence al cierre del día elegido', () => igual(limiteManual('2026-09-30', lima('2026-09-28T10:00'), HORARIO), '2026-09-30T19:00'));
test('retención: fecha anterior a hoy o vacía', () => {
  assert.throws(() => limiteManual('2026-09-27', lima('2026-09-28T10:00'), HORARIO), /anterior a hoy/);
  assert.throws(() => limiteManual('', lima('2026-09-28T10:00'), HORARIO), /Falta/);
});

const HOSP = { forma: 'horas_desde_alta', horas: 48 };
test('cambio de tipo: a hospitalización u observación', () => assert.doesNotThrow(() => validarCambioDeTipo('Emergencia', '', 'Hospitalización', HOSP)));
test('cambio de tipo: rechazos', () => {
  assert.throws(() => validarCambioDeTipo('Emergencia', '', 'Docencia', { forma: 'manual' }), /Solo se puede cambiar/);
  assert.throws(() => validarCambioDeTipo('Hospitalización', '', 'Hospitalización', HOSP), /ya está en/);
  assert.throws(() => validarCambioDeTipo('Observación', lima('2026-09-28T10:00'), 'Hospitalización', HOSP), /Ya se registró/);
  assert.throws(() => validarCambioDeTipo('Emergencia', '', 'Otro', undefined), /no válido/);
});

test('egreso: el plazo corre desde el egreso', () =>
  igual(limiteTrasEgreso(HOSP, lima('2026-09-25T10:00'), lima('2026-09-28T10:00'), lima('2026-09-28T12:00'), HORARIO), '2026-09-30T10:00'));
test('fin de observación: vuelven a correr 24 horas', () =>
  igual(limiteTrasEgreso({ forma: 'horas_desde_alta', horas: 24 }, lima('2026-09-28T02:00'), lima('2026-09-28T09:00'), lima('2026-09-28T12:00'), HORARIO), '2026-09-29T09:00'));
test('egreso: rechazos', () => {
  assert.throws(() => limiteTrasEgreso({ forma: 'horas', horas: 24 }, lima('2026-09-28T10:00'), lima('2026-09-28T11:00'), lima('2026-09-28T12:00'), HORARIO), /no espera/);
  assert.throws(() => limiteTrasEgreso(HOSP, lima('2026-09-28T10:00'), lima('2026-09-28T09:00'), lima('2026-09-28T12:00'), HORARIO), /anterior a la salida/);
  assert.throws(() => limiteTrasEgreso(HOSP, lima('2026-09-28T10:00'), lima('2026-09-28T13:00'), lima('2026-09-28T12:00'), HORARIO), /posterior/);
});

test('fuera ahora: sin devueltas, vencidas marcadas, por servicio y fecha límite', () => {
  const ahora = lima('2026-09-28T12:00');
  const fuera = prestamosFuera([
    { numero: '1', servicio: 'Emergencia', limite: lima('2026-09-29T10:00'), devolucion: '' },
    { numero: '2', servicio: 'Consulta externa', limite: lima('2026-09-28T19:00'), devolucion: '' },
    { numero: '3', servicio: 'Emergencia', limite: '', devolucion: '' },
    { numero: '4', servicio: 'Emergencia', limite: lima('2026-09-27T10:00'), devolucion: '' },
    { numero: '5', servicio: 'Emergencia', limite: lima('2026-09-27T10:00'), devolucion: lima('2026-09-27T09:00') }
  ], ahora);
  assert.deepStrictEqual(fuera.map((p) => p.numero + (p.vencida ? '!' : '')), ['2', '4!', '1', '3']);
});

test('egreso en el mismo minuto de la salida', () =>
  assert.doesNotThrow(() => limiteTrasEgreso(HOSP, lima('2026-09-28T10:00:35'), lima('2026-09-28T10:00'), lima('2026-09-28T12:00'), HORARIO)));

test('semana: empieza el lunes, en hora del Perú', () => {
  assert.strictEqual(inicioDeSemana(lima('2026-09-28T00:30')), '2026-09-28');
  assert.strictEqual(inicioDeSemana(lima('2026-10-04T23:30')), '2026-09-28');
  assert.strictEqual(inicioDeSemana(lima('2026-09-27T23:59')), '2026-09-21');
});

test('cumplimiento: ingresos y sin salida por semana, la más reciente primero', () => {
  const r = cumplimientoPorSemana([
    { fecha: lima('2026-09-29T10:00'), sinSalida: false },
    { fecha: lima('2026-09-30T10:00'), sinSalida: true },
    { fecha: lima('2026-09-22T10:00'), sinSalida: true },
    { fecha: lima('2026-08-01T10:00'), sinSalida: true },
    { fecha: '', sinSalida: false }
  ], lima('2026-10-01T12:00'), 3);
  assert.deepStrictEqual(r, [
    { semana: '2026-09-28', ingresos: 2, sinSalida: 1 },
    { semana: '2026-09-21', ingresos: 1, sinSalida: 1 },
    { semana: '2026-09-14', ingresos: 0, sinSalida: 0 }
  ]);
});

test('aviso: solo vencidas, por servicio y sin otros datos', () => {
  const fuera = [
    { numero: '11', servicio: 'Emergencia', persona: 'Ana Soto', vencida: true },
    { numero: '12', servicio: 'Consulta externa', persona: 'Luis Díaz', vencida: false },
    { numero: '13', servicio: 'Emergencia', persona: 'Ana Soto', vencida: true },
    { numero: '14', servicio: 'Hospitalización', persona: 'Rosa Paz', vencida: true }
  ];
  const texto = mensajeVencidas(fuera, '29/09/2026 08:05');
  assert.strictEqual(texto, 'Historias clínicas vencidas al 29/09/2026 08:05 (3):\n- Emergencia (2): 11, 13\n- Hospitalización (1): 14');
  assert.ok(!/Ana|Luis|Rosa/.test(texto));
});
test('aviso: sin vencidas no hay mensaje', () => assert.strictEqual(mensajeVencidas([{ numero: '1', servicio: 'X', vencida: false }], 'hoy'), null));
