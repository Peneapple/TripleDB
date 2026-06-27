(() => {
  "use strict";

  const config = window.TRIPLEDB_CONFIG || {};
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const numberFormatter = new Intl.NumberFormat("en-US");

  const clean = (value) => String(value ?? "").trim();
  const formatNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? numberFormatter.format(number) : clean(value) || "—";
  };

  const create = (tag, options = {}) => {
    const element = document.createElement(tag);
    if (options.className) element.className = options.className;
    if (options.text !== undefined) element.textContent = String(options.text);
    if (options.href) element.href = options.href;
    if (options.title) element.title = options.title;
    if (options.type) element.type = options.type;
    if (options.target) element.target = options.target;
    if (options.rel) element.rel = options.rel;
    Object.entries(options.attrs || {}).forEach(([name, value]) => element.setAttribute(name, value));
    return element;
  };

  const showToast = (message) => {
    let toast = $("#site-toast");
    if (!toast) {
      toast = create("div", {
        className: "toast",
        attrs: { id: "site-toast", role: "status", "aria-live": "polite" }
      });
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => toast.classList.remove("show"), 2400);
  };

  const interactionLabel = (value) => {
    const labels = {
      triple: "Triple",
      quadruple_or_higher: "Quadruple or higher",
      pair_or_lower: "Pair-context / lower-order"
    };
    return labels[value] || clean(value) || "Unclassified";
  };

  const interactionBadgeClass = (value) => {
    if (value === "triple") return "badge success";
    if (value === "quadruple_or_higher") return "badge accent";
    if (value === "pair_or_lower") return "badge warning";
    return "badge";
  };

  const setStatus = (element, message, type = "info") => {
    if (!element) return;
    element.className = `callout ${type} mb-0`;
    element.replaceChildren();
    const icon = create("div", { className: "callout-icon", text: type === "warning" ? "!" : "i" });
    const body = create("div", { text: message });
    element.append(icon, body);
  };

  const populateSelect = (select, values, placeholder, selected = "") => {
    if (!select) return;
    select.replaceChildren();
    const blank = create("option", { text: placeholder });
    blank.value = "";
    select.appendChild(blank);
    (values || []).forEach((value) => {
      const option = create("option", { text: value });
      option.value = value;
      if (value === selected) option.selected = true;
      select.appendChild(option);
    });
  };

  const sourceIdsFromRecord = (record, fieldMap) => {
    if (Array.isArray(record?._derived?.source_ids)) {
      return record._derived.source_ids.map(clean).filter(Boolean);
    }
    return clean(record?.[fieldMap.source_id] ?? record?.Source_ID)
      .split("|")
      .map(clean)
      .filter(Boolean);
  };

  const genesFromRecord = (record, fieldMap) => {
    if (Array.isArray(record?._derived?.genes_indexed) && record._derived.genes_indexed.length) {
      return record._derived.genes_indexed.map(clean).filter(Boolean);
    }
    const geneColumns = fieldMap.gene_columns || ["Gene_A", "Gene_B", "Gene_C", "Gene_D", "Gene_E", "Gene_F", "Gene_G"];
    const genes = [];
    geneColumns.forEach((column) => {
      const value = clean(record?.[column]);
      if (value) genes.push(...value.split(/\s*[+|;,]\s*/).map(clean).filter(Boolean));
    });
    return Array.from(new Set(genes));
  };

  const qualificationSnippet = (text, maxLength = 220) => {
    const value = clean(text);
    if (value.length <= maxLength) return value || "—";
    return `${value.slice(0, maxLength - 1).trimEnd()}…`;
  };

  const geneLink = (gene, organism = "") => {
    const params = new URLSearchParams({ q: gene });
    if (organism) params.set("organism", organism);
    return `search.html?${params.toString()}`;
  };

  const evidenceLink = (query) => `evidence.html?q=${encodeURIComponent(query)}`;
  const recordLink = (tdbId) => `record.html?id=${encodeURIComponent(tdbId)}`;

  const publicationAnchor = (publication) => {
    const value = clean(publication);
    const match = value.match(/^(?:PUBMED|PMID)\s*:?\s*(\d+)$/i);
    if (!match) return create("span", { text: value || "—" });
    return create("a", {
      text: `PUBMED:${match[1]}`,
      href: `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(match[1])}/`,
      target: "_blank",
      rel: "noopener noreferrer",
      title: "Open publication in PubMed"
    });
  };

  const appendGenePills = (container, genes, organism = "") => {
    container.classList.add("gene-pills");
    (genes || []).forEach((gene) => {
      const link = create("a", {
        className: "gene-pill",
        text: gene,
        href: geneLink(gene, organism),
        title: `Search TripleDB for ${gene}`
      });
      container.appendChild(link);
    });
    if (!container.childElementCount) container.appendChild(create("span", { text: "—" }));
  };

  const appendSourceLinks = (container, sourceIds) => {
    const ids = sourceIds || [];
    if (!ids.length) {
      container.textContent = "—";
      return;
    }
    const list = create("div", { className: "inline-link-list" });
    ids.forEach((sourceId) => {
      list.appendChild(
        create("a", {
          className: "mono",
          text: sourceId,
          href: evidenceLink(sourceId),
          title: `Open reference ID ${sourceId}`
        })
      );
    });
    container.appendChild(list);
  };

  const appendTdbLinks = (container, tdbIds) => {
    const ids = tdbIds || [];
    if (!ids.length) {
      container.textContent = "—";
      return;
    }
    const list = create("div", { className: "inline-link-list" });
    ids.forEach((tdbId) => {
      list.appendChild(create("a", { className: "mono", text: tdbId, href: recordLink(tdbId) }));
    });
    container.appendChild(list);
  };

  const emptyTable = (tbody, columnCount, title, detail = "") => {
    tbody.replaceChildren();
    const row = create("tr", { className: "table-empty" });
    const cell = create("td", { attrs: { colspan: String(columnCount) } });
    const state = create("div", { className: "empty-state compact-empty" });
    const inner = create("div");
    inner.append(create("div", { className: "empty-state-icon", text: "⌕" }));
    inner.append(create("h3", { text: title }));
    if (detail) inner.append(create("p", { text: detail }));
    state.appendChild(inner);
    cell.appendChild(state);
    row.appendChild(cell);
    tbody.appendChild(row);
  };

  const setInteractionHeader = (thead) => {
    if (!thead) return;
    thead.innerHTML = "<tr><th>TDB accession</th><th>Gene combination</th><th>Experimental system</th><th>Organism</th><th>Order</th><th>Source IDs</th><th>Qualification</th></tr>";
  };

  const renderInteractionTable = (tbody, records, fieldMap, options = {}) => {
    if (!tbody) return;
    tbody.replaceChildren();
    if (!records?.length) {
      emptyTable(
        tbody,
        7,
        options.emptyTitle || "No curated interaction records found",
        options.emptyDetail || "Try another gene, identifier or filter combination."
      );
      return;
    }

    records.forEach((record) => {
      const row = create("tr");
      const tdbId = clean(record?.[fieldMap.tdb_id] ?? record?.TripleDB_ID);
      const organism = clean(record?.[fieldMap.organism] ?? record?.Organism);
      const experimentalSystem = clean(
        record?.[fieldMap.experimental_system] ?? record?.["Experimental System"]
      );
      const qualification = clean(record?.[fieldMap.qualifications] ?? record?.Qualifications);
      const order = clean(record?._derived?.interaction_order_class);

      const idCell = create("td");
      idCell.appendChild(create("a", { className: "mono strong-link", text: tdbId || "—", href: recordLink(tdbId) }));

      const geneCell = create("td");
      appendGenePills(geneCell, genesFromRecord(record, fieldMap), organism);

      const relationCell = create("td", { text: experimentalSystem || "—" });
      const organismCell = create("td", { text: organism || "—" });
      const orderCell = create("td");
      orderCell.appendChild(create("span", { className: interactionBadgeClass(order), text: interactionLabel(order) }));

      const sourceCell = create("td");
      appendSourceLinks(sourceCell, sourceIdsFromRecord(record, fieldMap));

      const qualificationCell = create("td");
      qualificationCell.className = "qualification-cell";
      const snippet = create("span", {
        text: qualificationSnippet(qualification),
        title: qualification || "No qualification text"
      });
      qualificationCell.appendChild(snippet);

      row.append(idCell, geneCell, relationCell, organismCell, orderCell, sourceCell, qualificationCell);
      tbody.appendChild(row);
    });
  };

  const setEvidenceHeader = (thead) => {
    if (!thead) return;
    thead.innerHTML = "<tr><th>Reference ID</th><th>Author</th><th>Publication</th><th>System type</th><th>Organism</th><th>Qualification</th><th>Linked TDB records</th></tr>";
  };

  const renderEvidenceTable = (tbody, records, options = {}) => {
    if (!tbody) return;
    tbody.replaceChildren();
    if (!records?.length) {
      emptyTable(
        tbody,
        7,
        options.emptyTitle || "No source evidence records found",
        options.emptyDetail || "Try a BioGRID ID, PubMed ID, TDB accession or gene."
      );
      return;
    }

    records.forEach((record) => {
      const row = create("tr");
      const bioGridId = clean(record?.["BioGRID ID"]);
      const referenceId = clean(record?._manualSourceId || record?.["Reference ID"] || bioGridId);
      const sourceType = clean(record?._sourceType) || (bioGridId ? "BioGRID source" : "Non-BioGRID source");

      const idCell = create("td");
      if (referenceId) {
        idCell.appendChild(create("a", { className: "mono strong-link", text: referenceId, href: evidenceLink(referenceId) }));
      } else {
        idCell.appendChild(create("span", { text: "—" }));
      }
      idCell.appendChild(create("br"));
      idCell.appendChild(create("span", {
        className: bioGridId ? "badge secondary" : "badge warning",
        text: sourceType
      }));

      const authorCell = create("td", { text: clean(record?.Author) || "—" });
      const publicationCell = create("td");
      publicationCell.appendChild(publicationAnchor(record?.["Publication Source"]));
      const systemCell = create("td", { text: clean(record?.["Experimental System Type"]) || "—" });
      const organismCell = create("td", { text: clean(record?.Organism) || "—" });
      const qualification = clean(record?.Qualifications);
      const qualificationCell = create("td", { className: "qualification-cell" });
      qualificationCell.appendChild(
        create("span", { text: qualificationSnippet(qualification, 260), title: qualification || "No qualification text" })
      );
      const linkedCell = create("td");
      appendTdbLinks(linkedCell, record?._linkedTdbIds || []);
      row.append(idCell, authorCell, publicationCell, systemCell, organismCell, qualificationCell, linkedCell);
      tbody.appendChild(row);
    });
  };

  const renderPagination = (container, pageInfo, onChange) => {
    if (!container) return;
    container.replaceChildren();
    const total = Number(pageInfo?.total || 0);
    const page = Number(pageInfo?.page || 1);
    const totalPages = Number(pageInfo?.totalPages || 1);
    const start = Number(pageInfo?.start || 0);
    const end = Number(pageInfo?.end || 0);

    const summary = create("span", {
      className: "pagination-summary",
      text: total ? `${formatNumber(start)}–${formatNumber(end)} of ${formatNumber(total)}` : "0 records"
    });
    const controls = create("div", { className: "pagination-controls" });

    const addButton = (label, targetPage, disabled, title) => {
      const button = create("button", {
        className: "btn btn-outline btn-sm",
        text: label,
        type: "button",
        title,
        attrs: { "aria-label": title }
      });
      button.disabled = disabled;
      button.addEventListener("click", () => onChange(targetPage));
      controls.appendChild(button);
    };

    addButton("First", 1, page <= 1, "Go to first page");
    addButton("Previous", page - 1, page <= 1, "Go to previous page");
    controls.appendChild(create("span", { className: "pagination-page", text: `Page ${page} of ${totalPages}` }));
    addButton("Next", page + 1, page >= totalPages, "Go to next page");
    addButton("Last", totalPages, page >= totalPages, "Go to last page");

    container.append(summary, controls);
  };

  const downloadObject = (filename, value) => {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = create("a", { href: url });
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const updateUrl = (params) => {
    const next = new URL(window.location.href);
    next.search = "";
    Object.entries(params || {}).forEach(([key, value]) => {
      const cleaned = clean(value);
      if (cleaned) next.searchParams.set(key, cleaned);
    });
    window.history.replaceState(null, "", `${next.pathname}${next.search}${next.hash}`);
  };

  const initializeConfigText = () => {
    $$('[data-config="releaseLabel"]').forEach((element) => {
      element.textContent = config.releaseLabel || "Search-enabled build";
    });
    $$('[data-config="updatePolicy"]').forEach((element) => {
      element.textContent = config.updatePolicy || "Planned annual updates";
    });
    $$('[data-config="contactEmail"]').forEach((element) => {
      const email = config.contactEmail || "replace-with-project-email@example.org";
      element.textContent = email;
      if (element.tagName === "A") element.href = `mailto:${email}`;
    });
    $$('[data-config="citationText"]').forEach((element) => {
      element.textContent = config.citationText || "Citation pending.";
    });
    $$('[data-current-year]').forEach((element) => {
      element.textContent = String(new Date().getFullYear());
    });
    $$('[data-file-path]').forEach((element) => {
      const key = element.dataset.filePath;
      const value = config.dataFiles?.[key] || config.downloadFiles?.[key];
      if (value) element.textContent = value;
    });
  };

  const initializeMenu = () => {
    const menuButton = $("#menu-button");
    const nav = $("#primary-nav");
    if (!menuButton || !nav) return;
    const close = () => {
      nav.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
    };
    menuButton.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      menuButton.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) close();
    });
  };

  const initializeTheme = () => {
    const button = $("#theme-toggle");
    if (!button) return;
    const stored = localStorage.getItem("tripledb-theme");
    const preferredDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = stored || (preferredDark ? "dark" : "light");
    const sync = () => {
      const isDark = document.documentElement.dataset.theme === "dark";
      button.setAttribute("aria-label", isDark ? "Use light theme" : "Use dark theme");
      button.title = isDark ? "Use light theme" : "Use dark theme";
      button.textContent = isDark ? "☀" : "◐";
    };
    sync();
    button.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("tripledb-theme", next);
      sync();
    });
  };

  const renderDistribution = (tbody, items, total, labelMapper = (value) => value) => {
    if (!tbody || !Array.isArray(items)) return;
    tbody.replaceChildren();
    const denominator = Number(total) || items.reduce((sum, item) => sum + Number(item.count || 0), 0);
    items.forEach((item) => {
      const count = Number(item.count) || 0;
      const percent = denominator > 0 ? (count / denominator) * 100 : 0;
      const row = create("tr");
      row.appendChild(create("td", { text: labelMapper(String(item.value)) }));
      row.appendChild(create("td", { className: "number-cell", text: formatNumber(count) }));
      const percentCell = create("td", { className: "distribution-cell" });
      const bar = create("div", {
        className: "distribution-bar",
        attrs: { "aria-label": `${percent.toFixed(2)} percent` }
      });
      const fill = create("span");
      fill.style.width = `${Math.max(percent, count > 0 ? 0.6 : 0)}%`;
      bar.appendChild(fill);
      percentCell.append(bar, create("span", {
        className: "distribution-percent",
        text: `${percent.toFixed(percent >= 10 ? 1 : 2)}%`
      }));
      row.appendChild(percentCell);
      tbody.appendChild(row);
    });
  };

  const initializeStatistics = async () => {
    if (!$$('[data-stat], [data-distribution], [data-statistics-status]').length) return;
    if (!window.TripleDBData?.getStatistics) return;
    try {
      const stats = await window.TripleDBData.getStatistics();
      $$('[data-stat]').forEach((element) => {
        const key = element.dataset.stat;
        if (Object.prototype.hasOwnProperty.call(stats, key)) element.textContent = formatNumber(stats[key]);
      });
      renderDistribution(
        $('[data-distribution="interaction-order"]'),
        stats.interactionOrderDistribution,
        stats.curatedRecords,
        interactionLabel
      );
      renderDistribution($('[data-distribution="organism"]'), stats.organismDistribution, stats.curatedRecords);
      renderDistribution(
        $('[data-distribution="experimental-system"]'),
        stats.experimentalSystemDistribution,
        stats.curatedRecords
      );
      $$('[data-statistics-status]').forEach((element) => {
        if (stats.liveDataLoaded) {
          element.textContent = "Current statistics were loaded from the fixed-name core and source JSON files.";
        } else if (stats.liveCoreLoaded || stats.liveSourceLoaded || stats.liveAliasLoaded) {
          element.textContent = "Some live JSON files were loaded; unavailable values use the bundled statistics snapshot.";
        } else if (window.location.protocol === "file:") {
          element.textContent = "Showing the bundled snapshot. Start the included local server to load JSON files.";
        } else {
          element.textContent = "Showing the bundled snapshot because one or more fixed-name JSON files are unavailable.";
        }
      });
      $$('[data-statistics-source]').forEach((element) => {
        element.textContent = stats.liveDataLoaded ? "Live JSON" : "Snapshot / partial JSON";
        element.classList.toggle("success", stats.liveDataLoaded);
        element.classList.toggle("warning", !stats.liveDataLoaded);
      });
    } catch (error) {
      console.error("TripleDB statistics initialization failed", error);
    }
  };

  const initializeCopyButtons = () => {
    $$('[data-copy]').forEach((button) => {
      button.addEventListener("click", async () => {
        let value = button.dataset.copyValue || "";
        if (button.dataset.copy === "url") value = window.location.href;
        if (button.dataset.copy === "citation") value = config.citationText || "TripleDB citation pending.";
        try {
          await navigator.clipboard.writeText(value);
          showToast("Copied to clipboard");
        } catch (_error) {
          showToast("Copy is unavailable in this browser");
        }
      });
    });
  };

  const initializePreviewActions = () => {
    $$('[data-preview-action]').forEach((element) => {
      element.addEventListener("click", (event) => {
        event.preventDefault();
        showToast(element.dataset.previewMessage || "This optional workflow is not enabled in the current build.");
      });
    });
  };

  const initializeDocumentationTracking = () => {
    const links = $$(".docs-nav a");
    if (!links.length || !("IntersectionObserver" in window)) return;
    const sections = links.map((link) => $(link.getAttribute("href"))).filter(Boolean);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        links.forEach((link) => {
          const active = link.getAttribute("href") === `#${visible.target.id}`;
          link.style.background = active ? "var(--primary-soft)" : "";
          link.style.color = active ? "var(--primary-strong)" : "";
        });
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: [0.05, 0.25, 0.6] }
    );
    sections.forEach((section) => observer.observe(section));
  };

  const initializeCloudflareAnalytics = () => {
    const token = clean(config.cloudflareAnalyticsToken);
    if (!token) return;

    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || window.location.protocol === "file:") return;

    if (document.querySelector('script[src*="static.cloudflareinsights.com/beacon.min.js"]')) return;

    const script = document.createElement("script");
    script.defer = true;
    script.src = "https://static.cloudflareinsights.com/beacon.min.js";
    script.setAttribute("data-cf-beacon", JSON.stringify({ token }));
    document.head.appendChild(script);
  };

  window.TripleDBUI = {
    $,
    $$,
    clean,
    create,
    formatNumber,
    showToast,
    setStatus,
    populateSelect,
    interactionLabel,
    interactionBadgeClass,
    sourceIdsFromRecord,
    genesFromRecord,
    geneLink,
    evidenceLink,
    recordLink,
    publicationAnchor,
    appendGenePills,
    appendSourceLinks,
    appendTdbLinks,
    setInteractionHeader,
    renderInteractionTable,
    setEvidenceHeader,
    renderEvidenceTable,
    renderPagination,
    emptyTable,
    downloadObject,
    updateUrl
  };

  document.addEventListener("DOMContentLoaded", () => {
    initializeConfigText();
    initializeMenu();
    initializeTheme();
    initializeStatistics();
    initializeCopyButtons();
    initializePreviewActions();
    initializeDocumentationTracking();
    initializeCloudflareAnalytics();
  });
})();
