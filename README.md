# Fresher Help

**Live App:** https://fresher-help.vercel.app  
**Event:** Agentic AI Hackathon 2026 — University of Debrecen  
**Track:** Smart Campus & City Tech (also relevant to Autonomous Agents & Intelligent Systems)

**Fresher Help** is an AI campus and city assistant built for international students at the University of Debrecen. Arriving in Debrecen as a freshman comes with immediate everyday hurdles: understanding official Hungarian emails with strict deadlines, navigating DKV tram and bus routes between campuses, and finding essential local places such as halal shops or prayer spaces. We built this app to bring those practical answers and action steps into one place.

---

## Key Features

- **Hungarian Letter Translator & Autonomous Action Plan:** Paste an official Hungarian email (such as an Immigration Office / OIF notice or dormitory letter). The assistant translates it into plain English and uses structured function calling (`add_tasks`) to automatically extract deadlines and action items into a personal **My Action Plan** checklist saved in `localStorage`.
- **Voice Playback ("Listen" Button):** Powered by **ElevenLabs Text-to-Speech**, students can listen to translated letters and transit instructions out loud on the go, with automatic browser speech fallback.
- **Campus & DKV Transit Guidance:** Grounded in a curated local Debrecen dataset (`data/debrecen.json`) to provide accurate step-by-step tram and bus directions between the Main Building, Learning Center, Kassai Campus, and Böszörményi Campus.
- **Debrecen City & Campus Explorer:** Browse local **Shops** (with an **Any / Halal** filter), **Restaurants**, **Hotels**, **Mosque & Worship** spaces, and **University Campuses** with live embedded **Google Maps** previews.
- **Student Feedback Loop:** Built-in feedback modal that routes student suggestions directly to `fresher.help.debrecen@gmail.com`.

---

## Tools, APIs & AI Assistants Used

### Frameworks & Libraries
- **Next.js (App Router) & TypeScript** — frontend UI and serverless API endpoints (`/api/chat`, `/api/tts`, `/api/feedback`)
- **Tailwind CSS** — responsive interface styled in the University of Debrecen's forest-green and gold palette
- **Lucide React** — clean UI icons
- **OpenAI Node SDK** — structured tool-calling integration (`add_tasks`) with the LLM endpoint

### External APIs & Cloud Services
- **Groq API (`llama-3.1-8b-instant`)** — fast LLM inference and function calling to generate plain-text answers and extract deadlines
- **ElevenLabs API (`eleven_flash_v2_5`)** — natural text-to-speech audio playback for assistant responses
- **Google Maps Embed** — interactive location previews in the Debrecen directory
- **FormSubmit** — email forwarding for the student feedback modal
- **Vercel** — production hosting and continuous deployment from GitHub

### AI Assistants Used During Development
- **GitHub Copilot (VS Code Agent Mode)** — used to scaffold React components, wire API routes, and iterate on the UI
- **Gemini** — used for system architecture planning, prompt design, debugging API token limits, and structuring the local Debrecen knowledge base

---

## How to Run Locally

1. **Clone the repository**
   ```bash
   git clone [https://github.com/giukosimjonov-debug/Fresher-Help.git](https://github.com/giukosimjonov-debug/Fresher-Help.git)
   cd Fresher-Help
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**  
   Create a `.env.local` file in the root folder and add your API keys:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.
