# Manual de Administrador - Multi-Agent Team Infrastructure

## 📋 Índice

1. [Introducción](#introducción)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Gestión de Infraestructura](#gestión-de-infraestructura)
4. [Monitoreo y Observabilidad](#monitoreo-y-observabilidad)
5. [Gestión de Costos](#gestión-de-costos)
6. [Seguridad](#seguridad)
7. [Mantenimiento](#mantenimiento)
8. [Troubleshooting](#troubleshooting)
9. [Backup y Recuperación](#backup-y-recuperación)
10. [Escalado](#escalado)

---

## Introducción

Este manual está dirigido a administradores de sistemas responsables de mantener la infraestructura multi-agente. Incluye procedimientos operativos, mejores prácticas y guías de troubleshooting.

### Responsabilidades del Administrador

- ✅ Monitoreo de salud del sistema
- ✅ Gestión de costos y budgets
- ✅ Mantenimiento de seguridad
- ✅ Actualizaciones y patches
- ✅ Backup y recuperación
- ✅ Escalado de recursos
- ✅ Gestión de accesos

### Contactos de Soporte

| Rol | Email | Responsabilidad |
|-----|-------|-----------------|
| Admin Principal | aiops@cloudpiles.com | Infraestructura completa |
| AWS Support | - | Soporte AWS (si aplica) |
| Security Team | security@cloudpiles.com | Incidentes de seguridad |

---

## Arquitectura del Sistema

### Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                        AWS Account: 278741241787                 │
│                        Region: us-east-1                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    VPC (10.0.0.0/16)                     │    │
│  │                                                           │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │    │
│  │  │  Public      │  │  Private     │  │  Private     │   │    │
│  │  │  Subnets     │  │  Subnets     │  │  Subnets     │   │    │
│  │  │  (ALB, NAT)  │  │  (ECS, RDS)  │  │  (ElastiCache)│   │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │    │
│  │                                                           │    │
│  │  Services:                                                │    │
│  │  - LiteLLM (ECS Fargate)                                 │    │
│  │  - Langfuse (ECS Fargate)                                │    │
│  │  - RDS PostgreSQL (2 instances)                          │    │
│  │  - ElastiCache Redis                                     │    │
│  │  - AgentCore Memory (5 instances)                        │    │
│  │  - AgentCore Harnesses (5 harnesses)                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Storage:                                                         │
│  - S3: skills, artifacts, logs                                  │
│  - ECR: Docker images                                           │
│                                                                   │
│  Security:                                                        │
│  - Cognito User Pool (Entra ID federation)                      │
│  - IAM Roles (least privilege)                                  │
│  - Security Groups                                              │
│  - KMS Keys                                                     │
│                                                                   │
│  Monitoring:                                                      │
│  - CloudWatch Logs                                              │
│  - CloudWatch Metrics                                           │
│  - AWS Budgets                                                  │
│  - CloudTrail                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    AWS Account: 235553266597                      │
│                    (cloudpiles-platform)                          │
├─────────────────────────────────────────────────────────────────┤
│  - Route53 Hosted Zone: cloudpiles.net                          │
│  - ACM Certificate: *.aiops.cloudpiles.net                      │
└─────────────────────────────────────────────────────────────────┘
```

### Endpoints

| Servicio | URL | Propósito |
|----------|-----|-----------|
| LiteLLM | https://litellm.aiops.cloudpiles.net | Proxy de modelos |
| Langfuse | https://langfuse.aiops.cloudpiles.net | Observabilidad |
| AgentCore | Via AWS SDK | Invocación de agentes |

### Puertos y Protocolos

| Servicio | Puerto | Protocolo |
|----------|--------|-----------|
| ALB HTTP | 80 | HTTP (redirect to HTTPS) |
| ALB HTTPS | 443 | HTTPS |
| ECS LiteLLM | 4000 | HTTP (internal) |
| ECS Langfuse | 3000 | HTTP (internal) |
| RDS PostgreSQL | 5432 | TCP (internal) |
| ElastiCache Redis | 6379 | TCP (internal) |

---

## Gestión de Infraestructura

### Estado de Terraform

```bash
# Verificar estado actual
cd /path/to/multi-agent-infra/infra
terraform state list

# Ver detalles de un recurso específico
terraform state show aws_vpc.main

# Importar recurso existente (si es necesario)
terraform import aws_s3_bucket.skills skills-bucket-name
```

### Actualizaciones de Infraestructura

#### Procedimiento de Actualización

```bash
# 1. Crear branch para cambios
git checkout -b update/infrastructure-change

# 2. Realizar cambios en código Terraform
vim infra/main.tf

# 3. Validar sintaxis
terraform validate

# 4. Formatear código
terraform fmt

# 5. Planificar cambios
terraform plan -out=tfplan

# 6. Revisar plan cuidadosamente
# - Verificar recursos a crear/modificar/eliminar
# - Verificar que no hay cambios destructivos no deseados

# 7. Aplicar cambios (en horario de mantenimiento)
terraform apply tfplan

# 8. Verificar despliegue
./scripts/verify-deployment.sh

# 9. Commit y push
git add .
git commit -m "Update infrastructure: description of change"
git push origin update/infrastructure-change

# 10. Crear PR para revisión
gh pr create --title "Update infrastructure" --body "Description"
```

#### Rollback

```bash
# Si algo sale mal, rollback a versión anterior
terraform rollback

# O manualmente:
git checkout HEAD~1 infra/
terraform plan -out=tfplan-rollback
terraform apply tfplan-rollback
```

### Gestión de Secrets

#### Ver Secrets Existentes

```bash
# Listar secrets
aws secretsmanager list-secrets --profile aiops-aws --region us-east-1

# Ver detalle de un secret
aws secretsmanager get-secret-value \
  --secret-id litellm-api-key \
  --profile aiops-aws \
  --region us-east-1
```

#### Rotar Secrets

```bash
# Actualizar un secret
aws secretsmanager put-secret-value \
  --secret-id litellm-api-key \
  --secret-string '{"api_key":"new-api-key-here"}' \
  --profile aiops-aws \
  --region us-east-1

# Reiniciar servicio para aplicar nuevo secret
aws ecs update-service \
  --cluster litellm-cluster \
  --service litellm-service \
  --force-new-deployment \
  --profile aiops-aws \
  --region us-east-1
```

---

## Monitoreo y Observabilidad

### CloudWatch Dashboards

#### Dashboard Principal

```bash
# Crear dashboard
aws cloudwatch put-dashboard \
  --dashboard-name "Multi-Agent-Main" \
  --dashboard-body file://dashboards/main-dashboard.json \
  --profile aiops-aws \
  --region us-east-1
```

#### Métricas Clave

| Métrica | Namespace | Umbral Alerta |
|---------|-----------|---------------|
| CPU Utilization | AWS/ECS | > 80% |
| Memory Utilization | AWS/ECS | > 85% |
| Request Count | AWS/ApplicationELB | N/A |
| Target Response Time | AWS/ApplicationELB | > 2s |
| 5XX Error Rate | AWS/ApplicationELB | > 1% |
| Database Connections | AWS/RDS | > 80% max |
| Cache Hit Rate | AWS/ElastiCache | < 70% |

### CloudWatch Logs

#### Estructura de Logs

```
/aws/ecs/litellm/
/aws/ecs/langfuse/
/aws/rds/litellm/
/aws/rds/langfuse/
/aws/bedrock-agentcore/
/aws/budget/
```

#### Consultas Comunes

```bash
# Errores en LiteLLM últimas 24 horas
aws logs filter-log-events \
  --log-group-name /aws/ecs/litellm \
  --start-time $(date -u -d '-1 day' +%s)000 \
  --filter-pattern "ERROR" \
  --profile aiops-aws \
  --region us-east-1

# Requests lentos (>5s)
aws logs insights query \
  --query-string "fields @timestamp, @message | filter duration > 5000 | sort @timestamp desc" \
  --log-group-names /aws/ecs/litellm \
  --profile aiops-aws \
  --region us-east-1
```

### Langfuse Dashboard

Acceder a: https://langfuse.aiops.cloudpiles.net

#### Métricas a Monitorear

- **Sessions**: Número de sesiones activas
- **Traces**: Traces por agente
- **Scores**: Evaluaciones de calidad
- **Latency**: Tiempo de respuesta por agente
- **Token Usage**: Consumo de tokens por modelo

### Alertas Configuradas

| Alerta | Condición | Notificación |
|--------|-----------|--------------|
| High CPU | > 80% por 5 min | SNS → Email |
| High Memory | > 85% por 5 min | SNS → Email |
| High Error Rate | > 1% 5XX por 5 min | SNS → Email |
| High Latency | p99 > 5s por 10 min | SNS → Email |
| Budget Warning | 50% budget | SNS → Email |
| Budget Alert | 75% budget | SNS → Email |
| Budget Critical | 90% budget | SNS → Email |

---

## Gestión de Costos

### AWS Budgets

#### Budget Actual

```json
{
  "BudgetName": "multi-agent-monthly",
  "BudgetLimit": {
    "Amount": "1000",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
```

#### Verificar Budget

```bash
# Ver budget actual
aws budgets describe-budget \
  --account-id 278741241787 \
  --budget-name "multi-agent-monthly" \
  --profile aiops-aws

# Ver gastos actuales
aws budgets describe-budget-performance-history \
  --account-id 278741241787 \
  --budget-name "multi-agent-monthly" \
  --profile aiops-aws
```

### Cost Explorer

#### Consultas Útiles

```bash
# Costos por servicio último mes
aws ce get-cost-and-usage \
  --time-period Start=2026-08-01,End=2026-09-01 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --profile aiops-aws

# Costos por tag (Project)
aws ce get-cost-and-usage \
  --time-period Start=2026-08-01,End=2026-09-01 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=TAG,Key=Project \
  --profile aiops-aws

# Costos diarios
aws ce get-cost-and-usage \
  --time-period Start=2026-09-01,End=2026-09-11 \
  --granularity DAILY \
  --metrics BlendedCost \
  --profile aiops-aws
```

### Optimización de Costos

#### Estrategias

1. **Prompt Caching**
   - Habilitar en AgentCore Harnesses
   - Ahorro estimado: 20-30% en input tokens

2. **Model Selection**
   - Usar Haiku/Nova para tareas simples
   - Ahorro estimado: 50-70% vs Sonnet

3. **Right-sizing**
   - Ajustar CPU/Memory en ECS tasks
   - Usar CloudWatch para identificar over-provisioning

4. **Reserved Capacity**
   - Considerar para uso estable >6 meses
   - Ahorro estimado: 30-50%

5. **Spot Instances**
   - Para workloads no críticos
   - Ahorro estimado: 70-90%

#### Script de Análisis

```bash
# Ejecutar análisis de costos
./scripts/analyze-costs.sh --days 30 --profile aiops-aws
```

---

## Seguridad

### Gestión de Accesos

#### IAM Roles

| Rol | Propósito | Permisos |
|-----|-----------|----------|
| AgentCoreExecutionRole | Ejecutar harnesses | Bedrock, S3, CloudWatch |
| LiteLLMTaskRole | Ejecutar LiteLLM | Bedrock, Secrets Manager |
| LangfuseTaskRole | Ejecutar Langfuse | S3, RDS, CloudWatch |
| AdminRole | Administración | Full access (restringido) |

#### Verificar Permisos

```bash
# Simular permisos
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::278741241787:role/AgentCoreExecutionRole \
  --action-names bedrock:InvokeModel \
  --profile aiops-aws
```

### Entra ID Integration

#### Verificar Federación

```bash
# Ver configuración de Cognito
aws cognito-idp describe-user-pool \
  --user-pool-id us-east-1_XXXXXXXXX \
  --profile aiops-aws

# Ver identity providers
aws cognito-idp describe-identity-provider \
  --user-pool-id us-east-1_XXXXXXXXX \
  --provider-name EntraID \
  --profile aiops-aws
```

#### Datos de Entra ID

```
Tenant ID: 0d7c9ad4-6df4-4c9c-a088-f296098ad992
Application ID: 1d92561c-b198-48eb-9c8c-410fda3c969d
Object ID: da408a08-ca42-4129-9d77-735e3100250e
```

### Security Groups

#### Reglas Actuales

| SG | Inbound | Outbound |
|----|---------|----------|
| ALB | 443 (0.0.0.0/0) | All |
| ECS | ALB SG | All |
| RDS | ECS SG | All |
| ElastiCache | ECS SG | All |

#### Rotación de Secrets

```bash
# Programar rotación automática
aws secretsmanager rotate-secret \
  --secret-id litellm-api-key \
  --rotation-lambda-arn arn:aws:lambda:us-east-1:278741241787:function:SecretsRotationLambda \
  --rotation-rules AutomaticallyAfterDays=90 \
  --profile aiops-aws
```

### Auditoría

#### CloudTrail

```bash
# Ver eventos recientes
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventSource,AttributeValue=bedrock-agentcore.amazonaws.com \
  --max-results 50 \
  --profile aiops-aws

# Buscar eventos específicos
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=Username,AttributeValue=aiops-admin \
  --profile aiops-aws
```

---

## Mantenimiento

### Mantenimiento Rutinario

#### Diario

- [ ] Revisar alertas de CloudWatch
- [ ] Verificar estado de servicios ECS
- [ ] Revisar logs de errores
- [ ] Verificar uso de budget

#### Semanal

- [ ] Revisar métricas de rendimiento
- [ ] Analizar costos semanales
- [ ] Verificar backups
- [ ] Revisar certificados SSL

#### Mensual

- [ ] Aplicar patches de seguridad
- [ ] Rotar secrets (si no automático)
- [ ] Revisar y limpiar logs antiguos
- [ ] Analizar tendencias de uso
- [ ] Actualizar documentación

### Actualizaciones

#### Actualizar LiteLLM

```bash
# 1. Pull última imagen
docker pull ghcr.io/berriai/litellm:latest

# 2. Tag para ECR
docker tag ghcr.io/berriai/litellm:latest 278741241787.dkr.ecr.us-east-1.amazonaws.com/litellm:latest

# 3. Push a ECR
aws ecr get-login-password --profile aiops-aws --region us-east-1 | docker login --username AWS --password-stdin 278741241787.dkr.ecr.us-east-1.amazonaws.com
docker push 278741241787.dkr.ecr.us-east-1.amazonaws.com/litellm:latest

# 4. Forzar nuevo despliegue
aws ecs update-service \
  --cluster litellm-cluster \
  --service litellm-service \
  --force-new-deployment \
  --profile aiops-aws \
  --region us-east-1
```

#### Actualizar Langfuse

```bash
# Similar a LiteLLM
docker pull langfuse/langfuse:latest
docker tag langfuse/langfuse:latest 278741241787.dkr.ecr.us-east-1.amazonaws.com/langfuse:latest
docker push 278741241787.dkr.ecr.us-east-1.amazonaws.com/langfuse:latest
aws ecs update-service --cluster langfuse-cluster --service langfuse-service --force-new-deployment --profile aiops-aws --region us-east-1
```

---

## Troubleshooting

### Problemas Comunes

#### 1. Servicio No Responde

```bash
# Verificar estado del servicio
aws ecs describe-services \
  --cluster litellm-cluster \
  --services litellm-service \
  --profile aiops-aws

# Verificar tasks
aws ecs list-tasks \
  --cluster litellm-cluster \
  --service-name litellm-service \
  --profile aiops-aws

# Ver logs recientes
aws logs tail /aws/ecs/litellm \
  --since 1h \
  --profile aiops-aws
```

#### 2. Error de Autenticación Entra ID

```bash
# Verificar configuración OIDC
aws cognito-idp describe-identity-provider \
  --user-pool-id <user-pool-id> \
  --provider-name EntraID \
  --profile aiops-aws

# Verificar certificate
aws cognito-idp get-signing-certificate \
  --user-pool-id <user-pool-id> \
  --profile aiops-aws
```

#### 3. Alto Uso de CPU/Memory

```bash
# Ver métricas
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=litellm-service \
  --statistics Average \
  --period 300 \
  --start-time $(date -u -d '-1 hour' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --profile aiops-aws

# Escalar servicio
aws ecs update-service \
  --cluster litellm-cluster \
  --service litellm-service \
  --desired-count 3 \
  --profile aiops-aws
```

#### 4. AgentCore Harness Falla

```bash
# Ver estado del harness
aws bedrock-agentcore-control get-harness \
  --harness-id <harness-id> \
  --profile aiops-aws

# Ver logs
aws logs tail /aws/bedrock-agentcore/harnesses/<harness-id> \
  --since 1h \
  --profile aiops-aws

# Verificar permisos del rol
aws iam get-role-policy \
  --role-name AgentCoreExecutionRole \
  --policy-name AgentCorePolicy \
  --profile aiops-aws
```

### Runbooks

#### Runbook: Servicio Down

```bash
#!/bin/bash
# Nombre: fix-service-down.sh
# Propósito: Recuperar servicio ECS caído

SERVICE_NAME=$1
CLUSTER_NAME=$2

echo "🔍 Diagnosing service: $SERVICE_NAME"

# 1. Verificar estado
aws ecs describe-services \
  --cluster $CLUSTER_NAME \
  --services $SERVICE_NAME \
  --profile aiops-aws

# 2. Verificar tasks
TASKS=$(aws ecs list-tasks \
  --cluster $CLUSTER_NAME \
  --service-name $SERVICE_NAME \
  --query 'taskArns' \
  --output text \
  --profile aiops-aws)

if [ -z "$TASKS" ]; then
  echo "❌ No tasks running. Starting new tasks..."
  aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service $SERVICE_NAME \
    --desired-count 2 \
    --profile aiops-aws
else
  echo "✅ Tasks running: $TASKS"
fi

# 3. Verificar health checks
aws elbv2 describe-target-health \
  --target-group-arn <target-group-arn> \
  --profile aiops-aws

# 4. Notificar
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:278741241787:alerts \
  --message "Service $SERVICE_NAME recovered" \
  --profile aiops-aws
```

---

## Backup y Recuperación

### Estrategia de Backup

| Componente | Método | Frecuencia | Retención |
|------------|--------|------------|-----------|
| RDS PostgreSQL | Automated snapshots | Diario | 7 días |
| S3 | Versioning + Cross-region | Continuo | 90 días |
| Secrets | Manual export | Mensual | Indefinido |
| Terraform State | S3 versioning | Continuo | 90 días |

### Backup Manual

```bash
# Backup RDS
aws rds create-db-snapshot \
  --db-instance-identifier litellm-db \
  --db-snapshot-identifier litellm-db-manual-$(date +%Y%m%d) \
  --profile aiops-aws

# Backup S3
aws s3 sync \
  s3://multi-agent-skills-278741241787 \
  s3://multi-agent-backups-278741241787/skills-$(date +%Y%m%d) \
  --profile aiops-aws

# Export secrets
aws secretsmanager get-secret-value \
  --secret-id litellm-api-key \
  --query SecretString \
  --output text > /tmp/litellm-api-key-backup.json \
  --profile aiops-aws
```

### Recuperación

#### Restaurar RDS

```bash
# Restaurar desde snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier litellm-db-restored \
  --db-snapshot-identifier litellm-db-manual-20260911 \
  --profile aiops-aws

# Actualizar endpoint en aplicación
# (manualmente o via Terraform)
```

#### Restaurar S3

```bash
# Restaurar desde backup
aws s3 sync \
  s3://multi-agent-backups-278741241787/skills-20260911 \
  s3://multi-agent-skills-278741241787 \
  --profile aiops-aws
```

---

## Escalado

### Escalado Vertical

```bash
# Aumentar CPU/Memory de task definition
aws ecs register-task-definition \
  --family litellm-task \
  --cpu 2048 \
  --memory 4096 \
  --requires-compatibilities FARGATE \
  --profile aiops-aws

# Actualizar servicio
aws ecs update-service \
  --cluster litellm-cluster \
  --service litellm-service \
  --task-definition litellm-task \
  --profile aiops-aws
```

### Escalado Horizontal

```bash
# Aumentar número de tasks
aws ecs update-service \
  --cluster litellm-cluster \
  --service litellm-service \
  --desired-count 4 \
  --profile aiops-aws
```

### Auto Scaling

```bash
# Configurar auto scaling
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/litellm-cluster/litellm-service \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10 \
  --profile aiops-aws

# Crear policy de scaling
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/litellm-cluster/litellm-service \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name litellm-cpu-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration file://scaling-policy.json \
  --profile aiops-aws
```

---

## Contactos y Escalamiento

### Niveles de Escalamiento

| Nivel | Tiempo Respuesta | Responsable | Contacto |
|-------|-------------------|-------------|----------|
| L1 | < 15 min | Admin on-call | aiops@cloudpiles.com |
| L2 | < 1 hora | Admin senior | aiops@cloudpiles.com |
| L3 | < 4 horas | Arquitecto | aiops@cloudpiles.com |
| Vendor | < 24 horas | AWS Support | (si aplica) |

### Incident Response

1. **Detección**: Alerta automática via SNS
2. **Triage**: Clasificar severidad (P1/P2/P3)
3. **Mitigación**: Aplicar workaround inmediato
4. **Resolución**: Fix permanente
5. **Post-mortem**: Documentar lecciones aprendidas

---

**Última actualización**: 2026-09-11
**Versión**: 1.0.0
**Próxima revisión**: 2026-10-11
