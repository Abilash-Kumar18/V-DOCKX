// In-memory mock user database for Next.js API authentication

const globalUsers = [
  {
    id: "usr_innovix",
    username: "innovix",
    email: "innovix@vdockx.ai",
    password: "innovix@123",
    name: "Innovix Operator",
    role: "RAS Lead Engineer",
    avatar: "IX",
  },
];

globalThis.__vdockx_users = globalUsers;

export function findUserByEmail(identifier) {
  const normalized = (identifier || "").trim().toLowerCase();
  return globalUsers.find(
    (u) =>
      u.username.toLowerCase() === normalized ||
      u.email.toLowerCase() === normalized
  );
}

export function verifyCredentials(identifier, password) {
  const normalized = (identifier || "").trim().toLowerCase();

  // Strict check: only allow username innovix
  if (normalized !== "innovix" && normalized !== "innovix@vdockx.ai") {
    return { error: "Invalid credentials. Only user 'innovix' is authorized." };
  }

  if (password !== "innovix@123") {
    return { error: "Invalid password for user 'innovix'." };
  }

  const user = globalUsers[0];
  return { user: sanitizeUser(user) };
}

export function registerUser({ name, email, password }) {
  return { error: "Registration is restricted. Authorized credentials are fixed." };
}

export function sanitizeUser(user) {
  const { password, ...safe } = user;
  return safe;
}
