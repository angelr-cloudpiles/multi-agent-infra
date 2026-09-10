# Multi-Agent Team Infrastructure

Arquitectura multi-agente self-hosted en AWS con AgentCore, LiteLLM y Langfuse.

## 📋 Overview

Este proyecto despliega una infraestructura completa para un equipo de agentes de IA especializados:

- **5 Agentes Especializados**: Designer, Dev Lead, Frontend, Backend, QA
- **Modelos**: AWS Bedrock (Claude, Nova) con fallback via LiteLLM
- **Observabilidad**: Langfuse para traces y evaluaciones
- **Autenticación**: Microsoft Entra ID (Azure AD)
- **Dominio**: aiops.cloudpiles.net

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENTCORE HARNESS                             │
│  - 5 Harnesses especializados                                    │
│  - Memory por agente                                             │
│  - Skills desde S3                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
│   LITE.LLM     │  │   LANGFUSE      │  │   COGNITO       │
│  Proxy Layer   │  │  Observability  │  │  + Entra ID     │
│  (ECS Fargate) │  │  (ECS Fargate)  │  │  Auth           │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                              │
                     ┌────────▼────────┐
                     │  ROUTE53        │
                     │  aiops.cloudpiles.net
                     └─────────────────┘
```

## 📦 Componentes

### Infraestructura AWS
- **VPC**: 10.0.0.0/16 con subnets públicas y privadas
- **ECS Fargate**: LiteLLM y Langfuse
- **RDS PostgreSQL**: Base de datos para ambos servicios
- **ElastiCache Redis**: Cache para LiteLLM
- **S3**: Skills storage y artifacts
- **CloudWatch**: Logs y métricas
- **AWS Budgets**: Control de costos con alertas

### Servicios
- **LiteLLM Proxy**: https://litellm.aiops.cloudpiles.net
- **Langfuse**: https://langfuse.aiops.cloudpiles.net
- **AgentCore**: Invocación via AWS SDK

## 🚀 Quick Start

### Prerrequisitos

```bash
# Herramientas requeridas
- Terraform >= 1.15.0
- AWS CLI >= 2.36
- Docker
- Node.js >= 18 (para AgentCore CLI)
```

### Despliegue

```bash
# 1. Clonar repositorio
git clone https://github.com/angelr-cloudpiles/multi-agent-infra.git
cd multi-agent-infra

# 2. Configurar variables
cp infra/terraform.tfvars.example infra/terraform.tfvars
# Editar terraform.tfvars con tus valores

# 3. Inicializar Terraform
cd infra
terraform init

# 4. Planificar despliegue
terraform plan -out=tfplan

# 5. Aplicar
terraform apply tfplan
```

### Configuración Post-Despliegue

```bash
# 1. Verificar servicios
./scripts/verify-deployment.sh

# 2. Configurar Entra ID
./scripts/configure-entra-id.sh

# 3. Crear primer agente
./scripts/create-agent.sh designer
```

## 📚 Documentación

- [Manual de Administrador](docs/admin-manual.md)
- [Manual de Usuario](docs/user-manual.md)
- [Arquitectura Detallada](docs/architecture.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Costos y Optimización](docs/costs.md)

## 🔐 Seguridad

- **Autenticación**: Microsoft Entra ID via OIDC
- **Autorización**: IAM roles con least privilege
- **Encriptación**: KMS para datos en reposo, TLS para tránsito
- **Network**: VPC con private subnets, NAT Gateway
- **Secrets**: AWS Secrets Manager

## 💰 Costos

Budget mensual: **$1,000 USD**

Alertas configuradas:
- 50% ($500): Warning
- 75% ($750): Alert
- 90% ($900): Critical
- 100% ($1,000): Emergency

Ver [Costos Detallados](docs/costs.md) para breakdown completo.

## 🏷️ Tags

Todos los recursos están etiquetados con:
```json
{
  "Project": "multi-agent-team",
  "Environment": "production",
  "Owner": "aiops",
  "CostCenter": "aiops-operations",
  "ManagedBy": "terraform"
}
```

## 🤝 Contribución

Ver [CONTRIBUTING.md](CONTRIBUTING.md) para guidelines.

## 📝 Licencia

Propietario - CloudPiles

## 📞 Soporte

- Email: aiops@cloudpiles.com
- Issues: [GitHub Issues](https://github.com/angelr-cloudpiles/multi-agent-infra/issues)

---

**Última actualización**: 2026-09-11
**Versión**: 1.0.0
