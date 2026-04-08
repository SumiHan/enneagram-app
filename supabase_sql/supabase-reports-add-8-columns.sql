-- ============================================
-- Reports 테이블에 8개 항목 리포트를 위한 컬럼 추가
-- ============================================

-- 기존에 있는 컬럼 확인 (career_guidance, growth_advice는 이미 있을 수 있음)
-- 아래 SQL을 실행하여 현재 컬럼 상태 확인:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'reports' AND table_schema = 'public'
-- ORDER BY ordinal_position;

-- 1. career_guidance 컬럼 추가 (이미 있으면 스킵)
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS career_guidance TEXT;

-- 2. growth_advice 컬럼 추가 (이미 있으면 스킵)
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS growth_advice TEXT;

-- 3. wing 컬럼 추가 (날개 유형)
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS wing TEXT;

-- 4. integration_disintegration 컬럼 추가 (성장 및 퇴화 방향)
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS integration_disintegration TEXT;

-- 5. famous_examples 컬럼 추가 (대표적인 전 세계 유명인)
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS famous_examples JSONB;

-- 6. major_based_career_path 컬럼 추가 (전공 기반 진로 로드맵)
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS major_based_career_path TEXT;

-- 확인: 모든 컬럼이 추가되었는지 확인
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'reports' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ Reports 테이블에 8개 항목 리포트 컬럼이 추가되었습니다!';
END $$;

