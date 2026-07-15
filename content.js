console.log('[Extension] 콘텐츠 스크립트 실행됨');

const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function() {
    this.remove(); 
};
(document.head || document.documentElement).appendChild(script);

// [추가] 환산 계산 가능한 장비 슬롯 화이트리스트 정의
const VALID_SLOTS = [
    "반지", "반지1", "반지2", "반지3", "반지4",
    "펜던트", "펜던트1", "펜던트2", 
    "무기", "보조무기", "엠블렘", "기계 심장",
    "벨트", "모자", "얼굴장식", "눈장식", 
    "상의", "하의", "신발", "귀고리", 
    "어깨장식", "장갑", "망토", "배지", "훈장"
];

window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    // [1] GET 통신 (목록 불러오기) -> 필터링 및 병합 처리
    if (event.data.type === 'AUCTION_WISHLIST_INTERCEPTED') {
        const newData = event.data.payload;
        if (!newData || !newData.items || !Array.isArray(newData.items)) return;

        // [수정 핵심] 들어온 아이템들 중 환산 가능한 카테고리의 아이템만 필터링
        const filteredItems = newData.items.filter(newItem => {
            const t = newItem.toolTip;
            if (!t || !t.categories) return false;
            
            const slot = t.categories[1] || t.categories[0] || "";
            return VALID_SLOTS.includes(slot);
        });

        chrome.storage.local.get(['auctionWishlist'], (result) => {
            let existingItems = (result.auctionWishlist && Array.isArray(result.auctionWishlist.items)) ? result.auctionWishlist.items : [];
            let addedCount = 0;
            let skippedCount = newData.items.length - filteredItems.length; // 걸러진 개수 기록용

            // 필터링된 아이템들만 루프를 돌며 병합을 수행합니다.
            filteredItems.forEach(newItem => {
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
                console.log(`[Extension] 찜 목록 병합 완료 (새로 추가됨: ${addedCount}개 / 제외됨(소비/치장 등): ${skippedCount}개 / 총 보관량: ${existingItems.length}개)`);
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