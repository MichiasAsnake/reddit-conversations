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

export async function fetchReddit(query: string): Promise<RedditThread[]> {
  try {
    console.log(`Searching Reddit for: ${query}`);
    const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&limit=5&type=link`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'reddit-chat-assistant/1.0.0'
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
        const commentsUrl = `https://www.reddit.com${post.data.permalink}.json`;
        
        const commentsResponse = await fetch(commentsUrl, {
          headers: {
            'User-Agent': 'reddit-chat-assistant/1.0.0'
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