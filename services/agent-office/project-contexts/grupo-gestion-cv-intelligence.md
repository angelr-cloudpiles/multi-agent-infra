# Contexto de Grupo Gestion - CV Intelligence

Paquete de contexto aislado para Agent Office. No concede acceso al checkout, credenciales, AWS, CI/CD ni datos de clientes.

## Procedencia verificable
- Repositorio: https://github.com/cloudpiles/grupo-gestion-idp.git
- Revisión: 9d6c4f4b41144b6daffff959d69fced358158f78
- Cambios locales detectados y excluidos: 7
- Integridad del paquete: sha256:0dc6ddd0e038d67934857881f4fd0c5ead853f1ea78c0320757200045bae75a0

## Límites obligatorios
- Analiza sólo las fuentes incluidas y declara cualquier dato no disponible.
- No ejecutes mutaciones, despliegues, operaciones sobre AWS, CI/CD ni datos de clientes.
- No afirmes que cambiaste archivos. Entrega una propuesta o diff revisable para que otro flujo lo aplique en un worktree.

## README.md
SHA-256: c9d1b20f6eae01c8fb031e5b2d9ffe0c48f8e902bdc477482bd1e3ce454dad7c
```text
# OPT-1130 — Grupo Gestion — Infraestructura como Código

## Descripción del Proyecto

Este repositorio contiene la infraestructura como código (IaC) para **CV Intelligence**, la plataforma de procesamiento inteligente de currículums vitae desarrollada para **Grupo Gestión** (Argentina). El proyecto despliega una arquitectura serverless completa en AWS (región `us-east-2`) que automatiza el ciclo de vida del proceso de selección de personal: desde la recepción pública de CVs hasta el matching automático con ofertas laborales activas y la notificación al equipo reclutador.

| Campo | Detalle |
|---|---|
| **Cliente** | Grupo Gestión |
| **País** | Argentina |
| **OPT** | OPT-1130 |
| **Fecha** | 27 de mayo de 2026 |
| **Región AWS principal** | `us-east-2` (Ohio) |
| **Región WAF/ACM** | `us-east-1` (requerido por CloudFront) |
| **Entorno por defecto** | `prod` |
| **Volumen proyectado** | ~8.000 CVs/mes |
| **Solutions Architect** | Angel Reale — angelr@cloudpiles.com |
| **Account Manager** | Daniel Giovagnoni — danielg@cloudpiles.com |

La solución cubre los siguientes casos de uso de negocio:

- **Portal público de candidatos** (vía QR): ingreso de DNI, aceptación de términos (Ley 25.326), carga de CV desde archivo, galería o cámara. Identificación por DNI con deduplicación automática y trazabilidad de cambios.
- **Portal admin de carga masiva** (autenticado vía Cognito): carga individual o en lote de CVs existentes para el equipo de RRHH.
- **Extracción automática de datos** de CVs mediante Amazon Textract + Bedrock (Claude Haiku 4.5).
- **Matching automático** entre candidatos y ofertas laborales activas con puntaje de compatibilidad y justificación legible.
- **Notificaciones automáticas** al reclutador cuando un candidato supera el umbral de afinidad configurado.
- **Portal de autogestión** por DNI: consulta de estado, historial de cargas y solicitud de baja de datos (Ley 25.326).
- **Agente IA (AgentCore)** con herramientas sobre DynamoDB para consultas conversacionales de RRHH.
- **Seguridad y auditoría**: CloudTrail, AWS Config y GuardDuty habilitados desde el día uno.

---

## Arquitectura

### Flujo de alto nivel

La plataforma expone **tres portales** con dominios custom HTTPS sobre `grupo-gestion.com.ar`:

| Portal | URL | Audiencia | Auth |
|---|---|---|---|
| **qr-cv** | `qr-cv.grupo-gestion.com.ar` | Candidatos (público, vía QR) | Sin auth
…[extracto truncado]
```

## main.tf
SHA-256: 07a9e1a492db9f77897a42ed970184f93e3cbb0e571729d4e035205eafa07410
```text
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  # Backend S3 con lock en DynamoDB (cuenta cliente 797316547802 / us-east-2)
  # Bucket y tabla creados previamente fuera de Terraform (chicken-and-egg).
  # Para migrar desde local: terraform init -migrate-state
  backend "s3" {
    bucket         = "gg-prod-tfstate-797316547802"
    key            = "opt-1130/terraform.tfstate"
    region         = "us-east-2"
    dynamodb_table = "gg-prod-tfstate-lock"
    encrypt        = true
  }
}

# Provider principal — us-east-2 (Ohio) según requerimiento del cliente
# Ejecutar con credenciales ya asumidas del rol cp-deploy-cv-intelligence:
#   CREDS=$(aws sts assume-role --role-arn arn:aws:iam::797316547802:role/cp-deploy-cv-intelligence \
#     --role-session-name tf-opt1130 --profile soporte-cloudpiles)
#   export AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "OPT-1130-Grupo Gestion"
      Proyecto    = "GestionCandidatos"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Client      = "Grupo Gestion"
      OPT         = "OPT-1130"
      aws-apn-id  = "pc:bzjqhckdc7n9d3iqkgz03ggf9"
    }
  }
}

# Provider alias us-east-1 — requerido exclusivamente para WAF WebACL de CloudFront
# CloudFront solo acepta WAF WebACLs creadas en us-east-1
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "OPT-1130-Grupo Gestion"
      Proyecto    = "GestionCandidatos"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Client      = "Grupo Gestion"
      OPT         = "OPT-1130"
      aws-apn-id  = "pc:bzjqhckdc7n9d3iqkgz03ggf9"
    }
  }
}

provider "random" {}
provider "archive" {}

# ─────────────────────────────────────────────
# MODULE: WAF — Restricción geográfica AR+US+ES
# Debe estar en us-east-1 para ser asociado a CloudFront
# ─────────────────────────────────────────────
module "waf" {
  source = "./modules/waf"

  providers = {
    aws = aws.us_east_1
  }

  project     = var.project
  environment = v
…[extracto truncado]
```
