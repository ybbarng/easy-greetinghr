(async function () {
  'use strict';

  // === 설정 ===
  const API_BASE = 'https://api.greetinghr.com/app/ats';
  const SCORE_LABELS = {
    0: '매우 부적합',
    25: '부적합',
    50: '보통',
    75: '적합',
    100: '매우 적합',
  };
  const SCORE_CHIP_TOKENS = {
    0: 'danger',
    25: 'danger',
    50: 'gray',
    75: 'success',
    100: 'success',
  };
  const CONCURRENCY_LIMIT = 5;
  const DEBOUNCE_MS = 1000;
  const BADGE_CLASS = 'eg-eval-badge';
  const FILTER_BTN_ID = 'eg-filter-toggle';

  const token = localStorage.getItem('access_token');
  if (!token) {
    console.error('[EasyGreetingHR] access_token을 찾을 수 없습니다.');
    return;
  }

  // URL에서 workspaceId, openingId 파싱
  // 예: /workspace/1234/opening/56789/kanban
  const urlMatch = location.pathname.match(
    /\/workspace\/(\d+)\/opening\/(\d+)/
  );
  if (!urlMatch) {
    console.error(
      '[EasyGreetingHR] 칸반 보드 페이지가 아닙니다. URL에서 workspaceId/openingId를 찾을 수 없습니다.'
    );
    return;
  }
  const workspaceId = urlMatch[1];
  const openingId = urlMatch[2];
  console.log(
    `[EasyGreetingHR] workspaceId=${workspaceId}, openingId=${openingId}`
  );

  // === 상태 ===
  let evaluationMap = new Map(); // applicantId -> { name, evaluated, score, scoreLabel }
  let isUpdating = false;
  let filterEnabled = false;
  const nativeFetch = window.fetch.bind(window);

  // === 유틸리티 ===
  async function apiFetch(url) {
    const res = await nativeFetch(url, {
      headers: {
        Authorization: token,
        'X-Greeting-Workspace-Id': workspaceId,
        'X-Greeting-Opening-Id': openingId,
      },
    });
    if (!res.ok) throw new Error(`API 오류: ${res.status} ${url}`);
    return res.json();
  }

  async function concurrentMap(items, fn, limit) {
    const results = [];
    let index = 0;
    async function worker() {
      while (index < items.length) {
        const i = index++;
        results[i] = await fn(items[i], i);
      }
    }
    const workers = Array.from(
      { length: Math.min(limit, items.length) },
      () => worker()
    );
    await Promise.all(workers);
    return results;
  }

  // === 데이터 수집 ===

  // 단계 목록 조회
  async function fetchProcesses() {
    const res = await apiFetch(
      `${API_BASE}/v3.0/workspaces/${workspaceId}/openings/${openingId}/processes`
    );
    return res.data.datas; // [{ id, name, procedure, icon }]
  }

  // 특정 단계의 모든 지원자 카드를 가져옴 (페이지네이션 처리)
  async function fetchKanbanCards(processId) {
    const allCards = [];
    let page = 0;
    while (true) {
      const res = await apiFetch(
        `${API_BASE}/v5.0/workspaces/${workspaceId}/openings/${openingId}/kanban?page=${page}&pageSize=50&processId=${processId}&sorts=SUBMIT_DATE_DESC,ID_ASC&status=SUBMIT`
      );
      const { datas, hasNext } = res.data;
      allCards.push(...datas);
      if (!hasNext) break;
      page++;
    }
    return allCards;
  }

  // 모든 단계의 지원자 목록 수집
  async function fetchAllApplicants() {
    const processes = await fetchProcesses();
    const applicants = []; // [{ applicantId, name, processId }]

    for (const proc of processes) {
      const cards = await fetchKanbanCards(proc.id);
      for (const card of cards) {
        applicants.push({
          applicantId: card.applicantInfo.id,
          name: card.applicantInfo.name,
          processId: proc.id,
        });
      }
    }

    return applicants;
  }

  // 특정 지원자의 내 평가 정보 가져오기
  async function fetchMyEvaluation(applicantId) {
    const res = await apiFetch(
      `${API_BASE}/evaluations/contents?applicantId=${applicantId}`
    );

    const processEvals = res.data.processEvaluations;
    const currentProc = processEvals.find((p) => p.currentProcess);

    if (
      !currentProc ||
      !currentProc.evaluation ||
      !currentProc.evaluation.evaluationContents
    ) {
      return { evaluated: false, score: null, scoreLabel: null };
    }

    const myEval = currentProc.evaluation.evaluationContents.find(
      (e) => e.isOwn
    );
    if (!myEval) {
      return { evaluated: false, score: null, scoreLabel: null };
    }

    return {
      evaluated: true,
      score: myEval.score,
      scoreLabel: SCORE_LABELS[myEval.score] || `${myEval.score}점`,
    };
  }

  // 전체 평가 데이터 수집
  async function collectEvaluationData() {
    console.log('[EasyGreetingHR] 평가 데이터 수집 시작...');
    const applicants = await fetchAllApplicants();
    console.log(`[EasyGreetingHR] 지원자 ${applicants.length}명 발견`);

    const evalResults = await concurrentMap(
      applicants,
      async (applicant) => {
        const evalInfo = await fetchMyEvaluation(applicant.applicantId);
        return {
          applicantId: applicant.applicantId,
          name: applicant.name,
          ...evalInfo,
        };
      },
      CONCURRENCY_LIMIT
    );

    const newMap = new Map();
    for (const result of evalResults) {
      newMap.set(result.applicantId, result);
    }
    evaluationMap = newMap;

    const evaluatedCount = evalResults.filter((r) => r.evaluated).length;
    console.log(
      `[EasyGreetingHR] 평가 데이터 수집 완료: ${evaluatedCount}/${evalResults.length}명 평가 완료`
    );

    return evaluationMap;
  }

  // === DOM 조작 ===

  function removeBadges() {
    document.querySelectorAll(`.${BADGE_CLASS}`).forEach((el) => el.remove());
    // 카드 흐림 효과 제거
    document
      .querySelectorAll('[class*="item__Container"]')
      .forEach((card) => (card.style.opacity = ''));
  }

  function addBadgeToCard(nameElement, scoreLabel, score) {
    const card = nameElement.closest('[class*="item__Container"]');
    if (!card) return;
    const wrapper = card.parentElement;

    // 기존 배지가 있으면 제거
    const existing = wrapper.querySelector(`.${BADGE_CLASS}`);
    if (existing) existing.remove();

    // 카드 흐리게
    card.style.opacity = '0.4';

    // 배지를 카드 바깥(래퍼)에 배치하여 opacity 영향 없이 선명하게 유지
    wrapper.style.position = 'relative';
    const token = SCORE_CHIP_TOKENS[score] || 'gray';
    const badge = document.createElement('span');
    badge.className = `${BADGE_CLASS} greet-chip`;
    badge.dataset.variant = token;
    badge.dataset.size = 'sm';
    badge.textContent = `내 평가: ${scoreLabel}`;
    badge.style.cssText =
      'position: absolute; top: 8px; right: 12px; z-index: 1';

    wrapper.appendChild(badge);
  }

  function applyBadges() {
    removeBadges();

    const nameElements = document.querySelectorAll(
      'span[class*="header__NameText"]'
    );

    for (const nameEl of nameElements) {
      const name = nameEl.textContent.trim();

      // evaluationMap에서 이름으로 매칭
      for (const [, evalData] of evaluationMap) {
        if (evalData.name === name && evalData.evaluated) {
          addBadgeToCard(nameEl, evalData.scoreLabel, evalData.score);
          break;
        }
      }
    }

    // 필터가 활성화 상태면 다시 적용
    if (filterEnabled) {
      applyFilter(true);
    }
  }

  function applyFilter(hide) {
    const nameElements = document.querySelectorAll(
      'span[class*="header__NameText"]'
    );

    for (const nameEl of nameElements) {
      const name = nameEl.textContent.trim();
      let isEvaluated = false;

      for (const [, evalData] of evaluationMap) {
        if (evalData.name === name && evalData.evaluated) {
          isEvaluated = true;
          break;
        }
      }

      if (isEvaluated) {
        const card = nameEl.closest('[class*="item__Container"]');
        if (card) {
          card.style.display = hide ? 'none' : '';
          // 배지도 함께 숨기기/보이기 (배지는 카드 바깥 래퍼에 위치)
          const badge = card.parentElement.querySelector(`.${BADGE_CLASS}`);
          if (badge) badge.style.display = hide ? 'none' : '';
        }
      }
    }
  }

  function addFilterToggle() {
    // 이미 있으면 제거
    const existing = document.getElementById(FILTER_BTN_ID);
    if (existing) existing.remove();

    const btn = document.createElement('button');
    btn.id = FILTER_BTN_ID;
    btn.textContent = '평가 완료 숨기기';
    btn.style.cssText = [
      'position: fixed',
      'top: 10px',
      'right: 10px',
      'z-index: 10000',
      'padding: 8px 16px',
      'border: none',
      'border-radius: 6px',
      'font-size: 13px',
      'font-weight: 600',
      'cursor: pointer',
      'background-color: #f1f5f9',
      'color: #334155',
      'box-shadow: 0 1px 3px rgba(0,0,0,0.12)',
      'transition: background-color 0.2s',
    ].join(';');

    btn.addEventListener('click', () => {
      filterEnabled = !filterEnabled;
      if (filterEnabled) {
        btn.textContent = '평가 완료 보이기';
        btn.style.backgroundColor = '#22c55e';
        btn.style.color = '#fff';
        applyFilter(true);
      } else {
        btn.textContent = '평가 완료 숨기기';
        btn.style.backgroundColor = '#f1f5f9';
        btn.style.color = '#334155';
        applyFilter(false);
      }
    });

    document.body.appendChild(btn);
  }

  // === 네트워크 인터셉트 (실시간 업데이트) ===
  function installNetworkInterceptor() {
    let debounceTimer = null;

    function onKanbanDetected() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        if (isUpdating) return;
        isUpdating = true;
        try {
          console.log('[EasyGreetingHR] 칸반 변경 감지, 데이터 갱신...');
          await collectEvaluationData();
          applyBadges();
        } catch (e) {
          console.error('[EasyGreetingHR] 업데이트 실패:', e);
        } finally {
          isUpdating = false;
        }
      }, DEBOUNCE_MS);
    }

    // fetch 인터셉트
    const originalFetch = window.fetch;
    window.fetch = function (...args) {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      if (url.includes('/kanban?')) onKanbanDetected();
      return originalFetch.apply(this, args);
    };

    // XMLHttpRequest 인터셉트
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      if (typeof url === 'string' && url.includes('/kanban?')) {
        this.addEventListener('load', onKanbanDetected, { once: true });
      }
      return originalXhrOpen.call(this, method, url, ...rest);
    };

    console.log('[EasyGreetingHR] 네트워크 인터셉터 설치 완료');
  }

  // === 초기 실행 ===
  try {
    await collectEvaluationData();
    applyBadges();
    addFilterToggle();
    installNetworkInterceptor();
    console.log('[EasyGreetingHR] 초기화 완료!');
  } catch (e) {
    console.error('[EasyGreetingHR] 초기화 실패:', e);
  }
})();
