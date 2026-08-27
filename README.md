# Prioridad Producción — perfiles personales

Esta versión añade espacios personales y tres perfiles: **manager**, **jefa** y **trabajador**. La información continúa viviendo en el libro de Google Sheets, por lo que se comparte entre todos los dispositivos.

## Instalación

1. En Apps Script, elimina únicamente el `doGet()` del bloque anterior de aplicación web e incorpora `APPS_SCRIPT_PERFILES.gs` al final de `Código.gs`.
2. Guarda, ejecuta `configurarPerfilesProduccion()` una vez y conserva el PIN que se muestre para el primer manager.
3. En **Implementar → Administrar implementaciones**, edita la aplicación web, elige una versión nueva y pulsa **Implementar**. La URL `/exec` no cambia si editas la misma implementación.
4. Pega esa URL en `config.js` de esta carpeta.
5. Sustituye el contenido del repositorio de GitHub Pages por los archivos de esta carpeta. GitHub publicará automáticamente la actualización desde `main`.

## Uso inicial

El primer acceso se realiza con **Nombre: `Manager`** y el PIN generado. En **Ajustes**, el manager crea los perfiles reales: su perfil personal de manager, la jefa y cada trabajador. Después debe desactivar el perfil genérico `Manager`.

La jefa puede registrar pedidos y asignarlos desde **Equipo**. Cada trabajador ve su cola personal y únicamente puede agregar avances o marcar diseño/material de sus propios pedidos. Los casos vencidos, bloqueados o con entrega inminente se siguen mostrando a todo el equipo.
