# Los viajes de Marcelo

Mapa 3D de Argentina con los recorridos en camioneta: relieve real (MapLibre + datos de altura libres), recorridos y
camioneta en three.js, límites de países y provincias (Natural Earth, punto de vista argentino), fotos con su ubicación,
fecha, dificultad (1 a 5), terreno, acompañantes y notas. Sin login.

## Publicar en Vercel (una sola vez)

1. Vercel → **Add New → Project** → importar el repositorio `teolayerenza/first`.
2. **Root Directory:** `viajes-marcelo` (Vercel detecta Vite solo: build `npm run build`, salida `dist`).
3. Deploy. Desde ahí, cada push publica solo.

Sin las variables de Supabase la página funciona en **modo demo**: los viajes quedan guardados solo en ese navegador.

## Guardar los viajes en la nube (Supabase, gratis)

1. Crear un proyecto en supabase.com.
2. SQL Editor → pegar y correr `supabase/schema.sql`.
3. Project Settings → API: copiar la URL y la clave pública `anon`.
4. En Vercel → el proyecto → Settings → Environment Variables:
   `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Volver a publicar (Deployments → Redeploy).

Sin login, cualquiera que tenga el link puede ver y editar: no lo compartas.

## Desarrollo

```bash
npm install
npm run dev
```

Servicios externos (gratis, sin clave): mapa base OpenFreeMap, topográfico OpenTopoMap, satélite Esri, relieve AWS
Terrain Tiles, buscador Nominatim y trazado por caminos OSRM (uso personal y moderado).
