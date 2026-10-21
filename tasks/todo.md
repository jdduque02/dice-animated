# Tareas — Física abierta, color heredado y caché

Plan: [`plan.md`](plan.md). Spec: [`../SPEC.md`](../SPEC.md).

## Task 1: Codec + storage de prefs, cableado en App (R2, R3)

**Descripción:** guardar `{count, lastColor}` y usarlos al arrancar y en "+ Dado".

**Acceptance criteria:**
- [ ] Elegir un color en el modal guarda `lastColor`; "+ Dado" lo usa (R2.1–R2.3)
- [ ] Agregar o quitar dados guarda `count`; al arrancar se crean `count` d6 con `lastColor` (R3.1, R3.2)
- [ ] JSON corrupto, `count` fuera de 1..20 o color no hex → default o acotado; errores de I/O no crashean (R3.3)

**Verificación:**
- [ ] `node scripts/checkPrefs.ts` (asserts: corrupto, vacío, count 0/99/"x", color inválido, round-trip)
- [ ] `node_modules/.bin/tsc --noEmit`
- [ ] Manual web (`pnpm web`) y Android (`pnpm android`): cambiar color → "+ Dado"; 4 dados → reabrir

**Dependencias:** ninguna

**Archivos:** `src/storage/prefsCodec.ts` (nuevo), `src/storage/prefs.ts` (nuevo), `App.tsx`, `scripts/checkPrefs.ts` (nuevo)

**Tamaño:** M (4 archivos, lógica simple)

---

## Checkpoint 1
- [ ] checkPrefs + tsc pasan; flujo manual OK → seguir

---

## Task 2 ✅: Extraer lanzamiento a `throw.ts` + arnés `simRolls.ts`

**Descripción:** mover a una función pura la lógica de spawn y `roll()` de `Die.tsx`
(`spreadX`, posición, rotación, velocidades, más `isAtRest`), parametrizada por bounds e índice.
Crear la sim headless que reporta métricas. Esta tarea **no cambia el comportamiento**.

**Acceptance criteria:**
- [ ] `Die.tsx` usa `throw.ts`; la tirada se ve igual que antes
- [ ] `node scripts/simRolls.ts` corre 200 tiradas × {1, 6} dados e imprime: % sin contacto con pared,
      p95 del tiempo a reposo, desplazamiento medio en diámetros, dados fuera de bounds y ancho en diámetros
- [ ] Los asserts de R1.2 y R1.5–R1.8 están escritos; pueden **fallar** en esta tarea (registrar la línea base aquí)

**Verificación:**
- [ ] `node scripts/simRolls.ts` corre sin errores de import
- [ ] `node_modules/.bin/tsc --noEmit`
- [ ] Manual: tirada idéntica a la actual

**Dependencias:** ninguna

**Archivos:** `src/physics/throw.ts` (nuevo), `src/dice/Die.tsx`, `scripts/simRolls.ts` (nuevo), `src/physics/playArea.ts` (sacar imports relativos si hace falta)

**Tamaño:** M

**Línea base (medida):** R1.2 ancho 3.7 diám · R1.5 sin pared 0 % · R1.6 reposo ≤3.5 s 81 % (p95 4.05 s) · R1.7 desplazamiento 0.90 (1 dado) / 0.51 (6 dados) · R1.8 0 fuera.
Hallazgo: con 1 dado el 0 % sin pared es real, no un fallo de la sim: `spreadX(0)` coloca el primer dado en x ≈ -1.52 (slot -2 de 5), y la pared está en ±1.83, así que el dado nace tocándola. Corregir en la Task 5 centrando el reparto según la cantidad de dados.

---

## Task 3 ✅: Bounds dinámicos desde el viewport + cámara más alta (R1.1, R1.2, R1.8)

**Descripción:** `playArea.ts` exporta `computePlayBounds(aspect, cameraHeight, fov)`, que devuelve
`{minX, maxX, minZ, maxZ}` intersectando el frustum con el plano `y = altura del dado`, con un margen
de un radio. `Scene.tsx` lee `useThree(s => s.size)`, calcula los bounds y los pasa a `Walls` y `Die`.
Se sube `CAMERA_HEIGHT` y la malla de `Ground` pasa a 80×80. Se fija `camera.lookAt(0,0,0)` de forma explícita.

**Acceptance criteria:**
- [ ] Ancho ≥ 6 diámetros con aspect 0.45 (R1.2)
- [ ] Las paredes se reposicionan al rotar o redimensionar, sin recrear los dados (R1.1)
- [ ] Sim con aspect 0.45 y 1.8: 0 dados fuera de bounds (R1.8)

**Verificación:**
- [ ] `node scripts/simRolls.ts` (asserts R1.2, R1.8)
- [ ] `node_modules/.bin/tsc --noEmit`
- [ ] Manual: teléfono vertical + ventana web panorámica; ningún dado se corta en el borde

**Dependencias:** Task 2

**Archivos:** `src/physics/playArea.ts`, `src/components/Scene.tsx`, `src/components/Walls.tsx`, `src/components/Ground.tsx`, `src/dice/Die.tsx`

**Tamaño:** M (5 archivos, cambios cortos)

---

## Checkpoint 2
- [ ] R1.2 y R1.8 en verde; manual del área OK; revisar con el usuario el tamaño visual de los dados

---

## Task 4 ✅: Materiales dado / suelo / pared (R1.3)

**Descripción:** `createPhysicsWorld()` devuelve `{ world, materials }` con tres `CANNON.Material`
y sus `ContactMaterial`: dado–suelo con fricción alta y rebote bajo; dado–pared con rebote ≤ 0.15;
dado–dado conserva fricción 0.15 y rebote 0.4. Se asignan en `Ground`, `Walls` y `Die`; la sim usa lo mismo.

**Acceptance criteria:**
- [ ] Los tres contactos tienen valores explícitos y comentados
- [ ] La sim muestra menos rebote tras tocar pared que la línea base

**Verificación:**
- [ ] `node scripts/simRolls.ts` (comparar con la línea base)
- [ ] `node_modules/.bin/tsc --noEmit`

**Dependencias:** Task 3

**Archivos:** `src/physics/world.ts`, `src/components/Scene.tsx`, `src/components/Ground.tsx`, `src/components/Walls.tsx`, `src/dice/Die.tsx`

**Tamaño:** S–M

---

## Task 5 ✅: Lanzamiento con trayectoria + tuning (R1.4–R1.7)

**Descripción:** en `throw.ts`, cada dado parte de una franja de lanzamiento (lado cercano a la
cámara) con velocidad horizontal hacia el interior, dispersión angular y giro proporcional a la
velocidad. Ajustar fricción, damping y velocidades hasta que la sim pase.

**Acceptance criteria:**
- [ ] 1 dado: ≥ 70 % de tiradas sin tocar pared (R1.5)
- [ ] 6 dados: reposo ≤ 3.5 s en ≥ 95 %, sin atascos (R1.6)
- [ ] Desplazamiento medio ≥ 2 diámetros (R1.7)

**Verificación:**
- [ ] `node scripts/simRolls.ts` pasa todos los asserts
- [ ] `node_modules/.bin/tsc --noEmit`
- [ ] Manual Android: 10 tiradas con 1, 3 y 6 dados; una iteración de ajuste si se siente flotante o rígido

**Dependencias:** Task 4

**Archivos:** `src/physics/throw.ts`, `src/physics/world.ts`

**Tamaño:** S (pero iterativo)

---

## Checkpoint final
- [ ] `simRolls`, `checkPrefs` y `tsc` en verde
- [ ] Success Criteria 1–5 del spec cumplidos
- [ ] Revisión con el usuario

---

## Resultado Task 5 (sim, 200 tiradas)

Pasan: R1.2, R1.5 (100 % / 90 %), R1.8, R1.6 en aspect 1.8 (96 %), R1.7 en aspect 0.45 (2.22).
No pasan: **R1.6 en aspect 0.45** (92 %, p95 3.75 s, meta 95 % / 3.5 s) y **R1.7 en aspect 1.8** (1.69, meta 2).
Nota: R1.7 con 6 dados da ~1.2 (los choques frenan); el spec lo mide con 1 dado.
Conflicto observado: más recorrido pide más velocidad, y eso alarga el reposo (portrait) o llega a la pared (landscape, 7.6 de profundidad).
Hallazgo: `angularDamping`/`linearDamping` >= 1 hacen NaN en cannon-es; quedan < 1.

Actualización: R1.6 aflojado a 90 % y R1.7 a 1.5 en ventana ancha (aspect >= 1) por decisión del usuario; sim en verde (12/12).
