# Contexto de OPT-4370-LeanVision-IA

Paquete de contexto aislado para Agent Office. No concede acceso al checkout, credenciales, AWS, CI/CD ni datos de clientes.

## Procedencia verificable
- Repositorio: https://github.com/cloudpiles/opt-4370-lean-vision-ia.git
- Revisión: 3af87f0f1e1971342af744f355afebbe6524142c
- Cambios locales detectados y excluidos: 38
- Integridad del paquete: sha256:968ef9c64934a66ec79369f772c34bd585da5c59e68981b6fdb14c731c6f78d7

## Límites obligatorios
- Analiza sólo las fuentes incluidas y declara cualquier dato no disponible.
- No ejecutes mutaciones, despliegues, operaciones sobre AWS, CI/CD ni datos de clientes.
- No afirmes que cambiaste archivos. Entrega una propuesta o diff revisable para que otro flujo lo aplique en un worktree.

## README.md
SHA-256: e7293dc61cf47eaf7eb77eb94549b1bbda671f706320c213d011352f8bdf64b5
```text
# OPT-4370 — Lean Vision IA

IaC (Terraform) de la plataforma de análisis de video de Lean Vision IA, sobre AWS us-east-1. Cubre ingesta de video Retail cloud, un contrato IoT/TES para dispositivos edge, inferencia cloud, re-entrenamiento preparado con Step Functions + SageMaker, almacenamiento, una API REST de resultados, consola multi-tenant y observabilidad centralizada.

Ver [`docs/MANUAL_USUARIO.md`](docs/MANUAL_USUARIO.md) para el uso diario de la consola, [`docs/ACCESOS_Y_USUARIOS.md`](docs/ACCESOS_Y_USUARIOS.md) para enlaces/roles/usuarios, [`docs/MANUAL_DE_USO.md`](docs/MANUAL_DE_USO.md) para operación técnica y el manual integrado en `/manual` para una guía rápida dentro de la plataforma.

## Arquitectura

Cinco capas funcionales — ingesta, procesamiento, inferencia cloud, inferencia edge, almacenamiento/API/observabilidad. Detalle completo y diagrama en la propuesta comercial (`OPT-4370-Lean-Vision-IA-propuesta-v1.2.md`, no versionada en este repo).

**Nota sobre el borde:** la propuesta original (v1.1) contemplaba AWS SageMaker Edge Manager, servicio discontinuado por AWS desde abril de 2024. El proyecto usa IoT/Greengrass para el edge: el Core Dev de BCN está conectado y ejecuta el componente de salud; el fleet Prod está preparado para un segundo host físico. El modelo Retail real sigue pendiente de dataset etiquetado y aprobación de compliance.

## Estructura del repo

| Módulo | Contenido |
|---|---|
| `modules/kms` | Clave KMS maestra para cifrado de todos los recursos |
| `modules/iam` | Roles y políticas de todos los servicios |
| `modules/storage` | S3 (landing + resultados) y DynamoDB (resultados) |
| `modules/messaging` | SQS (cola principal + DLQ) |
| `modules/kinesis_video` | Kinesis Video Streams (ingesta Retail) |
| `modules/lambda` | Lambda orquestador (SQS + API Gateway) y start/stop de Rekognition — código fuente Python en `src/` |
| `modules/step_functions` | State machines de re-entrenamiento (SageMaker) y procesamiento batch |
| `modules/eventbridge` | Scheduler de encendido/apagado de Rekognition Custom Labels |
| `modules/iot_core` | IoT Core, Things y credenciales TES para cámaras Retail |
| `modules/greengrass_fleet` | Fleet Greengrass, Things, policies IoT, role aliases y roles de token exchange |
| `modules/api_gateway` | API REST (proxy Lambda) con API key + usage plan |
| `modules/cloudwatch` | Dashboard, alarmas, SNS |
…[extracto truncado]
```

## main.tf
SHA-256: 409bf60c9d87e98eea6673e194e0ffa8c439eb03365b05ec5097d49881f02b1b
```text
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
    awscc = {
      source  = "hashicorp/awscc"
      version = "~> 1.0"
    }
  }

  backend "s3" {
    bucket         = "cp-v2-tfstate-235553266597"
    key            = "OPT-4370/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "arn:aws:dynamodb:us-east-1:235553266597:table/cp-v2-tfstate-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "OPT-4370-Lean Vision IA"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = "Cloudpiles"
      Client      = "Lean Vision IA"
      Opportunity = "OPT-4370"
    }
  }
}

provider "awscc" {
  region = var.aws_region
}

locals {
  # El inference profile "us." rutea el modelo entre varias regiones
  # (us-east-1, us-east-2, us-west-2) — el ARN del foundation model no
  # puede scopearse a una sola región o el rol del agente recibe
  # AccessDenied cuando el profile rutea a otra región.
  bedrock_foundation_model_arn  = "arn:aws:bedrock:*::foundation-model/${var.bedrock_foundation_model_id}"
  bedrock_inference_profile_arn = "arn:aws:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:inference-profile/${var.bedrock_inference_profile_id}"
}

# Cuenta separada (699475951566) que aloja la zona pública cloudpiles.info
# donde se delega el subdominio de este PoC.
provider "aws" {
  alias   = "demo_aws"
  region  = var.aws_region
  profile = var.demo_aws_profile
}

# ─────────────────────────────────────────────
# KMS — clave maestra para cifrado de todos los
# recursos (S3, DynamoDB, SQS, CloudWatch Logs)
# ─────────────────────────────────────────────
module "kms" {
  source      = "./modules/kms"
  environment = var.environment
  aws_region  = var.aws_region
  account_id  = data.aws_caller_identity.current.account_id
}

# ─────────────────────────────────────────────
# IAM — roles y políticas transversales
# ─────────────────────────────────────────────
module "iam" {
  source                        = "./modules/iam"
  environment                   = var.environment
  aws_region                    = var.aws_region
  account_id
…[extracto truncado]
```
