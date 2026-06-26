#!/usr/bin/env python3
"""Validate the six fixed TripleDB deployment files."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent

CORE_JSON = ROOT / "data" / "tdb_core_interaction_index.json"
ALIAS_JSON = ROOT / "data" / "gene_alias_search_index_by_organism.json"
SOURCE_JSON = ROOT / "data" / "biogrid_source_index.json"

CSV_FILES = {
    "Core interaction CSV": ROOT / "downloads" / "tdb_core_interaction_table.csv",
    "Gene alias CSV": ROOT / "downloads" / "gene_alias_table.csv",
    "BioGRID source CSV": ROOT / "downloads" / "biogrid_source_table.csv",
}


def human_size(size: int) -> str:
    value = float(size)
    for unit in ("B", "KB", "MB", "GB"):
        if value < 1024 or unit == "GB":
            return f"{value:.1f} {unit}"
        value /= 1024
    return f"{size} B"


def load_json(label: str, path: Path) -> tuple[bool, Any | None]:
    if not path.is_file():
        print(f"[MISSING] {label}: {path.relative_to(ROOT)}")
        return False, None
    try:
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
    except Exception as exc:
        print(f"[INVALID] {label}: {exc}")
        return False, None
    print(f"[FOUND] {label}: {human_size(path.stat().st_size)}")
    return True, data


def validate_core(data: Any) -> bool:
    label = "Core interaction JSON schema"
    if not isinstance(data, dict):
        print(f"[INVALID] {label}: top level is not an object")
        return False
    records = data.get("records")
    indexes = data.get("indexes")
    if not isinstance(records, list) or not isinstance(indexes, dict):
        print(f"[INVALID] {label}: records[] or indexes{{}} is missing")
        return False

    required = {
        "TripleDB_ID",
        "Source_ID",
        "Organism",
        "Experimental_System",
        "Gene",
        "Interaction_Order",
    }
    missing = sorted(required.difference(indexes))
    if missing:
        print(f"[INVALID] {label}: missing indexes: {', '.join(missing)}")
        return False

    meta_total = data.get("_meta", {}).get("total_records")
    if meta_total is not None and int(meta_total) != len(records):
        print(
            f"[WARNING] {label}: _meta.total_records={meta_total}, "
            f"but records contains {len(records)} entries"
        )
    print(
        f"[OK] {label}: {len(records)} records, "
        f"{len(indexes.get('TripleDB_ID', {}))} TDB accessions"
    )
    return True


def validate_aliases(data: Any) -> bool:
    label = "Gene alias JSON schema"
    if not isinstance(data, dict) or not data:
        print(f"[INVALID] {label}: expected a non-empty organism-keyed object")
        return False
    invalid_orgs = [
        organism for organism, index in data.items() if not isinstance(organism, str) or not isinstance(index, dict)
    ]
    if invalid_orgs:
        print(f"[INVALID] {label}: invalid organism entries: {invalid_orgs[:5]}")
        return False
    alias_keys = sum(len(index) for index in data.values())
    print(f"[OK] {label}: {len(data)} organisms, {alias_keys} searchable alias keys")
    return True


def validate_source(data: Any) -> bool:
    label = "BioGRID source JSON schema"
    if not isinstance(data, dict):
        print(f"[INVALID] {label}: top level is not an object")
        return False
    records = data.get("records")
    indexes = data.get("indexes")
    if not isinstance(records, list) or not isinstance(indexes, dict):
        print(f"[INVALID] {label}: records[] or indexes{{}} is missing")
        return False
    missing = [name for name in ("BioGRID ID", "Publication Source") if name not in indexes]
    if missing:
        print(f"[INVALID] {label}: missing indexes: {', '.join(missing)}")
        return False
    print(
        f"[OK] {label}: {len(records)} source records, "
        f"{len(indexes['BioGRID ID'])} BioGRID IDs, "
        f"{len(indexes['Publication Source'])} publication values"
    )
    return True


def check_csv(label: str, path: Path) -> bool:
    if not path.is_file():
        print(f"[MISSING] {label}: {path.relative_to(ROOT)}")
        return False
    if path.stat().st_size == 0:
        print(f"[INVALID] {label}: file is empty")
        return False
    print(f"[OK] {label}: {human_size(path.stat().st_size)}")
    return True


def main() -> int:
    print("TripleDB fixed-file verification")
    print("=" * 56)

    core_found, core = load_json("Core interaction JSON", CORE_JSON)
    alias_found, aliases = load_json("Gene alias JSON", ALIAS_JSON)
    source_found, source = load_json("BioGRID source JSON", SOURCE_JSON)

    results = [core_found, alias_found, source_found]
    if core_found:
        results.append(validate_core(core))
    if alias_found:
        results.append(validate_aliases(aliases))
    if source_found:
        results.append(validate_source(source))

    for label, path in CSV_FILES.items():
        results.append(check_csv(label, path))

    print("=" * 56)
    if all(results):
        print("All six deployment files are present and compatible with the website.")
        print("Start the local server and test TDB00001, a Source_ID, a PMID and a gene alias.")
        return 0

    print("One or more checks failed. See README.md for exact paths and filenames.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
