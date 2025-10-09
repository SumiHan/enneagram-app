-- Fix RLS policies for ai_settings and ai_prompts
-- This script drops existing policies and creates simpler ones

-- Drop existing policies for ai_settings
DROP POLICY IF EXISTS "Admins can view ai_settings" ON public.ai_settings;
DROP POLICY IF EXISTS "Admins can update ai_settings" ON public.ai_settings;

-- Drop existing policies for ai_prompts
DROP POLICY IF EXISTS "Admins can view ai_prompts" ON public.ai_prompts;
DROP POLICY IF EXISTS "Admins can insert ai_prompts" ON public.ai_prompts;
DROP POLICY IF EXISTS "Admins can update ai_prompts" ON public.ai_prompts;
DROP POLICY IF EXISTS "Admins can delete ai_prompts" ON public.ai_prompts;

-- Create simpler policies for ai_settings (allow all authenticated users for now)
CREATE POLICY "Allow authenticated users to view ai_settings"
  ON public.ai_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to update ai_settings"
  ON public.ai_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create simpler policies for ai_prompts (allow all authenticated users for now)
CREATE POLICY "Allow authenticated users to view ai_prompts"
  ON public.ai_prompts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert ai_prompts"
  ON public.ai_prompts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update ai_prompts"
  ON public.ai_prompts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete ai_prompts"
  ON public.ai_prompts FOR DELETE
  TO authenticated
  USING (true);

