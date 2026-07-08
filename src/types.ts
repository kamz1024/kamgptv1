/**
 * Type definitions for the LLM chat application.
 */

export interface Env {
	/**
	 * Binding for the Workers AI API.
	 */
	AI: Ai;

	/**
	 * Binding for static assets.
	 */
	ASSETS: { fetch: (request: Request) => Promise<Response> };
}

/**
 * A single piece of message content. Text-only messages can use a plain
 * string; messages that include an image (for the vision model) use an
 * array of parts instead.
 */
export interface ChatMessageContentPart {
	type: "text" | "image_url";
	text?: string;
	image_url?: { url: string };
}

/**
 * Represents a chat message.
 */
export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string | ChatMessageContentPart[];
}
