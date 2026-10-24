# Reel: pozo

Showreel vertical de Pocitos LP con el gancho del pozo: la camioneta pisa el pozo (60 y 28), la imagen se congela, se
achica hasta la foto del formulario y se envía; después, cómo se reporta (15 s), el mapa del casco, el seguimiento del
pozo, los números reales del casco y el cierre.

- `showreel.html`: todo en función del tiempo (`render(t)`). Abrilo en el navegador para verlo en loop;
  `?w=1920&h=1080` para la versión horizontal.
- `render_video.py`: cuadro por cuadro a MP4.

```bash
uv run --with playwright --with imageio-ffmpeg python render_video.py --html showreel.html --w 1080 --h 1920
uv run --with playwright --with imageio-ffmpeg python render_video.py --html showreel.html --w 1080 --h 1920 --stills 3.0,7.65
```

Usa Edge (`--channel msedge`) por defecto. Los stills imprimen si cada toque cae sobre su botón.

Assets: cuadros del video original con la patente del auto estacionado desenfocada (`assets/hook/`), la foto congelada,
el audio del gancho, Hanken Grotesk y la geometría real del casco (OpenStreetMap, ODbL). Los estados de cuadras y los
pozos del mapa son datos de ejemplo (se indica en el video); los números del cierre (3.955 cuadras, 495 km) son reales.
