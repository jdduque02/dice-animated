# Spec: Física abierta, color heredado y caché de dados

## Objetivo

Que la tirada se sienta como lanzar dados sobre una mesa amplia y no dentro de una caja.
Además, que la app recuerde las preferencias del usuario entre sesiones:

- **R1. Espacio y física.** Los dados deben recorrer la mesa, frenar por fricción y
  rara vez tocar los bordes invisibles. Si tocan uno, deben amortiguar el golpe en vez
  de rebotar "como contra un vidrio".
- **R2. Color por defecto.** Un dado nuevo (botón "+ Dado") toma el **último color que el
  usuario eligió**, persistido entre sesiones. Hoy rota la paleta (`DIE_COLORS[dice.length % n]`).
- **R3. Caché de cantidad.** Al abrir la app se restaura la **última cantidad de dados** usada.

Usuario: quien usa la app en Android (principal) o en web (`expo start --web`).

### Diagnóstico actual (por qué se siente caja)

| Síntoma | Causa en el código |
|---|---|
| Área muy pequeña | `PLAY_HALF_X = 1.83` → ~3.7 dados de ancho (`src/physics/playArea.ts`) |
| Cámara cerrada | Bounds fijos calculados para el teléfono **más angosto**; en pantallas más anchas el área no crece (`Scene.tsx` camera `[0,10,2]`, fov 50) |
| Rebotan en paredes | Paredes `CANNON.Plane` rígidas con el mismo material global (restitution 0.4) que dado-dado (`Walls.tsx`, `world.ts`) |
| Movimiento rígido | `roll()` deja caer el dado casi en su sitio (vel. horizontal ±1.25) con giro alto (±9 rad/s): gira sin desplazarse; un único material para todo (`Die.tsx`) |

## Supuestos (corrígeme si alguno es falso)

1. **"localStorage" en Android no existe.** En web se usa `localStorage`; en nativo se usa
   `expo-file-system` (ya instalado, sin dependencias nuevas): un JSON en el directorio de documentos.
2. Se persisten solo **cantidad** y **último color**. Los dados restaurados son `d6` con
   caras numéricas y el último color. No se persisten tipo, nombre, iconos ni fotos (las URIs
   de fotos pueden quedar inválidas).
3. "Último color usado" = el último color elegido en `DieConfigModal`. Si nunca se eligió
   ninguno, se usa `DIE_COLORS[0]`.
4. Los dados pueden verse **un poco más pequeños** en pantalla a cambio de más espacio
   (cámara más alta o dados a menor escala). Ese es el trade-off para ganar espacio.
5. Las paredes invisibles se mantienen (sin ellas los dados se salen del encuadre), pero
   se ubican en el borde **real** del viewport y con material amortiguado.

## Requisitos y criterios de aceptación

### R1. Espacio y física

- R1.1 Los límites del área se calculan **en tiempo de ejecución** a partir del tamaño
  real del canvas (aspect ratio) y la cámara, no con constantes del teléfono más angosto.
  Se recalculan al cambiar el tamaño (rotación o ventana web).
- R1.2 El ancho útil del área (eje X) es **≥ 6 diámetros de dado** en un teléfono vertical
  típico (aspect ~0.45). Hoy es ~3.7.
- R1.3 Materiales separados (`CANNON.ContactMaterial`):
  - dado–suelo: fricción alta, rebote bajo (frena como sobre fieltro o madera);
  - dado–pared: rebote bajo (≤ 0.15), para que el borde absorba el golpe;
  - dado–dado: se conserva el comportamiento actual (no se traban).
- R1.4 Lanzamiento con trayectoria: cada dado parte de una zona de lanzamiento y recibe
  velocidad horizontal hacia el interior de la mesa, con giro proporcional. Se debe ver
  que **rueda y se desplaza**, no que cae en el mismo sitio.
- R1.5 Con 1 dado, en ≥ 70 % de las tiradas el dado **no toca ninguna pared**
  (medido en la simulación headless, ver Testing).
- R1.6 Con 6 dados, todos quedan en reposo dentro del área en ≤ 3.5 s en ≥ 90 % de las
  tiradas, sin dados montados ni atascados contra la pared.
- R1.7 Cada dado se desplaza en promedio ≥ 2 diámetros desde el contacto inicial hasta el reposo (≥ 1.5 en ventana ancha, aspect ≥ 1, por su poca profundidad).
- R1.8 Ningún dado queda fuera del encuadre visible en reposo (en ninguna tirada simulada).

### R2. Color por defecto

- R2.1 Al elegir un color en el modal, ese color se guarda como `lastColor` (persistido).
- R2.2 "+ Dado" crea el dado con `lastColor`.
- R2.3 Al reiniciar la app, R2.2 se mantiene con el color guardado.

### R3. Caché de cantidad

- R3.1 Cada cambio en la cantidad de dados (agregar o quitar) persiste `count`.
- R3.2 Al iniciar, se crean `count` dados (`d6`, numbers, `lastColor`). Sin caché → 1 dado.
- R3.3 Un valor corrupto o fuera de rango se ignora y se usa el default (1). Se aplica un
  tope de `count` en 1..20 para no reventar la física con un valor inválido.
- R3.4 Mientras la caché carga no hay parpadeo de "1 dado → N dados" visible (se espera la
  lectura antes de montar los dados, o la lectura es síncrona en web).

## Tech Stack

Expo SDK 57, React Native 0.86, React 19.2, `@react-three/fiber` 9, three 0.185,
`cannon-es` 0.20, `expo-file-system` 57 (para persistir en nativo). TypeScript 6. Gestor: **pnpm**.
Antes de usar APIs de Expo, consultar https://docs.expo.dev/versions/v57.0.0/ (ver `AGENTS.md`).

## Commands

```
Dev (Android):  pnpm android
Dev (web):      pnpm web
Typecheck:      pnpm exec tsc --noEmit
Sim física:     node scripts/simRolls.ts     (nuevo; Node 24 ejecuta .ts nativo)
Check prefs:    node scripts/checkPrefs.ts   (nuevo)
```

## Project Structure (archivos que se tocan)

```
src/physics/playArea.ts   → de constantes fijas a función bounds(aspect, camera)
src/physics/world.ts      → materiales dado/suelo/pared + ContactMaterials
src/components/Walls.tsx  → paredes con material de pared, reposicionadas según bounds
src/components/Ground.tsx → material de suelo
src/components/Scene.tsx  → cámara y bounds desde useThree().size
src/physics/throw.ts      → NUEVO: lógica pura de lanzamiento (la usan Die.tsx y la sim)
src/dice/Die.tsx          → roll() delega en throw.ts; spawn usando bounds dinámicos
src/storage/prefsCodec.ts → NUEVO: parse/serialize puros de {count, lastColor}
src/storage/prefs.ts      → NUEVO: loadPrefs()/savePrefs() (web: localStorage, nativo: expo-file-system)
App.tsx                   → estado inicial desde prefs; addDie usa lastColor; persistir cambios
scripts/simRolls.ts       → NUEVO: simulación headless de N tiradas que verifica R1.5–R1.8
scripts/checkPrefs.ts     → NUEVO: asserts del codec (R3.3)
```

## Code Style

Seguir el estilo existente: componentes funcionales, `forwardRef` + `useImperativeHandle`
para handles, constantes `UPPER_SNAKE` al inicio del archivo y comentarios que explican el
**por qué** del número elegido (como en `playArea.ts` y `world.ts`). Strings de UI en español.

```ts
// Dado–pared: el borde absorbe el golpe en vez de devolverlo — un rebote alto aquí
// es justo lo que hace que la mesa "se sienta caja".
const DIE_WALL = new CANNON.ContactMaterial(dieMat, wallMat, { friction: 0.2, restitution: 0.1 });
```

## Testing Strategy

El proyecto no tiene framework de tests y no se agrega uno.

- **Física (R1.5–R1.8):** `scripts/simRolls.ts` crea el mismo `World` (importa
  `createPhysicsWorld`, bounds y la lógica de lanzamiento), simula 200 tiradas con 1 y con 6
  dados a 60 Hz y hace `assert` sobre: % de tiradas sin contacto con pared, tiempo hasta
  reposo, desplazamiento medio y posición final dentro de bounds. Sale con código ≠ 0 si
  falla. Para eso la lógica de lanzamiento se extrae a una función pura reutilizable.
- **Prefs (R3.3):** `scripts/checkPrefs.ts` con `assert`s sobre el codec
  (JSON corrupto → default; count fuera de rango → acotado).
- **Typecheck:** `node_modules/.bin/tsc --noEmit` sin errores.
- **Manual en dispositivo (feel):** Android y web. 10 tiradas con 1, 3 y 6 dados; rotar o
  redimensionar; agregar un dado tras cambiar el color; cerrar y reabrir la app.

## Boundaries

- **Always:** usar pnpm; mantener los comentarios del "por qué" de cada constante física;
  correr `tsc` y `simRolls` antes de dar por terminada una tarea.
- **Ask first:** agregar dependencias (p. ej. AsyncStorage); hacer visibles las paredes o el
  borde de la mesa; cambiar el tamaño del modelo de los dados (geometría); persistir más que `count` y `lastColor`.
- **Never:** quitar las paredes (los dados se saldrían del encuadre); cambiar la lógica de
  lectura de cara (`readDieValue`); hacer commit sin pedirlo.

## Success Criteria

1. `simRolls` pasa: R1.5 (≥ 70 % sin pared, 1 dado), R1.6 (reposo ≤ 3.5 s, ≥ 90 %, 6 dados),
   R1.7 (≥ 2 diámetros; ≥ 1.5 en ventana ancha), R1.8 (0 dados fuera del encuadre).
2. En el teléfono vertical el área mide ≥ 6 dados de ancho (R1.2), y en web panorámico crece con la ventana.
3. Tras cambiar el color de un dado a rojo, "+ Dado" crea uno rojo, también después de reiniciar la app.
4. Con 4 dados, al cerrar y abrir la app aparecen 4 dados.
5. `node_modules/.bin/tsc --noEmit` sin errores.

## Orden de implementación

R3 + R2 (prefs, pequeño e independiente) → R1 (física, iterativo con `simRolls`).

## Decisiones (antes preguntas abiertas, resueltas 2026-10-20)

1. Dados más pequeños en pantalla: **aceptado** (cámara más alta).
2. Persistencia: **solo cantidad** (+ `lastColor` de R2). El tipo no se persiste.
3. Borde de mesa: **invisible**.
