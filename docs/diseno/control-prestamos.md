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
3. **El historial no se edita a mano.** La hoja no se comparte con quienes registran y solo se escribe a través de la página; sus pestañas tienen protección de advertencia para la cuenta propietaria.
4. **Los plazos son configuración, no código.** Se editan en la hoja. Cada IPRESS debe comprobarlos contra la NTS y sus propias disposiciones.

## Funcionamiento

### Cuentas autorizadas

La IPRESS mantiene en la hoja la lista de cuentas autorizadas para registrar salidas y devoluciones, según sus designaciones formales. La NTS define como personal autorizado al personal responsable del archivo asignado formalmente y al personal de la salud que brinda la atención (numeral 4.1), y dispone que las historias se soliciten al personal autorizado del archivo según la organización institucional (numeral 5.3.2, inciso 3), subnumeral 3.3, literal a). La página rechaza las cuentas que no estén en la lista, aunque sean del dominio.

### Registrar una salida

Campos: número de historia, servicio (lista), nombre y apellido completos de la persona autorizada que la solicita (texto, obligatorio) y tipo de préstamo (lista).

- La fecha y hora de salida y la cuenta que registra se toman automáticamente.
- La fecha límite se calcula según la tabla de plazos y el horario del archivo.
- **Formato del número:** cada IPRESS configura en la hoja el patrón que debe cumplir el número de historia y si se quitan los ceros a la izquierda, para que `000123` y `123` se reconozcan como la misma historia.
- **Bloqueo de duplicados:** si la historia ya figura como prestada, no se registra y se muestra dónde está. Esto detecta números mal digitados y préstamos dobles.

### Cargo

Después de registrar las salidas de un servicio, la página genera un cargo imprimible con los números de historia, el servicio, la fecha y hora, la cuenta que entrega y el nombre de quien recibe, con espacio para su firma manuscrita (numeral 5.3.1, inciso 5), literal b).

Si el cargo se pierde antes de imprimirse, «Reimprimir cargo de hoy» lo arma desde la hoja con las salidas del día para ese servicio y esa persona.

### Registrar una devolución

Se escribe el número de historia y se indica la **integridad**: «conforme» (por defecto) o «con observaciones», con una observación breve. Quedan registradas la fecha, la hora y la cuenta que la recibe. Si la historia no figura como prestada, se muestra un aviso y no se registra nada.

La cuenta institucional que registra la salida o la devolución queda como constancia de quién intervino. Cada IPRESS decide si eso reemplaza la firma que exige el numeral 5.3.1, inciso 5), literal b, o si mantiene además la firma en un formato físico.

### Cambio de tipo

Una historia prestada para consulta ambulatoria o para emergencia puede cambiar de tipo sin registrar una nueva salida, porque la NTS exceptúa esos plazos cuando el paciente es hospitalizado o, en emergencia, cuando permanece en sala de observación (numeral 5.3.2, inciso 3), subnumeral 3.3, literales f y h). El cambio solo puede hacerse hacia un tipo que espera el egreso o el fin de la observación, y antes de registrarlo. Se conservan la salida original y el tipo inicial, se registran la fecha y hora del cambio y la historia queda sin fecha límite hasta el egreso o el fin de la observación.

### Hospitalización

El plazo corre desde el egreso del paciente. Al salir o al cambiar de tipo, la historia queda sin fecha límite. Cuando se registran la fecha y hora de egreso, se calcula la fecha límite. El egreso no puede ser anterior a la salida ni posterior al momento en que se registra.

### Observación en emergencia

La NTS exceptúa del plazo de 24 horas a la historia del paciente que permanece en sala de observación, pero no fija otro plazo. Como decisión de diseño, la observación se configura como un tipo de préstamo más, «Observación de emergencia», con la forma `horas_desde_alta` y 24 horas: al cambiar a ese tipo, la historia queda sin fecha límite, y cuando se registra el fin de la observación vuelven a correr 24 horas. El fin de la observación se registra igual que un egreso. Si el paciente pasa a hospitalización antes, se aplica el cambio de tipo correspondiente.

### Retención justificada

Para una historia prestada que tiene fecha límite se registran el motivo y la nueva fecha de devolución, que vence al cierre del archivo ese día y no puede ser anterior a hoy. Desde ese momento, la nueva fecha reemplaza a la fecha límite anterior. Si hay varias retenciones, se conservan todos los motivos con su fecha y hora. El registro no sustituye el reporte escrito que exige la NTS (numeral 5.3.1, inciso 5), literal f).

### Consultas

- **Fuera ahora:** historias prestadas, agrupadas por servicio y ordenadas por fecha límite, con las vencidas marcadas y un filtro para ver solo esas.
- **Historial:** todos los préstamos de un número de historia, del más reciente al más antiguo.

### Aviso diario

Todos los días a las 8:00 se envía a un espacio de Google Chat la lista de historias vencidas, agrupadas por servicio. Solo se incluyen números de historia. Si no hay vencidas, no se envía nada.

## Cálculo de la fecha límite

La tabla de plazos admite tres formas de vencimiento:

| Forma | Significado |
| --- | --- |
| `fin_del_dia` | Cierre del archivo el mismo día de la salida |
| `horas` | N horas corridas desde la salida |
| `horas_desde_alta` | N horas corridas desde el egreso o el fin de la observación |

En docencia e investigación no hay fórmula: la fecha límite la fija quien registra la salida.

Configuración de ejemplo del repositorio:

| Tipo de préstamo | Forma | Horas | Fuente |
| --- | --- | --- | --- |
| Consulta ambulatoria | `fin_del_dia` | — | NTS, 5.3.2, inc. 3), 3.3, lit. f: «el mismo día de la atención» |
| Emergencia | `horas` | 24 | NTS, 5.3.2, inc. 3), 3.3, lit. h |
| Hospitalización | `horas_desde_alta` | 48 | NTS, 5.3.2, inc. 3), 3.3, lit. g |
| Observación de emergencia | `horas_desde_alta` | 24 | NTS, 5.3.2, inc. 3), 3.3, lit. h (la excepción); las 24 horas son decisión de diseño |
| Informes médicos y auditoría médica | `horas` | 72 | NTS, 5.3.1, inc. 5), lit. c |
| Docencia e investigación | fecha manual | — | NTS, 5.3.2, inc. 3), 3.2, lit. a: la revisión se hace en el archivo y la IPRESS establece los requisitos de solicitud y devolución |

**Decisiones de diseño que no provienen de la NTS:**

- El horario del archivo solo se usa para calcular vencimientos: una salida puede registrarse a cualquier hora. Si ocurre con el archivo cerrado y su forma es `fin_del_dia`, vence en la siguiente apertura.
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
| `usuarios` | Cuentas autorizadas para registrar |
| `configuracion` | Formato del número de historia y si se quitan los ceros a la izquierda |

Google Sheets admite hasta 10 millones de celdas por archivo. Con 16 columnas en `movimientos`, un archivo anual admite más de 600 000 préstamos.

## Arquitectura

- **Página web de Apps Script** con dos pestañas, Salida y Devolución, pensada para el teclado: escribir el número y presionar Enter. Se ejecuta como la cuenta propietaria del archivo, con acceso restringido al dominio. La hoja no se comparte con quienes registran: solo escriben a través de la página. La cuenta de quien registra se obtiene con `Session.getActiveUser()`, que la devuelve cuando pertenece al mismo dominio de Google Workspace.
- **Registro sin espera:** la página envía los registros en cola, de uno en uno y en orden, mientras se sigue escribiendo. Los rechazos quedan listados con su número.
- **Caché de configuración:** las pestañas de configuración y la lista de cuentas se guardan en caché 10 minutos; un activador al editar la hoja la borra para que los cambios se apliquen al instante.
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
2. Hoja, página de Salida y Devolución (con integridad), bloqueo de duplicados, cuentas autorizadas y cargo imprimible.
3. Consultas (fuera ahora, vencidas, historial), retención, hospitalización, observación y cambio de tipo.
4. Aviso diario, datos sintéticos, README y publicación del repositorio.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Cuenta o sesión compartida entre varias personas | Cada persona usa su propia cuenta; la trazabilidad depende de ello |
| Uso desde una cuenta personal | La página solo admite cuentas del dominio institucional |
| Número de historia mal digitado | Bloqueo de duplicados; se rechaza la devolución de una historia no prestada; QR en una versión futura |
| Plazos distintos a los de la norma | Tabla configurable, con la fuente de cada plazo, verificada por cada IPRESS antes de usarla |
| Devoluciones sin registrar | La devolución toma un número y un Enter; el aviso diario muestra las pendientes |
| Datos del paciente en campos de texto | Los campos de observación y motivo indican que no deben incluir datos del paciente |
