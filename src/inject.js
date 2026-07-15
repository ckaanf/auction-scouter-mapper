(function() {
    console.log('[Extension] 인터셉터 스크립트 주입 완료');

    // Fetch 통신 가로채기
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = args[0] instanceof Request ? args[0].url : args[0];
        const method = (args[0] instanceof Request ? args[0].method : args[1]?.method) || 'GET';
        const response = await originalFetch.apply(this, args);

        if (typeof url === 'string' && url.includes('/v1/market/web/wishlists')) {
            if (method.toUpperCase() === 'DELETE') {
                try {
                    const urlObj = new URL(url.startsWith('http') ? url : window.location.origin + url);
                    const tradeSn = urlObj.searchParams.get('tradeSn');
                    if (tradeSn) {
                        console.log('[Extension] Fetch DELETE 감지됨:', tradeSn);
                        window.postMessage({ type: 'AUCTION_WISHLIST_DELETED', payload: { tradeSn } }, '*');
                    }
                } catch(e) {}
            } else if (method.toUpperCase() === 'GET') {
                response.clone().json().then(data => {
                    window.postMessage({ type: 'AUCTION_WISHLIST_INTERCEPTED', payload: data }, '*');
                }).catch(err => console.error('[Extension] Fetch JSON 파싱 에러:', err));
            }
        }
        return response;
    };

    // XHR 통신 가로채기
    const originalXHROpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function(method, url) {
        this._method = method;
        this._url = url;
        return originalXHROpen.apply(this, arguments);
    };

    const originalXHRSend = window.XMLHttpRequest.prototype.send;
    window.XMLHttpRequest.prototype.send = function() {
        this.addEventListener('load', function() {
            if (this._url && this._url.includes('/v1/market/web/wishlists')) {
                if (this._method.toUpperCase() === 'DELETE') {
                    try {
                        const urlObj = new URL(this._url.startsWith('http') ? this._url : window.location.origin + this._url);
                        const tradeSn = urlObj.searchParams.get('tradeSn');
                        if (tradeSn) {
                            console.log('[Extension] XHR DELETE 감지됨:', tradeSn);
                            window.postMessage({ type: 'AUCTION_WISHLIST_DELETED', payload: { tradeSn } }, '*');
                        }
                    } catch(e) {}
                } else if (this._method.toUpperCase() === 'GET') {
                    try {
                        const data = JSON.parse(this.responseText);
                        window.postMessage({ type: 'AUCTION_WISHLIST_INTERCEPTED', payload: data }, '*');
                    } catch(err) {}
                }
            }
        });
        return originalXHRSend.apply(this, arguments);
    };
})();