/**
 * ==========================================================================
 * 국민건강보험공단 롱텀케어(Longterm) RFID 수정 스크립트 (longterm.js)
 * 작성일: 2026-08-15
 * 기능:
 * 1. 기존 RFID APP & 수기기록지와 100% 동일한 수급자 제어 패널(검색, 정렬, 드로어)
 * 2. 수급자 클릭/더블클릭 시 롱텀 팝업 서식에 1:1 자동 바인딩
 * 3. 6대 요양 시간 실시간 계산 및 일일체크/기본값(유지, 0회) 처리
 * 4. 화자(수급자/보호자)+사유(연속/공휴일) 특이사항 스마트 조합기 및 클립보드 복사
 * 5. Document PiP (Always on Top) 화면 위 항상 띄우기 위젯 모드 완벽 지원
 * ==========================================================================
 */

// 전역 상태 변수
var currentRecipients = [];
var currentSortMode = "name"; // "name" (이름순) | "time" (시간순)
var currentSearchQuery = "";
var selectedRecipientId = null;
var currentSelectedRecipient = null;
var pipWindowInstance = null;
var toastTimeout = null;

// 상용구 기본 문구
var PRESET_NOTES = [
  {
    title: "일반방문요양",
    text: "신체활동 지원 및 안부 확인, 개인위생(세면·양치) 보조와 안전한 일상생활을 도움."
  }
];

/**
 * PiP 창 내부와 메인 창 어디서든 요소를 안전하게 찾는 헬퍼 함수
 */
function getDocElem(id) {
  if (pipWindowInstance && pipWindowInstance.document) {
    var el = pipWindowInstance.document.getElementById(id);
    if (el) return el;
  }
  return document.getElementById(id);
}

function getDocQueryAll(selector) {
  if (pipWindowInstance && pipWindowInstance.document) {
    var list = pipWindowInstance.document.querySelectorAll(selector);
    if (list && list.length > 0) return list;
  }
  return document.querySelectorAll(selector);
}

/**
 * 3자리 문자열로 패딩 (예: 40 -> "040", 0 -> "000")
 */
function pad3(num) {
  var val = parseInt(num, 10);
  if (isNaN(val) || val < 0) return "000";
  return String(val).padStart(3, "0");
}

/**
 * 오늘 날짜 문자열 YYYY-MM-DD
 */
function getTodayDateString() {
  var now = new Date();
  var year = now.getFullYear();
  var month = String(now.getMonth() + 1).padStart(2, "0");
  var day = String(now.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

/**
 * 문서 로드 시 초기화
 */
document.addEventListener("DOMContentLoaded", function () {
  setupTheme();
  loadData();
  setupControlPanel();
  setupFormEventListeners();
  setupNotePicker();
  setupPiPMode();
});

/**
 * 0. 다크/라이트 테마 제어 및 실시간 동기화
 */
function setupTheme() {
  var btnTheme = document.getElementById("btnThemeToggle");
  function updateThemeUI() {
    var isDark = document.body.classList.contains("dark-theme");
    if (btnTheme) {
      var icon = btnTheme.querySelector(".theme-icon") || btnTheme;
      icon.innerHTML = isDark ? "☀️" : "🌙";
    }
  }

  var savedTheme = localStorage.getItem("hub-theme") || "light";
  if (savedTheme === "dark") {
    document.body.classList.add("dark-theme");
  } else {
    document.body.classList.remove("dark-theme");
  }
  updateThemeUI();

  if (btnTheme) {
    btnTheme.addEventListener("click", function () {
      var isDark = document.body.classList.toggle("dark-theme");
      localStorage.setItem("hub-theme", isDark ? "dark" : "light");
      updateThemeUI();
    });
  }

  window.addEventListener("storage", function (e) {
    if (e.key === "hub-theme") {
      if (e.newValue === "dark") {
        document.body.classList.add("dark-theme");
      } else {
        document.body.classList.remove("dark-theme");
      }
      updateThemeUI();
    }
  });
}

/**
 * 1. 수급자 데이터 로드 (API 우선 -> localStorage -> INITIAL_RECIPIENTS)
 */
async function loadData() {
  try {
    let initialList = [];
    let fileTimestamp = typeof INITIAL_RECIPIENTS_TIMESTAMP !== 'undefined' ? INITIAL_RECIPIENTS_TIMESTAMP : 0;
    const storedTimestamp = parseInt(localStorage.getItem('rfid_recipients_timestamp') || '0', 10);

    // 🌐 1단계: Electron 서버 환경인 경우 API를 통해 최신 recipients.js 실시간 로드
    if (window.location.protocol.startsWith('http')) {
      try {
        const res = await fetch('/api/load-recipients', { cache: 'no-store' });
        if (res.ok) {
          const apiRecipients = await res.json();
          if (Array.isArray(apiRecipients) && apiRecipients.length > 0) {
            initialList = apiRecipients;
          }
        }
      } catch (e) {
        console.warn('롱텀 API 로드 실패, 로컬 스토리지/파일 폴백 사용:', e);
      }
    }

    // 📄 2단계: 파일 타임스탬프가 로컬스토리지보다 최신이거나 파일에 데이터가 있을 때 최신 파일 우선 로드
    if (initialList.length === 0 && typeof INITIAL_RECIPIENTS !== 'undefined' && Array.isArray(INITIAL_RECIPIENTS)) {
      if (fileTimestamp > storedTimestamp || !localStorage.getItem('rfid_recipients')) {
        initialList = [...INITIAL_RECIPIENTS];
        localStorage.setItem('rfid_recipients', JSON.stringify(initialList));
        localStorage.setItem('rfid_recipients_timestamp', fileTimestamp);
      }
    }

    // 💾 3단계: 로컬 스토리지 폴백
    if (initialList.length === 0) {
      const saved = localStorage.getItem('rfid_recipients') || localStorage.getItem('rfid_recipients_data');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            initialList = parsed;
          }
        } catch (e) {}
      }
    }

    // 📄 4단계: 여전히 비어있다면 recipients.js 전역 객체 사용
    if (initialList.length === 0 && typeof INITIAL_RECIPIENTS !== 'undefined') {
      initialList = [...INITIAL_RECIPIENTS];
    }

    currentRecipients = initialList;
    localStorage.setItem('rfid_recipients', JSON.stringify(currentRecipients));

  } catch (e) {
    console.error('롱텀 데이터 로드 중 오류 발생:', e);
    currentRecipients = typeof INITIAL_RECIPIENTS !== 'undefined' ? [...INITIAL_RECIPIENTS] : [];
  }

  renderRecipientList();

  // 오늘 실시간 날짜 기본 세팅 (수급자 선택 대기)
  var todayStr = getTodayDateString();
  var elDate = getDocElem("ltServiceDate");
  if (elDate) elDate.textContent = todayStr;
}

// 🌟 관리자 대시보드에서 수급자 변경 시 롱텀 화면도 실시간 자동 갱신
window.addEventListener('storage', function (e) {
  if (e.key === 'rfid_recipients' || e.key === 'rfid_recipients_data' || !e.key) {
    loadData();
  }
});

/**
 * 2. 수급자 슬라이딩 제어 패널(드로어, 검색, 정렬, 관리자창) 이벤트 바인딩
 */
function setupControlPanel() {
  var panel = document.getElementById("controlPanel");
  var toggleBtn = document.getElementById("controlPanelToggle");

  // 드로어 토글
  if (toggleBtn && panel) {
    toggleBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      panel.classList.toggle("open");
    });
  }

  // 패널 바깥 클릭 시 닫기
  document.addEventListener("click", function (e) {
    if (panel && panel.classList.contains("open") && !panel.contains(e.target) && e.target !== toggleBtn) {
      panel.classList.remove("open");
    }
  });

  // 검색 인풋 실시간 검색 및 클리어
  var searchInput = document.getElementById("recipient-search");
  var btnClear = document.getElementById("btn-search-clear");

  if (searchInput && btnClear) {
    searchInput.addEventListener("input", function (e) {
      currentSearchQuery = e.target.value.trim().toLowerCase();
      btnClear.style.display = currentSearchQuery.length > 0 ? "block" : "none";
      renderRecipientList();
    });

    btnClear.addEventListener("click", function () {
      searchInput.value = "";
      currentSearchQuery = "";
      btnClear.style.display = "none";
      searchInput.focus();
      renderRecipientList();
    });
  }

  // 이름순 / 시간순 정렬 토글
  var btnSortName = document.getElementById("btn-sort-name");
  var btnSortTime = document.getElementById("btn-sort-time");

  if (btnSortName && btnSortTime) {
    btnSortName.addEventListener("click", function () {
      currentSortMode = "name";
      btnSortName.classList.add("active");
      btnSortTime.classList.remove("active");
      renderRecipientList();
    });

    btnSortTime.addEventListener("click", function () {
      currentSortMode = "time";
      btnSortTime.classList.add("active");
      btnSortName.classList.remove("active");
      renderRecipientList();
    });
  }

  // 수급자 정보 관리 / 신규 등록 버튼 (관리자 대시보드 팝업 오픈)
  var btnOpenManage = document.getElementById("btn-open-manage");
  if (btnOpenManage) {
    btnOpenManage.addEventListener("click", function () {
      var manageUrl = "../[관리자] 수급자 등록 및 변경하기.html";
      var popup = window.open(manageUrl, "manageRecipientPopup", "width=1200,height=850,scrollbars=yes,resizable=yes");
      if (!popup || popup.closed || typeof popup.closed == "undefined") {
        alert("팝업 차단이 감지되었습니다. 팝업 허용 후 다시 시도해 주세요.");
      }
    });
  }

  // 관리자 창에서 저장 후 localStorage 갱신 시 실시간 동기화
  window.addEventListener("storage", function (e) {
    if (e.key === "rfid_recipients_data") {
      loadData();
      showToast("수급자 데이터가 최신 상태로 동기화되었습니다.");
    }
  });
}

/**
 * 3. 수급자 목록 렌더링 (검색 및 정렬 필터 적용)
 */
function renderRecipientList() {
  var listContainer = document.getElementById("recipient-list-container");
  if (!listContainer) return;

  listContainer.innerHTML = "";

  // 1) 보류/대기 인원 제외 및 검색 필터링
  var filtered = currentRecipients.filter(function (r) {
    // 🛑 보류/대기 수급자는 실시간 패널에서 필터링하여 숨김
    var status = r.status || (r.isPending ? '보류' : (r.isWaiting ? '대기' : '정상'));
    if (status === '보류' || status === '대기' || r.isPending || r.isWaiting) return false;

    if (!currentSearchQuery) return true;
    var name = (r.name || "").toLowerCase();
    var caregiver = (r.caregiver || "").toLowerCase();
    var cert = (r.cert || "").toLowerCase();
    return name.includes(currentSearchQuery) || caregiver.includes(currentSearchQuery) || cert.includes(currentSearchQuery);
  });

  // 2) 정렬
  filtered.sort(function (a, b) {
    if (currentSortMode === "name") {
      return (a.name || "").localeCompare(b.name || "", "ko");
    } else {
      var tA = (a.template && a.template.startTime) ? a.template.startTime : "99:99";
      var tB = (b.template && b.template.startTime) ? b.template.startTime : "99:99";
      return tA.localeCompare(tB);
    }
  });

  if (filtered.length === 0) {
    listContainer.innerHTML = '<div class="no-recipients"><span class="no-recipients-icon">🔍</span>검색된 수급자가 없습니다.</div>';
    return;
  }

  // 3) 행 생성
  filtered.forEach(function (rec) {
    var row = document.createElement("div");
    row.className = "recipient-row" + (selectedRecipientId === rec.id ? " selected" : "");

    // 성별 표시
    var genderHtml = rec.gender ? '<span style="font-size: 12px; color: ' + (rec.gender === '남' ? '#2563eb' : '#ec4899') + '; font-weight: bold; margin-left: 2px;">(' + rec.gender + ')</span>' : '';

    // 등급 뱃지
    var gradeBadge = rec.grade ? '<span class="row-grade" style="font-size: 11px; background: #f3e8ff; color: #7e22ce; padding: 2px 6px; border-radius: 6px; font-weight: bold; margin-left: 4px;">' + rec.grade + '등급</span>' : '';

    // 생년월일 및 인정번호 메타 정보
    var birthText = rec.birth ? '<span style="color: #94a3b8; margin: 0 3px;">·</span><span style="color: #64748b; font-size: 11.5px;">' + rec.birth + '</span>' : '';
    var certText = rec.cert ? '<span style="color: #94a3b8; margin: 0 3px;">·</span><span style="color: #334155; font-size: 11.5px; font-weight: 500;">' + rec.cert + '</span>' : '';

    // 🏷️ 우측 뱃지 영역 (가족 / 오전 / 오후)
    var badgesHtml = '';

    // 1. 가족요양 뱃지 (하위 호환 및 60분/90분 자동 판정)
    var t = rec.template || {};
    var totMin = String((t && t.totalTime) ? t.totalTime : '').trim();
    var isFam = rec.familyCareType === '60' || rec.familyCareType === '90' || 
                t.familyCare === '60' || t.familyCare === '90' || 
                t.familyCareType === '60' || t.familyCareType === '90' || 
                rec.isFamilyCare || rec.familyCare || t.isFamilyCare || t.familyCare ||
                totMin === '60' || totMin === '90';
    if (isFam) {
      badgesHtml += '<span style="font-size: 11px; background: #f3e8ff; color: #7e22ce; padding: 2px 6px; border-radius: 6px; font-weight: bold;">가족</span>';
    }

    // 2. 근무 구분(오전/오후) 뱃지 (하위 호환)
    var shiftVal = String(rec.shift || rec.shiftType || t.shift || t.shiftType || '').trim();
    if (shiftVal === '오전' || shiftVal === '1교대' || shiftVal === '1' || shiftVal.toLowerCase() === 'morning') {
      badgesHtml += '<span style="font-size: 11px; background: #e0f2fe; color: #0284c7; padding: 2px 6px; border-radius: 6px; font-weight: bold;">오전</span>';
    } else if (shiftVal === '오후' || shiftVal === '2교대' || shiftVal === '2' || shiftVal.toLowerCase() === 'afternoon') {
      badgesHtml += '<span style="font-size: 11px; background: #ffedd5; color: #ea580c; padding: 2px 6px; border-radius: 6px; font-weight: bold;">오후</span>';
    }

    // 3. 치매 뱃지 (보조)
    if (rec.isDementia && !isFam) {
      badgesHtml += '<span style="font-size: 11px; background: #fef3c7; color: #d97706; padding: 2px 6px; border-radius: 6px; font-weight: bold;">치매</span>';
    }

    row.innerHTML =
      '<div class="row-info-wrap" style="display: flex; align-items: center; gap: 2px; flex: 1; overflow: hidden; white-space: nowrap;">' +
        '<span class="row-name" style="font-weight: bold; color: #0f172a; font-size: 13px;">' + (rec.name || "무명") + '</span>' +
        genderHtml +
        gradeBadge +
        birthText +
        certText +
      '</div>' +
      '<div class="row-badges-wrap" style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">' +
        badgesHtml +
      '</div>';

    // 클릭 / 더블클릭 이벤트
    row.addEventListener("click", function () {
      selectRecipient(rec);
    });

    row.addEventListener("dblclick", function () {
      selectRecipient(rec);
      showToast("'" + rec.name + "' 수급자 데이터가 자동 적용되었습니다!");
    });

    listContainer.appendChild(row);
  });
}

/**
 * 4. 선택된 수급자를 롱텀 서식에 1:1 바인딩 (메인 화면 + PiP 미러링 창 둘 다 동시 반영!)
 */
function selectRecipient(rec) {
  if (!rec) return;
  currentSelectedRecipient = rec;
  selectedRecipientId = rec.id;

  // 1) 메인 창 리스트 하이라이트 갱신
  var rows = document.querySelectorAll(".recipient-row");
  rows.forEach(function (r) { r.classList.remove("selected"); });
  renderRecipientList();

  // 2) 갱신 대상 문서 목록 (메인 document + PiP document)
  var targetDocs = [document];
  if (pipWindowInstance && pipWindowInstance.document) {
    targetDocs.push(pipWindowInstance.document);
  }

  // 3) 수급자명, 요양요원명, 서비스일자(실시간 오늘 날짜) 1:1 바인딩
  var todayStr = getTodayDateString();
  var tpl = rec.template || {};
  var totalMinutes = parseInt(tpl.totalTime, 10) || 0;

  targetDocs.forEach(function (doc) {
    var elRecName = doc.getElementById("ltRecipientName");
    if (elRecName) {
      elRecName.textContent = rec.name || "-";
      elRecName.style.color = "#0f172a";
      elRecName.style.fontWeight = "bold";
    }

    var elCaregiver = doc.getElementById("ltCaregiverName");
    if (elCaregiver) {
      elCaregiver.textContent = rec.caregiver || "-";
      elCaregiver.style.color = "#0f172a";
    }

    var elDate = doc.getElementById("ltServiceDate");
    if (elDate) elDate.textContent = todayStr;

    // 총시간 표시 및 dataset.total 갱신
    var elTotal = doc.getElementById("ltTotalTimeDisplay");
    if (elTotal) {
      elTotal.textContent = "(총시간 : " + totalMinutes + "분)";
      elTotal.dataset.total = totalMinutes;
    }
  });

  // 4) 6대 요양 시간: 수급자 템플릿에 저장된 실제 시간 그대로 100% 충실 바인딩
  var sMin = Array.isArray(tpl.serviceMinutes) ? tpl.serviceMinutes : ["", "", "", "", "", ""];
  var physical = parseInt(sMin[0], 10) || 0;
  var cognitiveStim = parseInt(sMin[1], 10) || 0;
  var dailyTogether = parseInt(sMin[2], 10) || 0;
  var cognitiveBehavior = parseInt(sMin[3], 10) || 0;
  var emotional = parseInt(sMin[4], 10) || 0;
  var household = parseInt(sMin[5], 10) || 0;

  targetDocs.forEach(function (doc) {
    var elPhysical = doc.getElementById("timePhysical");
    if (elPhysical) elPhysical.value = pad3(physical);

    var elCogStim = doc.getElementById("timeCogStim");
    if (elCogStim) elCogStim.value = pad3(cognitiveStim);

    var elDailyTogether = doc.getElementById("timeDailyTogether");
    if (elDailyTogether) elDailyTogether.value = pad3(dailyTogether);

    var elCogBehavior = doc.getElementById("timeCogBehavior");
    if (elCogBehavior) elCogBehavior.value = pad3(cognitiveBehavior);

    var elEmotional = doc.getElementById("timeEmotional");
    if (elEmotional) elEmotional.value = pad3(emotional);

    var elHousehold = doc.getElementById("timeHousehold");
    if (elHousehold) elHousehold.value = pad3(household);
  });

  recalculateTimes();

  // 기본 상태: [유지] 및 0회
  setRadioChecked("radioBody", "유지");
  setRadioChecked("radioMeal", "유지");
  setRadioChecked("radioCognitive", "유지");

  var elFeces = getDocElem("fecesCount");
  if (elFeces) elFeces.value = "0";

  var elUrine = getDocElem("urineCount");
  if (elUrine) elUrine.value = "0";

  // 특이사항 메모 세팅
  updateCombinedNote();

  // 일일 체크박스 바인딩 (비정기 항목 필터링 포함)
  bindCheckboxes(tpl);

  // PiP 창 하단 수급자 목록 하이라이트 실시간 동기화
  if (pipWindowInstance && pipWindowInstance.document) {
    var pipRows = pipWindowInstance.document.querySelectorAll(".pip-list-container .recipient-row");
    if (pipRows && pipRows.length > 0) {
      var list = currentRecipients.slice();
      list.sort(function (a, b) {
        if (currentSortMode === "name") {
          return (a.name || "").localeCompare(b.name || "", "ko");
        } else {
          var tA = (a.template && a.template.startTime) ? a.template.startTime : "99:99";
          var tB = (b.template && b.template.startTime) ? b.template.startTime : "99:99";
          return tA.localeCompare(tB);
        }
      });

      list.forEach(function (r, idx) {
        if (pipRows[idx]) {
          if (r.id === rec.id) {
            pipRows[idx].classList.add("selected");
            pipRows[idx].scrollIntoView({ behavior: "smooth", block: "nearest" });
          } else {
            pipRows[idx].classList.remove("selected");
          }
        }
      });
    }
  }
}

/**
 * 5. 시간 계산
 */
function recalculateTimes() {
  var elPhysical = getDocElem("timePhysical");
  var elCogStim = getDocElem("timeCogStim");
  var elDailyTogether = getDocElem("timeDailyTogether");
  var elCogBehavior = getDocElem("timeCogBehavior");
  var elEmotional = getDocElem("timeEmotional");
  var elHousehold = getDocElem("timeHousehold");

  var t1 = elPhysical ? (parseInt(elPhysical.value, 10) || 0) : 0;
  var t2 = elCogStim ? (parseInt(elCogStim.value, 10) || 0) : 0;
  var t3 = elDailyTogether ? (parseInt(elDailyTogether.value, 10) || 0) : 0;
  var t4 = elCogBehavior ? (parseInt(elCogBehavior.value, 10) || 0) : 0;
  var t5 = elEmotional ? (parseInt(elEmotional.value, 10) || 0) : 0;
  var t6 = elHousehold ? (parseInt(elHousehold.value, 10) || 0) : 0;

  var enteredTotal = t1 + t2 + t3 + t4 + t5 + t6;
  var totalLimitElem = getDocElem("ltTotalTimeDisplay");
  var totalLimit = totalLimitElem ? (parseInt(totalLimitElem.dataset.total, 10) || 0) : 0;

  var remain = totalLimit > 0 ? (totalLimit - enteredTotal) : 0;

  var targetDocs = [document];
  if (pipWindowInstance && pipWindowInstance.document) {
    targetDocs.push(pipWindowInstance.document);
  }

  targetDocs.forEach(function (doc) {
    var elEntered = doc.getElementById("displayEnteredTime");
    if (elEntered) elEntered.textContent = "입력시간 : " + enteredTotal + "분";

    var remainElem = doc.getElementById("displayRemainTime");
    if (remainElem) {
      if (totalLimit === 0) {
        remainElem.textContent = "잔여시간 : 0분";
        remainElem.style.color = "#64748b";
        remainElem.style.fontWeight = "normal";
      } else if (remain === 0) {
        remainElem.textContent = "잔여시간 : 0분";
        remainElem.style.color = "#ff0000";
        remainElem.style.fontWeight = "bold";
      } else if (remain < 0) {
        remainElem.textContent = "초과시간 : " + Math.abs(remain) + "분";
        remainElem.style.color = "#c0392b";
        remainElem.style.fontWeight = "bold";
      } else {
        remainElem.textContent = "잔여시간 : " + remain + "분";
        remainElem.style.color = "#d35400";
        remainElem.style.fontWeight = "bold";
      }
    }
  });
}

/**
 * 6. 폼 이벤트 리스너 설정
 */
function setupFormEventListeners() {
  var timeInputs = getDocQueryAll(".time-input");
  timeInputs.forEach(function (input) {
    input.addEventListener("input", recalculateTimes);
    input.addEventListener("blur", function () {
      this.value = pad3(this.value);
    });
  });
}

function setRadioChecked(groupName, value) {
  var radios = pipWindowInstance && pipWindowInstance.document
    ? pipWindowInstance.document.getElementsByName(groupName)
    : document.getElementsByName(groupName);

  for (var i = 0; i < radios.length; i++) {
    if (radios[i].value === value) {
      radios[i].checked = true;
      break;
    }
  }
}

/**
 * 7. 체크박스 항목 바인딩 (관리자 8대 표준 인덱스 매핑 및 주/월/필요시 비정기 항목 자동 제외)
 */
function bindCheckboxes(tpl) {
  var chks = Array.isArray(tpl.checkboxes) ? tpl.checkboxes : [];
  var weekly = Array.isArray(tpl.weeklyCheckboxes) ? tpl.weeklyCheckboxes : [];
  var monthly = Array.isArray(tpl.monthlyCheckboxes) ? tpl.monthlyCheckboxes : [];
  var asNeeded = Array.isArray(tpl.asNeededCheckboxes) ? tpl.asNeededCheckboxes : [];

  function isDailyService(idx) {
    var isChecked = !!chks[idx];
    var isNonRegular = !!weekly[idx] || !!monthly[idx] || !!asNeeded[idx];
    return isChecked && !isNonRegular;
  }

  var elHygiene = getDocElem("chk_hygiene");
  if (elHygiene) elHygiene.checked = isDailyService(0);

  var elWash = getDocElem("chk_wash");
  if (elWash) elWash.checked = isDailyService(1);

  var elMeal = getDocElem("chk_meal");
  if (elMeal) elMeal.checked = isDailyService(2);

  var elPos = getDocElem("chk_position");
  if (elPos) elPos.checked = isDailyService(3);

  var elMove = getDocElem("chk_move");
  if (elMove) elMove.checked = isDailyService(4);

  var elToilet = getDocElem("chk_toilet");
  if (elToilet) elToilet.checked = isDailyService(5);

  var elLiving = getDocElem("chk_living");
  if (elLiving) elLiving.checked = isDailyService(6);

  var elPersonal = getDocElem("chk_personal_activity");
  if (elPersonal) elPersonal.checked = isDailyService(7);
}

/**
 * 8. 특이사항 사유 조합기 (화자 + 연속/공휴일 중복 조합 및 원클릭 복사)
 */
var selectedSpeaker = "수급자";
var isContinuousSelected = false;
var isHolidaySelected = false;

function setupNotePicker() {
  var speakerBtns = getDocQueryAll(".speaker-radio-btn");
  speakerBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      speakerBtns.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      var radio = btn.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        selectedSpeaker = radio.value;
        updateCombinedNote();
      }
    });
  });

  var btnContinuous = getDocElem("btnReasonContinuous");
  var btnHoliday = getDocElem("btnReasonHoliday");

  if (btnContinuous) {
    btnContinuous.addEventListener("click", function () {
      isContinuousSelected = !isContinuousSelected;
      btnContinuous.classList.toggle("active", isContinuousSelected);
      updateCombinedNote();
    });
  }

  if (btnHoliday) {
    btnHoliday.addEventListener("click", function () {
      isHolidaySelected = !isHolidaySelected;
      btnHoliday.classList.toggle("active", isHolidaySelected);
      updateCombinedNote();
    });
  }

  // 복사 버튼
  var btnCopy = getDocElem("btnCopyNote");
  if (btnCopy) {
    btnCopy.addEventListener("click", function () {
      var noteArea = getDocElem("ltNoteArea");
      var text = (noteArea ? noteArea.value : "").trim();
      if (!text) {
        showToast("⚠️ 복사할 특이사항 내용이 없습니다.");
        return;
      }

      function onCopySuccess() {
        var originalHtml = btnCopy.innerHTML;
        btnCopy.innerHTML = "✅ 복사 완료!";
        btnCopy.classList.add("copied");
        showToast("📋 특이사항이 클립보드에 복사되었습니다!");
        setTimeout(function () {
          btnCopy.innerHTML = originalHtml;
          btnCopy.classList.remove("copied");
        }, 1500);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(onCopySuccess).catch(function () {
          noteArea.select();
          document.execCommand("copy");
          onCopySuccess();
        });
      } else {
        noteArea.select();
        document.execCommand("copy");
        onCopySuccess();
      }
    });
  }

  // 초기화 버튼
  var btnReset = getDocElem("btnResetNote");
  if (btnReset) {
    btnReset.addEventListener("click", function () {
      isContinuousSelected = false;
      isHolidaySelected = false;
      if (btnContinuous) btnContinuous.classList.remove("active");
      if (btnHoliday) btnHoliday.classList.remove("active");

      if (currentSelectedRecipient && currentSelectedRecipient.template && currentSelectedRecipient.template.notes) {
        var noteArea = getDocElem("ltNoteArea");
        if (noteArea) noteArea.value = currentSelectedRecipient.template.notes;
      } else {
        var noteArea = getDocElem("ltNoteArea");
        if (noteArea) noteArea.value = "";
      }
      showToast("특이사항이 초기화되었습니다.");
    });
  }
}

/**
 * 화자 및 사유 선택에 따른 실시간 문구 조합
 */
function updateCombinedNote() {
  var noteArea = getDocElem("ltNoteArea");
  if (!noteArea) return;

  var generatedText = "";

  if (isContinuousSelected && isHolidaySelected) {
    generatedText = selectedSpeaker + " 요청에 의한 연속 및 공휴일 서비스제공";
  } else if (isContinuousSelected) {
    generatedText = selectedSpeaker + " 요청에 의한 연속서비스 제공";
  } else if (isHolidaySelected) {
    generatedText = selectedSpeaker + " 요청에 의한 공휴일 서비스제공";
  } else {
    if (currentSelectedRecipient && currentSelectedRecipient.template && currentSelectedRecipient.template.notes) {
      generatedText = currentSelectedRecipient.template.notes;
    } else {
      generatedText = "";
    }
  }

  noteArea.value = generatedText;
}

/**
 * 9. Document Picture-in-Picture (PiP) 모드 구현
 * - 메인 화면은 그대로 유지한 채 1:1 실시간 미러링 방식으로 동작
 * - 점검가이드/조합기를 제외하고 순수 롱텀 서식만 스크롤바 없이 콤팩트하게 표시
 */
function setupPiPMode() {
  var btnOpenPiP = document.getElementById("btnOpenPiP");
  if (!btnOpenPiP) return;

  btnOpenPiP.addEventListener("click", async function () {
    if (!("documentPictureInPicture" in window)) {
      alert("현재 사용 중인 브라우저는 Always-on-top PiP 기능을 지원하지 않습니다. 최신 Chrome 또는 Edge 브라우저를 사용해 주세요.");
      return;
    }

    try {
      if (pipWindowInstance) {
        pipWindowInstance.close();
        return;
      }

      // 1. PiP 창 요청 (좌: 서식 480px + 우: 수급자 260px = 760x730px 2열 가로 위젯 피팅)
      var pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 760,
        height: 730
      });
      pipWindowInstance = pipWindow;

      // 2. CSS 스타일시트 복사
      Array.from(document.styleSheets).forEach(function (styleSheet) {
        try {
          var cssRules = Array.from(styleSheet.cssRules).map(function (rule) { return rule.cssText; }).join("\n");
          var style = pipWindow.document.createElement("style");
          style.textContent = cssRules;
          pipWindow.document.head.appendChild(style);
        } catch (e) {
          var link = pipWindow.document.createElement("link");
          link.rel = "stylesheet";
          link.type = styleSheet.type;
          link.media = styleSheet.media;
          link.href = styleSheet.href;
          pipWindow.document.head.appendChild(link);
        }
      });

      // 3. PiP 전용 2열 가로 뷰 & 투명 글래스 위젯 스타일
      var pipCustomStyle = pipWindow.document.createElement("style");
      pipCustomStyle.textContent = `
        * {
          box-sizing: border-box !important;
        }
        html, body {
          padding: 8px !important;
          background: rgba(241, 245, 249, 0.75) !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          margin: 0 !important;
          overflow: hidden !important;
          scrollbar-width: none !important;
          font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, "Malgun Gothic", "맑은 고딕", sans-serif !important;
        }
        body::-webkit-scrollbar, html::-webkit-scrollbar {
          display: none !important;
        }

        /* 📱 좌우 2열 가로 미러링 컨테이너 */
        .pip-mirror-container {
          display: flex !important;
          flex-direction: row !important;
          align-items: flex-start !important;
          gap: 10px !important;
          width: 100% !important;
          height: 100% !important;
        }

        /* [좌측] 롱텀 서식 윈도우 */
        .longterm-window {
          width: 480px !important;
          flex-shrink: 0 !important;
          margin: 0 !important;
          background: rgba(255, 255, 255, 0.95) !important;
          border-radius: 10px !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08) !important;
          border: 1px solid rgba(255, 255, 255, 0.6) !important;
          overflow: hidden !important;
        }

        .lt-content {
          padding: 6px !important;
        }

        /* [우측] 수급자 목록 패널 (정확히 5명 높이 피팅) */
        .pip-recipient-section-wrap {
          flex: 1 !important;
          min-width: 240px !important;
          max-width: 260px !important;
          background: rgba(255, 255, 255, 0.95) !important;
          backdrop-filter: blur(12px) !important;
          border: 1px solid rgba(255, 255, 255, 0.8) !important;
          border-radius: 10px !important;
          padding: 10px !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06) !important;
          display: flex !important;
          flex-direction: column !important;
          height: auto !important;
        }

        .pip-recipient-section-wrap .sort-toggle-wrap {
          margin-bottom: 8px !important;
        }

        .pip-recipient-section-wrap .recipient-list {
          max-height: 198px !important; /* 정확히 5명만 노출 (6번째 완전 차단) */
          overflow-y: auto !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 5px !important;
          padding-right: 2px !important;
        }

        .pip-recipient-section-wrap .recipient-list::-webkit-scrollbar {
          width: 4px;
        }
        .pip-recipient-section-wrap .recipient-list::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }

        .pip-recipient-section-wrap .recipient-row {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          padding: 6px 8px !important;
          gap: 6px !important;
        }

        .pip-recipient-section-wrap .row-badges-wrap {
          display: flex !important;
          align-items: center !important;
          gap: 3px !important;
          flex-shrink: 0 !important;
        }
      `;
      pipWindow.document.head.appendChild(pipCustomStyle);

      // 4. PiP 미러링 래퍼 생성
      var mirrorContainer = pipWindow.document.createElement("div");
      mirrorContainer.className = "pip-mirror-container";

      // 5. 롱텀 서식 윈도우 맨 위에 배치
      var originalWindow = document.querySelector(".longterm-window");
      var clonedWindow = originalWindow.cloneNode(true);

      // PiP 창 내부에서는 'PiP 모드' 버튼을 숨기고 '✕ 닫기' 버튼을 활성화
      var clonedPipBtn = clonedWindow.querySelector("#btnOpenPiP");
      var clonedCloseBtn = clonedWindow.querySelector("#btnPipClose");
      if (clonedPipBtn) clonedPipBtn.style.display = "none";
      if (clonedCloseBtn) {
        clonedCloseBtn.style.display = "inline-flex";
        clonedCloseBtn.addEventListener("click", function () {
          pipWindow.close();
        });
      }

      mirrorContainer.appendChild(clonedWindow);

      // 6. 하단 수급자 패널 (실제 제어 패널과 100% 동일한 HTML/CSS 마크업)
      var panelWrap = pipWindow.document.createElement("div");
      panelWrap.className = "pip-recipient-section-wrap";

      var sortToggleWrap = pipWindow.document.createElement("div");
      sortToggleWrap.className = "sort-toggle-wrap";

      var btnSortName = pipWindow.document.createElement("button");
      btnSortName.type = "button";
      btnSortName.className = "btn-sort" + (currentSortMode === "name" ? " active" : "");
      btnSortName.innerHTML = "👥 이름순";

      var btnSortTime = pipWindow.document.createElement("button");
      btnSortTime.type = "button";
      btnSortTime.className = "btn-sort" + (currentSortMode === "time" ? " active" : "");
      btnSortTime.innerHTML = "⏰ 시간순";

      sortToggleWrap.appendChild(btnSortName);
      sortToggleWrap.appendChild(btnSortTime);

      var listContainer = pipWindow.document.createElement("div");
      listContainer.className = "recipient-list";
      listContainer.id = "pipRecipientList";

      function renderPipRecipients() {
        listContainer.innerHTML = "";

        var list = currentRecipients.filter(function (r) {
          var status = r.status || (r.isPending ? '보류' : (r.isWaiting ? '대기' : '정상'));
          if (status === '보류' || status === '대기' || r.isPending || r.isWaiting) return false;
          return true;
        });
        list.sort(function (a, b) {
          if (currentSortMode === "name") {
            return (a.name || "").localeCompare(b.name || "", "ko");
          } else {
            var tA = (a.template && a.template.startTime) ? a.template.startTime : "99:99";
            var tB = (b.template && b.template.startTime) ? b.template.startTime : "99:99";
            return tA.localeCompare(tB);
          }
        });

        list.forEach(function (rec) {
          var row = pipWindow.document.createElement("div");
          row.className = "recipient-row" + (rec.id === selectedRecipientId ? " selected" : "");

          // 성별 표시
          var genderHtml = rec.gender ? '<span style="font-size: 11px; color: ' + (rec.gender === '남' ? '#2563eb' : '#ec4899') + '; font-weight: bold; margin-left: 1px;">(' + rec.gender + ')</span>' : '';
          var gradeBadge = rec.grade ? '<span class="row-grade" style="font-size: 10.5px; background: #f1f5f9; color: #475569; padding: 1px 4px; border-radius: 4px; font-weight: bold; margin-left: 2px;">' + rec.grade + '등급</span>' : '';

          // 🏷️ 뱃지 생성 (우선순위: 1. 가족 -> 2. 오전/오후 -> 3. 치매)
          var badgesHtml = '';

          // 1. 가족요양 뱃지 (60분/90분 자동 판정 포함)
          var t = rec.template || {};
          var totMin = String((t && t.totalTime) ? t.totalTime : '').trim();
          var isFam = rec.familyCareType === '60' || rec.familyCareType === '90' || 
                      t.familyCare === '60' || t.familyCare === '90' || 
                      t.familyCareType === '60' || t.familyCareType === '90' || 
                      rec.isFamilyCare || rec.familyCare || t.isFamilyCare || t.familyCare ||
                      totMin === '60' || totMin === '90';
          if (isFam) {
            badgesHtml += '<span class="badge-family" style="font-size: 10px; background: #f3e8ff; color: #7e22ce; padding: 2px 5px; border-radius: 4px; font-weight: bold; flex-shrink: 0;">가족</span>';
          }

          // 2. 근무 구분(오전/오후) 뱃지
          var shiftVal = String(rec.shift || rec.shiftType || t.shift || t.shiftType || '').trim();
          if (shiftVal === '오전' || shiftVal === '1교대' || shiftVal === '1' || shiftVal.toLowerCase() === 'morning') {
            badgesHtml += '<span class="badge-shift-morning" style="font-size: 10px; background: #e0f2fe; color: #0284c7; padding: 2px 5px; border-radius: 4px; font-weight: bold; flex-shrink: 0;">오전</span>';
          } else if (shiftVal === '오후' || shiftVal === '2교대' || shiftVal === '2' || shiftVal.toLowerCase() === 'afternoon') {
            badgesHtml += '<span class="badge-shift-afternoon" style="font-size: 10px; background: #ffedd5; color: #ea580c; padding: 2px 5px; border-radius: 4px; font-weight: bold; flex-shrink: 0;">오후</span>';
          }

          // 3. 치매 뱃지 (우선순위 가장 마지막)
          if (rec.isDementia) {
            badgesHtml += '<span class="badge-dementia" style="font-size: 10px; background: #fef3c7; color: #d97706; padding: 2px 5px; border-radius: 4px; font-weight: bold; flex-shrink: 0;">치매</span>';
          }

          row.innerHTML =
            '<div class="row-info-wrap" style="display: flex; align-items: center; gap: 2px; flex: 1; overflow: hidden; white-space: nowrap;">' +
              '<span class="row-name" style="font-weight: bold; color: #0f172a; font-size: 12.5px;">' + (rec.name || "무명") + '</span>' +
              genderHtml +
              gradeBadge +
            '</div>' +
            '<div class="row-badges-wrap" style="display: flex; align-items: center; gap: 3px; flex-shrink: 0;">' +
              badgesHtml +
            '</div>';

          row.addEventListener("click", function () {
            selectRecipient(rec);
            updatePipSelectedRow(rec.id);
          });

          listContainer.appendChild(row);
        });
      }

      function updatePipSelectedRow(recId) {
        var allRows = listContainer.querySelectorAll(".recipient-row");
        var list = currentRecipients.slice();
        list.sort(function (a, b) {
          if (currentSortMode === "name") {
            return (a.name || "").localeCompare(b.name || "", "ko");
          } else {
            var tA = (a.template && a.template.startTime) ? a.template.startTime : "99:99";
            var tB = (b.template && b.template.startTime) ? b.template.startTime : "99:99";
            return tA.localeCompare(tB);
          }
        });

        list.forEach(function (r, idx) {
          if (allRows[idx]) {
            if (r.id === recId) {
              allRows[idx].classList.add("selected");
              allRows[idx].scrollIntoView({ behavior: "smooth", block: "nearest" });
            } else {
              allRows[idx].classList.remove("selected");
            }
          }
        });
      }

      btnSortName.addEventListener("click", function () {
        currentSortMode = "name";
        btnSortName.classList.add("active");
        btnSortTime.classList.remove("active");
        renderPipRecipients();
      });

      btnSortTime.addEventListener("click", function () {
        currentSortMode = "time";
        btnSortTime.classList.add("active");
        btnSortName.classList.remove("active");
        renderPipRecipients();
      });

      renderPipRecipients();

      panelWrap.appendChild(sortToggleWrap);
      panelWrap.appendChild(listContainer);

      mirrorContainer.appendChild(panelWrap);
      pipWindow.document.body.appendChild(mirrorContainer);

      // 현재 선택된 수급자 데이터 즉시 동기화
      if (currentSelectedRecipient) {
        selectRecipient(currentSelectedRecipient);
      }

      btnOpenPiP.innerHTML = "📌 PiP 실행 중 (닫기)";
      btnOpenPiP.classList.add("active");

      // PiP 창 닫힐 때 핸들링
      pipWindow.addEventListener("pagehide", function () {
        pipWindowInstance = null;
        btnOpenPiP.innerHTML = "📌 PiP 모드";
        btnOpenPiP.classList.remove("active");
        showToast("PiP 미러링 창이 닫혔습니다.");
      });

      showToast("📌 실시간 미러링 PiP 창이 켜졌습니다!");

    } catch (err) {
      console.error("PiP 실행 실패:", err);
      showToast("⚠️ PiP 모드 실행 중 오류가 발생했습니다.");
    }
  });
}

function showToast(message) {
  var toast = getDocElem("toastNotice");
  if (!toast) {
    toast = (pipWindowInstance && pipWindowInstance.document ? pipWindowInstance.document : document).createElement("div");
    toast.id = "toastNotice";
    toast.className = "toast-notice";
    (pipWindowInstance && pipWindowInstance.document ? pipWindowInstance.document.body : document.body).appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(function () {
    toast.classList.remove("show");
  }, 2500);
}
