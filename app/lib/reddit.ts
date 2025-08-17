interface RedditThread {
  thread_title: string;
  subreddit: string;
  url: string;
  comments: RedditComment[];
}

interface RedditComment {
  username: string;
  upvotes: number;
  text: string;
}

interface RedditPost {
  data: {
    title: string;
    subreddit_name_prefixed: string;
    permalink: string;
    id: string;
    ups: number;
  };
}

interface RedditCommentData {
  data: {
    author: string;
    ups: number;
    body: string;
    replies?: {
      data: {
        children: RedditCommentData[];
      };
    };
  };
}

async function getRedditAccessToken(): Promise<string> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Reddit API credentials not configured');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'RedditChatAssistant/1.0.0',
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

export async function fetchReddit(query: string): Promise<RedditThread[]> {
  try {
    console.log(`Searching Reddit for: ${query}`);
    
    const accessToken = await getRedditAccessToken();
    const searchUrl = `https://oauth.reddit.com/search?q=${encodeURIComponent(query)}&sort=relevance&limit=5&type=link`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'RedditChatAssistant/1.0.0',
        'Accept': 'application/json',
      }
    });

    if (!searchResponse.ok) {
      console.error(`Reddit search failed: ${searchResponse.status}`);
      throw new Error(`Reddit search failed: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    console.log(`Found ${searchData.data?.children?.length || 0} posts`);
    const posts: RedditPost[] = searchData.data.children;

    const threads: RedditThread[] = [];

    for (const post of posts.slice(0, 5)) {
      try {
        const commentsUrl = `https://oauth.reddit.com${post.data.permalink}`;
        
        const commentsResponse = await fetch(commentsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': 'RedditChatAssistant/1.0.0',
            'Accept': 'application/json',
          }
        });

        if (!commentsResponse.ok) {
          continue;
        }

        const commentsData = await commentsResponse.json();
        
        if (Array.isArray(commentsData) && commentsData.length > 1) {
          const commentsList = commentsData[1].data.children;
          
          const topComments = commentsList
            .filter((comment: RedditCommentData) => 
              comment.data && 
              comment.data.author && 
              comment.data.author !== '[deleted]' &&
              comment.data.body &&
              comment.data.body !== '[deleted]' &&
              comment.data.body !== '[removed]'
            )
            .sort((a: RedditCommentData, b: RedditCommentData) => b.data.ups - a.data.ups)
            .slice(0, 3)
            .map((comment: RedditCommentData) => ({
              username: `u/${comment.data.author}`,
              upvotes: comment.data.ups,
              text: comment.data.body.length > 300 
                ? comment.data.body.substring(0, 300) + '...'
                : comment.data.body
            }));

          threads.push({
            thread_title: post.data.title,
            subreddit: post.data.subreddit_name_prefixed,
            url: `https://reddit.com${post.data.permalink}`,
            comments: topComments
          });
        }
      } catch (error) {
        console.error(`Error fetching comments for post ${post.data.id}:`, error);
        continue;
      }
    }

    return threads;

  } catch (error) {
    console.error('Error fetching Reddit data:', error);
    throw new Error('Failed to fetch Reddit data');
  }
}