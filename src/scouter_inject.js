// src/scouter_inject.js
(function() {
    function broadcastLocalStore(specOrderPayload = null) {
        try {
            const bookmarkData = localStorage.getItem('bookMarkSimulList');
            const characterApi = localStorage.getItem('character-store');
            if (characterApi) {
                window.postMessage({
                    type: "MAPLESCOUTER_SPEC_DATA_INTERCEPTED",
                    payload: {
                        characterApi: characterApi,
                        specOrder: specOrderPayload,
                        bookmarks: bookmarkData
                    }
                }, "*");
            }
        } catch (e) {}
    }

    // 페이지 진입 시 이미 로컬스토리지에 저장된 character-store 즉시 동기화 (외부 API 호출 없음)
    setTimeout(() => broadcastLocalStore(null), 800);

    const originalFetch = window.fetch;

    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        const url = args[0] instanceof Request ? args[0].url : args[0];
        
        if (typeof url === 'string' && url.includes('/api/calc/spec-order')) {
            response.clone().json().then(data => {
                broadcastLocalStore(data);
            }).catch(err => console.error("[Extension] 환산기 데이터 가로채기 실패:", err));
        } else if (typeof url === 'string' && url.includes('/api/calc/')) {
            // 환산 사이트 자체 연산 완료 후 갱신된 character-store 로컬스토리지 백업
            setTimeout(() => broadcastLocalStore(null), 500);
        }
        
        return response;
    };
})();