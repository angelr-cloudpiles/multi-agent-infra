# Multi-Agent Infrastructure - Quick Start Guide

## 🚨 PASO 1: Limpiar Estado de Terraform (REQUERIDO)

El directorio `.terraform` tiene una referencia al backend S3 anterior. Debes limpiarlo manualmente:

```bash
cd /Users/angelreale/MLOps/Personales/Gaudi/multi-agent-infra/infra

# Opción A: Usar el script automático
../scripts/force-cleanup.sh

# Opción B: Manual
rm -rf .terraform .terraform.lock.hcl terraform.tfstate*
terraform init
```

---

## 📦 PASO 2: Desplegar Infraestructura Base

Una vez limpio el estado:

```bash
cd /Users/angelreale/MLOps/Personales/Gaudi/multi-agent-infra/infra

# Verificar configuración
terraform validate

# Generar plan
terraform plan -out=tfplan

# Aplicar cambios
terraform apply tfplan
```

**Tiempo estimado**: 15-20 minutos

---

## 📤 PASO 3: Subir a GitHub

```bash
cd /Users/angelreale/MLOps/Personales/Gaudi/multi-agent-infra

git add -A
git commit -m "Initial commit: Multi-Agent Infrastructure"
git push -u origin main
```

---

## 🎯 PASO 4: Próximos Pasos (Después del Apply)

Una vez que la infraestructura base esté desplegada, el asistente continuará con:

1. **Route53 + ACM**: Certificado SSL para `*.aiops.cloudpiles.net`
2. **ECS Services**: Langfuse y Agent Office en Fargate
3. **Cognito + Entra ID**: Autenticación federada
4. **AgentCore Harnesses**: 5 agentes especializados
5. **CI/CD Pipeline**: GitHub Actions para despliegue continuo

---

## 📊 Recursos que se Crearán

| Recurso | Cantidad | Costo Estimado |
|---------|----------|----------------|
| VPC | 1 | $32/mes |
| Subnets | 6 | Incluido |
| NAT Gateways | 2 | $64/mes |
| Security Groups | 4 | Incluido |
| IAM Roles | 3 | Incluido |
| S3 Buckets | 3 | $6/mes |
| RDS PostgreSQL | 1 | $14/mes |
| ElastiCache Redis | 1 | $16/mes |
| AWS Budgets | 1 | Incluido |
| Secrets Manager | 3 | $2/mes |
| KMS Keys | 1 | $1/mes |
| **TOTAL** | - | **~$149/mes** |

---

## ⚠️ Notas Importantes

1. **terraform.tfvars** contiene secrets - ya está en `.gitignore`
2. El backend S3 ya está creado: `multi-agent-terraform-state-278741241787`
3. DynamoDB table para locks: `multi-agent-terraform-locks`
4. Budget configurado: $1,000/mes con alertas al 50%, 75%, 90%, 100%

---

## 🔧 Troubleshooting

### Error: "Backend initialization required"
```bash
# Limpiar estado anterior
rm -rf .terraform .terraform.lock.hcl
terraform init -reconfigure
```

### Error: "Error: Provider produced inconsistent result"
```bash
# Regenerar plan
terraform plan -out=tfplan
```

### Error: "AccessDenied" en AWS
```bash
# Verificar perfil AWS
aws sts get-caller-identity --profile aiops-aws
```

---

## 📞 Soporte

Si encuentras algún problema:
1. Revisa los logs de Terraform
2. Verifica que los perfiles AWS estén configurados correctamente
3. Asegúrate de tener permisos de administrador en la cuenta 278741241787

---

**Ejecuta los comandos arriba y avisa al asistente cuando termines.**
