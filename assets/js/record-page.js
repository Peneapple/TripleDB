(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", async () => {
    if (document.body.dataset.page !== "record") return;

    const UI = window.TripleDBUI;
    const Data = window.TripleDBData;
    const params = new URLSearchParams(window.location.search);
    const tdbId = UI.clean(params.get("id") || params.get("tdb"));
    const status = UI.$("#record-status");
    const content = UI.$("#record-content");
    const exportButton = UI.$("#record-export");

    if (!tdbId) {
      UI.setStatus(status, "No TDB accession was supplied. Open a record from Search or Browse.", "warning");
      content.hidden = true;
      return;
    }

    UI.setStatus(status, `Loading ${tdbId}…`, "info");

    try {
      const context = await Data.getRecordContext(tdbId);
      if (!context) {
        UI.setStatus(status, `No curated record was found for ${tdbId}.`, "warning");
        content.hidden = true;
        return;
      }

      const { record, core, fieldMap, sourceRecords, sourceAvailable, previous, next } = context;
      const get = (field, fallbackName) => UI.clean(record?.[fieldMap[field]] ?? record?.[fallbackName]);
      const id = get("tdb_id", "TripleDB_ID");
      const organism = get("organism", "Organism");
      const experimentalSystem = get("experimental_system", "Experimental System");
      const qualification = get("qualifications", "Qualifications");
      const genes = Data.getCoreGenes(record, core);
      const sourceIds = Data.getSourceIds(record, core);
      const order = Data.getInteractionOrder(record, core);
      const geneCount = Data.getEstimatedGeneCount(record, core);

      document.title = `${id} | TripleDB`;
      UI.$("#record-id").textContent = id;
      UI.$("#record-subtitle").textContent = `${genes.join(" · ") || "Gene combination not reported"} — ${experimentalSystem || "experimental system not reported"}`;
      UI.$("#record-accession").textContent = id;
      UI.$("#record-organism").textContent = organism || "—";
      UI.$("#record-experimental-system").textContent = experimentalSystem || "—";
      UI.$("#record-order").textContent = UI.interactionLabel(order);
      UI.$("#record-order-side").textContent = UI.interactionLabel(order);
      UI.$("#record-gene-count").textContent = String(geneCount || genes.length || "—");
      UI.$("#record-qualification").textContent = qualification || "No qualification text was provided.";
      UI.$("#record-source-count").textContent = String(sourceIds.length);

      const geneContainer = UI.$("#record-gene-pills");
      geneContainer.replaceChildren();
      UI.appendGenePills(geneContainer, genes, organism);

      const badgeContainer = UI.$("#record-badges");
      badgeContainer.replaceChildren();
      badgeContainer.append(UI.create("span", { className: "badge success", text: "Curated record" }));
      badgeContainer.append(UI.create("span", { className: "badge secondary", text: experimentalSystem || "System not reported" }));
      badgeContainer.append(UI.create("span", { className: "badge", text: organism || "Organism not reported" }));
      badgeContainer.append(UI.create("span", { className: UI.interactionBadgeClass(order), text: UI.interactionLabel(order) }));

      const sourceIdContainer = UI.$("#record-source-ids");
      sourceIdContainer.replaceChildren();
      UI.appendSourceLinks(sourceIdContainer, sourceIds);

      const publicationContainer = UI.$("#record-publications");
      publicationContainer.replaceChildren();
      const publications = Array.from(new Set(
        sourceRecords
          .map((item) => UI.clean(item?.["Publication Source"]))
          .filter(Boolean)
      ));
      if (publications.length) {
        const list = UI.create("div", { className: "inline-link-list" });
        publications.forEach((publication) => list.appendChild(UI.publicationAnchor(publication)));
        publicationContainer.appendChild(list);
      } else {
        publicationContainer.textContent = "—";
      }

      const sourceTbody = UI.$("#record-source-table-body");
      const enrichedSources = sourceRecords.map((sourceRecord) => ({ ...sourceRecord, _linkedTdbIds: [id] }));
      UI.renderEvidenceTable(sourceTbody, enrichedSources, {
        emptyTitle: sourceAvailable ? "No linked source records found" : "Source JSON unavailable",
        emptyDetail: sourceAvailable
          ? "Check that Source_ID values match BioGRID numeric IDs or TDB-prefixed manual source IDs."
          : "Place biogrid_source_index.json in data/ and reload."
      });

      const navigation = UI.$("#record-navigation");
      navigation.replaceChildren();
      const previousId = previous ? UI.clean(previous?.[fieldMap.tdb_id] ?? previous?.TripleDB_ID) : "";
      const nextId = next ? UI.clean(next?.[fieldMap.tdb_id] ?? next?.TripleDB_ID) : "";
      if (previousId) navigation.appendChild(UI.create("a", { className: "btn btn-outline btn-sm", text: `← ${previousId}`, href: UI.recordLink(previousId) }));
      navigation.appendChild(UI.create("a", { className: "btn btn-ghost btn-sm", text: "Back to search", href: `search.html?q=${encodeURIComponent(id)}` }));
      if (nextId) navigation.appendChild(UI.create("a", { className: "btn btn-outline btn-sm", text: `${nextId} →`, href: UI.recordLink(nextId) }));

      exportButton.disabled = false;
      exportButton.addEventListener("click", () => {
        UI.downloadObject(`${id}.json`, {
          record,
          linked_source_records: sourceRecords
        });
      });

      content.hidden = false;
      UI.setStatus(
        status,
        sourceAvailable
          ? `Loaded ${id} with ${sourceRecords.length} linked source record${sourceRecords.length === 1 ? "" : "s"}.`
          : `Loaded ${id}; the source JSON was unavailable, so BioGRID provenance details could not be expanded. Manual source IDs are still shown when present.`,
        sourceAvailable ? "info" : "warning"
      );
    } catch (error) {
      console.error("TripleDB record page failed", error);
      content.hidden = true;
      UI.setStatus(
        status,
        `Record loading failed. Confirm that the fixed-name core JSON is present and valid. ${error.message || error}`,
        "warning"
      );
    }
  });
})();
