from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pandas as pd
try:
    from vnstock import Vnstock
except ImportError:
    Vnstock = None

app = FastAPI(title="Stock API Backend")

# Cấu hình CORS để cho phép Chatbot ở port 8787 gọi API
origins = [
    "http://localhost:8787",
    "http://127.0.0.1:8787",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Stock API Backend is running"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/stock/{symbol}/company")
def get_company_info(symbol: str):
    symbol = symbol.upper()
    if Vnstock is None:
        return JSONResponse(status_code=500, content={"error": "Thư viện vnstock không hỗ trợ Vnstock class API. Vui lòng kiểm tra lại môi trường."})
        
    try:
        # Khởi tạo đối tượng Vnstock API mới
        stock = Vnstock().stock(symbol=symbol, source="VCI")
        
        overview_data = {}
        profile_data = {}
        warning_msg = []
        
        # Lấy dữ liệu tổng quan công ty
        try:
            overview_df = stock.company.overview()
            if overview_df is not None and not overview_df.empty:
                overview_data = overview_df.to_dict(orient="records")[0]
        except Exception as e:
            warning_msg.append(f"Lỗi lấy overview: {str(e)}")
            
        # Lấy thông tin hồ sơ doanh nghiệp
        try:
            profile_df = stock.company.profile()
            if profile_df is not None and not profile_df.empty:
                profile_data = profile_df.to_dict(orient="records")[0]
        except Exception as e:
            warning_msg.append(f"Lỗi lấy profile: {str(e)}")
            
        if not overview_data and not profile_data:
            return JSONResponse(status_code=404, content={
                "error": f"Không tìm thấy dữ liệu vnstock cho mã {symbol}",
                "warnings": warning_msg
            })
            
        # Trích xuất thông tin chung
        company_name = overview_data.get("companyName", overview_data.get("shortName", symbol))
        industry = overview_data.get("industry", "Không rõ")
        
        # overview text ưu tiên field 'overview' hoặc 'companyProfile'
        overview_text = overview_data.get("overview", "")
        if not overview_text and profile_data:
            overview_text = profile_data.get("companyProfile", "")
            
        return {
            "symbol": symbol,
            "source": "vnstock",
            "company_name": company_name,
            "industry": industry,
            "overview": overview_text,
            "warnings": warning_msg,
            "raw_data": {
                "overview": overview_data,
                "profile": profile_data
            }
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Lỗi hệ thống khi gọi vnstock: {str(e)}"})
