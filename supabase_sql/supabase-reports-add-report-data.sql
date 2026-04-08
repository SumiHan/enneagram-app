-- reports 테이블에 동적 섹션 데이터 컬럼 추가
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS report_data JSONB;
-- report_data 형식: [{ "key": "section_key", "title": "섹션명", "content": "내용" }, ...]
