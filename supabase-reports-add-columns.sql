-- Add new columns to reports table for enhanced AI-generated content

-- Add career_guidance column
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS career_guidance TEXT;

-- Add growth_advice column
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS growth_advice TEXT;

-- Verify columns added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'reports' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

