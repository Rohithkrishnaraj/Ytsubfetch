// app/api/videos/route.ts
import { NextResponse } from "next/server";

type YouTubeVideo = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    thumbnails?: { medium?: { url?: string } };
    publishedAt?: string;
  };
};

type Subscription = {
  snippet?: {
    resourceId?: { channelId?: string };
    title?: string;
  };
};

type SanitizedVideo = {
  id: { videoId: string };
  snippet: {
    title: string;
    thumbnails: { medium: { url: string } };
    publishedAt: string;
  };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accessToken = searchParams.get("access_token");

  if (!accessToken) {
    return NextResponse.json({ error: "Access token required" }, { status: 401 });
  }

  try {
    console.log('Fetching subscriptions with access token:', accessToken.substring(0, 10) + '...');

    // Get user's subscriptions
    const subscriptionsResponse = await fetch(
      'https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      }
    );

    const subscriptionsData = await subscriptionsResponse.json();
    if (subscriptionsData.error) {
      console.error('YouTube API Error:', subscriptionsData.error);
      return NextResponse.json(
        { error: subscriptionsData.error.message || "YouTube API Error", details: subscriptionsData.error },
        { status: subscriptionsData.error.code || 400 }
      );
    }

    if (!subscriptionsData.items || subscriptionsData.items.length === 0) {
      return NextResponse.json({ error: "No subscriptions found" }, { status: 404 });
    }

    const channelIds = subscriptionsData.items
      .map((sub: Subscription) => sub.snippet?.resourceId?.channelId)
      .filter(Boolean);

    console.log('Found subscribed channels:', channelIds);

    // Fetch videos from each channel individually
    const allVideos: SanitizedVideo[] = [];
    for (const channelId of channelIds) {
      const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/search?key=${process.env.YOUTUBE_API_KEY}&channelId=${channelId}&part=snippet,id&order=date&maxResults=5&type=video`;

      const response = await fetch(youtubeApiUrl, {
        headers: { 'Accept': 'application/json' },
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        console.error(`Error fetching videos for channel ${channelId}:`, data.error || data);
        continue; // Skip this channel if there's an error
      }

      const sanitizedVideos = data.items?.map((item: YouTubeVideo): SanitizedVideo => ({
        id: { videoId: item.id?.videoId || '' },
        snippet: {
          title: item.snippet?.title || '',
          thumbnails: { medium: { url: item.snippet?.thumbnails?.medium?.url || '' } },
          publishedAt: item.snippet?.publishedAt || new Date().toISOString(),
        },
      })).filter((video: SanitizedVideo) => video.id.videoId && video.snippet.thumbnails.medium.url) || [];

      allVideos.push(...sanitizedVideos);
    }

    // Sort videos by date and limit to 10 most recent
    const sortedVideos = allVideos
      .sort((a, b) => new Date(b.snippet.publishedAt).getTime() - new Date(a.snippet.publishedAt).getTime())
      .slice(0, 10);

    return NextResponse.json({
      items: sortedVideos,
      subscriptionCount: channelIds.length,
    });
  } catch (error) {
    console.error('Error fetching subscribed videos:', error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}