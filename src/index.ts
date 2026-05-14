/**
 * LLM Chat Application Template
 *
 * A simple chat application using Cloudflare Workers AI.
 * This template demonstrates how to implement an LLM-powered chat interface with
 * streaming responses using Server-Sent Events (SSE).
 *
 * @license MIT
 */
import { Env, ChatMessage } from "./types";

// Model ID for Workers AI model
// https://developers.cloudflare.com/workers-ai/models/
const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

const STOCK_API_BASE_URL = "http://localhost:8000";

// Default system prompt
const SYSTEM_PROMPT =
	"Bạn là trợ lý phân tích cổ phiếu Việt Nam. Bạn chỉ được phân tích dựa trên dữ liệu được hệ thống cung cấp từ vnstock/backend. Không được tự bịa số liệu. Không được khuyến nghị mua/bán chắc chắn. Nếu thiếu dữ liệu, phải nói rõ phần nào thiếu.";

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
		// Parse JSON request body
		const { messages = [] } = (await request.json()) as {
			messages: ChatMessage[];
		};

		// Add system prompt if not present
		if (!messages.some((msg) => msg.role === "system")) {
			messages.unshift({ role: "system", content: SYSTEM_PROMPT });
		}

		// Find the last user message
		const lastUserMessage = messages.slice().reverse().find((m) => m.role === "user");
		if (lastUserMessage) {
			// Extract symbol: check for 3 uppercase letters or "mã/cổ phiếu + 3 letters"
			let symbolMatch = lastUserMessage.content.match(/\b[A-Z]{3}\b/);
			if (!symbolMatch) {
				const prefixMatch = lastUserMessage.content.match(/(?:mã|cổ phiếu|cp)\s+([a-zA-Z]{3})\b/i);
				if (prefixMatch) {
					symbolMatch = [prefixMatch[1].toUpperCase()];
				}
			}

			if (symbolMatch) {
				const symbol = symbolMatch[0].toUpperCase();
				console.log(`[DEBUG] Nhận diện mã cổ phiếu: ${symbol}`);
				const baseUrl = env.STOCK_API_BASE_URL || STOCK_API_BASE_URL;
				const endpoint = `${baseUrl}/stock/${symbol}/company`;
				console.log(`[DEBUG] Gọi backend URL: ${endpoint}`);

				try {
					const stockRes = await fetch(endpoint).catch(err => {
						console.error(`[DEBUG] Lỗi fetch network: ${err.message}`);
						throw new Error(`Không kết nối được backend tại ${baseUrl}. Bạn đã chạy backend chưa?`);
					});

					console.log(`[DEBUG] Backend status: ${stockRes.status}`);

					if (!stockRes.ok) {
						let errorText = await stockRes.text();
						try {
							const errJson = JSON.parse(errorText);
							if (errJson.error) errorText = errJson.error;
							else if (errJson.detail) errorText = errJson.detail;
						} catch (e) {
							// fallback to raw text
						}
						console.error(`[DEBUG] Backend error ${stockRes.status}: ${errorText}`);
						throw new Error(`Backend trả status ${stockRes.status}: ${errorText}`);
					}
					const stockData = await stockRes.text();
					if (!stockData || stockData.trim() === "" || stockData.trim() === "null") {
						throw new Error("Không nhận diện được dữ liệu (empty/null)");
					}

					// Append the data to the user's prompt so the AI can use it
					lastUserMessage.content += `\n\n[Dữ liệu hệ thống cung cấp từ vnstock cho mã ${symbol}]:\n${stockData}\n\n[Yêu cầu: Hãy phân tích dựa trên dữ liệu trên. Không được tự bịa số liệu. Không được đưa ra lời khuyên mua/bán chắc chắn.]`;
				} catch (err: any) {
					console.error(`[ERROR] Lỗi gọi backend API cho mã ${symbol}:`, err);
					
					const errorMsg = err.message || "Lỗi không xác định khi lấy dữ liệu";
					
					// Return SSE format directly without calling AI
					const sseData = `data: ${JSON.stringify({ response: `Lỗi: ${errorMsg}` })}\n\ndata: [DONE]\n\n`;
					return new Response(sseData, {
						headers: {
							"content-type": "text/event-stream; charset=utf-8",
							"cache-control": "no-cache",
							connection: "keep-alive",
						},
					});
				}
			}
		}

		const stream = await env.AI.run(
			MODEL_ID,
			{
				messages,
				max_tokens: 1024,
				stream: true,
			},
			{
				// Uncomment to use AI Gateway
				// gateway: {
				//   id: "YOUR_GATEWAY_ID", // Replace with your AI Gateway ID
				//   skipCache: false,      // Set to true to bypass cache
				//   cacheTtl: 3600,        // Cache time-to-live in seconds
				// },
			},
		);

		return new Response(stream, {
			headers: {
				"content-type": "text/event-stream; charset=utf-8",
				"cache-control": "no-cache",
				connection: "keep-alive",
			},
		});
	} catch (error) {
		console.error("Error processing chat request:", error);
		return new Response(
			JSON.stringify({ error: "Failed to process request" }),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			},
		);
	}
}
