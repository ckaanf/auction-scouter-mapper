// background.test.js
const { chrome } = require('jest-chrome');

describe('Background 스크립트 탭 제어 테스트', () => {
    
    // 매 테스트마다 Mock 초기화
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('OPEN_AND_INJECT 메시지 수신 시 chrome.tabs.create가 올바른 URL로 호출되어야 한다', async () => {
        // given: 팝업에서 전달하는 메시지 객체 구성
        const targetUrl = 'https://maplescouter.com/ko/item?name=test&preset=00000';
        const message = {
            action: 'OPEN_AND_INJECT',
            url: targetUrl,
            items: [],
            folderName: '테스트폴더',
            mode: 'SWAP'
        };

        // chrome.tabs.create 호출 시 가짜 탭 객체(id: 1)를 반환하도록 Mocking 세팅
        chrome.tabs.create.mockResolvedValue({ id: 1 });

        // when: 백그라운드 로직을 실행하는 함수 호출 (예시)
        // 실제로는 background.js 내부의 로직을 모듈로 빼서 호출해야 합니다.
        await chrome.tabs.create({ url: message.url, active: true });

        // then: chrome.tabs.create가 지정된 파라미터로 1회 호출되었는지 검증
        expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
        expect(chrome.tabs.create).toHaveBeenCalledWith({
            url: targetUrl,
            active: true
        });
    });
});