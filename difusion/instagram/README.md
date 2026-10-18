# Instagram: los 6 posteos de lanzamiento

Las placas están en esta carpeta (1080×1350, formato vertical de Instagram). Se regeneran con
`node scripts/instagram/render.mjs` (ver el encabezado del script).

## Antes de programar

- [ ] Cuenta `@pocitoslp` creada y pasada a **cuenta profesional** (Configuración → Tipo de cuenta → Profesional). Sin eso no se puede programar.
- [ ] Bio:
  > El estado real de las calles de La Plata, medido por vecinos.
  > Casco urbano · 100% anónimo · Datos abiertos
  > Reportá un pozo en 15 segundos
- [ ] Link de la bio: la dirección de la web. Conviene un dominio propio (por ejemplo `pocitoslp.com.ar`) antes de lanzar: `first-rosy-ten.vercel.app` no inspira confianza.
- [ ] El mail `hola@pocitoslp.com.ar` que figura en la web tiene que existir (o cambiarlo en la web antes de lanzar).

## Calendario

Los 6 se publican **el mismo día**, en orden inverso (del 6 al 1) y con 5 minutos entre cada uno, para que el 1 quede
arriba a la izquierda de la grilla. Propuesta: **martes 20 de octubre a las 18:30** (después del trabajo, día hábil).

| Hora | Posteo | Placas |
|---|---|---|
| 18:30 | `6-para-que` | 5 |
| 18:35 | `5-anonimato` | 4 |
| 18:40 | `4-tablero` | 5 |
| 18:45 | `3-calificar` | 4 |
| 18:50 | `2-reportar` | 6 |
| 18:55 | `1-que-es` | 5 |

## Cómo programarlos (Meta Business Suite, gratis)

1. Entrá a **business.facebook.com** (o la app Meta Business Suite) con la cuenta que administra @pocitoslp.
2. **Crear publicación** → elegí solo Instagram como destino.
3. **Agregar contenido** → subí las placas de la carpeta del posteo **en orden** (01, 02, 03…). Varias imágenes = carrusel.
4. Pegá el texto de abajo.
5. En **Opciones de programación**, elegí **Programar** → fecha y hora de la tabla → **Programar**.
6. Repetí con los otros 5, en el orden de la tabla.

Desde el celular también se puede: al crear el posteo en Instagram, **Configuración avanzada → Programar esta publicación**.

## Textos

### 1-que-es

```
¿Cuántas calles de La Plata están rotas? Nadie lo sabe: no hay un registro público.

Por eso armamos Pocitos LP: un mapa abierto del casco urbano donde cualquier vecino puede reportar un pozo, un parche mal hecho o calificar cómo está su cuadra.

Son 3.955 cuadras. Hoy no hay ninguna relevada. Empezamos ahora, entre todos.

Anónimo, sin cuentas, sin publicidad. Link en la bio.

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

Link en la bio.

#LaPlata #Pozos #Bacheo #CallesDeLaPlata
```

### 3-calificar

```
Un pozo es una rotura puntual. El estado de tu cuadra es otra cosa: cómo está el asfalto en general.

Por eso en Pocitos LP se miden por separado. Calificar tu cuadra tarda 10 segundos: buena, gastada o muy deteriorada.

¿La repavimentaron? Avisanos: también cuenta.

Link en la bio.

#LaPlata #CallesDeLaPlata #Asfalto
```

### 4-tablero

```
Cómo leer el tablero de Pocitos LP:

- Cada color es un estado: nueva, buena, gastada, muy deteriorada o sin relevar. El empedrado se cuenta aparte.
- Todo se mide en kilómetros de asfalto y en cuadras.
- El casco se divide en 36 zonas entre avenidas.
- Una zona entra al ranking cuando tiene al menos el 20% relevado.

Cuantos más vecinos se suman, más preciso es el mapa. Link en la bio.

#LaPlata #DatosAbiertos #CallesDeLaPlata
```

### 5-anonimato

```
Tu anonimato, en Pocitos LP:

- No te pedimos nombre, ni mail, ni teléfono, ni cuenta.
- Guardamos dónde está el pozo, nunca dónde estás vos. Tampoco tu IP.
- Las fotos se limpian en tu celular antes de subirse: sin ubicación, sin fecha, sin modelo de teléfono.
- Sin publicidad, sin rastreadores, sin venta de datos.

En la web podés ver campo por campo qué se guarda. Link en la bio.

#LaPlata #Privacidad
```

### 6-para-que

```
¿Para qué sirve Pocitos LP?

- Los datos son abiertos: cualquiera los puede descargar.
- Cada mes vamos a publicar un informe con el estado de las calles y cómo cambió, y lo vamos a mandar al municipio, al Concejo Deliberante y a los medios.
- Si arreglan un pozo, también lo vamos a mostrar.

Cuantos más vecinos se sumen, más fuerte es el dato. Sumá tu cuadra y compartilo con tu barrio. Link en la bio.

#LaPlata #CallesDeLaPlata #DatosAbiertos
```
