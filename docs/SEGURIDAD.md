# Pocitos LP — Seguridad, anti-abuso y privacidad

> Objetivo: que nadie con malas intenciones pueda **arruinar los datos** (reportes masivos, manipular zonas)
> ni **tirar el servicio**, y que si alguien logra entrar a la base **no encuentre nada personal para robar**.

Principios:
1. **Nada que robar**: si no guardamos datos personales, un hackeo no los expone.
2. **Nunca confiar en el cliente**: cualquiera puede llamar a la API sin pasar por la app. Toda validación ocurre en el servidor.
3. **Defensa en capas**: ninguna medida sola alcanza; cada capa frena lo que se le escapó a la anterior.
4. **Todo es reversible**: un ataque de datos se puede deshacer sin perder los aportes legítimos.
5. **La seguridad no depende del secreto**: aunque el código fuera público, seguiría siendo seguro.

---

## 1. Modelo de amenazas

| # | Atacante / situación | Qué busca | Impacto si no lo frenamos |
|---|---|---|---|
| A1 | **Bot / script** | Miles de pozos o calificaciones falsas | KPIs sin sentido, se pierde la credibilidad |
| A2 | **Muchas sesiones anónimas** (ataque Sybil) | Esquivar el límite por dispositivo | Igual que A1, más difícil de detectar |
| A3 | **Manipulación organizada con personas reales** (por ejemplo, con interés político) | Que una zona parezca mejor o peor | Rankings falsos, pérdida de confianza |
| A4 | **Llamadas directas a la API** con la clave pública de Supabase | Saltear el captcha y las validaciones de la app | Inserciones masivas |
| A5 | **GPS falso** | Marcar aportes como "en el lugar" para que pesen más | Más peso a votos falsos |
| A6 | **Fotos maliciosas** (contenido ilegal, ofensivo, caras, patentes) | Dañar la imagen del proyecto o exponer a terceros | Problema legal y reputacional |
| A7 | **Agotar recursos** (subir fotos pesadas, inundar requests) | Que se termine el plan gratuito o llegue una factura | Servicio caído o costos inesperados |
| A8 | **Mala configuración de Supabase** (tablas sin RLS, `service_role` filtrada) | Leer o escribir todo | Base comprometida |
| A9 | **Robo de la base** (hackeo, backup filtrado) | Datos de los usuarios | Ver §6: no hay datos personales |
| A10 | **Toma de la cuenta de un mantenedor** (GitHub, Supabase, Vercel) | Control total | Lo peor: hace falta 2FA y mínimos privilegios |
| A11 | **Ataque a las dependencias** (paquete npm comprometido) | Inyectar código | Robo de tokens o cambios en la app |

---

## 2. Arquitectura segura: un único camino de escritura

```
Celular ──▶ Cloudflare (WAF + rate limit por IP, sin guardar la IP)
              │
              ▼
        Edge Function "submit"  ◀── único punto de escritura
          1. Verifica el token de Turnstile (captcha) contra Cloudflare
          2. Verifica la sesión anónima (JWT)
          3. Valida el payload con Zod: tipos, rangos, dentro del casco
          4. Aplica rate limit (dispositivo / cuadra / global)
          5. Calcula los HMAC con el secreto (que vive SOLO en la Edge Function)
          6. Llama a la RPC SQL con la service role
              │
              ▼
        Postgres (RPC security definer) → tablas en estado "pendiente"
              │  cada 10 min (pg_cron)
              ▼
        Detector de anomalías → promueve a "activo" o retiene "en revisión"
              │
              ▼
        KPIs / mapa (solo con datos activos y verificados)
```

Claves:
- **El rol `anon` no puede escribir en ninguna tabla ni ejecutar las RPC de escritura** (`revoke execute ... from anon, authenticated`).
  Solo la Edge Function, con la service role, puede escribir. Esto cierra **A4**.
- **El secreto HMAC no está en la base**: si roban la base, no pueden recalcular los hashes para vincular aportes (cierra parte de **A9**).
- **Período de "pendiente"**: un aporte tarda unos minutos en afectar los KPIs. Esa ventana permite detectar
  ráfagas antes de que ensucien los números.

---

## 3. Anti-abuso: las capas

### Capa 1 — Borde (Cloudflare)
- Proxy delante de la app y de la Edge Function, con WAF administrado.
- **Rate limiting por IP en el borde**, por ejemplo 30 envíos cada 10 minutos. Cloudflare lo aplica en memoria
  y **nosotros no guardamos la IP**.
- Bloqueo o desafío al tráfico fuera de Argentina en los endpoints de escritura. Se usa el header de país solo en el momento, sin guardarlo.
- **Turnstile** (captcha invisible) en cada envío y en la creación de la sesión anónima (Supabase soporta captcha en anonymous sign-in).

### Capa 2 — Límites de cuota (configurables en `config`)
| Límite | Valor inicial | Contra qué protege |
|---|---|---|
| Pozos por dispositivo por día | 10 | A1 |
| Calificaciones por dispositivo por día | 30 | A1 |
| Fotos por dispositivo por día | 5 | A7 |
| Pozos nuevos por cuadra por hora (de todos los usuarios) | 5 | Inundación en un lugar |
| Calificaciones por zona por hora | N × promedio histórico | A2, A3 |
| **Freno global**: si el volumen total supera X veces lo normal | Todo entra en revisión y se alerta al admin | Ataque grande |

Los contadores usan `HMAC(sal_del_día, dispositivo)` y se borran todos los días.

### Capa 3 — Verificación cruzada (ya definida en el plan)
- Un **pozo** cuenta si tiene foto o si lo confirma **otro** dispositivo.
- El **estado de una cuadra** requiere ≥ 2 dispositivos coincidentes.
- Un dispositivo no puede autoconfirmarse: el HMAC del voto coincide con el del reporte y se detecta.
- **Sesiones nuevas pesan menos**: los aportes de una sesión creada hace menos de 24 h cuentan, pero no alcanzan
  para verificar algo por sí solos. Crear 100 sesiones de golpe no sirve de nada. (La antigüedad de la sesión se lee del JWT; no se guarda nada extra.)

### Capa 4 — Detector de anomalías (job SQL cada 10 min)
Reglas simples y explicables, con umbrales en `config`:
- Ráfaga de aportes en una zona o cuadra vs. su promedio histórico.
- Muchas calificaciones que cambian el estado de una zona en poco tiempo (por ejemplo, de 🔴 a 🟢 en masa).
- Proporción alta de aportes de sesiones nuevas.
- Pozos en patrones imposibles (en grilla perfecta o a pocos metros uno del otro en serie).

Si una regla salta, los aportes quedan **"en revisión"**: no cuentan en los KPIs, la zona muestra el aviso
*"Esta zona recibió un volumen inusual de aportes y está en revisión"* y se manda una alerta al admin por email o Telegram.

### Capa 5 — Reversión
- Todos los aportes tienen `state` (`pendiente` / `activo` / `en_revision` / `oculto`) y nunca se borran durante el período de revisión.
- El panel de admin permite **"ocultar todos los aportes del área X entre la hora A y la B"**, y los KPIs se recalculan solos.
- Los snapshots diarios permiten mostrar la serie histórica sin el ataque.
- **Bitácora pública de moderación**: "12/11: se ocultaron 340 aportes en la zona 19–25 / 60–66 por actividad automatizada".
  Esto da transparencia y responde a **A3**.

### Contra la manipulación con personas reales (A3)
Es lo más difícil de frenar sin identificar a la gente, así que la respuesta es **transparencia**:
- Por zona se muestra **cuántos aportes** hay y cómo evolucionaron.
- Un % mínimo relevado para entrar al ranking.
- La calificación de una cuadra es la **moda**: hace falta superar a los vecinos reales, no solo sumar votos.
- Los aportes *en el lugar* pesan más, y llevar a gente físicamente a cada cuadra es caro.
- El GPS falso (**A5**) es posible, pero el peso extra es chico y el resto de las capas sigue activo.

### Fotos (A6, A7)
- En el celular, de forma automática e invisible para el usuario: cualquier foto (HEIC de iPhone incluido) se redimensiona a
  1280 px, se re-codifica a WebP/JPEG de ~200 KB y pierde el EXIF (ver `PLAN.md` §9.3). **El vecino nunca ve un límite.**
- En el servidor: subida solo con **URL firmada** que emite la Edge Function (máx. 1 MB, solo `image/jpeg` o `image/webp`).
  Ese límite es solo contra quien llame a la API sin pasar por la app.
  La imagen **se re-codifica** en el servidor, lo que elimina metadatos residuales y archivos "políglotas".
- **Una foto no es pública hasta que el pozo está verificado por otra persona.** Antes de eso solo se usa como evidencia.
- Botón **"Denunciar foto"**: con 2 denuncias se oculta automáticamente hasta que la revise un admin.
- Fase 6: detector automático de contenido inapropiado y blur de caras y patentes.
- Si apareciera contenido ilegal, se elimina y se denuncia ante las autoridades. Hay que tener un procedimiento escrito.

---

## 4. Hardening de Supabase (A8)

- [ ] **RLS activado en todas las tablas** (y un test automático que falle si alguna tabla queda sin RLS).
- [ ] `anon` solo puede hacer `select` sobre **vistas públicas** que no exponen columnas de hash
  (`voter_hash` y `reporter_hash` nunca salen de la base).
- [ ] RPC `security definer` con `set search_path = ''` y nombres totalmente calificados.
- [ ] `service_role` y el secreto HMAC **solo** en las variables de entorno de la Edge Function. Nunca en el cliente ni en el repo.
- [ ] Bucket de fotos privado; la lectura pública es solo de las fotos aprobadas, mediante una vista o URL firmada.
- [ ] Desactivar los métodos de auth que no se usan (email, OAuth). Solo sesión anónima + captcha.
- [ ] **Limpieza de sesiones**: un job borra los usuarios anónimos inactivos por más de 30 días.
- [ ] Retención mínima de los logs de auth. Revisar qué guarda el audit log de Supabase (puede incluir IP) y acortarlo o desactivarlo.
- [ ] Usar el Security Advisor de Supabase antes de cada deploy.

---

## 5. Aplicación web y operación

- **CORS abierto en `submit`**: no hay cookies; la escritura la protegen el JWT de la sesión anónima y Turnstile (atado al dominio en Cloudflare). `ALLOWED_ORIGIN` ya no se usa.
- **Un solo texto libre: el comentario opcional de un pozo o parche** (hasta 200 caracteres, público). Antes de guardarlo,
  `cleanComment` (src/lib/domain/submit.ts) saca teléfonos, mails, links y @usuarios. Se muestra solo en reportes verificados,
  siempre como texto plano (React lo escapa; nunca en el globo del mapa, que usa HTML), y con 3 denuncias se oculta el
  reporte entero. El resto de los inputs son enums, números y coordenadas.
- Validación con **Zod** en el cliente (para la UX) y en la Edge Function (para la seguridad).
- Headers: **CSP estricta**, HSTS, `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, `Permissions-Policy`
  (geolocalización y cámara solo en la propia app).
- **Dependencias**: lockfile, Dependabot o Renovate, `npm audit` en CI y pocas dependencias.
- **Cuentas de los mantenedores (A10)**: 2FA obligatorio en GitHub, Supabase, Vercel y Cloudflare. Branch protection en `main`.
  Secret scanning activado.
- **Panel de admin**: ruta separada, con login de admin y MFA. Es el **único lugar con cuentas**, y son las de los mantenedores, no las de los vecinos.
  Cada acción de moderación queda registrada.
- **Backups**: `pg_dump` diario cifrado. Como no hay datos personales, un backup filtrado tampoco es grave.
- **Alertas**: picos de tráfico, uso del plan cercano al límite y reglas de anomalía disparadas.
- **Límite de gasto** configurado en todos los proveedores para que un ataque no genere una factura (A7).

---

## 6. "¿Y si nos hackean?": qué se llevaría un atacante

| Dato en la base | ¿Es personal? | Comentario |
|---|---|---|
| Cuadras, zonas | No | Datos públicos de OSM |
| Calificaciones: cuadra, valor, en el lugar sí/no, hora redondeada | No | El `voter_hash` no se puede revertir sin el secreto, que no está en la base |
| Pozos: ubicación del **pozo**, gravedad, foto revisada | No | Es lo mismo que ya muestra el mapa |
| Votos de pozos | No | Solo hashes |
| Usuarios anónimos (`auth.users`) | Pseudónimo aleatorio | Sin email ni nombre. Se borran a los 30 días de inactividad |
| Contadores de rate limit | No | Se borran todos los días |
| Contador de vecinos (`contributors`) | No | Solo un hash por dispositivo, el mes y 3 sí/no. No dice qué aportó ni dónde. El vínculo temporal con el aporte se borra en ≈ 10 min |
| "Aportando ahora" (Presence) | No | Vive solo en memoria mientras la app está abierta; no se guarda |
| IP, ubicación del celular, modelo de teléfono, nombre, email, teléfono, barrio | — | **No se guardan** |

Conclusión honesta: **un atacante que robe la base se lleva básicamente lo mismo que ya es público** (el mapa de pozos
y las calificaciones), sin forma de saber quién aportó qué.

Lo que **no** podemos prometer, y por eso se dice en la página de privacidad:
- Los proveedores de infraestructura (Cloudflare, Vercel, Supabase) registran datos técnicos, como la IP, en sus propios sistemas
  por seguridad, durante un tiempo limitado. No los usamos para identificar a nadie, pero existen.
- Ningún sistema es 100% inhackeable. La garantía real es otra: **no hay nada sensible que robar**.

Detalles extra de minimización:
- Las horas de los aportes se **redondean a la hora** una vez que pasan a "activo", para dificultar cruzarlas con logs externos.
- Los aportes no tienen relación entre sí: no existe una tabla que diga "este dispositivo hizo estas cosas".

---

## 7. ¿Código abierto? Opciones

No es obligatorio. Lo que hace que el proyecto sea un **bien para la comunidad** son, sobre todo, los **datos abiertos**
(cualquiera puede descargarlos, analizarlos o llevárselos al municipio) y que **no se lucra con los datos de nadie**.
El código abierto suma algo concreto: **que cualquiera pueda comprobar que "no guardamos nada" es verdad**.

| Opción | A favor | En contra |
|---|---|---|
| **A. Código abierto desde el lanzamiento** (recomendada) | Las promesas de privacidad se pueden auditar; puede contribuir gente de la comunidad y de la facultad; suma al portfolio | Hay que ser prolijo con los secretos (que nunca estén en el repo) |
| B. Privado para siempre, con datos abiertos y metodología pública | Más simple | La gente tiene que "creerte" lo de la privacidad |
| C. Abierto desde ya | Máxima transparencia | Se ve el trabajo a medio hacer, con la seguridad todavía incompleta |

**Recomendación**: desarrollar en un repo privado y **abrirlo al lanzar**, cuando la seguridad del checklist esté completa.
Aunque sea público, la seguridad no se debilita: no depende de esconder el código (principio de Kerckhoffs), y los
umbrales exactos del detector viven en la tabla `config`, no en el repo.

Si se abre, ¿qué licencia?
- **AGPL-3.0**: cualquiera que lo use como servicio tiene que publicar sus cambios. Evita que alguien lo cierre y lucre con él. Es la que va con la idea de bien común.
- **MIT**: libertad total, incluso para hacer una versión cerrada y comercial.
- **Datos**: ODbL, que además es obligatoria porque las cuadras derivan de OpenStreetMap.

---

## 8. Checklist de seguridad antes del lanzamiento

- [ ] Las escrituras pasan solo por la Edge Function. Las RPC de escritura tienen `revoke` para `anon` y `authenticated`.
- [ ] Turnstile en la sesión anónima y en cada envío.
- [ ] Rate limits de las 3 capas (IP en el borde, dispositivo, cuadra/zona) + freno global.
- [ ] Estados `pendiente` / `en_revision` + detector de anomalías + alertas.
- [ ] Panel de admin con MFA, reversión por área y tiempo, y bitácora pública.
- [ ] RLS en todas las tablas + test automático + Security Advisor sin warnings.
- [ ] Vistas públicas sin hashes. Secreto HMAC fuera de la base.
- [ ] Fotos: URL firmada, re-codificación, no públicas hasta verificación, botón de denuncia.
- [ ] Limpieza de sesiones inactivas y de contadores. Retención mínima de logs.
- [ ] Headers de seguridad + CSP. Dependabot + `npm audit` en CI.
- [ ] 2FA en todas las cuentas. Branch protection. Límites de gasto.
- [ ] Prueba de carga y **prueba de ataque propia**: un script que intente inundar, auto-verificarse y llamar la API directo, y verificar que todo se frena.
- [ ] Página de privacidad y bitácora de moderación publicadas.
