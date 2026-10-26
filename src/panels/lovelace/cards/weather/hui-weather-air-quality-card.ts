import { mdiAirFilter, mdiArrowLeft, mdiFlower } from "@mdi/js";
import type { HassEntity } from "home-assistant-js-websocket";
import type { PropertyValues } from "lit";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators";
import "../../../../components/ha-card";
import "../../../../components/ha-svg-icon";
import "../../../../components/weather/ha-level-scale";
import { UNAVAILABLE, UNKNOWN } from "../../../../data/entity/entity";
import {
  AIR_QUALITY_LEVEL_COLORS,
  getPm25Level,
  PM25_LEVEL_LIMITS,
} from "../../../../data/weather_page";
import type { HomeAssistant } from "../../../../types";
import type { LovelaceCard, LovelaceGridOptions } from "../../types";
import type { WeatherAirQualityCardConfig } from "../types";
import { formatTime } from "../../../../common/datetime/format_time";
import { formatNumber } from "../../../../common/number/format_number";
import { hcLineChart, homecoreStyles } from "./homecore";
import { syncWeatherCardVisibility } from "./weather-page-card-base";

const PM25_SCALE_MAX = 100;
const PM25_UNIT = "µg/m³";

/**
 * Air quality and pollen. The level is based on fine particles (PM2.5) and
 * the WHO guideline, which works the same in every region. An air quality
 * index is shown as reported by its service, as the scales differ per region.
 */
@customElement("hui-weather-air-quality-card")
export class HuiWeatherAirQualityCard
  extends LitElement
  implements LovelaceCard
{
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: WeatherAirQualityCardConfig;

  @state() private _open?: string;

  @state() private _history?: {
    entityId: string;
    points: { label: string; value: number }[];
  };

  public connectedWhileHidden = true;

  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);
    syncWeatherCardVisibility(this);
  }

  public setConfig(config: WeatherAirQualityCardConfig): void {
    this._config = config;
  }

  public getCardSize(): number {
    return 3;
  }

  public getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: "auto", min_columns: 6 };
  }

  private _available(entityIds: string[] = []): HassEntity[] {
    return entityIds
      .map((entityId) => this.hass!.states[entityId])
      .filter(
        (stateObj) =>
          stateObj &&
          stateObj.state !== UNAVAILABLE &&
          stateObj.state !== UNKNOWN
      );
  }

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
    }
    const airQuality = this._available(this._config.air_quality_entities);
    const pollen = this._available(this._config.pollen_entities);
    if (!airQuality.length && !pollen.length) {
      return nothing;
    }
    const all = [...airQuality, ...pollen];
    const icon = (stateObj: HassEntity) =>
      pollen.includes(stateObj) ? mdiFlower : mdiAirFilter;

    // HomeCore concept: Figma "HC FINAL MULTIPLE TILES"; a tapped tile opens
    // inside the card ("HC FINAL - tile clicked").
    const open = all.find((stateObj) => stateObj.entity_id === this._open);
    if (open) {
      return this._renderOpen(open, icon(open));
    }

    return html`
      <ha-card class="hc-card">
        <div class="hc-header">
          <h2 class="hc-title">
            ${this.hass.localize("ui.card.weather.air_quality")}
          </h2>
        </div>
        <div class="tiles">
          ${all.map(
            (stateObj) => html`
              <button
                class="hc-tile"
                data-entity=${stateObj.entity_id}
                @click=${this._openTile}
              >
                <span class="hc-chip">
                  <ha-svg-icon .path=${icon(stateObj)}></ha-svg-icon>
                </span>
                <span class="hc-text">
                  <span class="hc-name">
                    ${this.hass!.formatEntityName(stateObj, { type: "entity" })}
                  </span>
                  <span class="hc-sub">
                    ${this.hass!.formatEntityState(stateObj)}
                  </span>
                </span>
              </button>
            `
          )}
        </div>
      </ha-card>
    `;
  }

  private _renderOpen(stateObj: HassEntity, icon: string) {
    const hass = this.hass!;
    const isPm25 =
      stateObj.attributes.device_class === "pm25" &&
      stateObj.attributes.unit_of_measurement === PM25_UNIT &&
      isFinite(Number(stateObj.state));
    const value = Number(stateObj.state);
    const level = isPm25 ? getPm25Level(value) : undefined;
    const history =
      this._history?.entityId === stateObj.entity_id
        ? this._history.points
        : undefined;
    const unit = stateObj.attributes.unit_of_measurement ?? "";

    return html`
      <ha-card class="hc-card open">
        <div class="hc-open">
          <div class="hc-open-head">
            <span class="hc-chip">
              <ha-svg-icon .path=${icon}></ha-svg-icon>
            </span>
            <span class="hc-text">
              <span class="hc-name">
                ${hass.formatEntityName(stateObj, { type: "entity" })}
              </span>
              <span class="hc-sub">
                ${hass.formatEntityState(stateObj)}${
                  level
                    ? ` · ${hass.localize(
                        `ui.card.weather.air_quality_level.${level}`
                      )}`
                    : ""
                }
              </span>
            </span>
            <button
              class="hc-back"
              .title=${hass.localize("ui.card.weather.homecore.back")}
              @click=${this._closeTile}
            >
              <ha-svg-icon .path=${mdiArrowLeft}></ha-svg-icon>
            </button>
          </div>
          <div class="hc-graph">
            ${
              history && history.length > 1
                ? hcLineChart(history, (v) =>
                    `${formatNumber(v, hass.locale, {
                      maximumFractionDigits: 1,
                    })} ${unit}`.trim()
                  )
                : level
                  ? html`<ha-level-scale
                        .label=${hass.localize("ui.card.weather.fine_particles")}
                        .min=${0}
                        .max=${PM25_SCALE_MAX}
                        .value=${value}
                        .segments=${PM25_LEVEL_LIMITS.map(([key, limit]) => ({
                          to: Math.min(limit, PM25_SCALE_MAX),
                          color: AIR_QUALITY_LEVEL_COLORS[key],
                        }))}
                      ></ha-level-scale>
                      <div class="hc-graph-note">
                        <span>0</span
                        ><span>${PM25_SCALE_MAX} ${PM25_UNIT}</span>
                      </div>`
                  : html`<span class="hc-graph-note">
                      <span>${hass.formatEntityState(stateObj)}</span>
                    </span>`
            }
          </div>
        </div>
      </ha-card>
    `;
  }

  private _openTile(ev: Event) {
    const entityId = (ev.currentTarget as HTMLElement).dataset.entity!;
    this._open = entityId;
    this._fetchHistory(entityId);
  }

  private _closeTile() {
    this._open = undefined;
  }

  private async _fetchHistory(entityId: string) {
    const hass = this.hass!;
    const start = new Date(Date.now() - 24 * 3600000);
    try {
      const result = await hass.callWS<
        Record<string, { s: string; lu: number }[]>
      >({
        type: "history/history_during_period",
        start_time: start.toISOString(),
        end_time: new Date().toISOString(),
        entity_ids: [entityId],
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      });
      const states = (result[entityId] ?? []).filter((item) =>
        isFinite(Number(item.s))
      );
      // At most 48 points, evenly picked
      const step = Math.max(1, Math.ceil(states.length / 48));
      const points = states
        .filter((_item, index) => index % step === 0)
        .map((item) => ({
          label: formatTime(new Date(item.lu * 1000), hass.locale, hass.config),
          value: Number(item.s),
        }));
      this._history = { entityId, points };
    } catch (_err) {
      // No history: the opened tile shows the level instead
    }
  }

  static styles = [
    homecoreStyles,
    css`
      :host {
        display: block;
        container-type: inline-size;
      }
      ha-card.hc-card.open {
        padding: 10px;
        min-height: 243px;
      }
      /* Halves: two tiles side by side, one per row when a half is under 140 */
      .tiles {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      @container (width < 280px) {
        .tiles {
          grid-template-columns: 1fr;
        }
      }
      .hc-graph {
        gap: 10px;
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-weather-air-quality-card": HuiWeatherAirQualityCard;
  }
}
