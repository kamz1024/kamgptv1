/**
 * LLM Chat App Frontend
 *
 * Handles chat UI interactions, attachments, and communication with the backend API.
 */

// DOM elements
const chatForm = document.getElementById("chat-form");
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const attachButton = document.getElementById("attach-button");
const fileInput = document.getElementById("file-input");
const attachmentTray = document.getElementById("attachment-tray");
const typingIndicator = document.getElementById("typing-indicator");
const dropOverlay = document.getElementById("drop-overlay");
const emptyPrompts = document.getElementById("empty-prompts");

const MAX_ATTACHMENTS = 6;

const TEXT_EXTENSIONS = new Set([
	"css", "csv", "html", "js", "json", "jsx", "log", "md", "ts", "tsx", "txt",
	"xml", "yml", "yaml", "toml", "ini", "conf", "env", "sh", "bash", "zsh",
	"py", "rb", "php", "go", "rs", "java", "kt", "swift", "c", "cc", "cpp",
	"h", "hpp", "cs", "sql", "graphql", "svelte", "vue",
]);

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "ogg", "webm", "flac", "aac"]);
const DOCUMENT_EXTENSIONS = new Set([
	"pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "rtf", "zip",
]);

const ATTACHMENT_LIMITS = {
	text: { bytes: 750_000, label: "750 KB" },
	image: { bytes: 5_000_000, label: "5 MB" },
	audio: { bytes: 8_000_000, label: "8 MB" },
	document: { bytes: 5_000_000, label: "5 MB" },
};

const ATTACHMENT_ICONS = {
	text: "📄",
	image: "🖼️",
	audio: "🎧",
	document: "📁",
};

// Chat state
let chatHistory = [
	{
		role: "assistant",
		content: "Hello! You have reached Kam's AI KAMGPT. How can I help you today?",
	},
];
let selectedAttachments = [];
let isProcessing = false;
let dragDepth = 0;

// Auto-resize textarea as user types
userInput.addEventListener("input", resizeInput);

// Send message on Enter (without Shift)
userInput.addEventListener("keydown", function (event) {
	if (event.key === "Enter" && !event.shiftKey) {
		event.preventDefault();
		sendMessage();
	}
});

chatForm.addEventListener("submit", function (event) {
	event.preventDefault();
	sendMessage();
});

attachButton.addEventListener("click", function () {
	fileInput.click();
});

fileInput.addEventListener("change", function () {
	addFiles(Array.from(fileInput.files || []));
	fileInput.value = "";
});

emptyPrompts.addEventListener("click", function (event) {
	const promptButton = event.target.closest(".prompt-chip");
	if (!promptButton) return;
	userInput.value = promptButton.textContent.trim();
	resizeInput();
	userInput.focus();
});

window.addEventListener("dragenter", function (event) {
	if (!hasDraggedFiles(event)) return;
	event.preventDefault();
	dragDepth += 1;
	dropOverlay.classList.add("visible");
});

window.addEventListener("dragover", function (event) {
	if (!hasDraggedFiles(event)) return;
	event.preventDefault();
});

window.addEventListener("dragleave", function (event) {
	if (!hasDraggedFiles(event)) return;
	event.preventDefault();
	dragDepth = Math.max(0, dragDepth - 1);
	if (dragDepth === 0) {
		dropOverlay.classList.remove("visible");
	}
});

window.addEventListener("drop", function (event) {
	if (!hasDraggedFiles(event)) return;
	event.preventDefault();
	dragDepth = 0;
	dropOverlay.classList.remove("visible");
	addFiles(Array.from(event.dataTransfer?.files || []));
});

function hasDraggedFiles(event) {
	return Array.from(event.dataTransfer?.types || []).includes("Files");
}

function resizeInput() {
	userInput.style.height = "auto";
	userInput.style.height = `${userInput.scrollHeight}px`;
}

/**
 * Determines what kind of attachment a file is ("text", "image", "audio",
 * "document") or returns null if the file type isn't supported yet.
 */
function classifyFile(file) {
	const extension = file.name.split(".").pop()?.toLowerCase();

	if (file.type.startsWith("image/") || (extension && IMAGE_EXTENSIONS.has(extension))) {
		return "image";
	}
	if (file.type.startsWith("audio/") || (extension && AUDIO_EXTENSIONS.has(extension))) {
		return "audio";
	}
	if (
		file.type.startsWith("text/") ||
		file.type === "application/json" ||
		(extension && TEXT_EXTENSIONS.has(extension))
	) {
		return "text";
	}
	if (
		file.type === "application/pdf" ||
		(extension && DOCUMENT_EXTENSIONS.has(extension))
	) {
		return "document";
	}

	return null;
}

function addFiles(files) {
	const availableSlots = MAX_ATTACHMENTS - selectedAttachments.length;
	const filesToAdd = files.slice(0, availableSlots);

	for (const file of filesToAdd) {
		const kind = classifyFile(file);

		if (!kind) {
			addMessageToChat(
				"assistant",
				`I can't read ${file.name} yet. Try an image, audio clip, document, or text-based file.`,
			);
			continue;
		}

		const limit = ATTACHMENT_LIMITS[kind];
		if (file.size > limit.bytes) {
			addMessageToChat(
				"assistant",
				`${file.name} is too large. Please attach ${kind} files under ${limit.label}.`,
			);
			continue;
		}

		selectedAttachments.push({
			file,
			kind,
			previewUrl: kind === "image" ? URL.createObjectURL(file) : null,
		});
	}

	if (files.length > filesToAdd.length) {
		addMessageToChat(
			"assistant",
			`I can attach up to ${MAX_ATTACHMENTS} files at a time. Add fewer files and try again.`,
		);
	}

	renderAttachmentTray();
}

function renderAttachmentTray() {
	attachmentTray.textContent = "";
	attachmentTray.classList.toggle("visible", selectedAttachments.length > 0);

	selectedAttachments.forEach((attachment, index) => {
		const chip = document.createElement("div");
		chip.className = "attachment-chip";

		chip.appendChild(createAttachmentIcon(attachment));

		const name = document.createElement("span");
		name.textContent = `${attachment.file.name} · ${formatBytes(attachment.file.size)}`;

		const removeButton = document.createElement("button");
		removeButton.className = "remove-attachment";
		removeButton.type = "button";
		removeButton.setAttribute("aria-label", `Remove ${attachment.file.name}`);
		removeButton.textContent = "×";
		removeButton.addEventListener("click", function () {
			if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
			selectedAttachments.splice(index, 1);
			renderAttachmentTray();
		});

		chip.append(name, removeButton);
		attachmentTray.appendChild(chip);
	});
}

function createAttachmentIcon(attachment) {
	if (attachment.kind === "image" && attachment.previewUrl) {
		const thumb = document.createElement("img");
		thumb.className = "attachment-thumb";
		thumb.src = attachment.previewUrl;
		thumb.alt = "";
		return thumb;
	}

	const icon = document.createElement("span");
	icon.setAttribute("aria-hidden", "true");
	icon.textContent = ATTACHMENT_ICONS[attachment.kind] || "📎";
	return icon;
}

/**
 * Sends a message to the chat API and processes the response.
 */
async function sendMessage() {
	const message = userInput.value.trim();

	// Don't send empty messages without attachments.
	if ((message === "" && selectedAttachments.length === 0) || isProcessing) return;

	isProcessing = true;
	setInputState(false);

	const attachmentsForMessage = [...selectedAttachments];
	let assistantBubble = null;

	try {
		typingIndicator.classList.add("visible");

		addMessageToChat("user", message, attachmentsForMessage);
		removeEmptyPrompts();

		userInput.value = "";
		resizeInput();
		selectedAttachments = [];
		renderAttachmentTray();

		const messageForApi = await buildMessageForApi(message, attachmentsForMessage);
		chatHistory.push({ role: "user", content: messageForApi });

		const assistantMessageEl = addMessageToChat("assistant", "");
		assistantBubble = assistantMessageEl.querySelector(".message-text");

		const response = await fetch("/api/chat", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				messages: chatHistory,
			}),
		});

		if (!response.ok) {
			throw new Error("Failed to get response");
		}

		if (!response.body) {
			throw new Error("Response body is empty");
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let responseText = "";
		let bufferedChunk = "";

		const appendText = (chunkText) => {
			responseText += chunkText;
			assistantBubble.textContent = responseText;
			chatMessages.scrollTop = chatMessages.scrollHeight;
		};

		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				break;
			}

			bufferedChunk += decoder.decode(value, { stream: true });
			const lines = bufferedChunk.split("\n");
			bufferedChunk = lines.pop() || "";

			for (const line of lines) {
				processStreamLine(line, appendText);
			}
		}

		bufferedChunk += decoder.decode();
		if (bufferedChunk.trim()) {
			processStreamLine(bufferedChunk, appendText);
		}

		chatHistory.push({ role: "assistant", content: responseText });
	} catch (error) {
		console.error("Error:", error);
		const errorMessage = "Sorry, there was an error processing your request.";
		if (assistantBubble) {
			assistantBubble.textContent = errorMessage;
		} else {
			addMessageToChat("assistant", errorMessage);
		}
	} finally {
		typingIndicator.classList.remove("visible");
		isProcessing = false;
		setInputState(true);
		userInput.focus();
	}
}

function processStreamLine(line, onText) {
	const trimmedLine = line.trim();
	if (!trimmedLine || trimmedLine === "data: [DONE]" || trimmedLine.startsWith("event:")) {
		return;
	}

	const jsonLine = trimmedLine.startsWith("data:")
		? trimmedLine.slice(5).trim()
		: trimmedLine;

	if (!jsonLine || jsonLine === "[DONE]") {
		return;
	}

	try {
		const jsonData = JSON.parse(jsonLine);
		const chunkText = getResponseText(jsonData);
		if (chunkText) {
			onText(chunkText);
		}
	} catch (error) {
		console.error("Error parsing JSON:", error);
	}
}

function getResponseText(jsonData) {
	return (
		jsonData.response ||
		jsonData.result?.response ||
		jsonData.result?.text ||
		jsonData.choices?.[0]?.delta?.content ||
		jsonData.choices?.[0]?.message?.content ||
		jsonData.output_text ||
		(typeof jsonData.result === "string" ? jsonData.result : "")
	);
}

/**
 * Builds the message payload sent to /api/chat. Text-only conversations send
 * a plain string; conversations that include an image attach it as an
 * image_url content part so the backend can route to the vision model.
 */
async function buildMessageForApi(message, attachments) {
	const textBlocks = [];
	const imageParts = [];

	for (const attachment of attachments) {
		if (attachment.kind === "text") {
			const text = await attachment.file.text();
			textBlocks.push(
				[
					`Attachment: ${attachment.file.name}`,
					`Type: ${attachment.file.type || "text/plain"}`,
					`Size: ${formatBytes(attachment.file.size)}`,
					"Content:",
					"```",
					text,
					"```",
				].join("\n"),
			);
		} else if (attachment.kind === "audio") {
			textBlocks.push(await transcribeAudioAttachment(attachment.file));
		} else if (attachment.kind === "document") {
			textBlocks.push(
				`Attachment: ${attachment.file.name} (${attachment.file.type || "document"}, ${formatBytes(attachment.file.size)}) — this file type can't be read automatically yet. Ask the user to paste the relevant text if you need its contents.`,
			);
		} else if (attachment.kind === "image") {
			const dataUrl = await readFileAsDataUrl(attachment.file);
			imageParts.push({ type: "image_url", image_url: { url: dataUrl } });
		}
	}

	const textContent = [message || (imageParts.length ? "Take a look at the attached image." : "Please review the attached file(s)."), ...textBlocks]
		.filter(Boolean)
		.join("\n\n");

	if (imageParts.length === 0) {
		return textContent;
	}

	return [{ type: "text", text: textContent }, ...imageParts];
}

async function transcribeAudioAttachment(file) {
	try {
		const dataUrl = await readFileAsDataUrl(file);
		const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);

		const response = await fetch("/api/transcribe", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ audio: base64 }),
		});

		if (!response.ok) {
			throw new Error("Transcription request failed");
		}

		const { text } = await response.json();
		return [
			`Attachment: ${file.name} (audio, ${formatBytes(file.size)})`,
			"Transcript:",
			text?.trim() || "(no speech detected)",
		].join("\n");
	} catch (error) {
		console.error("Error transcribing audio:", error);
		return `Attachment: ${file.name} (audio, ${formatBytes(file.size)}) — transcription failed, so the audio content is unavailable.`;
	}
}

function readFileAsDataUrl(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}

function setInputState(enabled) {
	userInput.disabled = !enabled;
	sendButton.disabled = !enabled;
	attachButton.disabled = !enabled;
}

function removeEmptyPrompts() {
	if (emptyPrompts) {
		emptyPrompts.remove();
	}
}

/**
 * Helper function to add a message to chat. Returns the created element so
 * callers can keep a reference (e.g. to stream text into it).
 */
function addMessageToChat(role, content, attachments = []) {
	const messageEl = document.createElement("div");
	messageEl.className = `message ${role}-message`;

	const avatarEl = document.createElement("div");
	avatarEl.className = "message-avatar";
	avatarEl.setAttribute("aria-hidden", "true");
	avatarEl.textContent = role === "user" ? "You" : "KG";

	const bubbleEl = document.createElement("div");
	bubbleEl.className = "message-bubble";

	const textEl = document.createElement("p");
	textEl.className = "message-text";
	textEl.textContent = content;
	bubbleEl.appendChild(textEl);

	if (attachments.length > 0) {
		bubbleEl.appendChild(createMessageAttachments(attachments));
	}

	messageEl.append(avatarEl, bubbleEl);
	chatMessages.appendChild(messageEl);
	chatMessages.scrollTop = chatMessages.scrollHeight;
	return messageEl;
}

function createMessageAttachments(attachments) {
	const wrap = document.createElement("div");
	wrap.className = "message-attachments";

	attachments.forEach((attachment) => {
		const chip = document.createElement("div");
		chip.className = "message-attachment-chip";
		chip.appendChild(createAttachmentIcon(attachment));

		const name = document.createElement("span");
		name.textContent = attachment.file.name;
		chip.appendChild(name);

		wrap.appendChild(chip);
	});

	return wrap;
}

function formatBytes(bytes) {
	if (bytes === 0) return "0 B";
	const units = ["B", "KB", "MB"];
	const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
	const value = bytes / 1024 ** unitIndex;
	return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
