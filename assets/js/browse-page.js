(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", async () => {
    if (document.body.dataset.page !== "browse") return;

    const UI = window.TripleDBUI;
    const Data = window.TripleDBData;
    const organismSelect = UI.$("#browse-organism");
    const experimentalSelect = UI.$("#browse-experimental-system");
    const orderSelect = UI.$("#browse-order");
    const pageSizeSelect = UI.$("#browse-page-size");
    const resetButton = UI.$("#browse-reset");
    const statusElement = UI.$("#browse-status");
    const countElement = UI.$("#browse-count");
    const thead = UI.$("#browse-table-head");
    const tbody = UI.$("#browse-table-body");
    const paginationTop = UI.$("#browse-pagination-top");
    const paginationBottom = UI.$("#browse-pagination-bottom");
    const geneList = UI.$("#gene-index-results");
    const geneStatus = UI.$("#gene-index-status");
    const geneQuery = UI.$("#gene-index-query");
    const alphabet = UI.$("#gene-alphabet");
    const speciesGrid = UI.$("#species-grid-live");
    const relationGrid = UI.$("#relation-grid-live");

    if (!Data?.searchInteractions) return;

    const params = new URLSearchParams(window.location.search);
    const state = {
      page: Math.max(1, Number(params.get("page")) || 1),
      geneLetter: (params.get("letter") || "A").toUpperCase(),
      lastResult: null
    };

    try {
      UI.setStatus(statusElement, "Loading curated interaction records…", "info");
      const [options, stats] = await Promise.all([Data.getFilterOptions(), Data.getStatistics()]);
      UI.populateSelect(organismSelect, options.organisms, "All organisms", params.get("organism") || "");
      UI.populateSelect(
        experimentalSelect,
        options.experimentalSystems,
        "All experimental systems",
        params.get("experimentalSystem") || ""
      );
      UI.populateSelect(orderSelect, options.interactionOrders, "All interaction orders", params.get("order") || "");
      if (params.get("pageSize")) pageSizeSelect.value = params.get("pageSize");

      renderSpeciesCards(stats.organismDistribution || []);
      renderRelationCards(stats.experimentalSystemDistribution || []);
    } catch (error) {
      UI.setStatus(
        statusElement,
        `Browse data could not be loaded. Put the three fixed-name JSON files in data/. ${error.message || error}`,
        "warning"
      );
      UI.emptyTable(tbody, 7, "Browse data unavailable", "Run verify_release_files.py and reload.");
      return;
    }

    function renderSpeciesCards(items) {
      if (!speciesGrid) return;
      speciesGrid.replaceChildren();
      items.forEach((item) => {
        const card = UI.create("button", {
          className: "card pad browse-choice-card",
          type: "button",
          attrs: { "aria-label": `Browse ${item.value}` }
        });
        card.append(UI.create("h3", { text: item.value }));
        card.append(UI.create("span", { className: "species-count", text: UI.formatNumber(item.count) }));
        card.append(UI.create("span", { className: "small subtle", text: "curated records" }));
        card.addEventListener("click", () => {
          organismSelect.value = item.value;
          state.page = 1;
          runBrowse({ updateUrl: true, scroll: true });
          loadGeneIndex();
        });
        speciesGrid.appendChild(card);
      });
    }

    function renderRelationCards(items) {
      if (!relationGrid) return;
      relationGrid.replaceChildren();
      items.forEach((item) => {
        const link = UI.create("a", {
          className: "relation-list-item",
          href: `search.html?experimentalSystem=${encodeURIComponent(item.value)}`
        });
        link.append(UI.create("span", { text: item.value }));
        link.append(UI.create("strong", { text: UI.formatNumber(item.count) }));
        relationGrid.appendChild(link);
      });
    }

    const filters = () => ({
      organism: UI.clean(organismSelect.value),
      experimentalSystem: UI.clean(experimentalSelect.value),
      order: UI.clean(orderSelect.value),
      page: state.page,
      pageSize: UI.clean(pageSizeSelect.value) || "50"
    });

    const syncUrl = () => {
      const current = filters();
      UI.updateUrl({
        organism: current.organism,
        experimentalSystem: current.experimentalSystem,
        order: current.order,
        page: state.page > 1 ? state.page : "",
        pageSize: current.pageSize !== "50" ? current.pageSize : "",
        letter: state.geneLetter !== "A" ? state.geneLetter : ""
      });
    };

    const runBrowse = async ({ updateUrl = true, scroll = false } = {}) => {
      if (updateUrl) syncUrl();
      UI.setStatus(statusElement, "Loading records…", "info");
      countElement.textContent = "Loading…";
      try {
        const result = await Data.searchInteractions("", filters());
        state.page = result.page;
        state.lastResult = result;
        UI.setInteractionHeader(thead);
        UI.renderInteractionTable(tbody, result.records, result.fieldMap);
        countElement.textContent = `${UI.formatNumber(result.total)} curated record${result.total === 1 ? "" : "s"}`;
        UI.setStatus(
          statusElement,
          result.total
            ? `Showing ${UI.formatNumber(result.start)}–${UI.formatNumber(result.end)} of ${UI.formatNumber(result.total)} records.`
            : "No records match the selected filters.",
          result.total ? "info" : "warning"
        );
        const changePage = (page) => {
          state.page = page;
          runBrowse({ updateUrl: true, scroll: true });
        };
        UI.renderPagination(paginationTop, result, changePage);
        UI.renderPagination(paginationBottom, result, changePage);
        if (scroll) UI.$("#record-browser")?.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (error) {
        console.error("TripleDB browse failed", error);
        countElement.textContent = "0 records";
        UI.setStatus(statusElement, `Browse failed: ${error.message || error}`, "warning");
        UI.emptyTable(tbody, 7, "Browse data unavailable", "Check the core JSON filename and schema.");
      }
    };

    const renderAlphabet = () => {
      if (!alphabet) return;
      alphabet.replaceChildren();
      ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].forEach((letter) => {
        const button = UI.create("button", {
          className: `alpha-button${state.geneLetter === letter ? " active" : ""}`,
          text: letter,
          type: "button",
          attrs: { "aria-pressed": String(state.geneLetter === letter) }
        });
        button.addEventListener("click", () => {
          state.geneLetter = letter;
          renderAlphabet();
          syncUrl();
          loadGeneIndex();
        });
        alphabet.appendChild(button);
      });
    };

    const loadGeneIndex = async () => {
      if (!geneList) return;
      geneList.replaceChildren(UI.create("span", { className: "muted", text: "Loading gene index…" }));
      try {
        const result = await Data.getGeneIndex({
          organism: organismSelect.value,
          letter: state.geneLetter,
          query: geneQuery.value,
          limit: 300
        });
        geneList.replaceChildren();
        result.genes.forEach((item) => {
          const link = UI.create("a", {
            className: "gene-index-item",
            href: UI.geneLink(item.gene, organismSelect.value)
          });
          link.append(UI.create("span", { className: "mono", text: item.gene }));
          link.append(UI.create("span", { className: "badge", text: UI.formatNumber(item.count) }));
          geneList.appendChild(link);
        });
        if (!result.genes.length) {
          geneList.appendChild(UI.create("p", { className: "muted", text: "No indexed genes match this letter or filter." }));
        }
        geneStatus.textContent = result.truncated
          ? `Showing the first ${UI.formatNumber(result.genes.length)} of ${UI.formatNumber(result.total)} genes.`
          : `${UI.formatNumber(result.total)} indexed gene${result.total === 1 ? "" : "s"}.`;
      } catch (error) {
        geneList.replaceChildren(UI.create("p", { className: "muted", text: `Gene index unavailable: ${error.message || error}` }));
      }
    };

    [organismSelect, experimentalSelect, orderSelect, pageSizeSelect].forEach((select) => {
      select.addEventListener("change", () => {
        state.page = 1;
        runBrowse({ updateUrl: true });
        if (select === organismSelect) loadGeneIndex();
      });
    });

    resetButton.addEventListener("click", () => {
      organismSelect.value = "";
      experimentalSelect.value = "";
      orderSelect.value = "";
      pageSizeSelect.value = "50";
      state.page = 1;
      runBrowse({ updateUrl: true });
      loadGeneIndex();
    });

    let geneTimer;
    geneQuery.addEventListener("input", () => {
      window.clearTimeout(geneTimer);
      geneTimer = window.setTimeout(loadGeneIndex, 180);
    });

    renderAlphabet();
    await Promise.all([runBrowse({ updateUrl: false }), loadGeneIndex()]);
  });
})();
