import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type SurveyType = 'pre' | 'main';
type SurveyStatus = 'not_started' | 'in_progress' | 'completed';

interface UseSurveyStatusResult {
  status: SurveyStatus | null;
  loading: boolean;
  error: string | null;
  updateStatus: (newStatus: SurveyStatus) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Survey status management hook with Supabase as single source of truth
 * 
 * @param userId - User ID
 * @param surveyType - Survey type ('pre' | 'main')
 * @returns Status, loading state, error, and update function
 */
export function useSurveyStatus(userId: string | null, surveyType: SurveyType): UseSurveyStatusResult {
  const [status, setStatus] = useState<SurveyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch status from Supabase (single source of truth)
   */
  const fetchStatus = useCallback(async () => {
    if (!userId) {
      setStatus('not_started');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Check responses table first (most up-to-date)
      const { data: responseData, error: responseError } = await supabase
        .from('responses')
        .select('status')
        .eq('user_id', userId)
        .eq('survey_type', surveyType)
        .maybeSingle();

      if (responseError) throw responseError;

      if (responseData && responseData.status) {
        // Map 'in_progress' | 'completed' to our status type
        const mappedStatus = responseData.status as 'in_progress' | 'completed';
        setStatus(mappedStatus);
        console.log(`[useSurveyStatus] Loaded ${surveyType} status from responses:`, mappedStatus);
      } else {
        // No response data, check user_progress table
        const { data: progressData, error: progressError } = await supabase
          .from('user_progress')
          .select(surveyType === 'pre' ? 'pre_survey_status' : 'main_survey_status')
          .eq('user_id', userId)
          .maybeSingle();

        if (progressError) throw progressError;

        if (progressData) {
          const dbStatus = surveyType === 'pre' 
            ? (progressData as any).pre_survey_status 
            : (progressData as any).main_survey_status;
          
          // Map DB status to our type
          const mappedStatus: SurveyStatus = 
            dbStatus === 'COMPLETED' ? 'completed' :
            dbStatus === 'IN_PROGRESS' ? 'in_progress' :
            'not_started';
          
          setStatus(mappedStatus);
          console.log(`[useSurveyStatus] Loaded ${surveyType} status from user_progress:`, mappedStatus);
        } else {
          // No data at all, default to not_started
          setStatus('not_started');
          console.log(`[useSurveyStatus] No data found, defaulting to not_started`);
        }
      }
    } catch (err) {
      console.error(`[useSurveyStatus] Error fetching ${surveyType} status:`, err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('not_started'); // Fallback
    } finally {
      setLoading(false);
    }
  }, [userId, surveyType]);

  /**
   * Update status in Supabase, then sync to local state
   * No optimistic updates - wait for DB confirmation
   */
  const updateStatus = useCallback(async (newStatus: SurveyStatus) => {
    if (!userId) {
      console.warn('[useSurveyStatus] Cannot update status: no userId');
      return;
    }

    try {
      console.log(`[useSurveyStatus] Updating ${surveyType} status to:`, newStatus);

      // Update responses table
      const { error: responseError } = await supabase
        .from('responses')
        .upsert({
          user_id: userId,
          survey_type: surveyType,
          status: newStatus === 'completed' ? 'completed' : 'in_progress',
        }, {
          onConflict: 'user_id,survey_type'
        });

      if (responseError) throw responseError;

      // Update user_progress table
      const dbStatus = newStatus === 'completed' ? 'COMPLETED' : 
                       newStatus === 'in_progress' ? 'IN_PROGRESS' : 
                       'NOT_STARTED';

      const updateField = surveyType === 'pre' ? 'pre_survey_status' : 'main_survey_status';
      
      const { error: progressError } = await supabase
        .from('user_progress')
        .update({ [updateField]: dbStatus })
        .eq('user_id', userId);

      if (progressError) throw progressError;

      // Only after successful DB update, update local state
      setStatus(newStatus);
      console.log(`[useSurveyStatus] Successfully updated ${surveyType} status to:`, newStatus);
    } catch (err) {
      console.error(`[useSurveyStatus] Error updating ${surveyType} status:`, err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err; // Re-throw so caller can handle
    }
  }, [userId, surveyType]);

  /**
   * Refetch status from DB
   */
  const refetch = useCallback(async () => {
    await fetchStatus();
  }, [fetchStatus]);

  // Fetch status on mount and when dependencies change
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    status,
    loading,
    error,
    updateStatus,
    refetch,
  };
}

