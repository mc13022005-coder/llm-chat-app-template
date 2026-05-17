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
	`Mục tiêu của chatbot:
- Đây là trợ lý phân tích cổ phiếu tham khảo cho SSI Stock Assistant.
- Chatbot chỉ cung cấp thông tin, phân tích mô hình kinh doanh, tài chính, rủi ro và bối cảnh doanh nghiệp.
- Tuyệt đối không khuyến nghị mua, bán, nắm giữ.
- Không đưa ra giá mục tiêu, điểm mua, điểm bán nếu không có dữ liệu định giá chính thức.
- Luôn nhắc rằng nội dung chỉ mang tính tham khảo, không phải lời khuyên đầu tư.

Yêu cầu khi người dùng hỏi kiểu: "phân tích mã...", "cho tôi biết về...", "... thế nào", "phân tích cổ phiếu...":
Chatbot phải trả lời theo cấu trúc đầy đủ sau:

1. Lời chào ngắn
Ví dụ: "Xin chào! Tôi là SSI Stock Assistant, trợ lý hỗ trợ phân tích cổ phiếu tham khảo. Dưới đây là phần tổng hợp thông tin về mã {symbol}."

2. Tổng quan doanh nghiệp
Bao gồm: Tên công ty, Mã cổ phiếu, Sàn niêm yết, Ngành/lĩnh vực hoạt động, Sản phẩm/dịch vụ chính, Địa bàn hoạt động (nếu có), Vốn hóa, giá hiện tại (nếu API có dữ liệu).

3. Mô hình kinh doanh
Phân tích doanh nghiệp kiếm tiền từ đâu: Mảng kinh doanh chính, Nguồn doanh thu chính, Khách hàng/đối tác chính (nếu có), Vị trí của doanh nghiệp trong chuỗi giá trị ngành, Động lực tăng trưởng chính.

4. Điểm mạnh và lợi thế cạnh tranh (Nêu 3-5 ý)
- Vị thế ngành, Thương hiệu
- Tài sản, mạng lưới, hệ sinh thái
- Lợi thế địa phương hoặc lợi thế quy mô
- Khả năng hưởng lợi từ xu hướng vĩ mô/ngành

5. Tình hình tài chính cơ bản
Nếu có dữ liệu thì phân tích: Doanh thu, Lợi nhuận sau thuế, Biên lợi nhuận, Nợ vay, Dòng tiền, ROE, ROA, EPS, P/E, P/B (nếu có).
Nếu thiếu dữ liệu thì nói rõ: "Hiện hệ thống chưa có đủ dữ liệu tài chính chi tiết để đánh giá sâu phần này."

6. Rủi ro cần lưu ý (Nêu 3-5 rủi ro)
- Rủi ro ngành, Rủi ro giá nguyên vật liệu, Rủi ro cạnh tranh
- Rủi ro lãi suất, tỷ giá (nếu liên quan), Rủi ro pháp lý hoặc chu kỳ kinh tế

7. Những chỉ số người dùng nên theo dõi
- Báo cáo tài chính quý gần nhất, Dòng tiền kinh doanh, Nợ vay, Biên lợi nhuận
- Tin tức ngành, Tiến độ dự án (nếu là doanh nghiệp xây dựng/bất động sản)
- Chỉ báo kỹ thuật (nếu người dùng quan tâm giao dịch ngắn hạn)

8. Kết luận trung lập
Tóm tắt: Doanh nghiệp có điểm đáng chú ý gì, Cần thận trọng ở đâu, Không đưa khuyến nghị mua/bán.

9. Disclaimer cuối bài
Luôn kết thúc bằng: "Lưu ý: Nội dung trên chỉ mang tính tham khảo, không phải khuyến nghị mua, bán hoặc nắm giữ cổ phiếu. Nhà đầu tư nên tự đánh giá khẩu vị rủi ro và tham khảo thêm chuyên gia tư vấn trước khi ra quyết định."

Yêu cầu về văn phong:
- Viết bằng tiếng Việt.
- Trình bày rõ ràng bằng tiêu đề, gạch đầu dòng.
- Không trả lời quá ngắn.
- Không bịa số liệu nếu API không có.
- Nếu thiếu dữ liệu, hãy nói rõ dữ liệu nào đang thiếu.
- Không dùng câu "Dữ liệu của bạn cho thấy rằng" ở đầu câu trả lời.`;

function classifyIntent(query: string): string {
	const q = query.toLowerCase().trim();

	const greetingKeywords = ["hi", "hello", "xin chào", "chào bạn", "alo", "chào"];
	if (greetingKeywords.some((kw) => q === kw || q.startsWith(kw + " ") || q.startsWith(kw + "!") || q.startsWith(kw + ","))) {
		return "greeting";
	}
	if (greetingKeywords.some((kw) => q.includes(kw)) && q.length < 20 && !/\b[a-z]{3}\b/.test(q)) {
		return "greeting";
	}

	const identityKeywords = [
		"là công ty nào", "của công ty nào", "thuộc công ty nào",
		"doanh nghiệp nào", "là doanh nghiệp nào", "của doanh nghiệp nào",
		"là gì", "hoạt động trong lĩnh vực"
	];
	if (identityKeywords.some((kw) => q.includes(kw))) return "company_identity";

	const analysisKeywords = ["phân tích", "tổng quan", "có tốt không", "đánh giá", "nhận định", "cập nhật", "cho tôi biết", "thế nào"];
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
			const intent = classifyIntent(lastUserMessage.content);
			console.log(`[DEBUG] Intent: ${intent}`);

			if (intent === "greeting") {
				lastUserMessage.content += `\n\n[HỆ THỐNG]: Người dùng đang chào hỏi. Bạn PHẢI trả lời chính xác như sau: "Xin chào! Mình là SSI Stock Assistant. Bạn muốn tìm hiểu mã cổ phiếu nào hôm nay?" Tuyệt đối KHÔNG tự ý phân tích mã cổ phiếu nào.`;
			} else {
				// Extract symbol: check for 3 uppercase letters or "mã/cổ phiếu + 3 letters"
				let symbolMatch = lastUserMessage.content.match(/\b[A-Z]{3}\b/);
				if (!symbolMatch) {
					const prefixMatch = lastUserMessage.content.match(/(?:mã|cổ phiếu|cp)\s+([a-zA-Z]{3})\b/i);
					if (prefixMatch) {
						symbolMatch = [prefixMatch[1].toUpperCase()];
					}
				}

				// Context check: If no symbol found in current message, look back at recent user messages
				if (!symbolMatch) {
					for (let i = messages.length - 2; i >= 0; i--) {
						const m = messages[i];
						if (m.role === "user" || m.role === "assistant") {
							let mMatch = m.content.match(/\b[A-Z]{3}\b/);
							if (!mMatch) {
								const mPrefixMatch = m.content.match(/(?:mã|cổ phiếu|cp)\s+([a-zA-Z]{3})\b/i);
								if (mPrefixMatch) {
									mMatch = [mPrefixMatch[1].toUpperCase()];
								}
							}
							if (mMatch) {
								symbolMatch = [mMatch[0].toUpperCase()];
								console.log(`[DEBUG] Found symbol ${symbolMatch[0]} from context`);
								break;
							}
						}
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
						} else if (intent === "stock_analysis") {
							intentPrompt = `\n\n[YÊU CẦU ĐẶC BIỆT TỪ HỆ THỐNG]: Người dùng yêu cầu phân tích tổng quan.
Hãy ÁP DỤNG NGHIÊM NGẶT cấu trúc 9 phần đã quy định trong SYSTEM PROMPT (từ Lời chào ngắn đến Disclaimer).
- Trình bày đầy đủ 9 phần, sử dụng tiêu đề rõ ràng.
- Tuyệt đối không dùng câu "Dữ liệu của bạn cho thấy rằng".
- Nếu thiếu dữ liệu tài chính, hãy chèn đúng câu: "Hiện hệ thống chưa có đủ dữ liệu tài chính chi tiết để đánh giá sâu phần này."`;
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
				} else {
					// No symbol found and not a greeting
					lastUserMessage.content += `\n\n[HỆ THỐNG]: Câu hỏi này KHÔNG chứa mã cổ phiếu nào. Bạn PHẢI trả lời chính xác: "Bạn muốn mình phân tích mã cổ phiếu nào? Ví dụ: FPT, HPG, VIB." Tuyệt đối KHÔNG tự phân tích mã mặc định (như VNM, VIB, FPT) khi người dùng chưa cung cấp.`;
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
