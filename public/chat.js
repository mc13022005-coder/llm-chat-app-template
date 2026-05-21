/**
 * LLM Chat App Frontend (ChatGPT UI Clone)
 */

// Initialize Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCtAFHoIgaweJniSXvpPqpwu107on8YRCM",
  authDomain: "ssi-stock-assistant.firebaseapp.com",
  projectId: "ssi-stock-assistant",
  storageBucket: "ssi-stock-assistant.firebasestorage.app",
  messagingSenderId: "219648425727",
  appId: "1:219648425727:web:3526b075b3fa63906a96ca",
  measurementId: "G-DV0TGS3KYT"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();
const db = firebase.firestore();

let currentUser = null;
let currentChatId = null;

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
			<div class="flex-1 text-on-surface message-content markdown-body overflow-hidden text-base bg-white/[0.03] border border-white/5 rounded-2xl p-6 shadow-sm">
				${parsedContent}
			</div>
		`;
	}
	
	chatMessages.appendChild(messageEl);
	chatMessages.scrollTop = chatMessages.scrollHeight;
	
	return messageEl.querySelector(".message-content");
}

// Firestore Sync & Helper Functions

// Reset/Initialize a new chat session
function initNewChat() {
	chatHistory = [];
	currentChatId = null;
	
	// Reset UI safely without deleting welcomeScreen
	if (chatMessages) {
		const welcome = document.getElementById("welcome-screen");
		chatMessages.innerHTML = "";
		if (welcome) {
			welcome.style.display = "flex";
			chatMessages.appendChild(welcome);
		}
	}
	
	// Remove active state from sidebar items
	const sidebarItems = document.querySelectorAll("#chat-history-list a");
	sidebarItems.forEach(item => {
		item.classList.remove("text-tertiary", "bg-white/10", "font-semibold");
		item.classList.add("text-on-surface-variant", "hover:text-tertiary", "hover:bg-white/5");
	});
}

// Save active chat history to Firestore
async function saveChatToFirestore() {
	if (!currentUser) return;
	
	const title = chatHistory.length > 0 && chatHistory[0].role === "user" 
		? (chatHistory[0].content.substring(0, 30) + (chatHistory[0].content.length > 30 ? "..." : ""))
		: "Trò chuyện mới";
		
	try {
		if (!currentChatId) {
			// Create a brand new chat document
			const docRef = db.collection("users").doc(currentUser.uid).collection("chats").doc();
			currentChatId = docRef.id;
			
			await docRef.set({
				title: title,
				createdAt: firebase.firestore.FieldValue.serverTimestamp(),
				messages: chatHistory
			});
			
			// Reload the list in sidebar
			await loadChatHistoryList();
		} else {
			// Update the existing chat document
			await db.collection("users").doc(currentUser.uid).collection("chats").doc(currentChatId).update({
				messages: chatHistory
			});
		}
	} catch (error) {
		console.error("Lỗi khi lưu lịch sử chat vào Firestore:", error);
	}
}

// Fetch and display all chat documents for the logged in user
async function loadChatHistoryList() {
	const chatHistoryList = document.getElementById("chat-history-list");
	if (!chatHistoryList) return;
	
	if (!currentUser) {
		chatHistoryList.innerHTML = "";
		chatHistoryList.classList.add("hidden");
		return;
	}
	
	try {
		const snapshot = await db.collection("users")
			.doc(currentUser.uid)
			.collection("chats")
			.orderBy("createdAt", "desc")
			.get();
			
		chatHistoryList.innerHTML = "";
		chatHistoryList.classList.remove("hidden");
		
		if (snapshot.empty) {
			chatHistoryList.innerHTML = `
				<div class="px-3 py-2 text-xs text-on-surface-variant/40 italic">
					Chưa có lịch sử trò chuyện
				</div>
			`;
			return;
		}
		
		snapshot.forEach((doc) => {
			const chatData = doc.data();
			const chatId = doc.id;
			const title = chatData.title || "Trò chuyện mới";
			
			const chatItem = document.createElement("a");
			const isActive = (chatId === currentChatId);
			
			chatItem.className = `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer text-sm truncate font-medium ${
				isActive 
					? "text-tertiary bg-white/10 font-semibold" 
					: "text-on-surface-variant hover:text-tertiary hover:bg-white/5"
			}`;
			chatItem.setAttribute("data-chat-id", chatId);
			chatItem.innerHTML = `
				<span class="material-symbols-outlined text-lg">chat_bubble</span>
				<span class="truncate flex-1">${title}</span>
			`;
			
			chatItem.addEventListener("click", () => {
				selectChat(chatId);
			});
			
			chatHistoryList.appendChild(chatItem);
		});
	} catch (error) {
		console.error("Lỗi khi tải danh sách chat:", error);
	}
}

// Load and display a selected chat document
async function selectChat(chatId) {
	if (!currentUser) return;
	
	try {
		const doc = await db.collection("users")
			.doc(currentUser.uid)
			.collection("chats")
			.doc(chatId)
			.get();
			
		if (!doc.exists) {
			console.error("Chat không tồn tại!");
			return;
		}
		
		currentChatId = chatId;
		const chatData = doc.data();
		chatHistory = chatData.messages || [];
		
		// Render messages to UI
		if (chatMessages) {
			const welcome = document.getElementById("welcome-screen");
			chatMessages.innerHTML = "";
			if (welcome) {
				welcome.style.display = "none";
			}
			
			// Render each message
			chatHistory.forEach((msg) => {
				addMessageToUI(msg.role, msg.content);
			});
		}
		
		// Update active class in sidebar
		const sidebarItems = document.querySelectorAll("#chat-history-list a");
		sidebarItems.forEach(item => {
			const itemChatId = item.getAttribute("data-chat-id");
			if (itemChatId === chatId) {
				item.classList.remove("text-on-surface-variant", "hover:text-tertiary", "hover:bg-white/5");
				item.classList.add("text-tertiary", "bg-white/10", "font-semibold");
			} else {
				item.classList.remove("text-tertiary", "bg-white/10", "font-semibold");
				item.classList.add("text-on-surface-variant", "hover:text-tertiary", "hover:bg-white/5");
			}
		});
		
	} catch (error) {
		console.error("Lỗi khi tải nội dung chat:", error);
	}
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
	
	// Save user message to Firestore if logged in
	if (currentUser) {
		await saveChatToFirestore();
	}

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
			
			// Save complete chat history to Firestore if logged in
			if (currentUser) {
				await saveChatToFirestore();
			}
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

// Firebase Auth Integration
const authLoggedOut = document.getElementById("auth-logged-out");
const authLoggedIn = document.getElementById("auth-logged-in");
const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");
const userAvatar = document.getElementById("user-avatar");
const userName = document.getElementById("user-name");
const userEmail = document.getElementById("user-email");
const btnNewChat = document.getElementById("btn-new-chat");

// Listen for Auth State changes (persists state across refresh)
auth.onAuthStateChanged((user) => {
	if (user) {
		// User is logged in
		currentUser = user;
		if (userAvatar) userAvatar.src = user.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuDo8L8rsWVVjHW7uVwvfur7CYdUtDttGsac7ZfYUadFh-h-Pd0_cHtnFSy87MwGme_wvX2SypmNCcp3ukIeBUtOQIVO9j6-Nz1Z83Mr2pwHcGu6F-D88UlGw6etGh2OVNwFCixKNWwhtEfBZpwsYOukVcXsdm9CvS8kKSJdRaofSKDZ9959x_mBvPQteMu17Q1XakGND6_tRf46rjF_DSRQJWIIEqoH5qnlJfQFF0U0e22oOM3VWI-P80qbXjEqjqSjrmm_ihqxVSk";
		if (userName) userName.textContent = user.displayName || "Nguyễn Văn A";
		if (userEmail) userEmail.textContent = user.email || "nguyenvana@gmail.com";
		
		if (authLoggedOut) authLoggedOut.classList.add("hidden");
		if (authLoggedIn) authLoggedIn.classList.remove("hidden");
		
		// Load Firestore Chat List
		loadChatHistoryList();
	} else {
		// User is logged out
		currentUser = null;
		initNewChat();
		
		// Clear chat list from UI
		const chatHistoryList = document.getElementById("chat-history-list");
		if (chatHistoryList) {
			chatHistoryList.innerHTML = "";
			chatHistoryList.classList.add("hidden");
		}
		
		if (authLoggedIn) authLoggedIn.classList.add("hidden");
		if (authLoggedOut) authLoggedOut.classList.remove("hidden");
	}
});

if (btnLogin) {
	btnLogin.addEventListener("click", async () => {
		try {
			await auth.signInWithPopup(googleProvider);
		} catch (error) {
			console.error("Lỗi đăng nhập Google:", error);
			alert("Đăng nhập thất bại: " + error.message);
		}
	});
}

// Logout Modal Logic & Event Listeners
const logoutModal = document.getElementById("logout-modal");
const logoutOverlay = document.getElementById("logout-overlay");
const logoutContent = document.getElementById("logout-content");
const btnLogoutCancel = document.getElementById("btn-logout-cancel");
const btnLogoutConfirm = document.getElementById("btn-logout-confirm");

function openLogoutModal() {
	if (!logoutModal) return;
	logoutModal.classList.remove("hidden");
	setTimeout(() => {
		logoutContent.classList.remove("scale-95", "opacity-0");
		logoutContent.classList.add("scale-100", "opacity-100");
	}, 10);
}

function closeLogoutModal() {
	if (!logoutModal) return;
	logoutContent.classList.remove("scale-100", "opacity-100");
	logoutContent.classList.add("scale-95", "opacity-0");
	setTimeout(() => {
		logoutModal.classList.add("hidden");
	}, 300);
}

if (btnLogout) {
	btnLogout.addEventListener("click", () => {
		openLogoutModal();
	});
}

if (btnLogoutCancel) {
	btnLogoutCancel.addEventListener("click", () => {
		closeLogoutModal();
	});
}

if (logoutOverlay) {
	logoutOverlay.addEventListener("click", () => {
		closeLogoutModal();
	});
}

if (btnLogoutConfirm) {
	btnLogoutConfirm.addEventListener("click", async () => {
		try {
			await auth.signOut();
			initNewChat();
			closeLogoutModal();
		} catch (error) {
			console.error("Lỗi đăng xuất:", error);
			closeLogoutModal();
		}
	});
}

if (btnNewChat) {
	btnNewChat.addEventListener("click", () => {
		initNewChat();
	});
}

// Consultation Modal Logic
const btnConsultation = document.getElementById("btn-consultation");
const consultationModal = document.getElementById("consultation-modal");
const consultationOverlay = document.getElementById("consultation-overlay");
const closeModalBtn = document.getElementById("close-modal-btn");
const consultationContent = document.getElementById("consultation-content");
const consultationForm = document.getElementById("consultation-form");
const consultationSuccess = document.getElementById("consultation-success");

function openConsultationModal() {
	if (!consultationModal) return;
	consultationModal.classList.remove("hidden");
	// Small delay to allow display block to apply before animating opacity/transform
	setTimeout(() => {
		consultationContent.classList.remove("scale-95", "opacity-0");
		consultationContent.classList.add("scale-100", "opacity-100");
	}, 10);
}

function closeConsultationModal() {
	if (!consultationModal) return;
	consultationContent.classList.remove("scale-100", "opacity-100");
	consultationContent.classList.add("scale-95", "opacity-0");
	setTimeout(() => {
		consultationModal.classList.add("hidden");
		// Reset form on close
		if (consultationForm) consultationForm.reset();
		if (consultationSuccess) consultationSuccess.classList.add("hidden");
	}, 300);
}

if (btnConsultation) {
	btnConsultation.addEventListener("click", openConsultationModal);
}
if (closeModalBtn) {
	closeModalBtn.addEventListener("click", closeConsultationModal);
}
if (consultationOverlay) {
	consultationOverlay.addEventListener("click", closeConsultationModal);
}

if (consultationForm) {
	consultationForm.addEventListener("submit", async (e) => {
		e.preventDefault();
		
		const name = document.getElementById("consult-name").value.trim();
		const phone = document.getElementById("consult-phone").value.trim();
		const email = document.getElementById("consult-email").value.trim();
		const topic = document.getElementById("consult-topic").value;
		
		// Full Name Validation
		if (!name) {
			alert("Vui lòng nhập Họ và tên!");
			return;
		}
		if (name.length < 2) {
			alert("Họ và tên phải có ít nhất 2 ký tự!");
			return;
		}
		
		// Phone Number Validation (Vietnamese format: 10 digits starting with 0 or +84)
		const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;
		if (!phoneRegex.test(phone.replace(/\s+/g, ""))) {
			alert("Số điện thoại không hợp lệ! Vui lòng nhập định dạng 10 số (ví dụ: 09xx xxx xxx).");
			return;
		}
		
		// Email Validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			alert("Email không hợp lệ! Vui lòng kiểm tra lại.");
			return;
		}
		
		const submitButton = document.getElementById("consultation-submit");
		const originalBtnText = submitButton ? submitButton.textContent : "Gửi yêu cầu tư vấn";
		
		try {
			if (submitButton) {
				submitButton.disabled = true;
				submitButton.textContent = "Đang gửi...";
			}
			
			// POST data to Google Apps Script Web App
			await fetch("https://script.google.com/macros/s/AKfycbzCGslkyee700vpG39PMqLa5GSTMYmJ_EcyfFR09SsGcuVEp7zzDOaWR_AgOpikx4n3/exec", {
				method: "POST",
				mode: "no-cors", // Bypasses CORS pre-flight blocks for simple requests redirection
				headers: {
					"Content-Type": "text/plain",
				},
				body: JSON.stringify({
					name: name,
					phone: phone,
					email: email,
					topic: topic,
					source: "SSI Stock Assistant"
				})
			});
			
			// Show success message
			if (consultationSuccess) {
				consultationSuccess.textContent = "Cảm ơn bạn! Chuyên viên SSI sẽ liên hệ trong thời gian sớm nhất.";
				consultationSuccess.className = "bg-[#10b981]/20 text-[#10b981] text-sm p-3 rounded-lg border border-[#10b981]/30 text-center font-medium block";
			}
			
			// Reset the form
			consultationForm.reset();
			
			// Close modal after ~1 second
			setTimeout(() => {
				closeConsultationModal();
			}, 1000);
			
		} catch (error) {
			console.error("Lỗi gửi thông tin tư vấn:", error);
			// Show error message
			if (consultationSuccess) {
				consultationSuccess.textContent = "Không gửi được thông tin, vui lòng thử lại hoặc liên hệ Zalo 0982767328.";
				consultationSuccess.className = "bg-red-500/20 text-red-400 text-sm p-3 rounded-lg border border-red-500/30 text-center font-medium block";
			}
		} finally {
			if (submitButton) {
				submitButton.disabled = false;
				submitButton.textContent = originalBtnText;
			}
		}
	});
}

