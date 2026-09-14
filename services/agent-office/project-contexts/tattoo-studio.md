# Contexto de Tattoo Studio

Este paquete es una instantánea de código fuente de solo lectura para Agent Office. No concede acceso al checkout, credenciales, AWS, CI/CD ni datos de clientes.

## Procedencia verificable
- Repositorio: https://github.com/cloudpiles/opt-3990-fede-rod-tattoo.git
- Revisión: 398ab83d28f1e27989ea3fe10a6aea46fc66521a
- Rama de origen: main
- Fuente: contenido versionado en Git; los cambios locales sin commit se excluyen.
- Integridad del paquete: sha256:182d1782faf68dc57ee24b283c298436547e30d1289e4ec991877a2d2222f450

## Límites obligatorios
- Analiza sólo estas fuentes y declara cualquier dato no disponible.
- No ejecutes mutaciones, despliegues, operaciones sobre AWS, CI/CD ni datos de clientes.
- No afirmes que cambiaste archivos. Para una modificación, entrega una propuesta o diff revisable que otro flujo aplique en un worktree.

## README.md
SHA-256: c1ad158ae610d308111ffd5ee3e94f18c3c950d3fb0e7d7ee8ab37b20775e2d6
```text
# OPT-3990 — Fede Rod Tattoo

PWA mobile-first para generación de referencias de tatuajes con Amazon Bedrock, Cognito MFA, API Gateway, Lambda, DynamoDB, S3 y CloudFront.

## Stack

- Frontend: React 19, Vite 7, TypeScript, CSS custom properties.
- Auth: Amazon Cognito User Pool con TOTP MFA.
- API: API Gateway REST con authorizer Cognito.
- Backend: Python 3.12 Lambda en arm64.
- IA: Claude Haiku 4.5 para refinamiento; Stable Diffusion XL legado como primer intento de imagen, Stability AI actual como fallback funcional y Nova Canvas como último fallback.
- Persistencia: DynamoDB para sesiones/solicitudes, S3 privado para imágenes generadas y Bedrock Knowledge Bases para diseños ya realizados.

## Pipeline de diseño asistido

La generación ya no se trata como un prompt directo. El backend trabaja en etapas compatibles con el enfoque de agentes:

- `Intake Agent`: conversa, minimiza preguntas y habilita generación solo cuando el pedido tiene datos críticos.
- `Tattoo Brief Builder`: normaliza la idea en un `TattooBrief` estructurado con motivo, zona, tamaño, estilo, color, detalle, modo de referencia, reglas de conservación y restricciones.
- `Creative Director Agent`: define foco, composición, adaptación anatómica, espacio negativo, jerarquía de línea y plan de contraste.
- `Prompt Builder`: crea un `promptPackage` trazable para el motor de imagen, con prompt positivo, negativo, parámetros y referencias.
- `Tattoo Critic Agent`: evalúa viabilidad técnica antes de generar y puede aplicar una corrección conservadora cuando detecta riesgo de baja legibilidad.

Los objetos `tattooBrief`, `creativeDirection`, `promptPackage` y `tattooCritique` quedan guardados en DynamoDB por solicitud para mantener trazabilidad y permitir iteraciones sobre borradores. La Knowledge Base queda reservada para aprender lenguaje visual del artista sin copiar diseños históricos. FLUX Kontext Max queda contemplado como `engineTarget` futuro; la versión actual sigue ejecutando los modelos disponibles en Bedrock.

## Funcionalidades actuales

- Chat mobile-first para construir la idea de la pieza antes de generar.
- Botón de generación disponible solo cuando el asistente detecta motivo, zona, tamaño y estilo suficientes.
- Subida de imágenes de referencia desde archivo, galería o cámara; análisis con Rekognition para sumar contexto visual.
- Generación de referencias visuales con Bedrock y guardado de resultados en S3/DynamoDB.
- Separación entre diseño generado y montaje sobre cuerpo.
- Canvas de preview corporal con controles de posición, escala, rotación y opacidad.
- Solicitud de cita con preview final.
- Galería de diseños, continuación de borradores, aplicación de ajustes contextuales y eliminación de diseños descartados.
- Backoffice básico de solicitudes.

## Manual de usuario

El flujo de uso para clientes y backoffice está documentado en `docs/manual-usuario.md`.

## Despliegue

```bash
AWS_PROFILE=tattoo-studio AWS_REGION=eu-west-1 ./scripts/deploy.sh
```

El script aplica Terraform con estado local, genera `frontend/public/config.js`, compila la PWA, sincroniza `dist/` al bucket S3 y crea una invalidación de CloudFront.

Para crear un administrador después del
…[excerpt truncated]
```

## package.json
SHA-256: e3d2458227e38651d77566562707707ad03b6a005c770be4226216375cccb2f8
```text
{
  "name": "opt-3990-fede-rod-tattoo",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host 0.0.0.0",
    "test": "python3 -m unittest discover -s tests -p 'test_*.py' && npm run build"
  },
  "dependencies": {
    "amazon-cognito-identity-js": "^6.3.15",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@types/node": "^26.1.1",
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^5.0.0",
    "typescript": "^5.8.3",
    "vite": "^7.0.5"
  }
}
```

## src/config.ts
SHA-256: 82627c5e438c233448d9c2def5c10085ff4c5b6d18f2ae6ed3d60b11f45e64a5
```text
export type AppConfig = {
  awsRegion: string;
  userPoolId: string;
  userPoolClientId: string;
  apiBaseUrl: string;
};

declare global {
  interface Window {
    __APP_CONFIG__?: Partial<AppConfig>;
  }
}

export const config: AppConfig = {
  awsRegion: window.__APP_CONFIG__?.awsRegion || "",
  userPoolId: window.__APP_CONFIG__?.userPoolId || "",
  userPoolClientId: window.__APP_CONFIG__?.userPoolClientId || "",
  apiBaseUrl: window.__APP_CONFIG__?.apiBaseUrl || "/api"
};

const localDemo =
  window.location.hostname === "localhost" &&
  new URLSearchParams(window.location.search).has("demo");

export const hasCloudConfig = !localDemo && Boolean(config.userPoolId && config.userPoolClientId);
```

## src/api.ts
SHA-256: d89f28d0ca1aeead1771634190ac162aaf0e113f476e461e676cdc995a152309
```text
userId: "demo",
    userEmail: "ana@studio.test",
    status: "Listo para cita",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    prompt: "Rosa negra con espinas, realismo"
  }
];

let demoSessions: ChatSession[] = [];

async function request<T>(path: string, session: AuthSession, init: RequestInit = {}, timeoutMs = 30000): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.idToken}`,
        ...(init.headers || {})
      }
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("La conexión tardó demasiado. Revisá tu conexión e intentá de nuevo.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `HTTP ${response.status}`);
  }
  return payload;
}

function demoReadiness(prompt: string, history: ChatHistoryItem[]) {
  const transcript = [...history.map((item) => item.text), prompt].join(" ").toLowerCase();
  const checks = [
    { name: "zona del cuerpo", ok: /brazo|antebrazo|pierna|espalda|pecho|pector|costilla|mano|cuello|hombro|muslo|pantorrilla/.test(transcript) },
    { name: "tamaño aproximado", ok: /cm|pequeñ|mediano|grande|vertical|horizontal|manga/.test(transcript) },
    { name: "estilo", ok: /fine line|fineline|realismo|realista|blackwork|geom[eé]tric|tradicional|ornamental|minimal|dotwork|sombreado|anime|kawaii/.test(transcript) }
  ];
  return checks.filter((check) => !check.ok).map((check) => check.name);
}

export async function refinePrompt(
  session: AuthSession,
  prompt: string,
  options: {
    sessionId?: string;
    history?: ChatHistoryItem[];
    draftContext?: DesignRequest | null;
    referenceImageKey?: string;
    referenceAnalysis?: ReferenceAnalysis | null;
  } = {}
): Promise<ChatResponse> {
  if (!hasCloudConfig || session.idToken === "demo") {
    const referenceLabels = options.referenceAnalysis?.labels.map((label) => label.name).slice(0, 6).join(", ");
    const referenceContext = referenceLabels ? `. Inspiración visual detectada: ${referenceLabels}` : "";
    const basePrompt = options.draftContext?.prompt
      ? `${options.draftContext.prompt}. Cambios pedidos: ${prompt}${referenceContext}`
      : `${prompt}${referenceContext}`;
    const missingDetails = demoReadiness(basePrompt, options.history || []);
    const readyToGenerate = missingDetails.length === 0;
    return {
      sessionId: options.sessionId || "demo",
      reply: readyToGenerate
        ? options.draftContext
          ? "Mantengo la idea original y preparé una variación con esos cambios."
          : "Listo, ya tengo lo necesario para armar una referencia visual clara de la pieza."
        : `Bien. Antes de generar necesito cerrar: ${missingDetails.join(", ")}.`,
      refinedPrompt: readyToGenerate
        ? `${basePrompt}. Diseño de tatuaje fine line, composición vertical, tinta negra, espacio negativo controlado, referencia limpia para stencil.`
        : "",
      readyToGenerate,
      missingDetails,
      designBrief: readyToGenerate
        ? "Pieza vertical en tinta negra, lectura limpia en piel, línea fina, sombreado suave y espacio negativo controlado."
        : "",
      tattooBrief: readyToGenerate
        ? {
            version: "demo",
            subject: prompt,
            bodyPlacement: "zona indicada por el cliente",
            size: "tamaño indicado por el cliente",
            style: "fine line",
            colorStrategy: "tinta negra",
            detailLevel: "medio",
            composition: "composición clara y adaptable a piel",
            referenceMode: options.referenceAnalysis ? "style-inspiration" : "none",
            mustKeep: ["motivo principal", "zona y tamaño acordados"],
            avoid: ["copiar referencias literalmente", "agregar texto o marcas no pedidas"]
          }
        : undefined,
      creativeDirection: readyToGenerate
        ? {
            role: "creative-director",
            primaryFocus: "silueta legible y motivo claro",
            compositionDecision: "motivo aislado con buena lectura",
            anatomyFit: "acompañar la zona del cuerpo indicada",
            negativeSpace: "reservar aire interno",
            lineWeight: "línea limpia con jerarquía",
            contrastPlan: "contraste suficiente para stencil",
            revisionRule: options.draftContext ? "aplicar solo el ajuste pedido" : "generar pieza original",
            riskNotes: ["evitar detalles demasiado finos"]
          }
        : undefined
    };
  }
  return request<ChatResponse>("/chat", session, {
    method: "POST",
    body: JSON.stringify({
      prompt,
      sessionId: options.sessionId,
      history: (options.history || []).slice(-10),
      referenceImageKey: options.referenceImageKey,
      referenceAnalysis: options.referenceAnalysis,
      draftContext: options.draftContext
        ? {
            requestId: options.draftContext.requestId,
            prompt: options.draftContext.prompt,
            designBrief: options.draftContext.designBrief,
            tattooBrief: options.draftContext.tatt
…[excerpt truncated]
```

## main.tf
SHA-256: c35d87d1fce6b1c067700f32c5828ba8d370bf4831683202698577a0b9c32440
```text
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }

}

locals {
  project_tags = {
    Project     = "OPT-3990-Fede Rod Tattoo"
    Environment = var.environment
    ManagedBy   = "Terraform"
    OPT         = "OPT-3990"
    Client      = "Fede Rod Tattoo"
    Owner       = "Cloudpiles"
  }
  cors_allow_origin = length(var.custom_domains) > 0 ? "https://${var.custom_domains[0]}" : "*"
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.project_tags
  }
}

# Provider adicional us-east-1 para ACM (requerido por CloudFront)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = local.project_tags
  }
}

# ─────────────────────────────────────────────
# Módulo: Cognito (Auth + MFA/OTP)
# ─────────────────────────────────────────────
module "cognito" {
  source = "./modules/cognito"

  project_name        = var.project_name
  environment         = var.environment
  admin_email         = var.admin_email
  mfa_configuration   = var.mfa_configuration
  password_min_length = var.password_min_length
}

# ─────────────────────────────────────────────
# Módulo: S3 (PWA assets + imágenes generadas)
# ─────────────────────────────────────────────
module "s3" {
  source = "./modules/s3"

  project_name          = var.project_name
  environment           = var.environment
  account_id            = data.aws_caller_identity.current.account_id
  images_lifecycle_days = var.images_lifecycle_days
  allowed_origin        = local.cors_allow_origin
}

# ─────────────────────────────────────────────
# Módulo: DynamoDB (sesiones + solicitudes)
# ─────────────────────────────────────────────
module "dynamodb" {
  source = "./modules/dynamodb"

  project_name = var.project_name
  environment  = var.environment
}

# ─────────────────────────────────────────────
# Módulo: SQS (cola de generación de imágenes)
# ─────────────────────────────────────────────
module "image_jobs" {
  source = "./modules/image_jobs"

  project_name         = var.project_name
  environment          = var.environment
  image_lambda_timeout = var.image_lambda_timeout
}

# ─────────────────────────────────────────────
# Módulo: IAM (roles y políticas para Lambda)
# ─────────────────────────────────────────────
module "iam" {
  source = "./modules/iam"

  project_name          = var.project_name
  environment           = var.environment
  aws_region            = var.aws_region
  account_id            = data.aws_caller_identity.current.account_id
  s3_images_bucket_arn  = module.s3.images_bucket_arn
  dynamodb_sessions_arn = module.dynamodb.sessions_table_arn
  dynamodb_requests_arn = module.dynamodb.requests_table_arn
  sqs_image_jobs_arn    = module.image_jobs.queue_arn
}

# ─────────────────────────────────────────────
# Módulo: Lambda (chat, imagen, admin)
# ─────────────────────────────────────────────
module "lambda" {
  source = "./modules/lambda"

  project_name                                 = var.project_name
  environment                                  = var.environment
  aws_region                                   = var.aws_region
  lambda_chat_role_arn                         = module.iam.lambda_chat_role_arn
  lambda_image_role_arn                        = module.iam.lambda_image_role_arn
  lambda_admin_role_arn                        = module.iam.lambda_admin_role_arn
  s3_images_bucket_name                        = module.s3.images_bucket_name
  dynamodb_sessions_table                      = module.dynamodb.sessions_table_name
  dynamodb_requests_table                      = module.dynamodb.requests_table_name
  bedrock_claude_model_id                      = var.bedrock_claude_model_id
  bedrock_sdxl_model_id                        = var.bedrock_sdxl_model_id
  bedrock_stability_image_model_id             = var.bedrock_stability_image_model_id
  bedrock_stability_image_region               = var.bedrock_stability_image_region
  bedrock_stability_services_region            = var.bedrock_stability_services_region
  bedrock_stability_control_structure_model_id = var.bedrock_stability_control_structure_model_id
  bedrock_nova_canvas_model_id                 = var.bedrock_nova_canvas_model_id
  lambda_memory_size                           = var.lambda_memory_size
  lambda_timeout                               = var.lambda_timeout
  image_lambda_timeout                         = var.image_lambda_timeout
  log_retention_days                           = var.log_retention_days
  cors_allow_origin                            = local.cors_allow_origin
  image_jobs_queue_arn                         = module.image_jobs.queue_arn
```

## tests/test_async_image_jobs.py
SHA-256: 264bbd9ca804ca0ce65dc6598f311bbdfbfcf6c7fd29f386bd3be7a858b96085
```text
import importlib.util
import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch


ROOT = Path(__file__).resolve().parents[1]


def load_lambda_module(name, relative_path):
    environment = {
        "AWS_REGION_NAME": "eu-west-1",
        "DYNAMODB_REQUESTS_TABLE": "requests",
        "DYNAMODB_SESSIONS_TABLE": "sessions",
        "S3_IMAGES_BUCKET": "images",
        "IMAGE_JOBS_QUEUE_URL": "https://sqs.eu-west-1.amazonaws.com/123/jobs",
    }
    with patch.dict(os.environ, environment, clear=False), patch("boto3.client", return_value=MagicMock()), patch(
        "boto3.resource", return_value=MagicMock()
    ):
        module_path = ROOT / relative_path
        spec = importlib.util.spec_from_file_location(name, module_path)
        module = importlib.util.module_from_spec(spec)
        sys.modules[name] = module
        spec.loader.exec_module(module)
        return module


class AsyncImageJobTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.image = load_lambda_module("image_lambda_for_test", "modules/lambda/src/image/index.py")
        cls.chat = load_lambda_module("chat_lambda_for_test", "modules/lambda/src/chat/index.py")

    def test_queue_event_contains_only_worker_context(self):
        payload = {"prompt": "pato samurai", "requestId": "client-value", "token": "never-forward"}
        with patch.dict(os.environ, {"IMAGE_JOBS_QUEUE_URL": "https://sqs.eu-west-1.amazonaws.com/123/jobs"}):
            self.image._queue_worker_event("user-1", "user@example.com", payload, "job-1", "2026-09-02T10:00:00Z")

        body = self.image.sqs.send_message.call_args.kwargs["MessageBody"]
        event = json.loads(body)
        worker_payload = json.loads(event["body"])
        self.assertEqual(event["requestContext"]["authorizer"]["claims"]["sub"], "user-1")
        self.assertEqual(worker_payload["requestId"], "job-1")
        self.assertTrue(worker_payload["asyncWorker"])
        self.assertNotIn("headers", event)

    def test_clean_prompt_removes_disallowed_generation_terms(self):
        prompt = self.image._clean_generated_prompt("Tattoo design on skin, with lettering")
…[excerpt truncated]
```

## docs/operacion-produccion.md
SHA-256: 098a82c41c4ef04a02f750bd07c309ea84bd6da4d4e4c856da6cef8c3642790c
```text
# Operación de producción

## Flujo de generación

`POST /api/generate` registra un borrador con estado `En cola` y publica un trabajo en SQS. El worker Lambda reclama ese trabajo de forma condicional, cambia su estado a `Generando` y escribe el resultado como `Borrador` o `Error`.

- La cola procesa hasta dos referencias a la vez.
- Un trabajo fallido de infraestructura se reintenta hasta tres veces y luego pasa a la DLQ.
- La aplicación cliente consulta el estado de una única solicitud cada tres segundos mientras está pendiente.
- Cada petición usa un `requestId` creado en el cliente; una repetición de red no crea un segundo diseño.
- El límite actual es seis generaciones por usuario cada quince minutos.

## Privacidad y conservación

- Los borradores se eliminan de S3 y DynamoDB a los 90 días.
- Las referencias de inspiración, fotos corporales y previews vencen a los 30 días.
- Guardar una pieza la mueve a `saved/` y elimina su vencimiento de DynamoDB.
- Las imágenes son privadas: se muestran mediante URLs firmadas de una hora.

## Observabilidad

- Dashboard: `opt-3990-fede-rod-tattoo-prod` en CloudWatch.
- Logs de API Gateway: `/aws/apigateway/opt-3990-fede-rod-tattoo-prod-api-access`.
- Trazas de Lambda y API Gateway: AWS X-Ray.
- Alarmas: errores de cada Lambda y antigüedad de mensajes de la cola superior a cinco minutos.

Las alarmas se crean aunque no haya email configurado. Para recibir notificaciones, definir `alarm_email` en `terraform.tfvars` y confirmar la suscripción SNS.

## Despliegue

El script verifica que el profile apunte a la cuenta esperada, genera un
…[excerpt truncated]
```
