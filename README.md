# LLM Chat Application Template

A simple, ready-to-deploy chat application template powered by Cloudflare Workers AI. This template provides a clean starting point for building AI chat applications with streaming responses.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/templates/tree/main/llm-chat-app-template)

<!-- dash-content-start -->

## Demo

This template demonstrates how to build an AI-powered chat interface using Cloudflare Workers AI with streaming responses. It features:

- Real-time streaming of AI responses using Server-Sent Events (SSE)
- Easy customization of models and system prompts
- Support for AI Gateway integration
- Polished, responsive UI that works on mobile and desktop
- Attach images, audio, text/code files, and documents directly from the composer

## Features

- 💬 Polished, responsive chat interface with a fresh, modern look
- ⚡ Server-Sent Events (SSE) for streaming responses
- 🧠 Powered by Cloudflare Workers AI LLMs, with automatic vision-model routing for images
- 🛠️ Built with TypeScript and Cloudflare Workers
- 📱 Mobile-friendly design
- 🔄 Maintains chat history on the client
- 🔎 Built-in Observability logging
- 📎 Attach images, audio clips, documents, and text/code files directly from the composer
<!-- dash-content-end -->

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- A Cloudflare account with Workers AI access

### Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/cloudflare/templates.git
   cd templates/llm-chat-app
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Generate Worker type definitions:
   ```bash
   npm run cf-typegen
   ```

### Development

Start a local development server:

```bash
npm run dev
```

This will start a local server at http://localhost:8787.

Note: Using Workers AI accesses your Cloudflare account even during local development, which will incur usage charges.

### Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

### Browser-only GitHub deployment

If you are working entirely from the GitHub website, merge or edit the files on your production branch and then connect the repository from the Cloudflare dashboard. Use the repository root as the project root, keep the Worker name aligned with `wrangler.jsonc`, and deploy with the existing `npm run deploy` script.

After deployment, test the generated `workers.dev` URL instead of opening `public/index.html` directly or using GitHub Pages. The chat UI depends on the Worker route at `/api/chat` and the Workers AI binding, so static hosting alone will not return assistant responses.

### Troubleshooting missing responses

If user messages appear but assistant responses do not, check the browser Network tab for the `/api/chat` request. A working response should return HTTP 200 with a `text/event-stream` response from the Worker. If you see a 404, the app is not being served by the Worker. If you see a 500, open the Worker logs in Cloudflare and confirm the Workers AI binding named `AI` is enabled for the deployed Worker.

### Monitor

View real-time logs associated with any deployed Worker:

```bash
npm wrangler tail
```

## Project Structure

```
/
├── public/             # Static assets
│   ├── index.html      # Chat UI HTML
│   ├── chat.js         # Original template frontend script
│   └── kamgpt-chat.js  # Enhanced KAMGPT frontend script
├── src/
│   ├── index.ts        # Main Worker entry point
│   └── types.ts        # TypeScript type definitions
├── test/               # Test files
├── wrangler.jsonc      # Cloudflare Worker configuration
├── tsconfig.json       # TypeScript configuration
└── README.md           # This documentation
```

## How It Works

### Backend

The backend is built with Cloudflare Workers and uses the Workers AI platform to generate responses. The main components are:

1. **API Endpoint** (`/api/chat`): Accepts POST requests with chat messages and streams responses
2. **Streaming**: Uses Server-Sent Events (SSE) for real-time streaming of AI responses
3. **Workers AI Binding**: Connects to Cloudflare's AI service via the Workers AI binding

### Frontend

The frontend is a simple HTML/CSS/JavaScript application that:

1. Presents a polished chat interface with suggested prompts
2. Supports text, image, audio, and document attachments from the composer or drag-and-drop
3. Sends user messages, attachment contents, and image/audio attachments to the API
4. Processes streaming responses in real-time
5. Maintains chat history on the client side

## Customization

### Changing the Model

To use a different AI model, update the `MODEL_ID` (text chat), `VISION_MODEL_ID` (image understanding), or `TRANSCRIPTION_MODEL_ID` (audio transcription) constants in `src/index.ts`. You can find available models in the [Cloudflare Workers AI documentation](https://developers.cloudflare.com/workers-ai/models/).

### Using AI Gateway

The template includes commented code for AI Gateway integration, which provides additional capabilities like rate limiting, caching, and analytics.

To enable AI Gateway:

1. [Create an AI Gateway](https://dash.cloudflare.com/?to=/:account/ai/ai-gateway) in your Cloudflare dashboard
2. Uncomment the gateway configuration in `src/index.ts`
3. Replace `YOUR_GATEWAY_ID` with your actual AI Gateway ID
4. Configure other gateway options as needed:
   - `skipCache`: Set to `true` to bypass gateway caching
   - `cacheTtl`: Set the cache time-to-live in seconds

Learn more about [AI Gateway](https://developers.cloudflare.com/ai-gateway/).

### Modifying the System Prompt

The default system prompt can be changed by updating the `SYSTEM_PROMPT` constant in `src/index.ts`.

### Styling

The UI styling is contained in the `<style>` section of `public/index.html`. You can modify the CSS variables at the top to quickly change the color scheme. The enhanced interface loads `public/kamgpt-chat.js`, leaving the original template `public/chat.js` available for easier conflict-free merges.

### Attachments

The frontend supports up to six attachments per message, across four kinds:

- **Text and code files** (`.txt`, `.md`, `.json`, `.py`, `.ts`, etc.) are read in the browser and inlined into the prompt as text, up to 750 KB each.
- **Images** (`.png`, `.jpg`, `.webp`, `.gif`, etc., up to 5 MB each) are downscaled in the browser (max 1120px, re-encoded as JPEG) and sent as an `image_url` content part. When a message includes an image, the backend automatically routes the request to the vision-capable model (`VISION_MODEL_ID`) and reshapes the conversation for it — the vision model rejects system-role messages alongside images and only handles a single image reliably, so the persona is folded into the first user turn and only the most recent image is kept.
- **Audio clips** (`.mp3`, `.wav`, `.m4a`, etc., up to 8 MB each) are transcribed server-side via `/api/transcribe` (using `TRANSCRIPTION_MODEL_ID`), and the transcript is folded into the prompt as text.
- **Documents** (`.pdf`, `.docx`, `.xlsx`, `.pptx`, `.zip`, etc., up to 5 MB each) are accepted, but their contents aren't extracted yet — only the filename and metadata are shared with the model, so ask the user to paste key excerpts if the content matters.

## Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare Workers AI Documentation](https://developers.cloudflare.com/workers-ai/)
- [Workers AI Models](https://developers.cloudflare.com/workers-ai/models/)
