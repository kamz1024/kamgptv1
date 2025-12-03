/**
 * Kam GPT - Vision Enabled
 * * An updated chat application that supports Image Recognition.
 * The frontend is now embedded directly in this file for easier customization.
 */
import { Env } from "./types";

// We switch to the "Vision" model to support images
const MODEL_ID = "@cf/meta/llama-3.2-11b-vision-instruct";

const SYSTEM_PROMPT =
  "You are a helpful, friendly assistant named Kam GPT, developed by your founder who's named kam. You are here to become a AI copy of kam. Provide concise and cool responses, make jokes and have and engage the user with fun and brazen responses. nsfw and dirty jokes and swearing are all permitted. You can also see and describe images provided by the user.";

// -----------------------------------------------------------------------------
// FRONTEND HTML (Stored here so you can edit the UI easily)
// -----------------------------------------------------------------------------
const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kam GPT</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #111827; }
        ::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
        .typing-dot { animation: typing 1.4s infinite ease-in-out both; }
        .typing-dot:nth-child(1) { animation-delay: -0.32s; }
        .typing-dot:nth-child(2) { animation-delay: -0.16s; }
        @keyframes typing { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
    </style>
</head>
<body class="bg-gray-900 text-gray-100 h-screen flex flex-col font-sans">

    <!-- HEADER -->
    <header class="bg-gray-800 p-4 border-b border-gray-700 flex items-center justify-between shadow-lg">
        <div class="flex items-center gap-3">
            <div class="relative">
                <div class="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-lg">K</div>
                <div class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-gray-800 rounded-full"></div>
            </div>
            <div>
                <h1 class="text-xl font-bold tracking-wide text-white">Kam GPT</h1>
                <p class="text-xs text-gray-400">Powered by Cloudflare Vision</p>
            </div>
        </div>
    </header>

    <!-- CHAT CONTAINER -->
    <main id="chat-container" class="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
        <!-- Welcome Message -->
        <div class="flex gap-3">
            <div class="w-8 h-8 rounded-full bg-indigo-600 flex-shrink-0 flex items-center justify-center text-xs font-bold">K</div>
            <div class="bg-gray-800 p-3 rounded-2xl rounded-tl-none max-w-[85%] border border-gray-700 shadow-sm">
                <p class="text-sm leading-relaxed">Yo! I'm Kam GPT. I can see images now. Upload a pic or say something.</p>
            </div>
        </div>
    </main>

    <!-- INPUT AREA -->
    <footer class="p-4 bg-gray-800 border-t border-gray-700">
        <!-- Image Preview -->
        <div id="image-preview-container" class="hidden mb-2 relative inline-block">
             <img id="image-preview" class="h-16 w-16 object-cover rounded-lg border border-gray-600 opacity-80" />
             <button onclick="clearImage()" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600">×</button>
        </div>

        <form id="chat-form" class="relative max-w-4xl mx-auto flex gap-2 items-end">
            <!-- Hidden File Input -->
            <input type="file" id="image-input" accept="image/*" class="hidden" onchange="handleImageSelect()">
            
            <!-- Upload Button -->
            <button type="button" onclick="document.getElementById('image-input').click()" 
                class="p-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-gray-300 transition-all active:scale-95"
                title="Upload Image">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            </button>

            <textarea id="message-input" rows="1" 
                class="flex-1 bg-gray-900 border border-gray-600 rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none overflow-hidden"
                placeholder="Type a message..."
                oninput="this.style.height = 'auto'; this.style.height = (this.scrollHeight) + 'px'"></textarea>
            
            <button type="submit" id="send-btn"
                class="p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
            </button>
        </form>
    </footer>

    <script>
        const chatContainer = document.getElementById('chat-container');
        const chatForm = document.getElementById('chat-form');
        const messageInput = document.getElementById('message-input');
        const imageInput = document.getElementById('image-input');
        const imagePreviewContainer = document.getElementById('image-preview-container');
        const imagePreview = document.getElementById('image-preview');
        const sendBtn = document.getElementById('send-btn');

        let messageHistory = [];
        let currentBase64Image = null;

        function handleImageSelect() {
            const file = imageInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    currentBase64Image = e.target.result;
                    imagePreview.src = currentBase64Image;
                    imagePreviewContainer.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            }
        }

        function clearImage() {
            imageInput.value = '';
            currentBase64Image = null;
            imagePreviewContainer.classList.add('hidden');
        }

        function appendMessage(role, text, imageSrc = null) {
            const div = document.createElement('div');
            div.className = \`flex gap-3 \${role === 'user' ? 'justify-end' : ''}\`;
            
            let avatar = role === 'user' 
                ? '<div class="w-8 h-8 rounded-full bg-gray-600 flex-shrink-0 flex items-center justify-center text-xs">You</div>'
                : '<div class="w-8 h-8 rounded-full bg-indigo-600 flex-shrink-0 flex items-center justify-center text-xs font-bold">K</div>';

            let imageHtml = imageSrc ? \`<img src="\${imageSrc}" class="max-w-xs rounded-lg mb-2 border border-gray-600">\` : '';
            
            let bubbleClass = role === 'user' ? 'bg-indigo-600 rounded-tr-none' : 'bg-gray-800 border border-gray-700 rounded-tl-none';

            div.innerHTML = \`
                \${role === 'user' ? '' : avatar}
                <div class="\${bubbleClass} p-3 rounded-2xl max-w-[85%] shadow-md">
                    \${imageHtml}
                    <div class="text-sm whitespace-pre-wrap leading-relaxed">\${text}</div>
                </div>
                \${role === 'user' ? avatar : ''}
            \`;
            
            chatContainer.appendChild(div);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            return div;
        }

        function appendLoading() {
            const div = document.createElement('div');
            div.id = 'loading-indicator';
            div.className = 'flex gap-3';
            div.innerHTML = \`
                <div class="w-8 h-8 rounded-full bg-indigo-600 flex-shrink-0 flex items-center justify-center text-xs font-bold">K</div>
                <div class="bg-gray-800 p-4 rounded-2xl rounded-tl-none border border-gray-700 shadow-sm flex items-center gap-1">
                    <div class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
                    <div class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
                    <div class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
                </div>
            \`;
            chatContainer.appendChild(div);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function removeLoading() {
            const el = document.getElementById('loading-indicator');
            if (el) el.remove();
        }

        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = messageInput.value.trim();
            const imageToSend = currentBase64Image;

            if (!text && !imageToSend) return;

            // UI Updates
            appendMessage('user', text, imageToSend);
            messageInput.value = '';
            messageInput.style.height = 'auto';
            clearImage(); // Clear preview but keep imageToSend variable for payload
            
            sendBtn.disabled = true;
            appendLoading();

            try {
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        prompt: text,
                        image: imageToSend,
                        history: messageHistory 
                    })
                });

                if (!res.ok) throw new Error("Network response was not ok");

                const data = await res.json();
                removeLoading();
                appendMessage('assistant', data.response);

                // Update history
                messageHistory.push({ role: 'user', content: text }); // Note: We don't store heavy base64 in history for now to save tokens
                messageHistory.push({ role: 'assistant', content: data.response });

            } catch (error) {
                removeLoading();
                appendMessage('assistant', "Error: " + error.message);
                sendBtn.disabled = false;
            }
            
            sendBtn.disabled = false;
        });
    </script>
</body>
</html>
`;

// -----------------------------------------------------------------------------
// BACKEND WORKER LOGIC
// -----------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. Serve the frontend HTML
    if (url.pathname === "/" || url.pathname.endsWith("index.html")) {
      return new Response(html, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // 2. Handle API Chat Requests
    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChatRequest(request, env);
    }

    // 3. Fallback to Asset Fetcher (in case you have other files)
    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;


async function handleChatRequest(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as any;
    const { prompt, image, history = [] } = body;

    // Construct the messages array for Llama 3.2 Vision
    let newMessages = [];

    // Add System Prompt
    newMessages.push({ role: "system", content: SYSTEM_PROMPT });

    // Add previous history
    // We sanitize history to be text-only to save context window, 
    // unless you specifically want multi-turn image memory.
    history.forEach((msg: any) => {
        newMessages.push({ role: msg.role, content: msg.content });
    });

    // Construct the User's current message
    let userContent = [];
    
    // Add text if exists
    if (prompt) {
        userContent.push({ type: "text", text: prompt });
    }

    // Add image if exists (Must be Base64 data URL)
    if (image) {
        userContent.push({ 
            type: "image_url", 
            image_url: { url: image } 
        });
    }

    // If empty input
    if (userContent.length === 0) {
        return new Response(JSON.stringify({ response: "Please say something or upload an image." }), {
            headers: { "Content-Type": "application/json" }
        });
    }

    newMessages.push({ role: "user", content: userContent });

    // Run the AI Model
    const response = await env.AI.run(MODEL_ID, {
      messages: newMessages,
      max_tokens: 1024,
    });

    // Llama 3.2 Vision response format is slightly different usually, 
    // but Cloudflare standardizes it in 'response' object
    let replyText = "";
    if (typeof response === 'object' && response.response) {
        replyText = response.response;
    } else if (typeof response === 'string') {
        replyText = response;
    } else {
        replyText = JSON.stringify(response);
    }

    return new Response(JSON.stringify({ response: replyText }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Failed to process request: " + error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
