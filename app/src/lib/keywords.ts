// ─────────────────────────────────────────────────────────────────────────────
// keywords.ts — Multilingual hook & pivot keyword dictionaries (EN + FR)
//
// Raw string terms are compiled once at module load into RegExp objects
// via `compileDict`. Add new terms by appending to the `terms` array.
// ─────────────────────────────────────────────────────────────────────────────

export type Lang = "fr" | "en";

export interface Keyword {
  terms: string[];
  weight: number;
  label: string;
}

export interface CompiledKeyword {
  pattern: RegExp;
  weight: number;
  label: string;
}

export function compileDict(dict: Keyword[]): CompiledKeyword[] {
  return dict.map(({ terms, weight, label }) => ({
    pattern: new RegExp(
      `(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
      "i"
    ),
    weight,
    label,
  }));
}

// ── Hook keywords — signal a high-energy climax or reveal ────────────────────

const HOOK_DICT: Record<Lang, Keyword[]> = {
  en: [
    { terms: ["insane", "incredible", "unbelievable", "mind-blowing", "mind blowing"], weight: 20, label: "wow moment"     },
    { terms: ["the secret is", "the secret to", "secret"],                             weight: 18, label: "secret reveal"  },
    { terms: ["look at this", "watch this", "check this out"],                         weight: 15, label: "visual hook"    },
    { terms: ["never seen", "never done", "first time ever"],                          weight: 15, label: "novelty hook"   },
    { terms: ["literally", "honestly", "genuinely"],                                   weight:  8, label: "emphasis"       },
    { terms: ["you need to", "you won't believe", "trust me"],                         weight: 12, label: "urgency"        },
    { terms: ["results", "what happened", "it worked"],                                weight: 10, label: "result reveal"  },
    { terms: ["game changer", "game-changer", "completely changed", "life changing"],  weight: 18, label: "transformation" },
    { terms: ["doubled", "tripled", "10x"],                                            weight: 15, label: "metric spike"   },
  ],
  fr: [
    { terms: ["incroyable", "incroyablement"],                                                     weight: 20, label: "wow moment"     },
    { terms: ["dingue", "fou", "folle", "ouf"],                                                    weight: 18, label: "wow moment"     },
    { terms: ["le secret est", "le secret c'est", "le secret"],                                    weight: 18, label: "secret reveal"  },
    { terms: ["regardez bien", "regardez ça", "regardez"],                                         weight: 15, label: "visual hook"    },
    { terms: ["jamais vu", "première fois", "jamais fait"],                                        weight: 15, label: "novelty hook"   },
    { terms: ["littéralement", "franchement", "honnêtement", "vraiment"],                          weight:  8, label: "emphasis"       },
    { terms: ["vous devez", "vous allez pas y croire", "croyez-moi", "faites-moi confiance"],      weight: 12, label: "urgency"        },
    { terms: ["résultats", "ce qui s'est passé", "ça a marché"],                                   weight: 10, label: "result reveal"  },
    { terms: ["ça change tout", "complètement changé", "révolutionnaire"],                         weight: 18, label: "transformation" },
    { terms: ["doublé", "triplé", "fois plus"],                                                    weight: 15, label: "metric spike"   },
  ],
};

// ── Pivot keywords — signal a new section opening ────────────────────────────

const PIVOT_DICT: Record<Lang, Keyword[]> = {
  en: [
    { terms: ["but first", "before we go", "before i get", "before we continue"],  weight: 30, label: "classic pivot"  },
    { terms: ["speaking of", "on that note", "with that said"],                    weight: 28, label: "soft pivot"     },
    { terms: ["now let's", "now i want", "now before"],                            weight: 25, label: "now-pivot"      },
    { terms: ["alright", "okay so", "so anyway", "so moving on"],                  weight: 22, label: "section opener" },
    { terms: ["next up", "moving on", "let's talk", "let's move"],                 weight: 20, label: "topic shift"    },
    { terms: ["real quick", "quickly before", "quickly let me"],                   weight: 18, label: "sponsor bridge" },
    { terms: ["and now", "and before", "this brings me", "this reminds me"],       weight: 15, label: "connector"      },
  ],
  fr: [
    { terms: ["mais avant", "avant de continuer", "avant d'aller plus loin"],      weight: 30, label: "classic pivot"  },
    { terms: ["en parlant de", "à ce propos", "dans la même veine"],               weight: 28, label: "soft pivot"     },
    { terms: ["maintenant", "passons à", "passons maintenant"],                    weight: 25, label: "now-pivot"      },
    { terms: ["d'ailleurs", "en fait", "du coup", "bref"],                         weight: 22, label: "section opener" },
    { terms: ["ensuite", "on passe à", "parlons de", "voyons maintenant"],         weight: 20, label: "topic shift"    },
    { terms: ["rapidement", "vite fait", "juste avant"],                           weight: 18, label: "sponsor bridge" },
    { terms: ["ce qui m'amène à", "ça me rappelle", "et maintenant"],              weight: 15, label: "connector"      },
  ],
};

// Pre-compiled — imported by scoring-engine.ts
export const HOOKS  = { en: compileDict(HOOK_DICT.en),  fr: compileDict(HOOK_DICT.fr)  };
export const PIVOTS = { en: compileDict(PIVOT_DICT.en), fr: compileDict(PIVOT_DICT.fr) };
