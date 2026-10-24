"""Renderiza showreel.html cuadro por cuadro a MP4 (o stills PNG).

    uv run --with playwright --with imageio-ffmpeg python render_video.py --html showreel.html --w 1080 --h 1920
    uv run --with playwright --with imageio-ffmpeg python render_video.py --html showreel.html --w 1080 --h 1920 --stills 3.0,7.65

Usa Edge instalado (channel "msedge") por defecto; con --exe se puede pasar la ruta de otro Chromium.
ffmpeg: el de imageio-ffmpeg si está, si no el del PATH.
"""

import argparse
import pathlib
import shutil
import subprocess
import sys

from playwright.sync_api import sync_playwright


def ffmpeg_bin() -> str:
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        exe = shutil.which("ffmpeg")
        if not exe:
            sys.exit("No encuentro ffmpeg: agregá --with imageio-ffmpeg al uv run o instalá ffmpeg.")
        return exe


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--html", default="showreel.html")
    ap.add_argument("--w", type=int, default=1080)
    ap.add_argument("--h", type=int, default=1920)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--out", default=None, help="MP4 de salida (por defecto showreel_9x16.mp4 o showreel_16x9.mp4)")
    ap.add_argument("--audio", default="assets/gancho.m4a", help="Audio que arranca en el segundo 0 (vacío: sin audio)")
    ap.add_argument("--stills", default=None, help="Segundos sueltos, separados por coma: saca PNG en vez de video")
    ap.add_argument("--channel", default="msedge")
    ap.add_argument("--exe", default=None, help="Ruta a un Chromium/Edge (ignora --channel)")
    a = ap.parse_args()

    html = pathlib.Path(a.html).resolve()
    base = html.parent
    url = f"{html.as_uri()}?render&w={a.w}&h={a.h}"
    tag = "9x16" if a.h > a.w else "16x9"

    with sync_playwright() as pw:
        opts = {"executable_path": a.exe} if a.exe else {"channel": a.channel}
        browser = pw.chromium.launch(args=["--allow-file-access-from-files"], **opts)
        page = browser.new_page(viewport={"width": a.w, "height": a.h}, device_scale_factor=1)
        page.goto(url)
        page.wait_for_function("window.LISTO === true", timeout=60_000)
        dur = page.evaluate("window.DUR")
        clip = {"x": 0, "y": 0, "width": a.w, "height": a.h}

        if a.stills:
            for s in a.stills.split(","):
                t = float(s)
                page.evaluate(f"window.render({t})")
                out = base / f"still_{tag}_{t:05.2f}.png"
                page.screenshot(path=str(out), clip=clip)
                check = page.evaluate(f"window.tapCheck({t})")
                print(out.name, check if check else "")
            browser.close()
            return

        out = pathlib.Path(a.out) if a.out else base / f"showreel_{tag}.mp4"
        n = int(round(dur * a.fps))
        cmd = [ffmpeg_bin(), "-y", "-v", "error", "-f", "image2pipe", "-framerate", str(a.fps), "-i", "-"]
        audio = base / a.audio if a.audio else None
        if audio and audio.exists():
            cmd += ["-i", str(audio), "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "192k"]
        cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "medium", "-movflags", "+faststart", "-t", f"{dur}", str(out)]
        ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        for i in range(n):
            page.evaluate(f"window.render({i / a.fps})")
            ff.stdin.write(page.screenshot(clip=clip, type="png"))
            if i % (a.fps * 5) == 0:
                print(f"{i / a.fps:5.1f} s / {dur} s", flush=True)
        ff.stdin.close()
        ff.wait()
        browser.close()
        print("Listo:", out)


if __name__ == "__main__":
    main()
