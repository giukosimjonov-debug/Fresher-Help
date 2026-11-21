"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Languages,
  MapPin,
  FileCheck,
  CheckCircle2,
  Circle,
  Trash2,
  Bot,
  User,
  Sparkles,
  Calendar,
} from "lucide-react";

type Category = "Admin" | "Transport" | "Academic";

interface TaskItem {
  id: string;
  title: string;
  deadline: string;
  category: Category;
  completed: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
}

const SAMPLE_HUNGARIAN_EMAIL =
  "Tisztelt Hallgató! Tájékoztatjuk, hogy a tartózkodási engedély meghosszabbítása iránti kérelméhez hiánypótlás szükséges. Kérjük, hogy 8 napon belül töltse fel az Enter Hungary felületére az érvényes kollégiumi szerződést és a hallgatói jogviszony igazolást. Határidő: 2026. november 29.";

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Welcome to Fresher Help! I'm your University of Debrecen campus assistant. I can translate Hungarian official emails, plan DKV routes across campus, and turn confusing requirements into practical admin checklists.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = window.localStorage.getItem("fresher_help_tasks");
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      window.localStorage.removeItem("fresher_help_tasks");
      return [];
    }
  });
  const [filter, setFilter] = useState<"All" | Category>("All");
  const [banner, setBanner] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    localStorage.setItem("fresher_help_tasks", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (textToSend?: string) => {
    const content = (textToSend ?? input).trim();
    if (!content || isLoading) return;

    const updatedMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content },
    ];
    setMessages(updatedMessages);
    if (!textToSend) setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          messages: updatedMessages,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Server error (${res.status})`);
      }

      const replyText =
        data.reply || data.message || data.content || "Done! Check your plan.";

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: replyText },
      ]);

      if (Array.isArray(data.tasks) && data.tasks.length > 0) {
        const newTasks: TaskItem[] = data.tasks.map(
          (t: { title?: string; deadline?: string; category?: string }, idx: number) => ({
            id: `${Date.now()}-${idx}`,
            title: t.title || "Untitled task",
            deadline: t.deadline || "As soon as possible",
            category:
              t.category === "Transport" || t.category === "Academic"
                ? t.category
                : "Admin",
            completed: false,
          })
        );
        setTasks((prev) => [...newTasks, ...prev]);
        setBanner(`+${newTasks.length} tasks added automatically by AI Agent`);
        setTimeout(() => setBanner(null), 4000);
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to connect to /api/chat";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${errorMsg}`,
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const clearCompleted = () => {
    setTasks((prev) => prev.filter((t) => !t.completed));
  };

  const filteredTasks =
    filter === "All" ? tasks : tasks.filter((t) => t.category === filter);

  const activeCount = tasks.filter((t) => !t.completed).length;
  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Fresher Help</h1>
            <p className="text-xs text-slate-500">
              University of Debrecen • Smart Campus Agent
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Agent Ready
        </span>
      </header>

      {/* Main Split Screen */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel: AI Chat */}
        <section className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[78vh]">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">AI Campus Assistant</h2>
              <p className="text-xs text-slate-500">University & DKV expert</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 ${
                  msg.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === "user"
                      ? "bg-slate-800 text-white"
                      : msg.isError
                      ? "bg-red-100 text-red-600"
                      : "bg-blue-600 text-white"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : msg.isError
                      ? "bg-red-50 text-red-800 border border-red-200"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-500 pl-11">
                <span className="animate-pulse">Fresher Help is thinking...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Actions & Input */}
          <div className="p-4 border-t border-slate-100 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setInput(SAMPLE_HUNGARIAN_EMAIL);
                  textareaRef.current?.focus();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 transition cursor-pointer"
              >
                <Languages className="w-3.5 h-3.5" />
                Translate Hungarian Letter
              </button>

              <button
                type="button"
                onClick={() =>
                  sendMessage(
                    "I am at Kassai Campus and need to reach the Learning Center in 25 minutes. Which DKV line should I take?"
                  )
                }
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 transition cursor-pointer disabled:opacity-50"
              >
                <MapPin className="w-3.5 h-3.5" />
                Route to Learning Center
              </button>

              <button
                type="button"
                onClick={() =>
                  sendMessage(
                    "I am an international student at the University of Debrecen renewing my residence permit. Generate my step-by-step document checklist."
                  )
                }
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 transition cursor-pointer disabled:opacity-50"
              >
                <FileCheck className="w-3.5 h-3.5" />
                Visa Extension Checklist
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex items-end gap-2 border border-slate-300 rounded-xl p-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 bg-white"
            >
              <textarea
                ref={textareaRef}
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask about Debrecen campuses, DKV routes, or paste a Hungarian email..."
                className="flex-1 resize-none border-0 focus:outline-none text-sm p-1.5 text-slate-800"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </section>

        {/* Right Panel: Live Action Plan */}
        <section className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[78vh]">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-sm">Live Student Action Plan</h2>
              <p className="text-xs text-slate-500">
                {activeCount} active • {completedCount} completed
              </p>
            </div>
            {completedCount > 0 && (
              <button
                type="button"
                onClick={clearCompleted}
                className="text-xs text-slate-500 hover:text-red-600 font-medium cursor-pointer"
              >
                Clear Completed
              </button>
            )}
          </div>

          {banner && (
            <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
              {banner}
            </div>
          )}

          {/* Filter Tabs */}
          <div className="px-5 pt-3">
            <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium">
              {(["All", "Admin", "Transport", "Academic"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className={`py-1.5 rounded-lg transition cursor-pointer ${
                    filter === tab
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Task List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
            {filteredTasks.length === 0 ? (
              <div className="h-full border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <Calendar className="w-8 h-8 mb-2 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">
                  No tasks here yet
                </p>
                <p className="text-xs mt-1">
                  Ask Fresher Help for a checklist or paste an official email.
                </p>
              </div>
            ) : (
              filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-3.5 rounded-xl border transition flex items-start gap-3 ${
                    task.completed
                      ? "bg-slate-50 border-slate-200 opacity-65"
                      : "bg-white border-slate-200 hover:border-blue-300"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleTask(task.id)}
                    className="mt-0.5 text-blue-600 cursor-pointer"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        task.completed ? "line-through text-slate-500" : ""
                      }`}
                    >
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700">
                        {task.category}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Due: {task.deadline}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteTask(task.id)}
                    className="text-slate-400 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
