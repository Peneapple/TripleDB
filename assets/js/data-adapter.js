/*
  TripleDB static-data adapter.

  The website has no backend. It loads three fixed-name JSON files and uses
  their precomputed indexes in the browser:

    data/tdb_core_interaction_index.json
    data/gene_alias_search_index_by_organism.json
    data/biogrid_source_index.json

  Public methods are exposed as window.TripleDBData.
*/
(() => {
  "use strict";

  const config = window.TRIPLEDB_CONFIG || {};
  const paths = config.dataFiles || {};
  const fallback = config.fallbackStatistics || {};
  const searchConfig = config.search || {};
  const cache = new Map();

  const clean = (value) => String(value ?? "").trim();
  const normalizeKey = (value) => clean(value).replace(/\s+/g, " ").toLowerCase();
  const asNumber = (value, defaultValue = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number(defaultValue) || 0;
  };

  const unique = (items) => {
    const seen = new Set();
    const result = [];
    (items || []).forEach((item) => {
      if (item === undefined || item === null || item === "") return;
      const key = String(item);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    });
    return result;
  };

  const uniqueNumbers = (items) => unique(items.map((item) => Number(item)).filter(Number.isFinite));

  const fetchJson = async (path) => {
    if (!path) throw new Error("A required JSON path is not configured.");
    if (cache.has(path)) return cache.get(path);

    const request = fetch(path, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`${path}: HTTP ${response.status} ${response.statusText}`);
      }
      try {
        return await response.json();
      } catch (error) {
        throw new Error(`${path}: invalid JSON (${error.message || error})`);
      }
    });

    cache.set(path, request);
    return request;
  };

  const loadOptional = async (label, path) => {
    try {
      return { label, ok: true, data: await fetchJson(path), error: null };
    } catch (error) {
      return {
        label,
        ok: false,
        data: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  };

  const validateCore = (core) => {
    if (!core || !Array.isArray(core.records) || !core.indexes) {
      throw new Error("Core JSON must contain records[] and indexes{}.");
    }
    return core;
  };

  const validateSource = (source) => {
    if (!source || !Array.isArray(source.records) || !source.indexes) {
      throw new Error("BioGRID source JSON must contain records[] and indexes{}.");
    }
    return source;
  };

  const validateAliases = (aliases) => {
    if (!aliases || typeof aliases !== "object" || Array.isArray(aliases)) {
      throw new Error("Gene alias JSON must be an organism-keyed object.");
    }
    return aliases;
  };

  const loadCore = async () => validateCore(await fetchJson(paths.core));
  const loadSource = async () => validateSource(await fetchJson(paths.source));
  const loadAliases = async ({ optional = true } = {}) => {
    try {
      return validateAliases(await fetchJson(paths.aliases));
    } catch (error) {
      if (optional) return null;
      throw error;
    }
  };

  const getCoreFieldMap = (core) => {
    const map = core?._meta?.column_mapping_used || {};
    const columns = Array.isArray(core?._meta?.columns) ? core._meta.columns : [];
    const fallbackGeneColumns = ["Gene_A", "Gene_B", "Gene_C", "Gene_D", "Gene_E", "Gene_F", "Gene_G"];
    const mappedGeneColumns = Array.isArray(map.gene_columns) ? map.gene_columns : [];
    const detectedGeneColumns = columns.filter((name) => /^Gene_[A-Z]$/i.test(clean(name)));
    const geneColumns = unique(
      mappedGeneColumns
        .concat(detectedGeneColumns)
        .concat(fallbackGeneColumns)
        .map(clean)
        .filter(Boolean)
    );
    return {
      tdb_id: map.tdb_id || "TripleDB_ID",
      source_id: map.source_id || "Source_ID",
      organism: map.organism || "Organism",
      experimental_system: map.experimental_system || "Experimental System",
      gene_a: map.gene_a || "Gene_A",
      gene_b: map.gene_b || "Gene_B",
      gene_c: map.gene_c || "Gene_C",
      gene_d: map.gene_d || "Gene_D",
      gene_e: map.gene_e || "Gene_E",
      gene_f: map.gene_f || "Gene_F",
      gene_g: map.gene_g || "Gene_G",
      gene_columns: geneColumns,
      qualifications: map.qualifications || "Qualifications"
    };
  };

  const recordField = (record, fieldName, alternatives = []) => {
    if (!record) return "";
    if (Object.prototype.hasOwnProperty.call(record, fieldName)) return record[fieldName] ?? "";
    for (const alternative of alternatives) {
      if (Object.prototype.hasOwnProperty.call(record, alternative)) return record[alternative] ?? "";
    }
    return "";
  };

  const rowsToRecords = (db, rowIds) => {
    const records = Array.isArray(db?.records) ? db.records : [];
    return uniqueNumbers(rowIds || []).map((rowId) => records[rowId]).filter(Boolean);
  };

  const indexHits = (db, indexName, key) => {
    if (key === undefined || key === null || key === "") return [];
    const index = db?.indexes?.[indexName];
    if (!index) return [];
    const hits = index[String(key)];
    return Array.isArray(hits) ? hits : [];
  };

  const indexHitsCaseInsensitive = (db, indexName, key) => {
    const query = clean(key);
    const index = db?.indexes?.[indexName];
    if (!query || !index) return [];
    if (Array.isArray(index[query])) return index[query];
    const lower = query.toLowerCase();
    const matchedKey = Object.keys(index).find((candidate) => candidate.toLowerCase() === lower);
    return matchedKey ? index[matchedKey] : [];
  };

  const allRowIds = (db) => Array.from({ length: db?.records?.length || 0 }, (_, index) => index);

  const parseQuery = (query) => {
    const raw = clean(query);
    const tdbMatch = raw.match(/^TDB\s*0*(\d+)$/i);
    const pubmedMatch = raw.match(/^(?:PUBMED|PMID)\s*:?\s*([1-9]\d{0,9})$/i);
    const biogridMatch = raw.match(/^BIOGRID\s*:?\s*(\d+)$/i);
    const numeric = /^\d{3,12}$/.test(raw) ? raw : null;
    return {
      raw,
      normalized: normalizeKey(raw),
      tdbId: tdbMatch ? `TDB${String(Number(tdbMatch[1])).padStart(5, "0")}` : null,
      pubmedId: pubmedMatch ? pubmedMatch[1] : null,
      biogridId: biogridMatch ? biogridMatch[1] : null,
      numeric,
      isIdentifier: Boolean(tdbMatch || pubmedMatch || biogridMatch || numeric)
    };
  };

  const splitGeneCell = (value) => clean(value).split(/\s*[+|;,]\s*/).map(clean).filter(Boolean);

  const getCoreGenes = (record, core) => {
    const derived = record?._derived?.genes_indexed;
    if (Array.isArray(derived) && derived.length) return unique(derived.map(clean).filter(Boolean));
    const map = getCoreFieldMap(core);
    const genes = [];
    (map.gene_columns || ["Gene_A", "Gene_B", "Gene_C", "Gene_D", "Gene_E", "Gene_F", "Gene_G"]).forEach((column) => {
      const value = recordField(record, column, [column]);
      if (clean(value)) genes.push(...splitGeneCell(value));
    });
    return unique(genes);
  };

  const getSourceIds = (record, core) => {
    const derived = record?._derived?.source_ids;
    if (Array.isArray(derived)) return unique(derived.map(clean).filter(Boolean));
    const map = getCoreFieldMap(core);
    return unique(
      clean(recordField(record, map.source_id, ["Source_ID"]))
        .split("|")
        .map(clean)
        .filter(Boolean)
    );
  };

  const PUBMED_TEXT_REGEX = /\b(?:PUBMED|PMID)\s*:?\s*([1-9]\d{0,9})\b/gi;

  const extractPubMedIdsFromText = (text) => {
    const value = clean(text);
    if (!value) return [];
    const ids = [];
    let match;
    PUBMED_TEXT_REGEX.lastIndex = 0;
    while ((match = PUBMED_TEXT_REGEX.exec(value)) !== null) {
      ids.push(match[1]);
    }
    return unique(ids);
  };

  const getCorePubMedIds = (record, core = null) => {
    const derived = record?._derived?.pubmed_ids;
    const ids = Array.isArray(derived) ? derived.map(clean).filter(Boolean) : [];
    const map = core ? getCoreFieldMap(core) : { qualifications: "Qualifications" };
    ids.push(...extractPubMedIdsFromText(recordField(record, map.qualifications, ["Qualifications"])));
    return unique(ids);
  };

  const addPubMedIdsFromText = (set, text) => {
    extractPubMedIdsFromText(text).forEach((pmid) => set.add(pmid));
  };

  const collectUniquePubMedIds = (core, source) => {
    const ids = new Set();
    const coreMap = core ? getCoreFieldMap(core) : { qualifications: "Qualifications" };

    if (Array.isArray(source?.records)) {
      source.records.forEach((record) => {
        addPubMedIdsFromText(ids, record?.["Publication Source"]);
        addPubMedIdsFromText(ids, record?.Qualifications);
      });
    }

    if (Array.isArray(core?.records)) {
      core.records.forEach((record) => {
        getCorePubMedIds(record, core).forEach((pmid) => ids.add(pmid));
        addPubMedIdsFromText(ids, recordField(record, coreMap.qualifications, ["Qualifications"]));
      });
    }

    return Array.from(ids).sort((a, b) => Number(a) - Number(b));
  };


  const sourceIdContainsManualTdbMarker = (record, core = null) => {
    const map = core ? getCoreFieldMap(core) : { source_id: "Source_ID" };
    const sourceText = clean(recordField(record, map.source_id, ["Source_ID"]));
    return /TDB/i.test(sourceText);
  };

  const countManualCurationRecords = (core) => {
    if (!Array.isArray(core?.records)) return asNumber(fallback.manualCurationRecords, 0);
    return core.records.reduce((count, record) => count + (sourceIdContainsManualTdbMarker(record, core) ? 1 : 0), 0);
  };

  const getInteractionOrder = (record, core) => {
    if (record?._derived?.interaction_order_class) return record._derived.interaction_order_class;
    const geneCount = getCoreGenes(record, core).length;
    if (geneCount >= 4) return "quadruple_or_higher";
    if (geneCount === 3) return "triple";
    return "pair_or_lower";
  };

  const getEstimatedGeneCount = (record, core) => {
    const derived = Number(record?._derived?.estimated_gene_count);
    return Number.isFinite(derived) ? derived : getCoreGenes(record, core).length;
  };

  const sourcePublication = (record) => clean(record?.["Publication Source"]);
  const sourceBioGridId = (record) => clean(record?.["BioGRID ID"]);
  const sourcePubMedNumber = (record) => {
    const match = sourcePublication(record).match(/^(?:PUBMED|PMID)\s*:?\s*([1-9]\d{0,9})$/i);
    return match ? match[1] : null;
  };

  const aliasRecordValues = (record) => {
    const values = [record?.["Gene Official Symbol"], record?.["Gene Systematic Name"]];
    values.push(...clean(record?.["Gene Synonyms"]).split("|").map(clean).filter(Boolean));
    return unique(values.map(clean).filter(Boolean));
  };

  const resolveGeneAlias = (aliases, query, organism = "") => {
    const key = normalizeKey(query);
    const selectedOrganism = clean(organism);
    const matches = [];
    const candidateValues = [clean(query)];
    if (!aliases || !key) {
      return { query: clean(query), key, matches, candidateValues: unique(candidateValues) };
    }

    const organisms = selectedOrganism ? [selectedOrganism] : Object.keys(aliases);
    organisms.forEach((org) => {
      const records = aliases?.[org]?.[key];
      if (!Array.isArray(records)) return;
      records.forEach((record) => {
        const values = aliasRecordValues(record);
        candidateValues.push(...values);
        matches.push({
          organism: org,
          officialSymbol: clean(record?.["Gene Official Symbol"]),
          systematicName: clean(record?.["Gene Systematic Name"]),
          synonyms: clean(record?.["Gene Synonyms"]),
          record
        });
      });
    });

    return {
      query: clean(query),
      key,
      matches,
      candidateValues: unique(candidateValues.map(clean).filter(Boolean))
    };
  };

  const addGeneIndexHits = (core, rowIds, candidateValues, organism = "") => {
    const selectedOrganism = clean(organism);
    unique(candidateValues || []).forEach((value) => {
      const key = normalizeKey(value);
      if (!key) return;
      if (selectedOrganism) {
        const organismIndex = core?.indexes?.Gene_by_organism?.[selectedOrganism];
        if (organismIndex && Array.isArray(organismIndex[key])) {
          rowIds.push(...organismIndex[key]);
          return;
        }
      }
      rowIds.push(...indexHits(core, "Gene", key));
    });
  };

  const sourceRowsForPubMed = (source, pubmedId) => {
    if (!source || !pubmedId) return [];
    return uniqueNumbers([
      ...indexHits(source, "Publication Source", `PUBMED:${pubmedId}`),
      ...indexHits(source, "Publication Source", `PMID:${pubmedId}`),
      ...indexHits(source, "Publication Source", pubmedId)
    ]);
  };

  const coreRowsForPubMed = (core, source, pubmedId) => {
    const rowIds = [
      ...indexHits(core, "PubMed_ID", pubmedId),
      ...indexHits(core, "PubMed_ID", `PUBMED:${pubmedId}`),
      ...indexHits(core, "PubMed_ID", `PMID:${pubmedId}`)
    ];
    rowsToRecords(source, sourceRowsForPubMed(source, pubmedId)).forEach((sourceRecord) => {
      const sourceId = sourceBioGridId(sourceRecord);
      if (sourceId) rowIds.push(...indexHits(core, "Source_ID", sourceId));
    });
    return uniqueNumbers(rowIds);
  };

  const recordMatchesFilters = (record, core, filters = {}) => {
    const map = getCoreFieldMap(core);
    const organism = clean(filters.organism);
    const experimentalSystem = clean(filters.experimentalSystem);
    const order = clean(filters.order);
    if (organism && clean(recordField(record, map.organism, ["Organism"])) !== organism) return false;
    if (
      experimentalSystem &&
      clean(recordField(record, map.experimental_system, ["Experimental System"])) !== experimentalSystem
    ) return false;
    if (order && getInteractionOrder(record, core) !== order) return false;
    return true;
  };

  const recordContainsText = (record, core, normalizedQuery) => {
    if (!normalizedQuery) return true;
    const map = getCoreFieldMap(core);
    const searchable = [
      recordField(record, map.tdb_id, ["TripleDB_ID"]),
      recordField(record, map.source_id, ["Source_ID"]),
      recordField(record, map.organism, ["Organism"]),
      recordField(record, map.experimental_system, ["Experimental System"]),
      recordField(record, map.qualifications, ["Qualifications"]),
      ...getCoreGenes(record, core)
    ];
    return searchable.some((value) => normalizeKey(value).includes(normalizedQuery));
  };

  const collectCoreRowIds = async (core, aliases, source, query, filters = {}) => {
    const parsed = parseQuery(query);
    const rowIds = [];
    const interpretation = [];
    let aliasResolution = { query: parsed.raw, key: parsed.normalized, matches: [], candidateValues: [] };

    if (!parsed.raw) {
      rowIds.push(...allRowIds(core));
      interpretation.push("all curated records");
    } else {
      if (parsed.tdbId) {
        rowIds.push(...indexHitsCaseInsensitive(core, "TripleDB_ID", parsed.tdbId));
        rowIds.push(...indexHitsCaseInsensitive(core, "TripleDB_ID", parsed.raw));
        interpretation.push("TDB accession");
      }

      const explicitSourceId = parsed.biogridId;
      if (explicitSourceId) {
        rowIds.push(...indexHits(core, "Source_ID", explicitSourceId));
        interpretation.push("BioGRID / Source ID");
      }

      if (parsed.pubmedId) {
        rowIds.push(...coreRowsForPubMed(core, source, parsed.pubmedId));
        interpretation.push("PubMed ID");
      }

      if (parsed.numeric) {
        rowIds.push(...indexHits(core, "Source_ID", parsed.numeric));
        rowIds.push(...coreRowsForPubMed(core, source, parsed.numeric));
        interpretation.push("numeric Source ID or PubMed ID");
      }

      rowIds.push(...indexHitsCaseInsensitive(core, "Experimental_System", parsed.raw));
      rowIds.push(...indexHitsCaseInsensitive(core, "Organism", parsed.raw));

      if (!parsed.isIdentifier) {
        aliasResolution = resolveGeneAlias(aliases, parsed.raw, filters.organism);
        addGeneIndexHits(core, rowIds, aliasResolution.candidateValues, filters.organism);
        interpretation.push(aliasResolution.matches.length ? "gene alias" : "gene or indexed text");
      }

      // A small database can safely use a text fallback when exact indexes do
      // not return anything. This catches qualification phrases and partial
      // gene names without changing the underlying JSON schema.
      if (
        rowIds.length === 0 &&
        searchConfig.partialTextFallback !== false &&
        !parsed.isIdentifier &&
        parsed.normalized.length >= 2
      ) {
        core.records.forEach((record, rowId) => {
          if (recordContainsText(record, core, parsed.normalized)) rowIds.push(rowId);
        });
        interpretation.push("case-insensitive text fallback");
      }
    }

    return {
      rowIds: uniqueNumbers(rowIds),
      parsed,
      aliasResolution,
      interpretation: unique(interpretation)
    };
  };

  const safePageSize = (value) => {
    const defaultSize = asNumber(searchConfig.defaultPageSize, 50);
    const maximum = asNumber(searchConfig.maximumPageSize, 500);
    const parsed = Math.floor(asNumber(value, defaultSize));
    return Math.max(1, Math.min(parsed, maximum));
  };

  const paginate = (records, options = {}) => {
    const pageSize = safePageSize(options.pageSize || options.limit);
    const total = records.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const requestedPage = Math.floor(asNumber(options.page, 1));
    const page = Math.max(1, Math.min(requestedPage || 1, totalPages));
    const startIndex = (page - 1) * pageSize;
    const pageRecords = records.slice(startIndex, startIndex + pageSize);
    return {
      total,
      totalPages,
      page,
      pageSize,
      start: total ? startIndex + 1 : 0,
      end: total ? startIndex + pageRecords.length : 0,
      shown: pageRecords.length,
      records: pageRecords
    };
  };

  const searchInteractions = async (query, filters = {}) => {
    const core = await loadCore();
    const parsed = parseQuery(query);
    const needAliases = Boolean(parsed.raw && !parsed.isIdentifier);
    const needSource = Boolean(parsed.pubmedId || parsed.numeric);
    const [aliases, source] = await Promise.all([
      needAliases ? loadAliases({ optional: true }) : Promise.resolve(null),
      needSource ? loadSource().catch(() => null) : Promise.resolve(null)
    ]);
    const collected = await collectCoreRowIds(core, aliases, source, query, filters);
    const matched = rowsToRecords(core, collected.rowIds).filter((record) =>
      recordMatchesFilters(record, core, filters)
    );
    const page = paginate(matched, filters);
    return {
      ...page,
      query: clean(query),
      filters,
      records: page.records,
      coreMeta: core._meta || {},
      fieldMap: getCoreFieldMap(core),
      interpretation: collected.interpretation,
      aliasMatches: collected.aliasResolution.matches,
      aliasCandidates: collected.aliasResolution.candidateValues,
      dataWarnings: aliases ? [] : ["Gene alias JSON was unavailable; direct core-gene matching was used."]
    };
  };

  const sourceRowsFromCoreRows = (core, source, coreRowIds) => {
    const sourceRowIds = [];
    rowsToRecords(core, coreRowIds).forEach((record) => {
      getSourceIds(record, core).forEach((sourceId) => {
        sourceRowIds.push(...indexHits(source, "BioGRID ID", sourceId));
      });
    });
    return uniqueNumbers(sourceRowIds);
  };

  const linkedTdbIdsForSourceRecord = (sourceRecord, core) => {
    // Provenance links are exact Source_ID/BioGRID-ID links. Publication-level
    // search is supported separately, but a shared PMID alone is not treated
    // as proof that one source row belongs to every curated record in a paper.
    const rowIds = [];
    const sourceId = sourceBioGridId(sourceRecord);
    if (sourceId) rowIds.push(...indexHits(core, "Source_ID", sourceId));
    const map = getCoreFieldMap(core);
    return unique(
      rowsToRecords(core, rowIds)
        .map((record) => clean(recordField(record, map.tdb_id, ["TripleDB_ID"])))
        .filter(Boolean)
    );
  };

  const sourceRecordMatchesFilters = (record, filters = {}) => {
    const organism = clean(filters.organism);
    return !organism || clean(record?.Organism) === organism;
  };

  const sourceRecordContainsText = (record, normalizedQuery) => {
    if (!normalizedQuery) return true;
    return [
      record?.["BioGRID ID"],
      record?.Author,
      record?.["Publication Source"],
      record?.Qualifications,
      record?.Organism,
      record?.["Experimental System Type"]
    ].some((value) => normalizeKey(value).includes(normalizedQuery));
  };

  const searchEvidence = async (query, filters = {}) => {
    const parsed = parseQuery(query);
    const [source, core, aliases] = await Promise.all([
      loadSource(),
      loadCore().catch(() => null),
      parsed.raw && !parsed.isIdentifier ? loadAliases({ optional: true }) : Promise.resolve(null)
    ]);
    const sourceRowIds = [];
    const interpretation = [];

    if (!parsed.raw) {
      sourceRowIds.push(...allRowIds(source));
      interpretation.push("all source records");
    } else {
      if (parsed.biogridId) {
        sourceRowIds.push(...indexHits(source, "BioGRID ID", parsed.biogridId));
        interpretation.push("BioGRID ID");
      }
      if (parsed.pubmedId) {
        sourceRowIds.push(...sourceRowsForPubMed(source, parsed.pubmedId));
        interpretation.push("PubMed ID");
      }
      if (parsed.numeric) {
        sourceRowIds.push(...indexHits(source, "BioGRID ID", parsed.numeric));
        sourceRowIds.push(...sourceRowsForPubMed(source, parsed.numeric));
        interpretation.push("numeric BioGRID or PubMed ID");
      }
      if (parsed.tdbId && core) {
        const coreRows = indexHitsCaseInsensitive(core, "TripleDB_ID", parsed.tdbId);
        sourceRowIds.push(...sourceRowsFromCoreRows(core, source, coreRows));
        interpretation.push("TDB accession provenance");
      }

      if (!parsed.isIdentifier && core) {
        const collected = await collectCoreRowIds(core, aliases, source, parsed.raw, filters);
        sourceRowIds.push(...sourceRowsFromCoreRows(core, source, collected.rowIds));
        if (collected.rowIds.length) interpretation.push("gene / curated-record provenance");
      }

      sourceRowIds.push(...indexHitsCaseInsensitive(source, "BioGRID ID", parsed.raw));
      sourceRowIds.push(...indexHitsCaseInsensitive(source, "Publication Source", parsed.raw));

      if (
        sourceRowIds.length === 0 &&
        searchConfig.partialTextFallback !== false &&
        !parsed.isIdentifier &&
        parsed.normalized.length >= 2
      ) {
        source.records.forEach((record, rowId) => {
          if (sourceRecordContainsText(record, parsed.normalized)) sourceRowIds.push(rowId);
        });
        interpretation.push("case-insensitive source-text fallback");
      }
    }

    const matched = rowsToRecords(source, uniqueNumbers(sourceRowIds))
      .filter((record) => sourceRecordMatchesFilters(record, filters))
      .map((record) => ({
        ...record,
        _linkedTdbIds: core ? linkedTdbIdsForSourceRecord(record, core) : []
      }));
    const page = paginate(matched, filters);
    return {
      ...page,
      query: parsed.raw,
      filters,
      records: page.records,
      sourceMeta: source._meta || {},
      interpretation: unique(interpretation),
      dataWarnings: core ? [] : ["Core JSON was unavailable, so linked TDB accessions could not be displayed."]
    };
  };

  const getRecord = async (tdbId) => {
    const core = await loadCore();
    const rowIds = indexHitsCaseInsensitive(core, "TripleDB_ID", clean(tdbId));
    const record = rowsToRecords(core, rowIds)[0] || null;
    return record ? { record, core, fieldMap: getCoreFieldMap(core), rowId: Number(rowIds[0]) } : null;
  };

  const getRecordContext = async (tdbId) => {
    const hit = await getRecord(tdbId);
    if (!hit) return null;
    const source = await loadSource().catch(() => null);
    const sourceRecords = [];
    if (source) {
      getSourceIds(hit.record, hit.core).forEach((sourceId) => {
        sourceRecords.push(...rowsToRecords(source, indexHits(source, "BioGRID ID", sourceId)));
      });
    }
    const records = hit.core.records || [];
    const previous = hit.rowId > 0 ? records[hit.rowId - 1] : null;
    const next = hit.rowId < records.length - 1 ? records[hit.rowId + 1] : null;
    return {
      ...hit,
      sourceRecords: Array.from(
        new Map(sourceRecords.map((item) => [sourceBioGridId(item) || JSON.stringify(item), item])).values()
      ),
      sourceAvailable: Boolean(source),
      previous,
      next
    };
  };

  const getLinkedCoreRecordsForSourceRecord = async (sourceRecord) => {
    const core = await loadCore();
    const rowIds = [];
    const sourceId = sourceBioGridId(sourceRecord);
    if (sourceId) rowIds.push(...indexHits(core, "Source_ID", sourceId));
    return rowsToRecords(core, rowIds);
  };

  const getFilterOptions = async () => {
    const core = await loadCore();
    const distributions = core?._meta?.distributions || {};
    const valuesFromDistribution = (name) =>
      Array.isArray(distributions[name])
        ? distributions[name].map((item) => clean(item?.value)).filter(Boolean)
        : [];
    const valuesFromIndex = (name) => Object.keys(core?.indexes?.[name] || {}).filter(Boolean);
    return {
      organisms: unique(valuesFromDistribution("Organism").concat(valuesFromIndex("Organism"))),
      experimentalSystems: unique(
        valuesFromDistribution("Experimental_System").concat(valuesFromIndex("Experimental_System"))
      ),
      interactionOrders: unique(
        valuesFromDistribution("Interaction_Order").concat(valuesFromIndex("Interaction_Order"))
      ),
      coreMeta: core._meta || {}
    };
  };

  const getGeneIndex = async (options = {}) => {
    const core = await loadCore();
    const map = getCoreFieldMap(core);
    const organism = clean(options.organism);
    const letter = clean(options.letter).toUpperCase();
    const query = normalizeKey(options.query);
    const counts = new Map();
    const display = new Map();

    core.records.forEach((record) => {
      if (organism && clean(recordField(record, map.organism, ["Organism"])) !== organism) return;
      const seenThisRecord = new Set();
      getCoreGenes(record, core).forEach((gene) => {
        const key = normalizeKey(gene);
        if (!key || seenThisRecord.has(key)) return;
        seenThisRecord.add(key);
        counts.set(key, (counts.get(key) || 0) + 1);
        if (!display.has(key)) display.set(key, clean(gene));
      });
    });

    let genes = Array.from(counts.keys()).map((key) => ({
      key,
      gene: display.get(key) || key,
      count: counts.get(key) || 0
    }));

    if (letter) {
      if (letter === "#") genes = genes.filter((item) => !/^[A-Z]/i.test(item.gene));
      else genes = genes.filter((item) => item.gene.toUpperCase().startsWith(letter));
    }
    if (query) genes = genes.filter((item) => normalizeKey(item.gene).includes(query));

    genes.sort((a, b) => a.gene.localeCompare(b.gene, undefined, { numeric: true, sensitivity: "base" }));
    const total = genes.length;
    const limit = Math.max(1, Math.min(asNumber(options.limit, 250), 1000));
    return { total, genes: genes.slice(0, limit), truncated: total > limit, organism, letter };
  };

  const cloneDistribution = (items) => {
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => ({ value: clean(item?.value), count: asNumber(item?.count) }))
      .filter((item) => item.value && item.count >= 0);
  };

  const getDistribution = (meta, key, fallbackItems) => {
    const items = meta?.distributions?.[key];
    return cloneDistribution(Array.isArray(items) ? items : fallbackItems);
  };

  const countFor = (items, value, defaultValue = 0) => {
    const hit = items.find((item) => item.value === value);
    return hit ? asNumber(hit.count) : asNumber(defaultValue);
  };

  const getStatistics = async () => {
    const [coreResult, sourceResult] = await Promise.all([
      loadOptional("core", paths.core),
      loadOptional("source", paths.source)
    ]);
    const coreMeta = coreResult.data?._meta || {};
    const sourceMeta = sourceResult.data?._meta || {};
    const interactionOrderDistribution = getDistribution(
      coreMeta,
      "Interaction_Order",
      fallback.interactionOrderDistribution
    );
    const organismDistribution = getDistribution(coreMeta, "Organism", fallback.organismDistribution);
    const experimentalSystemDistribution = getDistribution(
      coreMeta,
      "Experimental_System",
      fallback.experimentalSystemDistribution
    );
    const sourceIdIndex = sourceMeta?.index_stats?.["BioGRID ID"] || {};
    const uniquePubMedIds = collectUniquePubMedIds(coreResult.data, sourceResult.data);
    const curatedRecords = asNumber(coreMeta.total_records, fallback.curatedRecords);
    const manualCurationRecords = countManualCurationRecords(coreResult.data);
    const biogridLinkedCoreRecords = Math.max(0, curatedRecords - manualCurationRecords);

    return {
      curatedRecords,
      sourceEvidenceRecords: asNumber(sourceMeta.total_records, fallback.sourceEvidenceRecords),
      manualCurationRecords,
      biogridLinkedCoreRecords,
      organisms: organismDistribution.length || asNumber(fallback.organisms),
      experimentalSystems: experimentalSystemDistribution.length || asNumber(fallback.experimentalSystems),
      publications: uniquePubMedIds.length || asNumber(fallback.publications),
      uniquePubMedIds,
      sourceBiogridIds: asNumber(sourceIdIndex.indexed_values, fallback.sourceBiogridIds),
      tripleRecords: countFor(interactionOrderDistribution, "triple", fallback.tripleRecords),
      quadrupleOrHigherRecords: countFor(
        interactionOrderDistribution,
        "quadruple_or_higher",
        fallback.quadrupleOrHigherRecords
      ),
      pairContextRecords: countFor(interactionOrderDistribution, "pair_or_lower", fallback.pairContextRecords),
      interactionOrderDistribution,
      organismDistribution,
      experimentalSystemDistribution,
      liveCoreLoaded: coreResult.ok,
      liveSourceLoaded: sourceResult.ok,
      liveAliasLoaded: null,
      liveDataLoaded: coreResult.ok && sourceResult.ok,
      errors: [coreResult, sourceResult]
        .filter((result) => !result.ok)
        .map((result) => `${result.label}: ${result.error}`)
    };
  };

  const getDataStatus = async () => {
    const results = await Promise.all([
      loadOptional("core", paths.core),
      loadOptional("aliases", paths.aliases),
      loadOptional("source", paths.source)
    ]);
    return {
      ready: results.every((result) => result.ok),
      files: results.map((result) => ({
        label: result.label,
        ok: result.ok,
        error: result.error,
        totalRecords: result.data?._meta?.total_records ?? null
      }))
    };
  };

  window.TripleDBData = {
    connected: true,
    statisticsConnected: true,
    clean,
    normalizeKey,
    parseQuery,
    recordField,
    getCoreFieldMap,
    getCoreGenes,
    getSourceIds,
    getCorePubMedIds,
    extractPubMedIdsFromText,
    collectUniquePubMedIds,
    getInteractionOrder,
    getEstimatedGeneCount,
    sourcePublication,
    sourceBioGridId,
    sourcePubMedNumber,
    resolveGeneAlias,
    searchInteractions,
    searchEvidence,
    getRecord,
    getRecordContext,
    getLinkedCoreRecordsForSourceRecord,
    getFilterOptions,
    getGeneIndex,
    getStatistics,
    getDataStatus,
    clearCache() {
      cache.clear();
    },
    async getReleases() {
      return [];
    }
  };
})();
