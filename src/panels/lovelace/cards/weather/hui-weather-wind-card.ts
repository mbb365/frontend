import { mdiWeatherWindy } from "@mdi/js";
import { css, html, nothing, svg } from "lit";
import { customElement } from "lit/decorators";
import "../../../../components/ha-card";
import { getWeatherValue, getBeaufort } from "../../../../data/weather_page";
import type { WeatherPageCardConfig } from "../types";
import { hcTile, homecoreStyles } from "./homecore";
import { WeatherPageCardBase } from "./weather-page-card-base";

const CARDINALS = [
  "n",
  "nne",
  "ne",
  "ene",
  "e",
  "ese",
  "se",
  "sse",
  "s",
  "ssw",
  "sw",
  "wsw",
  "w",
  "wnw",
  "nw",
  "nnw",
];

/** Wind speed, gusts and direction, with a compass. */
@customElement("hui-weather-wind-card")
export class HuiWeatherWindCard extends WeatherPageCardBase<WeatherPageCardConfig> {
  private _cardinal(bearing: number): string {
    // eslint-disable-next-line no-bitwise
    const key = CARDINALS[(((bearing + 11.25) / 22.5) | 0) % 16];
    return this.hass!.localize(`ui.card.weather.cardinal_direction.${key}`);
  }

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
    }
    const sources = this._config.entities;
    const speed = getWeatherValue(this.hass, sources, "wind_speed");
    if (!speed) {
      return nothing;
    }
    const gust = getWeatherValue(this.hass, sources, "wind_gust_speed");
    const bearingValue = getWeatherValue<number | string>(
      this.hass,
      sources,
      "wind_bearing"
    );
    const bearing =
      bearingValue && isFinite(Number(bearingValue.value))
        ? Number(bearingValue.value)
        : undefined;
    const beaufort = getBeaufort(
      speed.value,
      speed.stateObj.attributes.wind_speed_unit
    );
    const localize = this.hass.localize;

    const [number, ...unit] = this.hass
      .formatEntityAttributeValueToParts(
        speed.stateObj,
        "wind_speed",
        speed.value
      )
      .map((part) => part.value);
    const direction =
      bearing !== undefined ? this._cardinal(bearing) : undefined;
    const gusts = gust
      ? this.hass.formatEntityAttributeValue(
          gust.stateObj,
          "wind_gust_speed",
          gust.value
        )
      : undefined;

    const unitText = unit.join("").trim();
    const subParts = [
      direction
        ? localize("ui.card.weather.homecore.wind_from", { direction })
        : undefined,
      beaufort !== undefined
        ? `${beaufort} ${localize("ui.card.weather.beaufort")}`
        : undefined,
    ].filter(Boolean);

    return hcTile({
      icon: mdiWeatherWindy,
      name: localize("ui.card.weather.wind"),
      sub: subParts.join(" · ") || gusts,
      visual: this._renderCompass(number, unitText, bearing),
    });
  }

  /**
   * A round compass (made up from Matt's references): ticks round the edge,
   * N E S W, the speed on a bright disc and a marker where the wind comes
   * from.
   */
  private _renderCompass(speed: string, unit: string, bearing?: number) {
    const localize = this.hass!.localize;
    const ticks = Array.from({ length: 36 }, (_, index) => index * 10);
    const letters = [
      { key: "n", angle: 0 },
      { key: "e", angle: 90 },
      { key: "s", angle: 180 },
      { key: "w", angle: 270 },
    ];
    const at = (angle: number, radius: number) => {
      const rad = ((angle - 90) * Math.PI) / 180;
      return [100 + radius * Math.cos(rad), 100 + radius * Math.sin(rad)];
    };
    return html`<svg viewBox="0 0 200 200" aria-hidden="true">
      ${ticks.map((angle) => {
        const major = angle % 90 === 0;
        const [x1, y1] = at(angle, 97);
        const [x2, y2] = at(angle, major ? 83 : 89);
        return svg`<line class=${major ? "tick major" : "tick"} x1=${x1} y1=${y1} x2=${x2} y2=${y2}></line>`;
      })}
      ${letters.map(({ key, angle }) => {
        const [x, y] = at(angle, 64);
        return svg`<text class=${key === "n" ? "letter north" : "letter"} x=${x} y=${y}>${localize(`ui.card.weather.cardinal_direction.${key}`)}</text>`;
      })}
      ${
        bearing !== undefined
          ? svg`<path class="marker" transform="rotate(${bearing} 100 100)" d="M 100 24 L 91 5 L 109 5 Z"></path>`
          : nothing
      }
      <circle class="disc" cx="100" cy="100" r="46"></circle>
      <text class="speed" x="100" y="102">${speed}</text>
      <text class="speed-unit" x="100" y="124">${unit}</text>
    </svg>`;
  }

  static styles = [
    homecoreStyles,
    css`
      :host {
        display: block;
      }
      .hc-visual > svg {
        overflow: visible;
      }
      .tick {
        stroke: var(--hc-muted);
        stroke-width: 2.5;
        stroke-linecap: round;
      }
      .tick.major {
        stroke: var(--hc-text);
        stroke-width: 3;
      }
      .letter {
        fill: var(--hc-muted);
        font-size: 15px;
        font-weight: 600;
        text-anchor: middle;
        dominant-baseline: central;
      }
      .letter.north {
        fill: var(--hc-text);
      }
      .marker {
        fill: var(--hc-primary);
      }
      .disc {
        fill: var(--hc-text);
      }
      .speed {
        fill: var(--hc-card);
        font-size: 34px;
        font-weight: 500;
        letter-spacing: -0.5px;
        text-anchor: middle;
        dominant-baseline: central;
      }
      .speed-unit {
        fill: var(--hc-card);
        font-size: 12px;
        font-weight: 600;
        text-anchor: middle;
        dominant-baseline: central;
        opacity: 0.7;
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-weather-wind-card": HuiWeatherWindCard;
  }
}
