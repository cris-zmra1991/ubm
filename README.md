
# Gestor Unificado de Negocios (UBM)

Este proyecto es una aplicación web completa diseñada para ser un Gestor Unificado de Negocios (UBM, por sus siglas en inglés Unified Business Manager). Permite a los usuarios gestionar diversos aspectos de su negocio, desde contactos y ventas hasta contabilidad e inventario, todo desde una única plataforma intuitiva.

## ✨ Características Principales

*   **Autenticación Segura:** Sistema de inicio de sesión con credenciales de usuario y gestión de sesiones mediante cookies JWT HttpOnly.
*   **Gestión de Módulos Integrados:**
    *   **Panel Principal (Dashboard):** Vista general con métricas clave del negocio.
    *   **Contactos:** Administración de clientes, proveedores y prospectos.
    *   **Compras:** Creación y seguimiento de órdenes de compra.
    *   **Ventas:** Gestión de órdenes de venta y facturas.
    *   **Gastos:** Registro y categorización de gastos.
    *   **Contabilidad:** Plan de cuentas jerárquico, asientos contables y reportes financieros básicos.
    *   **Inventario:** Seguimiento de niveles de stock, gestión de productos y ajuste de inventario.
    *   **Administración:** Gestión de usuarios, roles y permisos, configuración general de la aplicación.
*   **Control de Acceso Basado en Roles (RBAC):** Permisos definidos para diferentes roles de usuario (Administrador, Contador, Gerente, Almacenero, Comercial) para restringir el acceso a módulos específicos.
*   **Interfaz de Usuario Moderna y Responsiva:** Construida con Next.js y ShadCN UI para una experiencia de usuario agradable y adaptable a diferentes dispositivos.
*   **Backend con Server Actions:** Lógica de negocio y acceso a base de datos implementados mediante Server Actions de Next.js.
*   **Base de Datos MySQL:** Diseñado para conectarse a una base de datos MySQL local para persistencia de datos.
*   **Generación Automática de Números de Orden:** Los números para órdenes de compra (OP) y venta (PV) se generan automáticamente.
*   **Integración de Productos de Inventario:** Selección de productos existentes del inventario al crear órdenes de compra y venta.
*   **Notificaciones Toast:** Feedback visual para las acciones del usuario.

## 🛠️ Stack Tecnológico

*   **Framework Frontend/Backend:** [Next.js](https://nextjs.org/) (con App Router)
*   **Lenguaje:** [TypeScript](https://www.typescriptlang.org/)
*   **Librería UI:** [React](https://react.dev/)
*   **Componentes UI:** [ShadCN UI](https://ui.shadcn.com/)
*   **Estilos CSS:** [Tailwind CSS](https://tailwindcss.com/)
*   **Gestión de Formularios:** [React Hook Form](https://react-hook-form.com/)
*   **Validación de Esquemas:** [Zod](https://zod.dev/)
*   **Base de Datos:** [MySQL](https://www.mysql.com/) (requiere configuración local externa)
*   **Driver MySQL:** `mysql2`
*   **Autenticación y Sesiones:** JWT (firmados con `jose`) almacenados en cookies HttpOnly.
*   **Hashing de Contraseñas:** `bcryptjs`
*   **Iconos:** [Lucide React](https://lucide.dev/)
*   **Funcionalidades de IA (Opcional/Futuro):** Preparado para [Genkit](https://firebase.google.com/docs/genkit) (configuración base existente).

## 🚀 Guía de Inicio Rápido

Sigue estos pasos para poner en marcha el proyecto en tu entorno local.

### Requisitos Previos

*   [Node.js](https://nodejs.org/) (versión LTS recomendada, ej: 18.x o 20.x)
*   npm (viene con Node.js) o [Yarn](https://yarnpkg.com/)
*   Un servidor MySQL en ejecución (ej. XAMPP, MAMP, Docker, o una instancia de MySQL local).
*   Un cliente MySQL (ej. phpMyAdmin, MySQL Workbench, DBeaver) para gestionar la base de datos.

### Instalación

1.  **Clonar el Repositorio (o Descargar y Descomprimir):**
    ```bash
    git clone https://URL_DE_TU_REPOSITORIO.git
    cd nombre-del-proyecto
    ```
    Si descargaste un ZIP, descomprímelo y navega a la carpeta raíz.

2.  **Instalar Dependencias:**
    Abre una terminal en la raíz del proyecto y ejecuta:
    ```bash
    npm install
    # o si usas Yarn
    # yarn install
    ```

3.  **Configurar Variables de Entorno:**
    *   Copia el archivo `.env.example` a un nuevo archivo llamado `.env`:
        ```bash
        cp .env.example .env
        ```
    *   Abre el archivo `.env` y modifica las variables según tu configuración local:
        ```env
        DB_HOST=localhost
        DB_USER=root         # Cambia si tu usuario de MySQL es diferente
        DB_PASSWORD=         # Pon tu contraseña de MySQL si la tienes
        DB_NAME=ubm_db       # El nombre de la base de datos que crearás
        DB_PORT=3306

        # ¡IMPORTANTE! Reemplaza esto con una cadena secreta fuerte y aleatoria de al menos 32 caracteres.
        # Puedes generar una con: openssl rand -hex 32 (en una terminal que tenga openssl)
        SESSION_SECRET="UNA_CADENA_SECRETA_MUY_LARGA_Y_ALEATORIA_AQUI_CAMBIAME"
        SESSION_MAX_AGE_SECONDS=3600 # Duración de la cookie de sesión en segundos (ej. 1 hora)
        SESSION_EXPIRATION_TIME="1h" # Expiración del token JWT (ej. 1 hora)
        ```
    *   **Asegúrate de generar un `SESSION_SECRET` seguro y único.**

4.  **Configurar la Base de Datos MySQL:**
    *   Conéctate a tu servidor MySQL.
    *   Crea la base de datos especificada en `DB_NAME` (por defecto `ubm_db`):
        ```sql
        CREATE DATABASE IF NOT EXISTS ubm_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        ```
    *   Selecciona la base de datos:
        ```sql
        USE ubm_db;
        ```
    *   Ejecuta los scripts SQL para crear todas las tablas necesarias. Estos se encuentran como comentarios `// TODO: SQL - CREATE TABLE ...` en los archivos dentro de `src/app/actions/` o puedes usar el script consolidado proporcionado por el asistente de desarrollo.
    *   **Importante:** Ejecuta el script de *seeding* (población inicial) para crear el usuario administrador inicial y asignar permisos, asegurándote de hashear la contraseña correctamente.

### Ejecución del Proyecto

1.  **Iniciar el Servidor de Desarrollo de Next.js:**
    ```bash
    npm run dev
    # o
    # yarn dev
    ```
    La aplicación estará disponible por defecto en `http://localhost:9002` (según la configuración en `package.json`).

2.  **Iniciar el Servidor de Desarrollo de Genkit (si se utiliza funcionalidad de IA):**
    Abre una nueva terminal y ejecuta:
    ```bash
    npm run genkit:watch
    # o para iniciar una vez
    # npm run genkit:dev
    ```
    Genkit suele ejecutarse en `http://localhost:3400`.

3.  **Acceder a la Aplicación:**
    Abre tu navegador y ve a `http://localhost:9002`.

## 📂 Estructura del Proyecto (Simplificada)

```
.
├── public/                  # Archivos estáticos públicos
├── src/
│   ├── app/                 # Rutas y páginas de la aplicación (App Router)
│   │   ├── (module_name)/   # Carpetas para cada módulo (contacts, sales, etc.)
│   │   │   ├── page.tsx     # Componente de la página del módulo
│   │   ├── actions/         # Server Actions para la lógica de backend
│   │   ├── schemas/         # Esquemas Zod para validación de datos
│   │   ├── layout.tsx       # Layout raíz de la aplicación
│   │   ├── page.tsx         # Página principal (Dashboard)
│   │   └── login/           # Página y layout de inicio de sesión
│   ├── components/          # Componentes React reutilizables
│   │   ├── ui/              # Componentes ShadCN UI (botones, cards, etc.)
│   │   ├── layout/          # Componentes de estructura (AppShell, Sidebar)
│   │   └── icons/           # Iconos SVG personalizados
│   ├── hooks/               # Hooks personalizados (ej. useToast)
│   ├── lib/                 # Librerías y utilidades
│   │   ├── db.ts            # Configuración de la conexión a MySQL
│   │   ├── session.ts       # Lógica de gestión de sesiones JWT
│   │   └── utils.ts         # Utilidades generales (ej. cn)
│   ├── ai/                  # Módulos de Genkit (si se usa IA)
│   └── middleware.ts        # Middleware para autenticación y RBAC
├── .env                     # Variables de entorno locales (NO SUBIR A GIT)
├── .env.example             # Ejemplo de variables de entorno
├── .gitignore
├── next.config.ts           # Configuración de Next.js
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## 🔑 Variables de Entorno

Las siguientes variables de entorno son necesarias para el correcto funcionamiento de la aplicación. Asegúrate de tenerlas configuradas en tu archivo `.env` local:

*   `DB_HOST`: Host de tu servidor MySQL (ej. `localhost`).
*   `DB_USER`: Usuario de MySQL.
*   `DB_PASSWORD`: Contraseña del usuario de MySQL.
*   `DB_NAME`: Nombre de la base de datos.
*   `DB_PORT`: Puerto del servidor MySQL (ej. `3306`).
*   `SESSION_SECRET`: Un secreto largo y aleatorio para firmar los tokens JWT de sesión. **¡Este es crítico para la seguridad!**
*   `SESSION_MAX_AGE_SECONDS`: Tiempo de vida de la cookie de sesión en segundos.
*   `SESSION_EXPIRATION_TIME`: Tiempo de expiración del token JWT (formato de `jose`, ej: "1h", "7d").

## 💾 Configuración de la Base de Datos MySQL

La aplicación está diseñada para conectarse a una base de datos MySQL.

1.  **Crear la Base de Datos:**
    ```sql
    CREATE DATABASE IF NOT EXISTS ubm_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    USE ubm_db;
    ```

2.  **Crear las Tablas:**
    Utiliza las sentencias `CREATE TABLE` que se encuentran comentadas dentro de cada archivo en `src/app/actions/*.actions.ts` o el script SQL consolidado proporcionado durante el desarrollo. Asegúrate de crear todas las tablas:
    *   `users`
    *   `roles`
    *   `permissions`
    *   `role_permissions`
    *   `contacts`
    *   `purchase_orders`
    *   `purchase_order_items`
    *   `sale_orders`
    *   `sale_order_items`
    *   `expenses`
    *   `inventory_items`
    *   `chart_of_accounts`
    *   `journal_entries`
    *   `company_info`
    *   `security_settings`
    *   `notification_settings`

3.  **Poblar Datos Iniciales (Seed):**
    *   Inserta los roles básicos (`Administrador`, `Contador`, etc.) en la tabla `roles`.
    *   Inserta los permisos detallados en la tabla `permissions`.
    *   Crea un usuario administrador inicial y asigna todos los permisos al rol `Administrador` usando el script de seed proporcionado, **asegurándote de hashear la contraseña del administrador con bcrypt**.

## 📜 Scripts Disponibles

En el directorio del proyecto, puedes ejecutar varios scripts:

*   `npm run dev` o `yarn dev`: Inicia la aplicación Next.js en modo de desarrollo.
*   `npm run build` o `yarn build`: Compila la aplicación para producción.
*   `npm run start` o `yarn start`: Inicia un servidor de producción de Next.js (después de compilar).
*   `npm run lint` o `yarn lint`: Ejecuta ESLint para analizar el código.
*   `npm run typecheck` o `yarn typecheck`: Ejecuta el compilador de TypeScript para verificar tipos.
*   `npm run genkit:dev` o `yarn genkit:dev`: Inicia el servidor de desarrollo de Genkit.
*   `npm run genkit:watch` o `yarn genkit:watch`: Inicia el servidor de desarrollo de Genkit con recarga automática.

## 🤝 Contribución

Las contribuciones son bienvenidas. Si deseas colaborar, por favor sigue estos pasos:

1.  Haz un Fork del repositorio.
2.  Crea una nueva rama para tu característica o corrección (`git checkout -b feature/nueva-caracteristica` o `git checkout -b fix/error-especifico`).
3.  Realiza tus cambios y haz commit (`git commit -m 'Añade nueva característica X'`).
4.  Empuja tus cambios a tu rama (`git push origin feature/nueva-caracteristica`).
5.  Abre un Pull Request hacia la rama principal del repositorio original.

Por favor, asegúrate de que tu código siga las guías de estilo del proyecto y de que todas las pruebas (si las hay) pasen.

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT. Consulta el archivo `LICENSE` para más detalles (si existe).

---

¡Esperamos que esta documentación te sea útil! Si tienes alguna pregunta o sugerencia, no dudes en abrir un Issue.
