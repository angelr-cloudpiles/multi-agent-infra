# Contexto de Continuar TicketeraFacil

Paquete de contexto aislado para Agent Office. No concede acceso al checkout, credenciales, AWS, CI/CD ni datos de clientes.

## Procedencia verificable
- Repositorio: https://github.com/angelr-cloudpiles/ticketera-facil.git
- Revisión: ef63fb1ba19fd8ac707a554fd9695a0089a6b16b
- Cambios locales detectados y excluidos: 0
- Integridad del paquete: sha256:cf7c8597c11a19c50b152b88f92d4ba3f8060f52d72ff6a47e6eb30719de94a6

## Límites obligatorios
- Analiza sólo las fuentes incluidas y declara cualquier dato no disponible.
- No ejecutes mutaciones, despliegues, operaciones sobre AWS, CI/CD ni datos de clientes.
- No afirmes que cambiaste archivos. Entrega una propuesta o diff revisable para que otro flujo lo aplique en un worktree.

## README.md
SHA-256: cd1d622489a8daaaa6acf4b1b2e00b32126a10d4248e7fd789b57f763e5134c3
```text
# TicketeraFacil

Plataforma de gestion de eventos, venta e inscripcion de entradas, acreditacion y operacion para organizadores.

La aplicacion moderniza la plataforma heredada sobre Laravel 11 y Next.js 15. El trabajo de paridad con la plataforma productiva original se realiza por modulos y flujos funcionales, permitiendo una transicion progresiva.

## Componentes principales

- Panel administrativo para eventos, organizaciones, participantes, accesos y reportes.
- Micrositios publicos, registro de asistentes y carrito de compra.
- Entradas gratuitas y pagas, promociones, cupos y validadores por codigo, documento o padron.
- Check-in mediante QR, invitaciones y comunicaciones por email o WhatsApp.
- Agenda, actividades, networking, empresas y matchmaking.
- Integraciones de pago con MercadoPago, Stripe, PayPal, dLocal Go, CobrosYa y Sistarbanc.
- API REST, reportes y exportaciones.

Las pasarelas de pago deben habilitarse por proveedor despues de completar pruebas controladas de orden, pago, callback/webhook, entrada y ticket. La seleccion interactiva de asientos con seats.io forma parte del roadmap y aun no esta habilitada como flujo general.

## Arquitectura

```text
Navegador
    |
    +-- Next.js 15: micrositios publicos y panel administrativo
    |
    +-- Laravel 11: API, reglas de negocio, pagos, QR y procesos asincronos
             |
             +-- MySQL 8.0: datos operativos
             +-- AWS SES / S3 y proveedores externos
```

En AWS, la aplicacion se despliega en ECS Fargate detras de un Application Load Balancer. El contenedor integra Nginx, PHP-FPM, Next.js y el worker de cola. La infraestructura se define con CloudFormation y el pipeline usa GitHub Actions, ECR y ECS.

## Requisitos de desarrollo

- PHP 8.3 con `pdo_mysql`, `gd`, `bcmath`, `pcntl`, `mbstring`, `xml`, `intl` y `zip`.
- Composer 2.x.
- Node.js 20 o superior y npm.
- Docker para MySQL 8.0 local.

## Inicio rapido local

```bash
git clone https://github.com/angelr-cloudpiles/ticketera-facil.git
cd ticketera-facil

composer install
(cd frontend && npm install)

cp .env.example .env
php artisan key:generate
```

Editar `.env` para usar valores locales. No reutilizar credenciales de produccion. Para el frontend, copiar y adaptar tambien `frontend/.env.example` si se requiere una URL de API distinta.

Iniciar MySQL con nombres de tabla insensibles a mayusculas, igual que el en
…[extracto truncado]
```
