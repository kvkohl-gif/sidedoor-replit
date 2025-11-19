import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: () => api('/api/auth/user'),
    retry: false,
  });
  return { 
    user, 
    isLoading,
    isAuthenticated: !!user 
  };
}
