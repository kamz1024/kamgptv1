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

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 750_000;
const READABLE_EXTENSIONS = new Set([
	"css",
	"csv",
	"html",
	"js",
	"json",
	"jsx",
	"log",
	"md",
	"ts",
	"tsx",
	"txt",
	"xml",
]);

// Chat state
let chatHistory = [
	{
		role: "assistant",
		content: "Hello! You have reached Kam's AI KAMGPT. How can I help you today?",
	},
];
let selectedFiles = [];
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

function addFiles(files) {
	const availableSlots = MAX_ATTACHMENTS - selectedFiles.length;
	const filesToAdd = files.slice(0, availableSlots);

	for (const file of filesToAdd) {
		if (!isReadableFile(file)) {
			addMessageToChat(
				"assistant",
				`I can attach small text-based files right now, but ${file.name} is not a supported text file yet.`,
			);
			continue;
		}

		if (file.size > MAX_ATTACHMENT_BYTES) {
			addMessageToChat(
				"assistant",
				`${file.name} is too large. Please attach files under ${formatBytes(MAX_ATTACHMENT_BYTES)}.`,
			);
			continue;
		}

		selectedFiles.push(file);
	}

	if (files.length > filesToAdd.length) {
		addMessageToChat(
			"assistant",
			`I can attach up to ${MAX_ATTACHMENTS} files at a time. Add fewer files and try again.`,
		);
	}

	renderAttachmentTray();
}

function isReadableFile(file) {
	if (file.type.startsWith("text/") || file.type === "application/json") {
		return true;
	}

	const extension = file.name.split(".").pop()?.toLowerCase();
	return extension ? READABLE_EXTENSIONS.has(extension) : false;
}

function renderAttachmentTray() {
	attachmentTray.textContent = "";
	attachmentTray.classList.toggle("visible", selectedFiles.length > 0);

	selectedFiles.forEach((file, index) => {
		const chip = document.createElement("div");
		chip.className = "attachment-chip";

		const icon = document.createElement("span");
		icon.setAttribute("aria-hidden", "true");
		icon.textContent = "📄";

		const name = document.createElement("span");
		name.textContent = `${file.name} · ${formatBytes(file.size)}`;

		const removeButton = document.createElement("button");
		removeButton.className = "remove-attachment";
		removeButton.type = "button";
		removeButton.setAttribute("aria-label", `Remove ${file.name}`);
		removeButton.textContent = "×";
		removeButton.addEventListener("click", function () {
			selectedFiles.splice(index, 1);
			renderAttachmentTray();
		});

		chip.append(icon, name, removeButton);
		attachmentTray.appendChild(chip);
	});
}

/**
 * Sends a message to the chat API and processes the response.
 */
async function sendMessage() {
	const message = userInput.value.trim();

	// Don't send empty messages without attachments.
	if ((message === "" && selectedFiles.length === 0) || isProcessing) return;

	isProcessing = true;
	setInputState(false);

	const filesForMessage = [...selectedFiles];
	let assistantBubble = null;

	try {
		const messageForApi = await buildMessageWithFiles(message, filesForMessage);
		const displayMessage = formatDisplayMessage(message, filesForMessage);

		addMessageToChat("user", displayMessage);
		removeEmptyPrompts();

		userInput.value = "";
		resizeInput();
		selectedFiles = [];
		renderAttachmentTray();
		typingIndicator.classList.add("visible");

		chatHistory.push({ role: "user", content: messageForApi });

		const assistantMessageEl = addMessageToChat("assistant", "");
		assistantBubble = assistantMessageEl.querySelector(".message-bubble");

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

async function buildMessageWithFiles(message, files) {
	if (files.length === 0) {
		return message;
	}

	const attachmentBlocks = await Promise.all(
		files.map(async (file) => {
			const text = await file.text();
			return [
				`Attachment: ${file.name}`,
				`Type: ${file.type || "text/plain"}`,
				`Size: ${formatBytes(file.size)}`,
				"Content:",
				"```",
				text,
				"```",
			].join("\n");
		}),
	);

	return [message || "Please review the attached file(s).", "", ...attachmentBlocks].join(
		"\n",
	);
}

function formatDisplayMessage(message, files) {
	if (files.length === 0) {
		return message;
	}

	const fileSummary = files
		.map((file) => `📎 ${file.name} (${formatBytes(file.size)})`)
		.join("\n");

	return [message, fileSummary].filter(Boolean).join("\n\n");
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
 * Helper function to add a message to chat.
 */
function addMessageToChat(role, content) {
	const messageEl = document.createElement("div");
	messageEl.className = `message ${role}-message`;

	const avatarEl = document.createElement("div");
	avatarEl.className = "message-avatar";
	avatarEl.setAttribute("aria-hidden", "true");
	avatarEl.textContent = role === "user" ? "You" : "KG";

	const bubbleEl = document.createElement("p");
	bubbleEl.className = "message-bubble";
	bubbleEl.textContent = content;

	messageEl.append(avatarEl, bubbleEl);
	chatMessages.appendChild(messageEl);
	chatMessages.scrollTop = chatMessages.scrollHeight;
	return messageEl;
}

function formatBytes(bytes) {
	if (bytes === 0) return "0 B";
	const units = ["B", "KB", "MB"];
	const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
	const value = bytes / 1024 ** unitIndex;
	return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
