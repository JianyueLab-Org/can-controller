/**
 * The per-division ATC rules published under /rules.
 *
 * Every division that a member can belong to gets a card on the index; a
 * division is only linkable once its MDX exists in the `rules` content
 * collection, so — as with the docs nav — an entry here can never point at a
 * missing file. The document body carries its own metadata table (document
 * number, version, dates), so nothing of the kind is duplicated here.
 *
 * Browser-safe: no prisma, no astro:content import.
 */

import { SELECTABLE_REGIONS } from "@/lib/divisions";

export interface AtcRuleDoc {
  /** `division.region` the document governs — 1 PRC, 2 USA, 3 JPN, 4 HK. */
  region: number;
  /** URL segment under /rules and the `rules` collection id. */
  key: string;
  /** Title as written in the document's own language. */
  title: string;
  /**
   * BCP-47 tag of the document body, used for the `lang` attribute and to
   * label the language under `controllers.rules.languages.<lang>`. Divisions
   * publish in their own language; the shell around it stays localised.
   */
  lang: string;
  /** Not yet ratified by the division — the UI badges it. */
  draft?: boolean;
}

export const ATC_RULE_DOCS: AtcRuleDoc[] = [
  {
    region: 3,
    key: "jpn",
    title: "CAN JPN 管制規則（制定案）",
    lang: "ja",
    draft: true,
  },
];

export interface AtcRuleDivision {
  region: number;
  /** Undefined until that division publishes its rules. */
  doc?: AtcRuleDoc;
  href?: string;
}

export function ruleHref(doc: AtcRuleDoc): string {
  return `/rules/${doc.key}`;
}

/** Every joinable division, in region order, with its document if published. */
export function buildAtcRules(
  /** Ids present in the `rules` collection. */
  availableIds: string[],
): AtcRuleDivision[] {
  return SELECTABLE_REGIONS.map((region) => {
    const doc = ATC_RULE_DOCS.find(
      (candidate) =>
        candidate.region === region && availableIds.includes(candidate.key),
    );
    return { region, doc, href: doc ? ruleHref(doc) : undefined };
  });
}

/** Resolve a URL segment to a published document. */
export function findAtcRuleDoc(
  key: string | undefined,
  availableIds: string[],
): AtcRuleDoc | undefined {
  if (!key || !availableIds.includes(key)) return undefined;
  return ATC_RULE_DOCS.find((doc) => doc.key === key);
}
