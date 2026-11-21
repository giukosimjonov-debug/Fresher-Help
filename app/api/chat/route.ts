import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY topilmadi. .env.local faylini tekshiring." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const userMessage: string = body.message || "";

    let knowledgeBase = "{}";
    try {
      const filePath = path.join(process.cwd(), "data", "debrecen.json");
      knowledgeBase = fs.readFileSync(filePath, "utf-8");
    } catch {
      knowledgeBase = "University of Debrecen & DKV transit assistant.";
    }

    const client = new OpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey,
      timeout: 12000,
      maxRetries: 1,
    });

    // Akkauntdagi faol modellarni avtomatik aniqlash
    let selectedModel = "llama-3.1-8b-instant";
    try {
      const modelsPage = await client.models.list();
      const chatModels = modelsPage.data
        .map((m) => m.id)
        .filter(
          (id) =>
            !/whisper|tts|guard|orpheus|playai|embed/i.test(id)
        );

      const preferred =
        chatModels.find((id) => /70b|120b|32b/i.test(id)) ||
        chatModels.find((id) => /llama|qwen|gpt|gemma/i.test(id)) ||
        chatModels[0];

      if (preferred) {
        selectedModel = preferred;
      }
    } catch {
      // Fallback model ishlatiladi
    }

    const response = await client.chat.completions.create({
      model: selectedModel,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `You are "Fresher Help", a friendly and accurate AI campus assistant for University of Debrecen students.
Use this local Debrecen knowledge base for accurate facts:
${knowledgeBase}

Rules:
1. When the user pastes a Hungarian email/letter, asks for a document checklist, or asks for an action plan, ALWAYS call the "add_tasks" tool to extract concrete actionable tasks AND provide a clear English translation/explanation in "reply_message".
2. For general questions (like DKV tram/bus routes), answer clearly and concisely.`,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "add_tasks",
            description:
              "Create actionable student tasks/checklists and provide the full explanation message.",
            parameters: {
              type: "object",
              properties: {
                reply_message: {
                  type: "string",
                  description:
                    "Clear, helpful English translation and explanation for the student.",
                },
                tasks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      deadline: { type: "string" },
                      category: {
                        type: "string",
                        enum: ["Admin", "Transport", "Academic"],
                      },
                    },
                    required: ["title", "deadline", "category"],
                  },
                },
              },
              required: ["reply_message", "tasks"],
            },
          },
        },
      ],
      tool_choice: "auto",
    });

    const choice = response.choices[0]?.message;
    const toolCall = choice?.tool_calls?.[0];

    if (toolCall && "function" in toolCall) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return NextResponse.json({
        reply:
          parsed.reply_message ||
          choice?.content ||
          "Tasks added to your Live Student Action Plan!",
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      });
    }

    return NextResponse.json({
      reply: choice?.content || "How can I help you in Debrecen today?",
      tasks: [],
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown backend error";
    console.error("Chat API Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
