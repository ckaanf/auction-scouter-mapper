// ============================================================================
// [src/fd_calculator.js]
// 환산 주스탯(Maplescouter) 1:1 역공학 최종 데미지(FD%) & 추가스펙(bookMarkSimulList) 엔진
// - chunk 3723 내부 세트효과/럭키아이템(제네시스/데스티니 무기) 판정 함수 1:1 이식
// - 동일 버킷 합산 + 이차 교차항(Bilinear Cross-Term) + 3차 에르미트 스플라인 역함수 적용
// - 외부 API 호출 0회 (100% 로컬 스토리지 character-store 데이터 기반 정책 준수)
// ============================================================================

(function (global) {
    // 환산 사이트(chunk 3723) 내부 장신구 세트 소속 아이템 테이블
    const SET_ITEM_MEMBERS = {
        "칠흑의 보스 세트": [
            "루즈 컨트롤 머신 마크", "마력이 깃든 안대", "검은 마법사의 뱃지", "창세의 뱃지",
            "고통의 근원", "몽환의 벨트", "저주받은 적색 마도서", "저주받은 청색 마도서",
            "저주받은 녹색 마도서", "저주받은 황색 마도서", "커맨더 포스 이어링", "거대한 공포",
            "미트라의 분노 : 전사", "미트라의 분노 : 마법사", "미트라의 분노 : 궁수",
            "미트라의 분노 : 도적", "미트라의 분노 : 해적", "컴플리트 언더컨트롤"
        ],
        "광휘의 보스 세트": [
            "근원의 속삭임", "죽음의 맹세", "불멸의 유산", "황홀한 악몽", "오만의 원죄", "굶주리는 핏빛 원혼"
        ],
        "여명의 보스 세트": [
            "트와일라이트 마크", "에스텔라 이어링", "데이브레이크 펜던트", "여명의 가디언 엔젤 링"
        ],
        "보스 장신구 세트": [
            "응축된 힘의 결정석", "아쿠아틱 레터 눈장식", "블랙빈 마크", "파풀라투스 마크",
            "실버블라썸 링", "고귀한 이피아의 반지", "가디언 엔젤 링", "마이스터 이어링",
            "데아 시두스 이어링", "지옥의 불꽃", "골든 클로버 벨트", "분노한 자쿰의 벨트",
            "혼테일의 목걸이", "카오스 혼테일의 목걸이", "매커네이터 펜던트", "도미네이터 펜던트",
            "로얄 블랙메탈 숄더", "핑크빛 성배", "영생의 돌", "크리스탈 웬투스 뱃지"
        ],
        "마이스터 세트": [
            "마이스터 이어링", "마이스터 링", "마이스터 숄더"
        ],
        "칠요 세트": [
            "칠요의 몬스터파커", "칠요의 뱃지"
        ]
    };

    // 환산 사이트(chunk 3723) 내부 세트 단계별 옵션 테이블 (1:1 이식)
    const SET_OPTION_TABLE = {
        "에테르넬 세트": [
            { set_count: 2, atk: 40, bossDmg: 10 },
            { set_count: 3, allStatFlat: 50, atk: 40, bossDmg: 10 },
            { set_count: 4, atk: 40, bossDmg: 10 },
            { set_count: 5, atk: 40, ignoreDef: 20 },
            { set_count: 6, atk: 40, bossDmg: 15 },
            { set_count: 7, allStatFlat: 50, atk: 40, bossDmg: 15 },
            { set_count: 8, atk: 40, bossDmg: 15 }
        ],
        "아케인셰이드 세트": [
            { set_count: 2, atk: 30, bossDmg: 10 },
            { set_count: 3, atk: 30, ignoreDef: 10 },
            { set_count: 4, allStatFlat: 50, atk: 35, bossDmg: 10 },
            { set_count: 5, atk: 40, bossDmg: 10 },
            { set_count: 6, atk: 30 },
            { set_count: 7, atk: 30, ignoreDef: 10 }
        ],
        "앱솔랩스 세트": [
            { set_count: 2, atk: 20, bossDmg: 10 },
            { set_count: 3, allStatFlat: 30, atk: 20, bossDmg: 10 },
            { set_count: 4, atk: 25, ignoreDef: 10 },
            { set_count: 5, atk: 30, bossDmg: 10 },
            { set_count: 6, atk: 20 },
            { set_count: 7, atk: 20, ignoreDef: 10 }
        ],
        "도전자의 장비 세트": [
            { set_count: 2, allStatFlat: 20, atk: 20 },
            { set_count: 3, atk: 20, ignoreDef: 10 },
            { set_count: 4, allStatFlat: 30, atk: 20, bossDmg: 10 },
            { set_count: 5, atk: 25, bossDmg: 10 },
            { set_count: 6, atk: 30, ignoreDef: 10 },
            { set_count: 7, atk: 30, bossDmg: 10 }
        ],
        "루타비스 세트": [
            { set_count: 2, mainStatFlat: 20, subStatFlat: 20 },
            { set_count: 3, atk: 50 },
            { set_count: 4, bossDmg: 30 }
        ],
        "마이스터 세트": [
            { set_count: 2 },
            { set_count: 3, atk: 40 },
            { set_count: 4, bossDmg: 20 }
        ],
        "칠흑의 보스 세트": [
            { set_count: 2, allStatFlat: 10, atk: 10, bossDmg: 10 },
            { set_count: 3, allStatFlat: 10, atk: 10, ignoreDef: 10 },
            { set_count: 4, allStatFlat: 15, atk: 15, criDmg: 5 },
            { set_count: 5, allStatFlat: 15, atk: 15, bossDmg: 10 },
            { set_count: 6, allStatFlat: 15, atk: 15, ignoreDef: 10 },
            { set_count: 7, allStatFlat: 15, atk: 15, criDmg: 5 },
            { set_count: 8, allStatFlat: 15, atk: 15, bossDmg: 10 },
            { set_count: 9, allStatFlat: 15, atk: 15, criDmg: 5 },
            { set_count: 10, allStatFlat: 20, atk: 20, bossDmg: 10 }
        ],
        "광휘의 보스 세트": [
            { set_count: 2, allStatFlat: 20, atk: 20, bossDmg: 15 },
            { set_count: 3, allStatFlat: 20, atk: 20, ignoreDef: 15 },
            { set_count: 4, allStatFlat: 20, atk: 20, criDmg: 5 },
            { set_count: 5, allStatFlat: 20, atk: 20, bossDmg: 15 },
            { set_count: 6, allStatFlat: 20, atk: 20, criDmg: 7.5 }
        ],
        "여명의 보스 세트": [
            { set_count: 2, allStatFlat: 10, atk: 10, bossDmg: 10 },
            { set_count: 3, allStatFlat: 10, atk: 10 },
            { set_count: 4, allStatFlat: 10, atk: 10, ignoreDef: 10 }
        ],
        "보스 장신구 세트": [
            { set_count: 3, allStatFlat: 10, atk: 5 },
            { set_count: 5, allStatFlat: 10, atk: 5 },
            { set_count: 7, allStatFlat: 10, atk: 5, ignoreDef: 10 },
            { set_count: 9, allStatFlat: 15, atk: 10, bossDmg: 10 }
        ],
        "칠요 세트": [
            { set_count: 2, ignoreDef: 10 }
        ]
    };

    /**
     * 환산 사이트(chunk 3723)의 function l(e, t, i) 세트 및 럭키아이템(제네시스 무기 등) 판정 1:1 이식
     */
    function evaluateTotalSetStats(equipList) {
        const totals = {
            mainStat: 0,
            subStat: 0,
            atk: 0,
            bossDmg: 0,
            criDmg: 0,
            ignoreDefList: []
        };

        if (!Array.isArray(equipList) || equipList.length === 0) return totals;

        const counts = {
            "에테르넬 세트": 0,
            "아케인셰이드 세트": 0,
            "앱솔랩스 세트": 0,
            "루타비스 세트": 0,
            "광휘의 보스 세트": 0,
            "칠흑의 보스 세트": 0,
            "여명의 보스 세트": 0,
            "보스 장신구 세트": 0,
            "칠요 세트": 0,
            "마이스터 세트": 0,
            "도전자의 장비 세트": 0
        };

        let hasGenesisWeapon = false; // u
        let hasChaosRootHat = false;  // d
        let luckyApplied = false;     // S

        for (const item of equipList) {
            if (!item || !item.name) continue;
            const slot = item.slot || item.item_equipment_slot || "";
            if (slot === "예비 특수 반지") continue;

            const name = String(item.name || item.item_name || "").trim();

            // 1. 제네시스 / 데스티니 무기 판별
            const isUnsealedGenOrDest =
                (name.includes("제네시스") || name.includes("데스티니")) &&
                !name.includes("봉인된") &&
                !name.includes("라이온하트") &&
                !name.includes("라즐리");

            if (isUnsealedGenOrDest) {
                hasGenesisWeapon = true;
            }

            if (
                name === "카오스 벨룸의 헬름" ||
                name === "카오스 퀸의 티아라" ||
                name === "카오스 반반 투구" ||
                name === "카오스 피에르 모자"
            ) {
                hasChaosRootHat = true;
            }

            // 2. 에테르넬 세트 (chunk 3723: 에테르넬 장비 및 해방된 제네시스/데스티니 무기는 기본 +1)
            if (name.includes("에테르넬") || isUnsealedGenOrDest) {
                counts["에테르넬 세트"] += 1;
            }

            // 3. 방어구 및 장신구 세트 카운팅
            if (name.includes("아케인셰이드") && !slot.includes("보조무기")) {
                counts["아케인셰이드 세트"] += 1;
            } else if (name.includes("앱솔랩스") && !slot.includes("보조무기")) {
                counts["앱솔랩스 세트"] += 1;
            } else if (
                (name.includes("하이네스") || name.includes("트릭스터") || name.includes("이글아이") || name.includes("파프니르")) &&
                !slot.includes("보조무기")
            ) {
                counts["루타비스 세트"] += 1;
            } else if (SET_ITEM_MEMBERS["광휘의 보스 세트"].includes(name)) {
                counts["광휘의 보스 세트"] += 1;
            } else if (SET_ITEM_MEMBERS["칠흑의 보스 세트"].includes(name)) {
                counts["칠흑의 보스 세트"] += 1;
            } else if (SET_ITEM_MEMBERS["여명의 보스 세트"].includes(name)) {
                counts["여명의 보스 세트"] += 1;
            } else if (SET_ITEM_MEMBERS["보스 장신구 세트"].includes(name)) {
                counts["보스 장신구 세트"] += 1;
            } else if (SET_ITEM_MEMBERS["칠요 세트"].includes(name)) {
                counts["칠요 세트"] += 1;
            } else if (SET_ITEM_MEMBERS["마이스터 세트"].includes(name)) {
                counts["마이스터 세트"] += 1;
            } else if (name.includes("도전자의")) {
                counts["도전자의 장비 세트"] += 1;
            }
        }

        // 4. 카오스 루타비스 럭키 모자(d) 적용
        if (hasChaosRootHat) {
            ["루타비스 세트", "앱솔랩스 세트", "아케인셰이드 세트", "에테르넬 세트", "도전자의 장비 세트"].forEach(setName => {
                if (counts[setName] >= 3) {
                    counts[setName] += 1;
                    luckyApplied = true;
                }
            });
        }

        // 5. 해방된 제네시스/데스티니 무기(u) 럭키 아이템 적용 (chunk 3723 1:1 이식)
        // 3세트 이상 착용 중인 모든 하위 방어구 세트(루타비스, 앱솔랩스, 아케인셰이드, 마이스터, 도전자의 장비 세트)에 +1세트 부여!
        if (hasGenesisWeapon && !luckyApplied) {
            ["루타비스 세트", "앱솔랩스 세트", "아케인셰이드 세트", "마이스터 세트", "도전자의 장비 세트"].forEach(setName => {
                if (counts[setName] >= 3) {
                    counts[setName] += 1;
                    luckyApplied = true;
                }
            });
        }

        // 6. 활성화된 세트 옵션 합산
        Object.keys(counts).forEach(setName => {
            const count = counts[setName];
            const tiers = SET_OPTION_TABLE[setName] || [];
            tiers.forEach(tier => {
                if (tier.set_count <= count) {
                    if (tier.allStatFlat) {
                        totals.mainStat += tier.allStatFlat;
                        totals.subStat += tier.allStatFlat;
                    }
                    if (tier.mainStatFlat) totals.mainStat += tier.mainStatFlat;
                    if (tier.subStatFlat) totals.subStat += tier.subStatFlat;
                    if (tier.atk) totals.atk += tier.atk;
                    if (tier.bossDmg) totals.bossDmg += tier.bossDmg;
                    if (tier.criDmg) totals.criDmg += tier.criDmg;
                    if (tier.ignoreDef) totals.ignoreDefList.push(tier.ignoreDef);
                }
            });
        });

        return totals;
    }

    /**
     * 환산 사이트(chunk 3723 module 62509) 3차 에르미트 스플라인(Cubic Hermite Spline) 정방향/역방향 함수
     */
    function evaluateHermiteSpline(spline, xVal) {
        const { x, y, m } = spline;
        const n = x.length;
        if (xVal < x[0]) return y[0] + (xVal - x[0]) * m[0];
        if (xVal <= x[n - 1]) {
            let idx = n - 2;
            for (let i = 0; i < n - 1; i++) {
                if (xVal >= x[i] && xVal <= x[i + 1]) {
                    idx = i;
                    break;
                }
            }
            const h = x[idx + 1] - x[idx];
            const t = (xVal - x[idx]) / h;
            const t2 = t * t;
            const t3 = t2 * t;
            return (
                (2 * t3 - 3 * t2 + 1) * y[idx] +
                (t3 - 2 * t2 + t) * h * m[idx] +
                (-2 * t3 + 3 * t2) * y[idx + 1] +
                (t3 - t2) * h * m[idx + 1]
            );
        }
        const lastX = x[n - 1];
        return y[n - 1] + (xVal - lastX) * Math.max(m[n - 1], 1e-9);
    }

    function invertHermiteSpline(spline, targetY, iterations = 40) {
        if (!spline || !Array.isArray(spline.x) || spline.x.length < 2) return null;
        const { x, y, m } = spline;
        const n = x.length;
        if (targetY <= y[0]) {
            const slope = Math.max(m[0], 1e-9);
            return Math.round(x[0] + (targetY - y[0]) / slope);
        }
        if (targetY >= y[n - 1]) {
            return Math.round(x[n - 1] + (targetY - y[n - 1]) / Math.max(m[n - 1], 1e-9));
        }
        let lo = x[0];
        let hi = x[n - 1];
        for (let i = 0; i < iterations; i++) {
            const mid = (lo + hi) / 2;
            if (evaluateHermiteSpline(spline, mid) < targetY) {
                lo = mid;
            } else {
                hi = mid;
            }
        }
        return Math.round((lo + hi) / 2);
    }

    /**
     * character-store JSON 문자열 또는 객체에서 계산에 필요한 베이스라인 추출
     */
    function parseCharacterStore(rawStore) {
        if (!rawStore) return null;
        try {
            const parsed = typeof rawStore === "string" ? JSON.parse(rawStore) : rawStore;
            const root = parsed?.state?.searchResult || parsed?.state || parsed;
            if (!root) return null;

            const calcData = root.calculatedData || {};
            const specEfficiency = calcData.specEfficiency || null;
            const myClassData = calcData.myClassData || {};
            const userEquipData = Array.isArray(root.userEquipData) ? root.userEquipData : [];

            const charName =
                root.userApiData?.info?.character_name ||
                root.info?.character_name ||
                root.stat?.myClass ||
                "Unknown";

            const charLevel = Number(
                root.userApiData?.stat?.level ||
                root.stat?.level ||
                285
            );

            return {
                charName,
                charLevel,
                specEfficiency,
                myClassData,
                userEquipData,
                calculatedDamage380: Number(calcData.calculatedDamage_380 || 0),
                boss380Stat: Number(calcData.boss380_stat || 0),
                boss380HexaStat: Number(calcData.boss380_hexaStat || 0),
                spline380: calcData.spline_380 || null
            };
        } catch (e) {
            console.warn("[FD Calculator] character-store 파싱 실패:", e);
            return null;
        }
    }

    /**
     * 주스탯/부스탯 키 정규화 헬퍼
     * - 데몬어벤져("HP" / "MAX_HP" -> "max_hp")
     * - 섀도어/듀얼블레이드/카데나 다중 부스탯(["DEX", "STR"] 또는 "DEX,STR" -> ["dex", "str"])
     * - 제논 다중 주스탯(["STR", "DEX", "LUK"] -> ["str", "dex", "luk"])
     */
    function normalizeStatKeys(rawKeyOrList, defaultKey) {
        if (!rawKeyOrList) return [defaultKey];
        const rawArr = Array.isArray(rawKeyOrList)
            ? rawKeyOrList
            : String(rawKeyOrList).split(/[,\s/]+/).filter(Boolean);
        const mapped = rawArr.map(k => {
            const lower = String(k).trim().toLowerCase();
            if (lower === "hp" || lower === "max_hp" || lower === "최대hp") return "max_hp";
            return lower;
        }).filter(Boolean);
        return mapped.length > 0 ? mapped : [defaultKey];
    }

    /**
     * 아이템 객체(mapToCalcFormat 또는 userEquipData 원소)에서 전투 스탯 추출
     */
    function extractItemCombatStats(item, mainKey = "int", subKey = "luk", charLevel = 285) {
        const stats = {
            mainStat: 0,
            subStat: 0,
            mainStatPer: 0,
            subStatPer: 0,
            mainStatAbs: 0,
            allStatPer: 0,
            atk: 0,
            atkPer: 0,
            criDmg: 0,
            bossDmg: 0,
            ignoreDefList: [],
            cooldownSec: 0
        };

        if (!item) return stats;

        const mainKeys = normalizeStatKeys(mainKey, "int");
        const subKeys = normalizeStatKeys(subKey, "luk").filter(k => !mainKeys.includes(k));
        const primaryMain = mainKeys[0];

        const atkKey = primaryMain === "int" ? "magic_power" : "attack_power";
        const mainLabels = mainKeys.map(k => (k === "max_hp" ? "최대 HP" : k.toUpperCase()));
        const subLabels = subKeys.map(k => (k === "max_hp" ? "최대 HP" : k.toUpperCase()));
        const atkLabel = primaryMain === "int" ? "마력" : "공격력";

        // 1. totalOption (기본+추옵+작+스타포스 합산 스탯)
        const tot = item.totalOption || {};
        mainKeys.forEach(mk => {
            stats.mainStat += Number(tot[mk] || 0);
        });
        if (mainKeys.includes("max_hp")) {
            stats.mainStatPer += Number(tot.max_hp_rate || 0);
        }

        subKeys.forEach(sk => {
            if (tot[sk] !== undefined) {
                stats.subStat += Number(tot[sk] || 0);
            }
        });

        stats.atk += Number(tot[atkKey] || 0);
        if (!mainKeys.includes("max_hp")) {
            stats.allStatPer += Number(tot.all_stat || 0);
        }
        stats.bossDmg += Number(tot.boss_damage || 0) + Number(tot.damage || 0);

        const baseIgr = Number(tot.ignore_monster_armor || 0);
        if (baseIgr > 0) stats.ignoreDefList.push(baseIgr);

        // 2. 잠재능력 + 에디셔널 잠재능력 + 소울 옵션/소울 잠재능력 파싱
        const potLines = [
            ...(Array.isArray(item.potential_option_1) ? item.potential_option_1 : []),
            ...(Array.isArray(item.additional_potential_option_1) ? item.additional_potential_option_1 : []),
            ...(item.soul_option ? [item.soul_option] : []),
            ...(Array.isArray(item.soul_potential_option_1) ? item.soul_potential_option_1 : [])
        ];

        potLines.forEach((rawLine) => {
            if (!rawLine || rawLine === "없음") return;
            const line = String(rawLine).trim();

            const numMatch = line.match(/([+-]?\d+(?:\.\d+)?)/);
            if (!numMatch) return;
            const val = Math.abs(parseFloat(numMatch[1]));
            const isPercent = line.includes("%");

            // (a) 쿨타임 감소 ("스킬 재사용 대기시간 -2초", "모든 스킬의 재사용 대기시간 : -2초")
            if (line.includes("재사용 대기시간")) {
                const secMatch = line.match(/-\s*(\d+)\s*초/);
                if (secMatch) {
                    stats.cooldownSec += parseInt(secMatch[1], 10);
                }
                return;
            }

            // (b) 캐릭터 기준 N레벨 당 스탯
            if (line.includes("레벨 당") || line.includes("레벨당")) {
                const lvMatch = line.match(/(\d+)\s*레벨\s*당.*?\+\s*(\d+)/);
                if (lvMatch) {
                    const perLv = parseInt(lvMatch[1], 10) || 9;
                    const inc = parseInt(lvMatch[2], 10) || 0;
                    if (mainLabels.some(lbl => line.includes(lbl)) || line.includes("올스탯")) {
                        stats.mainStatAbs += Math.floor(charLevel / perLv) * inc;
                    }
                }
                return;
            }

            // (c) 크리티컬 데미지
            if (line.includes("크리티컬 데미지")) {
                stats.criDmg += val;
                return;
            }

            // (d) 보스 데미지 / 일반 데미지
            if (line.includes("보스 몬스터") || line.startsWith("데미지")) {
                if (isPercent) stats.bossDmg += val;
                return;
            }

            // (e) 방어율 무시
            if (line.includes("방어율 무시")) {
                if (isPercent) stats.ignoreDefList.push(val);
                return;
            }

            // (f) 올스탯 (데몬어벤져는 올스탯 미적용)
            if (line.includes("올스탯")) {
                if (!mainKeys.includes("max_hp")) {
                    if (isPercent) {
                        stats.allStatPer += val;
                    } else {
                        stats.mainStat += val * mainKeys.length;
                        stats.subStat += val * subKeys.length;
                    }
                }
                return;
            }

            // (g) 공격력 / 마력
            if (line.includes(atkLabel)) {
                if (isPercent) {
                    stats.atkPer += val;
                } else {
                    stats.atk += val;
                }
                return;
            }

            // (h) 주스탯 (단일/다중 주스탯 및 최대 HP 대응)
            const isMainLine = mainLabels.some(lbl =>
                lbl === "최대 HP" ? (line.includes("최대 HP") || line.startsWith("HP")) : line.startsWith(lbl)
            );
            if (isMainLine) {
                if (isPercent) {
                    stats.mainStatPer += val;
                } else {
                    stats.mainStat += val;
                }
                return;
            }

            // (i) 부스탯 (단일 및 섀도어/듀블/카데나 이중 부스탯 대응)
            const isSubLine = subLabels.some(lbl => line.startsWith(lbl));
            if (isSubLine) {
                if (isPercent) {
                    stats.subStatPer += val;
                } else {
                    stats.subStat += val;
                }
            }
        });

        return stats;
    }

    const SLOT_NORMALIZATION_MAP = {
        "배지": "배지",
        "뱃지": "배지",
        "기계 심장": "기계 심장",
        "기계심장": "기계 심장",
        "심장": "기계 심장",
        "하트": "기계 심장",
        "포켓": "포켓 아이템",
        "포켓 아이템": "포켓 아이템",
        "어깨": "어깨장식",
        "어깨장식": "어깨장식",
        "얼장": "얼굴장식",
        "얼굴장식": "얼굴장식",
        "눈장식": "눈장식",
        "귀걸이": "귀고리",
        "귀고리": "귀고리",
        "모자": "모자",
        "상의": "상의",
        "하의": "하의",
        "한벌옷": "상의",
        "신발": "신발",
        "장갑": "장갑",
        "망토": "망토",
        "벨트": "벨트",
        "훈장": "훈장",
        "무기": "무기",
        "엠블렘": "엠블렘",
        "반지": "반지",
        "특수 반지": "반지",
        "특수반지": "반지"
    };

    const SEED_RING_REGEX = /(리스트레인트|컨티뉴어스|웨폰퍼프|리스크테이커|링 오브 썸|크라이시스|레벨퍼프|듀얼블로우|얼티메이텀|헬스컷|마나컷|회복의 링|리밋 링)/;

    function isSeedRing(name) {
        return SEED_RING_REGEX.test(name || "");
    }

    function getSeedRingFamily(name) {
        if (!name) return "";
        const s = String(name).trim();
        const match = s.match(/(리스트레인트|컨티뉴어스|웨폰퍼프\s*-\s*[SDIL]|웨폰퍼프|리스크테이커|링 오브 썸|크라이시스\s*-\s*[HM]|크라이시스|레벨퍼프\s*-\s*[SDIL]|레벨퍼프|듀얼블로우|얼티메이텀|헬스컷|마나컷|회복의 링|리밋 링)/);
        return match ? match[0].replace(/\s+/g, " ").trim() : "";
    }

    function extractSeedRingLevel(name) {
        if (!name) return 0;
        const match = String(name).match(/([1-4])\s*레벨/);
        return match ? parseInt(match[1], 10) : 0;
    }

    const SEED_RING_BENCHMARK_FD = {
        "리스트레인트": { "3->4": 2.85, "2->4": 5.20, "1->4": 7.20, "2->3": 2.35, "1->3": 4.35, "1->2": 2.00 },
        "컨티뉴어스": { "3->4": 2.60, "2->4": 4.80, "1->4": 6.70, "2->3": 2.20, "1->3": 4.10, "1->2": 1.90 },
        "웨폰퍼프": { "3->4": 2.30, "2->4": 4.30, "1->4": 6.10, "2->3": 2.00, "1->3": 3.80, "1->2": 1.80 },
        "리스크테이커": { "3->4": 2.10, "2->4": 3.90, "1->4": 5.60, "2->3": 1.80, "1->3": 3.50, "1->2": 1.70 }
    };

    function getSeedRingFdEstimate(newFamily, oldLv, newLv) {
        if (newLv <= oldLv || oldLv <= 0 || newLv <= 0) return 0;
        const key = `${oldLv}->${newLv}`;
        const baseKey = Object.keys(SEED_RING_BENCHMARK_FD).find(k => newFamily.includes(k));
        if (baseKey && SEED_RING_BENCHMARK_FD[baseKey][key]) {
            return SEED_RING_BENCHMARK_FD[baseKey][key];
        }
        if (key === "3->4") return 1.80;
        if (key === "2->4") return 3.20;
        if (key === "1->4") return 4.50;
        return 1.20;
    }

    function normalizeSlotName(str) {
        if (!str) return "";
        const s = String(str).trim();
        if (s === "예비 특수 반지" || s === "예비특수반지") return "예비 특수 반지";
        if (s.startsWith("펜던트")) return "펜던트";
        if (s.startsWith("반지")) return "반지";
        if (s.includes("특수 반지") || s.includes("특수반지")) return "반지";
        if (SLOT_NORMALIZATION_MAP[s]) return SLOT_NORMALIZATION_MAP[s];
        if (s.includes("보조무기") || s.includes("방패") || s.includes("포스실드") || s.includes("소울링") || s.includes("블레이드") || s.includes("마도서")) {
            return "보조무기";
        }
        return s;
    }

    /**
     * 비교 대상 슬롯의 현재 장착 장비 찾기
     * - 펜던트(펜던트/펜던트1/펜던트2) 및 반지(반지1~4) 다중 슬롯은
     *   동일 이름 매칭 우선 -> 가장 전투력이 낮은 슬롯과 스마트 비교
     * - 배지/뱃지, 기계심장/하트, 포켓 등 명칭 불일치를 SLOT_NORMALIZATION_MAP으로 100% 정규화 매칭
     * - 특수 반지(시드링) 찜 시 기존 시드링 슬롯과 1:1 매칭, 일반 반지 찜 시 시드링 완벽 보호
     */
    function findComparableEquippedItem(newItem, userEquipData, mainKey = "int", subKey = "luk", charLevel = 285) {
        if (!Array.isArray(userEquipData) || userEquipData.length === 0 || !newItem) return null;

        const slot = newItem.slot || "";
        const part = newItem.part || "";
        const normNewSlot = normalizeSlotName(slot || part);

        // 1. 펜던트 다중 슬롯 스마트 비교 ("펜던트", "펜던트1", "펜던트2")
        if (normNewSlot === "펜던트") {
            const pendants = userEquipData.filter(
                eq => eq && eq.name && normalizeSlotName(eq.slot || eq.part) === "펜던트"
            );
            if (pendants.length === 0) return null;
            const cleanNewName = (newItem.name || "").replace("피어스 ", "").trim();
            const sameNameMatch = pendants.find(eq => (eq.name || "").replace("피어스 ", "").trim() === cleanNewName);
            if (sameNameMatch) return sameNameMatch;

            return [...pendants].sort((a, b) => {
                const sa = extractItemCombatStats(a, mainKey, subKey, charLevel);
                const sb = extractItemCombatStats(b, mainKey, subKey, charLevel);
                return (sa.mainStat + sa.mainStatPer * 12 + sa.atk * 3.5) - (sb.mainStat + sb.mainStatPer * 12 + sb.atk * 3.5);
            })[0];
        }

        // 2. 반지 다중 슬롯 스마트 비교 ("반지", "반지1"~"반지4", "특수 반지")
        if (normNewSlot === "반지") {
            const rings = userEquipData.filter(
                eq => eq && eq.name && normalizeSlotName(eq.slot || eq.part) === "반지"
            );
            if (rings.length === 0) return null;

            // 이름 완벽 일치 우선 (예: 기존과 동일한 반지를 직작/완제로 교체 시)
            const exactSameRing = rings.find(eq => eq.name === newItem.name);
            if (exactSameRing) return exactSameRing;

            const isNewSeed = isSeedRing(newItem.name);

            if (isNewSeed) {
                // (A) 경매장 찜 아이템이 시드링(특수 반지)인 경우
                // 1순위: 동일 시드링 계열 매칭 (예: '리스트레인트 링 4레벨' -> 착용 중인 '리스트레인트 링 3레벨')
                const newFamily = getSeedRingFamily(newItem.name);
                if (newFamily) {
                    const sameFamilySeed = rings.find(eq => eq && eq.name && getSeedRingFamily(eq.name) === newFamily);
                    if (sameFamilySeed) return sameFamilySeed;
                }

                // 2순위: 착용 중인 다른 시드링 슬롯 매칭 (예: 컨티뉴어스 링 끼고 있는데 리레 링 매수 고려)
                const equippedAnySeed = rings.find(eq => eq && isSeedRing(eq.name));
                if (equippedAnySeed) return equippedAnySeed;

                // 3순위: 착용 중인 시드링이 없는 경우(4일반 반지 착용 유저) -> 가장 약한 일반 반지 슬롯 반환
                const sortedRegular = [...rings].sort((a, b) => {
                    const sa = extractItemCombatStats(a, mainKey, subKey, charLevel);
                    const sb = extractItemCombatStats(b, mainKey, subKey, charLevel);
                    return (sa.mainStat + sa.mainStatPer * 12 + sa.atk * 3.5) - (sb.mainStat + sb.mainStatPer * 12 + sb.atk * 3.5);
                });
                return sortedRegular[0];
            } else {
                // (B) 경매장 찜 아이템이 일반 스탯 반지인 경우
                // 착용 중인 시드링은 절대 건드리지 않고, 일반 반지 중 가장 약한 반지와 비교!
                const nonSeedRings = rings.filter(eq => !isSeedRing(eq.name));
                const candidates = nonSeedRings.length > 0 ? nonSeedRings : rings;

                return [...candidates].sort((a, b) => {
                    const sa = extractItemCombatStats(a, mainKey, subKey, charLevel);
                    const sb = extractItemCombatStats(b, mainKey, subKey, charLevel);
                    return (sa.mainStat + sa.mainStatPer * 12 + sa.atk * 3.5) - (sb.mainStat + sb.mainStatPer * 12 + sb.atk * 3.5);
                })[0];
            }
        }

        // 3. 단일 슬롯 정규화 매칭 (배지/뱃지, 기계 심장/하트, 포켓 등 완벽 호환)
        const exactNormMatch = userEquipData.find(
            eq => eq && eq.name && normalizeSlotName(eq.slot || eq.part) === normNewSlot
        );
        if (exactNormMatch) return exactNormMatch;

        return userEquipData.find(eq => eq && eq.name && (eq.slot === slot || eq.part === part)) || null;
    }

    /**
     * 역공학 버킷 수식 + 1:1 세트/럭키아이템 판정 + 에르미트 스플라인 기반 로컬 최종뎀(eff) 산출
     */
    function calculateItemFdIncrease(mappedItem, charContext) {
        if (!mappedItem) {
            return { eff: 0, hwanDiff: 0, hexaDiff: 0, targetSlot: "", oldItemName: "정보 없음", isFallback: true };
        }

        const eff = charContext?.specEfficiency || {
            dmgeff1: 0.001150441,
            atkeff1: 0.000289433,
            atkPereff1: 0.003934266,
            cridmgeff1: 0.003929273,
            igreff1_380: 0.000848544,
            igreff1: 0.000658146,
            mainStateff1: 0.000088549,
            mainStatPereff1: 0.001049797,
            mainStatAbseff1: 0.000018034,
            subStateff1: 0.000009288,
            subStatPereff1: 0.000134491,
            subStatAbseff1: 0.000004509,
            allStatEff: 0.001184288
        };

        const mainKeys = normalizeStatKeys(charContext?.myClassData?.main, "int");
        const subKeys = normalizeStatKeys(charContext?.myClassData?.sub, "luk");
        const charLevel = charContext?.charLevel || 285;
        const equipList = charContext?.userEquipData || [];

        const oldItem = findComparableEquippedItem(mappedItem, equipList, mainKeys, subKeys, charLevel);
        const newStats = extractItemCombatStats(mappedItem, mainKeys, subKeys, charLevel);
        const oldStats = extractItemCombatStats(oldItem, mainKeys, subKeys, charLevel);

        // 장착 전/후 24부위 전체 세트효과 + 제네시스 럭키아이템 시너지 1:1 비교 (미착용 빈 슬롯 장착 케이스 포함)
        let setDelta = { mainStat: 0, subStat: 0, atk: 0, bossDmg: 0, criDmg: 0, oldIgrList: [], newIgrList: [] };
        if (equipList.length > 0) {
            const beforeSetTotals = evaluateTotalSetStats(equipList);
            const swappedEquipList = oldItem
                ? equipList.map(eq => (eq === oldItem ? { ...mappedItem, slot: oldItem.slot } : eq))
                : [...equipList, mappedItem];
            const afterSetTotals = evaluateTotalSetStats(swappedEquipList);

            setDelta.mainStat = afterSetTotals.mainStat - beforeSetTotals.mainStat;
            setDelta.subStat = afterSetTotals.subStat - beforeSetTotals.subStat;
            setDelta.atk = afterSetTotals.atk - beforeSetTotals.atk;
            setDelta.bossDmg = afterSetTotals.bossDmg - beforeSetTotals.bossDmg;
            setDelta.criDmg = afterSetTotals.criDmg - beforeSetTotals.criDmg;
            setDelta.oldIgrList = beforeSetTotals.ignoreDefList;
            setDelta.newIgrList = afterSetTotals.ignoreDefList;
        }

        const dMain = (newStats.mainStat - oldStats.mainStat) + setDelta.mainStat;
        const dSub = (newStats.subStat - oldStats.subStat) + setDelta.subStat;
        const dMainPer = newStats.mainStatPer - oldStats.mainStatPer;
        const dSubPer = newStats.subStatPer - oldStats.subStatPer;
        const dMainAbs = newStats.mainStatAbs - oldStats.mainStatAbs;
        const dAllPer = newStats.allStatPer - oldStats.allStatPer;
        const dAtk = (newStats.atk - oldStats.atk) + setDelta.atk;
        const dAtkPer = newStats.atkPer - oldStats.atkPer;
        const dCriDmg = (newStats.criDmg - oldStats.criDmg) + setDelta.criDmg;
        const dBossDmg = (newStats.bossDmg - oldStats.bossDmg) + setDelta.bossDmg;

        // 1. 스탯 버킷 (동일 버킷 내부 선형 합산 + dMain * dStatPer 이차 교차항 보정)
        const mainStateff1 = eff.mainStateff1 || 0.000088549;
        const mainStatPereff1 = eff.mainStatPereff1 || 0.001049797;
        const mainStatAbseff1 = eff.mainStatAbseff1 || 0.000018034;
        const subStateff1 = eff.subStateff1 || 0.000009288;
        const subStatPereff1 = eff.subStatPereff1 || 0.000134491;
        const subStatAbseff1 = eff.subStatAbseff1 || 0.000004509;
        const allStatEff = eff.allStatEff || 0.001184288;

        const crossMain = dMain * ((dMainPer + dAllPer) / 100.0) * mainStatAbseff1;
        const crossSub = dSub * ((dSubPer + dAllPer) / 100.0) * subStatAbseff1;

        const statMult =
            1.0 +
            dMain * mainStateff1 +
            dMainPer * mainStatPereff1 +
            dAllPer * allStatEff +
            dMainAbs * mainStatAbseff1 +
            dSub * subStateff1 +
            dSubPer * subStatPereff1 +
            crossMain +
            crossSub;

        // 2. 공격력/마력 버킷
        const atkeff1 = eff.atkeff1 || 0.000289433;
        const atkPereff1 = eff.atkPereff1 || 0.003934266;
        const atkMult = 1.0 + dAtk * atkeff1 + dAtkPer * atkPereff1;

        // 3. 데미지 + 보공 버킷
        const dmgeff1 = eff.dmgeff1 || 0.001150441;
        const dmgMult = 1.0 + dBossDmg * dmgeff1;

        // 4. 크리티컬 데미지 버킷
        const cridmgeff1 = eff.cridmgeff1 || 0.003929273;
        const criMult = 1.0 + dCriDmg * cridmgeff1;

        // 5. 방어율 무시(IGR) 버킷: 방무 곱연산 공식 (1 - prod(1 - newIgr) / prod(1 - oldIgr))
        const oldIgrAll = [...oldStats.ignoreDefList, ...setDelta.oldIgrList];
        const newIgrAll = [...newStats.ignoreDefList, ...setDelta.newIgrList];
        const oldDefRemain = oldIgrAll.reduce((acc, v) => acc * (1.0 - v / 100.0), 1.0);
        const newDefRemain = newIgrAll.reduce((acc, v) => acc * (1.0 - v / 100.0), 1.0);
        const effIgrDelta = oldDefRemain > 0 ? (1.0 - newDefRemain / oldDefRemain) * 100.0 : 0;
        const igrCoeff = eff.igreff1_380 || eff.igreff1 || 0.000848544;
        const igrMult = 1.0 + effIgrDelta * igrCoeff;

        // 6. 쿨타임 감소 버킷 (모자 간 순수 쿨감 초 차이만 반영)
        let coolMult = 1.0;
        const dCoolSec = newStats.cooldownSec - oldStats.cooldownSec;
        if (dCoolSec !== 0) {
            const classCool2s = Number(charContext?.myClassData?.coolDownEff2s || 0);
            const perSecEff = classCool2s > 0 ? classCool2s / 2.0 : 0.032;
            coolMult = 1.0 + dCoolSec * perSecEff;
        }

        // 독립 버킷 간 복리 곱연산
        const totalMultiplier = statMult * atkMult * dmgMult * criMult * igrMult * coolMult;
        let fdPercent = (totalMultiplier - 1.0) * 100.0;

        let seedRingNotice = null;
        let isSeedRingItem = false;

        // 특수 반지(시드링) 판정 및 극딜/스킬 기여도 보정
        const isNewSeed = isSeedRing(mappedItem.name);
        const isOldSeed = oldItem && isSeedRing(oldItem.name);

        if (isNewSeed) {
            isSeedRingItem = true;
            const newLv = extractSeedRingLevel(mappedItem.name);
            const oldLv = isOldSeed ? extractSeedRingLevel(oldItem.name) : 0;
            const newFamily = getSeedRingFamily(mappedItem.name);

            if (isOldSeed && newLv > oldLv) {
                // 시드링 승급 (예: 리레3 -> 리레4)
                const benchmarkFd = getSeedRingFdEstimate(newFamily, oldLv, newLv);
                fdPercent = benchmarkFd;
                seedRingNotice = `시드링 액티브 ${oldLv}레벨 ➔ ${newLv}레벨 스킬 기여 추정치 (+${benchmarkFd}%)`;
            } else if (isOldSeed && newLv === oldLv) {
                fdPercent = 0.0;
                seedRingNotice = `동일 ${newLv}레벨 시드링 (변동 없음)`;
            } else if (!isOldSeed && oldItem) {
                // 일반 스탯 반지를 착용 중인 상태에서 시드링을 처음 장착하는 경우
                seedRingNotice = `특수 액티브 반지 (극딜 시 액티브 버프 발동, 단순 기본 스탯 비교 주의)`;
            }
        }

        const roundedEff = Math.round(fdPercent * 1000) / 1000;

        // 7. 에르미트 스플라인 역함수로 정확한 일반환산(boss380_stat) 및 헥사환산(boss380_hexaStat) 변화량 도출
        let hwanDiff = Math.round(fdPercent * 250.5);
        let hexaDiff = Math.round(hwanDiff * 0.855);

        if (charContext?.spline380 && charContext?.calculatedDamage380 > 0 && charContext?.boss380Stat > 0) {
            const finalMultiplier = 1.0 + (fdPercent / 100.0);
            const newDamage380 = charContext.calculatedDamage380 * finalMultiplier;
            const newBoss380Stat = invertHermiteSpline(charContext.spline380, newDamage380);
            if (newBoss380Stat !== null) {
                hwanDiff = newBoss380Stat - charContext.boss380Stat;
                const hexaRatio = charContext.boss380HexaStat > 0
                    ? charContext.boss380HexaStat / charContext.boss380Stat
                    : 0.855;
                hexaDiff = Math.round(hwanDiff * hexaRatio);
            }
        }

        return {
            eff: roundedEff,
            hwanDiff: hwanDiff,
            hexaDiff: hexaDiff,
            targetSlot: oldItem ? oldItem.slot : mappedItem.slot,
            oldItemName: oldItem ? oldItem.name : "미착용",
            isFallback: !charContext?.specEfficiency,
            isSeedRing: isSeedRingItem,
            seedRingNotice: seedRingNotice
        };
    }

    /**
     * 잠재능력 배열을 짧은 태그 문자열로 요약
     */
    function summarizePotentials(lines) {
        if (!Array.isArray(lines)) return "";
        const tags = [];
        lines.forEach(raw => {
            if (!raw || raw === "없음") return;
            const s = String(raw);
            const numMatch = s.match(/([+-]?\d+(?:\.\d+)?)/);
            const num = numMatch ? Math.abs(parseFloat(numMatch[1])) : "";

            if (s.includes("재사용 대기시간")) {
                const sec = s.match(/-\s*(\d+)\s*초/);
                if (sec) tags.push(`쿨${sec[1]}초`);
            } else if (s.includes("크리티컬 데미지")) {
                tags.push(`크뎀${num}%`);
            } else if (s.includes("보스 몬스터")) {
                tags.push(`보공${num}%`);
            } else if (s.includes("방어율 무시")) {
                tags.push(`방무${num}%`);
            } else if (s.includes("올스탯")) {
                tags.push(s.includes("%") ? `올스탯${num}%` : `올${num}`);
            } else if (s.includes("마력")) {
                tags.push(s.includes("%") ? `마${num}%` : `마+${num}`);
            } else if (s.includes("공격력")) {
                tags.push(s.includes("%") ? `공${num}%` : `공+${num}`);
            } else if (s.includes("레벨 당") || s.includes("레벨당")) {
                tags.push(`렙당주스탯`);
            } else {
                const statMatch = s.match(/^(STR|DEX|INT|LUK|최대 HP)/);
                if (statMatch) {
                    const label = statMatch[1] === "최대 HP" ? "HP" : statMatch[1];
                    tags.push(s.includes("%") ? `${label}${num}%` : `${label}+${num}`);
                }
            }
        });
        return tags.join("/");
    }

    /**
     * 유저 요청 규격: "추가스펙(장비이름 스타포스 잠재능력)" 포맷 생성
     */
    function formatSimulBookmarkName(mappedItem) {
        const baseName = mappedItem.name || "장비";
        const star = Number(mappedItem.starforce || 0) > 0 ? `${mappedItem.starforce}성` : "노작";
        const topPot = summarizePotentials(mappedItem.potential_option_1);
        const addPot = summarizePotentials(mappedItem.additional_potential_option_1);

        const parts = [baseName, star];
        if (topPot) parts.push(topPot);
        if (addPot) parts.push(`에디:${addPot}`);

        return `추가스펙(${parts.join(" ")})`;
    }

    /**
     * 경매장 찜 아이템 + 캐릭터 컨텍스트 -> bookMarkSimulList 원소 생성
     */
    function buildSimulBookmarkEntry(auctionItem, mappedItem, charContext, overrideCharName) {
        const calc = calculateItemFdIncrease(mappedItem, charContext);
        const rawPrice = Number(auctionItem?.price || 0);
        const costInEok = rawPrice > 0 ? Math.round((rawPrice / 100000000) * 100) / 100 : 0;
        const characterName = overrideCharName || charContext?.charName || "Unknown";

        return {
            bookmarkEntry: {
                name: formatSimulBookmarkName(mappedItem),
                eff: calc.eff,
                cost: costInEok,
                img: mappedItem.iconUrl || "/item/letheSW.png",
                character: characterName,
                noTrade: false
            },
            calcDetail: calc
        };
    }

    /**
     * 아이템의 윗잠/아랫잠 유효 옵션을 분석하여 "윗잠 유효 X% · 아랫잠 유효 Y%" 형태로 요약
     */
    function summarizeItemPotentials(mappedItem, charContext = null) {
        if (!mappedItem) return { topText: "윗잠 없음", bottomText: "아랫잠 없음", fullText: "윗잠 없음 · 아랫잠 없음" };

        // 캐릭터 주스탯 판별 (컨텍스트가 없으면 아이템 스탯 중 가장 높은 스탯 기준)
        let mainStatKey = charContext?.mainStatKey || "";
        if (!mainStatKey) {
            const tot = mappedItem.totalOption || {};
            const candidates = [
                ["str", Number(tot.str || 0)],
                ["dex", Number(tot.dex || 0)],
                ["int", Number(tot.int || 0)],
                ["luk", Number(tot.luk || 0)]
            ].sort((a, b) => b[1] - a[1]);
            mainStatKey = candidates[0][1] > 0 ? candidates[0][0] : "int";
        }
        const isMage = mainStatKey === "int";
        const mainStatLabelMap = { str: "STR", dex: "DEX", int: "INT", luk: "LUK", max_hp: "최대 HP" };
        const targetStatLabel = mainStatLabelMap[mainStatKey] || "INT";

        function analyzePotLines(lines, grade, isAddPot) {
            if (!grade || !Array.isArray(lines) || lines.every(l => !l || l === "없음")) {
                return isAddPot ? "아랫잠 없음" : "윗잠 없음";
            }

            let validStatPct = 0;
            let atkPct = 0;
            let flatAtk = 0;
            let bossPct = 0;
            let igrPct = 0;
            let criDmgPct = 0;
            let coolSec = 0;
            let perLvStat = 0;

            lines.forEach(raw => {
                if (!raw || raw === "없음") return;
                const s = String(raw);
                const m = s.match(/([+-]?\d+(?:\.\d+)?)/);
                const val = m ? Math.abs(parseFloat(m[1])) : 0;

                if (s.includes("재사용 대기시간")) {
                    const sec = s.match(/-\s*(\d+)\s*초/);
                    if (sec) coolSec += parseInt(sec[1], 10);
                } else if (s.includes("크리티컬 데미지")) {
                    criDmgPct += val;
                } else if (s.includes("보스 몬스터")) {
                    bossPct += val;
                } else if (s.includes("방어율 무시")) {
                    igrPct += val;
                } else if (s.includes("올스탯") && s.includes("%")) {
                    validStatPct += val;
                } else if (s.includes(targetStatLabel) && s.includes("%")) {
                    validStatPct += val;
                } else if ((isMage && s.includes("마력")) || (!isMage && s.includes("공격력"))) {
                    if (s.includes("%")) atkPct += val;
                    else flatAtk += val;
                } else if (s.includes("레벨 당") || s.includes("레벨당")) {
                    if (s.includes(targetStatLabel) || s.includes("올스탯")) {
                        perLvStat += val;
                    }
                }
            });

            // 에디셔널 등에서 렙당 주스탯(+1당 약 3%) 및 깡공/마(+10당 약 3.5%)를 환산 유효%에 합산
            const convertedStatPct = validStatPct + (perLvStat * 3);
            const prefix = isAddPot ? "아랫잠" : "윗잠";
            const extras = [];

            if (coolSec > 0) extras.push(`쿨${coolSec}초`);
            if (criDmgPct > 0) extras.push(`크뎀${criDmgPct}%`);
            if (atkPct > 0) extras.push(`${isMage ? "마력" : "공격력"}${atkPct}%`);
            if (bossPct > 0) extras.push(`보공${bossPct}%`);
            if (igrPct > 0) extras.push(`방무${igrPct}%`);
            if (flatAtk > 0) extras.push(`${isMage ? "마" : "공"}+${flatAtk}`);

            if (extras.length > 0 && convertedStatPct > 0) {
                return `${prefix} 유효 ${convertedStatPct}% (${extras.join("·")})`;
            }
            if (extras.length > 0 && convertedStatPct === 0) {
                return `${prefix} ${extras.join("·")}`;
            }
            return `${prefix} 유효 ${convertedStatPct}%`;
        }

        const topText = analyzePotLines(mappedItem.potential_option_1, mappedItem.potential_grade, false);
        const bottomText = analyzePotLines(mappedItem.additional_potential_option_1, mappedItem.additional_potential_grade, true);

        return {
            topText,
            bottomText,
            fullText: `${topText} · ${bottomText}`
        };
    }

    // [Feature 3-2] 사용자 맞춤형 직작 원가(손익분기) 설정 기본값
    // - 핵심 이벤트 2종(샤타포스, 미라클 타임) 체크박스 독립 OR 조합 지원 (기본값: 둘 다 true)
    const DEFAULT_CRAFT_CONFIG = {
        useShiningStarforce: true,    // 샤타포스 적용 여부 (기본 true, 해제 시 평일 스타포스 비용/파괴율 적용)
        useMiracleTime: true,         // 미라클 타임 적용 여부 (기본 true, 해제 시 평일 등급업 비용 적용)
        eternalBaseEok: 7.0,          // 에테르넬(모/상/하) 노작가 (억)
        arcaneBaseEok: 0.5,           // 아케인 방어구 노작가 (억)
        pitchedBaseEok: 12.0,         // 일반 칠흑(안대/몽벨/루컨/마도서) 노작가 (억)
        highPitchedBaseEok: 25.0,     // 상위 칠흑(거공/고근/커포) 노작가 (억)
        brillianceBaseEok: 70.0,      // 광휘의 보스(근속/죽맹/악몽/원죄/핏빛) 노작가 (억)
        potCostWeightPct: 100,        // 잠재 직작 비용 반영률 (%)
        riskMultiplier: 1.0,          // 불운 리스크 할증 배율 (기본 1.0배)
        usedCutDiscountPct: 15,       // 중고 가횟(5~7회) 감가율 (%)
        goodDealThresholdPct: 12,     // 기준 편차 임계값 (%)
        customItemOverrides: {}       // 개별 매물 직접 지정 직작가 { [itemKey]: eokValue }
    };

    /**
     * [Feature 3] 직작 원가 대비 경매장 매물 기댓값(Craft vs Buy) 정밀 산출 엔진
     * - 광휘의 보스 장신구, 익셉셔널 강화 칠흑, 기계 심장 등 전 품목 가치평가 완비
     * - 배지 표기: "🟢 기댓값 X억" (기댓값에 근사하거나 작으면 🟢, 약간 높으면 🟡, 크게 높으면 🔴)
     * - 상세 보기 토글용 공정별(노작/스타포스/잠재/작·추옵/익셉셔널/가횟) 상세 설명 배열(detailItems) 반환
     */
    function evaluateCraftVsBuy(auctionItem, mappedItem, customConfig = null) {
        if (!mappedItem) return { isEvaluated: false };

        const cfg = { ...DEFAULT_CRAFT_CONFIG, ...(customConfig || {}) };

        // 레거시 preset 파라미터 호환성 유지
        if (customConfig && customConfig.preset === "full_event") {
            cfg.useShiningStarforce = true;
            cfg.useMiracleTime = true;
        } else if (customConfig && customConfig.preset === "conservative") {
            cfg.useShiningStarforce = false;
            cfg.useMiracleTime = false;
        }

        const rawPrice = Number(auctionItem?.price || 0);
        const priceEok = rawPrice > 0 ? Math.round((rawPrice / 100000000) * 10) / 10 : 0;
        const star = Number(mappedItem.starforce || 0);
        const potGrade = mappedItem.potential_grade || "";
        const addGrade = mappedItem.additional_potential_grade || "";
        const name = String(mappedItem.name || "");
        const slot = String(mappedItem.slot || "");
        const reqLv = Number(mappedItem.totalOption?.base_equipment_level || 200);

        const itemKey = String(auctionItem?.tradeSn || `${mappedItem.name}_${star}_${potGrade}`);
        const customOverrideEok = Number(cfg.customItemOverrides?.[itemKey] || 0);

        const isBrilliance = SET_ITEM_MEMBERS["광휘의 보스 세트"].includes(name);
        const isPitched = SET_ITEM_MEMBERS["칠흑의 보스 세트"].includes(name);
        const hasExUpgrade = Number(mappedItem.exceptionalOption?.exceptional_upgrade || (mappedItem.hasExceptional ? 1 : 0)) > 0;
        const isHeart = slot === "기계 심장" || name.includes("하트") || name.includes("언더컨트롤");

        // 0성 노작/토드용 재료 매물(스타포스 12성 미만 & 레전드리 아님)은 커스텀 오버라이드나 엔드급 보스 장신구/익셉/하트가 아닌 한 생략
        if (priceEok <= 0 || (customOverrideEok <= 0 && star < 12 && potGrade !== "레전드리" && addGrade !== "레전드리" && !isBrilliance && !isPitched && !hasExUpgrade && !isHeart)) {
            return { isEvaluated: false, priceEok, itemKey };
        }

        // 1. 아이템별 정밀 노작 기본가 (C_base, 억 단위)
        const eternalArmorBase = Number(cfg.eternalBaseEok ?? 7.0);
        const arcaneArmorBase = Number(cfg.arcaneBaseEok ?? 0.5);
        const pitchedNormalBase = Number(cfg.pitchedBaseEok ?? 12.0);
        const pitchedHighBase = Number(cfg.highPitchedBaseEok ?? 25.0);
        const brillianceBase = Number(cfg.brillianceBaseEok ?? 70.0);

        let baseCost = arcaneArmorBase;
        let baseDesc = "일반 노작";
        if (isBrilliance) {
            if (name === "불멸의 유산") {
                baseCost = brillianceBase * 0.4;
                baseDesc = "광휘(훈장) 노작";
            } else {
                baseCost = brillianceBase;
                baseDesc = "광휘의 보스 장신구 노작";
            }
        } else if (name.includes("에테르넬")) {
            const is3Set = ["모자", "상의", "하의"].includes(slot);
            baseCost = is3Set ? eternalArmorBase : eternalArmorBase * 3.5;
            baseDesc = is3Set ? "에테르넬 방어구 노작" : "에테르넬 특수부위 노작";
        } else if (name.includes("아케인셰이드")) {
            baseCost = slot === "무기" ? Math.max(1.5, arcaneArmorBase * 3) : arcaneArmorBase;
            baseDesc = slot === "무기" ? "아케인 무기 노작" : "아케인 방어구 노작";
        } else if (isPitched) {
            if (name === "커맨더 포스 이어링") {
                baseCost = pitchedHighBase * 1.4;
                baseDesc = "칠흑(커포) 노작";
            } else if (name === "거대한 공포" || name === "고통의 근원") {
                baseCost = pitchedHighBase;
                baseDesc = "상위 칠흑(거공/고근) 노작";
            } else if (name === "컴플리트 언더컨트롤") {
                baseCost = pitchedNormalBase * 1.5;
                baseDesc = "칠흑 하트(컴언컨) 노작";
            } else {
                baseCost = pitchedNormalBase;
                baseDesc = "일반 칠흑 노작";
            }
        } else if (SET_ITEM_MEMBERS["여명의 보스 세트"].includes(name)) {
            baseCost = (name === "데이브레이크 펜던트" || name === "여명의 가디언 엔젤 링") ? 1.5 : 0.5;
            baseDesc = "여명 보스 장신구 노작";
        } else if (isHeart) {
            if (name.includes("페어리") || name.includes("리퀴드메탈")) {
                baseCost = 15.0;
                baseDesc = "영구 교불제 하트 노작";
            } else {
                baseCost = 3.0;
                baseDesc = "기계 심장 노작";
            }
        } else {
            baseCost = 0.3;
            baseDesc = "기본 장신구/방어구 노작";
        }

        // 2. 스타포스 기댓값 = 순수 강화 메소(레벨제 비례) + 스페어 파괴 비용(평균 파괴수 * 노작가)
        let lvScale = 1.0;
        if (reqLv >= 250 || name.includes("에테르넬") || isBrilliance) lvScale = 1.95;
        else if (reqLv >= 200) lvScale = 1.0;
        else if (reqLv >= 160) lvScale = 0.62;
        else lvScale = 0.45;

        let pureMeso200 = 0;
        let avgBooms = 0;
        if (star >= 23) { pureMeso200 = 210.0; avgBooms = 5.50; }
        else if (star === 22) { pureMeso200 = 88.0; avgBooms = 2.30; }
        else if (star === 21) { pureMeso200 = 54.0; avgBooms = 1.35; }
        else if (star === 20) { pureMeso200 = 38.0; avgBooms = 0.90; }
        else if (star === 19) { pureMeso200 = 25.0; avgBooms = 0.55; }
        else if (star === 18) { pureMeso200 = 15.5; avgBooms = 0.25; }
        else if (star === 17) { pureMeso200 = 8.5; avgBooms = 0.05; }
        else if (star === 16) { pureMeso200 = 4.2; avgBooms = 0.0; }
        else if (star >= 12) { pureMeso200 = 1.4; avgBooms = 0.0; }

        const isShining = cfg.useShiningStarforce !== false;
        const riskMult = Math.max(0.5, Number(cfg.riskMultiplier ?? 1.0));
        const starEventMult = isShining ? 1.0 : 1.42;
        const boomEventMult = isShining ? 1.0 : 1.30;

        const expectedBooms = Math.round(avgBooms * boomEventMult * 100) / 100;
        const starMesoCost = pureMeso200 * lvScale * starEventMult * riskMult;
        const spareBoomCost = (slot === "무기" ? 0 : expectedBooms * baseCost * riskMult);
        const starCost = starMesoCost + spareBoomCost;

        // 3. 잠재능력(윗잠 + 에디) 기댓값 (미라클 타임 ON/OFF 연동)
        const isMiracle = cfg.useMiracleTime !== false;
        let gradeUpCost = 0;
        if (potGrade === "레전드리") {
            const miracleLeg = reqLv >= 250 ? 14.45 : (reqLv >= 200 ? 13.0 : 11.0);
            const normalLeg = reqLv >= 250 ? 23.0 : (reqLv >= 200 ? 21.0 : 18.0);
            gradeUpCost += isMiracle ? miracleLeg : normalLeg;
        } else if (potGrade === "유니크") {
            gradeUpCost += isMiracle ? 2.2 : 4.0;
        } else if (potGrade === "에픽") {
            gradeUpCost += 0.3;
        }

        const topLines = Array.isArray(mappedItem.potential_option_1) ? mappedItem.potential_option_1 : [];
        let topCoolSec = 0;
        let topCriDmgLines = 0;
        let topStatPer = 0;
        let topAtkBossLines = 0;

        topLines.forEach(raw => {
            if (!raw || raw === "없음") return;
            const s = String(raw);
            const m = s.match(/([+-]?\d+(?:\.\d+)?)/);
            const v = m ? Math.abs(parseFloat(m[1])) : 0;

            if (s.includes("재사용 대기시간")) {
                const sec = s.match(/-\s*(\d+)\s*초/);
                if (sec) topCoolSec += parseInt(sec[1], 10);
            } else if (s.includes("크리티컬 데미지")) {
                topCriDmgLines += 1;
            } else if (s.includes("공격력") || s.includes("마력") || s.includes("보스 몬스터")) {
                if (s.includes("%")) topAtkBossLines += 1;
            } else if (s.includes("%") && (s.includes("STR") || s.includes("DEX") || s.includes("INT") || s.includes("LUK") || s.includes("최대 HP") || s.includes("올스탯"))) {
                topStatPer += v;
            }
        });

        let optRollCost = 0;
        if (topCoolSec >= 4) optRollCost += 140.0;
        else if (topCoolSec === 3) optRollCost += 55.0;
        else if (topCoolSec === 2) optRollCost += topStatPer >= 9 ? 37.0 : 10.0;
        else if (topCoolSec === 1) optRollCost += topStatPer >= 18 ? 14.0 : 4.0;
        else if (topCriDmgLines >= 2) optRollCost += 85.0;
        else if (topCriDmgLines === 1) optRollCost += topStatPer >= 18 ? 28.0 : (topStatPer >= 9 ? 12.0 : 5.0);
        else if (["무기", "보조무기", "엠블렘"].includes(slot) && topAtkBossLines >= 2) {
            optRollCost += topAtkBossLines >= 3 ? 42.0 : 12.0;
        } else {
            if (topStatPer >= 33) optRollCost += 65.0;
            else if (topStatPer >= 30) optRollCost += 28.0;
            else if (topStatPer >= 27) optRollCost += 14.0;
            else if (topStatPer >= 21) optRollCost += 5.5;
            else if (topStatPer >= 15) optRollCost += 2.0;
        }

        // 에디셔널 잠재 기댓값
        let addPotCost = 0;
        if (addGrade === "레전드리") {
            addPotCost = isMiracle ? 38.0 : 52.0;
        } else if (addGrade === "유니크") {
            addPotCost = isMiracle ? 11.0 : 16.0;
        } else if (addGrade === "에픽") {
            addPotCost = 1.5;
        }

        const potWeight = Math.max(0, Number(cfg.potCostWeightPct ?? 100)) / 100.0;
        const potCost = (gradeUpCost + optRollCost + addPotCost) * potWeight * riskMult;

        // 4. 주문서 작(etcOption 프악공/놀긍혼/매지컬) 및 고추옵(addOption) 가치 역산
        let scrollCost = 0;
        let flameCost = 0;
        const etc = mappedItem.etcOption || {};
        const add = mappedItem.addOption || {};
        const scrollUpgrades = Number(mappedItem.scroll_upgrade || 0);
        const etcAtk = Math.max(Number(etc.attack_power || 0), Number(etc.magic_power || 0));

        let scrollDesc = scrollUpgrades > 0 ? `${scrollUpgrades}작 (공/마 +${etcAtk})` : "주문서 작 없음";
        if (isHeart && scrollUpgrades > 0 && etcAtk >= scrollUpgrades * 3.5) {
            scrollCost = Math.round(scrollUpgrades * 1.8 * 10) / 10;
            scrollDesc = `매지컬/프펫공 ${scrollUpgrades}작 (공/마 +${etcAtk})`;
        } else if (!["무기", "보조무기", "엠블렘", "장갑"].includes(slot) && scrollUpgrades > 0 && etcAtk >= scrollUpgrades * 3.8) {
            scrollCost = Math.round(scrollUpgrades * 1.4 * 10) / 10;
            scrollDesc = `프악공/고공마 ${scrollUpgrades}작 (+${etcAtk})`;
        }

        let flameScore = 0;
        if (slot !== "무기" && !isHeart) {
            const maxAddStat = Math.max(
                Number(add.str || 0),
                Number(add.dex || 0),
                Number(add.int || 0),
                Number(add.luk || 0),
                Math.floor(Number(add.max_hp || 0) / 210)
            );
            const addAtk = Math.max(Number(add.attack_power || 0), Number(add.magic_power || 0));
            const addAll = Number(add.all_stat || 0);
            flameScore = maxAddStat + addAtk * 4 + addAll * 10;

            if (reqLv >= 250) {
                if (flameScore >= 165) flameCost = 12.0;
                else if (flameScore >= 150) flameCost = 4.5;
            } else if (reqLv >= 160) {
                if (flameScore >= 150) flameCost = 8.0;
                else if (flameScore >= 135) flameCost = 2.5;
            }
        }
        const scrollFlameCost = scrollCost + flameCost;

        // 5. 익셉셔널 강화(Exceptional Upgrade) 가치 역산
        let exceptionalCost = 0;
        const exCount = Number(mappedItem.exceptionalOption?.exceptional_upgrade || (mappedItem.hasExceptional ? 1 : 0));
        if (exCount > 0) {
            exceptionalCost = exCount * 18.0; // 익셉셔널 파츠 1회당 약 18억 가치 반영
        }

        const rawCraftCostEok = baseCost + starCost + potCost + scrollFlameCost + exceptionalCost;

        // 6. 가위 사용 가능 횟수(가횟) 감가 반영
        const rawCut = Number(auctionItem?.toolTip?.upgradeInfo?.cuttableCount ?? mappedItem.cuttable_count ?? 255);
        const usedDiscRatio = Math.min(0.8, Math.max(0, Number(cfg.usedCutDiscountPct ?? 15) / 100.0));
        let cutFactor = 1.0;
        if (rawCut >= 0 && rawCut <= 20) {
            if (rawCut >= 8) cutFactor = 1.0;
            else if (rawCut >= 5) cutFactor = 1.0 - usedDiscRatio;
            else if (rawCut >= 3) cutFactor = Math.max(0.4, 1.0 - usedDiscRatio * 1.65);
            else cutFactor = Math.max(0.35, 1.0 - usedDiscRatio * 2.3);
        }
        if (rawCut >= 0 && rawCut <= 20) {
            if (rawCut >= 8) cutFactor = 1.0;
            else if (rawCut >= 5) cutFactor = 1.0 - usedDiscRatio;
            else if (rawCut >= 3) cutFactor = Math.max(0.4, 1.0 - usedDiscRatio * 1.65);
            else cutFactor = Math.max(0.35, 1.0 - usedDiscRatio * 2.3);
        }

        const isCustomOverridden = customOverrideEok > 0;
        const fairPriceEok = isCustomOverridden
            ? Math.round(customOverrideEok * 10) / 10
            : Math.max(1.0, Math.round(rawCraftCostEok * cutFactor * 10) / 10);

        const diffPct = Math.round(((priceEok - fairPriceEok) / fairPriceEok) * 100);
        const threshold = Math.max(1, Math.abs(Number(cfg.goodDealThresholdPct ?? 12)));

        // 공정별 원가 브레이크다운 요약
        const breakdownParts = [
            `노작${Math.round(baseCost * 10) / 10}`,
            `성${Math.round(starCost)}`,
            `잠${Math.round(potCost)}`
        ];
        if (scrollFlameCost >= 1) breakdownParts.push(`작추${Math.round(scrollFlameCost)}`);
        if (exceptionalCost >= 1) breakdownParts.push(`익셉${Math.round(exceptionalCost)}`);
        const breakdownStr = isCustomOverridden ? "사용자 지정" : breakdownParts.join("·");

        // 상세 보기 토글용 공정별 설명 리스트
        const detailItems = [
            {
                label: "노작 원가",
                value: `${Math.round(baseCost * 10) / 10}억`,
                desc: baseDesc
            },
            {
                label: `스타포스 (${star}성)`,
                value: `${Math.round(starCost * 10) / 10}억`,
                desc: `강화비 ${Math.round(starMesoCost * 10) / 10}억 + 파괴 ${expectedBooms}회분(${Math.round(spareBoomCost * 10) / 10}억) · ${isShining ? "샤타포스" : "평일"}`
            },
            {
                label: "잠재능력",
                value: `${Math.round(potCost * 10) / 10}억`,
                desc: `윗잠 ${potGrade || "없음"}(${Math.round((gradeUpCost + optRollCost) * 10) / 10}억) + 에디 ${addGrade || "없음"}(${Math.round(addPotCost * 10) / 10}억) · ${isMiracle ? "미라클" : "평일"}`
            },
            {
                label: "주문서 작 · 추옵",
                value: `${Math.round(scrollFlameCost * 10) / 10}억`,
                desc: `${scrollDesc}${flameScore > 0 ? ` · 추옵 ${flameScore}급` : ""}`
            }
        ];

        if (exceptionalCost > 0) {
            detailItems.push({
                label: "익셉셔널 강화",
                value: `${exceptionalCost}억`,
                desc: `익셉셔널 강화 ${exCount}회 적용 (회당 약 18억 가치)`
            });
        }

        if (rawCut >= 0 && rawCut <= 20) {
            detailItems.push({
                label: "가위 횟수 보정",
                value: cutFactor < 1 ? `-${Math.round((1 - cutFactor) * 100)}%` : "감가 없음",
                desc: `가횟 ${rawCut}회 잔여 (원가 합계 ${Math.round(rawCraftCostEok * 10) / 10}억 × ${Math.round(cutFactor * 100)}%)`
            });
        }

        // 기댓값에 근사하거나 작으면(diffPct <= 0 또는 근사범위 내) 🟢 표시, 꿀매/직작추천 문구 없이 "🟢 기댓값 X억"으로 표기
        let grade = "FAIR";
        let signalEmoji = "🟡";
        let color = "#d97706";

        if (diffPct <= -threshold || priceEok <= fairPriceEok) {
            grade = "GOOD";
            signalEmoji = "🟢";
            color = "#2b8a3e";
        } else if (diffPct > threshold) {
            grade = "HIGH";
            signalEmoji = "🔴";
            color = "#c92a2a";
        }

        const badgeText = `${signalEmoji} 기댓값 ${fairPriceEok}억${isCustomOverridden ? " (사용자 지정)" : ""}`;

        return {
            isEvaluated: true,
            itemKey,
            isCustomOverridden,
            priceEok,
            rawCraftCostEok: Math.round(rawCraftCostEok * 10) / 10,
            fairPriceEok,
            cutFactor,
            diffPct,
            grade,
            signalEmoji,
            badgeText,
            breakdownStr,
            detailItems,
            color
        };
    }

    const exported = {
        DEFAULT_CRAFT_CONFIG,
        parseCharacterStore,
        normalizeStatKeys,
        extractItemCombatStats,
        findComparableEquippedItem,
        evaluateTotalSetStats,
        evaluateHermiteSpline,
        invertHermiteSpline,
        calculateItemFdIncrease,
        summarizeItemPotentials,
        evaluateCraftVsBuy,
        formatSimulBookmarkName,
        buildSimulBookmarkEntry,
        isSeedRing,
        getSeedRingFamily,
        extractSeedRingLevel,
        getSeedRingFdEstimate
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = exported;
    } else {
        global.FDCalculator = exported;
    }
})(typeof window !== "undefined" ? window : globalThis);
