// Conflict-safe entrypoint for the enhanced KAMGPT chat UI.
// The implementation lives in kamgpt-chat.js so this stable template path can
// continue to be used by index.html without merge conflicts.
const enhancedChatScript = document.createElement("script");
enhancedChatScript.src = "kamgpt-chat.js";
enhancedChatScript.defer = true;
document.head.appendChild(enhancedChatScript);
