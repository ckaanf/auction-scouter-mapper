// src/scouter_inject.js
(function() {
    const originalFetch = window.fetch;

    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        const url = args[0] instanceof Request ? args[0].url : args[0];
        
        if (typeof url === 'string' && url.includes('/api/calc/spec-order')) {
            response.clone().json().then(data => {
                let bookmarkData = {};
                let characterApi = {};
                try {
                    bookmarkData = localStorage.getItem('bookMarkSimulList');
                    characterApi = localStorage.getItem('character-store');
                } catch (e) {}

                window.postMessage({
                    type: "MAPLESCOUTER_SPEC_DATA_INTERCEPTED",
                    payload: {
                        characterApi : characterApi,
                        specOrder: data,
                        bookmarks: bookmarkData 
                    }
                }, "*");
            }).catch(err => console.error("[Extension] 환산기 데이터 가로채기 실패:", err));
        }
        
        return response;
    };
})();