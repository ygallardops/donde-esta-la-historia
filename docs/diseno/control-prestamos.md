# ¿Dónde está la historia? Control de préstamos de historias clínicas

Documento de diseño · Versión 1

## Problema

La NTS N.° 139-MINSA/2018/DGAIN, «Norma Técnica de Salud para la Gestión de la Historia Clínica», aprobada por la RM N.° 214-2018/MINSA, establece que:

- Toda historia clínica que sale del archivo debe registrarse, de modo que consten la salida, la recepción por el usuario interno y la devolución, y que se verifique la integridad del documento devuelto (numeral 5.3.1, inciso 5), literal b).
- El registro incluye el nombre y apellido completos de la persona autorizada que solicita la historia, la fecha, la hora y los plazos de préstamo y devolución (numeral 5.3.2, inciso 3), subnumeral 3.3, literal b).
- La historia debe devolverse inmediatamente después de concluida la atención o el trámite (numeral 5.3.1, inciso 4), literal g), con plazos máximos según el uso.
- La retención justificada se reporta por escrito el mismo día al responsable del archivo, con el motivo y la fecha de devolución (numeral 5.3.1, inciso 5), literales e y f).

Esta herramienta facilita ese control: registra la salida y la devolución de cada historia, calcula la fecha límite según los plazos que configure la IPRESS y avisa a diario de las historias vencidas.

## Objetivo

Registrar cada salida y cada devolución en segundos, saber en todo momento qué historias están fuera y avisar a diario de las vencidas, sin instalar software y sin guardar más datos de los necesarios.

## Fuera de alcance en la versión 1

- Códigos QR o de barras en las carátulas.
- El tarjetón de reemplazo (numeral 5.3.1, inciso 5), literal d), que es un procedimiento físico del archivo.
- Reportes mensuales o indicadores.
- Integración con sistemas de historia clínica electrónica.
- Digitalización de documentos.

## Principios

1. **Mínimos datos.** Del paciente, solo el número de historia: ni nombre ni diagnóstico. La información de salud es un dato sensible según la Ley N.° 29733, Ley de Protección de Datos Personales.
2. **Solo cuentas institucionales.** En una IPRESS, la herramienta se instala en una cuenta institucional y la página solo admite cuentas de su dominio.
3. **El historial no se edita a mano.** La hoja está protegida y solo se escribe a través de la página.
4. **Los plazos son configuración, no código.** Se editan en la hoja. Cada IPRESS debe comprobarlos contra la NTS y sus propias disposiciones.

## Funcionamiento

### Registrar una salida

Campos: número de historia, servicio (lista), nombre y apellido completos de la persona autorizada que la solicita (texto, obligatorio) y tipo de préstamo (lista).

- La fecha y hora de salida y la cuenta que registra se toman automáticamente.
- La fecha límite se calcula según la tabla de plazos y el horario del archivo.
- **Bloqueo de duplicados:** si la historia ya figura como prestada, no se registra y se muestra dónde está. Esto detecta números mal digitados y préstamos dobles.

### Registrar una devolución

Se escribe el número de historia y se indica la **integridad**: «conforme» (por defecto) o «con observaciones», con una observación breve. Quedan registradas la fecha, la hora y la cuenta que la recibe. Si la historia no figura como prestada, se muestra un aviso y no se registra nada.

La cuenta institucional que registra la salida o la devolución queda como constancia de quién intervino. Cada IPRESS decide si eso reemplaza la firma que exige el numeral 5.3.1, inciso 5), literal b, o si mantiene además la firma en un formato físico.

### Cambio de tipo

Una historia prestada para consulta ambulatoria o para emergencia puede cambiar de tipo sin registrar una nueva salida, porque la NTS exceptúa esos plazos cuando el paciente es hospitalizado o, en emergencia, cuando permanece en sala de observación (numeral 5.3.2, inciso 3), subnumeral 3.3, literales f y h). Se conservan la salida original y el tipo inicial, se registran la fecha y hora del cambio y se recalcula la fecha límite según el nuevo tipo.

### Hospitalización

El plazo corre desde el egreso del paciente. Al salir o al cambiar de tipo, la historia queda como «en hospitalización», sin fecha límite. Cuando se registra la fecha de egreso, se calcula la fecha límite.

### Observación en emergencia

La NTS exceptúa del plazo de 24 horas a la historia del paciente que permanece en sala de observación, pero no fija otro plazo. Como decisión de diseño, al cambiar de tipo la historia queda como «en observación», sin fecha límite. Cuando se registra el fin de la observación, vuelven a correr las 24 horas del préstamo de emergencia. Si el paciente pasa a hospitalización, se aplica el cambio de tipo correspondiente.

### Retención justificada

Para una historia prestada se registran el motivo y la nueva fecha de devolución. Desde ese momento, la nueva fecha reemplaza a la fecha límite anterior. El registro no sustituye el reporte escrito que exige la NTS (numeral 5.3.1, inciso 5), literal f).

### Consultas

- **Fuera ahora:** historias prestadas, agrupadas por servicio.
- **Vencidas:** historias con la fecha límite superada.
- **Historial:** todos los movimientos de un número de historia.

### Aviso diario

Todos los días a las 8:00 se envía a un espacio de Google Chat la lista de historias vencidas, agrupadas por servicio. Solo se incluyen números de historia. Si no hay vencidas, no se envía nada.

## Cálculo de la fecha límite

La tabla de plazos admite tres formas de vencimiento:

| Forma | Significado |
| --- | --- |
| `fin_del_dia` | Cierre del archivo el mismo día de la salida |
| `horas` | N horas corridas desde la salida |
| `horas_desde_alta` | N horas corridas desde el egreso |

En docencia e investigación no hay fórmula: la fecha límite la fija quien registra la salida.

Configuración de ejemplo del repositorio:

| Tipo de préstamo | Forma | Horas | Fuente |
| --- | --- | --- | --- |
| Consulta ambulatoria | `fin_del_dia` | — | NTS, 5.3.2, inc. 3), 3.3, lit. f: «el mismo día de la atención» |
| Emergencia | `horas` | 24 | NTS, 5.3.2, inc. 3), 3.3, lit. h |
| Hospitalización | `horas_desde_alta` | 48 | NTS, 5.3.2, inc. 3), 3.3, lit. g |
| Informes médicos y auditoría médica | `horas` | 72 | NTS, 5.3.1, inc. 5), lit. c |
| Docencia e investigación | fecha manual | — | NTS, 5.3.2, inc. 3), 3.2, lit. a: la revisión se hace en el archivo y la IPRESS establece los requisitos de solicitud y devolución |

**Decisiones de diseño que no provienen de la NTS:**

- Las horas se cuentan corridas.
- Si el vencimiento cae con el archivo cerrado (de noche, en un día no laborable o en un feriado), pasa a la siguiente apertura.
- «El mismo día de la atención» se interpreta como la hora de cierre del archivo de ese día.
- En observación, las 24 horas de emergencia vuelven a correr desde el fin de la observación.

Ejemplos con el horario de ejemplo de la configuración (lunes a viernes de 7:00 a 19:00 y sábados de 7:00 a 13:00):

- Sale un sábado a las 12:00 con 24 horas → vence el domingo a las 12:00 → se corre al lunes a las 7:00.
- Sale un lunes a las 10:00 con `fin_del_dia` → vence el lunes a las 19:00.
- Sale un sábado a las 9:00 con `fin_del_dia` → vence el sábado a las 13:00.

El horario de atención y la lista de feriados se configuran en la hoja.

## Datos

Un archivo de Google Sheets por año, con estas pestañas:

| Pestaña | Contenido |
| --- | --- |
| `movimientos` | Una fila por préstamo: id, número de historia, servicio, persona autorizada, tipo inicial, tipo actual, salida, registrado por, cambio de tipo, fin de observación o egreso, fecha límite, motivo de retención, devolución, recibido por, integridad, observación |
| `plazos` | Tipo de préstamo, forma de vencimiento y horas |
| `servicios` | Lista de servicios y consultorios |
| `horario` | Horario de apertura por día de la semana y feriados |

Google Sheets admite hasta 10 millones de celdas por archivo. Con 16 columnas en `movimientos`, un archivo anual admite más de 600 000 préstamos.

## Arquitectura

- **Página web de Apps Script** con dos pestañas, Salida y Devolución, pensada para el teclado: escribir el número y presionar Enter. Acceso restringido a cuentas del dominio y ejecución como el usuario que la abre.
- **Escrituras de una en una** con `LockService`, para que dos personas que registran al mismo tiempo no se pisen.
- **Reglas en JavaScript puro** (`src/reglas.js`): cálculo de la fecha límite, ajuste al horario, cambio de tipo, estado de una historia y validaciones. No dependen de Google.
- **Capa delgada de Apps Script** (`src/app.js`): lee y escribe en la hoja, sirve la página y envía el aviso a Chat.
- **Disparador diario** a las 8:00 para el aviso. La URL del webhook de Chat se guarda en las propiedades del script, nunca en el código.

## Pruebas

- Las reglas se prueban con `node --test`, sin frameworks. Casos mínimos: cada forma de vencimiento, cada corrimiento por horario (noche, sábado por la tarde, domingo, feriado), bloqueo de duplicados, devolución de una historia no prestada, hospitalización sin egreso, observación sin fin registrado y cambio de tipo (de consulta ambulatoria y de emergencia a hospitalización, y de emergencia a observación).
- GitHub Actions ejecuta las pruebas en cada push.
- La capa de Apps Script se prueba a mano sobre la hoja de datos sintéticos antes de cada versión.

## Despliegues

| | Demostración | Institucional |
| --- | --- | --- |
| Cuenta | Personal | Institucional de la IPRESS |
| Datos | Sintéticos, generados por un script | Reales |
| Cuándo | Desde la primera versión funcional | Solo después de la aprobación formal de la IPRESS |
| Cómo | `clasp push` | `clasp push` a mano, desde la cuenta institucional |

Ninguna credencial institucional pasa por el repositorio.

## Plan de avance

1. Reglas y pruebas del cálculo de la fecha límite.
2. Hoja, página de Salida y Devolución (con integridad) y bloqueo de duplicados.
3. Consultas (fuera ahora, vencidas, historial), retención, hospitalización, observación y cambio de tipo.
4. Aviso diario, datos sintéticos, README y publicación del repositorio.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Uso desde una cuenta personal | La página solo admite cuentas del dominio institucional |
| Número de historia mal digitado | Bloqueo de duplicados; se rechaza la devolución de una historia no prestada; QR en una versión futura |
| Plazos distintos a los de la norma | Tabla configurable, con la fuente de cada plazo, verificada por cada IPRESS antes de usarla |
| Devoluciones sin registrar | La devolución toma un número y un Enter; el aviso diario muestra las pendientes |
| Datos del paciente en campos de texto | Los campos de observación y motivo indican que no deben incluir datos del paciente |
