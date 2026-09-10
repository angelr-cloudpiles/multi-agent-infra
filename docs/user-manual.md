# Manual de Usuario - Multi-Agent Team Infrastructure

## 📋 Índice

1. [Introducción](#introducción)
2. [Primeros Pasos](#primeros-pasos)
3. [Uso de Agentes](#uso-de-agentes)
4. [Dashboard Langfuse](#dashboard-langfuse)
5. [Mejores Prácticas](#mejores-prácticas)
6. [FAQ](#faq)
7. [Soporte](#soporte)

---

## Introducción

Bienvenido al sistema Multi-Agent Team. Esta plataforma te permite trabajar con agentes de IA especializados que actúan como un equipo de desarrollo completo.

### ¿Qué puedes hacer?

- 🎨 **Designer Agent**: Crear y revisar diseños UI/UX
- 👨‍💼 **Dev Lead Agent**: Coordinar desarrollo y revisar código
- 💻 **Frontend Agent**: Implementar componentes React/Vue/Angular
- ⚙️ **Backend Agent**: Desarrollar APIs y lógica de negocio
- ✅ **QA Agent**: Ejecutar tests y validar calidad

### Requisitos

- Cuenta de Microsoft Entra ID (Azure AD)
- Acceso autorizado por el administrador
- Navegador moderno (Chrome, Firefox, Edge)

---

## Primeros Pasos

### Autenticación

#### Paso 1: Acceder al Portal

1. Navega a: https://aiops.cloudpiles.net
2. Serás redirigido a Microsoft Entra ID
3. Ingresa tus credenciales corporativas
4. Autoriza el acceso si es primera vez
5. Serás redirigido al dashboard

#### Paso 2: Verificar Acceso

Una vez autenticado, verás:

- **Dashboard principal**: Resumen de agentes disponibles
- **Tu perfil**: Información de tu cuenta
- **Historial**: Sesiones previas

### Configuración Inicial

#### Obtener API Key

1. En el dashboard, ve a **Settings** → **API Keys**
2. Click en **Generate New Key**
3. Dale un nombre descriptivo (ej: "mi-proyecto")
4. Copia el API key (solo se muestra una vez)
5. Guárdalo de forma segura

```bash
# Ejemplo de API key
export MULTIGENT_API_KEY="sk-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

---

## Uso de Agentes

### Invocar Agentes

#### Via API (Python)

```python
import boto3
import uuid

# Configurar cliente
client = boto3.client(
    'bedrock-agentcore',
    region_name='us-east-1'
)

# Invocar Designer Agent
response = client.invoke_harness(
    harnessArn='arn:aws:bedrock-agentcore:us-east-1:278741241787:harness/designer-agent',
    runtimeSessionId=str(uuid.uuid4()),  # Mínimo 33 caracteres
    messages=[
        {
            'role': 'user',
            'content': [
                {
                    'text': 'Crea un mockup para una página de login moderna con modo oscuro'
                }
            ]
        }
    ]
)

# Procesar respuesta streaming
for event in response['stream']:
    if 'contentBlockDelta' in event:
        delta = event['contentBlockDelta'].get('delta', {})
        if 'text' in delta:
            print(delta['text'], end='', flush=True)
```

#### Via API (JavaScript/TypeScript)

```typescript
import { BedrockAgentCoreClient, InvokeHarnessCommand } from '@aws-sdk/client-bedrock-agentcore';

const client = new BedrockAgentCoreClient({ region: 'us-east-1' });

async function invokeAgent(prompt: string) {
  const command = new InvokeHarnessCommand({
    harnessArn: 'arn:aws:bedrock-agentcore:us-east-1:278741241787:harness/designer-agent',
    runtimeSessionId: crypto.randomUUID(),
    messages: [
      {
        role: 'user',
        content: [{ text: prompt }]
      }
    ]
  });

  const response = await client.send(command);
  
  // Procesar stream
  for await (const event of response.stream) {
    if (event.contentBlockDelta?.delta?.text) {
      process.stdout.write(event.contentBlockDelta.delta.text);
    }
  }
}

// Uso
invokeAgent('Diseña un dashboard de métricas con gráficos de líneas');
```

#### Via LiteLLM Proxy

```python
import openai

# Configurar cliente para usar LiteLLM proxy
client = openai.OpenAI(
    api_key='tu-api-key',
    base_url='https://litellm.aiops.cloudpiles.net/v1'
)

# Invocar modelo
response = client.chat.completions.create(
    model='claude-3-sonnet',  # Se enruta automáticamente
    messages=[
        {'role': 'system', 'content': 'Eres un diseñador UI/UX experto'},
        {'role': 'user', 'content': 'Crea un diseño para app móvil de fitness'}
    ]
)

print(response.choices[0].message.content)
```

### Agentes Disponibles

#### 1. Designer Agent

**Propósito**: Diseño UI/UX, mockups, design systems

**Ejemplos de uso**:

```python
# Crear mockup
prompt = """
Crea un mockup para una página de e-commerce con:
- Header con logo y navegación
- Hero section con imagen destacada
- Grid de productos (3 columnas)
- Footer con links y redes sociales
Usa colores modernos y modo oscuro
"""

# Generar design tokens
prompt = """
Genera un sistema de design tokens para una app bancaria:
- Paleta de colores (primary, secondary, semantic)
- Tipografía (headings, body, captions)
- Espaciado (4px base)
- Sombras y bordes
"""

# Revisar implementación
prompt = """
Revisa este código CSS y sugiere mejoras:
[pegar código CSS]
Verifica:
- Consistencia con design system
- Accesibilidad (contraste, focus states)
- Responsive design
"""
```

#### 2. Dev Lead Agent

**Propósito**: Coordinación, code review, arquitectura

**Ejemplos de uso**:

```python
# Code review
prompt = """
Revisa este Pull Request y proporciona feedback:

PR: Add user authentication
Files changed:
- src/auth/login.tsx
- src/api/auth.ts
- src/utils/jwt.ts

[pegar diffs]

Verifica:
- Seguridad (OWASP Top 10)
- Patrones de diseño
- Test coverage
- Performance
"""

# Planificar sprint
prompt = """
Planifica el sprint para las siguientes user stories:
1. Como usuario, quiero login con Google
2. Como admin, quiero dashboard de métricas
3. Como usuario, quiero notificaciones push

Estima esfuerzo y asigna a agentes especializados
"""

# Decisión arquitectónica
prompt = """
Necesito decidir entre:
1. REST API con Express
2. GraphQL con Apollo
3. tRPC con Next.js

Contexto:
- App de e-commerce
- 50 endpoints estimados
- Equipo de 3 developers
- Necesitamos type safety

Proporciona ADR (Architecture Decision Record)
"""
```

#### 3. Frontend Agent

**Propósito**: Implementar componentes UI

**Ejemplos de uso**:

```python
# Crear componente
prompt = """
Crea un componente React de Button con:
- Variantes: primary, secondary, outline, ghost
- Tamaños: sm, md, lg
- Estados: loading, disabled
- Iconos: left, right
- TypeScript con props tipadas
- Styled-components o Tailwind CSS
"""

# Implementar página
prompt = """
Implementa una página de login con:
- Formulario con email y password
- Validación con React Hook Form
- Integración con API de autenticación
- Manejo de errores
- Loading states
- Tests con React Testing Library
"""

# Optimizar rendimiento
prompt = """
Optimiza este componente que tiene problemas de rendimiento:
[pegar código]

Implementa:
- React.memo donde sea necesario
- useMemo para cálculos costosos
- useCallback para handlers
- Lazy loading de componentes pesados
"""
```

#### 4. Backend Agent

**Propósito**: APIs, lógica de negocio, base de datos

**Ejemplos de uso**:

```python
# Crear API endpoint
prompt = """
Implementa endpoint REST para crear orden:
POST /api/orders

Request body:
{
  "userId": "string",
  "products": [{"id": "string", "quantity": number}],
  "shippingAddress": {...}
}

Response:
- 201: Orden creada con ID
- 400: Validación fallida
- 401: No autenticado
- 409: Stock insuficiente

Usa Express + TypeScript + Prisma
"""

# Diseñar schema de DB
prompt = """
Diseña schema PostgreSQL para sistema de reservas:
- Users (id, email, name)
- Venues (id, name, capacity)
- Events (id, venue_id, date, price)
- Bookings (id, user_id, event_id, seats)

Incluye:
- Relaciones correctas
- Índices para queries comunes
- Constraints de integridad
"""

# Implementar lógica de negocio
prompt = """
Implementa lógica para calcular precio total de booking:
- Precio base del evento
- Descuento por early bird (10% si reserva 7+ días antes)
- Descuento por grupo (5% si 5+ tickets)
- Fee de servicio (3%)
- IVA (21%)

Incluye tests unitarios
"""
```

#### 5. QA Agent

**Propósito**: Testing, validación, seguridad

**Ejemplos de uso**:

```python
# Generar tests E2E
prompt = """
Genera tests E2E con Playwright para flujo de checkout:
1. Agregar producto al carrito
2. Ir a checkout
3. Completar formulario de envío
4. Seleccionar método de pago
5. Confirmar orden
6. Verificar página de confirmación

Incluye:
- Selectores robustos
- Assertions
- Manejo de errores
- Screenshots en fallos
"""

# Test de seguridad
prompt = """
Realiza análisis de seguridad para:
- Endpoint: POST /api/users
- Input: {email, password, name}

Verifica:
- SQL injection
- XSS
- CSRF
- Rate limiting
- Input validation
- Password strength
"""

# Test de performance
prompt = """
Crea test de carga con k6 para:
- Endpoint: GET /api/products
- Escenario: 100 usuarios concurrentes
- Duración: 5 minutos
- Thresholds:
  - p95 latency < 500ms
  - error rate < 1%
"""
```

### Sesiones Multi-turno

Para mantener contexto entre invocaciones:

```python
import uuid

# Crear sesión
session_id = str(uuid.uuid4())

# Primera invocación
response1 = client.invoke_harness(
    harnessArn='...',
    runtimeSessionId=session_id,
    messages=[
        {'role': 'user', 'content': [{'text': 'Crea un componente de navbar'}]}
    ]
)

# Segunda invocación (mismo session_id)
response2 = client.invoke_harness(
    harnessArn='...',
    runtimeSessionId=session_id,  # Mismo ID
    messages=[
        {'role': 'user', 'content': [{'text': 'Ahora agrega un menú dropdown al usuario'}]}
    ]
)

# El agente recuerda el contexto del navbar creado anteriormente
```

---

## Dashboard Langfuse

### Acceso

URL: https://langfuse.aiops.cloudpiles.net

### Funcionalidades

#### 1. Ver Traces

Cada invocación genera un trace con:

- **Input**: Tu prompt
- **Output**: Respuesta del agente
- **Tool calls**: Herramientas usadas (si aplica)
- **Tokens**: Consumo de tokens
- **Latency**: Tiempo de respuesta
- **Model**: Modelo utilizado

#### 2. Sessions

Agrupa traces por sesión:

- Ver conversación completa
- Analizar flujo de interacción
- Identificar puntos de fricción

#### 3. Scores

Evaluaciones automáticas:

- **Relevance**: ¿La respuesta fue relevante?
- **Accuracy**: ¿Fue precisa?
- **Helpfulness**: ¿Fue útil?

#### 4. Analytics

Métricas agregadas:

- Tokens por día/semana/mes
- Costos por modelo
- Latencia promedio
- Tasa de errores

### Filtrar y Buscar

```python
# Ejemplo: Buscar traces con errores
# En Langfuse UI:
# 1. Ir a "Traces"
# 2. Filtrar por: status = "error"
# 3. Ordenar por: timestamp desc
```

---

## Mejores Prácticas

### 1. Prompts Efectivos

#### ✅ Buen Prompt

```python
prompt = """
Contexto: App de e-commerce con React + Node.js

Objetivo: Implementar carrito de compras

Requisitos:
- Persistir en localStorage
- Sincronizar con backend al hacer login
- Mostrar contador en navbar
- Calcular total con impuestos

Restricciones:
- Usar Context API
- TypeScript strict mode
- Tests unitarios incluidos

Output esperado:
- Código completo
- Explicación de decisiones
- Tests con >80% coverage
"""
```

#### ❌ Mal Prompt

```python
prompt = "haz un carrito"
```

### 2. Iteración Efectiva

```python
# Iteración 1: Solicitud inicial
response1 = invoke_agent("Crea un componente de login")

# Iteración 2: Refinamiento
response2 = invoke_agent("""
Mejora el componente anterior:
- Agregar validación de email
- Mostrar errores inline
- Agregar opción "Recordarme"
""")

# Iteración 3: Detalles finales
response3 = invoke_agent("""
Agrega al componente:
- Animación de loading
- Mensaje de éxito
- Redirect a dashboard
""")
```

### 3. Uso de Contexto

```python
# Proporcionar contexto relevante
prompt = """
Contexto del proyecto:
- Monorepo con Nx
- React 18 + TypeScript
- Tailwind CSS
- Jest + React Testing Library

Código existente:
[pegar código relevante]

Requerimiento:
[describir tarea]
"""
```

### 4. Manejo de Errores

```python
try:
    response = client.invoke_harness(...)
    
    for event in response['stream']:
        if 'validationException' in event:
            print(f"Error de validación: {event['validationException']['message']}")
        elif 'internalServerException' in event:
            print(f"Error interno: {event['internalServerException']['message']}")
        elif 'contentBlockDelta' in event:
            # Procesar respuesta normal
            pass
            
except Exception as e:
    print(f"Error de conexión: {e}")
    # Reintentar o manejar gracefully
```

---

## FAQ

### Preguntas Frecuentes

#### 1. ¿Cómo obtengo acceso?

Contacta a aiops@cloudpiles.com con:
- Tu email corporativo
- Proyecto en el que trabajarás
- Justificación de necesidad

#### 2. ¿Cuánto cuesta usar los agentes?

El costo depende de:
- Modelo utilizado (Sonnet > Haiku > Nova)
- Tokens consumidos
- Frecuencia de uso

Consulta con tu administrador el presupuesto asignado.

#### 3. ¿Puedo usar mi propio modelo?

Sí, contacta al administrador para configurar modelos custom via LiteLLM.

#### 4. ¿Cómo veo mi historial?

En Langfuse: https://langfuse.aiops.cloudpiles.net
- Filtra por tu email
- Ordena por fecha

#### 5. ¿Los agentes recuerdan conversaciones previas?

Sí, si usas el mismo `runtimeSessionId` entre invocaciones.

#### 6. ¿Hay límites de uso?

Sí, los límites son:
- Rate limiting: 100 requests/minuto
- Timeout: 5 minutos por request
- Max tokens: 8K por invocación

#### 7. ¿Cómo reporto bugs?

Envía email a aiops@cloudpiles.com con:
- Descripción del problema
- Pasos para reproducir
- Screenshots (si aplica)
- Trace ID de Langfuse

#### 8. ¿Puedo descargar los traces?

Sí, en Langfuse:
1. Ve a "Traces"
2. Selecciona los traces
3. Click "Export" → JSON/CSV

---

## Soporte

### Canales de Soporte

| Canal | Uso | Tiempo Respuesta |
|-------|-----|-------------------|
| Email | Problemas generales | < 24 horas |
| Langfuse | Issues técnicos | < 4 horas |
| Admin | Urgencias | < 1 hora |

### Contacto

- **Email**: aiops@cloudpiles.com
- **Dashboard**: https://aiops.cloudpiles.net
- **Langfuse**: https://langfuse.aiops.cloudpiles.net

### Horarios de Soporte

- **Lunes a Viernes**: 9:00 - 18:00 (UTC-5)
- **Emergencias**: 24/7 (via email con subject [URGENTE])

---

## Recursos Adicionales

### Documentación

- [Manual de Administrador](admin-manual.md)
- [Arquitectura](architecture.md)
- [Troubleshooting](troubleshooting.md)

### Tutoriales

- [Primer agente](tutorials/first-agent.md)
- [Multi-turno conversaciones](tutorials/multi-turn.md)
- [Integración con CI/CD](tutorials/cicd-integration.md)

### Ejemplos

- [Ejemplos de código](examples/)
- [Templates de prompts](examples/prompts/)
- [Integraciones](examples/integrations/)

---

**Última actualización**: 2026-09-11
**Versión**: 1.0.0
