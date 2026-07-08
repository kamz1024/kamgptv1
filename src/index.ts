/**
 * LLM Chat Application Template
 *
 * A simple chat application using Cloudflare Workers AI.
 * This template demonstrates how to implement an LLM-powered chat interface with
 * streaming responses using Server-Sent Events (SSE).
 *
 * @license MIT
 */
import { Env, ChatMessage } from "./types";

// Model IDs for Workers AI models
// https://developers.cloudflare.com/workers-ai/models/
const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const VISION_MODEL_ID = "@cf/meta/llama-3.2-11b-vision-instruct";
const TRANSCRIPTION_MODEL_ID = "@cf/openai/whisper-large-v3-turbo";

// Largest base64 audio payload accepted by /api/transcribe (roughly 8MB of audio).
const MAX_AUDIO_BASE64_LENGTH = 11_000_000;

// Default system prompt
const SYSTEM_PROMPT =
	"You are Kam GPT — Kam's AI counterpart, built by your founder Kam to capture how he thinks and talks: sharp, confident, and genuinely useful. Speak with personality, never boilerplate. Lead with the answer, keep responses concise and well-reasoned, and make them easy to act on. Humor is part of the brand — a well-placed joke or a bit of playful energy is welcome — but substance always comes first, and the bit never gets in the way of the help. Stay engaged and personable while staying on topic, and respect the user's time. When you're handed a task, see it through properly. When a message includes an image, an audio transcript, or a file's contents, treat it as a first-class part of the conversation and reason about it directly.";

/**
 * Returns true if any message in the conversation includes image content,
 * which means the request must be routed to the vision-capable model.
 */
function conversationHasImage(messages: ChatMessage[]): boolean {
	return messages.some(
		(message) =>
			Array.isArray(message.content) &&
			message.content.some((part) => part.type === "image_url"),
	);
}

export default {
	/**
	 * Main request handler for the Worker
	 */
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Handle static assets (frontend)
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		// API Routes
		if (url.pathname === "/api/chat") {
			// Handle POST requests for chat
			if (request.method === "POST") {
				return handleChatRequest(request, env);
			}

			// Method not allowed for other request types
			return new Response("Method not allowed", { status: 405 });
		}

		if (url.pathname === "/api/transcribe") {
			if (request.method === "POST") {
				return handleTranscribeRequest(request, env);
			}

			return new Response("Method not allowed", { status: 405 });
		}

		// Handle 404 for unmatched routes
		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

/**
 * Handles chat API requests
 */
async function handleChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		// Parse JSON request body
		const { messages = [] } = (await request.json()) as {
			messages: ChatMessage[];
		};

		// Add system prompt if not present
		if (!messages.some((msg) => msg.role === "system")) {
			messages.unshift({ role: "system", content: SYSTEM_PROMPT });
		}

		// Messages that include an attached image need the vision-capable model.
		const modelId = conversationHasImage(messages) ? VISION_MODEL_ID : MODEL_ID;

		const response = await env.AI.run(
			modelId,
			{
				messages,
				max_tokens: 1024,
				stream: true,
			},
			{
				returnRawResponse: true,
				// Uncomment to use AI Gateway
				// gateway: {
				//   id: "YOUR_GATEWAY_ID", // Replace with your AI Gateway ID
				//   skipCache: false,      // Set to true to bypass cache
				//   cacheTtl: 3600,        // Cache time-to-live in seconds
				// },
			},
		);

		// Return streaming response
		const headers = new Headers(response.headers);
		headers.set("content-type", "text/event-stream; charset=utf-8");
		headers.set("cache-control", "no-cache");

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	} catch (error) {
		console.error("Error processing chat request:", error);
		return new Response(
			JSON.stringify({ error: "Failed to process request" }),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			},
		);
	}
}

/**
 * Handles audio attachment transcription requests. Accepts a base64-encoded
 * audio clip and returns the transcribed text so it can be folded into a
 * chat message as an attachment.
 */
async function handleTranscribeRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const { audio } = (await request.json()) as { audio?: string };

		if (!audio || typeof audio !== "string") {
			return new Response(
				JSON.stringify({ error: "Missing audio data" }),
				{ status: 400, headers: { "content-type": "application/json" } },
			);
		}

		if (audio.length > MAX_AUDIO_BASE64_LENGTH) {
			return new Response(
				JSON.stringify({ error: "Audio file is too large to transcribe" }),
				{ status: 413, headers: { "content-type": "application/json" } },
			);
		}

		const result = await env.AI.run(TRANSCRIPTION_MODEL_ID, {
			audio,
			task: "transcribe",
		});

		return new Response(JSON.stringify({ text: result.text ?? "" }), {
			headers: { "content-type": "application/json" },
		});
	} catch (error) {
		console.error("Error processing transcription request:", error);
		return new Response(
			JSON.stringify({ error: "Failed to transcribe audio" }),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			},
		);
	}
}
