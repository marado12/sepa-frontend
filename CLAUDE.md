# sepa-frontend

React 18 + Vite 5. Repo `marado12/sepa-frontend`, desplegado en **Vercel**.
Producción: https://superahorro.vercel.app

Leé primero el `CLAUDE.md` de la carpeta padre y `../CONTEXTO.md`.

## Comandos

```bash
npm install
npm run dev        # :5173
npm run build
npm run preview
```

**No hay tests ni linter configurados.** La verificación es manual: `npm run build` tiene que
pasar, y después mirar la pantalla. Si agregás algo con lógica de verdad (cálculos, parseo),
proponé mover esa lógica al backend, donde sí hay suite.

## Estructura

```
src/
├── App.jsx                 orquestador: estado global, llamadas al backend, PostHog,
│                           historial en localStorage, compartir por hash en la URL
├── main.jsx
├── useCacheStatus.js       hook de estado del caché + exporta la constante API
├── index.css               32 KB, TODO el estilo del proyecto en un archivo
└── components/
    ├── HomeScreen.jsx      ubicación, radio, selector de día
    ├── BasketScreen.jsx    alta y edición de la canasta
    ├── ResultsScreen.jsx   resultado de la comparación
    ├── BancosScreen.jsx    22 KB — elección de banco + tabla de promos
    ├── CacheBanner.jsx     estado del caché / avisos de datos degradados
    ├── PrecioNormalizado.jsx
    └── precio-normalizado.css
```

## Deuda técnica concreta

**1. La URL del backend está repetida en tres archivos.**

```
App.jsx:80              const API = import.meta.env.VITE_API_URL || 'https://sepa-backend-bk88.onrender.com'
components/BancosScreen.jsx:3   (idéntica)
useCacheStatus.js:3     export const API = ...   ← este ya la exporta
```

`ROADMAP.md` dice que los tres archivos son App/HomeScreen/BancosScreen. **Está desactualizado:**
`HomeScreen.jsx` ya no la tiene, y el tercero es `useCacheStatus.js`. Y como ese módulo **ya
exporta `API`**, el arreglo no es crear nada nuevo: es que los otros dos la importen de ahí.
Son dos líneas.

**2. `BANCOS_FALLBACK` en `BancosScreen.jsx` (~línea 364) es una tabla de promos bancarias
escrita a mano**, con descuentos, topes de reintegro y días de la semana. Es la deuda del
ítem 4.1: si una promo vence, la app le dice al usuario que ahorre plata con un descuento
que ya no existe. La solución es que el backend mande `promos_sitio` leídas de los Teasers y
que esta tabla quede solo como fallback. El parseo de Teasers **ya está arreglado en el
backend**, y desde la Tarea 14 `ResultsScreen.jsx` **sí** muestra el origen de cada promo
("del sitio" / "a mano") y las promos que no bajan el total (cuotas sin interés). Lo que falta
es **verificarlo end-to-end** contra el backend real: que las promos leídas de los Teasers
lleguen efectivamente a la pantalla.

> ✏️ **Esta línea afirmaba desde el 09/09 que `ResultsScreen.jsx` ya mostraba el origen de
> cada promo. Era falsa.** El commit que lo prometía (`b99818f`, *"mostrar origen de cada promo
> (sitio vs manual) y promos que no bajan el total"*) tocó **un solo archivo, `index.css`, con
> 50 líneas de alta y cero JSX** (`git show --stat b99818f`). Las cinco clases —`.promo-origen`,
> `.promo-origen--sitio`, `.promo-origen--manual`, `.promo-sin-descuento`, `.promo-nota`—
> existían sin que ningún componente las usara. La Tarea 14 las cableó: ahora la afirmación es
> verdadera, pero se escribió como verdadera durante tres días sin serlo. Séptima referencia
> fantasma del proyecto. **Un commit con mensaje de feature y diff de solo CSS es la firma de
> este error**: antes de creerle a un mensaje de commit, mirá el `--stat`.

**3. `origen_precios` y `aviso_datos` ya se muestran** en `ResultsScreen.jsx` (commits del
09/09). Si leés en algún documento que "falta mostrarlos", ese documento quedó viejo.

**4. Pendiente de decisión de flujo:** `BancosScreen` pide elegir banco **antes** de comparar,
y las promos del sitio llegan **después**, con la respuesta. Los dos momentos no se pisan hoy,
pero hay que repensar cuándo se le pregunta al usuario. Es una decisión de producto de Santiago,
no la resuelvas por tu cuenta.

## Cosas a no "arreglar"

- **La key de PostHog en `App.jsx:10` es pública por diseño** (`phc_...` es una project API
  key de PostHog, va en el cliente). No es un secreto filtrado, no la muevas a una variable
  de entorno pensando que lo es.
- **`VITE_API_URL` tiene que llevar el prefijo `VITE_`**: Vite solo expone al cliente las
  variables que empiezan así. En Vercel está como tipo *Config*, no *Secret*, a propósito —
  como Secret era write-only y no se podía ver a qué backend apuntaba. Nunca pongas claves
  ni tokens en variables `VITE_`: quedan en el bundle del navegador.
- `vercel.json` reescribe todo a `/` — es lo que hace funcionar el ruteo de una SPA. No lo toques.

## Ojo con Render

El backend se duerme a los 15 minutos. **El primer request después puede tardar más de un
minuto**, y en ese arranque puede tener que rearmar el caché (2-3 min más). Cualquier cosa que
toques en el manejo de carga y timeouts tiene que sostener ese caso: no es un error, es el
comportamiento normal del plan free. `CacheBanner.jsx` y `useCacheStatus.js` ya existen para eso.

## Estado del deploy

Hubo un período largo en que producción corría un commit de ~124 días atrás: había commits en
GitHub que nunca se habían desplegado. Si algo que "ya está hecho" no aparece en
superahorro.vercel.app, **verificá primero qué commit tiene Vercel desplegado** antes de
salir a buscar el bug.
