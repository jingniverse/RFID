/**
 * ==========================================================================
 * 국민건강보험공단 롱텀케어(Longterm) 특정내역 수정 스크립트 (longterm.js)
 * 작성일: 2026-08-15
 * 기능:
 * 1. 기존 RFID APP & 수기기록지와 100% 동일한 수급자 제어 패널(검색, 정렬, 드로어)
 * 2. 수급자 클릭/더블클릭 시 롱텀 팝업 서식에 1:1 자동 바인딩
 * 3. 6대 요양 시간 실시간 계산 및 일일체크/기본값(유지, 0회) 처리
 * 4. 상용구 프리셋 및 [관리자] 수급자 등록 대시보드 팝업 연동
 * ==========================================================================
 */

// 전역 상태 변수
var currentRecipients = [];
var currentSortMode = "name"; // "name" (이름순) | "time" (시간순)
var currentSearchQuery = "";
var selectedRecipientId = null;

// 상용구 프리셋 데이터
var PRESET_NOTES = [
  {
    title: "병원동행",
    text: "수급자 요청으로 병원 동행. 진료 접수 및 처방약 수령, 안전한 귀가 보조를 수행함."
  },
  {
    title: "일반방문요양",
    text: "신체활동 지원 및 안부 확인, 개인위생(세면·양치) 보조와 안전한 일상생활을 도움."
  },
  {
    title: "정서지원/말벗",
    text: "어르신과 지난 추억 이야기 나누기 및 말벗을 통한 정서적 지지와 심리적 안정을 도모함."
  },
  {
    title: "인지자극/프로그램",
    text: "기억력 회상 대화 및 인지 자극 훈련(그림 그리기, 숫자 퍼즐)을 어르신과 함께 진행함."
  },
  {
    title: "외출/산책동행",
    text: "낙상 예방에 유의하며 인근 공원 가벼운 보행 운동 및 바깥바람 쐬기 외출 동행을 수행함."
  },
  {
    title: "식사/주변위생",
    text: "영양 균형에 맞춘 식사 도움 및 식후 복약 지도, 주거 공간 청결을 위한 주변 정리정돈을 함."
  }
];

var currentSelectedRecipient = null;

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
});

/**
 * 1. 수급자 데이터 로드 (localStorage 우선, 없으면 INITIAL_RECIPIENTS 사용)
 */
function loadData() {
  var savedData = localStorage.getItem("rfid_recipients_data");
  if (savedData) {
    try {
      currentRecipients = JSON.parse(savedData);
    } catch (e) {
      console.warn("로컬스토리지 파싱 실패, 기본값 사용:", e);
      currentRecipients = typeof INITIAL_RECIPIENTS !== "undefined" ? INITIAL_RECIPIENTS : [];
    }
  } else if (typeof INITIAL_RECIPIENTS !== "undefined") {
    currentRecipients = INITIAL_RECIPIENTS;
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

  // 검색 입력
  var searchInput = document.getElementById("recipient-search");
  var clearBtn = document.getElementById("btn-search-clear");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      currentSearchQuery = this.value.trim().toLowerCase();
      if (clearBtn) {
        clearBtn.style.display = currentSearchQuery ? "block" : "none";
      }
      renderRecipientList();
    });
  }

  if (clearBtn && searchInput) {
    clearBtn.addEventListener("click", function () {
      searchInput.value = "";
      currentSearchQuery = "";
      this.style.display = "none";
      searchInput.focus();
      renderRecipientList();
    });
  }

  // 정렬 버튼
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
 * 4. 선택된 수급자를 롱텀 서식에 1:1 바인딩
 */
function selectRecipient(rec) {
  if (!rec) return;
  currentSelectedRecipient = rec;
  selectedRecipientId = rec.id;

  // 리스트 하이라이트 갱신
  var rows = document.querySelectorAll(".recipient-row");
  rows.forEach(function (r) { r.classList.remove("selected"); });
  renderRecipientList();

  var tpl = rec.template || {};

  // 기본 인적 정보
  document.getElementById("ltRecipientName").textContent = rec.name || "-";
  document.getElementById("ltCaregiverName").textContent = rec.caregiver || "-";
  document.getElementById("ltServiceDate").textContent = getTodayDateString();

  // 총 서비스 시간
  var totalMinutes = parseInt(tpl.totalTime, 10) || 180;
  document.getElementById("ltTotalTimeDisplay").textContent = "(총시간 : " + totalMinutes + "분)";
  document.getElementById("ltTotalTimeDisplay").dataset.total = totalMinutes;

  // 6대 요양 기타 정보 분 분배 (관리자 템플릿 표준 인덱스 준수)
  // [0] 신체활동, [1] 인지자극, [2] 일상생활, [3] 인지행동, [4] 정서지원, [5] 가사제공
  var sMin = Array.isArray(tpl.serviceMinutes) ? tpl.serviceMinutes : ["", "", "", "", "", ""];

  var physical = parseInt(sMin[0], 10) || 0;       // [0] 신체활동
  var cognitiveStim = parseInt(sMin[1], 10) || 0;  // [1] 인지자극
  var dailyTogether = parseInt(sMin[2], 10) || 0;  // [2] 일상생활 (함께하기)
  var cognitiveBehavior = parseInt(sMin[3], 10) || 0; // [3] 인지행동 (변화관리)
  var emotional = parseInt(sMin[4], 10) || 0;      // [4] 정서지원
  var household = parseInt(sMin[5], 10) || 0;      // [5] 가사제공 (가사일상생활지원)

  // 만약 템플릿에 세부 분배가 전혀 없는 경우만 안전 기본값 분배
  if (physical === 0 && cognitiveStim === 0 && dailyTogether === 0 && cognitiveBehavior === 0 && emotional === 0 && household === 0) {
    if (totalMinutes >= 180) {
      physical = 60;
      emotional = 30;
      household = totalMinutes - 90;
    } else if (totalMinutes >= 120) {
      physical = 60;
      emotional = 20;
      household = totalMinutes - 80;
    } else {
      physical = Math.floor(totalMinutes * 0.6);
      household = totalMinutes - physical;
    }
  }

  document.getElementById("timePhysical").value = pad3(physical);
  document.getElementById("timeCogStim").value = pad3(cognitiveStim);
  document.getElementById("timeDailyTogether").value = pad3(dailyTogether);
  document.getElementById("timeCogBehavior").value = pad3(cognitiveBehavior);
  document.getElementById("timeEmotional").value = pad3(emotional);
  document.getElementById("timeHousehold").value = pad3(household);

  recalculateTimes();

  // 기본 상태: [유지] 및 0회
  setRadioChecked("radioBody", "유지");
  setRadioChecked("radioMeal", "유지");
  setRadioChecked("radioCognitive", "유지");

  document.getElementById("fecesCount").value = "0";
  document.getElementById("urineCount").value = "0";

  // 특이사항 메모 세팅 (조합기가 활성화되어 있으면 조합문구, 아니면 원본 템플릿 메모)
  updateCombinedNote();

  // 일일 체크박스 바인딩 (비정기 항목 필터링 포함)
  bindCheckboxes(tpl);
}

/**
 * 5. 시간 계산
 */
function recalculateTimes() {
  var t1 = parseInt(document.getElementById("timePhysical").value, 10) || 0;
  var t2 = parseInt(document.getElementById("timeCogStim").value, 10) || 0;
  var t3 = parseInt(document.getElementById("timeDailyTogether").value, 10) || 0;
  var t4 = parseInt(document.getElementById("timeCogBehavior").value, 10) || 0;
  var t5 = parseInt(document.getElementById("timeEmotional").value, 10) || 0;
  var t6 = parseInt(document.getElementById("timeHousehold").value, 10) || 0;

  var enteredTotal = t1 + t2 + t3 + t4 + t5 + t6;
  var totalLimitElem = document.getElementById("ltTotalTimeDisplay");
  var totalLimit = parseInt(totalLimitElem.dataset.total, 10) || 180;

  var remain = totalLimit - enteredTotal;

  document.getElementById("displayEnteredTime").textContent = "입력시간 : " + enteredTotal + "분";
  var remainElem = document.getElementById("displayRemainTime");
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

/**
 * 6. 폼 이벤트 리스너 설정
 */
function setupFormEventListeners() {
  var timeInputs = document.querySelectorAll(".time-input");
  timeInputs.forEach(function (input) {
    input.addEventListener("input", recalculateTimes);
    input.addEventListener("blur", function () {
      this.value = pad3(this.value);
    });
  });
}

function setRadioChecked(groupName, value) {
  var radios = document.getElementsByName(groupName);
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

  // 비정기(주간/월간/필요시) 항목을 제외한 '순수 일일 제공 서비스'인지 확인하는 판별 함수
  function isDailyService(idx) {
    var isChecked = !!chks[idx];
    var isNonRegular = !!weekly[idx] || !!monthly[idx] || !!asNeeded[idx];
    return isChecked && !isNonRegular;
  }

  // 관리자 8대 체크박스 인덱스:
  // [0] 개인위생, [1] 몸 씻기 도움, [2] 식사 도움, [3] 체위변경
  // [4] 이동 도움, [5] 화장실 이용, [6] 식사준비/청소, [7] 개인활동지원
  document.getElementById("chk_hygiene").checked = isDailyService(0);           // 개인위생
  document.getElementById("chk_wash").checked = isDailyService(1);              // 몸 씻기
  document.getElementById("chk_meal").checked = isDailyService(2);              // 식사 도움
  document.getElementById("chk_position").checked = isDailyService(3);          // 체위변경
  document.getElementById("chk_move").checked = isDailyService(4);              // 이동 도움
  document.getElementById("chk_toilet").checked = isDailyService(5);            // 화장실이용하기

  document.getElementById("chk_living").checked = isDailyService(6);            // 식사준비, 청소, 주변정리정돈, 세탁 등
  document.getElementById("chk_personal_activity").checked = isDailyService(7); // 개인활동지원
}

/**
 * 8. 특이사항 사유 조합기 (화자 + 연속/공휴일 중복 조합 및 원클릭 복사)
 */
var selectedSpeaker = "수급자";
var isContinuousSelected = false;
var isHolidaySelected = false;

function setupNotePicker() {
  var speakerBtns = document.querySelectorAll(".speaker-radio-btn");
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

  var btnContinuous = document.getElementById("btnReasonContinuous");
  var btnHoliday = document.getElementById("btnReasonHoliday");

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
  var btnCopy = document.getElementById("btnCopyNote");
  if (btnCopy) {
    btnCopy.addEventListener("click", function () {
      var noteArea = document.getElementById("ltNoteArea");
      var text = (noteArea ? noteArea.value : "").trim();
      if (!text) {
        showToast("⚠️ 복사할 특이사항 내용이 없습니다.");
        return;
      }

      function onCopySuccess() {
        // 1. 버튼 자체를 '✅ 복사 완료!'로 즉시 변경
        var originalHtml = btnCopy.innerHTML;
        btnCopy.innerHTML = "✅ 복사 완료!";
        btnCopy.classList.add("copied");

        // 2. 상단 중앙에 눈에 확 띄는 알림 팝업
        showToast("📋 특이사항이 클립보드에 복사되었습니다!");

        // 3. 1.5초 후 원래 버튼으로 복원
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
  var btnReset = document.getElementById("btnResetNote");
  if (btnReset) {
    btnReset.addEventListener("click", function () {
      isContinuousSelected = false;
      isHolidaySelected = false;
      if (btnContinuous) btnContinuous.classList.remove("active");
      if (btnHoliday) btnHoliday.classList.remove("active");

      // 수급자 원래 템플릿 노트로 복원
      if (currentSelectedRecipient && currentSelectedRecipient.template && currentSelectedRecipient.template.notes) {
        document.getElementById("ltNoteArea").value = currentSelectedRecipient.template.notes;
      } else {
        document.getElementById("ltNoteArea").value = "";
      }
      showToast("특이사항이 초기화되었습니다.");
    });
  }
}

/**
 * 화자 및 사유 선택에 따른 실시간 문구 조합
 * - 둘 다 선택: [화자] 요청에 의한 연속 및 공휴일 서비스제공
 * - 연속만: [화자] 요청에 의한 연속서비스 제공
 * - 공휴일만: [화자] 요청에 의한 공휴일 서비스제공
 */
function updateCombinedNote() {
  var noteArea = document.getElementById("ltNoteArea");
  if (!noteArea) return;

  var generatedText = "";

  if (isContinuousSelected && isHolidaySelected) {
    generatedText = selectedSpeaker + " 요청에 의한 연속 및 공휴일 서비스제공";
  } else if (isContinuousSelected) {
    generatedText = selectedSpeaker + " 요청에 의한 연속서비스 제공";
  } else if (isHolidaySelected) {
    generatedText = selectedSpeaker + " 요청에 의한 공휴일 서비스제공";
  } else {
    // 둘 다 해제되었을 때는 원래 수급자 저장 노트
    if (currentSelectedRecipient && currentSelectedRecipient.template && currentSelectedRecipient.template.notes) {
      generatedText = currentSelectedRecipient.template.notes;
    } else {
      generatedText = "";
    }
  }

  noteArea.value = generatedText;
}

var toastTimeout = null;

function showToast(message) {
  var toast = document.getElementById("toastNotice");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toastNotice";
    toast.className = "toast-notice";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(function () {
    toast.classList.remove("show");
  }, 2500);
}
