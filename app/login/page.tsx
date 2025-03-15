"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const redirectUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const mountedRef = useRef(false);

  const checkSession = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Login Page - Session check:', session ? 'exists' : 'none');
      
      if (mountedRef.current && session) {
        router.replace("/dashboard");
      }
    } catch (err) {
      console.error('Session check error:', err);
    } finally {
      if (mountedRef.current) {
        setIsCheckingSession(false);
      }
    }
  }, [router]);

  useEffect(() => {
    mountedRef.current = true;
    const supabase = createClient();

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Login Page - Auth state change:', event, session ? 'session exists' : 'no session');
      if (mountedRef.current && event === 'SIGNED_IN' && session) {
        router.replace("/dashboard");
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [router, checkSession]);

  const signInWithGoogle = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('Login Page - Starting Google sign in');
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          scopes: "https://www.googleapis.com/auth/youtube.readonly",
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          redirectTo: `${redirectUrl}/auth/callback`,
        },
      });

      if (error) {
        console.error('Login Page - Sign in error:', error);
        throw error;
      }
    } catch (err) {
      console.error("Error signing in:", err);
      setError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setIsLoading(false);
    }
  }, [redirectUrl]);

  if (isCheckingSession) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold text-center text-gray-900">
          Welcome to YouTube Video Fetcher
        </h1>
        
        {error && (
          <div className="p-4 text-sm text-red-700 bg-red-100 rounded-lg">
            {error}
          </div>
        )}

        <button
          onClick={signInWithGoogle}
          disabled={isLoading}
          className={`w-full flex items-center justify-center gap-3 px-6 py-3 text-white bg-blue-600 rounded-lg transition
            ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {isLoading ? 'Signing in...' : 'Sign in with Google'}
        </button>

        <p className="text-sm text-center text-gray-600">
          By signing in, you&apos;ll be able to access your YouTube channel videos
        </p>
      </div>
    </div>
  );
}
