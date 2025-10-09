// Simple event bus for real-time UI updates
type EventCallback = (data?: any) => void;

class EventBus {
  private events: { [key: string]: EventCallback[] } = {};

  // Subscribe to an event
  on(event: string, callback: EventCallback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  // Unsubscribe from an event
  off(event: string, callback: EventCallback) {
    if (!this.events[event]) return;
    
    const index = this.events[event].indexOf(callback);
    if (index > -1) {
      this.events[event].splice(index, 1);
    }
  }

  // Emit an event
  emit(event: string, data?: any) {
    if (!this.events[event]) return;
    
    this.events[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event callback for ${event}:`, error);
      }
    });
  }

  // Clear all listeners for an event
  clear(event: string) {
    if (this.events[event]) {
      this.events[event] = [];
    }
  }
}

// Global event bus instance
export const eventBus = new EventBus();

// Event types
export const EVENTS = {
  REPORT_GENERATED: 'report_generated',
  SURVEY_COMPLETED: 'survey_completed',
  DATA_UPDATED: 'data_updated',
} as const;
