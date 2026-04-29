type SessionLike = {
  user?: {
    role?: string;
  };
} | null;

export function isSuperuser(session: SessionLike): boolean {
  return session?.user?.role === 'SUPERUSER';
}

export function isAdmin(session: SessionLike): boolean {
  return session?.user?.role === 'ADMIN';
}

export function isAdminOrSuperuser(session: SessionLike): boolean {
  return isAdmin(session) || isSuperuser(session);
}
