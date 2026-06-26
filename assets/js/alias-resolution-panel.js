/*
  TripleDB alias-resolution panel.

  Purpose:
  - Shows what a user-entered gene name / alias resolves to.
  - Works with the fixed alias JSON file:
      data/gene_alias_search_index_by_organism.json
  - Insert this script on search.html after search-page.js, or before it.

  Required HTML elements on search.html:
    #interaction-search-form
    #search-query
    #search-organism
*/
(() => {
  "use strict";

  const ALIAS_JSON_PATH =
    window.TRIPLEDB_CONFIG?.dataFiles?.aliases || "data/gene_alias_search_index_by_organism.json";

  const MAX_PARTIAL_KEYS = 18;
  const MAX_ALIAS_CHIPS_BEFORE_COLLAPSE = 18;

  let aliasDbPromise = null;
  let debounceTimer = null;

  const clean = (value) => String(value ?? "").trim();
  const normalize = (value) => clean(value).replace(/\s+/g, " ").toLowerCase();
  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const isLikelyIdentifier = (query) => {
    const q = clean(query);
    return (
      /^TDB\s*0*\d+$/i.test(q) ||
      /^(?:PUBMED|PMID)\s*:?\s*[1-9]\d{0,9}$/i.test(q) ||
      /^BIOGRID\s*:?\s*\d+$/i.test(q) ||
      /^\d{3,12}$/.test(q)
    );
  };

  const unique = (items) => {
    const seen = new Set();
    const out = [];
    (items || []).forEach((item) => {
      const value = clean(item);
      if (!value) return;
      const key = normalize(value);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(value);
      }
    });
    return out;
  };

  const loadAliasDb = async () => {
    if (!aliasDbPromise) {
      aliasDbPromise = fetch(ALIAS_JSON_PATH, { cache: "no-store" }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`${ALIAS_JSON_PATH}: HTTP ${response.status}`);
        }
        return response.json();
      });
    }
    return aliasDbPromise;
  };

  const getRecordAliases = (record) => {
    const official = clean(record?.["Gene Official Symbol"]);
    const systematic = clean(record?.["Gene Systematic Name"]);
    const synonyms = clean(record?.["Gene Synonyms"])
      .split("|")
      .map(clean)
      .filter(Boolean);
    return unique([official, systematic, ...synonyms]);
  };

  const recordKey = (record, organism) =>
    [organism, clean(record?.["Gene Official Symbol"]), clean(record?.["Gene Systematic Name"])]
      .map(normalize)
      .join("||");

  const collectAliasHits = (aliasDb, query, organism) => {
    const q = normalize(query);
    const selectedOrganism = clean(organism);
    const organisms = selectedOrganism ? [selectedOrganism] : Object.keys(aliasDb || {});

    const exact = [];
    const partial = [];
    const seenExact = new Set();
    const seenPartial = new Set();
    const matchingAliasKeys = [];

    organisms.forEach((org) => {
      const organismAliasMap = aliasDb?.[org];
      if (!organismAliasMap || typeof organismAliasMap !== "object") return;

      const exactRecords = organismAliasMap[q];
      if (Array.isArray(exactRecords)) {
        exactRecords.forEach((record) => {
          const key = recordKey(record, org);
          if (seenExact.has(key)) return;
          seenExact.add(key);
          exact.push({ organism: org, matchedAlias: q, record });
        });
      }

      if (q.length >= 2) {
        Object.keys(organismAliasMap).some((aliasKey) => {
          const normalizedAliasKey = normalize(aliasKey);
          if (!normalizedAliasKey.includes(q)) return false;

          const records = organismAliasMap[aliasKey];
          if (!Array.isArray(records)) return false;

          matchingAliasKeys.push({ organism: org, aliasKey });

          records.forEach((record) => {
            const key = recordKey(record, org);
            if (seenExact.has(key) || seenPartial.has(key)) return;
            seenPartial.add(key);
            partial.push({ organism: org, matchedAlias: aliasKey, record });
          });

          return partial.length >= MAX_PARTIAL_KEYS;
        });
      }
    });

    return {
      exact,
      partial: partial.slice(0, MAX_PARTIAL_KEYS),
      matchingAliasKeys: matchingAliasKeys.slice(0, MAX_PARTIAL_KEYS)
    };
  };

  const ensurePanel = () => {
    const form = document.querySelector("#interaction-search-form");
    if (!form) return null;

    let panel = document.querySelector("#alias-resolution-panel");
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = "alias-resolution-panel";
    panel.className = "alias-resolution-panel";
    panel.hidden = true;

    const hint = form.querySelector(".search-hint");
    if (hint) hint.insertAdjacentElement("afterend", panel);
    else form.appendChild(panel);

    return panel;
  };

  const injectStyle = () => {
    if (document.querySelector("#alias-resolution-panel-style")) return;
    const style = document.createElement("style");
    style.id = "alias-resolution-panel-style";
    style.textContent = `
      .alias-resolution-panel {
        margin-top: 0.9rem;
        border: 1px solid var(--border, #d9e2e1);
        border-radius: 16px;
        background: var(--surface, #ffffff);
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
        overflow: hidden;
      }
      .alias-resolution-panel[hidden] { display: none !important; }
      .alias-resolution-head {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.8rem 1rem;
        background: rgba(15, 118, 110, 0.08);
        border-bottom: 1px solid var(--border, #d9e2e1);
      }
      .alias-resolution-title {
        font-weight: 700;
        color: var(--ink, #0f172a);
      }
      .alias-resolution-subtitle {
        margin-top: 0.15rem;
        color: var(--muted, #64748b);
        font-size: 0.86rem;
      }
      .alias-resolution-body {
        padding: 0.9rem 1rem 1rem;
        display: grid;
        gap: 0.75rem;
      }
      .alias-gene-card {
        border: 1px solid var(--border, #d9e2e1);
        border-radius: 14px;
        padding: 0.85rem;
        background: rgba(255, 255, 255, 0.7);
      }
      .alias-gene-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 0.55rem;
      }
      .alias-gene-name {
        font-weight: 750;
        color: var(--ink, #0f172a);
        font-size: 1rem;
      }
      .alias-gene-meta {
        color: var(--muted, #64748b);
        font-size: 0.83rem;
      }
      .alias-chip-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        margin-top: 0.45rem;
      }
      .alias-chip {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        border: 1px solid rgba(15, 118, 110, 0.25);
        background: rgba(15, 118, 110, 0.08);
        color: var(--ink, #0f172a);
        padding: 0.16rem 0.48rem;
        font-size: 0.78rem;
        line-height: 1.35;
      }
      .alias-chip.matched {
        border-color: rgba(245, 158, 11, 0.45);
        background: rgba(245, 158, 11, 0.16);
      }
      .alias-resolution-note {
        color: var(--muted, #64748b);
        font-size: 0.84rem;
        line-height: 1.5;
      }
      .alias-details summary {
        cursor: pointer;
        color: var(--link, #0f766e);
        font-size: 0.84rem;
        margin-top: 0.35rem;
      }
    `;
    document.head.appendChild(style);
  };

  const renderGeneCard = (hit, query) => {
    const record = hit.record || {};
    const official = clean(record["Gene Official Symbol"]) || "Unspecified official symbol";
    const systematic = clean(record["Gene Systematic Name"]);
    const organism = clean(hit.organism || record.Organism);
    const aliases = getRecordAliases(record);
    const normalizedQuery = normalize(query);
    const matchedAlias = clean(hit.matchedAlias);

    const visibleAliases = aliases.slice(0, MAX_ALIAS_CHIPS_BEFORE_COLLAPSE);
    const hiddenAliases = aliases.slice(MAX_ALIAS_CHIPS_BEFORE_COLLAPSE);

    const chips = visibleAliases
      .map((alias) => {
        const isMatched = normalize(alias) === normalizedQuery || normalize(alias) === normalize(matchedAlias);
        return `<span class="alias-chip${isMatched ? " matched" : ""}">${escapeHtml(alias)}</span>`;
      })
      .join("");

    const hiddenChips = hiddenAliases
      .map((alias) => `<span class="alias-chip">${escapeHtml(alias)}</span>`)
      .join("");

    const hiddenBlock = hiddenAliases.length
      ? `<details class="alias-details"><summary>Show ${hiddenAliases.length} more alias${hiddenAliases.length === 1 ? "" : "es"}</summary><div class="alias-chip-list">${hiddenChips}</div></details>`
      : "";

    return `
      <div class="alias-gene-card">
        <div class="alias-gene-top">
          <div>
            <div class="alias-gene-name">${escapeHtml(official)}</div>
            <div class="alias-gene-meta">Systematic name: ${systematic ? escapeHtml(systematic) : "not provided"}</div>
            <div class="alias-gene-meta">Organism: ${organism ? escapeHtml(organism) : "not provided"}</div>
          </div>
          <span class="alias-chip matched">matched: ${escapeHtml(matchedAlias || query)}</span>
        </div>
        <div class="alias-resolution-note">Known names indexed for this gene:</div>
        <div class="alias-chip-list">${chips}</div>
        ${hiddenBlock}
      </div>
    `;
  };

  const renderPanel = async () => {
    const panel = ensurePanel();
    if (!panel) return;

    const query = clean(document.querySelector("#search-query")?.value);
    const organism = clean(document.querySelector("#search-organism")?.value);

    if (!query || isLikelyIdentifier(query)) {
      panel.hidden = true;
      panel.innerHTML = "";
      return;
    }

    if (query.length < 2) {
      panel.hidden = true;
      panel.innerHTML = "";
      return;
    }

    panel.hidden = false;
    panel.innerHTML = `
      <div class="alias-resolution-head">
        <div>
          <div class="alias-resolution-title">Gene name resolution</div>
          <div class="alias-resolution-subtitle">Checking whether “${escapeHtml(query)}” is a known gene symbol, systematic name or alias.</div>
        </div>
      </div>
      <div class="alias-resolution-body"><div class="alias-resolution-note">Loading alias index…</div></div>
    `;

    try {
      const aliasDb = await loadAliasDb();
      const hits = collectAliasHits(aliasDb, query, organism);
      const exactHits = hits.exact;
      const partialHits = hits.partial;

      if (!exactHits.length && !partialHits.length) {
        panel.innerHTML = `
          <div class="alias-resolution-head">
            <div>
              <div class="alias-resolution-title">Gene name resolution</div>
              <div class="alias-resolution-subtitle">No exact alias entry was found for “${escapeHtml(query)}”${organism ? ` in ${escapeHtml(organism)}` : ""}.</div>
            </div>
          </div>
          <div class="alias-resolution-body">
            <div class="alias-resolution-note">The search results may still come from direct gene matching or qualification-text fallback.</div>
          </div>
        `;
        return;
      }

      const cards = (exactHits.length ? exactHits : partialHits).map((hit) => renderGeneCard(hit, query)).join("");
      const modeText = exactHits.length
        ? `Exact alias match for “${escapeHtml(query)}”${organism ? ` in ${escapeHtml(organism)}` : ""}.`
        : `No exact alias match; showing possible partial alias matches for “${escapeHtml(query)}”${organism ? ` in ${escapeHtml(organism)}` : ""}.`;

      const partialNote = !exactHits.length && partialHits.length >= MAX_PARTIAL_KEYS
        ? `<div class="alias-resolution-note">Only the first ${MAX_PARTIAL_KEYS} possible matches are shown. Add an organism filter or type more characters to narrow this list.</div>`
        : "";

      panel.innerHTML = `
        <div class="alias-resolution-head">
          <div>
            <div class="alias-resolution-title">Gene name resolution</div>
            <div class="alias-resolution-subtitle">${modeText}</div>
          </div>
          <span class="alias-chip">${exactHits.length ? exactHits.length : partialHits.length} gene${(exactHits.length || partialHits.length) === 1 ? "" : "s"}</span>
        </div>
        <div class="alias-resolution-body">
          ${cards}
          ${partialNote}
        </div>
      `;
    } catch (error) {
      panel.hidden = false;
      panel.innerHTML = `
        <div class="alias-resolution-head">
          <div>
            <div class="alias-resolution-title">Gene name resolution unavailable</div>
            <div class="alias-resolution-subtitle">The alias JSON file could not be loaded.</div>
          </div>
        </div>
        <div class="alias-resolution-body"><div class="alias-resolution-note">${escapeHtml(error.message || error)}</div></div>
      `;
    }
  };

  const scheduleRender = () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(renderPanel, 180);
  };

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body?.dataset?.page !== "search") return;
    injectStyle();
    ensurePanel();

    const form = document.querySelector("#interaction-search-form");
    const queryInput = document.querySelector("#search-query");
    const organismSelect = document.querySelector("#search-organism");
    const resetButton = document.querySelector("#search-reset");

    queryInput?.addEventListener("input", scheduleRender);
    queryInput?.addEventListener("change", scheduleRender);
    organismSelect?.addEventListener("change", scheduleRender);
    form?.addEventListener("submit", () => window.setTimeout(renderPanel, 0));
    resetButton?.addEventListener("click", () => window.setTimeout(renderPanel, 0));

    renderPanel();
  });
})();
