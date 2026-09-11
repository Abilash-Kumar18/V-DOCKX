// In-memory frame, mobile pose, and collision obstacle broadcast buffer connecting Mobile Phone to PC HUD & 2D Map

const globalBroadcast = globalThis.__vdockx_broadcaster || {
  latestFrame: null,
  mobilePose: null,
  latestObstacle: {
    corridor_blocked: false,
    min_distance_m: 999.0,
    detected_obstacles: [],
  },
  timestamp: 0,
  subscribers: new Set(),
};

globalThis.__vdockx_broadcaster = globalBroadcast;

export function updateBroadcastData({ frame, pose, obstacle }) {
  if (frame) {
    globalBroadcast.latestFrame = frame;
  }
  if (pose) {
    globalBroadcast.mobilePose = {
      ...pose,
      timestamp: Date.now(),
    };
  }
  if (obstacle) {
    globalBroadcast.latestObstacle = {
      ...obstacle,
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
        obstacle: globalBroadcast.latestObstacle,
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
    obstacle: isFresh ? globalBroadcast.latestObstacle : { corridor_blocked: false, min_distance_m: 999.0, detected_obstacles: [] },
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
