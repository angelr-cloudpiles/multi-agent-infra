# Contexto de LicitAI Cloudpiles

Paquete de contexto aislado para Agent Office. No concede acceso al checkout, credenciales, AWS, CI/CD ni datos de clientes.

## Procedencia verificable
- Repositorio: https://github.com/cloudpiles/opt-4621-grupo-prominente.git
- Revisión: ea90a8277957f4d7f869b88e35b2b5097e1ced87
- Cambios locales detectados y excluidos: 39
- Integridad del paquete: sha256:eee5ca04bd644c94a570891846f73293246b7e4a23a91da235915d905bf8a9e2

## Límites obligatorios
- Analiza sólo las fuentes incluidas y declara cualquier dato no disponible.
- No ejecutes mutaciones, despliegues, operaciones sobre AWS, CI/CD ni datos de clientes.
- No afirmes que cambiaste archivos. Entrega una propuesta o diff revisable para que otro flujo lo aplique en un worktree.

## README.md
SHA-256: 54cb76879890cab41973f19568db24114c57dd4d67b1896894dea280c8a3f5bb
```text
# Licit.AI - OPT-4621 Grupo Prominente

Repositorio de implementacion para la POC de Licit.AI, una plataforma IDP en AWS para analizar pliegos licitatorios, enriquecerlos con expedientes historicos y generar dashboards/reportes de decision.

## Estado funcional real

Estado al 2026-08-26: **aplicacion React publicada y pipeline IDP funcional validado con licitacion real multi-documento**.

Implementado en el repositorio:

- Terraform para KMS, VPC, S3, Cognito, DynamoDB, SQS, OpenSearch Serverless, Bedrock Knowledge Bases, Lambda, Step Functions, API Gateway, CloudFront, WAF y observabilidad.
- Backend remoto Terraform creado en AWS para OPT-4621.
- Configuracion base para desplegar con `licitai-roggio` y administrar DNS con `demo-aws`.
- Handlers Lambda productivos para ingesta, estado, resultados, retry, Textract, Rekognition, embeddings, analisis Bedrock, consolidacion contractual y PDF.
- Ingesta de paquete multi-documento de licitacion, preservando jurisdiccion, nombre de licitacion, `document_id` y ruta relativa de cada archivo.
- Exclusión de archivos auxiliares de macOS (`.DS_Store`, `__MACOSX` y `._*`) antes de crear un job o URL de subida.
- Disparo de pipeline definido por S3 ObjectCreated en `uploads/`, SQS y EventBridge Pipes hacia Step Functions.
- Extracción nativa por página para PDFs digitales y DOCX/XLSX/TXT/CSV; Textract de texto solo para escaneos o PDFs sin capa de texto suficiente, antes de embeddings/análisis.
- Caché de extracción, embeddings y análisis por hash de contenido; pasos visuales y geoespaciales selectivos.
- Agente contractual que consolida PCG/PGO, condiciones particulares, cómputo métrico y circulares al finalizar cada licitación. Prioriza las fuentes contractuales por sobre anexos, planos o documentos aislados y conserva la referencia del documento de origen.
- Análisis geoespacial visual selectivo: para planos vectoriales rasteriza hasta tres páginas candidatas, combina señales de Rekognition con el modelo visual y devuelve alcance técnico, límites de medición, riesgos y acciones concretas.
- Revalidación selectiva de análisis y coincidencias sobre el texto ya extraído, sin volver a ejecutar Textract, OCR, Rekognition, análisis geoespacial ni lectura de PDF.
- Análisis final estructurado con Amazon Bedrock Converse. El agente contractual y la inspección geoespacial usan Opus 5 como primera opción y Sonnet 5 como failba
…[extracto truncado]
```

## main.tf
SHA-256: 2aeaa05c07864637d80bd0f6ad974193c559f5faf52e7b7114fa1f0abece0d12
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
  profile = var.dns_aws_profile

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
# ─────────────────────────────────────────────
module "kms" {
  source      = "./modules/kms"
  name_prefix = local.name_prefix
  environment = var.environment
  tags        = local.common_tags
}

# ─────────────────────────────────────────────
# Mod
…[extracto truncado]
```
