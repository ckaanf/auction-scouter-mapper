console.log('[Extension] 콘텐츠 스크립트 실행됨');

const script = document.createElement('script');
script.src = chrome.runtime.getURL('src/inject.js');
script.onload = function () {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

// 환산 계산 가능한 장비 슬롯 화이트리스트 정의
const VALID_SLOTS = [
    "반지", "반지1", "반지2", "반지3", "반지4",
    "펜던트", "펜던트1", "펜던트2",
    "무기", "보조무기", "포스실드", "엠블렘", "기계 심장",
    "벨트", "모자", "얼굴장식", "눈장식",
    "상의", "하의", "신발", "귀고리",
    "어깨장식", "장갑", "망토", "배지", "훈장"
];

window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    // [1] GET 통신 (목록 불러오기) -> 필터링, 상호 동기화 및 병합 처리
    if (event.data.type === 'AUCTION_WISHLIST_INTERCEPTED') {
        const newData = event.data.payload;
        if (!newData || !newData.items || !Array.isArray(newData.items)) return;

        // 1. 환산 가능한 장비 카테고리만 1차 필터링
        const filteredItems = newData.items.filter(newItem => {
            const t = newItem.toolTip;
            if (!t || !t.categories) return false;

            const slot = t.categories[1] || t.categories[0] || "";
            return VALID_SLOTS.includes(slot);
        });

        chrome.storage.local.get(['auctionWishlist'], (result) => {
            let existingItems = (result.auctionWishlist && Array.isArray(result.auctionWishlist.items)) ? result.auctionWishlist.items : [];
            let addedCount = 0;
            let closedCount = 0;
            let unwishedCount = 0;
            let skippedCount = newData.items.length - filteredItems.length;

            // 2. [역방향 감지] 새로 불러온 데이터(filteredItems)에 없는 기존 아이템들을 '찜 해제/만료의심' 상태로 일괄 변경
            // 이번 통신 데이터에 존재하는 모든 tradeSn 목록 수집 (타입 일치를 위해 String 처리)
            const newTradeSns = filteredItems.map(item => String(item.tradeSn));

            existingItems = existingItems.map(oldItem => {
                const oldTradeSnStr = String(oldItem.tradeSn);
                // 기존 보관소에 있는데 새로 받아온 경매장 찜목록에는 없다면 -> 찜 해제(만료의심) 상태로 전환!
                if (!newTradeSns.includes(oldTradeSnStr)) {
                    if (!oldItem.isUnwished) {
                        oldItem.isUnwished = true;
                        unwishedCount++;
                    }
                }
                return oldItem;
            });

            // 3. [정방향 업데이트 및 병합] 새로 받아온 데이터 동기화
            filteredItems.forEach(newItem => {
                const isProductClosed = newItem.status && newItem.status !== 'ON_SALE';
                const newTradeSnStr = String(newItem.tradeSn);

                // 기존 데이터에 존재하는지 비교 (타입 일치 고려)
                const existingIndex = existingItems.findIndex(item => String(item.tradeSn) === newTradeSnStr);

                if (existingIndex > -1) {
                    // 경매장 목록에 다시 복구되어 나타났으므로 활성화 상태로 복구
                    existingItems[existingIndex].isUnwished = false;

                    // 마감 상태 실시간 동기화
                    if (isProductClosed) {
                        existingItems[existingIndex].isClosed = true;
                        closedCount++;
                    } else {
                        existingItems[existingIndex].isClosed = false;
                    }
                } else {
                    // 신규 아이템 등록
                    newItem.isUnwished = false;
                    newItem.isClosed = isProductClosed;

                    if (isProductClosed) closedCount++;

                    existingItems.push(newItem);
                    addedCount++;
                }
            });

            chrome.storage.local.set({ auctionWishlist: { items: existingItems } }, () => {
                console.log(`[Extension] 찜 목록 동기화 완료 (신규 추가: ${addedCount}개 / 찜 해제 감지: ${unwishedCount}개 / 마감 상태 전환: ${closedCount}개 / 카테고리 제외: ${skippedCount}개 / 총 보관량: ${existingItems.length}개)`);
            });
        });
    }

    // [2] DELETE 통신 (찜 해제) -> 상태 플래그 변경
    if (event.data.type === 'AUCTION_WISHLIST_DELETED') {
        const { tradeSn } = event.data.payload;
        const targetTradeSnStr = String(tradeSn); // 타입 안전성 확보

        chrome.storage.local.get(['auctionWishlist'], (result) => {
            if (result.auctionWishlist && Array.isArray(result.auctionWishlist.items)) {
                let items = result.auctionWishlist.items;
                let updated = false;

                items = items.map(item => {
                    if (String(item.tradeSn) === targetTradeSnStr) {
                        item.isUnwished = true; // 유저가 직접 찜 해제함 명시
                        updated = true;
                    }
                    return item;
                });

                if (updated) {
                    chrome.storage.local.set({ auctionWishlist: { items: items } }, () => {
                        console.log(`[Extension] 아이템 찜 해제 상태로 변경됨: ${targetTradeSnStr}`);
                    });
                }
            }
        });
    }
});