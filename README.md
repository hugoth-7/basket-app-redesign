# Banquillo · Control Basket 🏀

PWA instalable para gestionar minutos, faltas y notas en el banquillo. Vanilla HTML/CSS/JS, todo local (localStorage), offline con service worker. Sin backend, sin coste.

## Estructura
```
index.html · styles.css · app.js
manifest.webmanifest · sw.js · icons/
```

## Modelo de datos (localStorage)
- `bball.teams.v1`: `[{id, name, players:[{id,name,number}], createdAt}]`
- `bball.match.v1`: `{id, teamId, teamName, quarterLengthSec, quarter, clockRemainingMs, clockRunning, roster, onCourtIds[≤5], stats:{playerId:{seconds,fouls}}, oppNumbers[], oppFouls:{}, teamFouls:[por cuarto], notes:[{id,text,playerId,quarter,clock,createdAt}], status, startedAt, finishedAt}`

## Probar en local
```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

## Despliegue gratis (elige 1)

### Opción A · GitHub Pages (recomendada, 2 min)
1. Crea repo en GitHub (ej. `basket-app`), súbelo:
```bash
git init -b main && git add . && git commit -m "Banquillo PWA" && git remote add origin URL_DEL_REPO && git push -u origin main
```
2. En GitHub: Settings → Pages → Source: `main` / `/ (root)` → Save.
3. URL: `https://TU_USUARIO.github.io/basket-app/` — ábrela una vez con internet para que el SW cachee.

### Opción B · Netlify Drop
1. Ve a `app.netlify.com/drop`, arrastra la carpeta. Te da URL `https://....netlify.app`. Listo.

### Opción C · Vercel
```bash
npx vercel --prod
# acepta defaults; obtienes https://basket-app....vercel.app
```

> Importante: la URL debe ser **HTTPS** para instalar la PWA (GitHub/Netlify/Vercel ya lo son).

## Instalar en iPad / iPhone (Safari)
1. Abre la URL en Safari (no Chrome).
2. Compartir → **Añadir a pantalla de inicio** → Añadir.
3. Ábrela desde el icono: va a pantalla completa, sin barra del navegador.
4. Abre una vez con wifi en el pabellón; después funciona **offline**.

## Instalar en Android (Chrome)
1. Abre la URL en Chrome → ⋮ → **Añadir a pantalla de inicio** / **Instalar app**.
2. Funciona offline tras la primera carga.

## Uso en partido
1. **Equipos**: crea tu equipo una vez (nombre + dorsales). Persiste.
2. **Partido**: elige equipo, marca convocadas, añade dorsales rivales, duración de cuarto (def. 10).
3. **En vivo**: ▶ corre el crono y suma minutos solo a las 5 en pista. Toca tarjeta = pista/banquillo. `+F` suma falta (individual + equipo). Bono FIBA a las 4 de equipo (pastilla ★ BONO ★). Rival: +Falta por dorsal. Notas con timestamp de cuarto/reloj.
4. **Resumen**: tabla minutos/faltas, faltas rival, notas, botón copiar y nuevo partido (conserva equipos).
