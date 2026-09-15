# Manual de usuario de Agent Office

Agent Office es el visualizador de agentes, tareas, conversaciones y trazas de cada proyecto. Se accede en [aiops.cloudpiles.net](https://aiops.cloudpiles.net) y todo el contenido requiere autenticación mediante Microsoft Entra ID. El trabajo operativo se realiza desde VS Code, Kiro u OpenCode mediante el puente MCP de la plataforma.

## Acceso

1. Abrir Agent Office.
2. Seleccionar **Entrar con Microsoft**.
3. Completar la autenticación corporativa de Entra ID.
4. Tras validar la sesión, elegir un proyecto en la columna izquierda.

No se crean API keys desde esta interfaz. Las claves de Langfuse y las credenciales de runtime son administradas por la plataforma y no se exponen al navegador.

Para trabajar desde VS Code, Kiro u OpenCode, consulte el [manual de integración desde IDE](IDE-AGENT-INTEGRATION-MANUAL.md). Esa integración usa un Gateway MCP autenticado; no se conectan los IDEs directamente a Langfuse ni a las APIs internas de Agent Office.

## Proyectos y alcance

La lista de proyectos muestra el entorno y su alcance.

- Un proyecto operativo permite ejecutar tareas dentro de las políticas configuradas.
- Un proyecto marcado como **Solo lectura** permite analizar su contexto y adjuntos, pero no cambiar AWS, CI/CD ni el repositorio.
- Cada proyecto mantiene contexto, memoria, prompts, trazas y evaluaciones aislados de los demás.

Cambiar de proyecto actualiza el mapa, las tareas y el chat de esa selección.

## Seguir una tarea

La conversación de la columna derecha permite revisar el hilo y las respuestas del proyecto. Para crear o continuar una tarea, use el IDE conectado.

1. En el IDE, ejecutar `projects.list` y seleccionar el proyecto abierto.
2. Usar `agents.chat` con **Orchestrator** para conversar o `tasks.create` para una tarea independiente.
3. Conservar el `task_id` de la primera respuesta y enviar mensajes posteriores con `tasks.continue`.
4. Abrir Agent Office para seguir el mismo hilo, estados, alertas y trazas.

Los adjuntos se incorporan desde el IDE según sus capacidades. Quedan asociados al proyecto y a la tarea que los recibe.

Las respuestas se publican mientras el agente las genera. Una respuesta terminada puede valorarse como útil o para mejorar; ese feedback se registra en Langfuse para el proyecto correspondiente.

## Trabajar con un agente

Seleccione un personaje en el mapa o un agente en el panel de detalle para ver su estado, actividad y tarea actual. Desde allí puede revisar:

- El agente asignado y su trabajo actual.
- Las tareas pausadas, con error o pendientes de aprobación.
- El hilo y las trazas disponibles para revisarlas desde el IDE o Langfuse.

La actividad entre proyectos permite identificar si un mismo agente tiene trabajo en otro proyecto. La conversación sigue siempre ligada al proyecto seleccionado.

## Tareas que requieren atención

Cuando un agente no puede continuar, aparece el estado **Requiere atención** y un indicador en el mapa. Abra la tarea para conocer el motivo y responda desde el IDE usando `tasks.continue`.

El indicador representa una tarea raíz pendiente. Al completarla, el agente vuelve a disponible aunque el hilo conserve intentos o continuaciones históricas para auditoría.

La vista de asistencia conserva tres propiedades:

- Muestra sólo el pedido original, sus resultados y sus continuaciones; no mezcla el historial general del proyecto.
- Conserva los resultados de especialistas que ya terminaron.
- El mismo `task_id` permite enviar contexto a esa tarea sin crear una nueva.

Según el caso, el estado puede indicar una de estas acciones para realizar desde el IDE:

- **Reintentar síntesis**: reutiliza resultados preservados y repite solamente la síntesis del Orchestrator.
- **Ver resultados disponibles**: muestra la actividad de los especialistas que sí finalizaron.
- **Aportar información**: entrega una decisión, corrección o archivo con `tasks.continue`.

Las aprobaciones de despliegue requieren un miembro independiente del grupo autorizado; responder en el chat no reemplaza esa aprobación.

## Mapa de la oficina

El mapa es una visualización de la actividad real, no un segundo sistema de tareas.

- Un agente libre recorre puntos de descanso de forma discreta.
- Un agente activo aparece en su estación de trabajo con su estado.
- Si Orchestrator delega, el **mismo personaje completo** camina hasta el especialista con el disquete de la tarea y vuelve a su puesto. El nombre, anillo, estado y sprite se desplazan juntos; no se crea un personaje duplicado.
- El globo de atención indica que hay una intervención disponible.

La animación respeta la preferencia del sistema de reducir movimiento.

## Observabilidad

El detalle de una tarea muestra cada traza disponible con el agente que la emitió y su identificador. El enlace **Abrir trazas del proyecto** lleva a la vista de trazas de Langfuse correspondiente, sin exponer claves. Langfuse es el lugar para revisar:

- trazas y generaciones;
- sesiones y usuarios seudonimizados;
- prompts publicados;
- feedback humano y scores;
- evaluaciones y experimentos.

Agent Office no sustituye Langfuse: presenta el flujo de trabajo y enlaza el trabajo de los agentes con su observabilidad.

## Resolución de problemas

| Situación | Acción |
| --- | --- |
| Sólo se ve el inicio de sesión | Complete Entra ID; la interfaz no expone proyectos sin sesión. |
| El chat parece vacío al asistir una tarea | Use **Revisar tarea que requiere atención** nuevamente. Debe cargar el hilo aislado de esa tarea. |
| Una respuesta requiere atención | Lea el mensaje accionable y use Reintentar síntesis, Ver resultados o Aportar información. |
| No se puede mutar un proyecto | Revise si está marcado como Solo lectura. Ese límite es intencional. |
| No aparece una traza | La ejecución puede no haber generado una traza aún o la tarea puede no haber llegado al runtime. Revise el estado de la tarea y vuelva a consultar. |

Para incidencias de acceso, estado persistente o integraciones, contacte al administrador de la plataforma con el proyecto, la tarea y la hora aproximada del evento.
