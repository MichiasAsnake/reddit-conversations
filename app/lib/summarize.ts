import OpenAI from 'openai';

interface ThreadData {
  thread_title: string;
  subreddit: string;
  url: string;
  comments: {
    username: string;
    upvotes: number;
    text: string;
  }[];
}

interface SummarizedThread {
  summary: string[];
  full_text: string;
  title: string;
  description: string;
  metadata: {
    username: string;
    subreddit: string;
    upvotes: number;
    url: string;
  };
}

export async function summarizeThread(threadData: ThreadData): Promise<SummarizedThread> {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const commentsText = threadData.comments
      .map(comment => `${comment.username} (${comment.upvotes} upvotes): ${comment.text}`)
      .join('\n\n');

    const prompt = `You are helping to summarize Reddit discussions. Given the following Reddit thread and its top comments, create a short title (max 6-8 words), a brief description of what the post is about, and 2-3 concise bullet points that capture the key insights, advice, or consensus from the discussion.

Thread Title: ${threadData.thread_title}
Subreddit: ${threadData.subreddit}

Top Comments:
${commentsText}

Please provide:
1. A short, engaging title (max 6-8 words) that captures the essence of the discussion
2. A brief description (1-2 sentences) explaining what the post is about
3. Exactly 2-3 bullet points that summarize the main takeaways

Format your response as a JSON object like this:
{
  "title": "Short engaging title here",
  "description": "Brief description of what this post discusses",
  "summary": ["First key insight", "Second key insight", "Third key insight (if applicable)"]
}

Only return the JSON object, nothing else.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    let parsedResponse: { title: string; description: string; summary: string[] };
    try {
      parsedResponse = JSON.parse(content);
      if (!parsedResponse.title || !parsedResponse.description || !Array.isArray(parsedResponse.summary)) {
        throw new Error('Invalid response format');
      }
    } catch {
      parsedResponse = {
        title: threadData.thread_title.length > 40 ? threadData.thread_title.substring(0, 40) + '...' : threadData.thread_title,
        description: "Discussion available in comments",
        summary: ["Discussion available in comments"]
      };
    }

    const topComment = threadData.comments[0];

    return {
      summary: parsedResponse.summary,
      full_text: commentsText || 'No comments available',
      title: parsedResponse.title,
      description: parsedResponse.description,
      metadata: {
        username: topComment?.username || 'u/unknown',
        subreddit: threadData.subreddit,
        upvotes: topComment?.upvotes || 0,
        url: threadData.url
      }
    };

  } catch (error) {
    console.error('Error summarizing thread:', error);
    
    const topComment = threadData.comments[0];
    const commentsText = threadData.comments
      .map(comment => `${comment.username} (${comment.upvotes} upvotes): ${comment.text}`)
      .join('\n\n');

    return {
      summary: ["AI summarization unavailable - view full discussion below"],
      full_text: commentsText || 'No comments available',
      title: threadData.thread_title.length > 40 ? threadData.thread_title.substring(0, 40) + '...' : threadData.thread_title,
      description: "AI summarization unavailable - view full discussion below",
      metadata: {
        username: topComment?.username || 'u/unknown',
        subreddit: threadData.subreddit,
        upvotes: topComment?.upvotes || 0,
        url: threadData.url
      }
    };
  }
}