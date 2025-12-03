/**
 * LLM Chat Application Template - Vision Enabled
 *
 * Updated to support Image Recognition using Llama 3.2 Vision.
 */
import { Env } from "./types";

// We MUST use a Vision model to process images. 
// Llama 3.3 is text-only, so we switch to Llama 3.2 11B Vision.
const MODEL_ID = "@cf/meta/llama-3.2-11b-vision-instruct";

// Default system prompt
const SYSTEM_PROMPT =
	"You are a helpful, friendly assistant named Kam GPT, developed by your founder who's named kam, you are here to become a AI copy of kam, Provide concise and cool responses, make jokes and have and engage the user with fun and brazen responses. nsfw and dirty jokes and swearing are all permitted. You can also see and describe images provided by the user.";

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
		// This serves your index.html
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
		// 1. Parse the new JSON body format from index.html
		// The frontend now sends: { prompt: "text", image: "base64...", history: [...] }
		const body = (await request.json()) as any;
		const { prompt, image, history = [] } = body;

		let messages = [];

		// 2. Add system prompt
		messages.push({ role: "system", content: SYSTEM_PROMPT });

		// 3. Add History
		// We pass the previous text history to keep context
		if (Array.isArray(history)) {
			history.forEach((msg: any) => {
				messages.push({ role: msg.role, content: msg.content });
			});
		}

		// 4. Construct the Current Message
		// Vision models require a specific array structure for mixed text/image content
		let userContent = [];

		// Add text if it exists
		if (prompt) {
			userContent.push({ type: "text", text: prompt });
		}

		// Add image if it exists (must be base64 string)
		if (image) {
			userContent.push({
				type: "image_url",
				image_url: { url: image },
			});
		}

		// If the user sent nothing, return an error
		if (userContent.length === 0) {
			return new Response(
				JSON.stringify({ response: "Please say something or upload an image." }),
				{ headers: { "content-type": "application/json" } }
			);
		}

		// Push the combined user message
		messages.push({ role: "user", content: userContent });

		// 5. Run the Vision AI Model
		// Note: We use standard response (not streaming) to match your index.html's `await response.json()`
		const response = await env.AI.run(MODEL_ID, {
			messages,
			max_tokens: 1024,
		});

		// 6. Return Response
		// Cloudflare Workers AI usually returns an object like { response: "Hello..." }
		return new Response(JSON.stringify(response), {
			headers: { "content-type": "application/json" },
		});

	} catch (error) {
		console.error("Error processing chat request:", error);
		return new Response(
			JSON.stringify({ error: "Failed to process request: " + (error as Error).message }),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			},
		);
	}
}
