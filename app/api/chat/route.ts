import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

type TaskCategory = "Admin" | "Transport" | "Academic";

interface ExtractedTask {
  title: string;
  deadline: string;
  category: TaskCategory;
}

interface ChatRequest {
  message?: string;
  messages?: Array<{
    role?: string;
    content?: string;
  }>;
}

const addTasksTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "add_tasks",
    description:
      "Extract concrete, actionable tasks from a Hungarian official email, document checklist, or action-plan request.",
    parameters: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          description: "Concrete next actions for the student.",
          items: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "A short, specific action the student should take.",
              },
              deadline: {
                type: "string",
                description:
                  "The relevant deadline, if stated; otherwise a useful reminder such as 'ASAP' or 'Before expiry'.",
              },
              category: {
                type: "string",
                enum: ["Admin", "Transport", "Academic"],
              },
            },
            required: ["title", "deadline", "category"],
            additionalProperties: false,
          },
        },
      },
      required: ["tasks"],
      additionalProperties: false,
    },
  },
};

function isTaskCategory(value: unknown): value is TaskCategory {
  return value === "Admin" || value === "Transport" || value === "Academic";
}

function normalizeTasks(value: unknown): ExtractedTask[] {
  if (!value || typeof value !== "object") return [];

  const tasks = (value as { tasks?: unknown }).tasks;
  if (!Array.isArray(tasks)) return [];

  return tasks.flatMap((task) => {
    if (!task || typeof task !== "object") return [];

    const candidate = task as Record<string, unknown>;
    if (
      typeof candidate.title !== "string" ||
      typeof candidate.deadline !== "string" ||
      !isTaskCategory(candidate.category)
    ) {
      return [];
    }

    return [
      {
        title: candidate.title.trim(),
        deadline: candidate.deadline.trim(),
        category: candidate.category,
      },
    ].filter((item) => item.title.length > 0);
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequest;

    const conversation: ChatCompletionMessageParam[] =
      body.messages?.length
        ? body.messages
            .filter(
              (item) =>
                (item.role === "user" || item.role === "assistant") &&
                typeof item.content === "string",
            )
            .map((item) => ({
              role: item.role as "user" | "assistant",
              content: item.content as string,
            }))
        : typeof body.message === "string"
          ? [{ role: "user", content: body.message }]
          : [];

    if (conversation.length === 0) {
      return Response.json(
        { reply: "Please enter a question or paste an official email.", tasks: [] },
        { status: 400 },
      );
    }

    if (!process.env.GITHUB_TOKEN) {
      return Response.json(
        {
          reply: "Fresher Help is not configured yet: GITHUB_TOKEN is missing.",
          tasks: [],
        },
        { status: 500 },
      );
    }

    const localKnowledge = await fs.readFile(
      path.join(process.cwd(), "data", "debrecen.json"),
      "utf8",
    );

    const client = new OpenAI({
      baseURL: "https://models.inference.ai.azure.com",
      apiKey: process.env.GITHUB_TOKEN,
    });

    const systemPrompt = `You are Fresher Help, a friendly and accurate local expert assistant for new and international students at the University of Debrecen.

Use the following local knowledge as your factual source for University of Debrecen and Debrecen information:
${localKnowledge}

Rules:
- Give clear, practical, helpful explanations.
- Distinguish verified facts from items the student should confirm on an official current source.
- For Hungarian official emails, document checklist requests, or action-plan requests, you MUST call the add_tasks tool to extract concrete actionable steps, even if the email or checklist is incomplete.
- After calling add_tasks, explain the next steps clearly and mention deadlines or missing documents accurately.
- Use deadlines from the source when available. If no reliable deadline is given, use "No specific deadline provided" or "Before expiry".
- Return only the final natural-language reply as the chat completion; do not include JSON in your reply.`;

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...conversation,
    ];

    const firstCompletion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools: [addTasksTool],
      tool_choice: "auto",
      temperature: 0.2,
    });

    const assistantMessage = firstCompletion.choices[0]?.message;
    let tasks: ExtractedTask[] = [];
    let reply = assistantMessage?.content?.trim() ?? "";

    if (assistantMessage?.tool_calls?.length) {
      messages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== "function" || toolCall.function.name !== "add_tasks") {
          continue;
        }

        let parsedArguments: unknown;
        try {
          parsedArguments = JSON.parse(toolCall.function.arguments);
        } catch {
          parsedArguments = null;
        }

        const extractedTasks = normalizeTasks(parsedArguments);
        tasks = tasks.concat(extractedTasks);

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ tasks: extractedTasks }),
        });
      }

      if (tasks.length > 0 || assistantMessage.tool_calls.length > 0) {
        const finalCompletion = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages,
          temperature: 0.2,
        });

        reply =
          finalCompletion.choices[0]?.message?.content?.trim() ??
          "I extracted the requested action items.";
      }
    }

    if (!reply) {
      reply = "I could not generate a response. Please try rephrasing your question.";
    }

    return Response.json({ reply, tasks });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected chat error occurred.";

    return Response.json(
      { reply: `Fresher Help could not complete your request: ${message}`, tasks: [] },
      { status: 500 },
    );
  }
}
