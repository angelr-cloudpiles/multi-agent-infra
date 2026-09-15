# Contexto de SaaS de compliance

Paquete de contexto aislado para Agent Office. No concede acceso al checkout, credenciales, AWS, CI/CD ni datos de clientes.

## Procedencia verificable
- Repositorio: https://github.com/angelr-cloudpiles/privacy-compliance.git
- Revisión: c134fef9bdb0424520d16a5febe41c17c0b4f771
- Cambios locales detectados y excluidos: 3
- Integridad del paquete: sha256:86d52dbeaa3de57bc1b168f4cc9036ca57502d9dd9e5c1a46914fb6b27bd473d

## Límites obligatorios
- Analiza sólo las fuentes incluidas y declara cualquier dato no disponible.
- No ejecutes mutaciones, despliegues, operaciones sobre AWS, CI/CD ni datos de clientes.
- No afirmes que cambiaste archivos. Entrega una propuesta o diff revisable para que otro flujo lo aplique en un worktree.

## README.md
SHA-256: 5e5b3b6d08d97c86354744fa22a66485c5891fdb03601eb8d0e5c7f86ad3384a
```text
# Cloudpiles Privacy Compliance

Producto SaaS de evaluación de cumplimiento en protección de datos para organizaciones que operan en Argentina, Chile, España y Uruguay.

## Propuesta

El producto combina:

- cuestionario adaptativo sobre tratamientos, gobernanza y derechos;
- evidencias documentales aportadas por el cliente;
- assessment técnico read-only de arquitectura cloud o proyecto;
- catálogo de controles versionado por jurisdicción;
- mapa de riesgos y contradicciones entre las respuestas y la arquitectura;
- plan priorizado de remediación.

El informe cierra cada evaluación con próximos pasos de remediación: acciones sugeridas, componentes disponibles o recomendados, evidencias esperadas y formas concretas en las que Cloudpiles puede acompañar el cierre de cada brecha.

Para Chile, el catálogo incluye un perfil **Ley 21.719 Readiness** con controles sobre RAT, transparencia, privacidad desde el diseño, derechos, consentimiento, datos sensibles, encargados, brechas y evaluaciones de impacto. El análisis AWS read-only es opcional y aporta evidencia técnica sobre la configuración observada; no sustituye la evidencia organizativa ni el asesoramiento jurídico.

El resultado es un assessment de postura de privacidad, no una certificación ni un dictamen jurídico.

## Estado

El producto autónomo está desplegado en AWS en la cuenta `cloudpiles-platform` (`235553266597`), región `us-east-1`: [portal de clientes](https://compliance.cloudpiles.app), [consola MSP](https://compliance.cloudpiles.app/msp) y [API health check](https://4qx0cxt9e8.execute-api.us-east-1.amazonaws.com/health). El portal existente de Cloudpiles v2 dispone de un catálogo preliminar en `cloudpiles-platform-v2/portal/lib/normativas.ts`, UI de assessments y persistencia en DynamoDB. Esos elementos pueden servir como referencia o material de migración, pero este producto no depende de ellos en runtime ni comparte sus datos, autenticación, despliegues o ciclo de releases.

La integración técnica de fulfillment con AWS Marketplace está desplegada y el producto SaaS está preparado como oferta gratuita en revisión: producto `prod-3qbat5mgk24u2`, código `8bh7ef5mggrs6ijz7lzeya8q7`, oferta `offer-mkdga4e3fbmma`, usando el perfil `cloudpiles-mkt`. El precio configurado es `$0.00` por assessment; AWS no admite `0.00001` en este modelo.

La separación es deliberada: el nuevo SaaS debe poder desplega
…[extracto truncado]
```

## package.json
SHA-256: 222e2d0bce1b701114224d8223ec83ea9c0f3ef05d1ec6334410b1449d6af1f1
```text
{
  "name": "cloudpiles-privacy-compliance",
  "private": true,
  "version": "0.1.0",
  "workspaces": [
    "apps/*",
    "packages/*",
    "backend",
    "infra"
  ],
  "scripts": {
    "dev": "npm run dev -w @cloudpiles/privacy-web",
    "build": "npm run build -w @cloudpiles/privacy-web && npm run build -w @cloudpiles/privacy-backend && npm run build -w @cloudpiles/privacy-infra",
    "typecheck": "npm run typecheck -w @cloudpiles/privacy-web && npm run typecheck -w @cloudpiles/privacy-backend && npm run typecheck -w @cloudpiles/privacy-infra",
    "test": "npm run test -w @cloudpiles/privacy-backend",
    "synth": "npm run synth -w @cloudpiles/privacy-infra"
  }
}
```
