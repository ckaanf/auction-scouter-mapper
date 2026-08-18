document.addEventListener('DOMContentLoaded', () => {
    const tabWishlist = document.getElementById('tabWishlist');
    const tabStorage = document.getElementById('tabStorage');
    const tabScouterSpecOrder = document.getElementById('tabScouterSpecOrder');

    const wishlistContent = document.getElementById('wishlistContent');
    const storageContent = document.getElementById('storageContent');
    const scouterSpecOrderContent = document.getElementById('scouterSpecOrderContent');

    // 3. 탭 전환 공통 함수
    function switchTab(activeBtn, activeContent) {
        // 모든 버튼과 컨텐츠에서 active 클래스 제거
        [tabWishlist, tabStorage, tabScouterSpecOrder].forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        [wishlistContent, storageContent, scouterSpecOrderContent].forEach(content => {
            if (content) content.classList.remove('active');
        });

        // 선택한 탭과 컨텐츠에 active 클래스 부여
        if (activeBtn) activeBtn.classList.add('active');
        if (activeContent) activeContent.classList.add('active');
    }

    // 4. 각 탭 클릭 이벤트 바인딩
    if (tabWishlist && wishlistContent) {
        tabWishlist.addEventListener('click', () => {
            switchTab(tabWishlist, wishlistContent);
            if (typeof loadData === 'function') loadData(); // 기존 경매장 찜 목록 함수 호출용
        });
    }

    if (tabStorage && storageContent) {
        tabStorage.addEventListener('click', () => {
            switchTab(tabStorage, storageContent);
            if (typeof loadFolders === 'function') loadFolders(); // 기존 보관함 함수 호출용
        });
    }

    if (tabScouterSpecOrder && scouterSpecOrderContent) {
        tabScouterSpecOrder.addEventListener('click', () => {
            switchTab(tabScouterSpecOrder, scouterSpecOrderContent);
        });
    }

    chrome.storage.local.get(['remoteConfig'], (res) => {
        if (res.remoteConfig) {
            applyRemoteConfig(res.remoteConfig);
        }
    });
});

function applyRemoteConfig(remoteConfig) {
    const currentVersion = chrome.runtime.getManifest().version;

    // [강제 업데이트] 최소 요구 버전보다 낮으면 화면 전체를 덮어씌움
    if (remoteConfig.version && isVersionOutdated(currentVersion, remoteConfig.version.minRequired)) {
        document.body.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #cf1322; font-family: sans-serif;">
                <h3 style="margin-bottom: 8px;">⚠️ 업데이트가 필요합니다</h3>
                <p style="font-size: 12px; color: #666; line-height: 1.4;">
                    ${remoteConfig.version.updateMsg || '최신 버전으로 업데이트 후 이용해주세요.'}
                </p>
                <a href="${remoteConfig.version.updateUrl || '#'}" target="_blank" 
                   style="display: inline-block; margin-top: 12px; padding: 8px 16px; background: #1890ff; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 12px;">
                   스토어에서 업데이트하기
                </a>
            </div>
        `;
        return;
    }

    // 2️⃣ [wishList 설정 적용] (경매장 찜 목록 & 보관함 탭)
    if (remoteConfig.wishList) {
        const wishlistConf = remoteConfig.wishList;

        // 킬 스위치 (기능 비활성화 시)
        if (wishlistConf.enabled === false) {
            const wishlistArea = document.getElementById('wishlistContent');
            if (wishlistArea) {
                wishlistArea.style.opacity = '0.5';
                wishlistArea.style.pointerEvents = 'none'; // 클릭 차단
            }
        }

        // 공지 배너 출력 (wishList.notice.enabled가 true이고 메시지가 있을 때)
        if (wishlistConf.notice && wishlistConf.notice.enabled && wishlistConf.notice.noticeMsg?.trim()) {
            const msg = wishlistConf.notice.noticeMsg;
            // ① 1번 탭 (경매장 찜 목록) 상단 공지
            renderNoticeBanner('wishlistContent', 'wishlistNoticeBanner', msg);
            // ② 2번 탭 (환산 보관함 / 아이템 메이커) 상단 공지
            renderNoticeBanner('storageContent', 'storageNoticeBanner', msg);
        }
    }

    // 3️⃣ [specOrder 설정 적용] (스펙업 순서 분석 탭)
    if (remoteConfig.specOrder) {
        const specConf = remoteConfig.specOrder;

        // 킬 스위치 (버튼 비활성화)
        if (specConf.enabled === false) {
            const btn = document.getElementById('specOrderBtn');
            if (btn) {
                btn.disabled = true;
                btn.innerText = "🚧 스펙업 기능 임시 점검 중";
                btn.style.background = "#d9d9d9";
                btn.style.color = "#8c8c8c";
                btn.style.cursor = "not-allowed";
            }
        }

        // 공지 배너 출력 (specOrder.notice.enabled가 true이고 메시지가 있을 때)
        if (specConf.notice && specConf.notice.enabled && specConf.notice.noticeMsg?.trim()) {
            const msg = specConf.notice.noticeMsg;
            // ③ 3번 탭 (스펙업 순서) 상단 공지
            renderNoticeBanner('scouterSpecOrderContent', 'specOrderNoticeBanner', msg);
        }
    }
}

// 💡 지정된 컨테이너 최상단에 공지 배너 요소를 삽입해주는 헬퍼 함수
function renderNoticeBanner(containerId, bannerId, message) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 이미 배너가 있으면 메시지만 업데이트
    let noticeBanner = document.getElementById(bannerId);
    if (!noticeBanner) {
        noticeBanner = document.createElement('div');
        noticeBanner.id = bannerId;
        noticeBanner.style.cssText = `
        background: #fffbe6;
        border: 1px solid #ffe58f;
        padding: 8px 10px;
        margin-bottom: 10px;
        font-size: 11px;
        color: #d46b08;
        border-radius: 6px;
        font-weight: bold;
        line-height: 1.4;
        word-break: keep-all;
    `;
        container.insertBefore(noticeBanner, container.firstChild);
    }
    noticeBanner.innerText = `📢 공지: ${message}`;
}

// 💡 버전 비교 유틸리티 함수
function isVersionOutdated(current, required) {
    if (!required) return false;
    const cParts = current.split('.').map(Number);
    const rParts = required.split('.').map(Number);
    for (let i = 0; i < Math.max(cParts.length, rParts.length); i++) {
        const c = cParts[i] || 0;
        const r = rParts[i] || 0;
        if (c < r) return true;
        if (c > r) return false;
    }
    return false;
}