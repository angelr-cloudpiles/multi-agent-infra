# Contexto de Servicio - diagramas AWS

Paquete de contexto aislado para Agent Office. No concede acceso al checkout, credenciales, AWS, CI/CD ni datos de clientes.

## Procedencia verificable
- Repositorio: https://github.com/angelr-cloudpiles/aws-diagram-service.git
- Revisión: 58055e17fdf876ce2ebbd14b553b89c8bf8e3733
- Cambios locales detectados y excluidos: 6
- Integridad del paquete: sha256:65af0371397794cfa4d2a09a73cc624e9d2c7b9d71eef33d1e435e0f5e186a2e

## Límites obligatorios
- Analiza sólo las fuentes incluidas y declara cualquier dato no disponible.
- No ejecutes mutaciones, despliegues, operaciones sobre AWS, CI/CD ni datos de clientes.
- No afirmes que cambiaste archivos. Entrega una propuesta o diff revisable para que otro flujo lo aplique en un worktree.

## README.md
SHA-256: 39b6e01e2b249f771cc417c67976aeaf3d9833a8e4885a89a6097e5fcb2c8648
```text
# AWS Architecture Diagram Service

Microservicio local y stateless para generar diagramas SVG de alta resolución a partir de una especificación JSON. La salida usa iconos oficiales del [paquete AWS Architecture Icons](https://aws.amazon.com/architecture/icons/) release `07312026`, descargado desde la página oficial de AWS y empaquetado en la imagen Docker.

La imagen adjunta se trata como referencia visual de nivel de detalle. Sus textos y servicios no son una arquitectura impuesta por el servicio.

## Ejecutar

```bash
cd /Users/angelreale/MLOps/Labs/Varios/aws-diagram-service
docker compose up -d --build
```

Abrir `http://localhost:8080` para usar la interfaz local o `http://localhost:8080/docs` para Swagger.

El servicio usa `restart: unless-stopped`: se reinicia automáticamente si el proceso falla y vuelve a iniciar cuando Docker arranca. Para dejarlo ejecutándose en segundo plano usa `docker compose up -d`; `docker compose stop` lo detiene sin que vuelva a levantarse automáticamente hasta que lo inicies otra vez.

Documentación mantenida:

- [Arquitectura del proyecto](docs/ARQUITECTURA.md): componentes, contrato, límites, API, seguridad y operación.
- [Manual de usuario](docs/MANUAL_USUARIO.md): uso de la interfaz, importación de imágenes, descargas y resolución de errores.

El botón `Ayuda` de la interfaz abre el manual servido en `/manual` directamente desde `docs/MANUAL_USUARIO.md`.

El proveedor por defecto es Amazon Bedrock mediante `bedrock-runtime.converse`. El navegador nunca recibe credenciales AWS. Ollama queda disponible como alternativa local usando `MODEL_PROVIDER=ollama`.

Configuración para Bedrock:

```bash
cp .env.example .env
# Edita AWS_PROFILE y AWS_CONFIG_DIR según tu equipo
export MODEL_PROVIDER=bedrock
export BEDROCK_REGION=us-east-1
export BEDROCK_MODEL_ID=us.amazon.nova-2-lite-v1:0
export BEDROCK_MAX_TOKENS=8192
export AWS_PROFILE=cloudpiles-platform
export AWS_CONFIG_DIR=/ruta/absoluta/a/.aws
docker compose up -d --build
```

`AWS_CONFIG_DIR` permite montar el directorio de configuración de AWS en modo solo lectura dentro del contenedor. El perfil debe tener permisos para `bedrock:InvokeModel` sobre el modelo elegido y el acceso al modelo debe estar habilitado en la región indicada. También se pueden usar las variables estándar de credenciales AWS en lugar de un perfil.

El compose publica el puerto únicamente en `127.0.0.1`
…[extracto truncado]
```

## requirements.txt
SHA-256: 3b3b68e785fb669de5aa6c33cf7170526b67a4b5f75fc7df04f984a3b6485805
```text
fastapi==0.116.1
uvicorn[standard]==0.35.0
pydantic==2.11.7
pytest==8.4.1
httpx==0.28.1
boto3>=1.34.0,<2
```
