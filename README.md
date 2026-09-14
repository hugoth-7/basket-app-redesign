# Banquillo · Control Basket 🏀

PWA instalable para gestionar minutos, faltas y notas en el banquillo. Vanilla HTML/CSS/JS, todo local (localStorage), offline con service worker. Sin backend, sin coste.

## Estructura
```
index.html · styles.css · app.js
manifest.webmanifest · sw.js · icons/
```

## Modelo de datos (localStorage)
- `bball.teams.v1`: `[{id, name, players:[{id,name,number}], createdAt}]`
- `bball.match.v1`: `{id, teamId, teamName, quarterLengthSec, quarter, clockRemainingMs, clockRunning, roster, onCourtIds[≤5], stats:{playerId:{seconds,total,stint,fouls}}, oppNumbers[], oppFouls:{}, teamFouls:[por cuarto], oppTeamFouls:[por cuarto], possession, timeouts:{team,opp}, notes:[{id,text,playerId,quarter,clock,createdAt}], status, startedAt, finishedAt}`
- `bball.history.v1`: `[match1, match2, ...]` (partidos finalizados de la temporada)

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
1. **Equipos & Backup**: crea tu equipo una vez (nombre + dorsales). Exporta o restaura copias de seguridad en JSON para no perder nada (incluye histórico).
2. **Partido**: elige equipo, marca convocadas, añade dorsales rivales, duración de cuarto (def. 10).
3. **En vivo**:
   - **Screen Wake Lock**: la pantalla se mantiene encendida automáticamente mientras estés en la vista de partido en vivo.
   - **Reloj y ajuste fino**: ▶ corre el crono y ajusta segundos con `−5s`, `−1s`, `+1s`, `+5s` (sincroniza minutos de jugadoras en pista).
   - **Posesión**: toca el botón de posesión para alternar la flecha de salto alterno (◀ Nosotros / Rival ▶).
   - **Tiempos Muertos FIBA**: casillas táctiles para registrar TMs pedidos (2 en 1ª parte, 3 en 2ª parte, 1 por prórroga) con notas automáticas sincronizadas.
   - **Pista y sustituciones**: cambio directo "A por B", o clásico. Registro automático en notas y auto-deshacer en toques involuntarios.
   - **Faltas y Bonus**: `+F` suma falta individual y de equipo. Aviso a la 4ª falta, alerta y vibración a la 5ª (eliminada). Bonus FIBA a las 4 de equipo (`★ BONUS ★`).
   - **Notas con filtro**: filtra al vuelo entre `Todas`, `🧠 Tácticas`, `🔄 Cambios` y `⏱️ TMs` para no perder notas importantes.
4. **Resumen e Historial**:
   - Selector de partidos archivados para consultar jornadas anteriores en cualquier momento.
   - Desglose ordenado de minutos/faltas, notas tácticas y timeline de eventos.
   - Botón para copiar resumen al portapapeles y opción de borrar partidos del historial.
