"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Head from 'next/head';
import Image from 'next/image';

// Custom image loader for YouTube thumbnails
const youtubeImageLoader = ({ src }: { src: string }) => {
  return src;
};

// Theme icons component
const ThemeIcon = ({ theme }: { theme: 'light' | 'dark' }) => (
  <div className="relative w-6 h-6">
    {theme === 'dark' ? (
      <svg
        className="w-6 h-6 text-yellow-500 transition-transform duration-300 transform rotate-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    ) : (
      <svg
        className="w-6 h-6 text-gray-700 transition-transform duration-300 transform rotate-180"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      </svg>
    )}
  </div>
);

type VideoItem = {
  id: { videoId: string };
  snippet: {
    title: string;
    thumbnails: { medium: { url: string } };
    publishedAt: string;
  };
};

type ErrorDetails = {
  error: string;
  details?: unknown;
};

type UserPreferences = {
  theme: 'light' | 'dark';
  autoplay: boolean;
  refreshInterval: number;
  videosPerPage: number;
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type ImageLoadingState = {
  [key: string]: boolean;
};

export const dynamic = 'force-dynamic';
export default function DashboardPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<ErrorDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [channelTitle, setChannelTitle] = useState<string>('Subscribed Channels');
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: 'light',
    autoplay: true,
    refreshInterval: 30,
    videosPerPage: 12,
  });
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [imageLoading, setImageLoading] = useState<ImageLoadingState>({});

  // Update lastUpdated time on client-side only
  useEffect(() => {
    setLastUpdated(new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }));
  }, []);

  // PWA install prompt
  useEffect(() => {
    let mounted = true;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      console.log('beforeinstallprompt fired:', promptEvent);
      if (mounted) {
        setDeferredPrompt(promptEvent);
        setShowInstallPrompt(true);
      }
    };

    const handleAppInstalled = () => {
      console.log('App installed successfully');
      if (mounted) {
        setIsPWAInstalled(true);
        setShowInstallPrompt(false);
        setDeferredPrompt(null);
      }
    };

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsPWAInstalled(true);
      setShowInstallPrompt(false);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      mounted = false;
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      console.log('No install prompt available');
      return;
    }

    try {
      console.log('Prompting for installation...');
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('Installation outcome:', outcome);

      if (outcome === 'accepted') {
        setShowInstallPrompt(false);
        setIsPWAInstalled(true);
      }
      setDeferredPrompt(null);
    } catch (error) {
      console.error('Error during installation:', error);
    }
  };

  // Load preferences from localStorage
  useEffect(() => {
    try {
      const savedPrefs = localStorage.getItem('userPreferences');
      if (savedPrefs) {
        const parsedPrefs = JSON.parse(savedPrefs);
        setPreferences(prev => ({ ...prev, ...parsedPrefs }));
      }
    } catch (err) {
      console.error('Error loading preferences:', err);
    }
  }, []);

  // Handle session management
  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!mounted) return;

        if (!session) {
          router.replace("/login");
          return;
        }

        if (!session.provider_token) {
          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }

        setAccessToken(session.provider_token);
        setUserId(session.user.id);
        setVideos([]);
        setSelectedVideo(null);
        setError(null);
        setCurrentPage(1);
      } catch (err) {
        console.error("Session error:", err);
        if (mounted) {
          setError({
            error: "Failed to verify authentication status",
            details: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (!session || !session.provider_token) {
        router.replace("/login");
      } else {
        setAccessToken(session.provider_token);
        setUserId(session.user.id);
        setVideos([]);
        setSelectedVideo(null);
        setError(null);
        setCurrentPage(1);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  // Fetch videos function
  const fetchVideos = useCallback(async () => {
    if (!accessToken) return;

    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch(`/api/videos?access_token=${accessToken}`);
      const data = await res.json();
      console.log('API Response:', data);

      if (!res.ok) {
        if (res.status === 401) {
          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }
        throw new Error(data.error || 'Failed to fetch videos');
      }

      if (!data.items || data.items.length === 0) {
        setVideos([]);
        setError({
          error: `No recent videos found from ${data.subscriptionCount} subscribed channels`,
          details: 'Try subscribing to more active channels or check API quota.',
        });
      } else {
        setVideos(data.items);
      }
      setChannelTitle(`Subscribed Channels (${data.subscriptionCount})`);
      setLastUpdated(new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }));
    } catch (err) {
      console.error('Error fetching videos:', err);
      setError({
        error: err instanceof Error ? err.message : 'Failed to fetch videos',
        details: err,
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, router, supabase]);

  // Auto-refresh videos
  useEffect(() => {
    if (!accessToken || !userId) return;

    let mounted = true;

    const fetchAndSetVideos = async () => {
      if (!mounted) return;
      await fetchVideos();
    };

    fetchAndSetVideos();
    const interval = setInterval(fetchAndSetVideos, preferences.refreshInterval * 60 * 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [accessToken, userId, fetchVideos, preferences.refreshInterval]);

  const savePreferences = (newPrefs: Partial<UserPreferences>) => {
    const updatedPrefs = { ...preferences, ...newPrefs };
    setPreferences(updatedPrefs);
    try {
      localStorage.setItem('userPreferences', JSON.stringify(updatedPrefs));
    } catch (err) {
      console.error('Error saving preferences:', err);
    }
  };

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
      router.replace("/login");
    } catch (err) {
      console.error("Error signing out:", err);
    }
  }

  const handleImageLoad = (videoId: string) => {
    setImageLoading(prev => ({ ...prev, [videoId]: false }));
  };

  const handleImageError = (videoId: string) => {
    console.error(`Failed to load image for video ${videoId}`);
    setImageLoading(prev => ({ ...prev, [videoId]: false }));
  };

  const totalPages = Math.ceil(videos.length / preferences.videosPerPage);
  const paginatedVideos = videos.slice(
    (currentPage - 1) * preferences.videosPerPage,
    currentPage * preferences.videosPerPage
  );

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.error("Date formatting error:", error);
      return "Date unavailable";
    }
  };

  return (
    <>
      <Head>
        <meta name="theme-color" content={preferences.theme === 'dark' ? '#1a1a1a' : '#ffffff'} />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="YouTube Videos Fetcher" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </Head>

      <main className={`p-4 min-h-screen transition-colors duration-300 ${
        preferences.theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
      }`}>
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6 animate-fade-in">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {channelTitle}
              </h1>
              {lastUpdated && (
                <p className={`text-sm ${
                  preferences.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Last updated: {lastUpdated}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => savePreferences({ theme: preferences.theme === 'dark' ? 'light' : 'dark' })}
                className={`p-2 rounded-full transition-all duration-300 transform hover:scale-110 ${
                  preferences.theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
                }`}
                aria-label={`Switch to ${preferences.theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                <ThemeIcon theme={preferences.theme} />
              </button>
              {!isPWAInstalled && showInstallPrompt && (
                <button
                  onClick={handleInstall}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-all duration-200 hover:shadow-lg"
                >
                  <span>Install App</span>
                  {process.env.NODE_ENV === 'development' && (
                    <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded">Dev Mode</span>
                  )}
                </button>
              )}
              <button
                onClick={() => setShowSignOutDialog(true)}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 hover:shadow-lg"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          <div className={`mb-6 p-6 rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl ${
            preferences.theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          }`}>
            <h2 className={`text-xl font-semibold mb-4 ${
              preferences.theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>Preferences</h2>
            <div className="flex gap-6 flex-wrap">
              <label className={`flex items-center space-x-2 cursor-pointer ${
                preferences.theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                <input
                  type="checkbox"
                  checked={preferences.autoplay}
                  onChange={(e) => savePreferences({ autoplay: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Autoplay videos</span>
              </label>
              <div className={`flex items-center space-x-2 ${
                preferences.theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                <span>Refresh every</span>
                <select
                  value={preferences.refreshInterval}
                  onChange={(e) => savePreferences({ refreshInterval: Number(e.target.value) })}
                  className={`p-2 rounded-lg border focus:ring-2 focus:ring-blue-500 ${
                    preferences.theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="1">1 minute</option>
                  <option value="5">5 minutes</option>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                </select>
              </div>
              <div className={`flex items-center space-x-2 ${
                preferences.theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                <span>Videos per page</span>
                <select
                  value={preferences.videosPerPage}
                  onChange={(e) => savePreferences({ videosPerPage: Number(e.target.value) })}
                  className={`p-2 rounded-lg border focus:ring-2 focus:ring-blue-500 ${
                    preferences.theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="8">8</option>
                  <option value="12">12</option>
                  <option value="16">16</option>
                  <option value="20">20</option>
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-100 dark:bg-red-900 rounded-lg">
              <p className="text-red-800 dark:text-red-200">{error.error}</p>
              {error && (
                <p className="text-sm text-red-600 dark:text-red-300 mt-2">
                  {typeof error === 'string' ? error : JSON.stringify(error)}
                </p>
              )}
              <button
                onClick={fetchVideos}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Video Player */}
              {selectedVideo && (
                <div className="mb-8 rounded-xl overflow-hidden shadow-2xl transform transition-all duration-300 hover:scale-[1.02]">
                  <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                    <div className="absolute top-0 left-0 w-full h-full bg-black">
                      <iframe
                        src={`https://www.youtube-nocookie.com/embed/${selectedVideo}?rel=0&modestbranding=1&controls=1${preferences.autoplay ? '&autoplay=1' : ''}`}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full"
                      ></iframe>
                    </div>
                  </div>
                </div>
              )}

              {/* Video Grid */}
              {videos.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {paginatedVideos.map((video) => (
                      <div
                        key={video.id.videoId}
                        onClick={() => setSelectedVideo(video.id.videoId)}
                        className={`
                          cursor-pointer rounded-xl overflow-hidden
                          ${preferences.theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'}
                          transform transition-all duration-300 hover:scale-105 hover:shadow-2xl
                          shadow-lg
                        `}
                      >
                        <div className="relative aspect-video">
                          {imageLoading[video.id.videoId] && (
                            <div className={`absolute inset-0 flex items-center justify-center ${
                              preferences.theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                            }`}>
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                          )}
                          <div className="w-full h-full relative">
                            <Image
                              loader={youtubeImageLoader}
                              unoptimized
                              src={video.snippet.thumbnails.medium.url}
                              alt={video.snippet.title}
                              width={320}
                              height={180}
                              className="rounded-t-xl object-cover"
                              onLoadingComplete={() => handleImageLoad(video.id.videoId)}
                              onError={() => handleImageError(video.id.videoId)}
                              loading="lazy"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                              }}
                            />
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className={`text-sm font-medium line-clamp-2 transition-colors duration-200 ${
                            preferences.theme === 'dark' ? 'text-white hover:text-blue-400' : 'text-gray-900 hover:text-blue-600'
                          }`}>
                            {video.snippet.title}
                          </h3>
                          <p className={`text-xs ${
                            preferences.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            {formatDate(video.snippet.publishedAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  <div className="mt-8 flex justify-center items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className={`px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 ${
                        preferences.theme === 'dark' ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                      }`}
                    >
                      Previous
                    </button>
                    <span className={`px-4 py-2 ${
                      preferences.theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className={`px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 ${
                        preferences.theme === 'dark' ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                      }`}
                    >
                      Next
                    </button>
                  </div>
                </>
              ) : (
                <div className={`text-center mt-8 ${preferences.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  {error ? (
                    <>
                      <p>{error.error}</p>
                      {error.details && (
                        <p className="text-sm mt-2">{typeof error.details === 'string' ? error.details : JSON.stringify(error.details)}</p>
                      )}
                    </>
                  ) : (
                    'No videos found from your subscribed channels'
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Sign Out Dialog */}
        {showSignOutDialog && (
          <div className="fixed inset-0 bg-white/30 dark:bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <div className={`p-6 rounded-xl shadow-2xl transform transition-all duration-300 ${
              preferences.theme === 'dark' ? 'bg-gray-800/95' : 'bg-white/95'
            }`}>
              <h3 className={`text-xl font-semibold mb-4 ${
                preferences.theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Sign Out
              </h3>
              <p className={`mb-6 ${preferences.theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                Are you sure you want to sign out?
              </p>
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setShowSignOutDialog(false)}
                  className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
                    preferences.theme === 'dark' ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowSignOutDialog(false);
                    handleSignOut();
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
                >
                  Yes, Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
