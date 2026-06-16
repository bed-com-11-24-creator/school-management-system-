// Offline Sync Queue Helper using LocalStorage

const QUEUE_KEY = 'malawi_sms_offline_queue';

/**
 * Gets the current queue of offline operations
 */
export function getOfflineQueue() {
  try {
    const queue = localStorage.getItem(QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (err) {
    console.error('Error reading offline queue:', err);
    return [];
  }
}

/**
 * Saves the queue back to localStorage
 */
function saveQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('Error saving offline queue:', err);
  }
}

/**
 * Adds an operation to the offline sync queue
 * @param {string} type - 'attendance' or 'score'
 * @param {object} data - Payload data for the operation
 */
export function queueOfflineOperation(type, data) {
  const queue = getOfflineQueue();
  // Generate a unique ID to identify the queued item
  const id = Date.now().toString() + Math.random().toString(36).substring(2, 7);
  
  queue.push({ id, type, data, timestamp: new Date().toISOString() });
  saveQueue(queue);
  console.log(`Queued offline operation [${type}]:`, data);
  
  // Dispatch a custom event so the UI can update
  window.dispatchEvent(new Event('offline-queue-updated'));
}

/**
 * Clears items from the queue by their IDs
 * @param {Array<string>} ids - Array of item IDs to remove
 */
export function dequeueOperations(ids) {
  const queue = getOfflineQueue();
  const filtered = queue.filter(item => !ids.includes(item.id));
  saveQueue(filtered);
  window.dispatchEvent(new Event('offline-queue-updated'));
}

/**
 * Syncs the local offline queue to the server
 * @param {string} token - Authorization JWT token
 * @param {string} apiHost - Host address of the API
 */
export async function syncOfflineData(token, apiHost = 'http://localhost:5000') {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { succeeded: 0, failed: 0 };
  
  console.log(`Attempting to sync ${queue.length} offline operations...`);
  
  try {
    const response = await fetch(`${apiHost}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ operations: queue })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('Sync result from server:', result);
      
      if (result.sync_results) {
        // Dequeue successfully synced items
        // In this simple implementation, if the endpoint returns success, we clear the entire queue
        const syncedIds = queue.map(item => item.id);
        dequeueOperations(syncedIds);
        return result.sync_results;
      }
    } else {
      console.warn('Sync request failed with status:', response.status);
    }
  } catch (err) {
    console.error('Network error during offline sync:', err);
  }
  
  return null;
}
