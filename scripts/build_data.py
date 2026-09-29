"""PokeAPI CSV -> 페이지용 경량 JSON 변환기.

PokeAPI의 REST API는 호출하지 않는다. GitHub에 올라온 CSV 원본을 고정 커밋 기준으로
한 번만 내려받아(scripts/.cache) 필요한 필드만 뽑아 public/data/ 에 쓴다.
출력 형식은 shared/data.ts 의 타입 정의와 맞춘다.

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
    "pokemon_forms.csv",
    "pokemon_form_names.csv",
    "pokemon_types.csv",
    "pokemon_types_past.csv",
    "pokemon_abilities.csv",
    "pokemon_abilities_past.csv",
    "pokemon_stats.csv",
    "types.csv",
    "type_names.csv",
    "abilities.csv",
    "ability_names.csv",
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


def names_by(rows: list[dict], key: str, col: str = "name") -> dict[str, dict[str, str]]:
    """{id: {"ko": .., "en": ..}}"""
    out: dict[str, dict[str, str]] = defaultdict(dict)
    for r in rows:
        if r["local_language_id"] == LANG_KO and r[col]:
            out[r[key]]["ko"] = r[col]
        elif r["local_language_id"] == LANG_EN and r[col]:
            out[r[key]]["en"] = r[col]
    return out


def ko_en(n: dict, fallback: str) -> list[str]:
    en = n.get("en", fallback)
    return [n.get("ko", en), en]


def num(v: str):
    return int(v) if v else None


def write(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main() -> None:
    commit = latest_commit() if "--latest" in sys.argv else POKEAPI_COMMIT
    t = {name: read_csv(commit, name) for name in FILES}

    # ── 타입: id -> [한글, 영문]  (1~18 실제 타입만)
    tnames = names_by(t["type_names.csv"], "type_id")
    types = {int(r["id"]): ko_en(tnames[r["id"]], r["identifier"])
             for r in t["types.csv"] if int(r["id"]) <= 18}

    # ── 특성: id -> [한글, 영문, 등장세대]  (본가 특성만)
    anames = names_by(t["ability_names.csv"], "ability_id")
    abilities = {int(r["id"]): ko_en(anames[r["id"]], r["identifier"]) + [int(r["generation_id"])]
                 for r in t["abilities.csv"] if r["is_main_series"] == "1"}

    # ── 기술: id -> [한글, 영문, 타입, 세대, 위력, PP, 명중, 우선도, 분류(1변화 2물리 3특수)]
    mnames = names_by(t["move_names.csv"], "move_id")
    moves = {}
    for r in t["moves.csv"]:
        moves[int(r["id"])] = ko_en(mnames[r["id"]], r["identifier"]) + [
            int(r["type_id"] or 0), int(r["generation_id"]), num(r["power"]), num(r["pp"]),
            num(r["accuracy"]), int(r["priority"] or 0), int(r["damage_class_id"] or 0)]

    # ── 포켓몬
    species = names_by(t["pokemon_species_names.csv"], "pokemon_species_id")
    form_names = names_by(t["pokemon_form_names.csv"], "pokemon_form_id", "form_name")
    default_form = {r["pokemon_id"]: r["id"] for r in t["pokemon_forms.csv"] if r["is_default"] == "1"}

    ptypes = defaultdict(dict)
    for r in t["pokemon_types.csv"]:
        ptypes[r["pokemon_id"]][int(r["slot"])] = int(r["type_id"])
    ptypes_past = defaultdict(lambda: defaultdict(dict))  # pid -> gen -> slot -> type
    for r in t["pokemon_types_past.csv"]:
        ptypes_past[r["pokemon_id"]][int(r["generation_id"])][int(r["slot"])] = int(r["type_id"])

    pabil = defaultdict(dict)
    for r in t["pokemon_abilities.csv"]:
        pabil[r["pokemon_id"]][int(r["slot"])] = int(r["ability_id"])
    pabil_past = defaultdict(list)
    for r in t["pokemon_abilities_past.csv"]:
        pabil_past[r["pokemon_id"]].append([int(r["generation_id"]), int(r["slot"]), int(r["ability_id"] or 0)])

    pstats = defaultdict(lambda: [0] * 6)
    for r in t["pokemon_stats.csv"]:
        pstats[r["pokemon_id"]][int(r["stat_id"]) - 1] = int(r["base_stat"])

    pokemon = {}
    for r in t["pokemon.csv"]:
        pid = r["id"]
        n = species.get(r["species_id"], {})
        name = ko_en(n, r["identifier"])
        if int(pid) > 10000:
            fn = form_names.get(default_form.get(pid, ""), {})
            suffix = ko_en(fn, r["identifier"].split("-", 1)[-1])
            # "메가리자몽X"처럼 폼 이름에 종 이름이 이미 들어 있으면 폼 이름만 쓴다
            name = [s if base in s else f"{base} ({s})" for base, s in zip(name, suffix)]
        entry = {
            "n": name,
            "i": r["identifier"],
            "s": int(r["species_id"]),
            "t": [ptypes[pid][k] for k in sorted(ptypes[pid])],
            "a": [pabil[pid].get(1, 0), pabil[pid].get(2, 0), pabil[pid].get(3, 0)],
            "st": pstats[pid],
        }
        if pid in ptypes_past:
            entry["pt"] = [[g] + [slots[k] for k in sorted(slots)] for g, slots in sorted(ptypes_past[pid].items())]
        if pid in pabil_past:
            entry["pa"] = sorted(pabil_past[pid])
        if r["is_default"] != "1":
            entry["f"] = 1
        pokemon[int(pid)] = entry

    # ── 버전 그룹: [{id, gen, identifier, ko, en, hasLearnset}]
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

    # ── 버전 그룹별 기술 습득표: {pokemonId: [[moveId, methodId, level], ...]}
    #    (방법, 레벨, 게임 내 순서)로 정렬 → 레벨업 기술은 배우는 순서 그대로
    learn: dict[str, dict[int, list]] = defaultdict(lambda: defaultdict(list))
    for r in t["pokemon_moves.csv"]:
        learn[r["version_group_id"]][int(r["pokemon_id"])].append(
            (int(r["pokemon_move_method_id"]), int(r["level"] or 0), int(r["order"] or 0), int(r["move_id"])))

    for g in groups:
        # PokeAPI에 버전은 등록됐지만 습득표가 아직 없는 경우(신작·DLC)를 표시
        g["hasLearnset"] = str(g["id"]) in learn

    write(OUT / "types.json", types)
    write(OUT / "abilities.json", abilities)
    write(OUT / "moves.json", moves)
    write(OUT / "pokemon.json", pokemon)
    write(OUT / "version-groups.json", groups)
    for vg, table in learn.items():
        out = {}
        for p, rows in sorted(table.items()):
            seen, lst = set(), []
            for method, level, _, move in sorted(rows):
                if (move, method, level) not in seen:
                    seen.add((move, method, level))
                    lst.append([move, method, level])
            out[p] = lst
        write(OUT / "learnsets" / f"{vg}.json", out)
    write(OUT / "meta.json", {"pokeapiCommit": commit})

    total = sum(f.stat().st_size for f in OUT.rglob("*.json"))
    print(f"done: commit {commit[:10]}, {len(learn)} version groups, {total / 1e6:.1f} MB total")


if __name__ == "__main__":
    main()
