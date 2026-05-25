"""
WorkNet 직업명 기준으로 Nemotron professional_persona 매핑 JSON 구축
- Nemotron occupation → WorkNet job_name 매칭
- 무직 제거
- WorkNet 직업당 professional_persona 최대 5건 수집
- 출력: data/job_persona_map.json
"""
from datasets import load_dataset
import json
from collections import defaultdict

SAMPLE_SIZE = 200_000   # 스트리밍 샘플 수
MAX_PER_JOB = 5         # 직업당 최대 페르소나 수
OUTPUT_PATH = "data/job_persona_map.json"

# ── 워크넷 직업 목록 로드 ──────────────────────────────────────
with open("data/job_list_raw.json") as f:
    worknet_jobs = json.load(f)
worknet_names = [j["job_name"].strip() for j in worknet_jobs]
worknet_set = set(worknet_names)
print(f"워크넷 직업 수: {len(worknet_names)}개")

# ── 매칭 함수 ──────────────────────────────────────────────────
def match_to_worknet(occ: str) -> str | None:
    """Nemotron occupation → 가장 근접한 WorkNet job_name 반환"""
    if not occ or occ == "무직":
        return None
    occ = occ.strip()
    # 1. 정확 일치
    if occ in worknet_set:
        return occ
    # 2. WorkNet 직업명이 occ에 포함됨 (WorkNet이 더 짧음)
    for wn in worknet_names:
        if wn in occ:
            return wn
    # 3. occ가 WorkNet 직업명에 포함됨 (occ가 더 짧음)
    for wn in worknet_names:
        if occ in wn:
            return wn
    return None

# ── 스트리밍으로 페르소나 수집 ──────────────────────────────────
print(f"\nNemotron 데이터셋 스트리밍 ({SAMPLE_SIZE:,}건)...")
ds = load_dataset("nvidia/Nemotron-Personas-Korea", split="train", streaming=True)

persona_map: dict[str, list[str]] = defaultdict(list)
matched_count = 0
skip_count = 0

for i, row in enumerate(ds.take(SAMPLE_SIZE)):
    if i % 10000 == 0:
        print(f"  {i:,}건 처리 중... (매칭: {matched_count}건)")

    occ = row.get("occupation", "")
    persona = row.get("professional_persona", "")

    if not persona:
        skip_count += 1
        continue

    wn_job = match_to_worknet(occ)
    if not wn_job:
        skip_count += 1
        continue

    if len(persona_map[wn_job]) < MAX_PER_JOB:
        persona_map[wn_job].append(persona)
        matched_count += 1

print(f"\n처리 완료:")
print(f"  총 샘플: {SAMPLE_SIZE:,}건")
print(f"  매칭 성공: {matched_count:,}건")
print(f"  매칭 실패(무직 포함): {skip_count:,}건")
print(f"  페르소나 확보된 직업 수: {len(persona_map)}개 / {len(worknet_names)}개")

# 커버리지 확인
covered = set(persona_map.keys())
not_covered = worknet_set - covered
print(f"\n  미커버 직업 ({len(not_covered)}개):")
for j in sorted(not_covered)[:20]:
    print(f"    - {j}")
if len(not_covered) > 20:
    print(f"    ... 외 {len(not_covered) - 20}개")

# ── 저장 ──────────────────────────────────────────────────────
result = dict(persona_map)
with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"\n저장 완료: {OUTPUT_PATH}")
print(f"파일 크기: {__import__('os').path.getsize(OUTPUT_PATH) / 1024 / 1024:.1f} MB")
