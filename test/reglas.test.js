const test = require('node:test');
const assert = require('node:assert');
const { fechaLimite, normalizarNumero, prestamoAbierto, esAutorizada, limiteAlSalir } = require('../src/reglas.js');

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
