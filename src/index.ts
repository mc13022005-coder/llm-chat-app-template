/**
 * LLM Chat Application Template
 *
 * A simple chat application using Cloudflare Workers AI.
 * This template demonstrates how to implement an LLM-powered chat interface with
 * streaming responses using Server-Sent Events (SSE).
 *
 * @license MIT
 */
import { Env, ChatMessage, IntentDetectionResult } from "./types";

// Model ID for Workers AI model
// https://developers.cloudflare.com/workers-ai/models/
const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

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

// ─── System prompt for intent detection ──────────────────────────────────────
const INTENT_DETECTION_SYSTEM_PROMPT = `Bạn là một bộ phân loại ý định (intent classifier) cho hệ thống phân tích cổ phiếu.
Nhiệm vụ của bạn: đọc câu hỏi của người dùng và trả về JSON hợp lệ MÀ KHÔNG CÓ BẤT KỲ TEXT NÀO KHÁC.

Quy tắc:
1. CHỈ trả về JSON thuần. Không markdown, không giải thích, không \`\`\`json ... \`\`\`.
2. Trích xuất tất cả mã cổ phiếu Việt Nam (2-5 chữ hoa, ví dụ FPT, VCB, HPG, VNINDEX, BID, CTG).
3. Nếu có từ khoá so sánh hoặc hỏi nhiều mã: intent = "compare_stocks".
4. Nếu hỏi 1 mã cụ thể: intent = "single_stock_analysis".
5. Nếu hỏi về ngành/thị trường chung không có mã: intent = "market_question".
6. Nếu hỏi về chỉ số tài chính (PE, PB, ROE, doanh thu...) cho 1 mã: intent = "financial_metric_question".
7. Nếu chào hỏi, hỏi về hệ thống, hoặc không liên quan đến cổ phiếu: intent = "general_question".

questionType phải là một trong: "analysis" | "comparison" | "valuation" | "risk" | "business_model" | "financials" | "technical" | "general"

JSON schema bắt buộc:
{
  "intent": "single_stock_analysis" | "compare_stocks" | "market_question" | "financial_metric_question" | "general_question",
  "symbols": ["FPT", "HPG"],
  "questionType": "analysis" | "comparison" | "valuation" | "risk" | "business_model" | "financials" | "technical" | "general",
  "language": "vi",
  "needsStockData": true,
  "needsMultipleStocks": false
}`;

// ─── Fallback: regex-based symbol extraction ──────────────────────────────────
/**
 * Dùng khi AI intent detection thất bại.
 * Extract tất cả token 2-5 ký tự viết hoa từ câu hỏi (bỏ qua từ tiếng Anh thường gặp).
 */
const COMMON_ENGLISH_WORDS = new Set([
	"I", "A", "AN", "THE", "IN", "ON", "AT", "TO", "OF", "AND", "OR", "BUT",
	"FOR", "WITH", "BY", "FROM", "UP", "OUT", "IS", "IT", "BE", "AS", "DO",
	"IF", "NO", "SO", "WE", "HE", "ME", "MY", "US", "HI", "OK",
]);

function extractSymbolsFromText(text: string): string[] {
	const matches = text.match(/\b[A-Z]{2,5}\b/g) ?? [];
	return [...new Set(matches.filter((m) => !COMMON_ENGLISH_WORDS.has(m)))];
}

/**
 * Fallback intent result khi không parse được JSON từ AI.
 */
function buildFallbackIntent(query: string): IntentDetectionResult {
	const symbols = extractSymbolsFromText(query);
	const needsMultipleStocks = symbols.length >= 2;
	const needsStockData = symbols.length > 0;

	let intent: IntentDetectionResult["intent"] = "general_question";
	if (symbols.length === 1) intent = "single_stock_analysis";
	if (symbols.length >= 2) intent = "compare_stocks";

	return {
		intent,
		symbols,
		questionType: needsMultipleStocks ? "comparison" : "analysis",
		language: "vi",
		needsStockData,
		needsMultipleStocks,
	};
}

// ─── Step 1: AI Intent Detection ─────────────────────────────────────────────
/**
 * Gọi AI model để phân tích ý định câu hỏi và extract mã cổ phiếu.
 * Trả về IntentDetectionResult. Nếu AI trả về JSON không hợp lệ, dùng fallback regex.
 *
 * @param userQuery - Câu hỏi hiện tại của người dùng
 * @param conversationContext - Các tin nhắn gần nhất trong hội thoại (để hiểu "2 mã này")
 * @param env - Cloudflare Worker env bindings
 */
async function detectIntentWithAI(
	userQuery: string,
	conversationContext: string,
	env: Env,
): Promise<IntentDetectionResult> {
	const contextNote = conversationContext
		? `\n\n[Ngữ cảnh hội thoại gần nhất]:\n${conversationContext}`
		: "";

	const detectionMessages = [
		{ role: "system" as const, content: INTENT_DETECTION_SYSTEM_PROMPT },
		{
			role: "user" as const,
			content: `Câu hỏi cần phân loại: "${userQuery}"${contextNote}\n\nHãy trả về JSON:`,
		},
	];

	try {
		// Gọi AI non-streaming để lấy JSON đầy đủ
		const response = (await env.AI.run(
			MODEL_ID,
			{
				messages: detectionMessages,
				max_tokens: 256,
				stream: false,
			},
		)) as { response?: string };

		const rawText = response?.response?.trim() ?? "";
		console.log(`[INTENT] Raw AI output: ${rawText}`);

		// Tìm JSON trong output (AI đôi khi wrap bằng markdown)
		const jsonMatch = rawText.match(/\{[\s\S]*\}/);
		if (!jsonMatch) throw new Error("No JSON object found in AI response");

		const parsed = JSON.parse(jsonMatch[0]) as Partial<IntentDetectionResult>;

		// Validate các field bắt buộc
		if (
			typeof parsed.intent !== "string" ||
			!Array.isArray(parsed.symbols) ||
			typeof parsed.needsStockData !== "boolean"
		) {
			throw new Error("Invalid IntentDetectionResult structure");
		}

		// Normalize symbols to uppercase
		parsed.symbols = parsed.symbols.map((s: string) => s.toUpperCase());

		// Tự suy ra needsMultipleStocks nếu AI không trả đúng
		if (typeof parsed.needsMultipleStocks !== "boolean") {
			parsed.needsMultipleStocks = parsed.symbols.length >= 2;
		}

		console.log(`[INTENT] Detected: intent=${parsed.intent}, symbols=[${parsed.symbols.join(",")}], questionType=${parsed.questionType}`);
		return parsed as IntentDetectionResult;
	} catch (err: any) {
		console.warn(`[INTENT] AI detection failed (${err.message}), falling back to regex`);
		const fallback = buildFallbackIntent(userQuery);
		console.log(`[INTENT] Fallback: intent=${fallback.intent}, symbols=[${fallback.symbols.join(",")}]`);
		return fallback;
	}
}

// ─── Step 2: Fetch stock data in parallel ────────────────────────────────────
/**
 * Lấy dữ liệu cổ phiếu cho nhiều mã song song.
 * Dùng Promise.allSettled để không bị lỗi nếu 1 mã thất bại.
 *
 * @returns Map từ symbol → dữ liệu text (hoặc error message)
 */
async function fetchStockDataBatch(
	symbols: string[],
	baseUrl: string,
): Promise<Map<string, string>> {
	const results = new Map<string, string>();
	if (symbols.length === 0) return results;

	const fetches = symbols.map(async (symbol) => {
		const endpoint = `${baseUrl}/stock/${symbol}/company`;
		console.log(`[FETCH] Gọi: ${endpoint}`);

		const res = await fetch(endpoint);

		if (!res.ok) {
			let errorText = await res.text();
			// Phân biệt lỗi Cloudflare 1003 / backend
			if (res.status === 403 || errorText.includes("1003")) {
				throw new Error(
					"Backend online chưa được cấu hình. Vui lòng deploy backend FastAPI lên Render/Railway.",
				);
			}
			try {
				const errJson = JSON.parse(errorText);
				errorText = errJson.error ?? errJson.detail ?? errorText;
			} catch {
				// giữ nguyên errorText
			}
			throw new Error(`Backend trả status ${res.status}: ${errorText}`);
		}

		const data = await res.text();
		if (!data || data.trim() === "" || data.trim() === "null") {
			throw new Error("Không nhận được dữ liệu (empty/null)");
		}
		return { symbol, data };
	});

	const settled = await Promise.allSettled(fetches);

	for (let i = 0; i < settled.length; i++) {
		const symbol = symbols[i];
		const result = settled[i];
		if (result.status === "fulfilled") {
			results.set(symbol, result.value.data);
			console.log(`[FETCH] ✓ ${symbol}: ${result.value.data.length} chars`);
		} else {
			const errMsg = result.reason?.message ?? "Lỗi không xác định";
			console.error(`[FETCH] ✗ ${symbol}: ${errMsg}`);
			results.set(symbol, `[Lỗi lấy dữ liệu ${symbol}: ${errMsg}]`);
		}
	}

	return results;
}

// ─── Build intent-aware prompt suffix ────────────────────────────────────────
/**
 * Tạo đoạn instruction cuối dựa vào questionType và intent.
 * Thay thế cho các if/else keyword cũ.
 */
function buildIntentPrompt(
	intent: IntentDetectionResult,
	symbols: string[],
): string {
	const symbolList = symbols.join(", ");

	switch (intent.questionType) {
		case "comparison":
			return `\n\n[YÊU CẦU HỆ THỐNG — SO SÁNH]:
Người dùng muốn so sánh các mã: ${symbolList}.
Hãy trả lời theo cấu trúc so sánh rõ ràng:
1. Bảng tóm tắt so sánh các tiêu chí chính (ngành, quy mô, tài chính, rủi ro).
2. Phân tích ưu/nhược điểm từng mã theo từng tiêu chí.
3. Kết luận trung lập: mỗi mã phù hợp với loại nhà đầu tư nào.
TUYỆT ĐỐI KHÔNG khuyến nghị mua/bán. Kết thúc bằng Disclaimer.`;

		case "risk":
			return `\n\n[YÊU CẦU HỆ THỐNG — RỦI RO]:
Người dùng hỏi về rủi ro của ${symbolList}.
Hãy tập trung vào: rủi ro ngành, rủi ro tài chính, rủi ro vĩ mô, rủi ro cạnh tranh, rủi ro pháp lý (nếu có).
KHÔNG nhồi nhét toàn bộ dữ liệu. Kết thúc bằng Disclaimer.`;

		case "valuation":
			return `\n\n[YÊU CẦU HỆ THỐNG — ĐỊNH GIÁ]:
Người dùng hỏi về định giá ${symbolList}.
Hãy phân tích các chỉ số P/E, P/B, EPS, ROE, ROA (nếu có dữ liệu). So sánh với ngành nếu có thể.
KHÔNG đưa ra giá mục tiêu nếu không có dữ liệu định giá chính thức. Kết thúc bằng Disclaimer.`;

		case "financials":
			return `\n\n[YÊU CẦU HỆ THỐNG — TÀI CHÍNH]:
Người dùng hỏi về chỉ số tài chính của ${symbolList}.
Hãy tập trung phân tích: Doanh thu, Lợi nhuận, Biên lợi nhuận, Nợ vay, Dòng tiền, ROE, ROA.
Nếu thiếu dữ liệu, nói rõ: "Hiện hệ thống chưa có đủ dữ liệu tài chính chi tiết."
KHÔNG bịa số liệu. Kết thúc bằng Disclaimer.`;

		case "business_model":
			return `\n\n[YÊU CẦU HỆ THỐNG — MÔ HÌNH KINH DOANH]:
Người dùng hỏi về mô hình kinh doanh của ${symbolList}.
Hãy giải thích: doanh nghiệp kiếm tiền từ đâu, mảng chính, khách hàng, vị thế trong chuỗi giá trị.
KHÔNG bịa số liệu. Kết thúc bằng Disclaimer.`;

		case "technical":
			return `\n\n[YÊU CẦU HỆ THỐNG — KỸ THUẬT]:
Người dùng hỏi về phân tích kỹ thuật của ${symbolList}.
Hãy lưu ý: Dữ liệu cung cấp là thông tin cơ bản doanh nghiệp, không phải dữ liệu giá lịch sử.
Hãy cung cấp thông tin cơ bản và gợi ý người dùng sử dụng biểu đồ kỹ thuật chuyên dụng. Kết thúc bằng Disclaimer.`;

		case "analysis":
		default:
			// Phân tích tổng quan — áp dụng đầy đủ 9-part structure
			return `\n\n[YÊU CẦU HỆ THỐNG — PHÂN TÍCH TỔNG QUAN]:
Hãy ÁP DỤNG NGHIÊM NGẶT cấu trúc 9 phần đã quy định trong SYSTEM PROMPT (từ Lời chào ngắn đến Disclaimer).
- Trình bày đầy đủ 9 phần, sử dụng tiêu đề rõ ràng.
- Tuyệt đối không dùng câu "Dữ liệu của bạn cho thấy rằng".
- Nếu thiếu dữ liệu tài chính, chèn đúng câu: "Hiện hệ thống chưa có đủ dữ liệu tài chính chi tiết để đánh giá sâu phần này."`;
	}
}

// ─── Main export ─────────────────────────────────────────────────────────────
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

// ─── handleChatRequest ────────────────────────────────────────────────────────
/**
 * Handles chat API requests with AI-powered intent detection.
 *
 * Flow:
 *  1. Parse messages from request body
 *  2. Detect intent via AI (Step 1 — non-streaming)
 *  3. Fetch stock data in parallel based on detected symbols
 *  4. Inject stock data + intent-aware instructions into the user message
 *  5. Stream final AI response (Step 2 — SSE)
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
		if (!lastUserMessage) {
			return streamErrorSSE("Không tìm thấy tin nhắn người dùng.");
		}

		const userQuery = lastUserMessage.content;

		// ── Build conversation context for intent detection ──────────────────
		// Lấy tối đa 4 tin nhắn gần nhất (trừ system) để AI hiểu "2 mã này"
		const recentContext = messages
			.filter((m) => m.role !== "system")
			.slice(-4)
			.map((m) => `[${m.role}]: ${m.content.substring(0, 300)}`)
			.join("\n");

		// ── Step 1: AI Intent Detection ──────────────────────────────────────
		console.log(`[CHAT] Detecting intent for: "${userQuery.substring(0, 100)}"`);
		const intent = await detectIntentWithAI(userQuery, recentContext, env);

		// ── Routing based on intent ──────────────────────────────────────────

		// Case 1: General question / greeting / market info without stock data needed
		if (!intent.needsStockData || intent.intent === "general_question") {
			if (intent.intent === "general_question") {
				// Xử lý câu chào hoặc câu hỏi chung
				lastUserMessage.content += `\n\n[HỆ THỐNG]: Đây là câu hỏi chung hoặc lời chào. Nếu là lời chào, hãy trả lời: "Xin chào! Mình là SSI Stock Assistant. Bạn muốn tìm hiểu mã cổ phiếu nào hôm nay?" Nếu là câu hỏi về hệ thống, hãy giới thiệu bản thân. KHÔNG tự ý phân tích mã cổ phiếu nào khi người dùng chưa yêu cầu.`;
			} else if (intent.intent === "market_question") {
				// Câu hỏi về ngành/thị trường — không cần dữ liệu mã cụ thể
				lastUserMessage.content += `\n\n[HỆ THỐNG]: Đây là câu hỏi về thị trường/ngành chung. Hãy trả lời bằng thông tin tổng quan, khách quan về ngành/thị trường được hỏi. Lưu ý đây chỉ là thông tin tham khảo. Kết thúc bằng Disclaimer.`;
			}
			// Fall through to streaming AI response
		}

		// Case 2: Question needs stock data but no symbol found, not enough context
		else if (intent.symbols.length === 0) {
			lastUserMessage.content += `\n\n[HỆ THỐNG]: Câu hỏi này cần dữ liệu cổ phiếu nhưng KHÔNG chứa mã cổ phiếu nào. Hãy trả lời: "Bạn muốn mình phân tích mã cổ phiếu nào? Ví dụ: FPT, HPG, VCB, BID." Tuyệt đối KHÔNG tự ý phân tích mã mặc định khi người dùng chưa cung cấp.`;
		}

		// Case 3: One or more stock symbols detected — fetch data
		else {
			const baseUrl =
				env.STOCK_API_BASE_URL ??
				env.VITE_API_BASE_URL ??
				"https://stockgpt-backend.onrender.com";

			// ── Step 2a: Fetch stock data in parallel ────────────────────────
			const stockDataMap = await fetchStockDataBatch(intent.symbols, baseUrl);

			// Check if ALL symbols failed (likely backend not running)
			const allFailed = [...stockDataMap.values()].every((v) => v.startsWith("[Lỗi"));
			if (allFailed && intent.symbols.length > 0) {
				const firstError = stockDataMap.get(intent.symbols[0]) ?? "Lỗi kết nối backend";
				return streamErrorSSE(firstError.replace("[Lỗi lấy dữ liệu", "Lỗi").replace("]", ""));
			}

			// ── Step 2b: Build data injection ───────────────────────────────
			const dataBlocks: string[] = [];
			for (const [symbol, data] of stockDataMap) {
				dataBlocks.push(`[Dữ liệu hệ thống từ vnstock — mã ${symbol}]:\n${data}`);
			}

			const intentPrompt = buildIntentPrompt(intent, intent.symbols);

			lastUserMessage.content +=
				`\n\n${dataBlocks.join("\n\n")}${intentPrompt}`;

			console.log(
				`[CHAT] Injected data for [${intent.symbols.join(", ")}], questionType=${intent.questionType}`,
			);
		}

		// ── Step 3: Stream final AI response ────────────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
/**
 * Trả về một SSE stream chứa thông báo lỗi, rồi đóng luồng.
 * Dùng thay vì throw để frontend vẫn nhận được tin nhắn lỗi qua SSE.
 */
function streamErrorSSE(message: string): Response {
	const sseData = `data: ${JSON.stringify({ response: `Lỗi: ${message}` })}\n\ndata: [DONE]\n\n`;
	return new Response(sseData, {
		headers: {
			"content-type": "text/event-stream; charset=utf-8",
			"cache-control": "no-cache",
			connection: "keep-alive",
		},
	});
}
