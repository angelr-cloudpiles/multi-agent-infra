# Contexto de Firewall Auditor 2.0

Paquete de contexto aislado para Agent Office. No concede acceso al checkout, credenciales, AWS, CI/CD ni datos de clientes.

## Procedencia verificable
- Repositorio: https://github.com/angelr-cloudpiles/firewall-auditor-saas.git
- Revisión: b1fb478138e58cb9843afb42207981c420487712
- Cambios locales detectados y excluidos: 16
- Integridad del paquete: sha256:6f444f178ac5557112f3ae610c4b7d8da7b161c0c51901bdff58bcd755c33f83

## Límites obligatorios
- Analiza sólo las fuentes incluidas y declara cualquier dato no disponible.
- No ejecutes mutaciones, despliegues, operaciones sobre AWS, CI/CD ni datos de clientes.
- No afirmes que cambiaste archivos. Entrega una propuesta o diff revisable para que otro flujo lo aplique en un worktree.

## README.md
SHA-256: b1431a99fc8ecd171da2590f917aa3e24e2a4eed76afcb144b0d81cff894a79d
```text
# Cloudpiles Firewall Auditor SaaS

Producto SaaS independiente para auditar configuraciones de firewall y facturar
una unidad por auditoria completada mediante AWS Marketplace.

Este repositorio es deliberadamente independiente de:

- `/Users/angelreale/Documents/4-DevOps/cloudpiles-platform`
- `/Users/angelreale/Documents/4-DevOps/cloudpiles-platform-v2`
- Los stacks internos `cp-apps-*` y `cp-v2-*`

La implementacion original se conserva sin cambios bajo
`reference/original-implementation/` solo como referencia de migracion.

## Entorno desplegado

| Superficie | URL |
| --- | --- |
| Portal de empresas | `https://auditor.cloudpiles.app` |
| Consola MSP | `https://auditor.cloudpiles.app/msp/` |
| API público | `https://api.cloudpiles.app` |
| AWS Marketplace | `https://aws.amazon.com/marketplace/pp/prodview-66ayovgefafra` |

Estado al 28 de junio de 2026:

- Stack: `cp-auditor-dev`
- Region: `us-east-1`
- Acceso cliente: registro/autogestion con email mediante Cognito, MFA TOTP
  obligatorio y pantalla de login con marca Cloudpiles.
- Tenant local: una empresa por cuenta; no puede crear ni enumerar otros clientes
- MSP: acceso exclusivo mediante Entra ID, pool corporativo `cp-v2-users` y
  permiso explicito `firewall-auditor:msp`.
- Cobro: AWS Marketplace limitado configurado con dimension `firewall_audit`
- Vendor soportado: FortiGate
- Fixture de prueba: `services/audit-engine/fixtures/demo-insecure.conf`
- Reporting: PDF trial y profesional, assessment, configuracion y auditoria
  completa. El profesional incorpora procedimientos GUI/CLI, evidencia técnica,
  plan de remediación y Gantt referencial; el trial conserva diagnóstico y
  evidencia resumida sin instrucciones operativas detalladas.
- Consolas: cliente con dashboard, auditorias, eventos, usuarios y perfil; MSP
  con operacion global, eventos y acciones por dispositivo.

## Cuenta AWS

- Profile local: `cloudpiles-platform`
- Account ID: `235553266597`
- Region primaria: `us-east-1`
- Route 53 hosted zone: `cloudpiles.app` (`Z09605692OMYGLI46NP8D`)
- Certificado ACM disponible: `cloudpiles.app` + `*.cloudpiles.app`

Los recursos del MVP estan gestionados por CDK desde este repositorio y usan el
prefijo `cp-auditor-dev`.

## Publicacion

```bash
npm install
npm --prefix apps/web install
AWS_PROFILE=cloudpiles-platform AWS_REGION=us-east-1 \
  npm run cdk -- deploy --profile cloudpiles-platform \
…[extracto truncado]
```

## package.json
SHA-256: 4791e689abf15d5f72934a6618097ac8ea020772cbf26b08b8a475e90870e708
```text
{
  "name": "cloudpiles-firewall-auditor-saas",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "npm run build:infra && npm run build:web",
    "build:infra": "tsc -p infra/cdk/tsconfig.json",
    "build:web": "npm --prefix apps/web run build",
    "cdk": "cdk --app \"npx ts-node --project infra/cdk/tsconfig.json infra/cdk/bin/app.ts\"",
    "synth": "npm run cdk -- synth",
    "deploy": "npm run cdk -- deploy --require-approval never"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "aws-cdk": "2.1126.0",
    "aws-cdk-lib": "^2.220.0",
    "constructs": "^10.4.2",
    "esbuild": "^0.28.1",
    "ts-node": "^10.9.2",
    "typescript": "^5.9.0"
  }
}
```
