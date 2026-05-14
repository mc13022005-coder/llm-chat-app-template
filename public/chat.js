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
		userInput.value = btn.textContent;
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
	// Remove welcome screen if it exists
	if (welcomeScreen && welcomeScreen.parentNode) {
		welcomeScreen.parentNode.removeChild(welcomeScreen);
	}

	const messageEl = document.createElement("div");
	messageEl.className = `message ${role}-message`;
	
	const avatarChar = role === "user" ? "U" : "AI";
	const avatarClass = role === "user" ? "user-avatar" : "assistant-avatar";
	const parsedContent = role === "assistant" ? parseText(content) : `<p>${content.replace(/\n/g, '<br/>')}</p>`;

	messageEl.innerHTML = `
		<div class="message-inner">
			<div class="avatar ${avatarClass}">${avatarChar}</div>
			<div class="message-content">
				${parsedContent}
			</div>
		</div>
	`;
	
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
	typingIndicator.classList.add("visible");
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
		typingIndicator.classList.remove("visible");
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
