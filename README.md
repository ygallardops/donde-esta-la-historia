# ¿Dónde está la historia?

Herramienta para apoyar el control de préstamos de historias clínicas físicas según la NTS N.° 139-MINSA/2018/DGAIN, «Norma Técnica de Salud para la Gestión de la Historia Clínica».

Registra la salida y la devolución de cada historia, calcula la fecha límite según los plazos que configure la IPRESS y genera el cargo para la firma de quien recibe. Funciona con Google Sheets y Apps Script, sin instalar software.

**Estado:** en desarrollo. No debe usarse con datos reales sin la aprobación formal de la IPRESS.

## Qué hace

- Registra salidas y devoluciones por número de historia, desde el teclado: número y Enter, sin esperar a que termine cada registro.
- Rechaza la salida de una historia que ya figura prestada y la devolución de una que no lo está.
- Calcula la fecha límite con plazos configurables y la ajusta al horario del archivo.
- Registra la integridad de la historia devuelta, el cambio de tipo, el egreso o fin de la observación y la retención justificada.
- Genera un cargo imprimible y permite reimprimir el cargo del día.
- Muestra las historias fuera, con las vencidas marcadas, y el historial de un número.
- Registra el ingreso de una historia sin salida registrada y mide por semana el cumplimiento del registro de salidas.
- Envía un aviso diario de historias vencidas a un espacio de Google Chat.
- Solo admite las cuentas autorizadas en la hoja.
- Guarda solo el número de historia: sin nombre del paciente ni diagnóstico.

El diseño completo, con las fuentes normativas de cada plazo, está en [docs/diseno/control-prestamos.md](docs/diseno/control-prestamos.md).

## Estructura

| Archivo | Contenido |
| --- | --- |
| `src/reglas.js` | Reglas sin dependencias de Google: fecha límite, formato del número, duplicados, cargo, consultas y aviso |
| `src/app.js` | Capa de Apps Script: hoja, registro, consultas, aviso y configuración |
| `src/pagina.html` | Página de Salida, Devolución, Seguimiento y Consultas |
| `src/demo.js` | Datos sintéticos para la demostración |
| `test/reglas.test.js` | Pruebas de las reglas |

## Pruebas

Requieren Node.js (probado con la versión 24), sin dependencias:

```bash
node --test
```

GitHub Actions las ejecuta en cada push.

## Instalación

1. Instalar [clasp](https://github.com/google/clasp) e iniciar sesión con la cuenta que será propietaria de la hoja.
2. `clasp create --type standalone --title "Donde esta la historia" --rootDir src` y `clasp push`.
3. En el editor de Apps Script, ejecutar `prepararHoja`: crea la hoja con una configuración de ejemplo y los activadores.
4. Revisar en la hoja los plazos, el horario, los servicios, el formato del número y las cuentas autorizadas.
5. Implementar como aplicación web, ejecutada como la cuenta propietaria. En una IPRESS, el acceso se restringe a su dominio.
6. Opcional: para el aviso diario, crear un webhook en un espacio de Google Chat (requiere una cuenta Business o Enterprise de Google Workspace) y guardarlo en la propiedad del script `WEBHOOK_CHAT`. Sin ella, el aviso queda en el registro de ejecución.

## Demostración

En una hoja de prueba, nunca en una con datos reales: poner la propiedad del script `DEMO` en `sí` y ejecutar `generarDatosSinteticos`. Agrega préstamos de las últimas cuatro semanas con números de historia, personas y cuentas inventados.

## Licencia

[MIT](LICENSE)
