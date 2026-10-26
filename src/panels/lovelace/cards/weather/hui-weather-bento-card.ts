import type { PropertyValues } from "lit";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators";
import type { LovelaceCardConfig } from "../../../../data/lovelace/config/card";
import type { HomeAssistant } from "../../../../types";
import "../hui-card";
import type { HuiCard } from "../hui-card";
import type { LovelaceCard } from "../../types";

// The weather card is 520 wide (Figma); the hours share its width and row.
// Data tiles are squares: 252 on desktop, two side by side on phones.
const WIDE = new Set(["weather-current", "weather-hourly"]);

interface WeatherBentoCardConfig extends LovelaceCardConfig {
  cards: LovelaceCardConfig[];
}

/**
 * HomeCore concept: the weather page as HomeCore bento. Every card keeps its
 * Figma width and the cards wrap with the screen, 16 apart. On a phone they
 * go full width.
 */
@customElement("hui-weather-bento-card")
export class HuiWeatherBentoCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _cards: HuiCard[] = [];

  public setConfig(config: WeatherBentoCardConfig): void {
    this._cards = config.cards.map((cardConfig) => {
      const element = document.createElement("hui-card");
      element.hass = this.hass;
      element.config = cardConfig;
      element.dataset.size = WIDE.has(cardConfig.type)
        ? "wide"
        : cardConfig.metric === "compared_to_average"
          ? "double"
          : "tile";
      element.load();
      return element;
    });
  }

  public getCardSize(): number {
    return 12;
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has("hass")) {
      this._cards.forEach((card) => {
        card.hass = this.hass;
      });
    }
  }

  protected render() {
    if (!this._cards.length) {
      return nothing;
    }
    return html`<div class="bento">${this._cards}</div>`;
  }

  static styles = css`
    /* The panel view takes corners and edges off its card; the cards in the
       bento get the HomeCore ones back */
    :host {
      display: block;
      container-type: inline-size;
    }
    .bento {
      --ha-card-border-radius: 34px;
      --ha-card-border-width: 0;
      --ha-card-box-shadow:
        inset 0 0 0 0.2px var(--hc-line), inset 0 -0.4px 0 var(--hc-line);
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: center;
      gap: 16px;
      max-width: 1056px;
      margin: 0 auto;
      padding: 10px;
    }
    .bento > [hidden] {
      display: none !important;
    }
    /* The weather card and the hours share a row and its height */
    .bento > [data-size="wide"] {
      width: 520px;
      align-self: stretch;
      display: flex;
      flex-direction: column;
    }
    .bento > [data-size="wide"] > * {
      flex: 1;
    }
    /* Square data tiles: four in a row under the weather card and hours */
    .bento > [data-size="tile"] {
      width: 252px;
    }
    .bento > [data-size="double"] {
      width: 520px;
    }
    /* Phones: wide cards full width, a 10 gutter */
    @container (width < 652px) {
      .bento {
        gap: 10px;
        padding: 10px;
      }
      .bento > [data-size="wide"],
      .bento > [data-size="double"] {
        width: 100%;
      }
      /* Two squares side by side */
      .bento > [data-size="tile"] {
        width: calc(50% - 5px);
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-weather-bento-card": HuiWeatherBentoCard;
  }
}
