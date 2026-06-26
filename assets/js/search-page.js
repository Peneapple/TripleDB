(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", async () => {
    if (document.body.dataset.page !== "search") return;

    const UI = window.TripleDBUI;
    const Data = window.TripleDBData;
    const form = UI.$("#interaction-search-form");
    const queryInput = UI.$("#search-query");
    const scopeSelect = UI.$("#search-scope");
    const organismSelect = UI.$("#search-organism");
    const experimentalSelect = UI.$("#search-experimental-system");
    const orderSelect = UI.$("#search-order");
    const pageSizeSelect = UI.$("#search-page-size");
    const resetButton = UI.$("#search-reset");
    const exportButton = UI.$("#search-export");
    const thead = UI.$("[data-search-thead]");
    const tbody = UI.$("[data-search-results]");
    const countElement = UI.$("[data-result-count]");
    const queryLabel = UI.$("[data-query-label]");
    const statusElement = UI.$("#search-status");
    const paginationTop = UI.$("#search-pagination-top");
    const paginationBottom = UI.$("#search-pagination-bottom");

    if (!form || !queryInput || !Data?.searchInteractions) return;

    const state = {
      page: 1,
      lastResult: null
    };

    const params = new URLSearchParams(window.location.search);
    queryInput.value = params.get("q") || "";
    scopeSelect.value = params.get("scope") || "interactions";
    state.page = Math.max(1, Number(params.get("page")) || 1);

    const setScopeControls = () => {
      const evidence = scopeSelect.value === "evidence";
      experimentalSelect.disabled = evidence;
      orderSelect.disabled = evidence;
      experimentalSelect.closest(".filter-group")?.classList.toggle("filter-disabled", evidence);
      orderSelect.closest(".filter-group")?.classList.toggle("filter-disabled", evidence);
    };

    try {
      UI.setStatus(statusElement, "Loading the core, alias and BioGRID source indexes…", "info");
      const options = await Data.getFilterOptions();
      UI.populateSelect(organismSelect, options.organisms, "Any organism", params.get("organism") || "");
      UI.populateSelect(
        experimentalSelect,
        options.experimentalSystems,
        "Any experimental system",
        params.get("experimentalSystem") || ""
      );
      UI.populateSelect(orderSelect, options.interactionOrders, "Any interaction order", params.get("order") || "");
      if (params.get("pageSize")) pageSizeSelect.value = params.get("pageSize");
      setScopeControls();
    } catch (error) {
      UI.setStatus(
        statusElement,
        `Data could not be loaded. Put the three fixed-name JSON files in data/ and reload. ${error.message || error}`,
        "warning"
      );
      UI.emptyTable(tbody, 7, "Search data unavailable", "Run verify_release_files.py to check the deployment files.");
      return;
    }

    const currentFilters = () => ({
      organism: UI.clean(organismSelect.value),
      experimentalSystem: scopeSelect.value === "evidence" ? "" : UI.clean(experimentalSelect.value),
      order: scopeSelect.value === "evidence" ? "" : UI.clean(orderSelect.value),
      page: state.page,
      pageSize: UI.clean(pageSizeSelect.value) || "50"
    });

    const syncUrl = () => {
      const filters = currentFilters();
      UI.updateUrl({
        q: UI.clean(queryInput.value),
        scope: scopeSelect.value === "evidence" ? "evidence" : "",
        organism: filters.organism,
        experimentalSystem: filters.experimentalSystem,
        order: filters.order,
        page: state.page > 1 ? state.page : "",
        pageSize: filters.pageSize !== "50" ? filters.pageSize : ""
      });
    };

    const renderSummary = (result, scope) => {
      countElement.textContent = `${UI.formatNumber(result.total)} ${scope === "evidence" ? "source" : "curated"} record${result.total === 1 ? "" : "s"}`;
      const query = UI.clean(queryInput.value);
      queryLabel.textContent = query ? `“${query}”` : "the selected filters";

      const details = [];
      if (result.interpretation?.length) details.push(`interpreted as ${result.interpretation.join(", ")}`);
      if (result.aliasMatches?.length) {
        const symbols = Array.from(
          new Set(result.aliasMatches.map((match) => match.officialSymbol || match.systematicName).filter(Boolean))
        );
        if (symbols.length) details.push(`alias resolved to ${symbols.join(", ")}`);
      }
      if (result.dataWarnings?.length) details.push(result.dataWarnings.join(" "));
      const range = result.total
        ? `Showing ${UI.formatNumber(result.start)}–${UI.formatNumber(result.end)} of ${UI.formatNumber(result.total)}.`
        : "No matching records.";
      UI.setStatus(statusElement, `${range}${details.length ? ` Query was ${details.join("; ")}.` : ""}`, result.total ? "info" : "warning");
    };

    const renderPagination = (result) => {
      const goToPage = (page) => {
        state.page = page;
        runSearch({ updateUrl: true, scroll: true });
      };
      UI.renderPagination(paginationTop, result, goToPage);
      UI.renderPagination(paginationBottom, result, goToPage);
    };

    const runSearch = async ({ updateUrl = true, scroll = false } = {}) => {
      const query = UI.clean(queryInput.value);
      const filters = currentFilters();
      const scope = scopeSelect.value;

      if (!query && !filters.organism && !filters.experimentalSystem && !filters.order) {
        state.lastResult = null;
        countElement.textContent = "0 records";
        queryLabel.textContent = "your query";
        UI.setStatus(statusElement, "Enter a query or choose at least one filter to begin.", "info");
        UI.setInteractionHeader(thead);
        UI.emptyTable(
          tbody,
          7,
          "Enter a query or choose filters",
          "Examples: TDB00001, 1535083, PUBMED:29601579, WRKY18, CDC14 or SGO1."
        );
        paginationTop.replaceChildren();
        paginationBottom.replaceChildren();
        exportButton.disabled = true;
        if (updateUrl) syncUrl();
        return;
      }

      if (updateUrl) syncUrl();
      countElement.textContent = "Searching…";
      UI.setStatus(statusElement, "Loading indexes and searching…", "info");
      exportButton.disabled = true;

      try {
        let result;
        if (scope === "evidence") {
          result = await Data.searchEvidence(query, filters);
          UI.setEvidenceHeader(thead);
          UI.renderEvidenceTable(tbody, result.records);
        } else {
          result = await Data.searchInteractions(query, filters);
          UI.setInteractionHeader(thead);
          UI.renderInteractionTable(tbody, result.records, result.fieldMap);
        }
        state.page = result.page;
        state.lastResult = result;
        renderSummary(result, scope);
        renderPagination(result);
        exportButton.disabled = !result.records.length;
        if (scroll) UI.$(".result-toolbar")?.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (error) {
        console.error("TripleDB search failed", error);
        state.lastResult = null;
        countElement.textContent = "0 records";
        UI.setStatus(
          statusElement,
          `Search failed. Confirm that the three fixed-name JSON files are present and valid. ${error.message || error}`,
          "warning"
        );
        UI.emptyTable(tbody, 7, "Search data unavailable", "Run verify_release_files.py and reload the page.");
        paginationTop.replaceChildren();
        paginationBottom.replaceChildren();
      }
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      state.page = 1;
      runSearch({ updateUrl: true });
    });

    scopeSelect.addEventListener("change", () => {
      setScopeControls();
      state.page = 1;
      runSearch({ updateUrl: true });
    });

    [organismSelect, experimentalSelect, orderSelect, pageSizeSelect].forEach((select) => {
      select.addEventListener("change", () => {
        state.page = 1;
        runSearch({ updateUrl: true });
      });
    });

    resetButton.addEventListener("click", () => {
      queryInput.value = "";
      scopeSelect.value = "interactions";
      organismSelect.value = "";
      experimentalSelect.value = "";
      orderSelect.value = "";
      pageSizeSelect.value = "50";
      state.page = 1;
      setScopeControls();
      runSearch({ updateUrl: true });
      queryInput.focus();
    });

    exportButton.addEventListener("click", () => {
      if (!state.lastResult?.records?.length) return;
      const stem = scopeSelect.value === "evidence" ? "tripledb_source_search" : "tripledb_interaction_search";
      UI.downloadObject(`${stem}_page_${state.lastResult.page}.json`, {
        query: UI.clean(queryInput.value),
        filters: currentFilters(),
        total_matches: state.lastResult.total,
        exported_records: state.lastResult.records
      });
    });

    const hasInitialQuery = Boolean(
      UI.clean(queryInput.value) ||
      organismSelect.value ||
      experimentalSelect.value ||
      orderSelect.value
    );
    if (hasInitialQuery) await runSearch({ updateUrl: false });
    else await runSearch({ updateUrl: false });
  });
})();
