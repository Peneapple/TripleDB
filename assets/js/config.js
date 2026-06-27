/*
  Central settings for the static TripleDB website.

  Keep the deployment filenames below stable. When a new data release is
  prepared, replace the six files in data/ and downloads/ without changing
  these paths or the website code.
*/
window.TRIPLEDB_CONFIG = {
  siteName: "TripleDB",
  fullName: "TripleDB: curated higher-order genetic interactions",
  releaseLabel: "TripleDB v1.0.0",
  updatePolicy: "Stable releases are archived through GitHub and Zenodo; data updates are planned at least annually.",
  contactEmail: "peter_geng@stu.pku.edu.cn",
  repositoryUrl: "https://github.com/Peneapple/TripleDB",
  citationText: "Peter X. Geng and Huaiqiu Zhu. TripleDB: a curated database of triple-gene and higher-order genetic interactions. Version 1.0.0. Zenodo. https://doi.org/10.5281/zenodo.20931612.",
  zenodoDoi: "10.5281/zenodo.20931612",
  zenodoUrl: "https://doi.org/10.5281/zenodo.20931612",
  websiteUrl: "https://tripledb.org",
  version: "1.0.0",
  releaseDate: "2026-06-26",
  cloudflareAnalyticsToken: "64b5792f46ff480fb93912ef05f1676e",
  firstAuthorEmail: "peter_geng@stu.pku.edu.cn",
  correspondingAuthorEmail: "hqzhu@pku.edu.cn",

  dataConnected: true,
  statisticsConnected: true,

  dataFiles: {
    core: "data/tdb_core_interaction_index.json",
    aliases: "data/gene_alias_search_index_by_organism.json",
    source: "data/biogrid_source_index.json"
  },

  downloadFiles: {
    core: "downloads/tdb_core_interaction_table.csv",
    aliases: "downloads/gene_alias_table.csv",
    source: "downloads/biogrid_source_table.csv"
  },

  search: {
    defaultPageSize: 50,
    pageSizeOptions: [25, 50, 100, 250],
    maximumPageSize: 500,
    partialTextFallback: true
  },

  // Displayed only when one or more JSON files are absent. When the website
  // is served through the included local server or GitHub Pages, current
  // values are read from the JSON _meta sections.
  fallbackStatistics: {
    curatedRecords: 5450,
    sourceEvidenceRecords: 10202,
    manualCurationRecords: 0,
    biogridLinkedCoreRecords: 5450,
    organisms: 8,
    experimentalSystems: 15,
    publications: 706,
    sourceBiogridIds: 10202,
    tripleRecords: 5091,
    quadrupleOrHigherRecords: 338,
    pairContextRecords: 21,

    interactionOrderDistribution: [
      { value: "triple", count: 5091 },
      { value: "quadruple_or_higher", count: 338 },
      { value: "pair_or_lower", count: 21 }
    ],

    organismDistribution: [
      { value: "Saccharomyces cerevisiae (S288c)", count: 5332 },
      { value: "Schizosaccharomyces pombe (972h)", count: 92 },
      { value: "Homo sapiens", count: 15 },
      { value: "Candida albicans (SC5314)", count: 4 },
      { value: "Mus musculus", count: 3 },
      { value: "Danio rerio", count: 2 },
      { value: "Arabidopsis thaliana (Columbia)", count: 1 },
      { value: "Drosophila melanogaster", count: 1 }
    ],

    experimentalSystemDistribution: [
      { value: "Negative Genetic", count: 3496 },
      { value: "Synthetic Rescue", count: 632 },
      { value: "Synthetic Growth Defect", count: 392 },
      { value: "Phenotypic Enhancement", count: 346 },
      { value: "Synthetic Lethality", count: 298 },
      { value: "Phenotypic Suppression", count: 114 },
      { value: "Dosage Rescue", count: 87 },
      { value: "Positive Genetic", count: 51 },
      { value: "Allele Rescue", count: 10 },
      { value: "Synthetic Sickness", count: 9 },
      { value: "Severe Synthetic Sickness", count: 5 },
      { value: "Dosage Growth Defect", count: 4 },
      { value: "Tested Viable", count: 3 },
      { value: "Dosage Lethality", count: 2 },
      { value: "Synthetic Haploinsufficiency", count: 1 }
    ]
  }
};
