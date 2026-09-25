const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { mapToCalcFormat } = require('../src/mapper.js');
const {
    parseCharacterStore,
    normalizeStatKeys,
    extractItemCombatStats,
    findComparableEquippedItem,
    evaluateTotalSetStats,
    evaluateHermiteSpline,
    invertHermiteSpline,
    calculateItemFdIncrease,
    formatSimulBookmarkName,
    buildSimulBookmarkEntry
} = require('../src/fd_calculator.js');

test('1. 기본 파이프라인: 경매장 찜 아이템 -> 추가스펙(bookMarkSimulList) 포맷 및 로컬 최종뎀(eff) 산출 검증', () => {
    const auctionRaw = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'data', 'auction.json'), 'utf8')
    );
    const firstAuctionItem = auctionRaw.items[0];
    const mappedItem = mapToCalcFormat(firstAuctionItem);

    // 신규 소울 패치 대응 4개 필드 존재 검증 ("소울 이전 장비 복구" 버튼 방지)
    assert.deepEqual(mappedItem.soul_potential_option_1, [null, null, null]);
    assert.equal(mappedItem.soul_atk, '0');
    assert.equal(mappedItem.soul_potential_grade, null);
    assert.equal(mappedItem.soul_potential_amplified_grade, null);

    const mockCharStore = {
        state: {
            searchResult: {
                userApiData: {
                    info: { character_name: '낭만가득레테' },
                    stat: { level: '285' }
                },
                calculatedData: {
                    boss380_stat: 61035,
                    specEfficiency: {
                        dmgeff1: 0.001150441,
                        atkeff1: 0.000289432,
                        atkPereff1: 0.003934265,
                        cridmgeff1: 0.003929273,
                        igreff1_380: 0.000848543,
                        mainStateff1: 0.000088548,
                        mainStatPereff1: 0.001049797,
                        mainStatAbseff1: 0.000018034,
                        subStateff1: 0.000009287,
                        subStatPereff1: 0.000134491,
                        allStatEff: 0.001184288
                    },
                    myClassData: {
                        main: 'INT',
                        sub: 'LUK',
                        coolDownEff2s: 0.045
                    }
                },
                userEquipData: [
                    {
                        slot: mappedItem.slot,
                        part: mappedItem.part,
                        name: '기존 착용 장비',
                        starforce: '15',
                        totalOption: {
                            str: '40', dex: '40', int: '80', luk: '40',
                            attack_power: '10', magic_power: '10',
                            boss_damage: '0', ignore_monster_armor: '0', all_stat: '0', damage: '0'
                        },
                        potential_option_1: ['INT : +9%', '없음', '없음'],
                        additional_potential_option_1: ['없음', '없음', '없음']
                    }
                ]
            }
        }
    };

    const charContext = parseCharacterStore(mockCharStore);
    assert.equal(charContext.charName, '낭만가득레테');

    const { bookmarkEntry, calcDetail } = buildSimulBookmarkEntry(
        firstAuctionItem,
        mappedItem,
        charContext,
        '입력받은캐릭터'
    );

    assert.ok(bookmarkEntry.name.startsWith('추가스펙('));
    assert.ok(bookmarkEntry.name.endsWith(')'));
    assert.equal(typeof bookmarkEntry.eff, 'number');
    assert.equal(typeof bookmarkEntry.cost, 'number');
    assert.equal(bookmarkEntry.character, '입력받은캐릭터');
    assert.equal(bookmarkEntry.noTrade, false);
    assert.equal(calcDetail.isFallback, false);
});

test('2. 세트 효과 & 제네시스 무기 경계값: 해방 무기 vs 봉인된 무기, 3세트 이상 럭키아이템 발동 경계값 검증', () => {
    // Case A: 도전자 6부위 + 에테르넬 1부위 + 해방된 제네시스 스태프
    // -> 도전자(6 + 1 = 7세트 유지) + 에테르넬(1 + 1 = 2세트 발동: 공마+40, 보공+10%)
    const unsealedEquipList = [
        { slot: '무기', name: '제네시스 스태프' },
        { slot: '모자', name: '에테르넬 메이지햇' },
        { slot: '상의', name: '도전자의 상의' },
        { slot: '하의', name: '도전자의 하의' },
        { slot: '장갑', name: '도전자의 장갑' },
        { slot: '신발', name: '도전자의 신발' },
        { slot: '망토', name: '도전자의 망토' },
        { slot: '어깨장식', name: '도전자의 견장' }
    ];
    const unsealedTotals = evaluateTotalSetStats(unsealedEquipList);
    // 도전자 7세트 총합(공마 145, 보공 30, 올스탯 50, 방무 [10, 10]) + 에테 2세트(공마 40, 보공 10)
    assert.equal(unsealedTotals.atk, 145 + 40);
    assert.equal(unsealedTotals.bossDmg, 30 + 10);
    assert.equal(unsealedTotals.mainStat, 50);

    // Case B: 봉인된 제네시스 무기 착용 시 -> 에테르넬 +1 및 도전자 럭키아이템 +1 모두 미발동!
    const sealedEquipList = unsealedEquipList.map(eq =>
        eq.slot === '무기' ? { slot: '무기', name: '봉인된 제네시스 스태프' } : eq
    );
    const sealedTotals = evaluateTotalSetStats(sealedEquipList);
    // 도전자 6세트까지만 적용(7세트 공30/보공10 제외 -> 공115, 보공20) & 에테르넬 1부위(2세트 미발동)
    assert.equal(sealedTotals.atk, 115);
    assert.equal(sealedTotals.bossDmg, 20);

    // Case C: 하위 세트가 2부위뿐일 때(3세트 미만 경계값) -> 제네시스 무기 럭키아이템 +1 미적용
    const twoPieceChallenger = [
        { slot: '무기', name: '제네시스 스태프' },
        { slot: '상의', name: '도전자의 상의' },
        { slot: '하의', name: '도전자의 하의' }
    ];
    const twoPieceTotals = evaluateTotalSetStats(twoPieceChallenger);
    // 도전자 2세트(올스탯20, 공20)만 발동하고 3세트(공20, 방무10)는 발동하지 않아야 함
    assert.equal(twoPieceTotals.atk, 20);
    assert.equal(twoPieceTotals.ignoreDefList.length, 0);
});

test('3. 직업별 특수 스탯 경계값: 섀도어(이중 부스탯 배열 ["DEX","STR"]), 데몬어벤져(HP), 제논(3주스탯) 검증', () => {
    // 3-1. 섀도어 (낭만가득단도): myClassData.sub가 배열 ["DEX", "STR"]로 들어올 때 TypeError 없이 둘 다 합산
    const shadowerItem = {
        slot: '모자',
        part: '모자',
        name: '에테르넬 시프햇',
        totalOption: {
            luk: '150',
            dex: '80',
            str: '40',
            attack_power: '50',
            all_stat: '10'
        },
        potential_option_1: ['LUK : +12%', 'DEX : +9%', 'STR : +9%'],
        additional_potential_option_1: ['공격력 : +12', '없음', '없음']
    };
    const shadowerStats = extractItemCombatStats(shadowerItem, 'LUK', ['DEX', 'STR'], 280);
    assert.equal(shadowerStats.mainStat, 150);
    assert.equal(shadowerStats.subStat, 80 + 40); // DEX + STR 모두 부스탯 합산
    assert.equal(shadowerStats.mainStatPer, 12);
    assert.equal(shadowerStats.subStatPer, 9 + 9); // DEX% + STR% 모두 합산
    assert.equal(shadowerStats.atk, 50 + 12);

    // 3-2. 데몬어벤져: main이 "HP"로 들어올 때 max_hp 및 max_hp_rate, 최대 HP 잠재가 주스탯으로 작동하고 올스탯%는 무시
    const daItem = {
        slot: '반지1',
        part: '반지',
        name: '여명의 가디언 엔젤 링',
        totalOption: {
            max_hp: '5000',
            max_hp_rate: '10',
            attack_power: '30',
            all_stat: '6'
        },
        potential_option_1: ['최대 HP : +12%', '최대 HP : +9%', '올스탯 : +9%']
    };
    const daStats = extractItemCombatStats(daItem, 'HP', 'STR', 285);
    assert.equal(daStats.mainStat, 5000);
    assert.equal(daStats.mainStatPer, 10 + 12 + 9); // 기본 max_hp_rate 10% + 잠재 21% = 31%
    assert.equal(daStats.allStatPer, 0); // 데몬어벤져는 올스탯% 미적용
});

test('4. 다중 슬롯(펜던트/반지) 스마트 비교 및 시드링 보호 검증', () => {
    const equippedList = [
        {
            slot: '펜던트',
            part: '펜던트',
            name: '고통의 근원',
            totalOption: { int: '200', luk: '200', magic_power: '120', all_stat: '10' },
            potential_option_1: ['INT : +12%', 'INT : +9%', '올스탯 : +9%']
        },
        {
            slot: '펜던트2',
            part: '펜던트',
            name: '도미네이터 펜던트',
            totalOption: { int: '100', luk: '100', magic_power: '40', all_stat: '5' },
            potential_option_1: ['INT : +9%', 'INT : +6%', '없음']
        },
        {
            slot: '반지1',
            part: '반지',
            name: '리스트레인트 링',
            totalOption: { int: '4', luk: '4', magic_power: '4' },
            potential_option_1: ['없음', '없음', '없음']
        },
        {
            slot: '반지2',
            part: '반지',
            name: '마이링',
            totalOption: { int: '80', luk: '80', magic_power: '30' },
            potential_option_1: ['INT : +9%', '없음', '없음']
        }
    ];

    // 경매장에서 가져온 데이브레이크 펜던트(slot: '펜던트')는 강한 '고통의 근원'(펜던트)이 아니라 약한 '도미네이터 펜던트'(펜던트2)와 비교되어야 함!
    const newPendant = { slot: '펜던트', part: '펜던트', name: '데이브레이크 펜던트' };
    const matchedPendant = findComparableEquippedItem(newPendant, equippedList, 'int', 'luk', 285);
    assert.equal(matchedPendant.name, '도미네이터 펜던트');
    assert.equal(matchedPendant.slot, '펜던트2');

    // 경매장에서 가져온 거대한 공포(slot: '반지')는 스탯이 4인 '리스트레인트 링'(시드링)을 건드리지 않고 '마이링'과 비교되어야 함!
    const newRing = { slot: '반지', part: '반지', name: '거대한 공포' };
    const matchedRing = findComparableEquippedItem(newRing, equippedList, 'int', 'luk', 285);
    assert.equal(matchedRing.name, '마이링');
});

test('5. 무기 소울 옵션 및 보조무기 슬롯 매핑, 비정상 입력(Null/빈 슬롯) 방어 검증', () => {
    // 5-1. 무기 소울 옵션(마력 +3%) 및 신규 소울 잠재능력 반영 확인
    const weaponWithSoul = {
        slot: '무기',
        name: '제네시스 스태프',
        totalOption: { int: '300', magic_power: '900' },
        potential_option_1: ['마력 : +13%', '보스 몬스터 공격 시 데미지 : +40%', '마력 : +10%'],
        soul_option: '마력 : +3%',
        soul_potential_option_1: ['마력 : +6%', null, null]
    };
    const wStats = extractItemCombatStats(weaponWithSoul, 'int', 'luk', 285);
    assert.equal(wStats.atkPer, 13 + 10 + 3 + 6); // 잠재 23% + 소울 3% + 소울잠재 6% = 32%

    // 5-2. 에르미트 스플라인 정방향/역방향 일관성 검증
    const mockSpline = {
        x: [50000, 60000, 70000],
        y: [1000, 2000, 3500],
        m: [0.08, 0.12, 0.18]
    };
    const yAt62345 = evaluateHermiteSpline(mockSpline, 62345);
    const recoveredX = invertHermiteSpline(mockSpline, yAt62345);
    assert.equal(recoveredX, 62345);

    // 5-3. 보조무기(마도서, 단검용 검집 등) 슬롯 정규화 및 제논 3주스탯 마스킹 해제 검증
    const secondaryWeaponRaw = {
        toolTip: {
            reqJob: '마법사',
            categories: ['무기', '보조무기', '마도서'],
            itemName: '저주받은 청색 마도서',
            reqLevel: 160,
            stat: { int: '20', luk: '20', mad: '10' }
        }
    };
    const mappedSubWeapon = mapToCalcFormat(secondaryWeaponRaw);
    assert.equal(mappedSubWeapon.slot, '보조무기');

    const xenonItemRaw = {
        toolTip: {
            reqJob: '제논',
            categories: ['방어구', '모자'],
            itemName: '에테르넬 시프햇',
            reqLevel: 250,
            stat: { str: '65', dex: '65', luk: '65', int: '40', pad: '15' }
        }
    };
    const mappedXenon = mapToCalcFormat(xenonItemRaw);
    assert.equal(mappedXenon.totalOption.str, '65');
    assert.equal(mappedXenon.totalOption.dex, '65');
    assert.equal(mappedXenon.totalOption.luk, '65');
    assert.equal(mappedXenon.totalOption.int, '0'); // 제논에게 무효한 INT는 0 마스킹

    // 5-4. Null/Undefined 방어 검증
    assert.equal(parseCharacterStore(null), null);
    assert.equal(parseCharacterStore('{invalid json'), null);
    const emptyCalc = calculateItemFdIncrease(null, null);
    assert.equal(emptyCalc.eff, 0);
    assert.equal(emptyCalc.isFallback, true);
});

test('6. 직작 vs 완제 손익분기 가치평가(evaluateCraftVsBuy): 에테르넬 쿨뚝/아케인 크뎀장갑 및 가횟 감가 검증', () => {
    const { evaluateCraftVsBuy } = require('../src/fd_calculator.js');

    // 6-1. 0성 노작 에테르넬 모자는 직작 비교 배지 생략 (isEvaluated: false)
    const zeroStarBase = {
        name: '에테르넬 메이지햇',
        slot: '모자',
        starforce: '0',
        potential_grade: '',
        additional_potential_grade: '',
        totalOption: { base_equipment_level: 250 }
    };
    assert.equal(evaluateCraftVsBuy({ price: 700000000 }, zeroStarBase).isEvaluated, false);

    // 6-2. 17성 에테르넬 모자 (쿨 2초 + 주스탯 9%, 에디 에픽, 가횟 10) -> 직작 원가 약 81.2억
    const eternalCoolHat = {
        name: '에테르넬 메이지햇',
        slot: '모자',
        starforce: '17',
        potential_grade: '레전드리',
        potential_option_1: ['모든 스킬의 재사용 대기시간 : -2초', 'INT : +9%', '없음'],
        additional_potential_grade: '에픽',
        cuttable_count: '10',
        totalOption: { base_equipment_level: 250 }
    };

    // 68억 매물 -> 꿀매(GOOD)
    const dealGood = evaluateCraftVsBuy({ price: 6800000000 }, eternalCoolHat);
    assert.equal(dealGood.isEvaluated, true);
    assert.equal(dealGood.grade, 'GOOD');
    assert.ok(dealGood.badgeText.includes('꿀매'));

    // 82억 매물 -> 적정가(FAIR)
    const dealFair = evaluateCraftVsBuy({ price: 8200000000 }, eternalCoolHat);
    assert.equal(dealFair.grade, 'FAIR');

    // 98억 매물 -> 직작 추천(HIGH)
    const dealHigh = evaluateCraftVsBuy({ price: 9800000000 }, eternalCoolHat);
    assert.equal(dealHigh.grade, 'HIGH');

    // 6-3. 17성 아케인 크뎀+주스탯 장갑 (가횟 6 -> 0.85 감가 반영)
    const arcaneGlove = {
        name: '아케인셰이드 메이지글러브',
        slot: '장갑',
        starforce: '17',
        potential_grade: '레전드리',
        potential_option_1: ['크리티컬 데미지 : +8%', 'INT : +9%', '없음'],
        additional_potential_grade: '에픽',
        cuttable_count: '6',
        totalOption: { base_equipment_level: 200 }
    };
    const gloveEval = evaluateCraftVsBuy({ price: 2900000000 }, arcaneGlove);
    assert.equal(gloveEval.cutFactor, 0.85);
    assert.equal(gloveEval.grade, 'GOOD'); // 33.4억 대비 29억은 꿀매
});
