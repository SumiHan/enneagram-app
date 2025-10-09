"use client";
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

interface DebugPanelProps {
  surveyType: 'pre' | 'main';
  status: string | null;
  loading: boolean;
}

export function DebugPanel({ surveyType, status, loading }: DebugPanelProps) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [dbData, setDbData] = useState<any>(null);
  const [checking, setChecking] = useState(false);

  const checkDB = async () => {
    if (!user?.uid) return;
    
    setChecking(true);
    try {
      // Check responses table
      const { data: responseData, error: responseError } = await supabase
        .from('responses')
        .select('*')
        .eq('user_id', user.uid)
        .eq('survey_type', surveyType)
        .maybeSingle();

      // Check user_progress table
      const { data: progressData, error: progressError } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.uid)
        .maybeSingle();

      setDbData({
        responses: { data: responseData, error: responseError },
        user_progress: { data: progressData, error: progressError },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Debug check failed:', error);
      setDbData({ error: String(error) });
    } finally {
      setChecking(false);
    }
  };

  // Only show in development or when explicitly enabled
  if (process.env.NODE_ENV === 'production' && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="fixed bottom-4 right-4 bg-red-500 text-white px-3 py-2 rounded-full text-xs shadow-lg z-50"
      >
        🐛 Debug
      </button>
    );
  }

  if (!expanded) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900 text-white p-4 max-h-96 overflow-y-auto z-50 text-xs font-mono">
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-bold text-sm">🐛 Debug Panel - {surveyType} Survey</h3>
        <button
          onClick={() => setExpanded(false)}
          className="text-slate-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2">
        <div className="bg-slate-800 p-2 rounded">
          <div className="text-yellow-400">User Info:</div>
          <div>Email: {user?.email || 'Not logged in'}</div>
          <div>User ID: {user?.uid || 'N/A'}</div>
          <div>Role: {user?.role || 'N/A'}</div>
        </div>

        <div className="bg-slate-800 p-2 rounded">
          <div className="text-yellow-400">Hook State:</div>
          <div>Status: <span className={status === 'completed' ? 'text-green-400' : status === 'in_progress' ? 'text-yellow-400' : 'text-slate-400'}>{status || 'null'}</span></div>
          <div>Loading: {loading ? '⏳ Yes' : '✅ No'}</div>
        </div>

        <div className="bg-slate-800 p-2 rounded">
          <div className="flex justify-between items-center mb-2">
            <div className="text-yellow-400">Database State:</div>
            <button
              onClick={checkDB}
              disabled={checking}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 px-2 py-1 rounded text-xs"
            >
              {checking ? '⏳ Checking...' : '🔄 Check DB'}
            </button>
          </div>
          
          {dbData && (
            <div className="mt-2 space-y-2">
              <div>
                <div className="text-cyan-400">Responses Table:</div>
                {dbData.responses?.error ? (
                  <div className="text-red-400">Error: {JSON.stringify(dbData.responses.error)}</div>
                ) : dbData.responses?.data ? (
                  <pre className="bg-slate-900 p-2 rounded overflow-x-auto text-xs">
                    {JSON.stringify(dbData.responses.data, null, 2)}
                  </pre>
                ) : (
                  <div className="text-slate-500">No data found</div>
                )}
              </div>

              <div>
                <div className="text-cyan-400">User Progress Table:</div>
                {dbData.user_progress?.error ? (
                  <div className="text-red-400">Error: {JSON.stringify(dbData.user_progress.error)}</div>
                ) : dbData.user_progress?.data ? (
                  <pre className="bg-slate-900 p-2 rounded overflow-x-auto text-xs">
                    {JSON.stringify({
                      pre_status: (dbData.user_progress.data as any).pre_survey_status,
                      main_status: (dbData.user_progress.data as any).main_survey_status,
                    }, null, 2)}
                  </pre>
                ) : (
                  <div className="text-slate-500">No data found</div>
                )}
              </div>

              <div className="text-slate-400 text-xs">
                Last checked: {new Date(dbData.timestamp).toLocaleString('ko-KR')}
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-800 p-2 rounded">
          <div className="text-yellow-400">Device Info:</div>
          <div>User Agent: {typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 50) + '...' : 'N/A'}</div>
          <div>Platform: {typeof navigator !== 'undefined' ? navigator.platform : 'N/A'}</div>
          <div>Screen: {typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'N/A'}</div>
        </div>

        <div className="text-slate-400 text-xs mt-4">
          💡 Tip: Check browser console for detailed logs
        </div>
      </div>
    </div>
  );
}

