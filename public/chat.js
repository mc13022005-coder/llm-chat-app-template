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
			<div class="w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/10 flex-shrink-0">
				<img alt="User" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDo8L8rsWVVjHW7uVwvfur7CYdUtDttGsac7ZfYUadFh-h-Pd0_cHtnFSy87MwGme_wvX2SypmNCcp3ukIeBUtOQIVO9j6-Nz1Z83Mr2pwHcGu6F-D88UlGw6etGh2OVNwFCixKNWwhtEfBZpwsYOukVcXsdm9CvS8kKSJdRaofSKDZ9959x_mBvPQteMu17Q1XakGND6_tRf46rjF_DSRQJWIIEqoH5qnlJfQFF0U0e22oOM3VWI-P80qbXjEqjqSjrmm_ihqxVSk" />
			</div>
		`;
	} else {
		messageEl.innerHTML = `
			<div class="w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-tertiary to-tertiary-container shadow-lg flex-shrink-0 mt-1">
				<img alt="AIVANCE" class="w-5 h-5 brightness-0" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBP9_0Sj9MqvoSRMOrfYuUsa6gpN4usEUeFK54k2jSyHjriwo2d8FPMBaOSrDB4ZeAIayeLp51cLRsLw_Sm5FTfBgQ6U-yK1mDu0jPRqZ2RAra-m1PFEB0XpAb9sN4dlt1ZRMbU2YYYhiI8BRJEvS8AUGYt25ovbqgT5T2lf0wICu7lq5LZEUQQPCNjOaW_f9M3U_HkEIdYaqfx3C_LXNtn82g-dlc2XRLndFpf7D2X81B8XKB6ZdA-AjBlVSA3t_8K_nIZLlRV1Lk" />
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
