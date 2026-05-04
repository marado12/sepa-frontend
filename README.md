# Frontend — Comparador SEPA

React + Vite · Deploy en Vercel (gratis)

## Desarrollo local

```bash
npm install
cp .env.example .env.local
# Editá .env.local con tu URL de Railway
npm run dev
```

## Deploy en Vercel (5 minutos)

### 1. Subir a GitHub
```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/TU_USUARIO/sepa-frontend.git
git push -u origin main
```

### 2. Conectar con Vercel
- Entrá a vercel.com → "New Project" → importá tu repo
- Framework: **Vite** (lo detecta automático)
- En **Environment Variables** agregá:
  - `VITE_API_URL` = `https://TU-APP.up.railway.app`
- Click Deploy → listo en ~1 min

### 3. Variables de entorno
| Variable | Valor |
|----------|-------|
| `VITE_API_URL` | Tu URL de Railway (sin `/` al final) |

## Estructura

```
src/
  App.jsx              # Navegación entre pantallas
  index.css            # Todos los estilos
  components/
    HomeScreen.jsx     # Pantalla principal + geoloc
    ResultsScreen.jsx  # Ranking + canasta óptima
    BasketScreen.jsx   # Editor de canasta
```

## PWA (instalar en celular)

El `manifest.json` ya está configurado. Chrome/Safari van a mostrar
el banner "Instalar app" automáticamente cuando el usuario visite el sitio
desde el celular varias veces. No se requiere nada más.

Para agregar íconos reales: reemplazá `/public/icon-192.png` y `/public/icon-512.png`
con íconos reales (podés generarlos en realfavicongenerator.net).

## Notas

- La primera consulta del día tarda 30-120s (Railway descarga SEPA ~300MB)
- El loading muestra mensajes explicativos para que el usuario no abandone
- Mobile-first: optimizado para 390px de ancho
