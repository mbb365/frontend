/* eslint-disable */
// @ts-nocheck
// HomeCore concept: copied from Move Assistant (src/weather-art.js), the
// Bitmap and 1-bit weather art.
// Weather art for the Bitmap and 1-bit styles (the Smooth style is the Figma SVG artwork in app.js).
// Ported from the "Weather card motion" Design canvas; the rules are written down in docs/weather-styles.md.
// Every condition is one icon in a different pose: the same parts (sun, moon, cloud, stars, rain, snow, lightning)
// in different places. Poses are in a 90 × 90 box whatever size the icon is drawn at.

// The canvas palette; app.js passes the card's --wx-* tokens over the ones it has.
export const WX_PALETTE = {
  skyClearDay: "#03a9f4",
  skyClearNight: "#1d2b4f",
  skyCloudyDay: "#d8d6d6",
  skyCloudyNight: "#363a45",
  skyRainDay: "#969696",
  skyRainNight: "#2d3139",
  skySnowDay: "#d4d8df",
  skySnowNight: "#384055",
  skyFogDay: "#dddcda",
  skyFogNight: "#3d4047",
  sun: "#ffe100",
  sunEdge: "#ffaa00",
  moon: "#f2c95e",
  star: "#ffffff",
  cloudDay: "#f1f1f1",
  cloudNight: "#d8d6d6",
  rain: "#03a9f4",
  snow: "#ffffff",
  dusk: "#d9876b",
};

const clamp = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, t) => a + (b - a) * t;
const hex = (h) => {
  const s = String(h || "#000000")
    .trim()
    .replace("#", "");
  const f =
    s.length === 3
      ? s
          .split("")
          .map((c) => c + c)
          .join("")
      : s;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) || 0);
};
const toHex = (c) =>
  "#" +
  c
    .map((x) =>
      Math.round(Math.max(0, Math.min(255, x)))
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
const MIX = {};
const mix = (a, b, t) => {
  const k = a + b + t;
  return (
    MIX[k] || (MIX[k] = toHex(hex(a).map((x, i) => x + (hex(b)[i] - x) * t)))
  );
};
const RGB = {};
const rgbOf = (h) => RGB[h] || (RGB[h] = hex(h));
const bez = (x1, y1, x2, y2) => (p) => {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  let lo = 0,
    hi = 1,
    t = p;
  for (let i = 0; i < 18; i++) {
    t = (lo + hi) / 2;
    const x =
      3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
    if (x < p) lo = t;
    else hi = t;
  }
  return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
};
const EASE = {
  std: bez(0.2, 0, 0, 1),
  acc: bez(0.3, 0, 1, 1),
  dec: bez(0, 0, 0, 1),
};

// Home Assistant condition → pose key "kind/day" or "kind/night"
export function wxKey(condition, night) {
  const c = String(condition || "");
  const k =
    c === "sunny" || c === "clear-night"
      ? "clear"
      : c === "partlycloudy"
        ? "partly"
        : c === "fog"
          ? "fog"
          : c === "lightning" || c === "lightning-rainy"
            ? "storm"
            : c === "snowy" || c === "snowy-rainy"
              ? "snow"
              : c === "rainy" || c === "pouring" || c === "hail"
                ? "rain"
                : "cloudy";
  return k + "/" + (c === "clear-night" || night ? "night" : "day");
}

function skies(C) {
  const S = {
    clear: [C.skyClearDay, C.skyClearNight],
    cloudy: [C.skyCloudyDay, C.skyCloudyNight],
    rain: [C.skyRainDay, C.skyRainNight],
    snow: [C.skySnowDay, C.skySnowNight],
    fog: [C.skyFogDay, C.skyFogNight],
  };
  S.partly = [
    mix(S.clear[0], S.cloudy[0], 0.12),
    mix(S.clear[1], S.cloudy[1], 0.12),
  ];
  S.storm = [mix(S.rain[0], "#000000", 0.22), mix(S.rain[1], "#000000", 0.22)];
  return S;
}
const STARS = [
  [61, 29, 4.4],
  [73, 16, 2.9],
  [79, 57, 3.3],
  [21, 77, 2.5],
  [13, 20, 2.3],
];
const DROPS = [
  [29.35, 60.65],
  [43.04, 60.65],
  [56.74, 60.65],
];
const FLAKES = [
  [30, 64],
  [44, 61],
  [58, 64],
  [37, 74],
  [51, 74],
];

// A part that is not in a pose still has a place: where it goes when it leaves and where it comes from when it arrives.
export function wxPose(key, colors = WX_PALETTE) {
  const C = { ...WX_PALETTE, ...colors },
    SKY = skies(C);
  const parts = String(key).split("/"),
    k = SKY[parts[0]] ? parts[0] : "clear",
    night = parts[1] === "night";
  const sky = SKY[k][night ? 1 : 0];
  const p = {
    night,
    clearness: k === "clear" ? 1 : k === "partly" ? 0.7 : 0.25,
    sky,
    skyStops: [sky],
    skyT: 0,
    sun: { x: 45, y: night ? 134 : 45, r: 33.26, o: 0 },
    moon: { x: 45, y: night ? 45 : 134, d: 64, o: 0 },
    cloud: { x: 134, y: 52.83, w: 58.7, o: 0, f: night ? 1 : 0 },
    stars: STARS.map(() => ({ o: 0 })),
    rain: DROPS.map(() => ({ o: 0, dy: -16 })),
    snow: FLAKES.map(() => ({ o: 0, dy: -16 })),
    bolt: { o: 0, dy: -10 },
  };
  const lit = (o) => STARS.map(() => ({ o }));
  if (k === "clear") {
    if (night) {
      p.moon.o = 1;
      p.stars = lit(1);
    } else p.sun.o = 1;
  } else if (k === "partly") {
    p.cloud = { x: 52.83, y: 52.83, w: 58.7, o: 1, f: night ? 1 : 0 };
    if (night) {
      p.moon = { x: 34, y: 33, d: 48, o: 1 };
      p.stars = lit(0.7);
    } else p.sun = { x: 35.22, y: 33.26, r: 23.48, o: 1 };
  } else if (k === "cloudy" || k === "fog") {
    p.cloud = { x: 45, y: 42.99, w: 66.52, o: 1, f: night ? 1 : 0 };
    if (night) p.moon = { x: 40, y: 36, d: 40, o: 0 };
    else p.sun = { x: 40, y: 36, r: 20, o: 0 };
  } else {
    p.cloud = { x: 45, y: 33.26, w: 58.7, o: 1, f: 1 };
    if (night) p.moon = { x: 38, y: 28, d: 36, o: 0 };
    else p.sun = { x: 38, y: 28, r: 18, o: 0 };
    if (k === "snow") p.snow = FLAKES.map(() => ({ o: 1, dy: 0 }));
    else
      p.rain = DROPS.map((d, i) => ({
        o: k === "storm" && i === 1 ? 0 : 1,
        dy: 0,
      }));
    if (k === "storm") p.bolt = { o: 1, dy: 0 };
  }
  return p;
}

// Changing condition: clouds arrive first and leave late, the sun and moon move in the middle,
// rain, snow and stars come last one at a time; the sky turns between, through dusk when day turns to night.
const W = {
  cloud: {
    enter: [0, 0.55, "dec"],
    leave: [0.25, 0.8, "acc"],
    stay: [0.1, 0.75, "std"],
  },
  body: {
    enter: [0.35, 0.9, "dec"],
    leave: [0.15, 0.65, "acc"],
    stay: [0.1, 0.75, "std"],
  },
  fx: {
    enter: [0.55, 1, "dec"],
    leave: [0, 0.35, "acc"],
    stay: [0.1, 0.75, "std"],
  },
  sky: [0.1, 0.8, "std"],
};
export function wxMorph(A, B, p, colors = WX_PALETTE, reduce = false) {
  const C = { ...WX_PALETTE, ...colors };
  const roleOf = (a, b) =>
    a > 0.01 && b > 0.01
      ? "stay"
      : a > 0.01
        ? "leave"
        : b > 0.01
          ? "enter"
          : "none";
  const prog = (w, i, n, st) => {
    const s = w[0] + i * st,
      e = w[1] - (n - 1 - i) * st;
    return EASE[w[2]](clamp((p - s) / Math.max(0.001, e - s)));
  };
  const tween = (a, b, g, i = 0, n = 1, st = 0) => {
    const r = roleOf(a.o, b.o);
    if (r === "none") return { ...b, o: 0 };
    const t = prog(W[g][r], i, n, st),
      out = {};
    // Reduced motion: parts fade where they are, nothing travels in or out
    for (const k in b)
      out[k] =
        reduce && r !== "stay" && k !== "o"
          ? r === "leave"
            ? a[k]
            : b[k]
          : lerp(a[k], b[k], t);
    return out;
  };
  const ts = prog(W.sky, 0, 1, 0);
  let sky, stops;
  if (A.night !== B.night) {
    const strength = Math.min(A.clearness, B.clearness),
      mid = mix(mix(A.sky, B.sky, 0.5), C.dusk, 0.6 * strength);
    sky = ts < 0.5 ? mix(A.sky, mid, ts * 2) : mix(mid, B.sky, ts * 2 - 1);
    stops = strength > 0.5 ? [A.sky, C.dusk, B.sky] : [A.sky, B.sky];
  } else {
    sky = mix(A.sky, B.sky, ts);
    stops = [A.sky, B.sky];
  }
  return {
    night: p < 0.5 ? A.night : B.night,
    clearness: lerp(A.clearness, B.clearness, p),
    sky,
    skyStops: stops,
    skyT: ts,
    sun: tween(A.sun, B.sun, "body"),
    moon: tween(A.moon, B.moon, "body"),
    cloud: tween(A.cloud, B.cloud, "cloud"),
    stars: B.stars.map((s, i) =>
      tween(A.stars[i], s, "fx", i, B.stars.length, 0.05)
    ),
    rain: B.rain.map((s, i) =>
      tween(A.rain[i], s, "fx", i, B.rain.length, 0.05)
    ),
    snow: B.snow.map((s, i) =>
      tween(A.snow[i], s, "fx", i, B.snow.length, 0.05)
    ),
    bolt: tween(A.bolt, B.bolt, "fx"),
  };
}

// Bitmap: shading is 8×8 ordered dither, never a blend. 1-bit maps every colour to ink or paper,
// snapping brightness to five levels first so each area gets one clean pattern, and outlines the shapes in ink.
const B8 = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36,
  14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23,
  61, 29, 53, 21,
];
const th = (x, y) => (B8[(y & 7) * 8 + (x & 7)] + 0.5) / 64;
const SKYID = 0,
  SUN = 1,
  MOON = 2,
  CLOUD = 3,
  RAIN = 4,
  SNOW = 5,
  BOLT = 6,
  STAR = 7,
  RAY = 8;
const inCloud = (u, v) =>
  v <= 0.6665 &&
  ((u - 0.5) * (u - 0.5) + (v - 0.2877) * (v - 0.2877) <= 0.0824 ||
    (u - 0.25) * (u - 0.25) + (v - 0.416) * (v - 0.416) <= 0.0625 ||
    (u - 0.791) * (u - 0.791) + (v - 0.458) * (v - 0.458) <= 0.0437 ||
    (u >= 0.25 && u <= 0.791 && v >= 0.416));
const BOLTPX = ["...##", "..##.", ".##..", "#####", "..##.", ".##..", ".#..."];
const BOLTPOLY = [
  [7, 0],
  [0, 13],
  [5, 13],
  [2, 24],
  [11, 9],
  [6, 9],
  [9, 0],
].map((p) => [(p[0] * 13) / 11, (p[1] * 28) / 24]);
const inPoly = (pts, x, y) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i],
      b = pts[j];
    if (
      a[1] > y !== b[1] > y &&
      x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
    )
      c = !c;
  }
  return c;
};

// Draws a pose. size: CSS px of the icon (54 or 90); px: CSS px per pixel (2 is the chosen grid).
// clock and idle are for the motion build: idle loops step at 10 frames a second.
export function wxBitmap(
  m,
  {
    size = 90,
    px = 2,
    oneBit = false,
    colors = WX_PALETTE,
    ink = "#26221e",
    paper = "#fbf9f6",
    clock = 0,
    idle = false,
  } = {}
) {
  const C = { ...WX_PALETTE, ...colors },
    S = Math.sin,
    TAU = Math.PI * 2;
  const G = Math.max(6, Math.round(size / px)),
    k = G / 90,
    fc = idle ? Math.floor(clock / 100) * 100 : 0;
  const sp = idle ? S((TAU * fc) / 3600) : 0,
    cdx = idle ? 1.8 * S((TAU * fc) / 6400) : 0,
    cdy = idle ? 0.9 * S((TAU * fc) / 4100) : 0,
    mby = idle ? 0.8 * S((TAU * fc) / 5200) : 0;
  const fl = (fc / 3400) % 1,
    flash = idle && m.bolt.o > 0.5 && (fl < 0.04 || (fl > 0.08 && fl < 0.11));
  const col = new Array(G * G),
    ids = new Uint8Array(G * G);
  const put = (x, y, cc, o, id) => {
    if (cc == null || x < 0 || y < 0 || x >= G || y >= G) return;
    if (o >= 1 || o > th(x + 5, y + 3)) {
      col[y * G + x] = cc;
      ids[y * G + x] = id;
    }
  };
  const box = (cx, cy, r, fn) => {
    for (
      let y = Math.max(0, Math.floor(cy - r) - 1);
      y <= Math.min(G - 1, cy + r + 1);
      y++
    )
      for (
        let x = Math.max(0, Math.floor(cx - r) - 1);
        x <= Math.min(G - 1, cx + r + 1);
        x++
      )
        fn(x, y, x + 0.5 - cx, y + 0.5 - cy);
  };
  // Sky: stops dither into each other; day lightens toward the horizon, night darkens toward the top
  const st = m.skyStops || [m.sky],
    sk = m.skyT || 0;
  for (let y = 0; y < G; y++) {
    const depth = m.night
      ? clamp(1 - (y + 0.5) / (G * 0.7)) * 0.85
      : clamp(((y + 0.5) / G - 0.35) / 0.65) * 0.85;
    for (let x = 0; x < G; x++) {
      let b = st[0];
      if (st.length > 1) {
        const u = sk * (st.length - 1),
          i = Math.min(st.length - 2, Math.floor(u));
        b = u - i > th(x, y) ? st[i + 1] : st[i];
      }
      if (depth > th(x + 2, y + 5))
        b = m.night ? mix(b, "#000000", 0.28) : mix(b, "#ffffff", 0.2);
      col[y * G + x] = flash ? mix(b, "#ffffff", 0.25) : b;
    }
  }
  // Sun: dithered terminator along the Figma gradient (140°, 65% to the edge); halo and rays when idle
  if (m.sun.o > 0.01) {
    const cx = m.sun.x * k,
      cy = m.sun.y * k,
      r = Math.max(1, m.sun.r * k);
    if (idle) {
      const hr = r * (1.45 + 0.06 * sp),
        hc = mix(C.sun, "#ffffff", 0.55);
      box(cx, cy, hr, (x, y, dx, dy) => {
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > r && d < hr)
          put(x, y, hc, 0.26 * (1 - (d - r) / (hr - r)) * m.sun.o, SKYID);
      });
      if (m.sun.o > 0.5) {
        const turn = Math.floor(fc / 500) % 2,
          len = Math.max(1, r * 0.22);
        for (let a = 0; a < 8; a++)
          if (a % 2 === turn)
            for (let s = r + 1.5; s < r + 1.5 + len; s += 0.7)
              put(
                Math.floor(cx + Math.cos((a * Math.PI) / 4) * s),
                Math.floor(cy + Math.sin((a * Math.PI) / 4) * s),
                C.sun,
                m.sun.o,
                RAY
              );
      }
    }
    box(cx, cy, r, (x, y, dx, dy) => {
      if (dx * dx + dy * dy > r * r) return;
      const pos = ((dx * 0.643 + dy * 0.766) / r + 1) / 2;
      put(
        x,
        y,
        clamp((pos - 0.62) / 0.38) > th(x, y) ? C.sunEdge : C.sun,
        m.sun.o,
        SUN
      );
    });
  }
  // Stars: a dot with arms that grow and shrink as it twinkles
  STARS.forEach((s, i) => {
    const so = m.stars[i].o;
    if (so < 0.01) return;
    const x = Math.floor(s[0] * k),
      y = Math.floor(s[1] * k),
      ph = idle ? (Math.floor(fc / 300) + i * 3) % 6 : 0;
    if (ph === 5) return;
    const arm = Math.round(s[2] * k * (ph === 4 ? 0.3 : ph < 2 ? 1 : 0.6));
    put(x, y, C.star, so, STAR);
    for (let a = 1; a <= arm; a++) {
      const cc = a === arm && arm > 1 ? mix(C.star, m.sky, 0.5) : C.star;
      put(x - a, y, cc, so, STAR);
      put(x + a, y, cc, so, STAR);
      put(x, y - a, cc, so, STAR);
      put(x, y + a, cc, so, STAR);
    }
  });
  // Moon: a disc with a bite out of it, dithered from light at the top to gold
  if (m.moon.o > 0.01) {
    const R = Math.max(1.5, m.moon.d * k * 0.37),
      cx = m.moon.x * k,
      cy = m.moon.y * k + (idle && mby > 0.4 ? -1 : 0);
    const bx = cx + 0.547 * R,
      by = cy - 0.503 * R,
      br = 0.82 * R,
      light = mix(C.moon, "#ffffff", 0.6);
    box(cx, cy, R, (x, y, dx, dy) => {
      if (dx * dx + dy * dy > R * R) return;
      const ex = x + 0.5 - bx,
        ey = y + 0.5 - by;
      if (ex * ex + ey * ey <= br * br) return;
      put(
        x,
        y,
        clamp(((dy + R) / (2 * R)) * 1.1 - 0.1) > th(x, y) ? C.moon : light,
        m.moon.o,
        MOON
      );
    });
  }
  // Rain: thin streaks at 12°
  const dl = Math.max(2, Math.round(15.65 * k)),
    dw = Math.max(1, Math.round(5.87 * k * 0.5));
  DROPS.forEach((d, i) => {
    const it = m.rain[i];
    let dy = it.dy,
      o = it.o;
    if (o < 0.01) return;
    if (idle) {
      const ph = (fc / 950 + i / 3) % 1;
      dy += -5 + ph * 14;
      o *= ph < 0.18 ? ph / 0.18 : ph > 0.72 ? (1 - ph) / 0.28 : 1;
    }
    const x0 = (d[0] + 3 + cdx) * k,
      y0 = (d[1] + dy) * k;
    for (let t = 0; t < dl; t++)
      for (let w = 0; w < dw; w++)
        put(
          Math.floor(x0 - 0.208 * t) + w,
          Math.floor(y0) + t,
          C.rain,
          o,
          RAIN
        );
  });
  // Snow: small crosses, with diagonals once there is room
  const fa = Math.max(0, Math.round((7.34 * k) / 2.6));
  FLAKES.forEach((d, i) => {
    const it = m.snow[i];
    let dy = it.dy,
      dx = 0,
      o = it.o;
    if (o < 0.01) return;
    if (idle) {
      const ph = (fc / 3200 + i / 5) % 1;
      dy += -6 + ph * 14;
      dx = 1.5 * S(TAU * (ph * 1.5 + i / 5));
      o *= ph < 0.2 ? ph / 0.2 : ph > 0.75 ? (1 - ph) / 0.25 : 1;
    }
    const x = Math.floor((d[0] + 3.67 + dx + cdx) * k),
      y = Math.floor((d[1] + 3.67 + dy) * k);
    put(x, y, C.snow, o, SNOW);
    for (let a = 1; a <= fa; a++) {
      put(x - a, y, C.snow, o, SNOW);
      put(x + a, y, C.snow, o, SNOW);
      put(x, y - a, C.snow, o, SNOW);
      put(x, y + a, C.snow, o, SNOW);
      if (fa > 1 && a < fa) {
        put(x - a, y - a, C.snow, o, SNOW);
        put(x + a, y - a, C.snow, o, SNOW);
        put(x - a, y + a, C.snow, o, SNOW);
        put(x + a, y + a, C.snow, o, SNOW);
      }
    }
  });
  // Lightning: the Figma shape on fine grids, a drawn sprite on coarse ones
  if (m.bolt.o > 0.01) {
    if (G >= 30) {
      const ox = 39 + cdx,
        oy = 50 + m.bolt.dy;
      for (let y = Math.floor(oy * k); y <= (oy + 28) * k; y++)
        for (let x = Math.floor(ox * k); x <= (ox + 13) * k; x++)
          if (inPoly(BOLTPOLY, (x + 0.5) / k - ox, (y + 0.5) / k - oy))
            put(x, y, C.sun, m.bolt.o, BOLT);
    } else {
      const s18 = G / 18,
        ox = 7,
        oy = 10 + Math.round(m.bolt.dy * 0.2);
      BOLTPX.forEach((row, sy) =>
        row.split("").forEach((ch, sx) => {
          if (ch !== "#") return;
          const x1 = Math.floor((ox + sx) * s18),
            y1 = Math.floor((oy + sy) * s18);
          for (
            let y = y1;
            y < Math.max(y1 + 1, Math.floor((oy + sy + 1) * s18));
            y++
          )
            for (
              let x = x1;
              x < Math.max(x1 + 1, Math.floor((ox + sx + 1) * s18));
              x++
            )
              put(x, y, C.sun, m.bolt.o, BOLT);
        })
      );
    }
  }
  // Cloud on top: dithered shade on its underside, a solid bottom edge
  if (m.cloud.o > 0.01) {
    const w = Math.max(3, m.cloud.w * k),
      h = w * 0.6665,
      ox = (m.cloud.x + cdx) * k - w / 2,
      oy = (m.cloud.y + cdy) * k - h / 2;
    const fill = mix(C.cloudDay, C.cloudNight, Math.round(m.cloud.f * 4) / 4),
      shade = mix(fill, "#000000", 0.16);
    for (
      let y = Math.max(0, Math.floor(oy) - 1);
      y <= Math.min(G - 1, oy + h + 1);
      y++
    )
      for (
        let x = Math.max(0, Math.floor(ox) - 1);
        x <= Math.min(G - 1, ox + w + 1);
        x++
      ) {
        const u = (x + 0.5 - ox) / w,
          v = (y + 0.5 - oy) / w;
        if (!inCloud(u, v)) continue;
        put(
          x,
          y,
          !inCloud(u, v + 1 / w) || clamp((v - 0.42) / 0.25) * 0.8 > th(x, y)
            ? shade
            : fill,
          m.cloud.o,
          CLOUD
        );
      }
  }
  return toPixels(col, ids, G, G, { oneBit, ink, paper, snowInk: !m.night });
}

// To pixels: colour as drawn, or ink and paper with outlines round the shapes. Empty cells stay clear.
function toPixels(col, ids, w, h, { oneBit, ink, paper, snowInk }) {
  const data = new Uint8ClampedArray(w * h * 4),
    inkRgb = rgbOf(ink),
    paperRgb = rgbOf(paper);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x,
        id = ids[i];
      if (col[i] == null) continue;
      let rgb = rgbOf(col[i]);
      if (oneBit) {
        let dark;
        if (id === RAIN || id === RAY) dark = true;
        else if (id === SNOW) dark = snowInk;
        else if (id === STAR || id === BOLT) dark = false;
        else
          dark =
            Math.round(
              ((0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255) * 4
            ) /
              4 <=
            th(x, y);
        if (
          (id === SUN || id === MOON || id === CLOUD || id === BOLT) &&
          ((x > 0 && ids[i - 1] !== id) ||
            (x < w - 1 && ids[i + 1] !== id) ||
            (y > 0 && ids[i - w] !== id) ||
            (y < h - 1 && ids[i + w] !== id))
        )
          dark = true;
        rgb = dark ? inkRgb : paperRgb;
      }
      data[i * 4] = rgb[0];
      data[i * 4 + 1] = rgb[1];
      data[i * 4 + 2] = rgb[2];
      data[i * 4 + 3] = 255;
    }
  return { w, h, data };
}

// ---- The 12-hour sky ----
// Six columns, one per day. Time runs across each column from 06:00 to 06:00 the next day, so the left half is the
// day and the right half the night; segs are the twelve halves in order, each {cond (Home Assistant condition), night}.
// Day and night meet along a wave: highest at noon, half way at dusk and dawn, lowest at midnight.
// Marks are placed in a 90 px tall sky and spread to the strip's height.
const COVER = {
  clear: 0,
  partly: 0.35,
  cloudy: 0.85,
  fog: 0.9,
  rain: 1,
  storm: 1,
  snow: 0.9,
};
const kindOfCond = (c) => wxKey(c, false).split("/")[0];
const seeded = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const CLOUD_PATH =
  "M41.0875 21.224C40.4398 17.9648 38.6815 15.0313 36.1125 12.9237C33.5435 10.816 30.3229 9.66488 27 9.66651C21.4608 9.66651 16.65 12.8098 14.2542 17.3907C11.4355 17.6995 8.83007 19.0382 6.93769 21.1499C5.0453 23.2616 3.99919 25.9976 4 28.8332C4 31.8832 5.2116 34.8082 7.36827 36.9649C9.52494 39.1216 12.45 40.3332 15.5 40.3332H40.4167C41.6752 40.3332 42.9213 40.0853 44.084 39.6037C45.2468 39.1221 46.3032 38.4162 47.1931 37.5263C48.083 36.6364 48.7889 35.5799 49.2705 34.4172C49.7521 33.2545 50 32.0083 50 30.7498C50 25.6898 46.0708 21.5882 41.0875 21.224Z";
const MOON_PATH =
  "M21.0459 6.11182C19.2847 8.44583 18.2402 11.3513 18.2402 14.5005C18.2405 22.199 24.4811 28.4398 32.1797 28.4399C34.9446 28.4399 37.5211 27.634 39.6885 26.2456C38.1734 34.0818 31.2788 40.0005 23 40.0005C13.6113 40.0005 6.00026 32.3891 6 23.0005C6 14.2725 12.5775 7.08102 21.0459 6.11182Z";
const STAR_PATH =
  "M0 -1L0.2687 -0.2687L1 0L0.2687 0.2687L0 1L-0.2687 0.2687L-1 0L-0.2687 -0.2687Z";
const BOLT_PATH = "M7 0L0 13L5 13L2 24L11 9L6 9L9 0Z";
const BOLT_STRIP = [
  [7, 0],
  [0, 13],
  [5, 13],
  [2, 24],
  [11, 9],
  [6, 9],
  [9, 0],
];
const BOLT_SMALL = [".##", "##.", ".#.", "#.."];

// HomeCore concept: columns (default 6) so the weather page can draw fewer days
function stripGeometry(
  segs,
  { width, height, colors, wave = 0.38, soft = 6, glow = 0.6, columns = 6 }
) {
  const C = { ...WX_PALETTE, dawn: "#e5a77e", ...colors },
    SKY = skies(C),
    W = width,
    H = height,
    cw = W / columns,
    sw = cw / 2,
    TAU = Math.PI * 2;
  const list = segs.length ? segs : [{ cond: "cloudy", night: false }];
  const S = [...Array(columns * 2)].map((_, i) => {
    const s = list[Math.min(i, list.length - 1)],
      k = kindOfCond(s.cond),
      night = i % 2 === 1;
    return {
      cond: s.cond,
      k,
      night,
      sky: SKY[k][night ? 1 : 0],
      cover: COVER[k],
    };
  });
  const yb = (x) => H * (0.5 - wave * Math.cos(TAU * (x / cw - 0.25)));
  const side = (night, x, y) => {
    const d = (night ? yb(x) - y : y - yb(x)) / Math.max(3, soft * 1.4) + 0.5;
    return d <= 0 ? 0 : d >= 1 ? 1 : d;
  };
  // a warm glow just under the wave at dusk and dawn, fainter under cloud
  const glowAt = (x) => {
    const ph = (((x / cw - 0.25) % 1) + 1) % 1,
      di = Math.max(0, Math.min(columns - 1, Math.round(x / cw - 0.25))),
      ni = Math.max(0, Math.min(columns - 1, Math.round(x / cw - 0.75)));
    const clear = 1 - (S[2 * di].cover + S[2 * ni + 1].cover) / 2,
      s = Math.sin(Math.PI * Math.min(1, Math.max(0, yb(x) / H)));
    return {
      c: ph < 0.5 ? C.dusk : C.dawn,
      a: glow * (0.2 + 0.8 * clear) * s * s,
    };
  };
  return {
    C,
    S,
    W,
    H,
    cw,
    sw,
    TAU,
    yb,
    side,
    glowAt,
    soft,
    tw: cw * 0.3,
    sy: H / 90,
  };
}

// Where the sun, moon, stars, clouds, rain, snow, fog and lightning sit, with a fixed seed so a week always looks the same
function stripMarks(G, { clock = 0, ambient = false, seed = 1 }) {
  const { S, sw, side, C, TAU, sy } = G,
    c = clock;
  const M = {
    stars: [],
    suns: [],
    moons: [],
    clouds: [],
    drops: [],
    flakes: [],
    fogs: [],
    bolts: [],
  };
  S.forEach((s, i) => {
    const r = seeded(seed * 977 + i * 131 + 7),
      cx = (i + 0.5) * sw;
    const n = s.night
      ? { clear: 9, partly: 5, cloudy: 2, fog: 0, rain: 0, storm: 0, snow: 1 }[
          s.k
        ]
      : 0;
    for (let j = 0; j < n; j++) {
      const x = cx + (r() - 0.5) * sw * 1.6,
        y = (6 + r() * 76) * sy,
        big = r() < 0.35,
        size = 1.8 + r() * 1.6;
      const o =
        side(true, x, y) *
        (big ? 0.95 : 0.7) *
        (ambient ? 0.6 + 0.4 * Math.sin((TAU * c) / 2600 + j * 1.7 + i) : 1);
      if (o >= 0.03) M.stars.push({ x, y, big, size, o });
    }
    if (!s.night && (s.k === "clear" || s.k === "partly")) {
      const x = cx + (r() - 0.5) * sw * 0.3,
        rad = Math.min(15, sw * 0.29);
      M.suns.push({
        x,
        y: 32 * sy,
        rad,
        halo:
          rad * 2.8 * (ambient ? 1 + 0.07 * Math.sin((TAU * c) / 3600 + i) : 1),
      });
    }
    if (s.night && (s.k === "clear" || s.k === "partly")) {
      const sc = Math.min(0.78, (sw * 0.55) / 34),
        x = cx - 23 * sc + (r() - 0.5) * sw * 0.2;
      M.moons.push({
        x: x + 23 * sc,
        y:
          (4 + (ambient ? 0.8 * Math.sin((TAU * c) / 5200 + i) : 0)) * sy +
          23 * sc,
        d: 46 * sc,
      });
    }
  });
  S.forEach((s, i) => {
    const n = {
      clear: 0,
      partly: 1,
      cloudy: 3,
      fog: 0,
      rain: 3,
      storm: 3,
      snow: 2,
    }[s.k];
    if (!n) return;
    const r = seeded(seed * 577 + i * 71 + 3),
      cx = (i + 0.5) * sw;
    const fill =
        s.k === "rain" || s.k === "storm" || s.night
          ? C.cloudNight
          : C.cloudDay,
      alpha = s.night ? 0.82 : s.k === "storm" ? 0.75 : 1;
    for (let j = 0; j < n; j++) {
      const sc = (sw / 46) * (s.k === "partly" ? 0.85 : 0.75 + r() * 0.55);
      const x = cx + (s.k === "partly" ? sw * 0.12 : (r() - 0.5) * sw * 1.05),
        y = (s.k === "partly" ? 40 : 6 + r() * 26) * sy;
      const dx = ambient
          ? 2.5 * Math.sin((TAU * c) / 9000 + i * 1.3 + j * 2.1)
          : 0,
        dy = ambient ? 0.9 * Math.sin((TAU * c) / 6100 + i + j) : 0;
      M.clouds.push({
        x: x - 23 * sc + dx,
        y: y - 15.33 * sc + dy,
        w: 46 * sc,
        h: 30.66 * sc,
        fill,
        o: alpha * (n > 1 && j === 0 ? 0.85 : 1),
      });
    }
  });
  S.forEach((s, i) => {
    const r = seeded(seed * 313 + i * 29 + 11),
      cx = (i + 0.5) * sw;
    const nr =
      s.cond === "pouring"
        ? 16
        : s.cond === "rainy" || s.cond === "hail"
          ? 9
          : s.cond === "lightning-rainy"
            ? 12
            : s.cond === "snowy-rainy"
              ? 5
              : 0;
    for (let j = 0; j < nr; j++) {
      let x = cx + (r() - 0.5) * sw * 1.05,
        y = 44 + r() * 36,
        fade = 1;
      if (ambient) {
        const yr = (((y - 44 + c * 0.04) % 36) + 36) % 36;
        x -= 0.21 * (yr - (y - 44));
        y = 44 + yr;
        fade = Math.min(1, yr / 6, (36 - yr) / 6);
      }
      y *= sy;
      const o = side(s.night, x, y) * fade;
      if (o >= 0.05) M.drops.push({ x, y, o });
    }
    const ns = s.cond === "snowy" ? 11 : s.cond === "snowy-rainy" ? 6 : 0;
    for (let j = 0; j < ns; j++) {
      let x = cx + (r() - 0.5) * sw * 1.05,
        y = 40 + r() * 44,
        fade = 1;
      if (ambient) {
        const yr = (((y - 40 + c * 0.009) % 44) + 44) % 44;
        y = 40 + yr;
        x += 1.6 * Math.sin((TAU * c) / 2800 + j * 1.9 + i);
        fade = Math.min(1, yr / 6, (44 - yr) / 6);
      }
      y *= sy;
      const o = side(s.night, x, y) * fade;
      if (o >= 0.05) M.flakes.push({ x, y, o });
    }
    if (s.k === "fog") {
      const fc = s.night ? "#c8ccd6" : "#ffffff",
        a = s.night ? 0.28 : 0.62,
        fx = ambient ? 4 * Math.sin((TAU * c) / 8000 + i) : 0;
      for (let j = 0; j < 4; j++)
        M.fogs.push({
          x: cx - sw * 0.75 + (j % 2) * sw * 0.18 + (j % 2 ? fx : -fx),
          y: (30 + j * 13) * sy,
          w: sw * 1.3,
          c: fc,
          a,
        });
    }
    if (s.k === "storm") {
      const fl = (c / 3400 + i * 0.37) % 1;
      M.bolts.push({
        x: cx + (r() - 0.5) * sw * 0.3 - 5,
        y: 36 * sy,
        o: ambient && !(fl < 0.05 || (fl > 0.09 && fl < 0.12)) ? 0.8 : 1,
      });
    }
  });
  return M;
}

function rasterStrip(G, M, GX, GY, pw, ph, clock, ambient) {
  const { S, C, cw, yb, glowAt, soft, tw, sy } = G;
  const col = new Array(GX * GY),
    ids = new Uint8Array(GX * GY),
    isNight = new Uint8Array(GX * GY);
  const put = (x, y, cc, o, id) => {
    if (cc == null || x < 0 || y < 0 || x >= GX || y >= GY) return;
    if (o >= 1 || o > th(x + 5, y + 3)) {
      col[y * GX + x] = cc;
      ids[y * GX + x] = id;
    }
  };
  const box = (cx, cy, r, fn) => {
    for (
      let y = Math.max(0, Math.floor(cy - r) - 1);
      y <= Math.min(GY - 1, cy + r + 1);
      y++
    )
      for (
        let x = Math.max(0, Math.floor(cx - r) - 1);
        x <= Math.min(GX - 1, cx + r + 1);
        x++
      )
        fn(x, y, x + 0.5 - cx, y + 0.5 - cy);
  };
  // each half keeps its colour; the hand-over is dithered where the other half hides it
  const bandAt = (cols, first, X) => {
    for (let i = 0; i < cols.length - 1; i++) {
      const b = (i + first) * cw;
      if (X < b - tw / 2) return [cols[i], cols[i], 0];
      if (X <= b + tw / 2) return [cols[i], cols[i + 1], (X - b + tw / 2) / tw];
    }
    const l = cols[cols.length - 1];
    return [l, l, 0];
  };
  const dayCols = S.filter((s) => !s.night).map((s) => s.sky),
    nightCols = S.filter((s) => s.night).map((s) => s.sky),
    sb = soft / ph,
    gb = (16 * sy) / ph;
  for (let x = 0; x < GX; x++) {
    const X = (x + 0.5) * pw,
      edge = yb(X) / ph,
      dB = bandAt(dayCols, 0.75, X),
      nB = bandAt(nightCols, 1.25, X),
      g = glowAt(X);
    for (let y = 0; y < GY; y++) {
      const t = th(x, y),
        dd = y + 0.5 - edge;
      const day = (sb > 0.01 ? clamp(0.5 + dd / sb) : dd > 0 ? 1 : 0) > t;
      let cc = day ? (dB[2] > t ? dB[1] : dB[0]) : nB[2] > t ? nB[1] : nB[0];
      // depth: day lightens toward the bottom, night darkens toward the top
      const depth = day
        ? clamp(((y + 0.5) / GY - 0.45) / 0.55) * 0.7
        : clamp(1 - (y + 0.5) / (GY * 0.55)) * 0.7;
      if (depth > th(x + 2, y + 5))
        cc = day ? mix(cc, "#ffffff", 0.18) : mix(cc, "#000000", 0.25);
      if (
        day &&
        dd >= 0 &&
        dd < gb &&
        g.a * 1.3 * (1 - dd / gb) > th(x + 6, y + 1)
      )
        cc = g.c;
      col[y * GX + x] = cc;
      isNight[y * GX + x] = day ? 0 : 1;
    }
  }
  const sunHalo = mix(C.sun, "#ffffff", 0.55),
    moonLight = mix(C.moon, "#ffffff", 0.6);
  M.stars.forEach((s) => {
    const x = Math.floor(s.x / pw),
      y = Math.floor(s.y / ph);
    if (
      x < 0 ||
      y < 0 ||
      x >= GX ||
      y >= GY ||
      !isNight[y * GX + x] ||
      s.o < 0.15
    )
      return;
    const cc = s.o > 0.45 ? C.star : mix(C.star, col[y * GX + x], 0.5),
      arm = s.big && s.o > 0.6 ? Math.floor(s.size / pw) : 0;
    put(x, y, cc, 1, STAR);
    for (let a = 1; a <= arm; a++)
      [
        [x - a, y],
        [x + a, y],
        [x, y - a],
        [x, y + a],
      ].forEach((p) => {
        if (
          p[0] >= 0 &&
          p[1] >= 0 &&
          p[0] < GX &&
          p[1] < GY &&
          isNight[p[1] * GX + p[0]]
        )
          put(p[0], p[1], cc, 1, STAR);
      });
  });
  M.suns.forEach((s) => {
    const r = Math.max(1.5, s.rad / pw),
      cx = s.x / pw,
      cy = s.y / ph,
      hr = (s.halo / pw) * 0.85;
    box(cx, cy, hr, (x, y, dx, dy) => {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > r && d < hr && !isNight[y * GX + x])
        put(x, y, sunHalo, 0.3 * (1 - (d - r) / (hr - r)), 0);
    });
    if (ambient) {
      const turn = Math.floor(clock / 500) % 2,
        len = Math.max(1, r * 0.3);
      for (let a = 0; a < 8; a++)
        if (a % 2 === turn)
          for (let q = r + 1.2; q < r + 1.2 + len; q += 0.7)
            put(
              Math.floor(cx + Math.cos((a * Math.PI) / 4) * q),
              Math.floor(cy + Math.sin((a * Math.PI) / 4) * q),
              C.sun,
              1,
              RAY
            );
    }
    box(cx, cy, r, (x, y, dx, dy) => {
      if (dx * dx + dy * dy <= r * r)
        put(
          x,
          y,
          clamp(((dy / r + 1) / 2 - 0.6) / 0.4) > th(x, y) ? C.sunEdge : C.sun,
          1,
          SUN
        );
    });
  });
  M.moons.forEach((m) => {
    const R = Math.max(1.5, (m.d * 0.37) / pw),
      cx = m.x / pw,
      cy = m.y / ph,
      bx = cx + 0.547 * R,
      by = cy - 0.503 * R,
      br = 0.82 * R;
    box(cx, cy, R, (x, y, dx, dy) => {
      if (dx * dx + dy * dy > R * R) return;
      const ex = x + 0.5 - bx,
        ey = y + 0.5 - by;
      if (ex * ex + ey * ey > br * br)
        put(
          x,
          y,
          clamp(((dy + R) / (2 * R)) * 1.1 - 0.1) > th(x, y)
            ? C.moon
            : moonLight,
          1,
          MOON
        );
    });
  });
  M.clouds.forEach((cl) => {
    const w = Math.max(3, cl.w / pw),
      h = w * 0.6665,
      ox = cl.x / pw,
      oy = cl.y / ph,
      shade = mix(cl.fill, "#000000", 0.16);
    for (
      let y = Math.max(0, Math.floor(oy) - 1);
      y <= Math.min(GY - 1, oy + h + 1);
      y++
    )
      for (
        let x = Math.max(0, Math.floor(ox) - 1);
        x <= Math.min(GX - 1, ox + w + 1);
        x++
      ) {
        const u = (x + 0.5 - ox) / w,
          q = (y + 0.5 - oy) / w;
        if (inCloud(u, q))
          put(
            x,
            y,
            !inCloud(u, q + 1 / w) || clamp((q - 0.42) / 0.25) * 0.8 > th(x, y)
              ? shade
              : cl.fill,
            cl.o,
            CLOUD
          );
      }
  });
  M.fogs.forEach((f) => {
    const y1 = Math.floor(f.y / ph),
      y2 = Math.max(y1, Math.floor((f.y + 6 * sy) / ph) - 1),
      x1 = Math.floor(f.x / pw),
      x2 = Math.floor((f.x + f.w) / pw);
    for (let y = y1; y <= y2; y++)
      for (let x = x1; x <= x2; x++) {
        const u = (x - x1) / Math.max(1, x2 - x1);
        put(
          x,
          y,
          f.c,
          f.a * (u < 0.25 ? u / 0.25 : u > 0.75 ? (1 - u) / 0.25 : 1),
          0
        );
      }
  });
  const dl = Math.max(2, Math.round(9 / ph));
  M.drops.forEach((d) => {
    const x0 = d.x / pw,
      y0 = Math.floor(d.y / ph);
    for (let t = 0; t < dl; t++)
      put(Math.floor(x0 - (0.208 * t * ph) / pw), y0 + t, C.rain, d.o, RAIN);
  });
  const fa = Math.max(0, Math.round(4.4 / pw / 2.6));
  M.flakes.forEach((k) => {
    const x = Math.floor(k.x / pw),
      y = Math.floor(k.y / ph);
    put(x, y, C.snow, k.o, SNOW);
    for (let a = 1; a <= fa; a++) {
      put(x - a, y, C.snow, k.o, SNOW);
      put(x + a, y, C.snow, k.o, SNOW);
      put(x, y - a, C.snow, k.o, SNOW);
      put(x, y + a, C.snow, k.o, SNOW);
    }
  });
  M.bolts.forEach((b) => {
    if (pw <= 3.5) {
      for (let y = Math.floor(b.y / ph); y <= (b.y + 24) / ph; y++)
        for (let x = Math.floor(b.x / pw); x <= (b.x + 11) / pw; x++)
          if (inPoly(BOLT_STRIP, (x + 0.5) * pw - b.x, (y + 0.5) * ph - b.y))
            put(x, y, C.sun, 1, BOLT);
    } else {
      const ox = Math.round(b.x / pw),
        oy = Math.round(b.y / ph);
      BOLT_SMALL.forEach((row, sy2) =>
        row.split("").forEach((ch, sx) => {
          if (ch === "#") put(ox + sx, oy + sy2, C.sun, 1, BOLT);
        })
      );
    }
  });
  return { col, ids };
}

// Bitmap and 1-bit sky. reveal (0–1) paints the sky in from the left, over prev (the last week's sky) if there was one;
// with reduce it dissolves instead.
export function wxStripBitmap(segs, o) {
  const px = o.px || 2,
    GX = Math.max(6, Math.round(o.width / px)),
    GY = Math.max(6, Math.round(o.height / px)),
    pw = o.width / GX,
    ph = o.height / GY;
  const clock = o.ambient ? Math.floor((o.clock || 0) / 100) * 100 : 0;
  const rasterOf = (sg) => {
    const G = stripGeometry(sg, o);
    return rasterStrip(
      G,
      stripMarks(G, { clock, ambient: o.ambient, seed: o.seed }),
      GX,
      GY,
      pw,
      ph,
      clock,
      o.ambient
    );
  };
  const nb = rasterOf(segs),
    f = o.reveal == null ? 1 : clamp(o.reveal);
  let col = nb.col,
    ids = nb.ids;
  if (f < 1) {
    const ob = o.prev ? rasterOf(o.prev) : null,
      edge = f * (GX + 12);
    col = new Array(GX * GY);
    ids = new Uint8Array(GX * GY);
    for (let i = 0; i < GX * GY; i++) {
      const x = i % GX,
        y = (i / GX) | 0,
        t = o.reduce ? f : clamp((edge - x) / 12);
      if (t > th(x, y)) {
        col[i] = nb.col[i];
        ids[i] = nb.ids[i];
      } else if (ob) {
        col[i] = ob.col[i];
        ids[i] = ob.ids[i];
      } else {
        col[i] = null;
        ids[i] = 255;
      }
    }
  }
  return toPixels(col, ids, GX, GY, {
    oneBit: o.oneBit,
    ink: o.ink || "#26221e",
    paper: o.paper || "#fbf9f6",
    snowInk: false,
  });
}

// Smooth sky, drawn on a 2D canvas context already scaled to CSS pixels. Soft edges are stacked bands, not filters,
// so it looks the same in every browser.
export function wxStripSmooth(ctx, segs, o) {
  const W = o.width,
    H = o.height,
    f = o.reveal == null ? 1 : clamp(o.reveal);
  const paint = (g, sg) => {
    const G = stripGeometry(sg, o);
    drawSmooth(g, G, stripMarks(G, o));
  };
  ctx.clearRect(0, 0, W, H);
  if (f >= 1) {
    paint(ctx, segs);
    return;
  }
  if (o.prev) paint(ctx, o.prev);
  if (o.reduce) {
    ctx.save();
    ctx.globalAlpha = f;
    paint(ctx, segs);
    ctx.restore();
    return;
  }
  // the new sky in an offscreen canvas, faded out past the moving edge, then laid over the old one
  const cv = ctx.canvas,
    off = cv.__wxOff || (cv.__wxOff = document.createElement("canvas"));
  if (off.width !== cv.width || off.height !== cv.height) {
    off.width = cv.width;
    off.height = cv.height;
  }
  const g = off.getContext("2d");
  g.setTransform(ctx.getTransform());
  g.clearRect(0, 0, W, H);
  paint(g, segs);
  const e = f * (W + 64) - 64,
    mask = g.createLinearGradient(e, 0, e + 64, 0);
  mask.addColorStop(0, "rgba(0,0,0,1)");
  mask.addColorStop(1, "rgba(0,0,0,0)");
  g.globalCompositeOperation = "destination-in";
  g.fillStyle = mask;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(off, 0, 0);
  ctx.restore();
}

function drawSmooth(ctx, G, M) {
  const { W, H, S, C, cw, yb, glowAt, soft, tw, sy } = G;
  const rgba = (h, a) => {
    const c = rgbOf(h);
    return (
      "rgba(" +
      c[0] +
      "," +
      c[1] +
      "," +
      c[2] +
      "," +
      Math.max(0, Math.min(1, a)).toFixed(3) +
      ")"
    );
  };
  const band = (cols, first) => {
    const gr = ctx.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, cols[0]);
    for (let i = 0; i < cols.length - 1; i++) {
      const m = (i + first) * cw,
        a = (m - tw / 2) / W,
        b = (m + tw / 2) / W;
      if (a > 0 && a < 1) gr.addColorStop(a, cols[i]);
      if (b > 0 && b < 1) gr.addColorStop(b, cols[i + 1]);
    }
    gr.addColorStop(1, cols[cols.length - 1]);
    return gr;
  };
  const N = Math.max(24, Math.ceil(W / 4));
  const region = (top, bottom) => {
    ctx.beginPath();
    for (let k = 0; k <= N; k++) {
      const x = (W * k) / N,
        y = top == null ? 0 : yb(x) + top;
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    for (let k = N; k >= 0; k--) {
      const x = (W * k) / N;
      ctx.lineTo(x, yb(x) + bottom);
    }
    ctx.closePath();
    ctx.fill();
  };
  ctx.save();
  ctx.fillStyle = band(
    S.filter((s) => !s.night).map((s) => s.sky),
    0.75
  );
  ctx.fillRect(0, 0, W, H);
  // glow under the wave in thin bands that fade downward
  const glow = ctx.createLinearGradient(0, 0, W, 0);
  for (let k = 0; k <= 64; k++) {
    const g = glowAt((W * k) / 64);
    glow.addColorStop(k / 64, rgba(g.c, Math.min(1, g.a)));
  }
  ctx.fillStyle = glow;
  for (let b = 0; b < 8; b++) {
    ctx.globalAlpha = 1 - b / 8;
    region(b * 2 * sy, (b + 1) * 2 * sy);
  }
  // night above the wave, its edge softened in bands
  ctx.fillStyle = band(
    S.filter((s) => s.night).map((s) => s.sky),
    1.25
  );
  const sf = Math.max(0.5, soft),
    n = 6;
  ctx.globalAlpha = 1;
  region(null, -sf);
  for (let b = 0; b < n; b++) {
    ctx.globalAlpha = 1 - (b + 0.5) / n;
    region(-sf + (2 * sf * b) / n, -sf + (2 * sf * (b + 1)) / n);
  }
  ctx.globalAlpha = 1;
  const star = new Path2D(STAR_PATH),
    moon = new Path2D(MOON_PATH),
    cloud = new Path2D(CLOUD_PATH),
    bolt = new Path2D(BOLT_PATH);
  ctx.fillStyle = C.star;
  M.stars.forEach((s) => {
    ctx.globalAlpha = s.o;
    if (s.big) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(s.size, s.size);
      ctx.fill(star);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(s.x, s.y, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.globalAlpha = 1;
  const halo = mix(C.sun, "#ffffff", 0.55);
  M.suns.forEach((s) => {
    const hg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.halo);
    hg.addColorStop(0, rgba(halo, 0.42));
    hg.addColorStop(0.7, rgba(halo, 0));
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.halo, 0, Math.PI * 2);
    ctx.fill();
    const dg = ctx.createLinearGradient(0, s.y - s.rad, 0, s.y + s.rad);
    dg.addColorStop(0.6, C.sun);
    dg.addColorStop(1, C.sunEdge);
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.rad, 0, Math.PI * 2);
    ctx.fill();
  });
  const light = mix(C.moon, "#ffffff", 0.6);
  M.moons.forEach((m) => {
    ctx.save();
    ctx.translate(m.x - m.d / 2, m.y - m.d / 2);
    ctx.scale(m.d / 46, m.d / 46);
    const mg = ctx.createLinearGradient(0, 6, 0, 40);
    mg.addColorStop(0, light);
    mg.addColorStop(1, C.moon);
    ctx.fillStyle = mg;
    ctx.fill(moon);
    ctx.restore();
  });
  M.clouds.forEach((cl) => {
    ctx.save();
    ctx.globalAlpha = cl.o;
    ctx.translate(cl.x, cl.y);
    ctx.scale(cl.w / 46, cl.h / 30.66);
    ctx.translate(-4, -9.67);
    ctx.fillStyle = cl.fill;
    ctx.fill(cloud);
    ctx.restore();
  });
  M.fogs.forEach((fg) => {
    const gr = ctx.createLinearGradient(fg.x, 0, fg.x + fg.w, 0);
    gr.addColorStop(0, rgba(fg.c, 0));
    gr.addColorStop(0.25, rgba(fg.c, fg.a));
    gr.addColorStop(0.75, rgba(fg.c, fg.a));
    gr.addColorStop(1, rgba(fg.c, 0));
    ctx.fillStyle = gr;
    ctx.fillRect(fg.x, fg.y, fg.w, 6 * sy);
  });
  ctx.fillStyle = C.rain;
  M.drops.forEach((d) => {
    ctx.save();
    ctx.globalAlpha = d.o;
    ctx.translate(d.x, d.y);
    ctx.rotate((12 * Math.PI) / 180);
    ctx.fillRect(-1.5, 0, 3, 9);
    ctx.restore();
  });
  ctx.fillStyle = C.snow;
  M.flakes.forEach((k) => {
    ctx.globalAlpha = k.o;
    ctx.beginPath();
    ctx.arc(k.x, k.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = C.sun;
  M.bolts.forEach((b) => {
    ctx.save();
    ctx.globalAlpha = b.o;
    ctx.translate(b.x, b.y);
    ctx.fill(bolt);
    ctx.restore();
  });
  ctx.restore();
}
