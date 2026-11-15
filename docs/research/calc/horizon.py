"""Compute horizon elevation mask (360 azimuth bins) for a lunar south polar site
from PGDA LOLA COG DEM (south polar stereographic, MOON_ME, sphere R=1737.4 km).
Reads only the needed window via HTTP range requests (/vsicurl/)."""
import json, sys
import numpy as np
import rasterio
from rasterio.windows import from_bounds

R = 1737400.0
URL = "/vsicurl/https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF"


def latlon_to_xy(lat, lon):
    rho = 2 * R * np.tan(np.radians(90 + lat) / 2)
    return rho * np.sin(np.radians(lon)), rho * np.cos(np.radians(lon))


def xy_to_latlon(x, y):
    rho = np.hypot(x, y)
    return -(90 - 2 * np.degrees(np.arctan(rho / (2 * R)))), np.degrees(np.arctan2(x, y))


def unit(lat, lon):
    la, lo = np.radians(lat), np.radians(lon)
    return np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], -1)


def horizon(lat0, lon0, radius_m=150e3, mast_m=2.0, nbins=360):
    x0, y0 = latlon_to_xy(lat0, lon0)
    with rasterio.open(URL) as d:
        win = from_bounds(x0 - radius_m, y0 - radius_m, x0 + radius_m, y0 + radius_m, d.transform)
        z = d.read(1, window=win, boundless=True, fill_value=np.nan).astype(np.float64)
        T = d.window_transform(win)
    rows, cols = np.indices(z.shape)
    x = T.c + (cols + 0.5) * T.a
    y = T.f + (rows + 0.5) * T.e
    i0, j0 = int((y0 - T.f) / T.e), int((x0 - T.c) / T.a)
    h0 = z[i0, j0] + mast_m
    lat, lon = xy_to_latlon(x, y)
    P = unit(lat, lon) * (R + z)[..., None]
    up = unit(lat0, lon0)
    S = up * (R + h0)
    la, lo = np.radians(lat0), np.radians(lon0)
    east = np.array([-np.sin(lo), np.cos(lo), 0])
    north = np.array([-np.sin(la) * np.cos(lo), -np.sin(la) * np.sin(lo), np.cos(la)])
    v = P - S
    dist = np.linalg.norm(v, axis=-1)
    ok = np.isfinite(z) & (dist > 300) & (dist < radius_m)
    v, dist = v[ok], dist[ok]
    el = np.degrees(np.arcsin(v @ up / dist))
    az = np.degrees(np.arctan2(v @ east, v @ north)) % 360
    b = (az * nbins / 360).astype(int) % nbins
    mask = np.full(nbins, -90.0)
    np.maximum.at(mask, b, el)
    return {"lat": lat0, "lon": lon0, "site_height_m": round(float(z[i0, j0]), 1), "mast_m": mast_m,
            "radius_km": radius_m / 1e3, "dem": URL.split("/")[-1], "az_step_deg": 360 / nbins,
            "horizon_el_deg": [round(float(m), 2) for m in mask]}


if __name__ == "__main__":
    lat, lon, out = float(sys.argv[1]), float(sys.argv[2]), sys.argv[3]
    h = horizon(lat, lon, mast_m=float(sys.argv[4]) if len(sys.argv) > 4 else 2.0)
    json.dump(h, open(out, "w"))
    m = np.array(h["horizon_el_deg"])
    print(out, "site h", h["site_height_m"], "min/max/mean", m.min(), m.max(), m.mean().round(2))
