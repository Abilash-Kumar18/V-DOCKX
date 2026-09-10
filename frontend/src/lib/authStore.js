// In-memory mock user database for Next.js API authentication

const globalUsers = globalThis.__vdockx_users || [
  {
    id: "usr_01",
    email: "operator@vdockx.ai",
    password: "docking2026#",
    name: "Alex Chen",
    role: "Telemetry & Perception Lead",
    avatar: "AC",
  },
  {
    id: "usr_02",
    email: "admin@vdockx.ai",
    password: "admin2026#",
    name: "Dr. Elena Vance",
    role: "Autonomous Systems Director",
    avatar: "EV",
  },
];

globalThis.__vdockx_users = globalUsers;

export function findUserByEmail(email) {
  return globalUsers.find(
    (u) => u.email.toLowerCase().trim() === email.toLowerCase().trim()
  );
}

export function registerUser({ name, email, password, role = "Robotics Engineer" }) {
  const existing = findUserByEmail(email);
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "VD";

  const newUser = {
    id: `usr_${Date.now()}`,
    email: email.trim().toLowerCase(),
    password,
    name: name.trim(),
    role,
    avatar: initials,
  };

  globalUsers.push(newUser);
  return { user: sanitizeUser(newUser) };
}

export function verifyCredentials(email, password) {
  const user = findUserByEmail(email);
  if (!user) {
    return { error: "No account found with this email address." };
  }
  if (user.password !== password) {
    return { error: "Incorrect password. Please verify your credentials." };
  }
  return { user: sanitizeUser(user) };
}

export function sanitizeUser(user) {
  const { password, ...safe } = user;
  return safe;
}
