interface RedditThread {
  thread_title: string;
  subreddit: string;
  url: string;
  author: string;
  score: number;
  comments: RedditComment[];
}

interface RedditComment {
  username: string;
  upvotes: number;
  text: string;
}

interface RelevantRedditPost {
  title: string;
  description: string;
  subreddit: string;
  url: string;
  comments: string[];
}

interface RedditPost {
  data: {
    title: string;
    subreddit_name_prefixed: string;
    permalink: string;
    id: string;
    ups: number;
    selftext?: string;
    subreddit: string;
    score: number;
    author?: string;
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

async function rerankWithOpenAI(query: string, posts: any[]): Promise<RedditThread[]> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const candidates = posts.map((post, index) => ({
    index,
    title: post.data.title,
    snippet: post.data.selftext ? post.data.selftext.substring(0, 200) + '...' : 'No description available',
    subreddit: post.data.subreddit,
    permalink: post.data.permalink,
    author: post.data.author || 'unknown',
    score: post.data.score || post.data.ups || 0,
    comments: post.comments || []
  }));

  const prompt = `You are a reranker. The user query is: "${query}".
Below are Reddit posts (title + snippet). Score each between 0 and 1 for relevance.
Return the indices of the top 5 most relevant posts in order.

Posts:
${candidates.map((c, i) => `${i}. Title: ${c.title}\nSnippet: ${c.snippet}\nSubreddit: r/${c.subreddit}\n`).join('\n')}

Return only a JSON array of indices, like: [2, 0, 4, 1, 3]`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const rerankedText = data.choices[0].message.content;
  
  try {
    const indices = JSON.parse(rerankedText);
    if (!Array.isArray(indices)) {
      throw new Error('Invalid response format');
    }
    
    return indices.slice(0, 5).map((index: number) => {
      const candidate = candidates[index];
      if (!candidate) return null;
      
      return {
        thread_title: candidate.title,
        subreddit: `r/${candidate.subreddit}`,
        url: `https://reddit.com${candidate.permalink}`,
        author: candidate.author,
        score: candidate.score,
        comments: candidate.comments
      };
    }).filter(Boolean);
  } catch (error) {
    console.error('Failed to parse OpenAI response:', rerankedText);
    return candidates.slice(0, 5).map(c => ({
      thread_title: c.title,
      subreddit: `r/${c.subreddit}`,
      url: `https://reddit.com${c.permalink}`,
      author: c.author,
      score: c.score,
      comments: c.comments
    }));
  }
}

export async function fetchRelevantRedditPosts(query: string): Promise<RedditThread[]> {
  try {
    console.log(`Searching Reddit for relevant posts: ${query}`);
    
    const accessToken = await getRedditAccessToken();
    const searchUrl = `https://oauth.reddit.com/search?q=${encodeURIComponent(query)}&sort=relevance&t=all&limit=15&type=link`;
    
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
    const posts: RedditPost[] = searchData.data.children;
    
    if (!posts || posts.length === 0) {
      console.log('No posts found for query');
      return [];
    }

    console.log(`Found ${posts.length} posts, fetching comments...`);

    const postsWithComments = await Promise.all(
      posts.map(async (post) => {
        try {
          const commentsUrl = `https://oauth.reddit.com${post.data.permalink}`;
          const commentsResponse = await fetch(commentsUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'User-Agent': 'RedditChatAssistant/1.0.0',
              'Accept': 'application/json',
            }
          });

          let comments: RedditComment[] = [];
          if (commentsResponse.ok) {
            const commentsData = await commentsResponse.json();
            if (Array.isArray(commentsData) && commentsData.length > 1) {
              const commentsList = commentsData[1].data.children;
              comments = commentsList
                .filter((comment: RedditCommentData) => 
                  comment.data && 
                  comment.data.author && 
                  comment.data.author !== '[deleted]' &&
                  comment.data.body &&
                  comment.data.body !== '[deleted]' &&
                  comment.data.body !== '[removed]'
                )
                .slice(0, 3)
                .map((comment: RedditCommentData) => ({
                  username: `u/${comment.data.author}`,
                  upvotes: comment.data.ups || 0,
                  text: comment.data.body.length > 300 
                    ? comment.data.body.substring(0, 300) + '...'
                    : comment.data.body
                }));
            }
          }

          return { ...post, comments };
        } catch (error) {
          console.error(`Error fetching comments for post ${post.data.id}:`, error);
          return { ...post, comments: [] };
        }
      })
    );

    console.log('Reranking posts with OpenAI...');
    const rerankedPosts = await rerankWithOpenAI(query, postsWithComments);
    
    console.log(`Returning ${rerankedPosts.length} relevant posts`);
    return rerankedPosts;

  } catch (error) {
    console.error('Error fetching relevant Reddit posts:', error);
    throw new Error('Failed to fetch relevant Reddit posts');
  }
}

export async function fetchReddit(query: string): Promise<RedditThread[]> {
  try {
    return await fetchRelevantRedditPosts(query);
  } catch (error) {
    console.error('Error fetching Reddit data:', error);
    throw new Error('Failed to fetch Reddit data');
  }
}