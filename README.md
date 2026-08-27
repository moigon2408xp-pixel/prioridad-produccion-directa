# Prioridad Producción — publicación directa desde GitHub

Esta es la alternativa gratuita que no usa Cloudflare. La aplicación se publica desde **GitHub Pages** y consulta/actualiza la hoja `Pedidos` mediante una aplicación web de Apps Script.

> Esta versión se instala desde el navegador en Android y en PC. No genera un APK, pero se abre como una aplicación independiente después de instalarla.

## Antes de empezar

Debes tener acceso de edición al libro de Google Sheets y una cuenta de GitHub. Para usar GitHub Pages sin costo con esta ruta, crea un repositorio **público**. El código público no contiene el código del equipo ni contraseñas; solo incluirá la URL pública de Apps Script.

## 1. Configurar el libro

1. En Google Sheets, abre **Extensiones → Apps Script**.
2. Si tienes bloques anteriores de sincronización, elimina solamente las funciones duplicadas llamadas `doGet()` y `doPost()`. Debe quedar **una sola** función `doGet()` al final.
3. Copia todo el contenido de `APPS_SCRIPT_GITHUB_DIRECTO.gs` y pégalo al final de `Código.gs`.
4. Guarda y ejecuta una vez `configurarPwaGitHub()` desde el editor. Se mostrará un **código de seis dígitos**. Guárdalo y compártelo solo con el equipo.
5. Pulsa **Implementar → Nueva implementación → Aplicación web**. Configúrala para ejecutarse como la persona propietaria del libro y permitir el acceso a quienes usarán la aplicación. Copia la URL final que termina en `/exec`.

## 2. Configurar la aplicación

Abre el archivo `config.js` y cambia solo esta línea:

```js
window.PRIORIDAD_CONFIG = { appsScriptUrl: "PEGAR_AQUI_LA_URL_DE_APPS_SCRIPT_EXEC" };
```

Pega dentro de las comillas la URL de Apps Script terminada en `/exec` y guarda el archivo. No hay otra clave que pegar en este archivo.

## 3. Publicar con GitHub Pages

1. Crea un repositorio nuevo llamado `prioridad-produccion-directa` y elige **Public**.
2. Sube el contenido completo de esta carpeta, incluyendo `index.html`, `app.js`, `config.js`, `styles.css`, `sw.js`, `manifest.webmanifest` y `icons/`.
3. En ese repositorio, entra a **Settings → Pages**.
4. En **Build and deployment**, elige **Deploy from a branch**.
5. Selecciona la rama `main`, la carpeta `/(root)` y pulsa **Save**.
6. Espera a que GitHub muestre una dirección similar a:

```text
https://TU-USUARIO.github.io/prioridad-produccion-directa/
```

## 4. Instalarla

En Android, abre ese enlace con Chrome, pulsa el menú de tres puntos y elige **Instalar aplicación** o **Añadir a pantalla principal**. En Windows/Mac, ábrela con Chrome o Edge y usa el icono de instalación de la barra de direcciones.

La primera vez, cada persona escribe el código de seis dígitos creado en Apps Script y, en **Ajustes**, selecciona su nombre para ver su cola.

## Límites de esta alternativa

La aplicación funciona con Internet y guarda localmente la última cola consultada para poder verla si se cae la conexión. Los cambios se guardan en Google Sheets al confirmarlos. El código de seis dígitos es una barrera práctica de acceso para el equipo, no un sistema de cuentas individuales; si más adelante se necesita control por usuario o notificaciones push seguras, se puede añadir una segunda fase con un backend propio.

## Referencias

[1] [Aplicaciones web de Apps Script](https://developers.google.com/apps-script/guides/web)

[2] [Qué es GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
