"""Extrae las calles del Partido de La Plata del dataset público alephcero/bsas_urban_area_streets
(OpenStreetMap vía osmnx, junio 2018, ODbL) leyendo el shapefile directo del zip, sin dependencias.

  git clone --depth 1 https://github.com/alephcero/bsas_urban_area_streets /tmp/bsas
  python3 -I scripts/extract_osmnx_laplata.py /tmp/bsas/callejero.zip data/osm-laplata-2018.json

Salida: lista de aristas {u, v, name, highway, osmid, coords} dentro de una caja alrededor del casco.
"""
import json, struct, sys, zipfile

BBOX = (-58.02, -34.98, -57.88, -34.86)  # lon_min, lat_min, lon_max, lat_max (casco + margen)

def dbf_records(f):
    header = f.read(32)
    n, header_len, rec_len = struct.unpack("<IHH", header[4:12])
    fields = []
    while True:
        first = f.read(1)
        if first[0] == 0x0D:  # fin de los descriptores: 1 byte, no 32
            break
        d = first + f.read(31)
        name = d[:11].split(b"\0")[0].decode("latin1")
        fields.append((name, d[11:12].decode(), d[16]))
    f.read(header_len - 32 - 32 * len(fields) - 1)  # relleno opcional
    for _ in range(n):
        raw = f.read(rec_len)
        rec, pos = {}, 1
        for name, _t, size in fields:
            rec[name] = raw[pos:pos + size].decode("latin1").strip()
            pos += size
        yield rec

def shp_records(f):
    f.read(100)
    while True:
        h = f.read(8)
        if len(h) < 8:
            return
        _num, length = struct.unpack(">ii", h)
        content = f.read(length * 2)
        shape_type = struct.unpack("<i", content[:4])[0]
        if shape_type == 0:
            yield None
            continue
        box = struct.unpack("<4d", content[4:36])
        nparts, npoints = struct.unpack("<ii", content[36:44])
        parts = struct.unpack(f"<{nparts}i", content[44:44 + 4 * nparts])
        off = 44 + 4 * nparts
        pts = struct.unpack(f"<{2 * npoints}d", content[off:off + 16 * npoints])
        coords = [[round(pts[2 * i], 7), round(pts[2 * i + 1], 7)] for i in range(npoints)]
        yield box, coords

def main(zip_path, out_path):
    z = zipfile.ZipFile(zip_path)
    out, fields_seen = [], None
    with z.open("callejero.dbf") as fd, z.open("callejero.shp") as fs:
        for rec, shp in zip(dbf_records(fd), shp_records(fs)):
            if fields_seen is None:
                fields_seen = list(rec.keys())
                print("campos:", fields_seen, file=sys.stderr)
            if "Plata" not in rec.get("partido", "") or shp is None:
                continue
            (x0, y0, x1, y1), coords = shp
            if x1 < BBOX[0] or x0 > BBOX[2] or y1 < BBOX[1] or y0 > BBOX[3]:
                continue
            out.append({"u": rec["from"], "v": rec["to"], "name": rec["name"], "highway": rec["highway"], "osmid": rec["osmid"]} | {"coords": coords})
    json.dump(out, open(out_path, "w"), ensure_ascii=False)
    print(f"{len(out)} aristas -> {out_path}", file=sys.stderr)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
