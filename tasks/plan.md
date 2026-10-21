# Implementation Plan: Física abierta, color heredado y caché de dados

Spec: [`SPEC.md`](../SPEC.md). Tareas: [`tasks/todo.md`](todo.md).

## Overview

Hay dos frentes independientes:
1. **Prefs (R2 + R3):** persistir `{count, lastColor}` y usarlos al arrancar y en "+ Dado".
   Es pequeño y de bajo riesgo, y se hace primero.
2. **Física (R1):** área dinámica según el viewport, cámara más alta, materiales separados y
   lanzamiento con trayectoria. Se ajusta con una simulación headless que mide las metas del spec.

## Architecture Decisions

- **Persistencia síncrona.** En nativo, `expo-file-system` v57 tiene `new File(Paths.document,
  'prefs.json')` con `.exists`, `.textSync()` y `.write(str)` síncronos. En web se usa
  `localStorage`. Al ser síncrona, el estado inicial de `App` se lee en el inicializador de
  `useState`: no hay parpadeo de 1 → N dados (R3.4) ni estado de "cargando". Sin dependencias nuevas.
- **Codec puro aparte** (`prefsCodec.ts`, sin imports): permite probar R3.3 en Node sin cargar
  `expo-file-system` ni `react-native`.
- **Módulos de física "hoja"** (`world.ts`, `playArea.ts`, `throw.ts`): solo importan `cannon-es`
  o nada, y **no tienen imports relativos**. Así `node scripts/simRolls.ts` los importa
  directo (Node 24 elimina los tipos, pero no resuelve imports relativos sin extensión). Los
  bounds se pasan como argumento en vez de importarse.
- **Bounds rectangulares calculados desde el frustum.** Se intersectan los rayos de las esquinas
  del frustum con el plano `y = altura del dado` (no con el suelo), para que la cara superior de
  un dado en el borde siga visible. Se usa el rectángulo inscrito en el trapecio resultante,
  menos un margen de un radio del dado. Resultado `{minX, maxX, minZ, maxZ}`: el área no está
  centrada en Z porque la cámara está inclinada. Se descartaron las paredes trapezoidales: ganan
  las cuñas del fondo a cambio de normales oblicuas. Se dejan para más adelante si hace falta.
- **Cámara más alta, misma inclinación.** La altura `CAMERA_HEIGHT` es la perilla que da el ancho
  ≥ 6 dados con aspect 0.45 (R1.2). La estimación inicial es ~17 (hoy 10); se confirma con la sim.
  La malla del suelo pasa de 20×20 a 80×80 para que su borde no entre en el encuadre.
- **Tres materiales** (`die`, `ground`, `wall`) con `ContactMaterial` explícitos en `world.ts`;
  dado–dado conserva fricción 0.15 y rebote 0.4. `createPhysicsWorld()` devuelve
  `{ world, materials }`.
- **Las constantes de "feel" son perillas.** Fricción, rebote, damping, velocidad y giro de
  lanzamiento y `CAMERA_HEIGHT` viven como `UPPER_SNAKE` comentadas. Si la sim pasa pero en el
  dispositivo se siente mal, se ajustan ahí sin rediseñar.

## Dependency Graph

```
prefsCodec.ts ─→ prefs.ts ─→ App.tsx                       (Fase 1, independiente)

throw.ts ─┬─→ Die.tsx
          └─→ simRolls.ts ←─ world.ts, playArea.ts         (Fase 2 → 3 → 4)
playArea.ts ─→ Scene.tsx ─→ Walls.tsx, Die.tsx
world.ts (materials) ─→ Ground.tsx, Walls.tsx, Die.tsx
```

Las fases 1 y 2 a 4 no comparten archivos (excepto `App.tsx`, que solo toca la Fase 1) y
podrían ir en paralelo. Son pocas tareas pequeñas, así que se hacen en serie.

## Task List

### Fase 1: Prefs (R2 + R3)
- [x] Task 1: Codec + storage de prefs, cableado en App

### Checkpoint 1
- [ ] `node scripts/checkPrefs.ts` y `node_modules/.bin/tsc --noEmit` pasan
- [ ] Manual (web y Android): color → "+ Dado" hereda; reabrir restaura cantidad y color

### Fase 2: Arnés de medición (primero lo de mayor riesgo: sin medición no hay tuning)
- [x] Task 2: Extraer lanzamiento a `throw.ts` + `simRolls.ts` con métricas base

### Fase 3: Espacio
- [x] Task 3: Bounds dinámicos desde el viewport + cámara más alta

### Checkpoint 2
- [ ] Sim: R1.2 y R1.8 pasan en aspect 0.45 y 1.8; tsc limpio
- [ ] Manual: el área llena la pantalla en el teléfono y en la ventana web; rotar o redimensionar recalcula

### Fase 4: Feel
- [x] Task 4: Materiales dado/suelo/pared
- [x] Task 5: Lanzamiento con trayectoria + tuning hasta pasar R1.5–R1.7

### Checkpoint final
- [ ] `simRolls`, `checkPrefs` y `tsc` pasan
- [ ] Manual en Android: 10 tiradas con 1, 3 y 6 dados; no se siente caja
- [ ] Revisión con el usuario

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| La sim (dt fijo 1/60) diverge del dispositivo (`step(1/60, delta, 3)`) | Med | Mismo `fixedTimeStep`; la sim es la red de seguridad y el feel final se valida a mano |
| La forma del d6 en la sim (`CANNON.Box` 0.5) difiere del convex real | Low | El d6 real ya es un Box de half 0.5 (`BOX_HALF`); el resto de tipos se valida a mano |
| R3F no apunta la cámara a (0,0,0) como asume el cálculo de bounds | Med | En la Task 3 se verifica con `camera.lookAt` explícito en `Scene.tsx` |
| `localStorage` o `File` lanzan excepción (modo privado, disco) | Low | try/catch en load y save → defaults, nunca crash |
| Dados más pequeños se leen peor en teléfonos chicos | Med | `CAMERA_HEIGHT` como perilla; se valida en el Checkpoint 2 |
| Un tuning de materiales que pasa la sim se siente "flotante" en mano | Med | Constantes comentadas; una iteración manual incluida en la Task 5 |

## Open Questions

Ninguna bloqueante. Las tres del spec quedaron resueltas.
