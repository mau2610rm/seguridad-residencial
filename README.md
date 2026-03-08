# Seguridad Residencial

Sistema de seguridad para residenciales o fraccionamientos: app móvil (iOS/Android) y API REST.

## Funcionalidades

- **Apertura de puertas**: envío de señal desde la app (mock; preparado para integrar hardware).
- **Códigos de visitantes**: generar códigos temporales con vigencia y usos máximos; validación en entrada (guardia/admin).
- **Incidentes**: reportar, listar y actualizar estado; soporte para fotos.
- **Pagos**: ver cuotas por unidad; admin puede confirmar pagos.
- **Límites de apertura**: configurar máximos por día o mes por puerta/unidad; el backend rechaza con 429 si se excede.

## Requisitos

- Node.js 18+
- npm o yarn

## Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

La API queda en `http://localhost:3000`. Usuarios de prueba (contraseña `password123`):

- **Admin**: admin@demo.com  
- **Residente**: residente@demo.com  
- **Guardia**: guardia@demo.com  

### Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /auth/login | Login (email, password) |
| POST | /auth/refresh | Renovar token (refreshToken) |
| GET | /auth/me | Usuario actual (Authorization: Bearer) |
| GET | /doors | Listar puertas del residencial |
| POST | /doors/:id/open | Abrir puerta (mock) |
| GET | /visitors/codes | Listar códigos de visitante |
| POST | /visitors/codes | Crear código (unitId, validUntil, maxUses, doorIds?) |
| POST | /visitors/validate | Validar código (guardia/admin): code, doorId |
| GET/POST/PATCH | /incidents | Listar, crear, actualizar incidentes |
| GET | /payments | Listar pagos |
| POST | /payments/:id/confirm | Confirmar pago (admin) |
| GET/PUT/DELETE | /limits | Límites de apertura (admin) |
| GET | /units | Unidades del residencial |

Documentación OpenAPI: ver `backend/openapi.yaml`. Se puede importar en Swagger UI o Postman.

## App móvil (Expo)

```bash
cd mobile
npm install
```

Crear `mobile/.env` (opcional):

```
EXPO_PUBLIC_API_URL=http://TU_IP:3000
```

Para dispositivo físico usa la IP de tu PC en la red (no `localhost`). Para emulador Android: `http://10.0.2.2:3000`.

```bash
npm start
```

Luego escanear QR con Expo Go (Android/iOS) o elegir emulador.

## Estructura

```
seguridad-residencial/
├── backend/          # API Node + Express + Prisma + SQLite
│   ├── prisma/       # Schema y seed
│   └── src/
│       ├── routes/   # auth, doors, visitors, incidents, payments, limits, units
│       ├── services/ # límites de apertura
│       └── middleware/
├── mobile/           # App Expo (Expo Router)
│   ├── app/          # Pantallas (tabs: inicio, puertas, visitantes, incidentes, pagos, límites)
│   ├── context/      # Auth
│   └── services/     # Cliente API y tokens
└── README.md
```

## Seguridad

- JWT con acceso corto y refresh token.
- Validación de rol y residencial en cada endpoint.
- Límites de apertura aplicados en servidor.
- Códigos de visitante con vigencia y usos limitados.

## Próximos pasos (hardware)

Sustituir el mock de puertas por un cliente que llame a tu sistema (portero, Raspberry, ESP32, etc.) manteniendo la misma API de negocio.
