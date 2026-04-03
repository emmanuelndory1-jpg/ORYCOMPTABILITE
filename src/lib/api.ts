
import { auth } from './firebase';

export const apiFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let token = localStorage.getItem('token');
  
  const getHeaders = (t: string | null) => {
    const h = new Headers(init?.headers);
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (t && url.startsWith('/api')) {
      h.set('Authorization', `Bearer ${t}`);
    }
    return h;
  };

  let response = await fetch(input, {
    ...init,
    headers: getHeaders(token),
  });

  // Handle Token Expired or Unauthorized
  if (response.status === 403 || response.status === 401) {
    const clone = response.clone();
    try {
      const data = await clone.json();
      if ((data.error === 'TokenExpired' || data.error === 'Unauthorized') && auth.currentUser) {
        console.log('Token expired or unauthorized, attempting to refresh...');
        const idToken = await auth.currentUser.getIdToken(true);
        const refreshRes = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken,
            email: auth.currentUser.email,
            name: auth.currentUser.displayName,
            uid: auth.currentUser.uid
          })
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          if (refreshData.token) {
            localStorage.setItem('token', refreshData.token);
            // Retry the original request with the new token
            return fetch(input, {
              ...init,
              headers: getHeaders(refreshData.token),
            });
          }
        } else {
          // Refresh failed, redirect to login
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
      } else if (data.error === 'TokenExpired' || data.error === 'Unauthorized') {
        // No user to refresh with, redirect to login
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    } catch (e) {
      // Not JSON or other error, just return original response
    }
  }

  return response;
};
