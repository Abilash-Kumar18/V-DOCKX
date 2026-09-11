// In-memory frame, mobile pose, and collision obstacle broadcast buffer connecting Mobile Phone to PC HUD & 2D Map

if (!globalThis.__vdockx_broadcaster) {
  globalThis.__vdockx_broadcaster = {
    latestFrame: null,
    mobilePose: null,
    motion: null,
    destination: { x: 1.0, y: 0.35 },
    latestObstacle: {
      corridor_blocked: false,
      min_distance_m: 999.0,
      detected_obstacles: [],
    },
    timestamp: 0,
    subscribers: new Set(),
  };
}

const globalBroadcast = globalThis.__vdockx_broadcaster;
if (!globalBroadcast.subscribers || !(globalBroadcast.subscribers instanceof Set)) {
  globalBroadcast.subscribers = new Set();
}
if (!globalBroadcast.destination) {
  globalBroadcast.destination = { x: 1.0, y: 0.35 };
}
if (!globalBroadcast.latestObstacle) {
  globalBroadcast.latestObstacle = {
    corridor_blocked: false,
    min_distance_m: 999.0,
    detected_obstacles: [],
  };
}

export function updateBroadcastData({ frame, pose, motion, destination, obstacle }) {
  if (frame) {
    globalBroadcast.latestFrame = frame;
  }
  if (pose) {
    globalBroadcast.mobilePose = {
      ...pose,
      theta: typeof pose.heading === "number" ? pose.heading : (pose.theta ?? -90),
      timestamp: Date.now(),
    };
  }
  if (motion) {
    globalBroadcast.motion = {
      ...motion,
      timestamp: Date.now(),
    };
  }
  if (destination && typeof destination.x === "number" && typeof destination.y === "number") {
    globalBroadcast.destination = {
      x: Number(destination.x.toFixed(3)),
      y: Number(destination.y.toFixed(3)),
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
  if (globalBroadcast.subscribers && typeof globalBroadcast.subscribers[Symbol.iterator] === "function") {
    for (const send of globalBroadcast.subscribers) {
      try {
        send({
          frame: globalBroadcast.latestFrame,
          pose: globalBroadcast.mobilePose,
          motion: globalBroadcast.motion,
          destination: globalBroadcast.destination,
          obstacle: globalBroadcast.latestObstacle,
          timestamp: globalBroadcast.timestamp,
        });
      } catch (e) {
        globalBroadcast.subscribers.delete(send);
      }
    }
  }
}

export function getLatestBroadcastData() {
  const isFresh = Date.now() - globalBroadcast.timestamp < 8000;
  return {
    frame: globalBroadcast.latestFrame,
    pose: isFresh ? globalBroadcast.mobilePose : null,
    motion: isFresh ? globalBroadcast.motion : null,
    destination: globalBroadcast.destination || { x: 1.0, y: 0.35 },
    obstacle: isFresh
      ? globalBroadcast.latestObstacle
      : { corridor_blocked: false, min_distance_m: 999.0, detected_obstacles: [] },
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
