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

export async function summarizeThread(threadData: ThreadData, userQuery?: string): Promise<SummarizedThread> {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const commentsText = threadData.comments
      .map(comment => `${comment.username} (${comment.upvotes} upvotes): ${comment.text}`)
      .join('\n\n');

    const prompt = `You are a Reddit content summarizer. Transform the following Reddit thread into a structured summary that directly addresses the user's specific query.

${userQuery ? `**User Query:** ${userQuery}` : ''}
**Thread Title:** ${threadData.thread_title}
**Subreddit:** ${threadData.subreddit}
**Top Comments:** ${commentsText}

Create a structured summary that:
1. **Directly relates to the user query** — frame everything so it’s useful for the person asking.
2. **Synthesize OP + top comments** — capture the situation described in the OP and the most upvoted or insightful replies, with most of the emphasis on the OP's context.
3. **Description should feel natural** — 2–4 sentences written in plain, conversational language. Avoid third-person phrases like “users share” or “people discuss.” Instead, present the context as if you’re retelling the OP to a friend.
4. **Categorize insights** using these emoji labels when appropriate:
   - "🤝 Consensus: ..." (widely agreed points)
   - "🔀 Contrarian: ..." (opposing viewpoints) 
   - "💡 Unique insight: ..." (novel or unexpected perspectives)

Return in this exact JSON format:
{
  "title": "Short engaging title (6-8 words max)",
  "description": "2–4 sentences retelling the OP's situation and main dynamics in natural language, with enough context to feel authentic.",
  "summary": [
    "🤝 Consensus: Point that ties to user query...",
    "🔀 Contrarian: Point with opposing view...",
    "💡 Unique insight: Novel perspective (max 3 total)..."
  ]
}

Focus on actionable insights and concrete answers${userQuery ? ' to the user\'s query' : ''}. Keep bullets concise but substantive. Only return the JSON object, nothing else.`;

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