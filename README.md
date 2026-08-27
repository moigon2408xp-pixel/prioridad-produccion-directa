# Prioridad Producción — versión instalable y autónoma

Esta carpeta se publica como una **aplicación web instalable**. El equipo puede abrirla desde un enlace, pulsar «Instalar aplicación» en Chrome/Edge o «Añadir a pantalla principal» en Android, y trabajar con los pedidos que se guardan directamente en la hoja `Pedidos` de Google Sheets.

> La copia del código se conserva en GitHub, pero la publicación recomendada se realiza mediante Cloudflare Pages. Esto añade una pequeña función gratuita que protege las claves privadas y evita que el navegador se comunique directamente con Apps Script, una comunicación que puede estar restringida por la política de seguridad del navegador.

## Qué se necesita

| Cuenta o herramienta | Propósito | Costo inicial |
|---|---|---:|
| Cuenta de Google con acceso al libro | Conserva pedidos, cálculos y dashboard. | Gratuito |
| Cuenta de GitHub | Guarda una copia administrable del código. | Gratuito |
| Cuenta de Cloudflare | Publica la aplicación y guarda las claves privadas. | Gratuito para un equipo pequeño |

## Primera configuración

### 1. Preparar Google Apps Script

Abre el archivo de Apps Script del libro. Si anteriormente añadiste un bloque de sincronización que contiene `doGet()` y `doPost()`, elimina solo esas dos funciones; el núcleo original de `Código.gs` se conserva. Después pega el contenido de `APPS_SCRIPT_PWA_BRIDGE.gs` al final y guarda.

Ejecuta `configurarPwaAutonoma()` una vez desde el editor. El cuadro emergente mostrará dos valores privados:

| Valor mostrado | Variable privada que se configurará después |
|---|---|
| `APPS_SCRIPT_SECRET` | `APPS_SCRIPT_SECRET` |
| `TEAM_ACCESS_CODE` | `TEAM_ACCESS_CODE` |

Publica el script mediante **Implementar → Nueva implementación → Aplicación web**. Debe ejecutarse como la propietaria del libro y permitir acceso a quienes usen la aplicación. Copia la URL que termina en `/exec`; se usará como `APPS_SCRIPT_URL`.

### 2. Publicar una copia bajo tu control

1. Crea un repositorio nuevo en GitHub, por ejemplo `prioridad-produccion`.
2. Sube **el contenido de esta carpeta**, incluyendo `functions/`, `icons/` y todos los archivos visibles.
3. Crea una cuenta gratuita en Cloudflare. En **Workers & Pages → Create application → Pages → Connect to Git**, conecta ese repositorio. Selecciona la rama `main`, sin comando de compilación y con directorio de salida `/`.
4. En el proyecto creado, abre **Settings → Environment variables** y crea estas tres variables de tipo secreto:

```text
APPS_SCRIPT_URL = URL terminada en /exec de Apps Script
APPS_SCRIPT_SECRET = valor mostrado por configurarPwaAutonoma()
TEAM_ACCESS_CODE = valor mostrado por configurarPwaAutonoma()
```

5. Ejecuta un nuevo despliegue. Cloudflare proporcionará un enlace `*.pages.dev` que pertenece a tu cuenta. Cada cambio enviado al repositorio podrá publicarse desde allí.

## Uso diario

La primera vez, cada persona abre el enlace y escribe el **código del equipo**. Después selecciona su nombre en Ajustes. Puede consultar su cola, marcar pedidos en proceso/entregados/bloqueados, confirmar diseño/material y registrar notas. La administradora usa la pantalla **Equipo** para revisar casos críticos y distribuir la carga.

La aplicación necesita Internet para leer y guardar cambios. Si se cae la conexión, muestra la última cola guardada localmente y vuelve a sincronizar al pulsar actualizar.

## Instalación en los equipos

En Android, abre el enlace con Chrome y elige **Instalar aplicación** o **Añadir a pantalla principal**. En Windows/Mac, abre el enlace con Chrome o Edge y usa el icono de instalación de la barra de direcciones. La aplicación se abrirá como una ventana independiente, pero no es un archivo APK. Un APK propio puede prepararse como una segunda etapa.

## Seguridad y administración

Las tres variables se guardan solo en la configuración privada de Cloudflare; no se incluyen en este repositorio ni en el navegador. El código del equipo sirve para limitar el acceso práctico a personal autorizado. Cámbialo ejecutando de nuevo `configurarPwaAutonoma()` y actualizando las dos variables privadas relacionadas.

## Referencias

[1] [Aplicaciones web de Apps Script](https://developers.google.com/apps-script/guides/web)

[2] [Publicación desde Git en Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/git-integration/)

[3] [Límites del plan gratuito de Cloudflare Workers](https://developers.cloudflare.com/workers/platform/limits/)
