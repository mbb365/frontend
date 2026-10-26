import type { TemplateResult } from "lit";
import { css, html, nothing } from "lit";
import { customElement, state } from "lit/decorators";
import { styleMap } from "lit/directives/style-map";
import { DragScrollController } from "../../../../common/controllers/drag-scroll-controller";
import { formatTime } from "../../../../common/datetime/format_time";
import { formatNumber } from "../../../../common/number/format_number";
import "../../../../components/ha-card";
import type { ForecastAttribute } from "../../../../data/weather";
import { getWeatherUnit } from "../../../../data/weather";
import type { ToggleButton } from "../../../../types";
import type { LovelaceGridOptions } from "../../types";
import type { WeatherHourlyCardConfig, WeatherHourlyMode } from "../types";
import { homecoreStyles } from "./homecore";
import type { StripHalf } from "./homecore-pixels";
import { WeatherForecastController } from "./weather-forecast-controller";
import { WeatherPageCardBase } from "./weather-page-card-base";

const HOUR_MS = 3600000;
// The strip runs from 06:00 over three days: a column per day, each a day
// half (06–18) and a night half (18–06), as in Move Assistant's sky strip.
const COLUMNS = 3;
// About a day across the card; the rest scrolls
const PX_PER_HOUR = 20;
// A time and its values every three hours
const MARK_EVERY = 3;
const WET = new Set([
  "rainy",
  "pouring",
  "lightning",
  "lightning-rainy",
  "hail",
  "snowy",
  "snowy-rainy",
]);

interface Mark {
  x: number;
  label: string;
  entry?: ForecastAttribute;
}

/**
 * HomeCore concept: the coming hours as Move Assistant's bitmap sky strip, with the
 * times along the top and the temperature, rain or wind along the bottom.
 */
@customElement("hui-weather-hourly-card")
export class HuiWeatherHourlyCard extends WeatherPageCardBase<WeatherHourlyCardConfig> {
  @state() private _mode: WeatherHourlyMode = "temperature";

  private _forecast = new WeatherForecastController(this, ["hourly", "daily"]);

  private _dragScroll = new DragScrollController(this, {
    selector: ".strip-scroll",
  });

  public getGridOptions(): LovelaceGridOptions {
    return { columns: "full", rows: "auto" };
  }

  protected willUpdate(changedProps: Map<PropertyKey, unknown>): void {
    super.willUpdate(changedProps);
    if (this.hass && this._config) {
      this._forecast.setSources(this.hass, this._config.entities);
    }
  }

  private _hours(): ForecastAttribute[] {
    return this._forecast.get("hourly")?.forecast ?? [];
  }

  private _modes(entries: ForecastAttribute[]): WeatherHourlyMode[] {
    const modes: WeatherHourlyMode[] = ["temperature"];
    if (
      entries.some(
        (entry) =>
          entry.precipitation_probability != null || entry.precipitation != null
      )
    ) {
      modes.push("precipitation");
    }
    if (entries.some((entry) => entry.wind_speed != null)) {
      modes.push("wind");
    }
    return modes;
  }

  /** Where the strip starts: 06:00 today, or yesterday before 06:00. */
  private _start(): Date {
    const start = new Date();
    start.setHours(6, 0, 0, 0);
    if (start.getTime() > Date.now()) {
      start.setDate(start.getDate() - 1);
    }
    return start;
  }

  /**
   * The sky for each half: the most common hourly condition in it (rain and
   * snow count double), else that day's forecast.
   */
  private _halves(start: Date, hours: ForecastAttribute[]): StripHalf[] {
    const daily = this._forecast.get("daily")?.forecast ?? [];
    const halves: StripHalf[] = [];
    for (let column = 0; column < COLUMNS; column++) {
      for (const night of [false, true]) {
        const from =
          start.getTime() + (column * 24 + (night ? 12 : 0)) * HOUR_MS;
        const to = from + 12 * HOUR_MS;
        const count: Record<string, number> = {};
        hours.forEach((entry) => {
          const time = new Date(entry.datetime).getTime();
          if (entry.condition && time >= from && time < to) {
            count[entry.condition] =
              (count[entry.condition] ?? 0) +
              (WET.has(entry.condition) ? 2 : 1);
          }
        });
        let cond = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0];
        if (!cond) {
          const day = new Date(from).toDateString();
          cond =
            daily.find(
              (entry) => new Date(entry.datetime).toDateString() === day
            )?.condition ?? "cloudy";
        }
        halves.push({
          cond: night && cond === "sunny" ? "clear-night" : cond,
          night,
        });
      }
    }
    return halves;
  }

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
    }
    const hours = this._hours();
    const now = Date.now();
    const coming = hours.filter(
      (entry) => new Date(entry.datetime).getTime() > now - HOUR_MS
    );
    if (!coming.length) {
      return nothing;
    }
    const modes = this._modes(coming);
    const mode = modes.includes(this._mode) ? this._mode : "temperature";
    const buttons: ToggleButton[] = modes.map((value) => ({
      value,
      label: this.hass!.localize(`ui.card.weather.hourly_modes.${value}`),
    }));

    const start = this._start();
    const end = start.getTime() + COLUMNS * 24 * HOUR_MS;
    const offset = ((now - start.getTime()) / HOUR_MS) * PX_PER_HOUR;
    const total = COLUMNS * 24 * PX_PER_HOUR;
    const xOf = (time: number) => ((time - now) / HOUR_MS) * PX_PER_HOUR;

    const marks: Mark[] = [
      {
        x: 0,
        label: this.hass.localize("ui.card.weather.now"),
        entry: coming[0],
      },
      ...coming
        .filter((entry) => {
          const time = new Date(entry.datetime);
          // Room for "Now" on the left
          return (
            xOf(time.getTime()) >= 48 &&
            time.getTime() < end &&
            time.getHours() % MARK_EVERY === 0
          );
        })
        .map((entry) => {
          const time = new Date(entry.datetime);
          return {
            x: xOf(time.getTime()),
            label: formatTime(time, this.hass!.locale, this.hass!.config),
            entry,
          };
        }),
    ];

    return html`
      <ha-card class="hc-card">
        <div class="hc-header">
          <h2 class="hc-title">
            ${this.hass.localize("ui.card.weather.next_hours")}
          </h2>
        </div>
        ${
          modes.length > 1
            ? html`<div class="tabs">
                <div class="hc-segments" role="group">
                  ${buttons.map(
                    (button) =>
                      html`<button
                        aria-pressed=${button.value === mode ? "true" : "false"}
                        data-mode=${button.value}
                        @click=${this._setMode}
                      >
                        ${button.label}
                      </button>`
                  )}
                </div>
              </div>`
            : nothing
        }
        <div
          class="strip-scroll ${this._dragScroll.scrolling ? "dragging" : ""}"
        >
          <div
            class="strip"
            style=${styleMap({ width: `${total - offset}px` })}
          >
            <div class="row times">
              ${marks.map((mark, index) =>
                this._renderMark(mark, index, mark.label)
              )}
            </div>
            <div class="sky">
              <hc-pixel-strip
                style=${styleMap({
                  left: `${-offset}px`,
                  width: `${total}px`,
                })}
                .segs=${this._halves(start, hours)}
                .columns=${COLUMNS}
                .seed=${start.getDate()}
              ></hc-pixel-strip>
            </div>
            <div class="row values">
              ${marks.map((mark, index) => {
                if (!mark.entry) {
                  return nothing;
                }
                const [primary, secondary] = this._values(mark.entry, mode);
                return this._renderMark(
                  mark,
                  index,
                  html`<span class="primary">${primary}</span
                    ><span class="secondary">${secondary}</span>`
                );
              })}
            </div>
          </div>
        </div>
      </ha-card>
    `;
  }

  private _renderMark(
    mark: Mark,
    index: number,
    content: string | TemplateResult
  ) {
    return html`<span
      class="mark ${index === 0 ? "first" : ""}"
      style=${styleMap({ left: `${mark.x}px` })}
      >${content}</span
    >`;
  }

  private _values(
    entry: ForecastAttribute,
    mode: WeatherHourlyMode
  ): [string, string] {
    const hass = this.hass!;
    const stateObj = this._forecast.get("hourly")!.stateObj;
    const probability =
      entry.precipitation_probability != null
        ? `${formatNumber(entry.precipitation_probability, hass.locale)}%`
        : "";
    const amount = entry.precipitation
      ? `${formatNumber(entry.precipitation, hass.locale)} ${getWeatherUnit(
          hass.config,
          stateObj,
          "precipitation"
        )}`
      : "";

    switch (mode) {
      case "precipitation":
        return probability ? [probability, amount] : [amount || "–", ""];
      case "wind":
        return entry.wind_speed != null
          ? [
              formatNumber(Math.round(entry.wind_speed), hass.locale),
              getWeatherUnit(hass.config, stateObj, "wind_speed"),
            ]
          : ["–", ""];
      default:
        return [
          this._degrees(entry.temperature),
          // Only mention rain when it is likely enough to matter
          (entry.precipitation_probability ?? 0) >= 20 ? probability : "",
        ];
    }
  }

  private _setMode(ev: Event) {
    this._mode = (ev.currentTarget as HTMLElement).dataset
      .mode as WeatherHourlyMode;
  }

  static styles = [
    homecoreStyles,
    css`
      /* Fills its row in the bento: the sky takes the height left */
      :host {
        display: flex;
        flex-direction: column;
        container-type: inline-size;
      }
      ha-card.hc-card {
        flex: 1;
      }
      .tabs {
        padding: 0 18px;
      }
      .strip-scroll {
        flex: 1;
        min-height: 160px;
        display: flex;
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: none;
        border-radius: 24px;
        user-select: none;
      }
      .strip-scroll::-webkit-scrollbar {
        display: none;
      }
      .strip-scroll.dragging {
        cursor: grabbing;
      }
      .strip {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 100%;
        box-sizing: border-box;
        padding: 0 10px;
      }
      .row {
        position: relative;
        flex: none;
      }
      .times {
        height: 20px;
      }
      .values {
        height: 44px;
      }
      .mark {
        position: absolute;
        top: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        transform: translateX(-50%);
        white-space: nowrap;
      }
      .mark.first {
        align-items: flex-start;
        transform: none;
      }
      .times .mark {
        font: 400 14px/20px var(--hc-font);
        font-variant-numeric: tabular-nums;
      }
      .times .mark.first {
        font: 600 14px/20px var(--hc-font-tile);
      }
      /* The sky: one 1-bit picture over three days, shifted so now is on the left */
      .sky {
        position: relative;
        flex: 1;
        min-height: 72px;
        border-radius: 16px;
        overflow: hidden;
      }
      .sky hc-pixel-strip {
        position: absolute;
        top: 0;
        height: 100%;
      }
      .primary {
        font: 400 18px/20px var(--hc-font-tile);
        font-variant-numeric: tabular-nums;
      }
      .secondary {
        min-height: 20px;
        color: var(--hc-muted);
        font: 400 15px/20px var(--hc-font);
      }
      @container (width < 480px) {
        .hc-header,
        .tabs {
          padding: 0 8px;
        }
        .strip-scroll {
          min-height: 150px;
        }
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-weather-hourly-card": HuiWeatherHourlyCard;
  }
}
