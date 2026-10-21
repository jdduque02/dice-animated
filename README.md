# Dados Animados

App de Expo/React Native con dados 3D físicos (react-three-fiber + cannon-es).

## Desarrollo

```bash
pnpm install
pnpm exec expo start --dev-client
```

Este proyecto usa módulos nativos (three.js/expo-gl, cannon-es, expo-image-picker con
configuración propia), así que **no funciona en la app genérica Expo Go** — se cierra
sola sin mostrar error. Hace falta un Dev Client propio (ver perfil `development` abajo)
o instalar el APK de `preview`/`production`.

## Generar el instalador (APK) y descargarlo

El build corre en la nube de Expo (EAS Build), no localmente — no hace falta Android
Studio ni el SDK de Android instalados.

1. Inicia sesión una vez (si no lo has hecho):

   ```bash
   pnpm dlx eas-cli login
   ```

2. Lanza el build (perfil `preview`, genera un `.apk` instalable directo, no un `.aab`):

   ```bash
   pnpm dlx eas-cli build --profile preview --platform android --non-interactive
   ```

3. La terminal imprime un link tipo
   `https://expo.dev/accounts/<cuenta>/projects/dados-animados/builds/<id>` en cuanto
   termina de subir el proyecto — el build en sí tarda unos minutos más en la cola de
   EAS ("Waiting for build to complete" es normal, no un error).
4. Cuando termina, la terminal muestra un código QR y el mismo link de arriba con:
   `🤖 Open this link on your Android devices (or scan the QR code) to install the app`.
5. **Para instalar**: abre ese link desde el navegador del celular Android (o escanea
   el QR), descarga el `.apk` y ábrelo. Android va a pedir permitir "instalar apps de
   fuentes desconocidas" la primera vez — hay que aceptarlo.

### Revisar un build sin esperar en la terminal

Si cierras la terminal o quieres ver el estado más tarde:

```bash
pnpm dlx eas-cli build:list --limit 5          # últimos builds y sus IDs
pnpm dlx eas-cli build:view <id>               # estado + link de descarga de uno específico
pnpm dlx eas-cli build:cancel <id>             # cancelar uno en cola/progreso
```

### Perfiles de build (`eas.json`)

| Perfil | Uso | Comando |
| --- | --- | --- |
| `development` | Dev Client con recarga en vivo, para seguir programando | `pnpm dlx eas-cli build --profile development --platform android` |
| `preview` | `.apk` instalable directo, para probar/compartir sin Play Store | `pnpm dlx eas-cli build --profile preview --platform android` |
| `production` | `.aab` para subir a Google Play (no instalable directo en un teléfono) | `pnpm dlx eas-cli build --profile production --platform android` |

Para uso personal/pruebas, `preview` es el que se quiere casi siempre — es el único que
genera un `.apk` (los otros generan Dev Client o `.aab`, que no se instalan con un tap).

## Notas

- Todos los comandos de este proyecto usan `pnpm` (no `npm`/`npx`).
- Si mueves o renombras la carpeta del proyecto, los symlinks de `pnpm` en
  `node_modules` quedan rotos (apuntan a la ruta vieja). Arreglo:

  ```bash
  rm -rf node_modules
  pnpm install
  ```
