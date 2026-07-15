console.log('[Extension] 콘텐츠 스크립트 실행됨');

const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function() {
    this.remove(); 
};
(document.head || document.documentElement).appendChild(script);

window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    // [1] GET 통신 (목록 불러오기) -> 병합 처리
    if (event.data.type === 'AUCTION_WISHLIST_INTERCEPTED') {
        const newData = event.data.payload;
        if (!newData || !newData.items || !Array.isArray(newData.items)) return;

        chrome.storage.local.get(['auctionWishlist'], (result) => {
            let existingItems = (result.auctionWishlist && Array.isArray(result.auctionWishlist.items)) ? result.auctionWishlist.items : [];
            let addedCount = 0;

            newData.items.forEach(newItem => {
                // 이미 존재하면 추가하지 않고, 삭제 상태(isUnwished)였다면 다시 복구
                const existingIndex = existingItems.findIndex(item => item.tradeSn === newItem.tradeSn);
                if (existingIndex > -1) {
                    if (existingItems[existingIndex].isUnwished) {
                        existingItems[existingIndex].isUnwished = false;
                    }
                } else {
                    existingItems.push(newItem);
                    addedCount++;
                }
            });

            chrome.storage.local.set({ auctionWishlist: { items: existingItems } }, () => {
                console.log(`[Extension] 찜 목록 병합 완료 (새로 추가됨: ${addedCount}개 / 총 보관량: ${existingItems.length}개)`);
            });
        });
    }

    // [2] DELETE 통신 (찜 해제) -> 상태 플래그 변경
    if (event.data.type === 'AUCTION_WISHLIST_DELETED') {
        const { tradeSn } = event.data.payload;
        
        chrome.storage.local.get(['auctionWishlist'], (result) => {
            if (result.auctionWishlist && Array.isArray(result.auctionWishlist.items)) {
                let items = result.auctionWishlist.items;
                let updated = false;

                items = items.map(item => {
                    if (item.tradeSn === tradeSn) {
                        item.isUnwished = true; // 삭제(해제) 상태 명시
                        updated = true;
                    }
                    return item;
                });

                if (updated) {
                    chrome.storage.local.set({ auctionWishlist: { items: items } }, () => {
                        console.log(`[Extension] 아이템 찜 해제 상태로 변경됨: ${tradeSn}`);
                    });
                }
            }
        });
    }
});