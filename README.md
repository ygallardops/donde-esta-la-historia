# ¿Dónde está la historia?

Herramienta para apoyar el control de préstamos de historias clínicas físicas según la NTS N.° 139-MINSA/2018/DGAIN, «Norma Técnica de Salud para la Gestión de la Historia Clínica».

Registra la salida y la devolución de cada historia, calcula la fecha límite según los plazos que configure la IPRESS y genera el cargo para la firma de quien recibe. Funciona con Google Sheets y Apps Script, sin instalar software.

**Estado:** en desarrollo. No debe usarse con datos reales sin la aprobación formal de la IPRESS.

## Qué hace

- Registra salidas y devoluciones por número de historia, desde el teclado: número y Enter.
- Rechaza la salida de una historia que ya figura prestada y la devolución de una que no lo está.
- Calcula la fecha límite con plazos configurables y la ajusta al horario del archivo.
- Registra la integridad de la historia devuelta.
- Genera un cargo imprimible y permite reimprimir el cargo del día.
- Solo admite las cuentas autorizadas en la hoja.
- Guarda solo el número de historia: sin nombre del paciente ni diagnóstico.

El diseño completo, con las fuentes normativas de cada plazo, está en [docs/diseno/control-prestamos.md](docs/diseno/control-prestamos.md).

## Estructura

| Archivo | Contenido |
| --- | --- |
| `src/reglas.js` | Reglas sin dependencias de Google: fecha límite, formato del número, duplicados, cargo |
| `src/app.js` | Capa de Apps Script: hoja, registro y configuración |
| `src/pagina.html` | Página de Salida y Devolución |
| `test/reglas.test.js` | Pruebas de las reglas |

## Pruebas

Requieren Node.js (probado con la versión 24), sin dependencias:

```bash
node --test
```

## Instalación

1. Instalar [clasp](https://github.com/google/clasp) e iniciar sesión con la cuenta que será propietaria de la hoja.
2. `clasp create --type standalone --title "Donde esta la historia" --rootDir src` y `clasp push`.
3. En el editor de Apps Script, ejecutar `prepararHoja`: crea la hoja con una configuración de ejemplo.
4. Revisar en la hoja los plazos, el horario, los servicios, el formato del número y las cuentas autorizadas.
5. Implementar como aplicación web, ejecutada como la cuenta propietaria. En una IPRESS, el acceso se restringe a su dominio.

## Licencia

[MIT](LICENSE)
