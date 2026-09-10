// In-memory frame broadcast buffer connecting Mobile Camera to PC HUD

const globalBroadcast = globalThis.__vdockx_broadcaster || {
  latestFrame: null,
  timestamp: 0,
  subscribers: new Set(),
};

globalThis.__vdockx_broadcaster = globalBroadcast;

export function updateFrame(frameDataUrl) {
  globalBroadcast.latestFrame = frameDataUrl;
  globalBroadcast.timestamp = Date.now();

  // Notify active stream subscribers
  for (const send of globalBroadcast.subscribers) {
    try {
      send(frameDataUrl);
    } catch (e) {
      globalBroadcast.subscribers.delete(send);
    }
  }
}

export function getLatestFrame() {
  return {
    frame: globalBroadcast.latestFrame,
    timestamp: globalBroadcast.timestamp,
    isFresh: Date.now() - globalBroadcast.timestamp < 3000,
  };
}

export function subscribeToFrames(callback) {
  globalBroadcast.subscribers.add(callback);
  return () => {
    globalBroadcast.subscribers.delete(callback);
  };
}
