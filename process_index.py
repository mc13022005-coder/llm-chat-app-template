import re

with open('stitch_vib_stock_analysis_ai/code.html.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Add marked.js to head
html = html.replace('</title>', '</title>\n<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>')

# Add chat.js at the end of body
html = html.replace('</body>', '<script src="chat.js"></script>\n</body>')

# Add id="sidebar" to aside
html = html.replace('<aside class="h-full', '<aside id="sidebar" class="h-full')

# Add id="chat-messages" to the scrollable area
html = html.replace('<div class="flex-1 overflow-y-auto scrollbar-hide flex flex-col items-center">', '<div class="flex-1 overflow-y-auto scrollbar-hide flex flex-col items-center w-full" id="chat-messages">')

# Add id="welcome-screen" to the welcome area
html = html.replace('<div class="w-full max-w-4xl px-gutter py-24 flex flex-col items-center text-center">', '<div id="welcome-screen" class="w-full max-w-4xl px-gutter py-24 flex flex-col items-center text-center">')

# Add id="user-input" to textarea
html = html.replace('<textarea class="flex-1', '<textarea id="user-input" class="flex-1')

# Add id="send-button" to the send button
html = html.replace('<button class="w-10 h-10 bg-tertiary text-on-tertiary rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg shadow-tertiary/20">', '<button id="send-button" class="w-10 h-10 bg-tertiary text-on-tertiary rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg shadow-tertiary/20">')

# Add suggestion-btn class to suggestion buttons
html = html.replace('<button class="glass-card group p-5 rounded-2xl text-left hover:bg-white/10 transition-all border-none flex items-center gap-4">', '<button class="glass-card group p-5 rounded-2xl text-left hover:bg-white/10 transition-all border-none flex items-center gap-4 suggestion-btn">')

# Add id="typing-indicator" right above the input area
typing_indicator = """
<div id="typing-indicator" class="hidden text-center text-on-surface-variant/60 text-sm py-2">
    <div class="flex items-center justify-center gap-1">
        <div class="w-1.5 h-1.5 rounded-full bg-tertiary animate-bounce"></div>
        <div class="w-1.5 h-1.5 rounded-full bg-tertiary animate-bounce" style="animation-delay: 0.2s"></div>
        <div class="w-1.5 h-1.5 rounded-full bg-tertiary animate-bounce" style="animation-delay: 0.4s"></div>
    </div>
</div>
"""
html = html.replace('<div class="w-full max-w-4xl mx-auto p-gutter relative z-50">', typing_indicator + '\n<div class="w-full max-w-4xl mx-auto p-gutter relative z-50">')

with open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(html)
