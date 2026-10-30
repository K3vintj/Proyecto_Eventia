# Guía de trabajo — Eventia

Repositorio: https://github.com/K3vintj/Proyecto_Eventia  
Tablero: **Eventia-Desarrollo** (Issues EVT-01 a EVT-19)

## Cómo trabajamos

| Rama | Uso |
|---|---|
| `main` | Versión estable. No se trabaja directo aquí. |
| `develop` | Integración del equipo. Base de todo el trabajo. |
| `feat/nombre` | Cada funcionalidad nueva. |

Flujo: actualizas `develop` → creas tu rama `feat/...` → haces commits → subes la rama → abres Pull Request hacia `develop`.

## Primeros pasos

1. Clona el repo en Cursor.
2. Entra a `develop` y actualiza:
   ```powershell
   git switch develop
   git pull --ff-only origin develop
   ```
3. Crea tu rama:
   ```powershell
   git switch -c feat/nombre-corto
   ```
4. Al terminar, publica y abre un PR a `develop`:
   ```powershell
   git push -u origin feat/nombre-corto
   ```

## Reglas

- No hagas `git push --force`.
- No subas `.env`, `node_modules` ni `server/mysql-data`.
- No asignes Issues a la fuerza: tomamos tareas del tablero con flexibilidad.
- Mueve tu Issue: **Pendiente → En desarrollo → En revisión → Terminado**.

## Cursor y el código

- Pueden preguntarle a Cursor sobre el código del proyecto abierto.
- Si alguien subió cambios, hay que bajarlos antes (`git pull` / Sync). Cursor no ve lo nuevo hasta sincronizar.
- También puede consultar Issues y el tablero en GitHub para ver qué falta.

## Tareas

Las pendientes están en GitHub Issues y en el proyecto **Eventia-Desarrollo**.  
Prioridad alta primero: cotizaciones del proveedor, contrataciones, navegación/botones, locación, fotografía y bloqueo de aceptación sin cotización formal.

## Dudas rápidas

- ¿Dónde trabajo? En una rama `feat/...` desde `develop`.
- ¿A dónde va el PR? A `develop`.
- ¿Cómo sé qué falta? En el tablero **Eventia-Desarrollo**.
