import {
  mdiChartLine,
  mdiEyeOutline,
  mdiGauge,
  mdiWaterPercent,
  mdiWeatherRainy,
  mdiWeatherSunnyAlert,
} from "@mdi/js";
import type { PropertyValues, TemplateResult } from "lit";
import { css, html, nothing, svg } from "lit";
import { customElement, state } from "lit/decorators";
import { styleMap } from "lit/directives/style-map";
import { formatTime } from "../../../../common/datetime/format_time";
import { formatNumber } from "../../../../common/number/format_number";
import "../../../../components/ha-card";
import type { HistoryStates } from "../../../../data/history";
import { fetchStatistic } from "../../../../data/recorder";
import type {
  ModernForecastType,
  WeatherEntity,
} from "../../../../data/weather";
import { getWeatherUnit } from "../../../../data/weather";
import {
  getUvLevel,
  getWeatherValue,
  pressureToHpa,
  UV_LEVEL_COLORS,
} from "../../../../data/weather_page";
import type { WeatherMetric, WeatherMetricCardConfig } from "../types";
import { hcBars, hcTile, hcValue, homecoreStyles } from "./homecore";
import { WeatherForecastController } from "./weather-forecast-controller";
import { WeatherPageCardBase } from "./weather-page-card-base";

const HOUR_MS = 3600000;
const DAY_MS = 24 * HOUR_MS;
const REFRESH_MS = 30 * 60000;
// Days of history used for the average high. The recorder keeps 10 days by
// default, so a week fits for most people.
const AVERAGE_DAYS = 7;
const MIN_AVERAGE_DAYS = 3;
// Change in 3 hours that counts as rising or falling, in hPa
const PRESSURE_TREND_HPA = 1;

const ICONS: Record<WeatherMetric, string> = {
  humidity: mdiWaterPercent,
  pressure: mdiGauge,
  visibility: mdiEyeOutline,
  uv_index: mdiWeatherSunnyAlert,
  precipitation: mdiWeatherRainy,
  compared_to_average: mdiChartLine,
};

const FORECASTS: Partial<Record<WeatherMetric, ModernForecastType[]>> = {
  uv_index: ["hourly"],
  precipitation: ["hourly"],
  compared_to_average: ["daily"],
};

interface TemperatureHistory {
  entityId: string;
  // Highest temperature per earlier day
  dailyHighs: number[];
  days: { date: Date; high: number }[];
}

interface MetricContent {
  sub?: string;
  visual: TemplateResult;
  backdrop?: TemplateResult;
}

interface PressureHistory {
  entityId: string;
  // Pressure about 3 hours ago
  value: number;
}

/**
 * A single weather value, with a short explanation of what it means. The
 * card shows nothing when there is no data for its metric.
 */
@customElement("hui-weather-metric-card")
export class HuiWeatherMetricCard extends WeatherPageCardBase<WeatherMetricCardConfig> {
  @state() private _rainLast24h?: number;

  @state() private _temperatureHistory?: TemperatureHistory;

  @state() private _pressureHistory?: PressureHistory;

  private _forecast?: WeatherForecastController;

  private _lastFetch = 0;

  private _interval?: number;

  public setConfig(config: WeatherMetricCardConfig): void {
    if (!config.metric || !(config.metric in ICONS)) {
      throw new Error("Unknown weather metric");
    }
    super.setConfig(config);
    const types = FORECASTS[config.metric];
    if (types && !this._forecast) {
      this._forecast = new WeatherForecastController(this, types);
    }
  }

  public getGridOptions() {
    return { columns: 3, rows: "auto" as const, min_columns: 3 };
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this._interval = window.setInterval(() => this._fetch(), REFRESH_MS);
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._interval);
  }

  protected willUpdate(changedProps: PropertyValues): void {
    super.willUpdate(changedProps);
    if (!this.hass || !this._config) {
      return;
    }
    this._forecast?.setSources(this.hass, this._config.entities);
    if (changedProps.has("_config") || !this._lastFetch) {
      this._fetch();
    }
  }

  private async _fetch(): Promise<void> {
    if (!this.hass || !this._config) {
      return;
    }
    this._lastFetch = Date.now();
    try {
      switch (this._config.metric) {
        case "precipitation":
          await this._fetchRain();
          break;
        case "pressure":
          await this._fetchPressure();
          break;
        case "compared_to_average":
          await this._fetchTemperatureHistory();
          break;
      }
    } catch (_err) {
      // History is optional; the card shows what it has.
    }
  }

  private async _fetchRain(): Promise<void> {
    const entityId = this._config!.entity;
    if (!entityId) {
      return;
    }
    const statistic = await fetchStatistic(this.hass!, entityId, {
      rolling_window: { duration: { hours: 24 } },
    });
    this._rainLast24h = statistic.change ?? undefined;
  }

  private async _fetchAttributeHistory(
    entityId: string,
    start: Date
  ): Promise<HistoryStates> {
    return this.hass!.callWS<HistoryStates>({
      type: "history/history_during_period",
      start_time: start.toISOString(),
      end_time: new Date().toISOString(),
      entity_ids: [entityId],
      minimal_response: false,
      no_attributes: false,
      significant_changes_only: false,
    });
  }

  private async _fetchPressure(): Promise<void> {
    const pressure = getWeatherValue(
      this.hass!,
      this._config!.entities,
      "pressure"
    );
    if (!pressure) {
      return;
    }
    const entityId = pressure.stateObj.entity_id;
    const start = new Date(Date.now() - 3 * HOUR_MS);
    const history = await this._fetchAttributeHistory(entityId, start);
    // The first state is the one that was active 3 hours ago
    const value = history[entityId]?.find(
      (item) => typeof item.a?.pressure === "number"
    )?.a?.pressure;
    this._pressureHistory =
      typeof value === "number" ? { entityId, value } : undefined;
  }

  private async _fetchTemperatureHistory(): Promise<void> {
    const temperature = getWeatherValue(
      this.hass!,
      this._config!.entities,
      "temperature"
    );
    if (!temperature) {
      return;
    }
    const entityId = temperature.stateObj.entity_id;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const start = new Date(todayStart.getTime() - AVERAGE_DAYS * DAY_MS);
    const history = await this._fetchAttributeHistory(entityId, start);

    const highs = new Map<string, number>();
    for (const item of history[entityId] ?? []) {
      const value = item.a?.temperature;
      const time = new Date((item.lc ?? item.lu) * 1000);
      if (typeof value !== "number" || time >= todayStart) {
        continue;
      }
      const day = time.toDateString();
      highs.set(day, Math.max(highs.get(day) ?? -Infinity, value));
    }
    this._temperatureHistory = {
      entityId,
      dailyHighs: [...highs.values()],
      days: [...highs.entries()].map(([day, high]) => ({
        date: new Date(day),
        high,
      })),
    };
  }

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
    }
    const content = this._renderMetric(this._config.metric);
    if (!content) {
      return nothing;
    }
    // HomeCore concept: square HomeCore data tile
    return hcTile({
      icon: ICONS[this._config.metric],
      name: this.hass.localize(
        `ui.card.weather.metrics.${this._config.metric}`
      ),
      double: this._config.metric === "compared_to_average",
      ...content,
    });
  }

  private _renderMetric(metric: WeatherMetric): MetricContent | undefined {
    switch (metric) {
      case "humidity":
        return this._renderHumidity();
      case "pressure":
        return this._renderPressure();
      case "visibility":
        return this._renderVisibility();
      case "uv_index":
        return this._renderUvIndex();
      case "precipitation":
        return this._renderPrecipitation();
      case "compared_to_average":
        return this._renderComparedToAverage();
    }
    return undefined;
  }

  private _parts(stateObj: WeatherEntity, attribute: string, value: number) {
    const [number, ...unit] = this.hass!.formatEntityAttributeValueToParts(
      stateObj,
      attribute,
      value
    ).map((part) => part.value);
    return { number, unit: unit.join("").trim() };
  }

  private _renderHumidity(): MetricContent | undefined {
    const sources = this._config!.entities;
    const humidity = getWeatherValue(this.hass!, sources, "humidity");
    if (!humidity) {
      return undefined;
    }
    const dewPoint = getWeatherValue(this.hass!, sources, "dew_point");
    const level = Math.max(0, Math.min(100, humidity.value));
    return {
      sub: dewPoint
        ? this.hass!.localize("ui.card.weather.homecore.dew_point", {
            dew_point: this._degrees(dewPoint.value),
          })
        : undefined,
      // The whole card is the picture: misty water up to the humidity
      backdrop: html`<div
        class="water"
        style=${styleMap({ height: `${level}%` })}
      >
        <div class="mist"></div>
        <div class="body"></div>
        <div class="haze one"></div>
        <div class="haze two"></div>
      </div>`,
      visual: html`<div class="water-value">
        ${hcValue(formatNumber(Math.round(humidity.value), this.hass!.locale), "%")}
      </div>`,
    };
  }

  private _renderVisibility(): MetricContent | undefined {
    const visibility = getWeatherValue(
      this.hass!,
      this._config!.entities,
      "visibility"
    );
    if (!visibility) {
      return undefined;
    }
    const { number, unit } = this._parts(
      visibility.stateObj,
      "visibility",
      visibility.value
    );
    return { visual: hcValue(number, unit) };
  }

  private _renderPressure(): MetricContent | undefined {
    const pressure = getWeatherValue(
      this.hass!,
      this._config!.entities,
      "pressure"
    );
    if (!pressure) {
      return undefined;
    }
    const unit = pressure.stateObj.attributes.pressure_unit;
    const hpa = pressureToHpa(pressure.value, unit);
    const previous =
      this._pressureHistory?.entityId === pressure.stateObj.entity_id
        ? pressureToHpa(this._pressureHistory.value, unit)
        : undefined;

    let trend: "rising" | "falling" | "steady" | undefined;
    if (hpa !== undefined && previous !== undefined) {
      const change = hpa - previous;
      trend =
        change >= PRESSURE_TREND_HPA
          ? "rising"
          : change <= -PRESSURE_TREND_HPA
            ? "falling"
            : "steady";
    }
    const parts = this._parts(
      pressure.stateObj,
      "pressure",
      Math.round(pressure.value)
    );

    return {
      sub: trend
        ? this.hass!.localize(`ui.card.weather.homecore.pressure_${trend}`)
        : undefined,
      visual: html`<div class="tape-row">
        <div class="tape-value">
          ${hcValue(parts.number)}
          <span class="tape-unit">${parts.unit}</span>
        </div>
        ${hpa !== undefined ? this._renderTape(hpa) : nothing}
      </div>`,
    };
  }

  /**
   * Pressure as a vertical tape (Matt's altimeter reference): a tick per hPa,
   * a label every 5, the red marker at the current value. Higher is up.
   */
  private _renderTape(hpa: number) {
    const STEP = 9;
    const centre = 100;
    const first = Math.floor(hpa) - 11;
    const ticks = Array.from({ length: 24 }, (_, index) => first + index);
    return html`<svg
      class="tape"
      viewBox="0 0 76 200"
      preserveAspectRatio="xMaxYMid meet"
      aria-hidden="true"
    >
      ${ticks.map((value) => {
        const y = centre - (value - hpa) * STEP;
        if (y < 22 || y > 178) {
          return nothing;
        }
        const major = value % 5 === 0;
        const opacity = Math.max(0.15, 1 - Math.abs(y - centre) / 100);
        return svg`<g opacity=${opacity}>
          <line class="tape-tick" x1=${major ? 2 : 8} x2="26" y1=${y} y2=${y}></line>
          ${
            major
              ? svg`<text class="tape-label" x="33" y=${y}>${formatNumber(value, this.hass!.locale, { useGrouping: false })}</text>`
              : nothing
          }
        </g>`;
      })}
      <text class="tape-end" x="14" y="8">
        ${this.hass!.localize("ui.card.weather.high")}
      </text>
      <text class="tape-end" x="14" y="192">
        ${this.hass!.localize("ui.card.weather.low")}
      </text>
      <line class="tape-marker" x1="0" x2="30" y1=${centre} y2=${centre}></line>
    </svg>`;
  }

  private _renderUvIndex(): MetricContent | undefined {
    const uv = getWeatherValue(this.hass!, this._config!.entities, "uv_index");
    if (!uv) {
      return undefined;
    }
    const level = getUvLevel(uv.value);
    const levelName = this.hass!.localize(`ui.card.weather.uv_level.${level}`);

    // Highest UV index in the coming hours of today, from the hourly forecast
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const peak = (this._forecast?.get("hourly")?.forecast ?? [])
      .filter(
        (entry) =>
          entry.uv_index != null &&
          new Date(entry.datetime) > new Date() &&
          new Date(entry.datetime) <= endOfDay
      )
      .reduce<{ uv: number; time: Date } | undefined>(
        (best, entry) =>
          !best || entry.uv_index! > best.uv
            ? { uv: entry.uv_index!, time: new Date(entry.datetime) }
            : best,
        undefined
      );

    return {
      sub:
        peak && peak.uv > uv.value
          ? this.hass!.localize("ui.card.weather.homecore.uv_peak", {
              level: levelName,
              uv_index: formatNumber(Math.round(peak.uv), this.hass!.locale),
              time: formatTime(peak.time, this.hass!.locale, this.hass!.config),
            })
          : levelName,
      visual: this._renderVuMeter(uv.value),
    };
  }

  /**
   * UV as a VU meter: an arc from 0 to 11+ in the UV level colours, a needle
   * that swings in, the number in the housing.
   */
  private _renderVuMeter(value: number) {
    const SWEEP = 48;
    const PIVOT_X = 100;
    const PIVOT_Y = 130;
    const angleOf = (v: number) => -SWEEP + (Math.min(v, 11) / 11) * 2 * SWEEP;
    const at = (angle: number, radius: number) => {
      const rad = (angle * Math.PI) / 180;
      return [
        PIVOT_X + radius * Math.sin(rad),
        PIVOT_Y - radius * Math.cos(rad),
      ];
    };
    const arc = (from: number, to: number, radius: number) => {
      const [x1, y1] = at(angleOf(from), radius);
      const [x2, y2] = at(angleOf(to), radius);
      return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
    };
    const zones = [
      { from: 0, to: 3, color: UV_LEVEL_COLORS.low },
      { from: 3, to: 6, color: UV_LEVEL_COLORS.moderate },
      { from: 6, to: 8, color: UV_LEVEL_COLORS.high },
      { from: 8, to: 11, color: UV_LEVEL_COLORS.very_high },
    ];
    const ticks = Array.from({ length: 23 }, (_, index) => index / 2);
    return html`<svg class="vu" viewBox="0 0 200 134" aria-hidden="true">
      <defs>
        <radialGradient id="vu-glow" cx="0.5" cy="1" r="0.9">
          <stop offset="0" stop-color="#ffb74d" stop-opacity="0.16" />
          <stop offset="1" stop-color="#ffb74d" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect
        x="0"
        y="0"
        width="200"
        height="134"
        rx="14"
        fill="url(#vu-glow)"
      ></rect>
      ${zones.map(
        (zone) =>
          svg`<path class="vu-zone" d=${arc(zone.from, zone.to, 96)} stroke=${zone.color}></path>`
      )}
      ${ticks.map((tick) => {
        const major = Number.isInteger(tick);
        const [x1, y1] = at(angleOf(tick), 102);
        const [x2, y2] = at(angleOf(tick), major ? 114 : 108);
        return svg`<line class=${major ? "vu-tick major" : "vu-tick"} x1=${x1} y1=${y1} x2=${x2} y2=${y2}></line>`;
      })}
      ${[0, 2, 4, 6, 8, 10].map((tick) => {
        const [x, y] = at(angleOf(tick), 82);
        return svg`<text class="vu-number" x=${x} y=${y}>${tick}</text>`;
      })}
      <text class="vu-label" x="100" y="78">UV</text>
      <g class="vu-needle" style="--angle: ${angleOf(value)}deg">
        <line
          x1=${PIVOT_X}
          y1=${PIVOT_Y}
          x2=${PIVOT_X}
          y2=${PIVOT_Y - 116}
        ></line>
      </g>
      <path
        class="vu-housing"
        d="M 64 134 L 64 128 A 36 36 0 0 1 136 128 L 136 134 Z"
      ></path>
      <text class="vu-value" x="100" y="124">
        ${formatNumber(Math.round(value), this.hass!.locale)}
      </text>
    </svg>`;
  }

  private _renderPrecipitation(): MetricContent | undefined {
    const entityId = this._config!.entity;
    const stateObj = entityId ? this.hass!.states[entityId] : undefined;
    // Without a rain gauge there is no measured rain, so the card hides.
    if (!stateObj || this._rainLast24h === undefined) {
      return undefined;
    }
    const unit = stateObj.attributes.unit_of_measurement ?? "";

    const hourly = this._forecast?.get("hourly");
    const until = Date.now() + DAY_MS;
    const expectedEntries = (hourly?.forecast ?? []).filter(
      (entry) =>
        entry.precipitation != null &&
        new Date(entry.datetime).getTime() <= until
    );
    const expected = expectedEntries.reduce(
      (total, entry) => total + entry.precipitation!,
      0
    );

    return {
      sub:
        hourly && expectedEntries.length
          ? this.hass!.localize("ui.card.weather.homecore.rain_expected", {
              amount: `${formatNumber(expected, this.hass!.locale, {
                maximumFractionDigits: 1,
              })} ${getWeatherUnit(
                this.hass!.config,
                hourly.stateObj,
                "precipitation"
              )}`,
            })
          : this.hass!.localize("ui.card.weather.homecore.rain_last_24h"),
      visual: html`${hcValue(
        formatNumber(this._rainLast24h, this.hass!.locale, {
          maximumFractionDigits: 1,
        }),
        unit
      )}
      ${
        expectedEntries.length > 1
          ? hcBars(
              expectedEntries.map((entry) => ({
                label: "",
                value: entry.precipitation!,
              }))
            )
          : nothing
      }`,
    };
  }

  private _renderComparedToAverage(): MetricContent | undefined {
    const daily = this._forecast?.get("daily");
    const today = daily?.forecast[0];
    const history = this._temperatureHistory;
    if (
      !today ||
      new Date(today.datetime).toDateString() !== new Date().toDateString() ||
      !history ||
      history.dailyHighs.length < MIN_AVERAGE_DAYS
    ) {
      return undefined;
    }
    const average =
      history.dailyHighs.reduce((total, value) => total + value, 0) /
      history.dailyHighs.length;
    // || 0 turns -0 into 0
    const difference = Math.round(today.temperature - average) || 0;
    const key = difference > 0 ? "above" : difference < 0 ? "below" : "same";

    // The big number, then what it means in words and in temperatures; the
    // bars sit where a square's drawing would be
    return {
      sub: this.hass!.localize("ui.card.weather.homecore.highs_last_days", {
        days: history.days.length,
      }),
      visual: html`<div class="compare">
        <div class="compare-text">
          <div class="compare-number">
            ${difference > 0 ? "+" : ""}${this._degrees(difference)}
          </div>
          <div class="compare-words">
            ${this.hass!.localize(`ui.card.weather.notes.average_${key}`)}
          </div>
          <div class="compare-temps">
            ${this.hass!.localize("ui.card.weather.homecore.today_vs_average", {
              today: this._degrees(today.temperature),
              average: this._degrees(average),
            })}
          </div>
        </div>
        ${this._renderAverageBars(
          [
            ...history.days,
            { date: new Date(), high: today.temperature, today: true },
          ],
          average
        )}
      </div>`,
    };
  }

  /** The highs of the last days as bars, today highlighted, the average as a line. */
  private _renderAverageBars(
    days: { date: Date; high: number; today?: boolean }[],
    average: number
  ) {
    const W = 220;
    const H = 158;
    const top = 22;
    const bottom = 20;
    const values = days.map((day) => day.high).concat(average);
    const min = Math.min(...values) - 3;
    const max = Math.max(...values) + 1;
    const y = (value: number) =>
      top + (1 - (value - min) / (max - min)) * (H - top - bottom);
    const slot = W / days.length;
    const barWidth = Math.min(18, slot * 0.6);
    const weekday = (date: Date) =>
      date.toLocaleDateString(this.hass!.locale.language, {
        weekday: "narrow",
      });
    return html`<svg
      class="compare-bars"
      viewBox="0 0 ${W} ${H}"
      aria-hidden="true"
    >
      <line
        class="avg-line"
        x1="0"
        x2=${W}
        y1=${y(average)}
        y2=${y(average)}
      ></line>
      ${days.map((day, index) => {
        const x = index * slot + slot / 2;
        const barTop = y(day.high);
        return svg`<rect class=${day.today ? "avg-bar today" : "avg-bar"} x=${x - barWidth / 2} y=${barTop} width=${barWidth} height=${H - bottom - barTop} rx="5"></rect>
          <text class=${day.today ? "avg-value today" : "avg-value"} x=${x} y=${barTop - 6}>${this._degrees(day.high)}</text>
          <text class=${day.today ? "avg-day today" : "avg-day"} x=${x} y=${H - 4}>${weekday(day.date)}</text>`;
      })}
    </svg>`;
  }

  static styles = [
    homecoreStyles,
    css`
      :host {
        display: block;
      }
      /* Humidity: misty water, very soft and airy */
      .water {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        transition: height 1.2s ease;
      }
      .water .body {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          180deg,
          rgba(178, 229, 252, 0.18) 0%,
          rgba(129, 212, 250, 0.32) 35%,
          rgba(79, 195, 247, 0.42) 70%,
          rgba(3, 169, 244, 0.55) 100%
        );
        -webkit-mask-image: linear-gradient(180deg, transparent, #000 26px);
        mask-image: linear-gradient(180deg, transparent, #000 26px);
      }
      .water .mist {
        position: absolute;
        left: -10%;
        right: -10%;
        bottom: calc(100% - 26px);
        height: 60px;
        background: radial-gradient(
          ellipse at 50% 100%,
          rgba(178, 229, 252, 0.3),
          rgba(178, 229, 252, 0) 70%
        );
        filter: blur(8px);
      }
      .water .haze {
        position: absolute;
        width: 80%;
        height: 45%;
        border-radius: 50%;
        background: radial-gradient(
          closest-side,
          rgba(255, 255, 255, 0.22),
          rgba(255, 255, 255, 0)
        );
        filter: blur(10px);
        animation: drift 16s ease-in-out infinite alternate;
      }
      .water .haze.one {
        left: -15%;
        top: 8%;
      }
      .water .haze.two {
        right: -20%;
        top: 40%;
        animation-duration: 21s;
        animation-direction: alternate-reverse;
      }
      @keyframes drift {
        from {
          transform: translateX(-12%);
        }
        to {
          transform: translateX(18%);
        }
      }
      .water-value {
        flex: 1;
        display: flex;
        align-items: flex-end;
      }
      /* UV: a VU meter */
      .vu {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 0;
      }
      .vu-zone {
        fill: none;
        stroke-width: 5;
        stroke-linecap: butt;
      }
      .vu-tick {
        stroke: var(--hc-muted);
        stroke-width: 1.5;
        stroke-linecap: round;
      }
      .vu-tick.major {
        stroke: var(--hc-text);
        stroke-width: 2;
      }
      .vu-number {
        fill: var(--hc-muted);
        font-size: 11px;
        text-anchor: middle;
        dominant-baseline: central;
      }
      .vu-label {
        fill: var(--hc-muted);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 1px;
        text-anchor: middle;
      }
      .vu-needle {
        transform-box: view-box;
        transform-origin: 100px 130px;
        transform: rotate(var(--angle));
        animation: swing 1.4s cubic-bezier(0.3, 1.6, 0.5, 1);
        transition: transform 1s cubic-bezier(0.3, 1.6, 0.5, 1);
      }
      .vu-needle line {
        stroke: #e0574d;
        stroke-width: 2;
        stroke-linecap: round;
      }
      @keyframes swing {
        from {
          transform: rotate(-48deg);
        }
      }
      .vu-housing {
        fill: var(--hc-tile);
      }
      .vu-value {
        fill: var(--hc-text);
        font-size: 18px;
        font-weight: 600;
        text-anchor: middle;
      }
      @media (prefers-reduced-motion: reduce) {
        .water .haze,
        .vu-needle {
          animation: none;
        }
      }
      .tape-row {
        flex: 1;
        min-height: 0;
        display: flex;
        align-items: stretch;
        gap: 8px;
      }
      .tape-value {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        min-width: 0;
      }
      .tape-unit {
        color: var(--hc-muted);
        font: 300 clamp(13px, 7.1cqw, 18px)/1.25 var(--hc-font-tile);
      }
      .tape {
        flex: none;
        width: 40%;
        height: 100%;
      }
      .tape-tick {
        stroke: var(--hc-text);
        stroke-width: 2;
        stroke-linecap: round;
      }
      .tape-label {
        fill: var(--hc-text);
        font-size: 15px;
        dominant-baseline: central;
      }
      .tape-end {
        fill: var(--hc-muted);
        font-size: 14px;
        font-weight: 600;
        text-anchor: middle;
        dominant-baseline: central;
      }
      .tape-marker {
        stroke: #e0574d;
        stroke-width: 4;
        stroke-linecap: round;
      }
      .compare {
        flex: 1;
        min-height: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) calc(50% - 28px * var(--hc-k));
        gap: 16px;
        align-items: stretch;
      }
      .compare-text {
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        gap: 4px;
        min-width: 0;
      }
      .compare-number {
        font: 500 calc(26.4cqw * var(--hc-k)) / 1 var(--hc-font-tile);
        letter-spacing: -0.02em;
        white-space: nowrap;
      }
      .compare-words {
        color: var(--hc-muted);
        font: 300 clamp(14px, calc(7.1cqw * var(--hc-k)), 18px) / 1.25
          var(--hc-font-tile);
      }
      .compare-temps {
        margin-top: 6px;
        font: 400 clamp(12px, calc(5.6cqw * var(--hc-k)), 14px) / 1.4
          var(--hc-font);
      }
      .compare-bars {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 0;
      }
      .avg-value {
        fill: var(--hc-muted);
        font-size: 10px;
        text-anchor: middle;
      }
      .avg-value.today {
        fill: var(--hc-text);
        font-size: 12px;
        font-weight: 600;
      }
      .avg-bar {
        fill: var(--hc-muted);
        opacity: 0.45;
      }
      .avg-bar.today {
        fill: var(--hc-primary);
        opacity: 1;
      }
      .avg-day {
        fill: var(--hc-muted);
        font-size: 11px;
        text-anchor: middle;
      }
      .avg-day.today {
        fill: var(--hc-text);
        font-weight: 600;
      }
      .avg-line {
        stroke: var(--hc-text);
        stroke-width: 1;
        stroke-dasharray: 3 4;
        opacity: 0.6;
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-weather-metric-card": HuiWeatherMetricCard;
  }
}
