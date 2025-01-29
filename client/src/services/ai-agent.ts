import { ChatOpenAI } from "@langchain/openai";
import { Langfuse } from "langfuse";
import { ChatMessage, HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { volunteerTools } from "./ai-tools";
import { createToolCallingAgent, AgentExecutor } from "langchain/agents";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { z } from "zod";

// Initialize Langfuse for tracing
const langfuse = new Langfuse({
  publicKey: import.meta.env.VITE_LANGFUSE_PUBLIC_API_KEY,
  secretKey: import.meta.env.VITE_LANGFUSE_API_KEY,
  baseUrl: import.meta.env.VITE_LANGFUSE_BASE_URL
});

// Initialize the OpenAI chat model
const model = new ChatOpenAI({
  openAIApiKey: import.meta.env.VITE_OPENAI_API_KEY,
  modelName: "gpt-4o-mini",
  temperature: 0.7,
});

const SYSTEM_PROMPT = `You are an AI assistant helping volunteers find and sign up for opportunities that match their interests and availability.

When responding:
1. Use natural conversation while being professional
2. Format responses clearly with sections and bullet points
3. ONLY use real data from the tools - never make up or hallucinate information
4. When asked about assignments, always:
   - Check current assignments using getUserAssignments
   - Check available opportunities using getAvailableOpportunities
   - Present both pieces of information to give a complete picture

Data Presentation Guidelines:
1. Use "### Your Current Assignments" and "### Available Opportunities" as section headers
2. For each assignment or opportunity:
   - Show the title in bold
   - Use the formattedTime.fullTimespan field for the complete date, time, and duration
   - Include the location
   - Show current/maximum volunteer count
   - Omit technical details (IDs, status codes, etc.)
3. If data is missing any fields, indicate "Not specified"
4. If there are no assignments or opportunities, clearly state this
5. Always offer to help find or sign up for opportunities when relevant

The formattedTime object contains:
- fullTimespan: Complete formatted string with date, time range, and duration
- startTime: Full start time with timezone
- endTime: End time with timezone
- durationText: Formatted duration string

Remember to fetch and verify all data before responding, and never assume or make up any information.`;

export interface AIResponse {
  content: string;
  error?: string;
}

export async function getAIResponse(userMessage: string, chatHistory: BaseMessage[], userId: string): Promise<AIResponse> {
  try {
    // Create a new trace
    const trace = langfuse.trace({
      id: `volunteer-chat-${Date.now()}`,
      metadata: { userMessage, userId }
    });

    // Create the prompt template
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", SYSTEM_PROMPT],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad")
    ]);

    // Create tools with bound userId
    const tools = [
      new DynamicStructuredTool({
        name: "getAvailableOpportunities",
        description: `Fetches available volunteer opportunities that users can sign up for. Returns an array of opportunities with:
- title: The name of the volunteer opportunity
- event_date: The date and time the event starts (ISO string)
- duration: Length of the event in minutes (use this to calculate end time)
- location: Where the event takes place
- current_volunteers: Current number of volunteers
- max_volunteers: Maximum number of volunteers needed
- team: Information about the team running the event

Calculate end time by adding duration (in minutes) to event_date.
Format times in a user-friendly way and show both duration and time span.`,
        schema: z.object({
          daysAhead: z.number().optional(),
          location: z.string().optional(),
          minDuration: z.number().optional(),
          maxDuration: z.number().optional(),
        }),
        func: async (args) => {
          const opportunities = await volunteerTools.getAvailableOpportunities(args);
          console.log('Raw opportunities data:', opportunities);
          return JSON.stringify(opportunities, null, 2);
        },
      }),
      new DynamicStructuredTool({
        name: "getUserAssignments",
        description: `Fetches the user's current volunteer assignments. Returns an array of assignments with:
- title: The name of the volunteer opportunity
- event_date: The date and time of the event
- location: Where the event takes place
- current_volunteers: Current number of volunteers
- max_volunteers: Maximum number of volunteers needed
- team: Information about the team running the event
When showing assignments, also check getAvailableOpportunities to show what users could sign up for.`,
        schema: z.object({}),
        func: async () => {
          const assignments = await volunteerTools.getUserAssignments(userId);
          console.log('Raw assignments data:', assignments);
          return JSON.stringify(assignments, null, 2);
        },
      }),
      new DynamicStructuredTool({
        name: "signUpForOpportunity",
        description: "Signs up the user for a specific opportunity",
        schema: z.object({
          ticketId: z.string(),
        }),
        func: async ({ ticketId }) => {
          const result = await volunteerTools.signUpForOpportunity(userId, ticketId);
          return JSON.stringify(result);
        },
      }),
    ];

    // Create the agent
    const agent = await createToolCallingAgent({
      llm: model,
      tools,
      prompt
    });

    // Create the executor
    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      verbose: true
    });

    // Generate response with tracing
    const generation = await trace.generation({
      name: "volunteer-assistant-response",
      input: { userMessage, chatHistory },
    });

    // Execute the agent with the user's message and chat history
    const result = await agentExecutor.invoke({
      input: userMessage,
      chat_history: chatHistory,
    });

    generation.end({
      output: result.output,
      metadata: { model: "gpt-4o-mini" }
    });

    return {
      content: result.output
    };

  } catch (error) {
    console.error("Error getting AI response:", error);
    return {
      content: "I apologize, but I encountered an error while processing your request. Please try again.",
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}

// Helper function to format chat history for the AI
export function formatChatHistory(messages: { role: string; content: string; }[]): BaseMessage[] {
  return messages.map(msg => {
    if (msg.role === 'user') {
      return new HumanMessage(msg.content);
    } else {
      return new AIMessage(msg.content);
    }
  });
} 