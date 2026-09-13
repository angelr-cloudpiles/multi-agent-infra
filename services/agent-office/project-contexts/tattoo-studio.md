# Contexto de Tattoo Studio

Este es un piloto de lectura para analizar el producto Fede Rod Tattoo Studio. No hay un montaje del repositorio, credenciales de AWS, acceso a CI/CD ni permisos entre cuentas dentro de este flujo.

## Fuentes incluidas en el paquete

- `README.md`: descripción del producto y flujo de diseño asistido.
- `docs/operacion-produccion.md`: operación, retención, observabilidad y despliegue.
- `main.tf`, `variables.tf`, `outputs.tf` y módulos Terraform: arquitectura declarada.
- `tests/test_async_image_jobs.py`: cobertura actual del flujo asíncrono de generación.

## Arquitectura observada

- PWA React/Vite autenticada con Cognito MFA, servida con CloudFront y S3.
- API Gateway REST con authorizer Cognito invoca Lambdas Python arm64 para chat, imágenes y administración.
- DynamoDB conserva sesiones y solicitudes; S3 privado conserva imágenes con URLs firmadas.
- La generación de imágenes se procesa de forma asíncrona mediante SQS y DLQ; el worker usa idempotencia por `requestId`, hasta tres reintentos y concurrencia máxima dos.
- Bedrock participa en el refinamiento de prompts y en la generación; existe una Knowledge Base opcional para diseños terminados, separada del flujo actual.
- La observabilidad declarada incluye logs de API Gateway, X-Ray, dashboard de CloudWatch y alarmas para errores Lambda, antigüedad de cola y DLQ.

## Límites obligatorios del piloto

- Analiza únicamente el contexto suministrado; declara cualquier dato que no esté disponible.
- No propongas ni ejecutes `terraform apply`, despliegues, mutaciones de AWS, cambios de CI/CD, operaciones sobre datos de clientes, ni generación de imágenes.
- No inventes valores de configuración, recursos en vivo, credenciales o resultados de pruebas.
- Cuando cites una conclusión, indica la fuente del paquete que la sustenta.
