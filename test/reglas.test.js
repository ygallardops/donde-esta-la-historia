const test = require('node:test');
const assert = require('node:assert');
const { fechaLimite } = require('../src/reglas.js');

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
