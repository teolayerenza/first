"""Banda sonora del reel, sintetizada (sin samples ni derechos de terceros): audio del gancho, click de la foto,
efectos de los toques y música electrónica urbana a 120 BPM que arranca después del click.

    uv run --with numpy --with scipy --with imageio-ffmpeg python music.py

Escribe assets/audio.wav (y assets/audio.m4a). Los tiempos son los del video final (después del montaje de
showreel.html: CUT); si cambia el montaje, actualizalos acá.
"""

import subprocess
import wave

import numpy as np
from scipy.signal import butter, lfilter

SR = 44100
DUR = 38.2
rng = np.random.default_rng(7)

# ——— Momentos del video (segundos) ———
CLICKS = [0.93, 1.03]           # obturador: cierra y abre
WHOOSH = (1.55, 3.6)            # la foto vuela al formulario
TAPS = [4.6, 10.0, 12.8, 15.4, 17.8, 28.65]
DINGS = [4.82, 18.05]           # check de "Pozo reportado"
MUSIC_IN = 1.15                 # la música entra después del click
BAR0 = 2.45                     # primer compás; la caída (marca) cae en 6.45
DROP = 6.45
BREAK = (19.95, 21.95)          # el mapa se aleja: sin bombo, sube
END_HIT = 36.45                 # último golpe, con el botón
SPARKLE = 36.8                  # destello del botón

BEAT = 0.5
BAR = 4 * BEAT
N = int(SR * DUR)


def t_(d):
    return np.arange(int(SR * d)) / SR


def put(buf, x, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(x))
    buf[i:j] += gain * x[: j - i]


def lp(x, hz, order=2):
    b, a = butter(order, hz / (SR / 2), "low")
    return lfilter(b, a, x)


def hp(x, hz, order=2):
    b, a = butter(order, hz / (SR / 2), "high")
    return lfilter(b, a, x)


def bp(x, lo, hi, order=2):
    b, a = butter(order, [lo / (SR / 2), hi / (SR / 2)], "band")
    return lfilter(b, a, x)


def note(n):  # n en semitonos desde La 440
    return 440.0 * 2 ** (n / 12)


# ——— Instrumentos ———
def kick():
    t = t_(0.42)
    f = 46 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7.5) + 0.25 * np.exp(-t * 300) * rng.standard_normal(len(t))


def clap():
    t = t_(0.22)
    n = bp(rng.standard_normal(len(t)), 900, 5000)
    env = np.exp(-t * 22) * (1 + 0.6 * (np.sin(2 * np.pi * 90 * t) > 0) * (t < 0.03))
    return 0.9 * n * env + 0.3 * np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)


def hat(open_=False):
    t = t_(0.18 if open_ else 0.045)
    return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * (18 if open_ else 90))


def pluck(f, d=0.32):
    # Karplus-Strong: cuerda pulsada, brillante y corta.
    n = int(SR / f)
    buf = rng.uniform(-1, 1, n)
    out = np.empty(int(SR * d))
    for i in range(len(out)):
        out[i] = buf[i % n]
        buf[i % n] = 0.5 * (buf[i % n] + buf[(i + 1) % n]) * 0.996
    return out * np.exp(-np.arange(len(out)) / SR * 5)


def saw(f, d):
    t = t_(d)
    return sum(((-1) ** (k + 1)) * np.sin(2 * np.pi * f * k * t) / k for k in range(1, 12))


def pad(fs, d):
    t = t_(d)
    x = sum(saw(f * det, d) for f in fs for det in (0.997, 1.003))
    env = np.minimum(1, t / 0.4) * np.minimum(1, (d - t) / 0.5)
    return lp(x, 1800) * env / len(fs)


def bell(f, d=1.2):
    t = t_(d)
    return (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.76 * t)) * np.exp(-t * 4)


# ——— Armonía: La menor – Fa – Do – Sol (un acorde por compás) ———
CHORDS = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]]   # semitonos desde La 440 (Am F C G)
ROOTS = [-24, -28, -21, -26]                               # bajo: La1, Fa1, Do2, Sol1

music = np.zeros(N)
drums = np.zeros(N)
kick_env = np.zeros(N)  # para el sidechain

bar = 0
tb = BAR0
while tb < END_HIT:
    ch = CHORDS[bar % 4]
    full = tb >= DROP
    in_break = BREAK[0] <= tb < BREAK[1]
    # Pad todo el tiempo (desde la intro).
    put(music, pad([note(n - 12) for n in ch], BAR + 0.3), tb, 0.22)
    # Arpegio de cuerda: filtrado en la intro, abierto después de la caída.
    seq = [ch[0], ch[1], ch[2], ch[1] + 12, ch[2], ch[0] + 12, ch[1], ch[2] + 12]
    for i in range(8):
        x = pluck(note(seq[i]))
        put(music, x if full else lp(x, 1500), tb + i * BEAT / 2, 0.30 if full else 0.22)
    for b in range(4):
        at = tb + b * BEAT
        put(drums, hat(), at + BEAT / 2, 0.16)
        if full and not in_break:
            put(drums, kick(), at, 0.95)
            put(kick_env, np.exp(-t_(0.3) * 14), at, 1.0)
            if b % 2 == 1:
                put(drums, clap(), at, 0.55)
            put(drums, hat(), at, 0.08)
            # Bajo en contratiempo (el clásico "pump").
            put(music, lp(saw(note(ROOTS[bar % 4]), 0.24), 600) * np.exp(-t_(0.24) * 6), at + BEAT / 2, 0.42)
    if in_break and tb == BREAK[0]:
        # Subida durante el mapa: ruido que se abre + golpe al volver.
        t = t_(BREAK[1] - BREAK[0])
        r = bp(rng.standard_normal(len(t)), 300, 6000) * (t / t[-1]) ** 2
        put(drums, r, tb, 0.25)
    tb += BAR
    bar += 1

# Intro: subida antes de la caída.
t = t_(DROP - MUSIC_IN)
riser = bp(rng.standard_normal(len(t)), 400, 7000) * (t / t[-1]) ** 3
sweep = np.sin(2 * np.pi * np.cumsum(220 + 900 * (t / t[-1]) ** 2) / SR) * (t / t[-1]) ** 2
put(drums, riser * 0.22 + sweep * 0.06, MUSIC_IN)
# Golpes: caída, vuelta del mapa y final (bombo + platillo).
crash_t = t_(2.5)
crash = hp(rng.standard_normal(len(crash_t)), 4000) * np.exp(-crash_t * 2.2)
for at, g in ((DROP, 1.0), (BREAK[1], 0.8), (END_HIT, 1.0)):
    put(drums, kick(), at, 1.0)
    put(drums, crash, at, 0.35 * g)
# Acorde final que se apaga.
put(music, pad([note(n - 12) for n in CHORDS[0]], 2.0), END_HIT, 0.3)
put(music, lp(saw(note(ROOTS[0]), 1.6), 500) * np.exp(-t_(1.6) * 2.5), END_HIT, 0.45)

# Sidechain: pad y bajo se agachan con cada bombo.
music *= 1 - 0.55 * np.clip(kick_env, 0, 1)
mix_music = music + drums
fade_in = np.clip((np.arange(N) / SR - MUSIC_IN) / 0.25, 0, 1)
fade_out = np.clip((DUR - np.arange(N) / SR) / 1.2, 0, 1)
mix_music *= fade_in * fade_out

# ——— Efectos ———
sfx = np.zeros(N)
for i, at in enumerate(CLICKS):
    # Obturador: dos chasquidos secos con cuerpo.
    tt = t_(0.06)
    c = hp(rng.standard_normal(len(tt)), 2500) * np.exp(-tt * 140) + 0.8 * np.sin(2 * np.pi * (120 if i == 0 else 90) * tt) * np.exp(-tt * 60)
    put(sfx, c, at, 0.9)
tt = t_(WHOOSH[1] - WHOOSH[0])
sw = np.sin(np.pi * tt / tt[-1]) ** 2
put(sfx, bp(rng.standard_normal(len(tt)), 500, 3500) * sw, WHOOSH[0], 0.18)
for at in TAPS:
    tt = t_(0.05)
    put(sfx, np.sin(2 * np.pi * 1900 * tt) * np.exp(-tt * 90) + 0.4 * hp(rng.standard_normal(len(tt)), 5000) * np.exp(-tt * 200), at, 0.35)
for at in DINGS:
    put(sfx, bell(note(19)), at, 0.22)       # Mi 6
    put(sfx, bell(note(24)), at + 0.11, 0.22)  # La 6
for k, n in enumerate((24, 28, 31, 36)):
    put(sfx, bell(note(n), 0.8), SPARKLE + k * 0.06, 0.1)

# ——— Gancho: sonido real de la calle ———
raw = subprocess.run(
    [__import__("imageio_ffmpeg").get_ffmpeg_exe(), "-v", "error", "-i", "assets/gancho.m4a", "-f", "s16le", "-ac", "1", "-ar", str(SR), "-"],
    capture_output=True, check=True,
).stdout
street = np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768
street_buf = np.zeros(N)
put(street_buf, street, 0, 1.0)

mix = 0.55 * mix_music + 0.75 * sfx + 1.6 * street_buf
mix = np.tanh(1.3 * mix) / np.tanh(1.3)
mix *= 0.89 / np.max(np.abs(mix))
stereo = np.stack([mix, mix], axis=1)
with wave.open("assets/audio.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((stereo * 32767).astype(np.int16).tobytes())
subprocess.run([__import__("imageio_ffmpeg").get_ffmpeg_exe(), "-y", "-v", "error", "-i", "assets/audio.wav", "-c:a", "aac", "-b:a", "192k", "assets/audio.m4a"], check=True)
print("Listo: assets/audio.m4a")
