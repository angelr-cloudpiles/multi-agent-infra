# Contexto de Bazar

Paquete de contexto aislado para Agent Office. No concede acceso al checkout, credenciales, AWS, CI/CD ni datos de clientes.

## Procedencia verificable
- Repositorio: https://github.com/angelr-cloudpiles/Bazar.git
- Revisión: 4f777e2722b2d5011b8693a0b2d54fd9adac3c8e
- Cambios locales detectados y excluidos: 0
- Integridad del paquete: sha256:45962facbdbaf85eb8bd6b043a7748566480583eedbd4cc06db349a8f59165aa

## Límites obligatorios
- Analiza sólo las fuentes incluidas y declara cualquier dato no disponible.
- No ejecutes mutaciones, despliegues, operaciones sobre AWS, CI/CD ni datos de clientes.
- No afirmes que cambiaste archivos. Entrega una propuesta o diff revisable para que otro flujo lo aplique en un worktree.

## README.md
SHA-256: 4b1d5eac1f6b9d1275e8a30573e3854b9967fcce46d85f828154d3b869a9f81a
```text
# Bazar

AWS-native platform for importing, certifying, composing and deploying Terraform products.

The initial environment is isolated in AWS account `235553266597`, region `us-east-1`, with the `bazar-dev` namespace and mandatory `Project=Bazar` tags.

## Infrastructure

1. Bootstrap the dedicated Terraform state in `infra/bootstrap`.
2. Deploy the platform foundation from `infra/dev`.

No pre-existing account resources are imported or managed by this project.

## Frontend

The Next.js portal lives in `frontend/` and is configured for Amplify Hosting through `amplify.yml`.
The production URL is `https://bazar.cloudpiles.app`. Authentication uses the dedicated Cognito user pool; public registration is disabled.
```
