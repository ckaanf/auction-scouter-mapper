// src/scouter_content.js
const script = document.createElement('script');
script.src = chrome.runtime.getURL('src/scouter_inject.js');
script.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

window.addEventListener("message", function(event) {
    if (event.source !== window || !event.data) return;

    if (event.data.type === "MAPLESCOUTER_SPEC_DATA_INTERCEPTED") {
        const intercepted = event.data.payload;
        
        // 🔥 API 데이터와 북마크 데이터를 통째로 스토리지에 저장
        chrome.storage.local.set({ 
            specOrderData: intercepted.specOrder,
            rawBookmarkData: intercepted.bookmarks 
        }, () => {
            console.log("✅ [Extension] 환산기 데이터 및 북마크 스토리지 갱신 완료!");
        });
    }
});