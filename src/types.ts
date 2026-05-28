/**
 * Type definitions for the LLM chat application.
 */

export interface Env {
	/**
	 * Binding for the Workers AI API.
	 */
	AI: Ai;

	/**
	 * Binding for static assets.
	 */
	ASSETS: { fetch: (request: Request) => Promise<Response> };

	/**
	 * Optional API Base URL for stock data
	 */
	STOCK_API_BASE_URL?: string;
	VITE_API_BASE_URL?: string;
}

/**
 * Represents a chat message.
 */
export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

/**
 * Structured result from AI intent detection step.
 * The AI model returns this as a JSON object before any stock data fetching occurs.
 */
export interface IntentDetectionResult {
	/**
	 * High-level classification of what the user wants to do.
	 * - single_stock_analysis: hỏi về một mã cổ phiếu cụ thể
	 * - compare_stocks: so sánh nhiều mã với nhau
	 * - market_question: câu hỏi về thị trường/ngành không gắn với mã cụ thể
	 * - financial_metric_question: hỏi chỉ số tài chính cụ thể của một mã
	 * - general_question: câu hỏi chung, chào hỏi, không liên quan đến cổ phiếu
	 */
	intent:
		| "single_stock_analysis"
		| "compare_stocks"
		| "market_question"
		| "financial_metric_question"
		| "general_question";

	/**
	 * List of stock ticker symbols mentioned or implied in the query.
	 * All uppercase, e.g. ["FPT", "HPG"]
	 */
	symbols: string[];

	/**
	 * Type of question for fine-tuning the final answer prompt.
	 */
	questionType:
		| "analysis"
		| "comparison"
		| "valuation"
		| "risk"
		| "business_model"
		| "financials"
		| "technical"
		| "general";

	/** Primary language of the user's message, e.g. "vi" or "en" */
	language: string;

	/** Whether this question requires fetching real stock data from the backend API */
	needsStockData: boolean;

	/** Whether this question requires data for more than one stock symbol */
	needsMultipleStocks: boolean;
}
