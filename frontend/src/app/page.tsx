'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useSession();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    router.replace(user.role === 'DRIVER' ? '/driver/dashboard' : '/admin/dashboard');
  }, [loading, router, user]);

  return null;
}
