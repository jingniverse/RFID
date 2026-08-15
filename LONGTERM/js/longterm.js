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
  loadData();
  setupControlPanel();
  setupFormEventListeners();
  setupNotePicker();
  setupPiPMode();
});

/**
 * 1. 수급자 데이터 로드 (localStorage 우선, 없거나 구버전이면 INITIAL_RECIPIENTS 사용)
 */
function loadData() {
  var savedData = localStorage.getItem("rfid_recipients_data");
  if (savedData) {
    try {
      currentRecipients = JSON.parse(savedData);
      // 만약 저장된 데이터가 2명 이하인 구버전이면 최신 6명 데이터로 자동 갱신
      if (Array.isArray(currentRecipients) && currentRecipients.length < 6 && typeof INITIAL_RECIPIENTS !== "undefined") {
        currentRecipients = INITIAL_RECIPIENTS;
        localStorage.setItem("rfid_recipients_data", JSON.stringify(INITIAL_RECIPIENTS));
      }
    } catch (e) {
      console.warn("로컬스토리지 파싱 실패, 기본값 사용:", e);
      currentRecipients = typeof INITIAL_RECIPIENTS !== "undefined" ? INITIAL_RECIPIENTS : [];
    }
  } else if (typeof INITIAL_RECIPIENTS !== "undefined") {
    currentRecipients = INITIAL_RECIPIENTS;
    localStorage.setItem("rfid_recipients_data", JSON.stringify(INITIAL_RECIPIENTS));
  } else {
    currentRecipients = [];
  }

  renderRecipientList();

  // 첫 번째 수급자로 자동 폼 로드
  if (currentRecipients.length > 0) {
    selectRecipient(currentRecipients[0]);
  }
}

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
      var manageUrl = "../수기 급여제공기록지/[관리자] 수급자 등록 및 변경하기.html";
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

  // 1) 검색 필터링
  var filtered = currentRecipients.filter(function (r) {
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

    var isDementiaBadge = rec.isDementia ? '<span class="badge-dementia">치매</span>' : '';
    var gradeBadge = '<span class="row-grade">' + (rec.grade ? rec.grade + '등급' : '등급없음') + '</span>';
    var birthText = rec.birth ? '<span class="row-birth">' + rec.birth + '</span>' : '';

    row.innerHTML =
      '<div class="row-info-wrap">' +
      '<span class="row-name">' + (rec.name || "무명") + '</span>' +
      isDementiaBadge +
      gradeBadge +
      birthText +
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

  var tpl = rec.template || {};
  var totalMinutes = parseInt(tpl.totalTime, 10) || 180;

  var sMin = Array.isArray(tpl.serviceMinutes) ? tpl.serviceMinutes : ["", "", "", "", "", ""];
  var physical = parseInt(sMin[0], 10) || 0;
  var cognitiveStim = parseInt(sMin[1], 10) || 0;
  var dailyTogether = parseInt(sMin[2], 10) || 0;
  var cognitiveBehavior = parseInt(sMin[3], 10) || 0;
  var emotional = parseInt(sMin[4], 10) || 0;
  var household = parseInt(sMin[5], 10) || 0;

  if (physical === 0 && cognitiveStim === 0 && dailyTogether === 0 && cognitiveBehavior === 0 && emotional === 0 && household === 0) {
    if (totalMinutes >= 180) {
      physical = 60; emotional = 30; household = totalMinutes - 90;
    } else if (totalMinutes >= 120) {
      physical = 60; emotional = 20; household = totalMinutes - 80;
    } else {
      physical = Math.floor(totalMinutes * 0.6);
      household = totalMinutes - physical;
    }
  }

  var elPhysical = getDocElem("timePhysical");
  if (elPhysical) elPhysical.value = pad3(physical);

  var elCogStim = getDocElem("timeCogStim");
  if (elCogStim) elCogStim.value = pad3(cognitiveStim);

  var elDailyTogether = getDocElem("timeDailyTogether");
  if (elDailyTogether) elDailyTogether.value = pad3(dailyTogether);

  var elCogBehavior = getDocElem("timeCogBehavior");
  if (elCogBehavior) elCogBehavior.value = pad3(cognitiveBehavior);

  var elEmotional = getDocElem("timeEmotional");
  if (elEmotional) elEmotional.value = pad3(emotional);

  var elHousehold = getDocElem("timeHousehold");
  if (elHousehold) elHousehold.value = pad3(household);

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
  var totalLimit = totalLimitElem ? (parseInt(totalLimitElem.dataset.total, 10) || 180) : 180;

  var remain = totalLimit - enteredTotal;

  var elEntered = getDocElem("displayEnteredTime");
  if (elEntered) elEntered.textContent = "입력시간 : " + enteredTotal + "분";

  var remainElem = getDocElem("displayRemainTime");
  if (remainElem) {
    remainElem.textContent = "잔여시간 : " + remain + "분";
    if (remain === 0) {
      remainElem.style.color = "#ff0000";
      remainElem.style.fontWeight = "bold";
    } else if (remain < 0) {
      remainElem.textContent = "초과시간 : " + Math.abs(remain) + "분";
      remainElem.style.color = "#c0392b";
    } else {
      remainElem.style.color = "#d35400";
    }
  }
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

        list.forEach(function (rec) {
          var row = pipWindow.document.createElement("div");
          row.className = "recipient-row" + (rec.id === selectedRecipientId ? " selected" : "");

          var isDementiaBadge = rec.isDementia ? '<span class="badge-dementia">치매</span>' : '';
          var gradeBadge = '<span class="row-grade">' + (rec.grade ? rec.grade + '등급' : '등급없음') + '</span>';
          var birthText = rec.birth ? '<span class="row-birth">' + rec.birth + '</span>' : '';

          row.innerHTML =
            '<div class="row-info-wrap">' +
            '<span class="row-name">' + (rec.name || "무명") + '</span>' +
            isDementiaBadge +
            gradeBadge +
            birthText +
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
