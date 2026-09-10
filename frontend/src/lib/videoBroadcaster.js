// In-memory frame and mobile pose broadcast buffer connecting Mobile Phone to PC HUD & 2D Map

const globalBroadcast = globalThis.__vdockx_broadcaster || {
  latestFrame: null,
  mobilePose: null,
  timestamp: 0,
  subscribers: new Set(),
};

globalThis.__vdockx_broadcaster = globalBroadcast;

export function updateBroadcastData({ frame, pose }) {
  if (frame) {
    globalBroadcast.latestFrame = frame;
  }
  if (pose) {
    globalBroadcast.mobilePose = {
      ...pose,
      timestamp: Date.now(),
    };
  }
  globalBroadcast.timestamp = Date.now();

  // Notify active stream subscribers
  for (const send of globalBroadcast.subscribers) {
    try {
      send({
        frame: globalBroadcast.latestFrame,
        pose: globalBroadcast.mobilePose,
        timestamp: globalBroadcast.timestamp,
      });
    } catch (e) {
      globalBroadcast.subscribers.delete(send);
    }
  }
}

export function getLatestBroadcastData() {
  const isFresh = Date.now() - globalBroadcast.timestamp < 4000;
  return {
    frame: globalBroadcast.latestFrame,
    pose: isFresh ? globalBroadcast.mobilePose : null,
    timestamp: globalBroadcast.timestamp,
    isFresh,
  };
}

export function subscribeToBroadcast(callback) {
  globalBroadcast.subscribers.add(callback);
  return () => {
    globalBroadcast.subscribers.delete(callback);
  };
}
