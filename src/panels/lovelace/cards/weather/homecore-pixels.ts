// HomeCore concept: Move Assistant's animated bitmap weather (homecore-weather-art)
// as elements for the weather page. One clock repaints everything that shows,
// ten times a second, and stops when nothing is left or motion is reduced.
import {
  WX_PALETTE,
  wxBitmap,
  wxKey,
  wxPose,
  wxStripBitmap,
} from "./homecore-weather-art";

type Painter = (time: number) => void;

const painters = new Set<Painter>();
let frame = 0;
let lastStep = -1;

const reduceMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const tick = (time: number) => {
  frame = 0;
  const step = Math.floor(time / 100);
  if (step !== lastStep && !document.hidden) {
    lastStep = step;
    painters.forEach((paint) => paint(time));
  }
  if (painters.size && !reduceMotion()) {
    frame = requestAnimationFrame(tick);
  }
};

const addPainter = (paint: Painter) => {
  painters.add(paint);
  paint(performance.now());
  if (!frame && !reduceMotion()) {
    frame = requestAnimationFrame(tick);
  }
};

/** Ink, paper and the sky colours, from the HomeCore tokens around the element. */
const pixelColors = (element: Element) => {
  const style = getComputedStyle(element);
  const value = (name: string) => style.getPropertyValue(name).trim();
  const colors: Record<string, string> = {};
  (
    [
      ["skyClearDay", "--wx-clear"],
      ["skyClearNight", "--wx-night"],
      ["skyCloudyDay", "--wx-cloudy"],
      ["cloudDay", "--wx-cloud-bright"],
      ["cloudNight", "--wx-cloudy"],
      ["rain", "--hc-primary"],
    ] as const
  ).forEach(([key, name]) => {
    if (value(name)) {
      colors[key] = value(name);
    }
  });
  return {
    colors: { ...WX_PALETTE, ...colors },
    ink: value("--hc-ink") || "#222222",
    paper: value("--hc-paper") || "#f1f1f1",
  };
};

const CANVAS_STYLE =
  "display:block;width:100%;height:100%;image-rendering:pixelated";

const visible = (element: HTMLElement) =>
  element.isConnected && element.getClientRects().length > 0;

/** A weather condition as an animated 1-bit icon, size × size. */
class HcPixelWeather extends HTMLElement {
  private _condition = "cloudy";

  private _night = false;

  private _size = 40;

  private _canvas = document.createElement("canvas");

  set condition(value: string) {
    this._condition = value;
    this._paint(performance.now());
  }

  set night(value: boolean) {
    this._night = value;
    this._paint(performance.now());
  }

  set size(value: number) {
    this._size = value;
    this._paint(performance.now());
  }

  connectedCallback() {
    this.style.display = "block";
    this.style.width = "100%";
    this.style.height = "100%";
    this._canvas.setAttribute("style", CANVAS_STYLE);
    if (!this._canvas.isConnected) {
      this.appendChild(this._canvas);
    }
    addPainter(this._paint);
  }

  disconnectedCallback() {
    painters.delete(this._paint);
  }

  private _paint = (time: number) => {
    if (!visible(this)) {
      return;
    }
    const { colors, ink, paper } = pixelColors(this);
    const image = wxBitmap(
      wxPose(wxKey(this._condition, this._night), colors),
      {
        size: this._size,
        px: 2,
        oneBit: false,
        colors,
        ink,
        paper,
        clock: time,
        idle: !reduceMotion(),
      }
    );
    if (this._canvas.width !== image.w) {
      this._canvas.width = image.w;
    }
    if (this._canvas.height !== image.h) {
      this._canvas.height = image.h;
    }
    this._canvas
      .getContext("2d")
      ?.putImageData(new ImageData(image.data, image.w, image.h), 0, 0);
  };
}

export interface StripHalf {
  cond: string;
  night: boolean;
}

/**
 * Move Assistant's sky strip, in 1-bit: a column per day, each a day half and
 * a night half, the sky running across them as one picture. Fills its box.
 */
class HcPixelStrip extends HTMLElement {
  private _segs: StripHalf[] = [];

  private _columns = 3;

  private _seed = 1;

  private _canvas = document.createElement("canvas");

  set segs(value: StripHalf[]) {
    this._segs = value;
    this._paint(performance.now());
  }

  set columns(value: number) {
    this._columns = value;
    this._paint(performance.now());
  }

  set seed(value: number) {
    this._seed = value;
  }

  connectedCallback() {
    this.style.display = "block";
    this._canvas.setAttribute("style", CANVAS_STYLE);
    if (!this._canvas.isConnected) {
      this.appendChild(this._canvas);
    }
    addPainter(this._paint);
  }

  disconnectedCallback() {
    painters.delete(this._paint);
  }

  private _paint = (time: number) => {
    const width = this.clientWidth;
    const height = this.clientHeight;
    if (!visible(this) || !width || !height || !this._segs.length) {
      return;
    }
    const { colors, ink, paper } = pixelColors(this);
    const image = wxStripBitmap(this._segs, {
      width,
      height,
      columns: this._columns,
      colors,
      clock: time,
      ambient: !reduceMotion(),
      seed: this._seed,
      px: 2,
      oneBit: false,
      ink,
      paper,
    });
    if (this._canvas.width !== image.w) {
      this._canvas.width = image.w;
    }
    if (this._canvas.height !== image.h) {
      this._canvas.height = image.h;
    }
    this._canvas
      .getContext("2d")
      ?.putImageData(new ImageData(image.data, image.w, image.h), 0, 0);
  };
}

if (!customElements.get("hc-pixel-weather")) {
  customElements.define("hc-pixel-weather", HcPixelWeather);
}
if (!customElements.get("hc-pixel-strip")) {
  customElements.define("hc-pixel-strip", HcPixelStrip);
}

declare global {
  interface HTMLElementTagNameMap {
    "hc-pixel-weather": HcPixelWeather;
    "hc-pixel-strip": HcPixelStrip;
  }
}
