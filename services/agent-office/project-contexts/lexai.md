# Contexto de LexAI

Paquete de contexto aislado para Agent Office. No concede acceso al checkout, credenciales, AWS, CI/CD ni datos de clientes.

## Procedencia verificable
- Repositorio: https://github.com/angelr-cloudpiles/lexai.git
- Revisión: 3c11b57fabae3e709fcbb4e4b3d3dc529fb339c6
- Cambios locales detectados y excluidos: 0
- Integridad del paquete: sha256:f97a0135dfe7078f6886ae86976ca580c203247a5b109b62df5abccd32e142a7

## Límites obligatorios
- Analiza sólo las fuentes incluidas y declara cualquier dato no disponible.
- No ejecutes mutaciones, despliegues, operaciones sobre AWS, CI/CD ni datos de clientes.
- No afirmes que cambiaste archivos. Entrega una propuesta o diff revisable para que otro flujo lo aplique en un worktree.

## README.md
SHA-256: abc7882b142edd184ad62a6649304d5b13bbe96b70f2c5aece7adfe75f14c534
```text
# LexAI legal-analysis platform

Base serverless multi-país para departamentos legales, con evidencia trazable, Bedrock y revisión humana obligatoria. Argentina es el primer setup.

## Estado

La primera versión está publicada en [lexai.cloudpiles.info](https://lexai.cloudpiles.info) y [legalai.cloudpiles.info](https://legalai.cloudpiles.info). Incluye portal web, distribución CloudFront con WAF, autenticación Cognito, API protegida, workflow de análisis, almacenamiento cifrado, contrato de evidencia, aprobación de abogado y paquetes de país versionados. Argentina es el setup inicial.

No despliega un conector externo ni una Knowledge Base hasta contar con licencias, corpus autorizado y diseño de protección de datos.

Consultar [country-setups.md](docs/country-setups.md) para el contrato de país y la configuración inicial de Argentina. Los manuales disponibles son el [manual de usuario](docs/manual-usuario.md), el [manual de API](docs/api.md), la [documentación del proyecto](docs/proyecto.md) y el [guion de demostración](docs/demostracion.md).
La configuración de MFA por correo y recuperación administrativa está documentada en [mfa-email-ses.md](docs/mfa-email-ses.md).

## Verificación local

```bash
npm install
npm test
npm run synth
```

## Límites de seguridad

- No cargar secretos de PJN/MEV/EJE en variables de entorno.
- No enviar documentos sin redacción de PII a un modelo o índice sin la aprobación de protección de datos.
- Toda salida es un borrador respaldado por evidencia, no asesoramiento jurídico ni una respuesta automatizada al cliente.

## Operación publicada

- Dominio: `lexai.cloudpiles.info` (CloudFront, HTTPS y WAF administrados en `us-east-1`).
- Inicio de sesión: el botón **Ingresar** usa el formulario propio de LegalAI con SRP y MFA opcional por correo. Antes de habilitar a un usuario, el administrador debe asignar el atributo inmutable `custom:tenant_id` y el nivel `LEGALAI_READ_ONLY`, `LEGALAI_STANDARD` o `LEGALAI_ADMIN`; los grupos históricos se preservan sólo por compatibilidad.
- MFA y recuperación: Cognito entrega MFA por correo mediante la identidad SES de `lexai.cloudpiles.info`. SNS no participa porque se reserva para SMS. El administrador genera una contraseña temporal visible una sola vez, la comparte por un canal seguro y Cognito exige cambiarla en el siguiente acceso.
- API: solo se expone detrás del portal y requiere JWT. U
…[extracto truncado]
```

## package.json
SHA-256: ce83e49ba8cb4c0eb540045bb72c9593c50fb634b8f7c3030dbec26a052e7030
```text
{
  "name": "lexai-legal-analysis-platform",
  "version": "0.1.0",
  "private": true,
  "description": "Evidence-first legal analysis platform for Argentina.",
  "scripts": {
    "build": "tsc --noEmit",
    "build:web": "npm --prefix frontend run build",
    "test": "tsx --test test/**/*.test.ts",
    "synth": "npm run build && npm run build:web && cdk synth --strict",
    "diff": "npm run build && cdk diff"
  },
  "engines": {
    "node": ">=22"
  },
  "dependencies": {
    "@aws-sdk/client-bedrock-runtime": "^3.0.0",
    "@aws-sdk/client-cognito-identity-provider": "^3.1125.0",
    "@aws-sdk/client-comprehend": "^3.1116.0",
    "@aws-sdk/client-dynamodb": "^3.0.0",
    "@aws-sdk/client-eventbridge": "^3.0.0",
    "@aws-sdk/client-s3": "^3.0.0",
    "@aws-sdk/client-sfn": "^3.0.0",
    "@aws-sdk/client-textract": "^3.1116.0",
    "@aws-sdk/lib-dynamodb": "^3.0.0",
    "@aws-sdk/s3-request-presigner": "^3.1116.0",
    "aws-cdk-lib": "^2.266.0",
    "constructs": "^10.4.2",
    "mailparser": "^3.9.20",
    "pdf-parse": "^2.4.5"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.0",
    "@types/mailparser": "^3.4.6",
    "@types/node": "^22.0.0",
    "aws-cdk": "^2.1138.0",
    "esbuild": "^0.25.0",
    "tsx": "^4.0.0",
    "typescript": "^5.7.0"
  }
}
```

## cdk.json
SHA-256: 39e189235298398c6d88173498546324d562e78fc87fb9af286738853c764000
```text
{
  "app": "npx tsx bin/lexai.ts",
  "context": {
    "allowedOrigins": ["https://lexai.cloudpiles.info", "https://legalai.cloudpiles.info"],
    "analysisModelId": "amazon.nova-lite-v1:0",
    "siteDomain": "lexai.cloudpiles.info",
    "siteAliases": ["legalai.cloudpiles.info"],
    "cognitoDomainPrefix": "legalai-cloudpiles-839922332058",
    "siteCertificateArn": "arn:aws:acm:us-east-1:839922332058:certificate/bdf0b562-f532-41ea-9a19-4d2c3b9b5f96",
    "professionalEligibilityEnforced": false
  }
}
```

## docs/manual-usuario.md
SHA-256: 71cd4ee473f6e59aa8c500fbca18465dba5b6be1767dfddabb97f4892f4ce14b
```text
# Manual de usuario de LegalAI

Versión demostrable: 0.2.0 · Portal: https://lexai.cloudpiles.info · Alias: https://legalai.cloudpiles.info · País inicial: Argentina

## Propósito y alcance

LegalAI organiza el trabajo jurídico por asunto, evidencia y jurisdicción. Sus análisis son borradores asistidos que deben ser revisados por una persona responsable. No constituye asesoramiento jurídico autónomo, no reemplaza la verificación de fuentes ni autoriza respuestas automáticas a clientes, organismos o contrapartes.

## Primer acceso

1. Solicitá al administrador una cuenta asociada a tu organización (`tenant_id`) y grupo de trabajo.
2. Abrí el portal y seleccioná **Ingresar**.
3. Completá el formulario propio de acceso de LegalAI. Si el administrador habilitó MFA, ingresá el código de seis dígitos recibido en tu correo asociado.
4. Verificá que el selector de país corresponda al asunto. En esta versión el setup habilitado es Argentina.

La plataforma no permite auto-registro. El administrador asigna uno de tres niveles: **Solo lectura** puede consultar información sin cambiarla; **Standard** trabaja en casos, material, análisis y documentos legales, pero no ve Configuración; **Administrador** también accede a la configuración y gestiona usuarios. Los grupos históricos se conservan sólo para no interrumpir accesos ya existentes.

Si olvidaste la contraseña, solicitá el restablecimiento al administrador. En **Configuración → Gestión de usuarios** puede generar una contraseña temporal visible una única vez, compartirla por un canal seguro y Cognito exigirá cambiarla al ingresar. Desde allí también puede restablecer o desactivar MFA, dar de baja y eliminar usuarios. Este circuito evita usar el mismo correo como MFA y recuperación autónoma.

## Flujo de trabajo recomendado

1. **Delimitar el caso.** Definí asunto, área, jurisdicción, partes, plazo y pregunta jurídica concreta.
2. **Reunir evidencia autorizada.** Conservá documento origen, fecha de obtención, fuente, hash, jurisdicción y extracto relevante.
3. **Verificar aplicabilidad.** Distinguí Nación, provincia, CABA y competencia. No asumas vigencia, firmeza de un fallo o texto ordenado sin evidencia explícita.
4. **Solicitar el análisis.** En la API se envían la pregunta, país y los identificadores de evidencia. El flujo rechaza países no soportados y requiere `Idempotency-Key`.
5. **Revisar el borrador.** Con
…[extracto truncado]
```
