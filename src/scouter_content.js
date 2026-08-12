// ==========================================
// [Section 1] API 가로채기 스크립트 주입
// ==========================================
const script = document.createElement('script');
script.src = chrome.runtime.getURL('src/scouter_inject.js');
script.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);


// ==========================================
// [Section 2] API 데이터 수신 및 스토리지 백업
// ==========================================
window.addEventListener("message", function(event) {
    if (event.source !== window || !event.data) return;

    if (event.data.type === "MAPLESCOUTER_SPEC_DATA_INTERCEPTED") {
        const intercepted = event.data.payload;
        chrome.storage.local.set({ 
            characterApiData: intercepted.characterApi,
            specOrderData: intercepted.specOrder,
            rawBookmarkData: intercepted.bookmarks 
        });
    }
});


// ==========================================
// [Section 3] 목표 커트라인 하이라이트(Stroke)
// ==========================================

let currentHighlightNames = [];
let highlightInterval = null;


// ==========================================
// [3-1] 익스텐션 팝업에서 메시지 수신
// ==========================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    if (message.type !== "MAPLESCOUTER_HIGHLIGHT_NAMES") {
        return;
    }

    console.log(
        "[MapleScouter] 하이라이트 메시지 수신:",
        message.highlightNames
    );

    currentHighlightNames = message.highlightNames || [];

    // 기존 루프 제거
    if (highlightInterval) {
        clearInterval(highlightInterval);
        highlightInterval = null;
    }

    // 커트라인이 있으면 하이라이트 시작
    if (currentHighlightNames.length > 0) {
        startHighlightLoop();
    }

    // 커트라인이 없으면 기존 Stroke 제거
    else {
        removeHighlightStroke();
    }

    sendResponse({
        success: true
    });

    return true;
});


// ==========================================
// [3-2] 하이라이트 루프
// ==========================================

function startHighlightLoop() {

    if (highlightInterval) {
        clearInterval(highlightInterval);
    }

    // 즉시 적용
    applyHighlightStroke();

    // React DOM 재생성 대응
    highlightInterval = setInterval(() => {
        applyHighlightStroke();
    }, 1000);
}


// ==========================================
// [3-3] 하이라이트 적용
// ==========================================

function applyHighlightStroke() {

    const listItems = document.querySelectorAll(
        '.relative.cursor-pointer'
    );

    listItems.forEach(item => {

        const imgEl = item.querySelector('img');

        if (!imgEl) return;

        const altText = imgEl.alt;

        // 심볼 / 헥사 레벨
        const lvNode = item.querySelector(
            '.absolute.right-1.bottom-1'
        );

        const level = lvNode
            ? lvNode.innerText.trim()
            : null;

        let isMatch = false;


        // ======================================
        // 커트라인 이름 비교
        // ======================================

        for (const targetName of currentHighlightNames) {

            // 일반 장비
            if (targetName === altText) {
                isMatch = true;
                break;
            }

            if (level) {

                // 심볼
                if (
                    targetName ===
                    `[심볼] ${altText} ${level}레벨`
                ) {
                    isMatch = true;
                    break;
                }

                // 헥사
                if (
                    targetName.startsWith(
                        `[헥사] ${altText}`
                    ) &&
                    targetName.endsWith(
                        `→${level})`
                    )
                ) {
                    isMatch = true;
                    break;
                }
            }
        }


        // ======================================
        // 실제 Stroke 대상 박스
        // ======================================

        const innerBox = item.querySelector(
            'div.outline-1'
        );

        if (!innerBox) return;


        // ======================================
        // Stroke 적용
        // ======================================

        if (isMatch) {

            innerBox.style.boxShadow =
                '0 0 0 3px #ff3300, 0 0 12px rgba(255, 51, 0, 0.6)';

            innerBox.style.transition =
                'box-shadow 0.3s ease-in-out';

        } else {

            innerBox.style.boxShadow = 'none';
        }
    });
}


// ==========================================
// [3-4] Stroke 전체 제거
// ==========================================

function removeHighlightStroke() {

    const listItems = document.querySelectorAll(
        '.relative.cursor-pointer'
    );

    listItems.forEach(item => {

        const innerBox = item.querySelector(
            'div.outline-1'
        );

        if (innerBox) {
            innerBox.style.boxShadow = 'none';
        }
    });
}