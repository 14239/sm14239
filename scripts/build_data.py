"""PokeAPI CSV -> 페이지용 경량 JSON 변환기.

PokeAPI의 REST API는 호출하지 않는다. GitHub에 올라온 CSV 원본을 고정 커밋 기준으로
한 번만 내려받아(scripts/.cache) 필요한 필드만 뽑아 public/data/ 에 쓴다.

사용법:
    python scripts/build_data.py            # POKEAPI_COMMIT 기준으로 생성
    python scripts/build_data.py --latest   # 최신 master 커밋으로 갱신 (커밋 해시 출력)
"""

import csv
import io
import json
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

POKEAPI_COMMIT = "168b1e89467054cda2e7df43ccebbb69b459497a"  # 2026-09-26

LANG_KO = "3"
LANG_EN = "9"

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts" / ".cache"
OUT = ROOT / "public" / "data"

FILES = [
    "pokemon.csv",
    "pokemon_species_names.csv",
    "moves.csv",
    "move_names.csv",
    "pokemon_moves.csv",
    "version_groups.csv",
    "versions.csv",
    "version_names.csv",
]


def latest_commit() -> str:
    with urllib.request.urlopen("https://api.github.com/repos/PokeAPI/pokeapi/commits/master") as r:
        return json.load(r)["sha"]


def read_csv(commit: str, name: str) -> list[dict]:
    path = CACHE / commit / name
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        url = f"https://raw.githubusercontent.com/PokeAPI/pokeapi/{commit}/data/v2/csv/{name}"
        print(f"download {name}")
        with urllib.request.urlopen(url) as r:
            path.write_bytes(r.read())
    return list(csv.DictReader(io.StringIO(path.read_text(encoding="utf-8"))))


def names_by(rows: list[dict], key: str) -> dict[str, dict[str, str]]:
    """{id: {"ko": .., "en": ..}}"""
    out: dict[str, dict[str, str]] = defaultdict(dict)
    for r in rows:
        if r["local_language_id"] == LANG_KO:
            out[r[key]]["ko"] = r["name"]
        elif r["local_language_id"] == LANG_EN:
            out[r[key]]["en"] = r["name"]
    return out


def write(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main() -> None:
    commit = latest_commit() if "--latest" in sys.argv else POKEAPI_COMMIT
    t = {name: read_csv(commit, name) for name in FILES}

    # 포켓몬: id -> [한글명, 영문명, 도감번호]. 폼(id>10000)은 영문 identifier를 덧붙인다.
    species = names_by(t["pokemon_species_names.csv"], "pokemon_species_id")
    pokemon = {}
    for r in t["pokemon.csv"]:
        n = species.get(r["species_id"], {})
        ko, en = n.get("ko", n.get("en", r["identifier"])), n.get("en", r["identifier"])
        if int(r["id"]) > 10000:
            form = r["identifier"].split("-", 1)[-1]
            ko, en = f"{ko} ({form})", f"{en} ({form})"
        pokemon[int(r["id"])] = [ko, en, int(r["species_id"])]

    # 기술: id -> [한글명, 영문명, 타입id, 등장세대]
    mnames = names_by(t["move_names.csv"], "move_id")
    moves = {}
    for r in t["moves.csv"]:
        n = mnames.get(r["id"], {})
        moves[int(r["id"])] = [n.get("ko", n.get("en", r["identifier"])), n.get("en", r["identifier"]),
                               int(r["type_id"] or 0), int(r["generation_id"])]

    # 버전 그룹: [{id, gen, identifier, ko, en}]
    vnames = names_by(t["version_names.csv"], "version_id")
    vg_versions = defaultdict(list)
    for r in t["versions.csv"]:
        vg_versions[r["version_group_id"]].append(vnames.get(r["id"], {}))
    groups = []
    for r in sorted(t["version_groups.csv"], key=lambda r: int(r["order"])):
        vs = vg_versions[r["id"]]
        groups.append({
            "id": int(r["id"]),
            "gen": int(r["generation_id"]),
            "identifier": r["identifier"],
            "ko": "·".join(v.get("ko", v.get("en", "?")) for v in vs),
            "en": " / ".join(v.get("en", "?") for v in vs),
        })

    # 버전 그룹별 기술 습득표: {pokemonId: [[moveId, methodId, level], ...]}
    learn: dict[str, dict[int, set]] = defaultdict(lambda: defaultdict(set))
    for r in t["pokemon_moves.csv"]:
        learn[r["version_group_id"]][int(r["pokemon_id"])].add(
            (int(r["move_id"]), int(r["pokemon_move_method_id"]), int(r["level"] or 0)))

    write(OUT / "pokemon.json", pokemon)
    write(OUT / "moves.json", moves)
    write(OUT / "version-groups.json", groups)
    for vg, table in learn.items():
        write(OUT / "learnsets" / f"{vg}.json", {p: sorted(m) for p, m in sorted(table.items())})
    write(OUT / "meta.json", {"pokeapiCommit": commit})

    total = sum(f.stat().st_size for f in OUT.rglob("*.json"))
    print(f"done: commit {commit[:10]}, {len(learn)} version groups, {total / 1e6:.1f} MB total")


if __name__ == "__main__":
    main()
