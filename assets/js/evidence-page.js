(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", async () => {
    if (document.body.dataset.page !== "evidence") return;

    const UI = window.TripleDBUI;
    const Data = window.TripleDBData;
    const form = UI.$("#evidence-search-form");
    const queryInput = UI.$("#evidence-query");
    const organismSelect = UI.$("#evidence-organism");
    const pageSizeSelect = UI.$("#evidence-page-size");
    const resetButton = UI.$("#evidence-reset");
    const exportButton = UI.$("#evidence-export");
    const statusElement = UI.$("#evidence-status");
    const countElement = UI.$("#evidence-count");
    const thead = UI.$("#evidence-table-head");
    const tbody = UI.$("#evidence-table-body");
    const paginationTop = UI.$("#evidence-pagination-top");
    const paginationBottom = UI.$("#evidence-pagination-bottom");

    if (!form || !Data?.searchEvidence) return;

    const params = new URLSearchParams(window.location.search);
    const state = {
      page: Math.max(1, Number(params.get("page")) || 1),
      lastResult: null
    };
    queryInput.value = params.get("q") || "";

    try {
      const options = await Data.getFilterOptions();
      UI.populateSelect(organismSelect, options.organisms, "Any organism", params.get("organism") || "");
      if (params.get("pageSize")) pageSizeSelect.value = params.get("pageSize");
    } catch (error) {
      UI.setStatus(
        statusElement,
        `Filter options could not be loaded. ${error.message || error}`,
        "warning"
      );
    }

    const filters = () => ({
      organism: UI.clean(organismSelect.value),
      page: state.page,
      pageSize: UI.clean(pageSizeSelect.value) || "50"
    });

    const syncUrl = () => {
      const current = filters();
      UI.updateUrl({
        q: UI.clean(queryInput.value),
        organism: current.organism,
        page: state.page > 1 ? state.page : "",
        pageSize: current.pageSize !== "50" ? current.pageSize : ""
      });
    };

    const runSearch = async ({ updateUrl = true, scroll = false } = {}) => {
      const query = UI.clean(queryInput.value);
      const currentFilters = filters();
      if (!query && !currentFilters.organism) {
        state.lastResult = null;
        countElement.textContent = "0 source records";
        UI.setStatus(
          statusElement,
          "Enter a BioGRID ID, PubMed ID, TDB accession, manual TDB source ID or gene; alternatively choose an organism.",
          "info"
        );
        UI.setEvidenceHeader(thead);
        UI.emptyTable(
          tbody,
          7,
          "Enter a source or curated-record query",
          "Examples: 1535083, PUBMED:25615824, TDB00001, TDB04604 or WRKY18."
        );
        paginationTop.replaceChildren();
        paginationBottom.replaceChildren();
        exportButton.disabled = true;
        if (updateUrl) syncUrl();
        return;
      }

      if (updateUrl) syncUrl();
      countElement.textContent = "Searching…";
      UI.setStatus(statusElement, "Searching source evidence…", "info");
      exportButton.disabled = true;

      try {
        const result = await Data.searchEvidence(query, currentFilters);
        state.page = result.page;
        state.lastResult = result;
        UI.setEvidenceHeader(thead);
        UI.renderEvidenceTable(tbody, result.records);
        countElement.textContent = `${UI.formatNumber(result.total)} source record${result.total === 1 ? "" : "s"}`;
        const interpretation = result.interpretation?.length
          ? ` Query was interpreted as ${result.interpretation.join(", ")}.`
          : "";
        const warnings = result.dataWarnings?.length ? ` ${result.dataWarnings.join(" ")}` : "";
        UI.setStatus(
          statusElement,
          result.total
            ? `Showing ${UI.formatNumber(result.start)}–${UI.formatNumber(result.end)} of ${UI.formatNumber(result.total)} source records.${interpretation}${warnings}`
            : `No source records matched.${interpretation}${warnings}`,
          result.total ? "info" : "warning"
        );
        const changePage = (page) => {
          state.page = page;
          runSearch({ updateUrl: true, scroll: true });
        };
        UI.renderPagination(paginationTop, result, changePage);
        UI.renderPagination(paginationBottom, result, changePage);
        exportButton.disabled = !result.records.length;
        if (scroll) UI.$("#evidence-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (error) {
        console.error("TripleDB evidence search failed", error);
        state.lastResult = null;
        countElement.textContent = "0 source records";
        UI.setStatus(
          statusElement,
          `Source search failed. Confirm that biogrid_source_index.json and tdb_core_interaction_index.json are present. ${error.message || error}`,
          "warning"
        );
        UI.emptyTable(tbody, 7, "Source evidence unavailable", "Run verify_release_files.py and reload.");
        paginationTop.replaceChildren();
        paginationBottom.replaceChildren();
      }
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      state.page = 1;
      runSearch({ updateUrl: true });
    });

    [organismSelect, pageSizeSelect].forEach((select) => {
      select.addEventListener("change", () => {
        state.page = 1;
        runSearch({ updateUrl: true });
      });
    });

    resetButton.addEventListener("click", () => {
      queryInput.value = "";
      organismSelect.value = "";
      pageSizeSelect.value = "50";
      state.page = 1;
      runSearch({ updateUrl: true });
      queryInput.focus();
    });

    exportButton.addEventListener("click", () => {
      if (!state.lastResult?.records?.length) return;
      UI.downloadObject(`tripledb_source_evidence_page_${state.lastResult.page}.json`, {
        query: UI.clean(queryInput.value),
        filters: filters(),
        total_matches: state.lastResult.total,
        exported_records: state.lastResult.records
      });
    });

    await runSearch({ updateUrl: false });
  });
})();
