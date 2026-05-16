/**
 * LLM Chat App Frontend (ChatGPT UI Clone)
 */

const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");
const welcomeScreen = document.getElementById("welcome-screen");
const sidebar = document.getElementById("sidebar");
const toggleSidebarBtn = document.getElementById("toggle-sidebar");

// Chat state (empty initially to show welcome screen)
let chatHistory = [];
let isProcessing = false;

// Configure marked.js to break lines
if (typeof marked !== 'undefined') {
	marked.setOptions({
		breaks: true,
		gfm: true
	});
}

// Auto-resize textarea
userInput.addEventListener("input", function () {
	this.style.height = "auto";
	this.style.height = Math.min(this.scrollHeight, 200) + "px";
});

// Send message on Enter (without Shift)
userInput.addEventListener("keydown", function (e) {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		sendMessage();
	}
});

// Send button click
sendButton.addEventListener("click", sendMessage);

// Suggestion buttons
const suggestionBtns = document.querySelectorAll(".suggestion-btn");
suggestionBtns.forEach(btn => {
	btn.addEventListener("click", () => {
		const textDiv = btn.querySelector('.font-semibold');
		userInput.value = textDiv ? textDiv.textContent : btn.textContent;
		sendMessage();
	});
});

// Toggle sidebar on mobile
if (toggleSidebarBtn) {
	toggleSidebarBtn.addEventListener("click", () => {
		sidebar.classList.toggle("open");
	});
}

// Close sidebar when clicking outside on mobile
document.addEventListener("click", (e) => {
	if (window.innerWidth <= 768 && !sidebar.contains(e.target) && e.target !== toggleSidebarBtn) {
		sidebar.classList.remove("open");
	}
});

/**
 * Parses markdown to HTML, fallback to simple newline replacement if marked is not loaded
 */
function parseText(text) {
	if (typeof marked !== 'undefined') {
		return marked.parse(text);
	}
	// Fallback
	return `<p>${text.replace(/\n/g, '<br/>')}</p>`;
}

function addMessageToUI(role, content) {
	// Hide welcome screen if it exists
	if (welcomeScreen && welcomeScreen.style.display !== 'none') {
		welcomeScreen.style.display = 'none';
	}

	const messageEl = document.createElement("div");
	messageEl.className = role === "user" 
		? "w-full max-w-4xl px-gutter py-6 flex gap-4 w-full justify-end" 
		: "w-full max-w-4xl px-gutter py-6 flex gap-4 w-full";
	
	const parsedContent = role === "assistant" ? parseText(content) : `<p>${content.replace(/\\n/g, '<br/>')}</p>`;

	if (role === "user") {
		messageEl.innerHTML = `
			<div class="flex-1 text-on-surface bg-white/5 rounded-2xl p-4 ml-auto max-w-[80%] message-content break-words">
				${parsedContent}
			</div>
		`;
	} else {
		messageEl.innerHTML = `
			<div class="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center bg-[#e5c04f] shadow-md flex-shrink-0 mt-0.5">
				<span class="material-symbols-outlined text-[22px] text-black/90" style="font-variation-settings: 'FILL' 1;">auto_awesome</span>
			</div>
			<div class="flex-1 text-on-surface message-content overflow-hidden text-base">
				${parsedContent}
			</div>
		`;
	}
	
	chatMessages.appendChild(messageEl);
	chatMessages.scrollTop = chatMessages.scrollHeight;
	
	return messageEl.querySelector(".message-content");
}

async function sendMessage() {
	const message = userInput.value.trim();

	if (message === "" || isProcessing) return;

	isProcessing = true;
	userInput.disabled = true;
	sendButton.disabled = true;

	// Add user message to UI
	addMessageToUI("user", message);

	// Clear input
	userInput.value = "";
	userInput.style.height = "auto";

	// Show typing indicator
	if (typingIndicator) {
		typingIndicator.classList.remove("hidden");
	}
	chatMessages.scrollTop = chatMessages.scrollHeight;

	// Add to logic history
	chatHistory.push({ role: "user", content: message });

	try {
		// Create empty assistant message element
		const contentContainer = addMessageToUI("assistant", "");
		
		const response = await fetch("/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ messages: chatHistory }),
		});

		if (!response.ok) {
			throw new Error("Failed to get response");
		}
		if (!response.body) {
			throw new Error("Response body is null");
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let responseText = "";
		let buffer = "";
		
		const flushAssistantText = () => {
			contentContainer.innerHTML = parseText(responseText);
			// Auto scroll unless user has scrolled up significantly
			const isAtBottom = chatMessages.scrollHeight - chatMessages.scrollTop <= chatMessages.clientHeight + 100;
			if (isAtBottom) {
				chatMessages.scrollTop = chatMessages.scrollHeight;
			}
		};

		let sawDone = false;
		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				const parsed = consumeSseEvents(buffer + "\n\n");
				for (const data of parsed.events) {
					if (data === "[DONE]") break;
					try {
						const jsonData = JSON.parse(data);
						let content = "";
						if (typeof jsonData.response === "string" && jsonData.response.length > 0) {
							content = jsonData.response;
						} else if (jsonData.choices?.[0]?.delta?.content) {
							content = jsonData.choices[0].delta.content;
						}
						if (content) {
							responseText += content;
							flushAssistantText();
						}
					} catch (e) {
						console.error("Error parsing SSE data:", e);
					}
				}
				break;
			}

			buffer += decoder.decode(value, { stream: true });
			const parsed = consumeSseEvents(buffer);
			buffer = parsed.buffer;
			for (const data of parsed.events) {
				if (data === "[DONE]") {
					sawDone = true;
					buffer = "";
					break;
				}
				try {
					const jsonData = JSON.parse(data);
					let content = "";
					if (typeof jsonData.response === "string" && jsonData.response.length > 0) {
						content = jsonData.response;
					} else if (jsonData.choices?.[0]?.delta?.content) {
						content = jsonData.choices[0].delta.content;
					}
					if (content) {
						responseText += content;
						flushAssistantText();
					}
				} catch (e) {
					console.error("Error parsing SSE data:", e);
				}
			}
			if (sawDone) break;
		}

		if (responseText.length > 0) {
			chatHistory.push({ role: "assistant", content: responseText });
		}
	} catch (error) {
		console.error("Error:", error);
		addMessageToUI("assistant", "Xin lỗi, đã có lỗi xảy ra khi xử lý yêu cầu của bạn.");
	} finally {
		if (typingIndicator) {
			typingIndicator.classList.add("hidden");
		}
		isProcessing = false;
		userInput.disabled = false;
		sendButton.disabled = false;
		userInput.focus();
	}
}

function consumeSseEvents(buffer) {
	let normalized = buffer.replace(/\r/g, "");
	const events = [];
	let eventEndIndex;
	while ((eventEndIndex = normalized.indexOf("\n\n")) !== -1) {
		const rawEvent = normalized.slice(0, eventEndIndex);
		normalized = normalized.slice(eventEndIndex + 2);

		const lines = rawEvent.split("\n");
		const dataLines = [];
		for (const line of lines) {
			if (line.startsWith("data:")) {
				dataLines.push(line.slice("data:".length).trimStart());
			}
		}
		if (dataLines.length === 0) continue;
		events.push(dataLines.join("\n"));
	}
	return { events, buffer: normalized };
}

// Mock Auth Toggle
const authLoggedOut = document.getElementById("auth-logged-out");
const authLoggedIn = document.getElementById("auth-logged-in");
const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");

if (btnLogin && btnLogout && authLoggedOut && authLoggedIn) {
	btnLogin.addEventListener("click", () => {
		authLoggedOut.classList.add("hidden");
		authLoggedIn.classList.remove("hidden");
	});

	btnLogout.addEventListener("click", () => {
		authLoggedIn.classList.add("hidden");
		authLoggedOut.classList.remove("hidden");
	});
}
