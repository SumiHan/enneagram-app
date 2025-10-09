import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { eventBus, EVENTS } from "./event-bus";

// Initialize real-time subscriptions for data changes
export function initializeRealtimeSubscriptions() {
  console.log('Initializing realtime subscriptions...');

  // Subscribe to reports table changes
  const reportsSubscription = supabase
    .channel('reports-changes')
    .on('postgres_changes', 
      { 
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public', 
        table: 'reports' 
      }, 
      (payload) => {
        console.log('Reports table changed:', payload);
        
        // Emit event for UI updates
        eventBus.emit(EVENTS.DATA_UPDATED, {
          userId: (payload.new as any)?.user_id || (payload.old as any)?.user_id,
          table: 'reports',
          event: payload.eventType,
          data: payload.new || payload.old
        });
      }
    )
    .subscribe();

  // Subscribe to responses table changes
  const responsesSubscription = supabase
    .channel('responses-changes')
    .on('postgres_changes', 
      { 
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public', 
        table: 'responses' 
      }, 
      (payload) => {
        console.log('Responses table changed:', payload);
        
        // Emit event for UI updates
        eventBus.emit(EVENTS.DATA_UPDATED, {
          userId: (payload.new as any)?.user_id || (payload.old as any)?.user_id,
          table: 'responses',
          event: payload.eventType,
          data: payload.new || payload.old
        });
      }
    )
    .subscribe();

  // Subscribe to user_progress table changes
  const progressSubscription = supabase
    .channel('progress-changes')
    .on('postgres_changes', 
      { 
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public', 
        table: 'user_progress' 
      }, 
      (payload) => {
        console.log('User progress table changed:', payload);
        
        // Emit event for UI updates
        eventBus.emit(EVENTS.DATA_UPDATED, {
          userId: (payload.new as any)?.user_id || (payload.old as any)?.user_id,
          table: 'user_progress',
          event: payload.eventType,
          data: payload.new || payload.old
        });
      }
    )
    .subscribe();

  // Return cleanup function
  return () => {
    console.log('Cleaning up realtime subscriptions...');
    supabase.removeChannel(reportsSubscription);
    supabase.removeChannel(responsesSubscription);
    supabase.removeChannel(progressSubscription);
  };
}

// Hook for using realtime subscriptions in components
export function useRealtimeSubscription() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const cleanup = initializeRealtimeSubscriptions();
    setIsConnected(true);
    
    console.log('Realtime subscriptions initialized');

    return () => {
      cleanup();
      setIsConnected(false);
    };
  }, []);

  return isConnected;
}
