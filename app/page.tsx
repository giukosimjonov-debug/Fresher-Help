"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  Bus,
  Calendar,
  CheckCircle2,
  Circle,
  ClipboardList,
  ExternalLink,
  FileCheck,
  GraduationCap,
  Hotel,
  Languages,
  Landmark,
  Loader2,
  MapPin,
  MessageSquare,
  Send,
  ShoppingBag,
  Square,
  Trash2,
  Utensils,
  User,
  Volume2,
  X,
} from "lucide-react";
import debrecenData from "@/data/debrecen.json";

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

interface DirectoryPlace {
  name: string;
  subcategory?: string;
  address: string;
  description: string;
  mapsQuery: string;
}

type DirectoryCategory =
  | "shops"
  | "restaurants"
  | "hotels"
  | "mosque_and_worship"
  | "university_campuses";

const STORAGE_KEY = "fresher_help_tasks";

const HUNGARIAN_EMAIL =
  "Tisztelt Hallgató! Tájékoztatjuk, hogy a tartózkodási engedély meghosszabbítása iránti kérelméhez hiánypótlás szükséges. Kérjük, hogy 8 napon belül töltse fel az Enter Hungary felületére az érvényes kollégiumi szerződést és a hallgatói jogviszony igazolást. Határidő: 2026. november 29.";

const ROUTE_MESSAGE =
  "I am at Kassai Campus and need to reach the Learning Center in 25 minutes. Which DKV line should I take?";

const CHECKLIST_MESSAGE =
  "I am an international student at the University of Debrecen renewing my residence permit. Generate my step-by-step document checklist.";

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Welcome to Fresher Help. I am your University of Debrecen campus assistant. I can translate Hungarian official emails, plan DKV campus routes, and turn administration requirements into practical checklists.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [filter, setFilter] = useState<"All" | Category>("All");
  const [banner, setBanner] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [directoryCategory, setDirectoryCategory] =
    useState<DirectoryCategory>("shops");
  const [shopFilter, setShopFilter] = useState<"Any" | "Halal Shops">("Any");
  const directory = debrecenData.directory as Record<
    DirectoryCategory,
    DirectoryPlace[]
  >;
  const [selectedPlace, setSelectedPlace] = useState<DirectoryPlace | null>(
    directory.shops[0],
  );

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [audioStates, setAudioStates] = useState<
    Record<number, "loading" | "playing">
  >({});
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentObjectUrlRef = useRef<string | null>(null);
  const browserUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!banner) return;
    const timeout = window.setTimeout(() => setBanner(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [banner]);

  useEffect(() => {
    return () => {
      audioRequestRef.current?.abort();
      currentAudioRef.current?.pause();
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  const stopCurrentAudio = () => {
    audioRequestRef.current?.abort();
    audioRequestRef.current = null;
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    browserUtteranceRef.current = null;
    setAudioStates({});
  };

  const playBrowserSpeech = (messageIndex: number, text: string) => {
    if (!window.speechSynthesis) return;

    const utterance = new SpeechSynthesisUtterance(text);
    browserUtteranceRef.current = utterance;
    utterance.onend = () => {
      setAudioStates((previous) => {
        const next = { ...previous };
        delete next[messageIndex];
        return next;
      });
      browserUtteranceRef.current = null;
    };
    utterance.onerror = utterance.onend;
    window.speechSynthesis.speak(utterance);
    setAudioStates({ [messageIndex]: "playing" });
  };

  const handleListen = async (messageIndex: number, text: string) => {
    if (audioStates[messageIndex]) {
      stopCurrentAudio();
      return;
    }

    stopCurrentAudio();
    setAudioStates({ [messageIndex]: "loading" });
    const requestController = new AbortController();
    audioRequestRef.current = requestController;

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: requestController.signal,
      });

      if (!response.ok) throw new Error("ElevenLabs playback unavailable");
      if (!response.headers.get("content-type")?.includes("audio/mpeg")) {
        throw new Error("Invalid audio response");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl);
      currentObjectUrlRef.current = objectUrl;
      currentAudioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(objectUrl);
        if (currentObjectUrlRef.current === objectUrl) {
          currentObjectUrlRef.current = null;
          currentAudioRef.current = null;
        }
        setAudioStates((previous) => {
          const next = { ...previous };
          delete next[messageIndex];
          return next;
        });
      };
      audio.onerror = () => {
        stopCurrentAudio();
        playBrowserSpeech(messageIndex, text);
      };

      await audio.play();
      setAudioStates({ [messageIndex]: "playing" });
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }
      stopCurrentAudio();
      playBrowserSpeech(messageIndex, text);
    }
  };

  const sendMessage = async (textToSend?: string) => {
    const content = (textToSend ?? input).trim();
    if (!content || isLoading) return;

    setMessages((previous) => [
      ...previous,
      { role: "user", content },
    ]);
    if (!textToSend) setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
        cache: "no-store",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Server error (${res.status})`);
      }

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            data.reply ||
            data.message ||
            data.content ||
            "Done. Check your action plan.",
        },
      ]);

      if (Array.isArray(data.tasks) && data.tasks.length > 0) {
        const newTasks: TaskItem[] = data.tasks.map(
          (
            task: {
              title?: string;
              deadline?: string;
              category?: string;
            },
            index: number,
          ) => ({
            id: `${Date.now()}-${index}`,
            title: task.title || "Untitled task",
            deadline: task.deadline || "As soon as possible",
            category:
              task.category === "Transport" || task.category === "Academic"
                ? task.category
                : "Admin",
            completed: false,
          }),
        );

        setTasks((previous) => [...previous, ...newTasks]);
        setBanner(`+${newTasks.length} tasks added automatically by AI Agent`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to connect to /api/chat";
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: `Error: ${message}`,
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTask = (id: string) => {
    setTasks((previous) =>
      previous.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task,
      ),
    );
  };

  const deleteTask = (id: string) => {
    setTasks((previous) => previous.filter((task) => task.id !== id));
  };

  const clearCompleted = () => {
    setTasks((previous) => previous.filter((task) => !task.completed));
  };

  const filteredTasks =
    filter === "All" ? tasks : tasks.filter((task) => task.category === filter);
  const activeCount = tasks.filter((task) => !task.completed).length;
  const completedCount = tasks.filter((task) => task.completed).length;

  const fillHungarianLetter = () => {
    setInput(HUNGARIAN_EMAIL);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const submitFeedback = async () => {
    const message = feedbackMessage.trim();
    if (!message) {
      setFeedbackStatus("Please enter a feedback message.");
      return;
    }

    setFeedbackSending(true);
    setFeedbackStatus("");
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          email: feedbackEmail.trim(),
        }),
      });
    } finally {
      setFeedbackSending(false);
      setFeedbackStatus(
        "Feedback sent to fresher.help.debrecen@gmail.com!",
      );
      setFeedbackMessage("");
      setFeedbackEmail("");
    }
  };

  let directoryPlaces =
    directory[directoryCategory] ?? [];
  if (directoryCategory === "shops" && shopFilter === "Halal Shops") {
    directoryPlaces = directoryPlaces.filter(
      (place) => place.subcategory === "Halal",
    );
  }

  const selectDirectoryCategory = (category: DirectoryCategory) => {
    setDirectoryCategory(category);
    setShopFilter("Any");
    setSelectedPlace(directory[category][0] ?? null);
  };

  const selectShopFilter = (filterValue: "Any" | "Halal Shops") => {
    setShopFilter(filterValue);
    const nextPlaces =
      filterValue === "Halal Shops"
        ? directory.shops.filter((place) => place.subcategory === "Halal")
        : directory.shops;
    setSelectedPlace(nextPlaces[0] ?? null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="bg-white text-[11px] text-slate-600">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-end gap-5 px-4 sm:px-6">
          <a href="https://unideb.hu" target="_blank" rel="noreferrer" className="hover:text-[#154734]">
            Unideb.hu
          </a>
          <a href="https://neptun.unideb.hu" target="_blank" rel="noreferrer" className="hover:text-[#154734]">
            Neptun
          </a>
          <a href="https://dkv.hu" target="_blank" rel="noreferrer" className="hover:text-[#154734]">
            DKV Timetables
          </a>
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className="h-full px-2 font-bold text-[#154734] hover:underline"
          >
            Feedback
          </button>
          <button
            type="button"
            onClick={() => textareaRef.current?.focus()}
            className="h-full bg-[#F2B705] px-4 font-bold tracking-[0.12em] text-[#154734]"
          >
            ASK FRESHER HELP
          </button>
        </div>
      </div>

      <header className="bg-[#154734] text-white">
        <div className="mx-auto flex h-[92px] max-w-7xl items-stretch px-4 sm:px-6">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="-mt-1 flex min-w-[270px] items-center bg-white px-5 text-left text-[#154734] shadow-[0_8px_18px_rgba(0,0,0,0.12)]"
          >
            <div>
              <p className="text-xl font-black tracking-tight">FRESHER HELP</p>
              <p className="mt-1 text-[10px] font-bold tracking-[0.13em] text-slate-500">
                STUDENT ASSISTANT DEBRECEN
              </p>
            </div>
          </button>

          <nav className="ml-8 hidden items-stretch lg:flex">
            {["FOR APPLICANTS", "FOR CURRENT STUDENTS", "CAMPUS & CITY"].map(
              (item) => (
                <a
                  key={item}
                  href="#student-assistant"
                  className="flex items-center border-r border-white/10 px-5 text-[12px] font-bold tracking-[0.08em] hover:bg-white/10"
                >
                  {item}
                </a>
              ),
            )}
            <a
              href="#student-assistant"
              className="flex items-center bg-[#F2B705] px-5 text-[12px] font-black tracking-[0.08em] text-[#154734]"
            >
              FRESHMAN INFO
            </a>
          </nav>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.6fr] lg:py-14">
          <div className="flex flex-col justify-center">
            <p className="text-xs font-black tracking-[0.18em] text-[#154734]">
              FOR NEW STUDENTS
            </p>
            <div className="mt-3 h-1 w-16 bg-[#F2B705]" />
            <p className="mt-5 max-w-md text-sm leading-7 text-slate-600">
              Everything for a confident start at the University of Debrecen.
              Translate official letters, plan campus travel, and organize
              Hungarian administration in one place.
            </p>
            <button
              type="button"
              onClick={() => {
                document
                  .getElementById("student-assistant")
                  ?.scrollIntoView({ behavior: "smooth" });
                window.requestAnimationFrame(() => textareaRef.current?.focus());
              }}
              className="mt-7 flex w-fit items-center gap-3 bg-[#F2B705] px-5 py-3 text-xs font-black tracking-[0.12em] text-[#154734] shadow-sm"
            >
              START NOW
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={fillHungarianLetter}
              className="group flex min-h-44 flex-col justify-between border border-white/10 bg-[#154734] p-5 text-left text-white shadow-sm transition hover:-translate-y-1 hover:bg-[#103c2b]"
            >
              <Languages className="h-9 w-9 text-[#F2B705]" strokeWidth={1.8} />
              <span className="mt-8 flex items-end justify-between text-sm font-black tracking-[0.08em]">
                TRANSLATE A LETTER
                <ArrowRight className="h-4 w-4 text-[#F2B705] transition group-hover:translate-x-1" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => void sendMessage(ROUTE_MESSAGE)}
              disabled={isLoading}
              className="group flex min-h-44 flex-col justify-between border border-white/10 bg-[#154734] p-5 text-left text-white shadow-sm transition hover:-translate-y-1 hover:bg-[#103c2b] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Bus className="h-9 w-9 text-[#F2B705]" strokeWidth={1.8} />
              <span className="mt-8 flex items-end justify-between text-sm font-black tracking-[0.08em]">
                PLAN A DKV ROUTE
                <ArrowRight className="h-4 w-4 text-[#F2B705] transition group-hover:translate-x-1" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => void sendMessage(CHECKLIST_MESSAGE)}
              disabled={isLoading}
              className="group flex min-h-44 flex-col justify-between border border-white/10 bg-[#154734] p-5 text-left text-white shadow-sm transition hover:-translate-y-1 hover:bg-[#103c2b] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ClipboardList className="h-9 w-9 text-[#F2B705]" strokeWidth={1.8} />
              <span className="mt-8 flex items-end justify-between text-sm font-black tracking-[0.08em]">
                GET A CHECKLIST
                <ArrowRight className="h-4 w-4 text-[#F2B705] transition group-hover:translate-x-1" />
              </span>
            </button>
          </div>
        </div>
      </section>

      <main
        id="student-assistant"
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10"
      >
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-[11px] font-black tracking-[0.16em] text-[#154734]">
              STUDENT ASSISTANT
            </p>
            <div className="mt-2 h-1 w-12 bg-[#F2B705]" />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.35fr_0.85fr]">
          <section className="flex h-[620px] flex-col overflow-hidden border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,71,52,0.08)]">
            <div className="flex items-center justify-between bg-[#154734] px-5 py-4 text-white">
              <div>
                <h2 className="text-sm font-black tracking-[0.12em]">ASK FRESHER HELP</h2>
                <p className="mt-1 text-xs text-white/65">University & DKV expert</p>
              </div>
              <Bot className="h-6 w-6 text-[#F2B705]" />
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 p-4" aria-live="polite">
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-2.5 ${
                      message.role === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    <div
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                        message.role === "user"
                          ? "bg-[#154734] text-white"
                          : message.isError
                            ? "bg-red-100 text-red-700"
                            : "border border-slate-200 bg-white text-[#154734]"
                      }`}
                    >
                      {message.role === "user" ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                    <div
                      className={`max-w-[82%] whitespace-pre-wrap px-4 py-3 text-sm leading-6 ${
                        message.role === "user"
                          ? "rounded-2xl rounded-br-sm bg-[#154734] text-white"
                          : message.isError
                            ? "rounded-2xl rounded-bl-sm border border-red-200 bg-red-50 text-red-800"
                            : "rounded-2xl rounded-bl-sm border border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {message.content}
                      {message.role === "assistant" && (
                        <button
                          type="button"
                          onClick={() => void handleListen(index, message.content)}
                          className="mt-3 flex items-center gap-1.5 border border-[#154734]/20 bg-[#F2B705]/15 px-2 py-1 text-[11px] font-black tracking-[0.06em] text-[#154734] transition hover:border-[#F2B705] hover:bg-[#F2B705]/25"
                        >
                          {audioStates[index] === "loading" ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Loading audio...
                            </>
                          ) : audioStates[index] === "playing" ? (
                            <>
                              <Square className="h-3.5 w-3.5 fill-[#154734]" />
                              Stop
                            </>
                          ) : (
                            <>
                              <Volume2 className="h-3.5 w-3.5" />
                              Listen
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Bot className="h-5 w-5 text-[#154734]" />
                    Fresher Help is thinking...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap gap-2">
                <button type="button" onClick={fillHungarianLetter} className="quick-pill">
                  <Languages className="h-3.5 w-3.5" />
                  Translate Hungarian Letter
                </button>
                <button type="button" onClick={() => void sendMessage(ROUTE_MESSAGE)} disabled={isLoading} className="quick-pill disabled:opacity-50">
                  <MapPin className="h-3.5 w-3.5" />
                  Route to Learning Center
                </button>
                <button type="button" onClick={() => void sendMessage(CHECKLIST_MESSAGE)} disabled={isLoading} className="quick-pill disabled:opacity-50">
                  <FileCheck className="h-3.5 w-3.5" />
                  Visa Extension Checklist
                </button>
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendMessage();
                }}
                className="flex items-end gap-2 border-2 border-[#F2B705] bg-white p-2"
              >
                <textarea
                  ref={textareaRef}
                  rows={2}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing &&
                      input.trim() &&
                      !isLoading
                    ) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder="Ask about Debrecen campuses, DKV routes, or paste a Hungarian email..."
                  className="flex-1 resize-none border-0 px-2 py-1.5 text-sm text-slate-800 outline-none"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="flex h-11 items-center gap-2 bg-[#F2B705] px-4 text-xs font-black tracking-[0.12em] text-[#154734] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  SEND
                </button>
              </form>
            </div>
          </section>

          <aside className="flex h-[620px] flex-col overflow-hidden border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,71,52,0.08)]">
            <div className="flex items-center justify-between bg-[#154734] px-5 py-4 text-white">
              <div>
                <h2 className="text-sm font-black tracking-[0.12em]">MY ACTION PLAN</h2>
                <p className="mt-1 text-xs text-white/65">
                  {activeCount} active • {completedCount} completed
                </p>
              </div>
              {completedCount > 0 && (
                <button type="button" onClick={clearCompleted} className="text-xs font-bold text-[#F2B705] hover:underline">
                  Clear Completed
                </button>
              )}
            </div>

            {banner && (
              <div className="mx-4 mt-3 border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                {banner}
              </div>
            )}

            <div className="px-4 pt-3">
              <div className="grid grid-cols-4 border-b border-slate-200 text-xs font-bold">
                {(["All", "Admin", "Transport", "Academic"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilter(tab)}
                    className={`border-b-2 px-1 py-2 ${
                      filter === tab
                        ? "border-[#F2B705] text-[#154734]"
                        : "border-transparent text-slate-500"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {filteredTasks.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center border-2 border-dashed border-slate-200 text-center">
                  <Calendar className="mb-2 h-8 w-8 text-slate-300" />
                  <p className="text-sm font-bold text-slate-600">No tasks here yet</p>
                  <p className="mt-1 max-w-xs text-xs text-slate-400">
                    Ask Fresher Help for a checklist or paste an official email.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredTasks.map((task) => (
                    <article
                      key={task.id}
                      className={`flex items-start gap-3 border p-3.5 ${
                        task.completed
                          ? "border-slate-200 bg-slate-50 opacity-65"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <button type="button" onClick={() => toggleTask(task.id)} className="mt-0.5 text-[#154734]">
                        {task.completed ? (
                          <CheckCircle2 className="h-5 w-5 text-[#154734]" />
                        ) : (
                          <Circle className="h-5 w-5" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-bold ${task.completed ? "line-through text-slate-500" : "text-slate-800"}`}>
                          {task.title}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="bg-[#154734] px-2 py-0.5 text-[10px] font-bold text-white">
                            {task.category}
                          </span>
                          <span className="text-[11px] text-slate-500">Due: {task.deadline}</span>
                        </div>
                      </div>
                      <button type="button" onClick={() => deleteTask(task.id)} aria-label={`Delete ${task.title}`} className="text-slate-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      <section className="border-y border-slate-200 bg-white py-10" id="explore-debrecen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div>
            <p className="text-[11px] font-black tracking-[0.16em] text-[#154734]">
              EXPLORE DEBRECEN & CAMPUSES
            </p>
            <div className="mt-2 h-1 w-12 bg-[#F2B705]" />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              { key: "shops" as const, label: "Shops", icon: ShoppingBag },
              { key: "restaurants" as const, label: "Restaurants", icon: Utensils },
              { key: "hotels" as const, label: "Hotels", icon: Hotel },
              { key: "mosque_and_worship" as const, label: "Mosque & Monks", icon: Landmark },
              { key: "university_campuses" as const, label: "University Campuses", icon: GraduationCap },
            ].map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.key}
                  type="button"
                  onClick={() => selectDirectoryCategory(category.key)}
                  className={`flex items-center justify-center gap-2 border px-3 py-3 text-xs font-bold transition ${
                    directoryCategory === category.key
                      ? "border-[#F2B705] bg-[#154734] text-white"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-[#154734]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {category.label}
                </button>
              );
            })}
          </div>

          {directoryCategory === "shops" && (
            <div className="mt-3 flex gap-2">
              {(["Any", "Halal Shops"] as const).map((filterValue) => (
                <button
                  key={filterValue}
                  type="button"
                  onClick={() => selectShopFilter(filterValue)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                    shopFilter === filterValue
                      ? "border-[#F2B705] bg-[#154734] text-white"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {filterValue}
                </button>
              ))}
            </div>
          )}

          <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
              {directoryPlaces.map((place) => (
                <article
                  key={`${place.name}-${place.address}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedPlace(place)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedPlace(place);
                    }
                  }}
                  className={`cursor-pointer border p-4 transition ${
                    selectedPlace?.name === place.name
                      ? "border-[#F2B705] bg-[#154734]/[0.03]"
                      : "border-slate-200 bg-white hover:border-[#154734]"
                  }`}
                >
                  <h3 className="text-sm font-black text-[#154734]">{place.name}</h3>
                  <p className="mt-1 text-xs font-bold text-slate-500">{place.address}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{place.description}</p>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.mapsQuery)}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-black text-[#154734] hover:underline"
                  >
                    Open in Google Maps
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </article>
              ))}
            </div>

            <div className="min-h-[420px] overflow-hidden border-2 border-slate-200 bg-slate-100 lg:min-h-[560px]">
              {selectedPlace ? (
                <iframe
                  title={`Google Maps preview for ${selectedPlace.name}`}
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(selectedPlace.mapsQuery)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                  className="h-full min-h-[420px] w-full border-0 lg:min-h-[556px]"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="grid h-full min-h-[420px] place-items-center text-sm text-slate-500">
                  Select a place to view it on the map.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={() => setFeedbackOpen(true)}
        className="fixed right-0 top-1/2 z-40 -translate-y-1/2 rounded-l-lg bg-[#F2B705] px-2 py-4 text-[11px] font-black tracking-[0.12em] text-[#154734] shadow-lg [writing-mode:vertical-rl]"
      >
        Feedback
      </button>

      {feedbackOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setFeedbackOpen(false);
          }}
        >
          <div className="w-full max-w-md border-t-4 border-[#F2B705] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black tracking-[0.16em] text-[#154734]">
                  FRESHER HELP
                </p>
                <h2 id="feedback-title" className="mt-1 text-lg font-black text-slate-900">
                  Send Feedback
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackOpen(false)}
                aria-label="Close feedback modal"
                className="grid h-8 w-8 place-items-center text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {feedbackStatus && (
              <div
                className={`mt-4 border px-3 py-2 text-xs font-bold ${
                  feedbackStatus.startsWith("Feedback sent")
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                {feedbackStatus}
              </div>
            )}

            <label className="mt-4 block text-xs font-bold text-slate-700">
              Your feedback
              <textarea
                rows={5}
                value={feedbackMessage}
                onChange={(event) => setFeedbackMessage(event.target.value)}
                placeholder="Tell us how Fresher Help can improve..."
                className="mt-2 w-full resize-none border-2 border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-[#F2B705]"
              />
            </label>

            <label className="mt-3 block text-xs font-bold text-slate-700">
              Email (optional)
              <input
                type="email"
                value={feedbackEmail}
                onChange={(event) => setFeedbackEmail(event.target.value)}
                placeholder="you@example.com"
                className="mt-2 h-11 w-full border-2 border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-[#F2B705]"
              />
            </label>

            <button
              type="button"
              onClick={() => void submitFeedback()}
              disabled={feedbackSending}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 bg-[#154734] text-xs font-black tracking-[0.12em] text-white disabled:opacity-60"
            >
              <MessageSquare className="h-4 w-4 text-[#F2B705]" />
              {feedbackSending ? "SENDING..." : "Send Feedback"}
            </button>

            <a
              href="mailto:fresher.help.debrecen@gmail.com"
              className="mt-3 flex items-center justify-center gap-2 text-xs font-bold text-[#154734] hover:underline"
            >
              Open in Email App (mailto:fresher.help.debrecen@gmail.com)
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}

      <footer className="mt-10 bg-[#154734] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
          <div>
            <h3 className="text-sm font-black tracking-[0.12em] text-[#F2B705]">FRESHER HELP</h3>
            <p className="mt-3 max-w-xs text-xs leading-6 text-white/75">
              A smart campus assistant for new and international University of Debrecen students.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-black tracking-[0.12em] text-[#F2B705]">CAMPUS INFO</h3>
            <p className="mt-3 text-xs text-white/75">University of Debrecen</p>
            <p className="mt-1 text-xs text-white/75">Debrecen, Hungary</p>
          </div>
          <div>
            <h3 className="text-sm font-black tracking-[0.12em] text-[#F2B705]">QUICK LINKS</h3>
            <div className="mt-3 flex flex-col gap-2 text-xs text-white/75">
              <a href="https://unideb.hu" target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-[#F2B705]">
                University website <ExternalLink className="h-3 w-3" />
              </a>
              <a href="https://neptun.unideb.hu" target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-[#F2B705]">
                Neptun <ExternalLink className="h-3 w-3" />
              </a>
              <a href="https://dkv.hu" target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-[#F2B705]">
                DKV <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </footer>

      <style jsx>{`
        .quick-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          border: 1px solid #cbd5e1;
          border-radius: 9999px;
          background: #f8fafc;
          padding: 0.45rem 0.7rem;
          color: #475569;
          font-size: 0.72rem;
          font-weight: 700;
        }
        .quick-pill:hover {
          border-color: #154734;
          color: #154734;
        }
      `}</style>
    </div>
  );
}
