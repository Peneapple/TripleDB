# TripleDB v1.0.0

TripleDB is a curated, static, searchable database for triple-gene and higher-order genetic interactions. The website is designed for GitHub Pages deployment and uses browser-side JavaScript to read fixed JSON indexes.

- Website: https://tripledb.org
- Repository: https://github.com/Peneapple/TripleDB
- Version: 1.0.0
- Release date: 2026-06-26
- Zenodo DOI: https://doi.org/10.5281/zenodo.20931612
- Contact: Peter X. Geng <peter_geng@stu.pku.edu.cn>
- Correspondence: Huaiqiu Zhu <hqzhu@pku.edu.cn>

## Citation

Peter X. Geng and Huaiqiu Zhu. TripleDB: a curated database of triple-gene and higher-order genetic interactions. Version 1.0.0. Zenodo. https://doi.org/10.5281/zenodo.20931612.

For record-level citation, include the stable TDB accession, release version and access date, for example: `TripleDB record TDB00001, TripleDB v1.0.0, accessed YYYY-MM-DD`.

## Fixed data files

Place the release JSON files in `data/`:

```text
data/tdb_core_interaction_index.json
data/gene_alias_search_index_by_organism.json
data/biogrid_source_index.json
```

Place the release CSV files in `downloads/`:

```text
downloads/tdb_core_interaction_table.csv
downloads/gene_alias_table.csv
downloads/biogrid_source_table.csv
```

The website code expects these exact filenames. Future data releases can replace these files without changing HTML or JavaScript paths.

## Local testing

```bash
python3 verify_release_files.py
python3 -m http.server 8000
```

Open `http://localhost:8000` in a browser. Do not test search functionality by opening `index.html` with a `file://` URL because browsers usually block local JSON loading.

## License and source acknowledgement

TripleDB curated annotations and release files are distributed under the Creative Commons Attribution 4.0 International License. BioGRID-derived identifiers and source records are retained for provenance; users should also cite BioGRID and the original publications where applicable.
