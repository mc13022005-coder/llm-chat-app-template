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

const STOCK_API_BASE_URL = "http://127.0.0.1:8000";

// Default system prompt
const SYSTEM_PROMPT =
	`Bạn là trợ lý AI chuyên về chứng khoán Việt Nam. 
Quy tắc:
1. Trả lời đúng trọng tâm câu hỏi của người dùng. Câu hỏi đơn giản thì trả lời ngắn gọn, không nhồi nhét toàn bộ dữ liệu.
2. Bạn chỉ được phân tích dựa trên dữ liệu được hệ thống cung cấp từ vnstock/backend.
3. KHÔNG được tự bịa số liệu. Nếu thiếu dữ liệu, phải nói rõ là dữ liệu chưa có.
4. KHÔNG được đưa ra khuyến nghị mua/bán chắc chắn.
5. Luôn nhắc dữ liệu chỉ mang tính tham khảo nếu câu trả lời có tính chất phân tích/định giá.`;

function classifyIntent(query: string): string {
	const q = query.toLowerCase();

	const identityKeywords = [
		"là công ty nào", "của công ty nào", "thuộc công ty nào",
		"doanh nghiệp nào", "là doanh nghiệp nào", "của doanh nghiệp nào",
		"là gì", "hoạt động trong lĩnh vực"
	];
	if (identityKeywords.some((kw) => q.includes(kw))) return "company_identity";

	const analysisKeywords = ["phân tích", "tổng quan", "có tốt không", "đánh giá", "nhận định", "cập nhật"];
	if (analysisKeywords.some((kw) => q.includes(kw))) return "stock_analysis";

	const financialKeywords = ["tài chính", "chỉ số", "doanh thu", "lợi nhuận", "pe", "pb", "roa", "roe", "biên lợi nhuận", "báo cáo"];
	if (financialKeywords.some((kw) => q.includes(kw))) return "financial_metrics";

	const riskKeywords = ["rủi ro", "nguy hiểm", "xấu", "cảnh báo"];
	if (riskKeywords.some((kw) => q.includes(kw))) return "risk";

	const dividendKeywords = ["cổ tức", "chia thưởng", "phát hành"];
	if (dividendKeywords.some((kw) => q.includes(kw))) return "dividend";

	const valuationKeywords = ["định giá", "giá mục tiêu", "fair value", "giá trị thực"];
	if (valuationKeywords.some((kw) => q.includes(kw))) return "valuation";

	return "unknown";
}

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
				const baseUrl =
					env.STOCK_API_BASE_URL ||
					env.VITE_API_BASE_URL ||
					"https://stockgpt-backend.onrender.com";
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
						
						if (stockRes.status === 403 || errorText.includes("1003")) {
							console.error(`[DEBUG] Bị Cloudflare chặn (403/1003): ${errorText}`);
							throw new Error("Backend online chưa được cấu hình. Hiện tại bản web online chưa thể gọi backend local. Vui lòng deploy backend FastAPI lên Render/Railway rồi cấu hình STOCK_API_BASE_URL.");
						}

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

					// Classify intent
					const intent = classifyIntent(lastUserMessage.content);
					console.log(`[DEBUG] Intent: ${intent}`);

					let intentPrompt = "";
					if (intent === "company_identity") {
						intentPrompt = `\n\n[YÊU CẦU ĐẶC BIỆT LÀM THEO INTENT]:
1. Người dùng chỉ hỏi nhận diện công ty. Hãy trả lời NGẮN GỌN (120-180 từ).
2. Format bắt buộc:
"Mã cổ phiếu ${symbol} thuộc [Tên đầy đủ của công ty]."
Một số thông tin chính:
- Tên đầy đủ: ...
- Lĩnh vực hoạt động: ...
- Sàn giao dịch: ...
- Mô tả ngắn: ...
3. TUYỆT ĐỐI KHÔNG đưa các thông tin tài chính (giá, ROA, ROE, doanh thu, lợi nhuận, khuyến nghị) vào câu trả lời này.
4. Cuối câu trả lời, HÃY HỎI: "Bạn có muốn xem thêm tình hình tài chính, rủi ro hay cổ tức của ${symbol} không?"`;
					} else {
						intentPrompt = `\n\n[Yêu cầu]: Hãy trả lời dựa trên dữ liệu trên. Trả lời đúng trọng tâm câu hỏi (nếu hỏi tài chính thì xoáy sâu vào tài chính, hỏi rủi ro thì nói rủi ro). KHÔNG được tự bịa số liệu. KHÔNG nhồi nhét toàn bộ dữ liệu nếu người dùng không hỏi.`;
					}

					// Append the data to the user's prompt so the AI can use it
					lastUserMessage.content += `\n\n[Dữ liệu hệ thống cung cấp từ vnstock cho mã ${symbol}]:\n${stockData}${intentPrompt}`;
				} catch (err: any) {
					console.error(`[ERROR] Lỗi gọi backend API cho mã ${symbol}:`, err);
					
					let errorMsg = err.message || "Lỗi không xác định khi lấy dữ liệu";
					
					if (errorMsg.includes("1003") || errorMsg.includes("403")) {
						errorMsg = "Backend online chưa được cấu hình. Hiện tại bản web online chưa thể gọi backend local. Vui lòng deploy backend FastAPI lên Render/Railway rồi cấu hình STOCK_API_BASE_URL.";
					}
					
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
