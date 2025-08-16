import { NextRequest, NextResponse } from 'next/server';
import { fetchReddit } from '../../lib/reddit';
import { summarizeThread } from '../../lib/summarize';

export async function POST(request: NextRequest) {
  try {
    const { query, previousQuery } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    const contextualQuery = previousQuery ? `${previousQuery} ${query}` : query;
    const redditThreads = await fetchReddit(contextualQuery);

    const cards = await Promise.all(
      redditThreads.map(async thread => {
        const summarized = await summarizeThread(thread, query);
        
        return {
          summary: summarized.summary,
          full_text: summarized.full_text,
          title: summarized.title,
          description: summarized.description,
          username: summarized.metadata.username,
          subreddit: summarized.metadata.subreddit,
          upvotes: summarized.metadata.upvotes,
          url: summarized.metadata.url
        };
      })
    );

    return NextResponse.json({
      cards: cards
    });

  } catch (error) {
    console.error('Error in /api/query:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Reddit data' },
      { status: 500 }
    );
  }
}