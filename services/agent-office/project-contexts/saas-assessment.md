# Contexto de SaaS de assessment

Paquete de contexto aislado para Agent Office. No concede acceso al checkout, credenciales, AWS, CI/CD ni datos de clientes.

## Procedencia verificable
- Repositorio: https://github.com/cloudpiles/cloudpiles-assessment.git
- Revisión: 33a407330e4b21a68df8e84df3620921242c264a
- Cambios locales detectados y excluidos: 29
- Integridad del paquete: sha256:0e0af8aaca7842b4adad50c307fcab556c7622866e0db3b7c3e0a921843da427

## Límites obligatorios
- Analiza sólo las fuentes incluidas y declara cualquier dato no disponible.
- No ejecutes mutaciones, despliegues, operaciones sobre AWS, CI/CD ni datos de clientes.
- No afirmes que cambiaste archivos. Entrega una propuesta o diff revisable para que otro flujo lo aplique en un worktree.

## README.md
SHA-256: df33757b6ac8b78b1ecd47f7ade4f21235a38488f66d9229cef68231b5a5f5e6
```text
# Cloudpiles Assessment Platform

SaaS platform for cloud infrastructure assessments, starting with AWS and designed
for future Azure and GCP providers. The product has two primary surfaces:

- Customer console at `/`
- Cloudpiles MSP console at `/msp/`

The first implementation includes a React/Vite dashboard, AWS CDK control plane,
API-backed assessment scheduling, DynamoDB persistence, and static frontend
hosting through S3 + CloudFront.

## Local Development

```bash
npm install
npm run dev
```

Open the Vite URL and use:

- `/` for the customer console
- `/msp/` for the MSP console

## Validation

```bash
npm run lint
npm run build
npm run synth
```

The CDK commands are configured to use:

```bash
AWS_PROFILE=cloudpiles-platform
```

## Deployment

```bash
npm run deploy
```

The stack creates Cognito, API Gateway, Lambda handlers, DynamoDB tables, S3
report storage, SQS queues, EventBridge orchestration, Route53 records, and a
CloudFront-hosted web console at `https://assessments.cloudpiles.app`.

`npm run deploy` runs `npm run build` first so the latest frontend bundle is
published to the web bucket.

## Project Documents

- [Business and work plan](docs/business-plan.md)
- [Architecture](docs/architecture.md)
- [AWS Marketplace integration](docs/marketplace.md)
- [Production deployment](docs/production-deployment.md)

## Visual Reference

The first UI concept is stored in [concept-dashboard.png](concept-dashboard.png).
```

## package.json
SHA-256: 48ac097d8f484699ce02ec8ef824e2beea55ebfb6bd74116eba5baa386ce7083
```text
{
  "name": "auditor",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "cdk": "AWS_PROFILE=cloudpiles-platform cdk",
    "deploy": "npm run build && AWS_PROFILE=cloudpiles-platform cdk deploy --all",
    "destroy": "AWS_PROFILE=cloudpiles-platform cdk destroy --all",
    "lint": "oxlint",
    "preview": "vite preview",
    "synth": "npm run build && AWS_PROFILE=cloudpiles-platform cdk synth",
    "test": "tsx --test test/**/*.test.ts"
  },
  "dependencies": {
    "@aws-sdk/client-backup": "^3.1086.0",
    "@aws-sdk/client-cloudtrail": "^3.1085.0",
    "@aws-sdk/client-cloudwatch": "^3.1086.0",
    "@aws-sdk/client-cognito-identity-provider": "^3.1086.0",
    "@aws-sdk/client-compute-optimizer": "^3.1086.0",
    "@aws-sdk/client-config-service": "^3.1086.0",
    "@aws-sdk/client-cost-explorer": "^3.1085.0",
    "@aws-sdk/client-dynamodb": "^3.1085.0",
    "@aws-sdk/client-ec2": "^3.1085.0",
    "@aws-sdk/client-eventbridge": "^3.1085.0",
    "@aws-sdk/client-guardduty": "^3.1085.0",
    "@aws-sdk/client-iam": "^3.1085.0",
    "@aws-sdk/client-marketplace-entitlement-service": "^3.1085.0",
    "@aws-sdk/client-marketplace-metering": "^3.1085.0",
    "@aws-sdk/client-organizations": "^3.1085.0",
    "@aws-sdk/client-rds": "^3.1085.0",
    "@aws-sdk/client-s3": "^3.1085.0",
    "@aws-sdk/client-s3-control": "^3.1085.0",
    "@aws-sdk/client-securityhub": "^3.1085.0",
    "@aws-sdk/client-sqs": "^3.1085.0",
    "@aws-sdk/client-sts": "^3.1085.0",
    "@aws-sdk/client-wellarchitected": "^3.1086.0",
    "@aws-sdk/lib-dynamodb": "^3.1085.0",
    "@aws-sdk/s3-request-presigner": "^3.1085.0",
    "aws-cdk-lib": "^2.261.0",
    "constructs": "^10.6.0",
    "lucide-react": "^1.24.0",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "recharts": "^3.9.2"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.162",
    "@types/node": "^24.13.2",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.3",
    "aws-cdk": "^2.1130.0",
    "esbuild": "^0.28.1",
    "oxlint": "^1.71.0",
    "playwright": "^1.61.1",
    "tsx": "^4.23.0",
    "typescript": "~6.0.2",
    "vite": "^8.1.1"
  }
}
```

## cdk.json
SHA-256: 77b967f472d2ee8fd6fd5731cddf4e261a8dadc2d4bf7646df5b97d4ae508d8e
```text
{
  "app": "tsx bin/cloudpiles-assessment.ts",
  "context": {
    "@aws-cdk/core:newStyleStackSynthesis": true
  }
}
```
