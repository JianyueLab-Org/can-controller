/**
 * EuroScope ATIS core — the METAR parser, the ATIS text formatter and the
 * ATIS-maker-URL builder, in one browser-safe module.
 *
 * EuroScope's "ATIS maker" is a parameterised URL (the same mechanism uniatis
 * and vatatis use): you paste a URL into EuroScope, it substitutes its built-in
 * macros ($metar, $arrrwy, $deprwy, $atiscode, $atisairport) and GETs it, then
 * speaks/shows whatever text comes back. So the server endpoint at
 * `/api/v1/atis` and the `/controllers/atis` preview both live off this module
 * — that way the preview a controller sees is exactly what EuroScope will say.
 *
 * Browser-safe on purpose (no node/network/prisma): the Vue island imports it
 * directly. The actual network fetch of a METAR is server-only and lives in
 * `src/server/metar.ts`.
 */

export interface CloudLayer {
  cover: "FEW" | "SCT" | "BKN" | "OVC";
  /** Cloud base in feet AGL, or null when the METAR reports `///`. */
  baseFeet: number | null;
  type?: "CB" | "TCU";
}

export interface ParsedWind {
  /** VRB — direction varying, no mean given. */
  variable: boolean;
  /** 00000KT. */
  calm: boolean;
  degrees?: number;
  speed: number;
  gust?: number;
  unit: "KT" | "MPS" | "KMH";
  /** Variable range `dddVddd`. */
  fromDegrees?: number;
  toDegrees?: number;
}

export interface ParsedMetar {
  raw: string;
  station?: string;
  day?: number;
  hour?: number;
  minute?: number;
  auto: boolean;
  wind?: ParsedWind;
  cavok: boolean;
  /** Prevailing visibility in metres; 9999 is normalised to 10000 (10km+). */
  visibilityMeters?: number;
  /** Statute-mile visibility, kept as readable text (US-style reports). */
  visibilityText?: string;
  /** Decoded present-weather phrases, e.g. "light rain". */
  weather: string[];
  clouds: CloudLayer[];
  /** SKC/CLR/NSC/NCD when there are no cloud layers. */
  clear?: "SKY CLEAR" | "NO SIGNIFICANT CLOUD" | "NO CLOUD DETECTED";
  /** Vertical visibility in feet, or -1 for `VV///`. */
  verticalVisibility?: number;
  temperature?: number;
  dewpoint?: number;
  qnhHpa?: number;
  qnhInHg?: number;
  /** Trailing trend / remarks (NOSIG, TEMPO…, RMK…), kept raw. */
  trend?: string;
}

export interface AtisOptions {
  icao?: string;
  /** ATIS letter, e.g. "A". */
  info?: string;
  arrRunways?: string[];
  depRunways?: string[];
  /** Approach in use, e.g. "ILS", "RNAV", "VISUAL". */
  approach?: string;
  /** Transition level, free text (e.g. "70" or "FL70"); not derivable from a METAR. */
  transitionLevel?: string;
  remarks?: string;
}

const PHONETIC: Record<string, string> = {
  A: "ALPHA",
  B: "BRAVO",
  C: "CHARLIE",
  D: "DELTA",
  E: "ECHO",
  F: "FOXTROT",
  G: "GOLF",
  H: "HOTEL",
  I: "INDIA",
  J: "JULIET",
  K: "KILO",
  L: "LIMA",
  M: "MIKE",
  N: "NOVEMBER",
  O: "OSCAR",
  P: "PAPA",
  Q: "QUEBEC",
  R: "ROMEO",
  S: "SIERRA",
  T: "TANGO",
  U: "UNIFORM",
  V: "VICTOR",
  W: "WHISKEY",
  X: "XRAY",
  Y: "YANKEE",
  Z: "ZULU",
};

/** ICAO phonetic for an ATIS letter; passes anything unexpected through. */
export function phonetic(letter?: string): string {
  if (!letter) return "";
  const c = letter.trim().charAt(0).toUpperCase();
  return PHONETIC[c] ?? c;
}

const WX_DESCRIPTOR: Record<string, string> = {
  MI: "shallow",
  PR: "partial",
  BC: "patches of",
  DR: "low drifting",
  BL: "blowing",
  SH: "showers of",
  TS: "thunderstorm",
  FZ: "freezing",
};
const WX_PHENOMENON: Record<string, string> = {
  DZ: "drizzle",
  RA: "rain",
  SN: "snow",
  SG: "snow grains",
  IC: "ice crystals",
  PL: "ice pellets",
  GR: "hail",
  GS: "small hail",
  UP: "precipitation",
  BR: "mist",
  FG: "fog",
  FU: "smoke",
  VA: "volcanic ash",
  DU: "widespread dust",
  SA: "sand",
  HZ: "haze",
  PY: "spray",
  PO: "dust whirls",
  SQ: "squalls",
  FC: "funnel cloud",
  SS: "sandstorm",
  DS: "duststorm",
};

/**
 * Decode a present-weather group (e.g. "+SHRA", "VCTS", "FZFG"). Returns null
 * if the token is not weather, so the caller can keep testing it against the
 * other group shapes.
 */
function decodeWeather(token: string): string | null {
  let t = token;
  let intensity = "";
  if (t.startsWith("+")) {
    intensity = "heavy ";
    t = t.slice(1);
  } else if (t.startsWith("-")) {
    intensity = "light ";
    t = t.slice(1);
  }
  let vicinity = false;
  if (t.startsWith("VC")) {
    vicinity = true;
    t = t.slice(2);
  }
  if (t.length === 0 || t.length % 2 !== 0) return null;
  const parts: string[] = [];
  for (let i = 0; i < t.length; i += 2) {
    const code = t.slice(i, i + 2);
    const word = WX_DESCRIPTOR[code] ?? WX_PHENOMENON[code];
    if (!word) return null;
    parts.push(word);
  }
  let phrase = intensity + parts.join(" ");
  if (vicinity) phrase += " in vicinity";
  return phrase.trim();
}

const WIND_RE = /^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS|KMH)$/;
const WIND_VAR_RE = /^(\d{3})V(\d{3})$/;
const TIME_RE = /^(\d{2})(\d{2})(\d{2})Z$/;
const CLOUD_RE = /^(FEW|SCT|BKN|OVC)(\d{3}|\/\/\/)(CB|TCU)?$/;
const VV_RE = /^VV(\d{3}|\/\/\/)$/;
const TEMP_RE = /^(M?\d{1,2})\/(M?\d{1,2})$/;
const QNH_RE = /^Q(\d{3,4})$/;
const ALTIM_RE = /^A(\d{4})$/;
const VIS_M_RE = /^(\d{4})(?:NE|NW|SE|SW|N|S|E|W)?$/;
const VIS_SM_RE = /^(P|M)?((?:\d+\/\d+)|\d+)SM$/;

function toInt(s: string): number {
  return s.startsWith("M") ? -parseInt(s.slice(1), 10) : parseInt(s, 10);
}

/** Parse a raw METAR into the fields the ATIS needs. Tolerant of junk tokens. */
export function parseMetar(raw: string): ParsedMetar {
  const text = (raw || "").trim();
  const result: ParsedMetar = {
    raw: text,
    auto: false,
    weather: [],
    clouds: [],
    cavok: false,
  };
  if (!text) return result;

  const tokens = text.replace(/=$/, "").split(/\s+/).filter(Boolean);

  let i = 0;
  // Optional report-type prefix.
  if (tokens[i] === "METAR" || tokens[i] === "SPECI") i++;

  for (; i < tokens.length; i++) {
    const tok = tokens[i];

    // Trend / remarks tail — keep the rest raw and stop decoding groups.
    if (
      tok === "NOSIG" ||
      tok === "TEMPO" ||
      tok === "BECMG" ||
      tok === "RMK"
    ) {
      result.trend = tokens.slice(i).join(" ");
      break;
    }

    if (tok === "COR" || tok === "AMD" || tok === "CCA") continue;
    if (tok === "AUTO") {
      result.auto = true;
      continue;
    }

    // Station: the first 4-letter all-alpha token.
    if (!result.station && /^[A-Z]{4}$/.test(tok)) {
      result.station = tok;
      continue;
    }

    if (!result.day && TIME_RE.test(tok)) {
      const m = tok.match(TIME_RE)!;
      result.day = parseInt(m[1], 10);
      result.hour = parseInt(m[2], 10);
      result.minute = parseInt(m[3], 10);
      continue;
    }

    if (!result.wind && WIND_RE.test(tok)) {
      const m = tok.match(WIND_RE)!;
      const variable = m[1] === "VRB";
      const degrees = variable ? undefined : parseInt(m[1], 10);
      const speed = parseInt(m[2], 10);
      result.wind = {
        variable,
        calm: !variable && degrees === 0 && speed === 0,
        degrees,
        speed,
        gust: m[3] ? parseInt(m[3], 10) : undefined,
        unit: m[4] as ParsedWind["unit"],
      };
      continue;
    }
    if (result.wind && !result.wind.variable && WIND_VAR_RE.test(tok)) {
      const m = tok.match(WIND_VAR_RE)!;
      result.wind.fromDegrees = parseInt(m[1], 10);
      result.wind.toDegrees = parseInt(m[2], 10);
      continue;
    }

    if (tok === "CAVOK") {
      result.cavok = true;
      continue;
    }

    if (tok === "SKC" || tok === "CLR") {
      result.clear = "SKY CLEAR";
      continue;
    }
    if (tok === "NSC") {
      result.clear = "NO SIGNIFICANT CLOUD";
      continue;
    }
    if (tok === "NCD") {
      result.clear = "NO CLOUD DETECTED";
      continue;
    }

    if (VV_RE.test(tok)) {
      const m = tok.match(VV_RE)!;
      result.verticalVisibility =
        m[1] === "///" ? -1 : parseInt(m[1], 10) * 100;
      continue;
    }

    if (CLOUD_RE.test(tok)) {
      const m = tok.match(CLOUD_RE)!;
      result.clouds.push({
        cover: m[1] as CloudLayer["cover"],
        baseFeet: m[2] === "///" ? null : parseInt(m[2], 10) * 100,
        type: (m[3] as CloudLayer["type"]) || undefined,
      });
      continue;
    }

    if (TEMP_RE.test(tok)) {
      const m = tok.match(TEMP_RE)!;
      result.temperature = toInt(m[1]);
      result.dewpoint = toInt(m[2]);
      continue;
    }

    if (QNH_RE.test(tok)) {
      result.qnhHpa = parseInt(tok.slice(1), 10);
      continue;
    }
    if (ALTIM_RE.test(tok)) {
      result.qnhInHg = parseInt(tok.slice(1), 10) / 100;
      continue;
    }

    // Statute-mile visibility (US) before the bare-metres shape.
    if (
      result.visibilityMeters === undefined &&
      !result.visibilityText &&
      VIS_SM_RE.test(tok)
    ) {
      const m = tok.match(VIS_SM_RE)!;
      const qualifier =
        m[1] === "P" ? " OR MORE" : m[1] === "M" ? "LESS THAN " : "";
      result.visibilityText =
        `${m[1] === "M" ? qualifier : ""}${m[2]}SM${m[1] === "P" ? qualifier : ""}`.trim();
      continue;
    }
    if (result.visibilityMeters === undefined && VIS_M_RE.test(tok)) {
      const meters = parseInt(tok.slice(0, 4), 10);
      result.visibilityMeters = meters === 9999 ? 10000 : meters;
      continue;
    }

    // Otherwise, try it as a present-weather group.
    const wx = decodeWeather(tok);
    if (wx) result.weather.push(wx);
  }

  return result;
}

function signed(n: number): string {
  return n < 0 ? `MINUS ${Math.abs(n)}` : String(n);
}

/** Human wind phrase for the ATIS body and the UI chips. */
export function describeWind(wind?: ParsedWind): string {
  if (!wind) return "WIND UNAVAILABLE";
  if (wind.calm) return "WIND CALM";
  const unit =
    wind.unit === "KT"
      ? "KNOTS"
      : wind.unit === "MPS"
        ? "METRES PER SECOND"
        : "KM/H";
  const dir = wind.variable
    ? "VARIABLE"
    : `${String(wind.degrees).padStart(3, "0")} DEGREES`;
  let phrase = `WIND ${dir} ${wind.speed} ${unit}`;
  if (wind.gust) phrase += `, GUSTING ${wind.gust} ${unit}`;
  if (wind.fromDegrees !== undefined && wind.toDegrees !== undefined) {
    phrase += `, VARIABLE BETWEEN ${String(wind.fromDegrees).padStart(3, "0")} AND ${String(wind.toDegrees).padStart(3, "0")} DEGREES`;
  }
  return phrase;
}

/** Human visibility phrase. */
export function describeVisibility(m: ParsedMetar): string {
  if (m.cavok) return "CAVOK";
  if (m.visibilityText) return `VISIBILITY ${m.visibilityText}`;
  const v = m.visibilityMeters;
  if (v === undefined) return "VISIBILITY UNAVAILABLE";
  if (v >= 10000) return "VISIBILITY 10KM OR MORE";
  if (v >= 1000 && v % 1000 === 0) return `VISIBILITY ${v / 1000}KM`;
  return `VISIBILITY ${v} METRES`;
}

const COVER_WORD: Record<CloudLayer["cover"], string> = {
  FEW: "FEW",
  SCT: "SCATTERED",
  BKN: "BROKEN",
  OVC: "OVERCAST",
};

/** Human cloud phrase. */
export function describeClouds(m: ParsedMetar): string {
  if (m.verticalVisibility !== undefined) {
    return m.verticalVisibility < 0
      ? "VERTICAL VISIBILITY UNKNOWN"
      : `VERTICAL VISIBILITY ${m.verticalVisibility}FT`;
  }
  if (m.cavok) return "NO CLOUD BELOW 5000FT";
  if (m.clouds.length) {
    return m.clouds
      .map((c) => {
        const base = c.baseFeet === null ? "" : ` ${c.baseFeet}FT`;
        const type = c.type ? ` ${c.type}` : "";
        return `${COVER_WORD[c.cover]}${base}${type}`;
      })
      .join(", ");
  }
  return m.clear ?? "NO SIGNIFICANT CLOUD";
}

function describeRunways(o: AtisOptions): string | null {
  const arr = (o.arrRunways ?? []).filter(Boolean);
  const dep = (o.depRunways ?? []).filter(Boolean);
  const same =
    arr.length > 0 &&
    arr.length === dep.length &&
    arr.every((r, idx) => r === dep[idx]);

  if (arr.length && (dep.length === 0 || same)) {
    return `RWY ${arr.join(" AND ")} IN USE`;
  }
  if (arr.length && dep.length) {
    return `ARR RWY ${arr.join(", ")}, DEP RWY ${dep.join(", ")}`;
  }
  if (dep.length) return `DEP RWY ${dep.join(", ")} IN USE`;
  return null;
}

/**
 * Build the ATIS text EuroScope will speak/display. Returns both the joined
 * `text` (newline-separated, what the endpoint returns) and the `lines`.
 */
export function formatAtis(
  metar: ParsedMetar,
  options: AtisOptions,
): { text: string; lines: string[] } {
  const icao = (options.icao || metar.station || "").toUpperCase();
  const letter = (options.info || "A").trim().charAt(0).toUpperCase();
  const lines: string[] = [];

  const time =
    metar.hour !== undefined && metar.minute !== undefined
      ? ` ${String(metar.hour).padStart(2, "0")}${String(metar.minute).padStart(2, "0")}Z`
      : "";
  lines.push(`${icao} INFORMATION ${phonetic(letter)}${time}`.trim());

  const rwy = describeRunways(options);
  if (rwy) lines.push(rwy);

  if (options.transitionLevel && options.transitionLevel.trim()) {
    const tl = options.transitionLevel.trim().toUpperCase();
    lines.push(`TRL ${tl.startsWith("FL") ? tl.slice(2) : tl}`);
  }

  if (options.approach && options.approach.trim()) {
    lines.push(`EXPECT ${options.approach.trim().toUpperCase()} APPROACH`);
  }

  lines.push(describeWind(metar.wind));
  lines.push(describeVisibility(metar));
  if (metar.weather.length)
    lines.push(`WEATHER ${metar.weather.join(", ").toUpperCase()}`);
  // CAVOK already asserts "no cloud below 5000ft/MSA", so skip a redundant line.
  if (!metar.cavok) lines.push(`CLOUD ${describeClouds(metar)}`);

  if (metar.temperature !== undefined && metar.dewpoint !== undefined) {
    lines.push(
      `TEMPERATURE ${signed(metar.temperature)}, DEWPOINT ${signed(metar.dewpoint)}`,
    );
  }

  if (metar.qnhHpa !== undefined) lines.push(`QNH ${metar.qnhHpa}`);
  else if (metar.qnhInHg !== undefined)
    lines.push(`QNH ${metar.qnhInHg.toFixed(2)} INHG`);

  if (options.remarks && options.remarks.trim())
    lines.push(options.remarks.trim());

  lines.push(
    `ADVISE ON INITIAL CONTACT YOU HAVE INFORMATION ${phonetic(letter)}`,
  );

  return { text: lines.join("\n"), lines };
}

/** EuroScope's four ATIS slots; every macro in the maker URL is keyed to one. */
export const ATIS_SLOTS = ["A", "B", "C", "D"] as const;
export type AtisSlot = (typeof ATIS_SLOTS)[number];

/**
 * Build the URL to paste into EuroScope's "ATIS maker URL" field. EuroScope
 * substitutes its own macros at call time, so they must stay literal (never
 * URL-encoded) here. `origin` is the public origin of this site.
 */
export function buildAtisMakerUrl(
  origin: string,
  opts?: { approach?: string; slot?: AtisSlot },
): string {
  const base = origin.replace(/\/+$/, "") + "/api/v1/atis";
  // Two rules, both learned from URLs EuroScope actually accepts:
  //
  // 1. The macros must carry the ATIS-slot letter ($atisairportA, $atiscodeA).
  //    The unsuffixed spellings are not tied to a slot, so EuroScope has no
  //    airport to resolve them against and refuses the URL ("unable to extract
  //    names from URL").
  // 2. $atisairport appears ONLY inside $arrrwy/$deprwy/$metar. A bare
  //    top-level `?icao=$atisairportA` is outside that proven format; the
  //    endpoint reads the ICAO from the METAR anyway.
  const slot = opts?.slot ?? "A";
  const air = `$atisairport${slot}`;
  const code = `$atiscode${slot}`;
  const approach = (opts?.approach || "ILS").toUpperCase();
  return (
    `${base}?arr=$arrrwy(${air})` +
    `&dep=$deprwy(${air})` +
    `&apptype=${approach}` +
    `&info=${code}` +
    `&metar=$metar(${air})`
  );
}

/** Split a EuroScope `$arrrwy`/`$deprwy` comma-separated list into runways. */
export function splitRunways(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean);
}
