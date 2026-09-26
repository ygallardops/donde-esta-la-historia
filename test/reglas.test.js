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
