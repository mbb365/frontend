// HomeCore concept: the weather page in Matt's HomeCore FINAL style (Figma
// "Move Assistant - Fun" → HomeCore FINAL). Values copied from the Figma frames
// and from Move Assistant's display.css / styles.css.
import type { TemplateResult } from "lit";
import { css, html, nothing, svg } from "lit";
import { styleMap } from "lit/directives/style-map";
import "../../../../components/ha-card";
import "../../../../components/ha-svg-icon";
import "./homecore-pixels";

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Inter:wght@400;500&display=swap";

export const loadHomecoreFonts = () => {
  if (document.getElementById("homecore-fonts")) {
    return;
  }
  const link = document.createElement("link");
  link.id = "homecore-fonts";
  link.rel = "stylesheet";
  link.href = FONTS_URL;
  document.head.appendChild(link);
};

// Figma "Color" variables, Dark and Light, as in Move Assistant
const DARK = {
  "--hc-page": "#090909",
  "--hc-card": "#222222",
  "--hc-tile": "#2b2b2b",
  "--hc-chip": "#090909",
  "--hc-text": "#f1f1f1",
  "--hc-muted": "#969696",
  "--hc-line": "rgba(255, 255, 255, 0.14)",
  "--hc-open-edge": "rgba(255, 255, 255, 0.1)",
  "--hc-hover": "rgba(255, 255, 255, 0.08)",
  "--hc-ink": "#222222",
  "--hc-paper": "#f1f1f1",
};
const LIGHT: typeof DARK = {
  "--hc-page": "#eeebe8",
  "--hc-card": "#fbf9f6",
  "--hc-tile": "#f3efea",
  "--hc-chip": "#fbf9f6",
  "--hc-text": "#26221e",
  "--hc-muted": "#6a625a",
  "--hc-line": "rgba(38, 34, 30, 0.12)",
  "--hc-open-edge": "#e3e3e3",
  "--hc-hover": "rgba(38, 34, 30, 0.06)",
  "--hc-ink": "#26221e",
  "--hc-paper": "#fbf9f6",
};

/** CSS custom properties for the panel: HomeCore colours, plus Home Assistant's own ones pointed at them. */
export const homecoreTokens = (dark: boolean): Record<string, string> => ({
  ...(dark ? DARK : LIGHT),
  "--hc-primary": "#03a9f4",
  "--hc-on-accent": "#f4f3f3",
  "--wx-clear": "#03a9f4",
  "--wx-cloudy": "#d8d6d6",
  "--wx-night": "#1d2b4f",
  "--wx-cloud-bright": "#f1f1f1",
  "--hc-font": 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
  "--hc-font-tile":
    'Geist, Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
  "--ha-font-family-body": "var(--hc-font)",
  "--primary-text-color": "var(--hc-text)",
  "--secondary-text-color": "var(--hc-muted)",
  "--primary-background-color": "var(--hc-page)",
  "--lovelace-background": "var(--hc-page)",
  "--ha-card-background": "var(--hc-card)",
  "--card-background-color": "var(--hc-card)",
  "--ha-card-border-radius": "34px",
  "--ha-card-border-width": "0",
  // Hairline in color/line: 0.2 all round with 0.4 along the bottom
  "--ha-card-box-shadow":
    "inset 0 0 0 0.2px var(--hc-line), inset 0 -0.4px 0 var(--hc-line)",
  "--divider-color": "var(--hc-line)",
  "--amber-color": "#ffaa00",
  "--ha-view-sections-column-gap": "16px",
  "--ha-view-sections-row-gap": "16px",
  "--ha-section-grid-row-gap": "16px",
  "--ha-section-grid-column-gap": "16px",
});

/** Shared pieces: card header, tiles, data point tiles, opened tiles, segments. */
export const homecoreStyles = css`
  :host {
    font-family: var(--hc-font);
    color: var(--hc-text);
    -webkit-font-smoothing: antialiased;
  }
  ha-card {
    color: var(--hc-text);
    font-family: var(--hc-font);
  }
  /* Card with a header: 14 above, 10 elsewhere, hairline 0.4 all round */
  ha-card.hc-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 10px 10px;
    box-shadow: inset 0 0 0 0.4px var(--hc-line);
  }
  .hc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 28px;
    padding: 0 18px;
  }
  .hc-title {
    margin: 0;
    font: 500 18px/1.2 var(--hc-font-tile);
    letter-spacing: -0.18px;
    color: var(--hc-text);
    white-space: nowrap;
  }
  /* Tile: 60 tall, padding 10, gap 12, corner 24, no fill until hovered */
  .hc-tile {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    min-height: 60px;
    box-sizing: border-box;
    padding: 10px;
    border: 0;
    border-radius: 24px;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
  }
  button.hc-tile {
    cursor: pointer;
    transition:
      background-color 0.15s ease,
      box-shadow 0.15s ease;
  }
  button.hc-tile:hover {
    background: var(--hc-tile);
    box-shadow:
      inset 0 0 0 0.2px var(--hc-line),
      inset 0 -0.4px 0 var(--hc-line);
  }
  button.hc-tile:focus-visible {
    outline: 2px solid var(--hc-primary);
    outline-offset: 2px;
  }
  .hc-chip {
    flex: none;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 16px;
    background: var(--hc-primary);
    color: var(--hc-on-accent);
    --mdc-icon-size: 24px;
  }
  .hc-chip.plain {
    background: var(--hc-chip);
    color: var(--hc-text);
  }
  .hc-text {
    display: flex;
    flex-direction: column;
    justify-content: center;
    flex: 1;
    min-width: 0;
    align-self: stretch;
    overflow: hidden;
    white-space: nowrap;
  }
  .hc-name {
    font: 600 14px/20px var(--hc-font-tile);
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .hc-sub {
    font: 400 16px/1.15 var(--hc-font);
    letter-spacing: -0.32px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* Square data tile (Matt, 26 Oct): only the title row keeps its place; the
     rest is one drawing. Everything scales with the tile, from 252 on
     desktop down to about 170 on phones. */
  :host {
    container-type: inline-size;
  }
  ha-card.hc-square {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, calc(5.6cqw * var(--hc-k, 1)), 14px);
    aspect-ratio: 1;
    --hc-k: 1;
    box-sizing: border-box;
    padding: clamp(12px, calc(7.9cqw * var(--hc-k, 1)), 20px);
    border-radius: clamp(22px, calc(11.1cqw * var(--hc-k, 1)), 28px);
    overflow: hidden;
  }
  /* Two squares wide: everything sized as in a square */
  ha-card.hc-square.double {
    aspect-ratio: 520 / 252;
    --hc-k: 0.4846;
  }
  .hc-square .hc-head {
    gap: clamp(8px, calc(4.8cqw * var(--hc-k, 1)), 12px);
  }
  .hc-square .hc-chip {
    width: clamp(30px, calc(15.9cqw * var(--hc-k, 1)), 40px);
    height: clamp(30px, calc(15.9cqw * var(--hc-k, 1)), 40px);
    border-radius: clamp(12px, calc(6.3cqw * var(--hc-k, 1)), 16px);
    --mdc-icon-size: clamp(18px, calc(9.5cqw * var(--hc-k, 1)), 24px);
  }
  .hc-square .hc-name {
    font-size: clamp(12px, calc(5.6cqw * var(--hc-k, 1)), 14px);
    line-height: 1.4;
  }
  .hc-square .hc-sub {
    font-size: clamp(13px, calc(6.3cqw * var(--hc-k, 1)), 16px);
  }
  .hc-visual {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: clamp(6px, calc(4cqw * var(--hc-k, 1)), 10px);
  }
  .hc-visual > svg {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 0;
  }
  .hc-value {
    display: flex;
    align-items: flex-start;
    gap: 2px;
    white-space: nowrap;
  }
  .hc-value .num {
    font: 500 clamp(30px, calc(17.5cqw * var(--hc-k, 1)), 44px)/1
      var(--hc-font-tile);
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .hc-value .unit {
    font: 300 clamp(13px, calc(7.1cqw * var(--hc-k, 1)), 18px)/1.25
      var(--hc-font-tile);
    color: var(--hc-muted);
  }
  .hc-scale-note {
    display: flex;
    justify-content: space-between;
    color: var(--hc-muted);
    font: 400 clamp(10px, calc(4.4cqw * var(--hc-k, 1)), 12px)/1.3
      var(--hc-font);
  }
  /* A tile whose whole card is the picture: the backdrop fills it and the
     title row and value sit on top */
  ha-card.hc-square.has-backdrop {
    position: relative;
    isolation: isolate;
  }
  .hc-backdrop {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    border-radius: inherit;
    pointer-events: none;
  }
  .hc-backdrop ~ * {
    position: relative;
    z-index: 1;
  }
  .hc-visual svg text {
    font-family: var(--hc-font-tile);
  }
  /* Data point tile: padding 20, corner 28, gap 14 */
  ha-card.hc-point {
    display: flex;
    flex-direction: column;
    gap: 14px;
    height: 100%;
    box-sizing: border-box;
    padding: 20px;
    border-radius: 28px;
  }
  .hc-head {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    min-width: 0;
  }
  .hc-big {
    display: flex;
    align-items: flex-start;
    gap: 2px;
    white-space: nowrap;
  }
  .hc-num {
    font: 500 64px/1 var(--hc-font-tile);
    letter-spacing: -1.28px;
    font-variant-numeric: tabular-nums;
  }
  .hc-unit {
    font: 300 24px/1.25 var(--hc-font-tile);
  }
  /* The graph or action space: 152.2 tall, corners 10 at the top and 18 below */
  .hc-graph {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 120px;
    box-sizing: border-box;
    padding: 12px 16px;
    border-radius: 10px 10px 18px 18px;
    background: var(--hc-tile);
    overflow: hidden;
    --card-background-color: var(--hc-tile);
  }
  /* Like the moon: the drawing on the left, the facts beside it */
  .hc-split {
    display: flex;
    align-items: center;
    gap: 16px;
    height: 100%;
    min-width: 0;
  }
  .hc-split > :first-child {
    flex: none;
  }
  /* Readings as in the moon frame: the name above, the value under it */
  .hc-facts {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    flex: 1;
    color: var(--hc-text);
  }
  .hc-fact {
    display: flex;
    flex-direction: column;
    min-width: 0;
    white-space: nowrap;
  }
  /* A level as a slider: 46 tall, corner 16, like the brightness bar */
  .hc-fill {
    position: relative;
    height: 46px;
    border-radius: 16px;
    background: var(--hc-card);
    overflow: hidden;
  }
  .hc-fill i {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: var(
      --hc-fill-gradient,
      linear-gradient(90deg, #8dd8fa, #03a9f4)
    );
  }
  .hc-chart {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .hc-chart .line {
    fill: none;
    stroke: var(--hc-primary);
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .hc-chart .area {
    fill: var(--hc-primary);
    opacity: 0.14;
  }
  .hc-chart .bar {
    fill: var(--hc-muted);
    opacity: 0.45;
  }
  .hc-chart .bar.now {
    fill: var(--hc-primary);
    opacity: 1;
  }
  .hc-chart .guide {
    stroke: var(--hc-muted);
    stroke-width: 1;
    stroke-dasharray: 2 4;
  }
  .hc-chart text {
    fill: var(--hc-muted);
    font: 400 11px var(--hc-font);
  }
  .hc-graph-note {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    color: var(--hc-muted);
    font: 400 12px/1.4 var(--hc-font);
  }
  /* Opened tile: fills its card, padding 10, corner 28, tile fill */
  .hc-open {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px;
    border-radius: 28px;
    background: var(--hc-tile);
    box-shadow: inset 0 0 0 0.4px var(--hc-open-edge);
  }
  .hc-open-head {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .hc-back {
    flex: none;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: var(--hc-text);
    cursor: pointer;
    --mdc-icon-size: 24px;
  }
  .hc-back:hover {
    background: var(--hc-hover);
  }
  .hc-open .hc-graph {
    flex: 1;
    height: auto;
    min-height: 152.2px;
    background: var(--hc-card);
  }
  /* Segments sit 4 inside a track: fine 12 = inner 16 − 4 */
  .hc-segments {
    display: inline-flex;
    gap: 0;
    padding: 4px;
    border-radius: 16px;
    background: var(--hc-page);
  }
  .hc-segments button {
    padding: 4px 12px;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: var(--hc-muted);
    font: 600 14px/20px var(--hc-font-tile);
    cursor: pointer;
  }
  .hc-segments button[aria-pressed="true"] {
    background: var(--hc-tile);
    color: var(--hc-text);
  }
  /* Weather icons: the condition on a coloured square */
  .hc-wx {
    position: relative;
    display: block;
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 16px;
    background: var(--hc-chip);
    overflow: hidden;
  }
  .hc-wx > svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  .hc-wx.s60 {
    width: 60px;
    height: 60px;
    border-radius: 20px;
  }
  .hc-wx.s90 {
    width: 90px;
    height: 90px;
    border-radius: 28px;
  }
  .hc-wx.clear,
  .hc-wx.partly {
    background: var(--wx-clear);
  }
  .hc-wx.cloudy {
    background: var(--wx-cloudy);
  }
  .hc-wx.rain,
  .hc-wx.snow {
    background: #969696;
  }
  .hc-wx.night {
    background: var(--wx-night);
  }
  .hc-wx .wxBright {
    fill: var(--wx-cloud-bright);
  }
  .hc-wx .wxCloudLight {
    fill: var(--wx-cloudy);
  }
  .hc-wx .wxAccent {
    fill: var(--hc-primary);
  }
`;

/** A weather condition as Move Assistant's animated 1-bit icon: 40, 60 or 90 wide. */
export const hcWeatherIcon = (
  condition: string,
  size: 40 | 60 | 90 = 40,
  isNight = false
) =>
  html`<span class="hc-wx s${size}" aria-hidden="true"
    ><hc-pixel-weather
      .condition=${condition}
      .night=${isNight}
      .size=${size}
    ></hc-pixel-weather
  ></span>`;

/** A big value: 64 Geist Medium numbers, each with a 24 Geist Light unit. */
export const hcBig = (...parts: [string, string?][]) =>
  html`<div class="hc-big">
    ${parts.map(
      ([num, unit]) =>
        html`<span class="hc-num">${num}</span>${
            unit ? html`<span class="hc-unit">${unit}</span>` : nothing
          }`
    )}
  </div>`;

/** Figma "DATA POINT TILE": chip, name and subdata, a big value and the graph space. */
export const hcDataPoint = (o: {
  icon: string;
  name: string;
  sub?: string | TemplateResult;
  value?: TemplateResult;
  graph?: TemplateResult;
}) =>
  html`<ha-card class="hc-point">
    <div class="hc-head">
      <div class="hc-chip plain">
        <ha-svg-icon .path=${o.icon}></ha-svg-icon>
      </div>
      <div class="hc-text">
        <span class="hc-name">${o.name}</span>
        ${o.sub ? html`<span class="hc-sub">${o.sub}</span>` : nothing}
      </div>
    </div>
    ${o.value ?? nothing}
    ${o.graph ? html`<div class="hc-graph">${o.graph}</div>` : nothing}
  </ha-card>`;

/** A line over time, filling the graph space, with labels at both ends. */
export const hcLineChart = (
  points: { label: string; value: number }[],
  format: (value: number) => string
) => {
  const W = 300;
  const H = 120;
  const top = 18;
  const bottom = 18;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => top + (1 - (v - min) / span) * (H - top - bottom);
  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  const maxIndex = values.indexOf(max);
  const minIndex = values.indexOf(min);
  const anchor = (i: number) =>
    i === 0 ? "start" : i === points.length - 1 ? "end" : "middle";
  return html`<svg class="hc-chart" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    ${svg`<polygon class="area" points="0,${H - bottom} ${line} ${W},${H - bottom}"></polygon>
    <polyline class="line" points=${line} vector-effect="non-scaling-stroke"></polyline>
    <text x=${x(maxIndex)} y=${y(max) - 6} text-anchor=${anchor(maxIndex)}>${format(max)}</text>
    <text x=${x(minIndex)} y=${y(min) + 14} text-anchor=${anchor(minIndex)}>${format(min)}</text>
    <text x="0" y=${H} text-anchor="start">${points[0].label}</text>
    <text x=${W} y=${H} text-anchor="end">${points[points.length - 1].label}</text>`}
  </svg>`;
};

/** Bars, one per value; the last one is now. */
export const hcBars = (
  bars: { label: string; value: number; now?: boolean }[],
  guide?: number
) => {
  const W = 300;
  const H = 120;
  const bottom = 16;
  const values = bars.map((b) => b.value).concat(guide ?? []);
  const min = Math.min(...values) - 2;
  const max = Math.max(...values) + 1;
  const span = max - min || 1;
  const slot = W / bars.length;
  const y = (v: number) => (1 - (v - min) / span) * (H - bottom);
  return html`<svg class="hc-chart" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    ${bars.map(
      (b, i) =>
        svg`<rect class="bar ${b.now ? "now" : ""}" x=${i * slot + slot * 0.2} y=${y(b.value)} width=${slot * 0.6} height=${H - bottom - y(b.value)} rx="6"></rect>
        <text x=${i * slot + slot / 2} y=${H} text-anchor="middle">${b.label}</text>`
    )}
    ${
      guide !== undefined
        ? svg`<line class="guide" x1="0" x2=${W} y1=${y(guide)} y2=${y(guide)}></line>`
        : nothing
    }
  </svg>`;
};

/** A slider filled up to a percentage. The gradient spans the whole track. */
export const hcFill = (percent: number, fill?: string) => {
  const value = Math.max(0, Math.min(100, percent));
  return html`<div class="hc-fill">
    <i
      style=${styleMap({
        "clip-path": `inset(0 ${100 - value}% 0 0 round 16px)`,
        ...(fill ? { "--hc-fill-gradient": fill } : {}),
      })}
    ></i>
  </div>`;
};

/** One reading beside a drawing: its name above, the value under it. */
export const hcFact = (name: string, value: string) =>
  html`<div class="hc-fact">
    <span class="hc-name">${name}</span>
    <span class="hc-sub">${value}</span>
  </div>`;

/** Square data tile: the title row, then one drawing that fills the rest. */
export const hcTile = (o: {
  icon: string;
  name: string;
  sub?: string | TemplateResult;
  visual: TemplateResult;
  double?: boolean;
  backdrop?: TemplateResult;
}) =>
  html`<ha-card
    class="hc-square ${o.double ? "double" : ""} ${
      o.backdrop ? "has-backdrop" : ""
    }"
  >
    ${
      o.backdrop
        ? html`<div class="hc-backdrop" aria-hidden="true">${o.backdrop}</div>`
        : nothing
    }
    <div class="hc-head">
      <div class="hc-chip plain">
        <ha-svg-icon .path=${o.icon}></ha-svg-icon>
      </div>
      <div class="hc-text">
        <span class="hc-name">${o.name}</span>
        ${o.sub ? html`<span class="hc-sub">${o.sub}</span>` : nothing}
      </div>
    </div>
    <div class="hc-visual">${o.visual}</div>
  </ha-card>`;

/** A value that scales with its tile. */
export const hcValue = (num: string, unit?: string) =>
  html`<div class="hc-value">
    <span class="num">${num}</span>${
      unit ? html`<span class="unit">${unit}</span>` : nothing
    }
  </div>`;
