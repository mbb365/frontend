import { mdiWeatherSunny } from "@mdi/js";
import type { PropertyValues } from "lit";
import { css, html, LitElement, nothing, svg } from "lit";
import { customElement, property, state } from "lit/decorators";
import { styleMap } from "lit/directives/style-map";
import { formatTime } from "../../../../common/datetime/format_time";
import { getSunTimes } from "../../../../common/astronomy/sun_moon";
import "../../../../components/ha-card";
import type { LovelaceCardConfig } from "../../../../data/lovelace/config/card";
import type { HomeAssistant } from "../../../../types";
import type { LovelaceCard, LovelaceGridOptions } from "../../types";
import { hcTile, homecoreStyles } from "./homecore";

const MINUTE_MS = 60000;

/** A colour part way between two #rrggbb colours. */
const mix = (from: string, to: string, amount: number): string => {
  const parts = (hex: string) =>
    [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const a = parts(from);
  const b = parts(to);
  return `rgb(${a.map((value, index) => Math.round(value + (b[index] - value) * amount)).join(", ")})`;
};

/** Sunrise, sunset and daylight for the home location. */
@customElement("hui-weather-sun-card")
export class HuiWeatherSunCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _now = new Date();

  private _interval?: number;

  public setConfig(_config: LovelaceCardConfig): void {
    // Nothing to configure, the card uses the home location.
  }

  public getCardSize(): number {
    return 3;
  }

  public getGridOptions(): LovelaceGridOptions {
    return { columns: 6, rows: "auto", min_columns: 4 };
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this._interval = window.setInterval(() => {
      this._now = new Date();
    }, MINUTE_MS);
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._interval);
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.has("_now") || !changedProps.has("hass")) {
      return true;
    }
    const oldHass = changedProps.get("hass") as HomeAssistant | undefined;
    return (
      !oldHass ||
      oldHass.locale !== this.hass!.locale ||
      oldHass.localize !== this.hass!.localize ||
      oldHass.config !== this.hass!.config
    );
  }

  protected render() {
    if (!this.hass) {
      return nothing;
    }
    const { latitude, longitude } = this.hass.config;
    const { rise, set } = getSunTimes(this._now, latitude, longitude);
    const daylightMinutes =
      rise && set
        ? Math.round((set.getTime() - rise.getTime()) / MINUTE_MS)
        : 0;

    const hours = Math.floor(daylightMinutes / 60);
    const minutes = daylightMinutes % 60;

    // Where the sun is on its path: 0 at sunrise, 1 at sunset
    const progress =
      rise && set
        ? (this._now.getTime() - rise.getTime()) /
          (set.getTime() - rise.getTime())
        : -1;
    const up = progress >= 0 && progress <= 1;
    const angle = Math.PI * (1 - Math.min(1, Math.max(0, progress)));
    const sunX = 100 + 74 * Math.cos(angle);
    const sunY = 100 - 74 * Math.sin(angle);
    // How high the sun is: 0 on the horizon, 1 at midday. The sky and the sun
    // go from Matt's deep red at sunrise and sunset to warm gold at midday.
    const height = up ? Math.sin(Math.PI * progress) : 0;
    const top = up ? mix("#2e0a0d", "#43180a", height) : "#0e0507";
    const bottom = up ? mix("#7a1d12", "#8f400f", height) : "#1c0709";
    const core = mix("#f60c08", "#ff8f00", height);
    const edge = mix("#fd9b07", "#ffd84a", height);
    const line = up ? mix("#fd9b07", "#ffd84a", height) : "#6b3a2a";
    const time = (date?: Date) =>
      date ? formatTime(date, this.hass!.locale, this.hass!.config) : "–";

    return hcTile({
      icon: mdiWeatherSunny,
      name: this.hass.localize("ui.card.weather.sun"),
      sub: daylightMinutes
        ? this.hass.localize("ui.card.weather.homecore.daylight_short", {
            hours,
            minutes,
          })
        : undefined,
      visual: html`<div
        class="sky"
        style=${styleMap({
          background: `linear-gradient(180deg, ${top}, ${bottom})`,
          "--line": line,
        })}
      >
        <svg viewBox="0 0 200 124" aria-hidden="true">
          <defs>
            <radialGradient id="sun-glow">
              <stop offset="0" stop-color=${core} />
              <stop offset="0.45" stop-color=${core} />
              <stop offset="1" stop-color=${edge} />
            </radialGradient>
            <clipPath id="above-horizon">
              <rect x="0" y="0" width="200" height="100" />
            </clipPath>
          </defs>
          <path class="path" d="M 26 100 A 74 74 0 0 1 174 100" />
          <line class="horizon" x1="0" x2="200" y1="100" y2="100" />
          ${
            up
              ? svg`<circle cx=${sunX} cy=${sunY} r="20" fill="url(#sun-glow)" clip-path="url(#above-horizon)" />`
              : nothing
          }
          <text class="time" x="26" y="117">${time(rise)}</text>
          <text class="time" x="174" y="117">${time(set)}</text>
        </svg>
      </div>`,
    });
  }

  static styles = [
    homecoreStyles,
    css`
      :host {
        display: block;
      }
      /* Matt's reference: a glowing sun on a deep maroon sky */
      .sky {
        flex: 1;
        min-height: 0;
        display: flex;
        border-radius: clamp(12px, 6.3cqw, 16px);
        overflow: hidden;
        transition: background 1s ease;
      }
      .sky svg {
        display: block;
        width: 100%;
        height: 100%;
      }
      .path {
        fill: none;
        stroke: var(--line);
        stroke-opacity: 0.4;
        stroke-width: 1.5;
        stroke-dasharray: 2 5;
        stroke-linecap: round;
      }
      .horizon {
        stroke: var(--line);
        stroke-opacity: 0.3;
        stroke-width: 1;
      }
      .time {
        fill: var(--line);
        font-size: 13px;
        font-weight: 600;
        text-anchor: middle;
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-weather-sun-card": HuiWeatherSunCard;
  }
}
