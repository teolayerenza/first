# Instagram de Pocitos LP

Todo lo de la cuenta está acá. Lo visual se regenera con `node scripts/instagram/render.mjs` (instrucciones en el script).

| Carpeta | Qué hay |
|---|---|
| `perfil/` | Foto de perfil, nombre, bio, link, tipo de cuenta y reglas (`perfil.md`) |
| `posteos/` | Las placas de los 6 posteos de lanzamiento (1080×1350), una carpeta por posteo |
| `historias/` | Historias de lanzamiento y tapas de destacadas (`historias/README.md`) |

## Antes de lanzar

- [ ] Cuenta `@pocitoslp` creada y pasada a profesional (`perfil/perfil.md`).
- [ ] Foto, nombre, bio y link cargados.
- [ ] El mail `hola@pocitos.com.ar` existe (Cloudflare → Email → Email Routing: reenvía a tu Gmail, gratis).
- [ ] `pocitos.com.ar` y `www.pocitos.com.ar` cargados en Cloudflare → Turnstile → Hostnames.
- [ ] **Enviar un reporte de prueba desde el celular y que se guarde** (necesita la clave pública de Turnstile en Vercel).

## Día del lanzamiento

Los 6 posteos el mismo día, del 6 al 1, cada 5 minutos, para que el 1 quede arriba a la izquierda de la grilla.
Después, las historias de lanzamiento. Fecha y hora a elegir (propuesta: un día hábil a las 18:30).

| Hora | Posteo | Placas |
|---|---|---|
| 18:30 | `posteos/6-para-que` | 5 |
| 18:35 | `posteos/5-anonimato` | 4 |
| 18:40 | `posteos/4-tablero` | 5 |
| 18:45 | `posteos/3-calificar` | 4 |
| 18:50 | `posteos/2-reportar` | 6 |
| 18:55 | `posteos/1-que-es` | 5 |

### Cómo programar los posteos (Meta Business Suite, gratis)

1. Entrá a **business.facebook.com** (o la app Meta Business Suite) con la cuenta que administra @pocitoslp.
2. **Crear publicación** → elegí solo Instagram.
3. **Agregar contenido** → subí las placas del posteo **en orden** (01, 02, 03…): varias imágenes forman un carrusel.
4. Pegá el texto de abajo.
5. **Opciones de programación** → **Programar** → fecha y hora → **Programar**.
6. Repetí con los otros 5, en el orden de la tabla.

Desde el celular también se puede: al crear el posteo, **Configuración avanzada → Programar esta publicación**.

## Textos de los posteos

### 1-que-es

```
¿Cuántas calles de La Plata están rotas? Nadie lo sabe: no hay un registro público.

Por eso armamos Pocitos LP: un mapa abierto del casco urbano donde cualquier vecino puede reportar un pozo, un parche mal hecho o calificar cómo está su cuadra.

Son 3.955 cuadras y las medimos entre todos: cada vecino que califica la suya suma.

Anónimo, sin cuentas, sin publicidad. pocitos.com.ar (link en la bio).

#LaPlata #CallesDeLaPlata #CascoUrbano #Pozos
```

### 2-reportar

```
Reportar un pozo tarda 15 segundos:

1. Marcás dónde está en el mapa (o tocás «Usar mi ubicación»).
2. Elegís si es leve, medio o peligroso.
3. Si podés, sacás una foto.

Los parches mal hechos (elevados, hundidos o desarmados) también se reportan.

Lo puede reportar cualquiera que pase. Si otro vecino lo confirma, cuenta.

pocitos.com.ar (link en la bio).

#LaPlata #Pozos #Bacheo #CallesDeLaPlata
```

### 3-calificar

```
Un pozo es una rotura puntual. El estado de tu cuadra es otra cosa: cómo está el asfalto en general.

Por eso en Pocitos LP se miden por separado. Calificar tu cuadra tarda 10 segundos: buena, gastada o muy deteriorada.

¿La repavimentaron? Avisanos: también cuenta.

pocitos.com.ar (link en la bio).

#LaPlata #CallesDeLaPlata #Asfalto
```

### 4-tablero

```
Cómo leer el tablero de Pocitos LP:

- Cada color es un estado: nueva, buena, gastada, muy deteriorada o sin relevar. El empedrado se cuenta aparte.
- Todo se mide en kilómetros de asfalto y en cuadras.
- El casco se divide en 36 zonas entre avenidas.
- Una zona entra al ranking cuando tiene al menos el 20% relevado.

Cuantos más vecinos se suman, más preciso es el mapa. pocitos.com.ar (link en la bio).

#LaPlata #DatosAbiertos #CallesDeLaPlata
```

### 5-anonimato

```
Tu anonimato, en Pocitos LP:

- No te pedimos nombre, ni mail, ni teléfono, ni cuenta.
- Guardamos dónde está el pozo, nunca dónde estás vos. Tampoco tu IP.
- Las fotos se limpian en tu celular antes de subirse: sin ubicación, sin fecha, sin modelo de teléfono.
- Sin publicidad, sin rastreadores, sin venta de datos.

En la web podés ver campo por campo qué se guarda. pocitos.com.ar (link en la bio).

#LaPlata #Privacidad
```

### 6-para-que

```
¿Para qué sirve Pocitos LP?

- Los datos son abiertos: cualquiera los puede descargar.
- Cada mes vamos a publicar un informe con el estado de las calles y cómo cambió, y lo vamos a mandar al municipio, al Concejo Deliberante y a los medios.
- Si arreglan un pozo, también lo vamos a mostrar.

Cuantos más vecinos se sumen, más fuerte es el dato. Sumá tu cuadra y compartilo con tu barrio. pocitos.com.ar (link en la bio).

#LaPlata #CallesDeLaPlata #DatosAbiertos
```
