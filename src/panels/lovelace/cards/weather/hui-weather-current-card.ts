import { mdiArrowLeft } from "@mdi/js";
import { css, html, nothing } from "lit";
import { customElement, state } from "lit/decorators";
import { sunAltitude } from "../../../../common/astronomy/sun_moon";
import { formatDateWeekdayShort } from "../../../../common/datetime/format_date";
import { formatTime } from "../../../../common/datetime/format_time";
import { formatNumber } from "../../../../common/number/format_number";
import "../../../../components/ha-card";
import "../../../../components/ha-svg-icon";
import type { ForecastAttribute } from "../../../../data/weather";
import {
  getPrimaryWeatherEntity,
  getWeatherValue,
} from "../../../../data/weather_page";
import type { LovelaceGridOptions } from "../../types";
import type { WeatherPageCardConfig } from "../types";
import { hcLineChart, hcWeatherIcon, homecoreStyles } from "./homecore";
import { WeatherForecastController } from "./weather-forecast-controller";
import { WeatherPageCardBase } from "./weather-page-card-base";

const DAYS = 6;

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * HomeCore concept: Figma "HC FINAL - Weather card". Now, then six days as
 * columns. On a narrow card the days are tiles two to a row ("Weather card ·
 * halves"). Tapping a day opens it inside the card.
 */
@customElement("hui-weather-current-card")
export class HuiWeatherCurrentCard extends WeatherPageCardBase<WeatherPageCardConfig> {
  @state() private _openDay?: number;

  private _forecast = new WeatherForecastController(this, ["daily", "hourly"]);

  public getGridOptions(): LovelaceGridOptions {
    return { columns: "full", rows: "auto" };
  }

  protected willUpdate(changedProps: Map<PropertyKey, unknown>): void {
    super.willUpdate(changedProps);
    if (this.hass && this._config) {
      this._forecast.setSources(this.hass, this._config.entities);
    }
  }

  private _isNight(): boolean {
    const { latitude, longitude } = this.hass!.config;
    return sunAltitude(new Date(), latitude, longitude) < 0;
  }

  private _days(): ForecastAttribute[] {
    return (this._forecast.get("daily")?.forecast ?? [])
      .filter((entry) => entry.templow != null)
      .slice(0, DAYS);
  }

  private _dayName(entry: ForecastAttribute): string {
    const date = new Date(entry.datetime);
    const now = new Date();
    if (isSameDay(date, now)) {
      return this.hass!.localize("ui.card.weather.homecore.today");
    }
    const tomorrow = new Date(now.getTime() + 86400000);
    if (isSameDay(date, tomorrow)) {
      return this.hass!.localize("ui.card.weather.homecore.tomorrow");
    }
    return formatDateWeekdayShort(date, this.hass!.locale, this.hass!.config);
  }

  private _shortName(entry: ForecastAttribute, index: number): string {
    return index === 0
      ? this._dayName(entry)
      : formatDateWeekdayShort(
          new Date(entry.datetime),
          this.hass!.locale,
          this.hass!.config
        );
  }

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
    }
    const sources = this._config.entities;
    const primary = getPrimaryWeatherEntity(this.hass, sources);
    if (!primary) {
      return nothing;
    }
    const days = this._days();
    if (this._openDay !== undefined && days[this._openDay]) {
      return this._renderOpenDay(days[this._openDay]);
    }

    const temperature = getWeatherValue(this.hass, sources, "temperature");
    const today = days[0];
    const hasToday = today && isSameDay(new Date(today.datetime), new Date());
    const unit = this.hass.config.unit_system.temperature;

    return html`
      <ha-card class="weather">
        <div class="now">
          <div class="current">
            ${hcWeatherIcon(primary.state, 90, this._isNight())}
            <div class="temp-block">
              ${
                temperature
                  ? html`<div class="temp">
                      <span class="deg"
                        >${formatNumber(
                          Math.round(temperature.value),
                          this.hass.locale
                        )}</span
                      ><span class="unit">${unit}</span>
                    </div>`
                  : nothing
              }
              <div class="place">${this.hass.config.location_name}</div>
            </div>
          </div>
          <div class="condition">
            <div class="cond-name">${this.hass.formatEntityState(primary)}</div>
            ${
              hasToday && today.templow != null
                ? html`<div class="range">
                    ${this.hass.localize("ui.card.weather.homecore.range", {
                      high: this._degrees(today.temperature),
                      low: this._degrees(today.templow),
                    })}
                  </div>`
                : nothing
            }
          </div>
        </div>
        ${
          days.length
            ? html`
                <div class="columns" role="list">
                  ${days.map(
                    (entry, index) => html`
                      <button
                        class="column"
                        role="listitem"
                        data-index=${index}
                        @click=${this._open}
                      >
                        <span class="day">
                          ${this._shortName(entry, index)}
                        </span>
                        ${hcWeatherIcon(entry.condition ?? "cloudy", 60)}
                        <span class="temps">
                          <span class="hi">
                            ${this._degrees(entry.temperature)}
                          </span>
                          <span class="lo"
                            >${this._degrees(entry.templow!)}</span
                          >
                        </span>
                      </button>
                    `
                  )}
                </div>
                <div class="halves" role="list">
                  ${days.map(
                    (entry, index) => html`
                      <button
                        class="hc-tile"
                        role="listitem"
                        data-index=${index}
                        @click=${this._open}
                      >
                        ${hcWeatherIcon(entry.condition ?? "cloudy", 40)}
                        <span class="hc-text">
                          <span class="hc-name">${this._dayName(entry)}</span>
                          <span class="hc-sub">
                            ${this.hass!.localize(
                              "ui.card.weather.homecore.high_low",
                              {
                                high: this._degrees(entry.temperature),
                                low: this._degrees(entry.templow!),
                              }
                            )}
                          </span>
                        </span>
                      </button>
                    `
                  )}
                </div>
              `
            : nothing
        }
      </ha-card>
    `;
  }

  private _renderOpenDay(entry: ForecastAttribute) {
    const hass = this.hass!;
    const date = new Date(entry.datetime);
    const hours = (this._forecast.get("hourly")?.forecast ?? []).filter(
      (hour) =>
        isSameDay(new Date(hour.datetime), date) &&
        new Date(hour.datetime).getTime() > Date.now() - 3600000
    );
    return html`
      <ha-card class="weather open">
        <div class="hc-open">
          <div class="hc-open-head">
            ${hcWeatherIcon(entry.condition ?? "cloudy", 40)}
            <div class="hc-text">
              <span class="hc-name">${this._dayName(entry)}</span>
              <span class="hc-sub">
                ${hass.localize("ui.card.weather.homecore.high_low", {
                  high: this._degrees(entry.temperature),
                  low: this._degrees(entry.templow!),
                })}
              </span>
            </div>
            <button
              class="hc-back"
              .title=${hass.localize("ui.card.weather.homecore.back")}
              @click=${this._close}
            >
              <ha-svg-icon .path=${mdiArrowLeft}></ha-svg-icon>
            </button>
          </div>
          <div class="hc-graph">
            ${
              hours.length > 1
                ? hcLineChart(
                    hours.map((hour) => ({
                      label: formatTime(
                        new Date(hour.datetime),
                        hass.locale,
                        hass.config
                      ),
                      value: hour.temperature,
                    })),
                    (value) => this._degrees(value)
                  )
                : html`<div class="no-hours">
                    <span class="cond-name">
                      ${
                        entry.condition
                          ? hass.formatEntityState(
                              this._forecast.get("daily")!.stateObj,
                              entry.condition
                            )
                          : ""
                      }
                    </span>
                    ${
                      entry.precipitation_probability != null
                        ? html`<span class="hc-sub">
                            ${hass.localize(
                              "ui.card.weather.homecore.rain_chance",
                              {
                                chance: `${formatNumber(
                                  entry.precipitation_probability,
                                  hass.locale
                                )}%`,
                              }
                            )}
                          </span>`
                        : nothing
                    }
                    <span class="hc-graph-note">
                      ${hass.localize("ui.card.weather.homecore.no_hourly")}
                    </span>
                  </div>`
            }
          </div>
        </div>
      </ha-card>
    `;
  }

  private _open(ev: Event) {
    this._openDay = Number((ev.currentTarget as HTMLElement).dataset.index);
  }

  private _close() {
    this._openDay = undefined;
  }

  static styles = [
    homecoreStyles,
    css`
      :host {
        display: block;
        container-type: inline-size;
      }
      ha-card.weather {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 20px;
      }
      ha-card.weather.open {
        padding: 10px;
        min-height: 243px;
      }
      .now {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
      }
      .current {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        min-width: 0;
      }
      .temp-block {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }
      .temp {
        display: flex;
        align-items: flex-start;
        gap: 2px;
        white-space: nowrap;
      }
      .deg {
        font: 500 64px/1 var(--hc-font-tile);
        letter-spacing: -1.28px;
      }
      .unit,
      .range {
        font: 300 24px/1.25 var(--hc-font-tile);
        white-space: nowrap;
      }
      .place {
        color: var(--hc-muted);
        font: 600 14px/20px var(--hc-font-tile);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .condition {
        flex: none;
        align-self: stretch;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 10px 16px;
        border-radius: 24px;
        background: var(--hc-tile);
      }
      .cond-name {
        font: 400 18px/1.2 var(--hc-font);
        letter-spacing: -0.18px;
        white-space: nowrap;
      }
      /* Six day columns, touching, each a tile */
      .columns {
        display: flex;
        height: 185px;
        border-radius: 28px;
        overflow: hidden;
      }
      .column {
        flex: 1 0 0;
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        padding: 16px 0;
        border: 0;
        border-radius: 24px;
        background: var(--hc-tile);
        color: var(--hc-text);
        font: inherit;
        cursor: pointer;
      }
      .column:hover {
        background: var(--hc-hover);
        box-shadow: inset 0 0 0 0.4px var(--hc-line);
      }
      .column:focus-visible {
        outline: 2px solid var(--hc-primary);
        outline-offset: -2px;
      }
      .day {
        font: 400 14px/1.4 var(--hc-font);
        white-space: nowrap;
      }
      .temps {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }
      .hi {
        font: 400 18px/20px var(--hc-font-tile);
      }
      .lo {
        color: var(--hc-muted);
        font: 400 18px/1.2 var(--hc-font);
        letter-spacing: -0.18px;
      }
      .halves {
        display: none;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .no-hours {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      /* Phone: Figma "Weather card · halves" */
      @container (width < 480px) {
        ha-card.weather {
          gap: 16px;
          padding: 10px;
        }
        .hc-wx.s90 {
          width: 60px;
          height: 60px;
          border-radius: 20px;
        }
        .deg {
          font-size: 46px;
          letter-spacing: -0.92px;
        }
        .range {
          font-size: 20px;
        }
        .condition {
          align-self: flex-start;
          gap: 0;
          border-radius: 28px;
        }
        .columns {
          display: none;
        }
        .halves {
          display: grid;
        }
      }
      @container (width < 280px) {
        .halves {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-weather-current-card": HuiWeatherCurrentCard;
  }
}
