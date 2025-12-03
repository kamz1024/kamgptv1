/**
 * LLM Chat Application Template - Vision Enabled
 *
 * Updated to support Image Recognition using Llama 3.2 Vision.
 */
import { Env } from "./types";

// Llama 3.2 11B Vision Instruct
const MODEL_ID = "@cf/meta/llama-3.2-11b-vision-instruct";

// Default system prompt
const SYSTEM_PROMPT =
	"You are a helpful, friendly assistant named Kam GPT, developed by your founder who's named kam. Provide concise and cool responses, make jokes and engage the user. You can also see and describe images provided by the user.";

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Serve static assets (frontend)
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		// API Routes
		if (url.pathname === "/api/chat" && request.method === "POST") {
			return handleChatRequest(request, env);
		}

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
		const body = (await request.json()) as any;
		const { prompt, image, history = [] } = body;

		let messages = [];

		// 1. Add system prompt
		messages.push({ role: "system", content: SYSTEM_PROMPT });

		// 2. Add History (Sanitized)
		// CRITICAL FIX: We must NOT send the huge Base64 image back in the history 
		// for every subsequent request, or we will hit token/size limits immediately.
		if (Array.isArray(history)) {
			history.forEach((msg: any) => {
				// If the message content was an array (meaning it had an image + text)
				if (Array.isArray(msg.content)) {
					// We extract ONLY the text part for history context
					const textPart = msg.content.find((c: any) => c.type === 'text');
					if (textPart) {
						messages.push({ role: msg.role, content: textPart.text });
					}
				} else {
					// Simple text message
					messages.push({ role: msg.role, content: msg.content });
				}
			});
		}

		// 3. Construct Current User Message
		let userContent = [];

		if (prompt) {
			userContent.push({ type: "text", text: prompt });
		}

		if (image) {
			userContent.push({
				type: "image_url",
				image_url: { url: image }, // Expects "data:image/png;base64,..."
			});
		}

		if (userContent.length === 0) {
			throw new Error("No text or image provided");
		}

		messages.push({ role: "user", content: userContent });

		// 4. Run AI
		const response = await env.AI.run(MODEL_ID, {
			messages,
			max_tokens: 1024,
		});

		// 5. Parse Response (Robustness Fix)
		// Handles different return structures to prevent "undefined"
		let replyText = "I couldn't generate a response.";
		
		// @ts-ignore - Dynamic check for property existence
		if (typeof response === 'object' && response) {
			// @ts-ignore
			if (response.response) replyText = response.response;
			// @ts-ignore
			else if (response.description) replyText = response.description;
			// @ts-ignore
			else if (response.result && response.result.response) replyText = response.result.response;
			else replyText = JSON.stringify(response); // Fallback: send raw JSON
		} else if (typeof response === 'string') {
			replyText = response;
		}

		return new Response(JSON.stringify({ response: replyText }), {
			headers: { "content-type": "application/json" },
		});

	} catch (error) {
		console.error("Error:", error);
		// CRITICAL FIX: Return the error as a 'response' so the user sees it in the chat
		// instead of seeing "undefined".
		return new Response(
			JSON.stringify({ response: "Error: " + (error as Error).message }),
			{
				status: 200, // Return 200 so the frontend displays the error text bubble
				headers: { "content-type": "application/json" },
			},
		);
	}
}
