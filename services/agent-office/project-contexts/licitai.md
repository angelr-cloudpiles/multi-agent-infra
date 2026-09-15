# Contexto de LicitAI

Paquete de contexto aislado para Agent Office. No concede acceso al checkout, credenciales, AWS, CI/CD ni datos de clientes.

## Procedencia verificable
- Repositorio: https://github.com/cloudpiles/opt-4621-grupo-prominente.git
- Revisión: c322d7cd5c7bce3faf027e8a0ae81a7a90dcfa18
- Cambios locales detectados y excluidos: 0
- Integridad del paquete: sha256:437f64a2cc4386aca48dce787ca523af1efc69eb7cacffb706fd1286f84cacd8

## Límites obligatorios
- Analiza sólo las fuentes incluidas y declara cualquier dato no disponible.
- No ejecutes mutaciones, despliegues, operaciones sobre AWS, CI/CD ni datos de clientes.
- No afirmes que cambiaste archivos. Entrega una propuesta o diff revisable para que otro flujo lo aplique en un worktree.

## README.md
SHA-256: 04eda9fdacd799fd9c60fb512dad0c578df6b2c2db7578a83dee9d83cf97816c
```text
# Licit.AI - OPT-4621 Grupo Prominente

Repositorio de implementacion para la POC de Licit.AI, una plataforma IDP en AWS para analizar pliegos licitatorios, enriquecerlos con expedientes historicos y generar dashboards/reportes de decision.

## Estado funcional real

Estado al 2026-09-11: **aplicacion React publicada y pipeline IDP funcional validado con licitacion real multi-documento**. La POC tiene vencimiento programado para el **viernes 18 de septiembre de 2026 a las 23:00, hora de Argentina**.

Implementado en el repositorio:

- Terraform para KMS, VPC, S3, Cognito, DynamoDB, SQS, OpenSearch Serverless, Bedrock Knowledge Bases, Lambda, Step Functions, API Gateway, CloudFront, WAF y observabilidad.
- Backend remoto Terraform creado en AWS para OPT-4621.
- Configuracion base para desplegar con `licitai-roggio` y administrar DNS con `demo-aws`.
- Handlers Lambda productivos para ingesta, estado, resultados, retry, Textract, Rekognition, embeddings, analisis Bedrock, consolidacion contractual y PDF.
- Ingesta de paquete multi-documento de licitacion, preservando jurisdiccion, nombre de licitacion, `document_id` y ruta relativa de cada archivo.
- Exclusión de archivos auxiliares de macOS y Windows (`.DS_Store`, `__MACOSX`, `._*`, `Thumbs.db` y `desktop.ini`) antes de crear un job o URL de subida.
- Disparo de pipeline definido por S3 ObjectCreated en `uploads/`, SQS y EventBridge Pipes hacia Step Functions.
- Extracción nativa por página para PDFs digitales y DOCX/XLSX/TXT/CSV; Textract de texto solo para escaneos o PDFs sin capa de texto suficiente, antes de embeddings/análisis. Los PDFs escaneados extensos se procesan de forma asíncrona mediante Step Functions, sin agotar una invocación Lambda.
- Carga individual de hasta 5 GB: archivos mayores a 64 MiB usan S3 multipart con partes de 16 MiB, firmadas y verificadas con SHA-256 por parte para cumplir Object Lock, sin cargar el archivo completo en la memoria del navegador. Los modelos BIM `.vim` se leen por rangos S3 para extraer cabecera y entidades, sin enviarlos a Textract.
- Caché de extracción, embeddings y análisis por hash de contenido; pasos visuales y geoespaciales selectivos.
- Cobertura del paquete calculada por contenido único: archivos duplicados por ruta o contenido no generan nuevas URLs ni procesamiento. Al ampliar un paquete, un duplicado solo puede volver a cargarse si su procesamiento ant
…[extracto truncado]
```

## main.tf
SHA-256: 4f16927b44169fa32214630485df6a27e898c907bf893e899b7fbe80cd94d077
```text
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  backend "s3" {}
}

provider "aws" {
  region  = var.aws_region
  profile = var.deploy_aws_profile

  default_tags {
    tags = {
      Project     = "OPT-4621-Grupo Prominente"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Client      = "Grupo Prominente"
      Application = "Licit.AI"
      OPT         = "OPT-4621"
    }
  }
}

provider "aws" {
  alias   = "us_east_1"
  region  = "us-east-1"
  profile = var.deploy_aws_profile

  default_tags {
    tags = {
      Project     = "OPT-4621-Grupo Prominente"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Client      = "Grupo Prominente"
      Application = "Licit.AI"
      OPT         = "OPT-4621"
    }
  }
}

provider "aws" {
  alias   = "dns"
  region  = "us-east-1"
  profile = var.dns_assume_role_arn == null ? var.dns_aws_profile : null

  dynamic "assume_role" {
    for_each = var.dns_assume_role_arn == null ? [] : [var.dns_assume_role_arn]
    content {
      role_arn = assume_role.value
    }
  }

  default_tags {
    tags = {
      Project     = "OPT-4621-Grupo Prominente"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Client      = "Grupo Prominente"
      Application = "Licit.AI"
      OPT         = "OPT-4621"
    }
  }
}

# ─────────────────────────────────────────────
# Random suffix for globally unique names
# ─────────────────────────────────────────────
resource "random_id" "suffix" {
  byte_length = 4
}

locals {
  name_prefix     = "${var.project_name}-${var.environment}"
  suffix          = random_id.suffix.hex
  domain_name     = trimsuffix(var.domain_name, ".")
  api_domain_name = trimsuffix(var.api_domain_name, ".")
  root_domain     = trimsuffix(var.root_domain_name, ".")
  common_tags = {
    Project     = "OPT-4621-Grupo Prominente"
    Environment = var.environment
    ManagedBy   = "Terraform"
    Client      = "Grupo Prominente"
    Application = "Licit.AI"
    OPT         = "OPT-4621"
  }
}

# ─────────────────────────────────────────────
# Module: KMS
# ──────────────────────────────────────────
…[extracto truncado]
```
