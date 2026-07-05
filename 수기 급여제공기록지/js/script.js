// 장기요양급여 제공기록지(방문요양) - JavaScript

document.addEventListener('DOMContentLoaded', function () {
  // 인쇄 단축키 (Ctrl+P)
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.key === 'p') {
      e.preventDefault();
      window.print();
    }
  });

  // 1. 텍스트 입력 처리 (값 존재 여부에 따라 클래스 토글)
  const inputs = document.querySelectorAll('.data-input');

  // 분 단위 시간 입력 3자리 제한 (대변/소변 실수 입력창 제외)
  inputs.forEach(inp => {
    if (!inp.classList.contains('feces-input') && !inp.classList.contains('urine-input') &&
      (inp.classList.contains('total-time-input') || inp.classList.contains('val-input') || inp.classList.contains('housework-time-input'))) {
      inp.setAttribute('maxlength', '3');
    }
  });

  function updateInputState(input) {
    const val = input.value.trim();
    // 값이 비어있지 않고, '/' 나 ':' 가 아닌 실제 값일 경우
    if (val !== '' && val !== '/' && val !== ':') {
      input.classList.add('has-value');

      if (input.nextElementSibling && input.nextElementSibling.classList.contains('unit')) {
        input.nextElementSibling.classList.add('has-value');
      }
    } else {
      input.classList.remove('has-value');

      if (input.nextElementSibling && input.nextElementSibling.classList.contains('unit')) {
        input.nextElementSibling.classList.remove('has-value');
      }
    }
  }

  // 초기 상태 설정
  inputs.forEach(updateInputState);

  // 현재 연도 자동 입력
  const yearInput = document.querySelector('.year-input');
  if (yearInput && !yearInput.value) {
    yearInput.value = new Date().getFullYear();
    updateInputState(yearInput);
  }

  // 장기요양등급 선택에 따른 자동 계산 및 인쇄 연동
  const gradeSelect = document.querySelector('.grade-select');
  const gradePrint = document.querySelector('.grade-print');
  const startTimeInputs = document.querySelectorAll('.start-time-input');
  const endTimeInputs = document.querySelectorAll('.end-time-input');
  const totalTimeInputs = document.querySelectorAll('.total-time-input');

  function calculateTimeForIndex(index) {
    const startInput = startTimeInputs[index];
    const endInput = endTimeInputs[index];
    const totalInput = totalTimeInputs[index];

    if (!startInput || !endInput || !totalInput) return;

    const startVal = startInput.value.trim();

    // 만약 시작시간을 지우면 종료시간과 총시간도 초기화
    if (startVal === '') {
      endInput.value = '';
      totalInput.value = '';
      updateInputState(endInput);
      updateInputState(totalInput);
      return;
    }

    // HH:MM 형식이 완전하게 입력되었을 때만 처리 (5글자)
    if (startVal.length !== 5 || !startVal.includes(':')) {
      return;
    }

    const grade = gradeSelect.value;
    if (!grade) {
      return;
    }

    let hoursToAdd = 0;
    let minutesTotal = 0;

    if (grade === '1' || grade === '2') {
      hoursToAdd = 4;
      minutesTotal = 240;
    } else if (grade === '3' || grade === '4' || grade === '5') {
      hoursToAdd = 3;
      minutesTotal = 180;
    } else {
      return;
    }

    const parts = startVal.split(':');
    let h = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);

    if (isNaN(h) || isNaN(m)) return;

    let endH = h + hoursToAdd;
    let endM = m;

    if (endH >= 24) {
      endH = endH - 24;
    }

    const endHStr = String(endH).padStart(2, '0');
    const endMStr = String(endM).padStart(2, '0');

    endInput.value = `${endHStr}:${endMStr}`;
    totalInput.value = String(minutesTotal);

    updateInputState(endInput);
    updateInputState(totalInput);
  }

  if (gradeSelect) {
    gradeSelect.addEventListener('change', function () {
      if (this.value) {
        gradePrint.textContent = this.options[this.selectedIndex].text;
      } else {
        gradePrint.textContent = '';
      }
      // 등급이 변경되면 기존에 입력된 모든 시작시간에 대해 재계산 수행
      for (let i = 0; i < startTimeInputs.length; i++) {
        calculateTimeForIndex(i);
      }
      // 등급 변경에 따른 총시간 재계산 완료 후 실시간 오류 알림 대시보드 동기화
      if (typeof updateValidationDashboard === 'function') {
        updateValidationDashboard();
      }
    });
    // 초기 등급 텍스트 셋업
    if (gradeSelect.value) {
      gradePrint.textContent = gradeSelect.options[gradeSelect.selectedIndex].text;
    }
  }

  // 스마트 마스킹 및 자동 완성 함수들
  function getYear() {
    const yearInput = document.querySelector('.year-input');
    if (yearInput && yearInput.value) {
      const y = parseInt(yearInput.value, 10);
      if (!isNaN(y)) return y;
    }
    return new Date().getFullYear();
  }

  function getLastDayOfMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function formatDate(digits, isBlur = false) {
    if (digits.length === 0) return '';
    if (digits.length === 1) {
      if (isBlur) {
        return '01/0' + digits[0];
      }
      if (digits[0] > '1') return '0' + digits[0] + '/';
      return digits;
    }
    if (digits.length === 2) {
      let m = parseInt(digits, 10);
      if (m < 1) m = 1;
      if (m > 12) m = 12;
      const mStr = String(m).padStart(2, '0');
      return mStr + (isBlur ? '/01' : '/');
    }

    let mStr = digits.substring(0, 2);
    let m = parseInt(mStr, 10);
    if (m < 1) { mStr = '01'; m = 1; }
    if (m > 12) { mStr = '12'; m = 12; }

    let dStr = digits.substring(2);
    if (dStr.length === 0) {
      return mStr + (isBlur ? '/01' : '/');
    }

    let d = parseInt(dStr, 10);
    if (isNaN(d)) {
      return mStr + (isBlur ? '/01' : '/');
    }

    const year = getYear();
    const maxDay = getLastDayOfMonth(year, m);

    if (dStr.length === 1) {
      if (isBlur) {
        if (d < 1) d = 1;
        if (d > maxDay) d = maxDay;
        return mStr + '/' + String(d).padStart(2, '0');
      }
      // 첫 번째 자리가 4 이상인 날짜는 존재할 수 없으므로 0을 붙여 바로 한 자리 일로 완성
      if (dStr[0] > '3') {
        let cleanD = d;
        if (cleanD > maxDay) cleanD = maxDay;
        return mStr + '/0' + cleanD;
      }
      return mStr + '/' + dStr;
    }

    // 2자리 이상의 일에 대한 말일 초과 시 보정 처리
    if (d > maxDay) {
      d = maxDay;
    }
    if (d < 1) {
      d = 1;
    }
    return mStr + '/' + String(d).padStart(2, '0');
  }

  function formatTime(digits) {
    if (digits.length === 0) return '';
    if (digits.length === 1) {
      if (digits[0] > '2') return '0' + digits[0] + ':';
      return digits;
    }
    if (digits.length === 2) {
      let h = parseInt(digits, 10);
      if (h >= 0 && h <= 23) return digits + ':';
      return '0' + digits[0] + ':' + digits[1];
    }
    if (digits.length === 3) {
      let h = parseInt(digits.substring(0, 2), 10);
      if (h >= 0 && h <= 23) return digits.substring(0, 2) + ':' + digits.substring(2);
      return '0' + digits[0] + ':' + digits.substring(1, 3);
    }
    let hStr = digits.substring(0, 2);
    let h = parseInt(hStr, 10);
    if (h >= 0 && h <= 23) return hStr + ':' + digits.substring(2, 4);
    return '0' + digits[0] + ':' + digits.substring(1, 3);
  }

  // 입력 시 상태 업데이트 및 마스킹 처리
  inputs.forEach(input => {
    input.addEventListener('input', function (e) {
      // 숫자만 입력가능한 필드 (년도, 분, 회 등)
      if (this.classList.contains('num-only')) {
        this.value = this.value.replace(/[^0-9]/g, '');
        updateInputState(this);
        return;
      }

      if (e.inputType === 'deleteContentBackward') {
        updateInputState(this);
        // 만약 시작시간 지울 경우 즉시 영향 반영
        if (this.classList.contains('start-time-input')) {
          const index = Array.from(startTimeInputs).indexOf(this);
          calculateTimeForIndex(index);
        }
        return;
      }

      if (this.classList.contains('time-mask')) {
        let val = this.value.replace(/[^0-9]/g, '');
        this.value = formatTime(val);
      }

      if (this.classList.contains('date-mask')) {
        let val = this.value.replace(/[^0-9]/g, '');
        this.value = formatDate(val, false);
      }

      updateInputState(this);

      // 시작시간 입력 시 자동 계산 호출
      if (this.classList.contains('start-time-input')) {
        const index = Array.from(startTimeInputs).indexOf(this);
        calculateTimeForIndex(index);
      }
    });

    // blur 시에도 스마트 포맷팅 및 자동 계산
    input.addEventListener('blur', function (e) {
      if (this.classList.contains('time-mask') || this.classList.contains('date-mask')) {
        let val = this.value.replace(/[^0-9]/g, '');
        if (val.length > 0) {
          if (this.classList.contains('time-mask')) {
            this.value = formatTime(val);
          } else {
            this.value = formatDate(val, true);
          }
        }
        updateInputState(this);

        // 시작시간 blur 시 자동 계산 호출
        if (this.classList.contains('start-time-input')) {
          const index = Array.from(startTimeInputs).indexOf(this);
          calculateTimeForIndex(index);
        }
      }
    });
  });

  // 2. 일반 체크박스 처리 (tabindex 부여 및 키보드 엔터/스페이스 대응)
  const chkBoxes = document.querySelectorAll('.chk-box');
  chkBoxes.forEach(chk => {
    chk.setAttribute('tabindex', '0'); // 동적 탭 포커스 인덱스 부여

    // 체크 토글 함수
    function toggleChk(box) {
      if (box.classList.contains('checked')) {
        box.classList.remove('checked');
        box.innerText = '□';
      } else {
        box.classList.add('checked');
        box.innerText = '☑';
      }
    }

    chk.addEventListener('click', function (e) {
      e.stopPropagation(); // td 클릭 이벤트 전파 차단하여 중복 토글 방지
      toggleChk(this);
    });

    // 부모 td 전체 영역 클릭 위임 및 스타일 추가
    const parentTd = chk.closest('td');
    if (parentTd) {
      parentTd.classList.add('chk-cell');
      parentTd.addEventListener('click', function () {
        const box = this.querySelector('.chk-box');
        if (box) toggleChk(box);
      });
    }

    // 엔터 및 스페이스바 키 입력 지원
    chk.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); // 기본 화면 스크롤 거동 방지
        toggleChk(this);
      }
    });
  });

  // 3. 변화상태 번호 라디오 박스 처리 (tabindex 부여 및 키보드 엔터/스페이스/화살표 대응 및 마우스 순환 선택 탑재)
  const numGroups = document.querySelectorAll('.num-group');
  numGroups.forEach(group => {
    const boxes = group.querySelectorAll('.num-box');

    // 부모 td(셀 전체 영역) 클릭 시 마우스 순환(Cycle) 입력 처리 및 호버 스타일 연동
    group.classList.add('chk-cell');
    group.style.cursor = 'pointer';

    group.addEventListener('click', function (e) {
      // 1. 키보드로 진입하여 누른 경우 (e.clientX === 0 또는 e.pointerType 없음)
      //    이때는 키보드로 포커스 된 특정 num-box가 바로 단독 선택되도록 유도
      if (e.target.classList.contains('num-box') && (e.clientX === 0 || e.pointerType === '')) {
        const targetBox = e.target;
        const isActive = targetBox.classList.contains('checked');
        boxes.forEach(b => b.classList.remove('checked'));
        if (!isActive) {
          targetBox.classList.add('checked');
        }
        return;
      }

      // 2. 마우스로 셀 내부 영역을 직접 클릭한 경우: 순환(Cycle) 처리 (없음 -> 1 -> 2 -> 3 -> 없음)
      const checkedBox = group.querySelector('.num-box.checked');

      // 일단 모든 선택 상태 리셋
      boxes.forEach(b => b.classList.remove('checked'));

      if (!checkedBox) {
        // 없음 상태였던 경우 -> 1번 선택
        boxes[0].classList.add('checked');
      } else {
        const val = checkedBox.getAttribute('data-val');
        if (val === '1') {
          boxes[1].classList.add('checked'); // 1번 선택 중이었던 경우 -> 2번 선택
        } else if (val === '2') {
          boxes[2].classList.add('checked'); // 2번 선택 중이었던 경우 -> 3번 선택
        }
        // 3번 선택 중이었던 경우 -> 리셋된 상태(선택 없음)로 유지
      }
    });

    // 각 번호 박스의 개별 설정 (tabindex 및 키보드 이벤트 바인딩)
    boxes.forEach(box => {
      box.setAttribute('tabindex', '0'); // 동적 탭 포커스 인덱스 부여

      // 엔터 및 스페이스바 키 입력 지원
      box.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault(); // 기본 화면 스크롤 거동 방지
          this.click(); // keydown -> click 유도 (상단 click 핸들러의 키보드 체크 분기로 연결됨)
        }

        // 좌우 화살표 키로 1, 2, 3번 박스 간 편리한 가로 이동 지원 (경계면 도달 시 다음 열로 탈출 가능)
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          const siblingBoxes = Array.from(group.querySelectorAll('.num-box'));
          const currentIndex = siblingBoxes.indexOf(this);

          // [경계선 탐지] 맨 오른쪽(3번)에서 오른쪽 키를 누르거나, 맨 왼쪽(1번)에서 왼쪽 키를 누른 경우
          if (e.key === 'ArrowRight' && currentIndex === siblingBoxes.length - 1) {
            // 로컬 이동을 건너뛰고 이벤트를 전파하여 글로벌 격자 내비게이션(다음 칸)이 작동하도록 유도
            return;
          }
          if (e.key === 'ArrowLeft' && currentIndex === 0) {
            // 로컬 이동을 건너뛰고 이벤트를 전파하여 글로벌 격자 내비게이션(이전 칸)이 작동하도록 유도
            return;
          }

          e.preventDefault();
          e.stopPropagation(); // 중간 박스 이동 시에만 이벤트를 가둬 중복 동작 차단

          let nextIndex = currentIndex;
          if (e.key === 'ArrowRight') {
            nextIndex = currentIndex + 1;
          } else if (e.key === 'ArrowLeft') {
            nextIndex = currentIndex - 1;
          }

          const targetBox = siblingBoxes[nextIndex];
          if (targetBox) {
            targetBox.focus(); // 단순 포커스 이동만 시키고 자동 선택은 제거하여 자유로운 가속 탐색 보장!
          }
        }
      });
    });
  });

  // 4. 제공시간 합산 검증 시스템 (오류 알림 대시보드 및 상단 플로팅 토스트 연동)
  function getColumnSum(colIndex) {
    let sum = 0;
    const timeRows = document.querySelectorAll('.time-row');
    timeRows.forEach(row => {
      const inputsInRow = row.querySelectorAll('input');
      const input = inputsInRow[colIndex];
      if (input) {
        const valStr = input.value.trim();
        if (valStr !== '') {
          const val = parseInt(valStr, 10);
          if (!isNaN(val)) {
            sum += val;
          }
        }
      }
    });
    return sum;
  }

  // 실시간 상단 플로팅 토스트 경고 알림 발생기
  function showValidationToast(colIndex, message) {
    const container = document.getElementById('validation-toast-container');
    if (!container) return;

    // 이미 동일한 열(colIndex)의 토스트가 떠 있는 경우, 텍스트만 업데이트하여 도배 현상 방지!
    const existingToast = container.querySelector(`.val-toast-card[data-col="${colIndex}"]`);
    if (existingToast) {
      const msgEl = existingToast.querySelector('.val-toast-msg');
      if (msgEl) msgEl.textContent = message;

      // 자동 종료 타이머 리셋
      if (existingToast._timer) clearTimeout(existingToast._timer);
      existingToast._timer = setTimeout(() => {
        existingToast.classList.add('fade-out');
        existingToast.addEventListener('animationend', () => existingToast.remove());
      }, 3500);
      return;
    }

    const toast = document.createElement('div');
    toast.className = 'val-toast-card';
    toast.setAttribute('data-col', colIndex);
    toast.innerHTML = `
      <span class="val-toast-icon">⚠️</span>
      <span class="val-toast-msg">${escapeHtml(message)}</span>
      <button class="val-toast-close">&times;</button>
    `;

    // 닫기 버튼 직접 동작 연동
    toast.querySelector('.val-toast-close').addEventListener('click', () => {
      toast.classList.add('fade-out');
      toast.addEventListener('animationend', () => toast.remove());
    });

    container.appendChild(toast);

    // 3.5초 후에 부드럽게 페이드아웃 되며 스스로 제거되는 타이머
    toast._timer = setTimeout(() => {
      toast.classList.add('fade-out');
      toast.addEventListener('animationend', () => toast.remove());
    }, 3500);
  }

  // 실시간 오류 알림 대시보드 및 다차원 열(헤더/총시간) 강조 갱신 함수
  function updateValidationDashboard() {
    const dashboardList = document.getElementById('validation-dashboard-list');
    if (!dashboardList) return;

    dashboardList.innerHTML = '';
    const errors = [];
    const scheduleDateInputs = document.querySelectorAll('.record-table tr:not(.note-row) input.date-mask');

    for (let colIndex = 0; colIndex < 7; colIndex++) {
      const totalInput = totalTimeInputs[colIndex];
      const dateInput = scheduleDateInputs[colIndex];
      if (!totalInput) continue;

      const totalValStr = totalInput.value.trim();
      // 총시간이 비어있으면 일지 작성이 안된 상태이므로 오류에서 패스
      if (totalValStr === '') {
        totalInput.classList.remove('val-error-highlight');
        if (dateInput) dateInput.classList.remove('val-error-highlight');
        continue;
      }

      const totalMinutes = parseInt(totalValStr, 10);
      if (isNaN(totalMinutes)) {
        totalInput.classList.remove('val-error-highlight');
        if (dateInput) dateInput.classList.remove('val-error-highlight');
        continue;
      }

      const sum = getColumnSum(colIndex);
      if (sum !== totalMinutes) {
        // 오류 상태: 붉은 하이라이트 클래스를 상/하단(요일 월일 & 총시간) 양쪽에 부여! [대안 2]
        totalInput.classList.add('val-error-highlight');
        if (dateInput) dateInput.classList.add('val-error-highlight');

        const diff = Math.abs(totalMinutes - sum);
        let errorMsg = '';
        if (sum < totalMinutes) {
          errorMsg = `[${colIndex + 1}번째 날] 제공시간 합(${sum}분)이 총시간(${totalMinutes}분)보다 ${diff}분 부족합니다.`;
        } else {
          errorMsg = `[${colIndex + 1}번째 날] 제공시간 합(${sum}분)이 총시간(${totalMinutes}분)을 ${diff}분 초과했습니다.`;
        }
        errors.push({ colIndex, msg: errorMsg });
      } else {
        // 일치 상태: 붉은 하이라이트 클래스 제거
        totalInput.classList.remove('val-error-highlight');
        if (dateInput) dateInput.classList.remove('val-error-highlight');
      }
    }

    if (errors.length > 0) {
      errors.forEach(err => {
        const item = document.createElement('div');
        item.className = 'val-dashboard-item';
        item.innerHTML = `<span>⚠️ ${escapeHtml(err.msg)}</span>`;
        dashboardList.appendChild(item);
      });
    } else {
      const item = document.createElement('div');
      item.className = 'val-dashboard-item success';
      item.innerHTML = `<span>✅ 모든 일정의 합산 시간이 완벽히 일치합니다.</span>`;
      dashboardList.appendChild(item);
    }

    return errors;
  }

  // 실시간 검증 및 상황별 스마트 알림 트리거 바인딩
  const timeRows = document.querySelectorAll('.time-row');
  timeRows.forEach(row => {
    const inputsInRow = row.querySelectorAll('input');
    inputsInRow.forEach((input, colIndex) => {

      // 실시간 입력 중 (input 이벤트)
      input.addEventListener('input', () => {
        const errors = updateValidationDashboard();

        // 1. [초과 에러 즉시 감지]: 입력하는 도중에도 초과가 감지되면 즉시 토스트 배너 활성화
        const targetError = errors.find(e => e.colIndex === colIndex);
        if (targetError && targetError.msg.includes('초과')) {
          showValidationToast(colIndex, targetError.msg);
        } else {
          // 시간이 정상화되었거나 초과가 더이상 아닌 경우 해당 열의 토스트 알림 카드를 부드럽게 지움
          const container = document.getElementById('validation-toast-container');
          if (container) {
            const existingToast = container.querySelector(`.val-toast-card[data-col="${colIndex}"]`);
            if (existingToast && (!targetError || !targetError.msg.includes('초과'))) {
              existingToast.classList.add('fade-out');
              existingToast.addEventListener('animationend', () => existingToast.remove());
            }
          }
        }
      });

      // 포커스가 벗어남 (blur 이벤트)
      input.addEventListener('blur', () => {
        setTimeout(() => {
          const errors = updateValidationDashboard();
          const targetError = errors.find(e => e.colIndex === colIndex);
          if (!targetError) return;

          // 2. [초과 에러]: 포커스가 나갈 때 초과한 에러가 남아 있다면 당연히 알림 표출
          if (targetError.msg.includes('초과')) {
            showValidationToast(colIndex, targetError.msg);
          }
          // 3. [부족 에러]: 작성 흐름 방해 방지를 위해, 맨 마지막 '가사 및 일상생활 지원'(housework-time-input) 입력란일 때만 부족 알림 표출
          else if (targetError.msg.includes('부족')) {
            if (input.classList.contains('housework-time-input')) {
              showValidationToast(colIndex, targetError.msg);
            }
          }
        }, 100);
      });
    });
  });

  totalTimeInputs.forEach((totalInput, colIndex) => {
    totalInput.addEventListener('input', () => {
      const errors = updateValidationDashboard();

      // 총시간 값 수정 중 초과 오류 발생 시 즉각 토스트 경고
      const targetError = errors.find(e => e.colIndex === colIndex);
      if (targetError && targetError.msg.includes('초과')) {
        showValidationToast(colIndex, targetError.msg);
      }
    });

    totalInput.addEventListener('blur', () => {
      setTimeout(() => {
        const errors = updateValidationDashboard();
        const targetError = errors.find(e => e.colIndex === colIndex);
        if (targetError) {
          // 총시간 필드를 편집하고 벗어났을 때는 최종 상태 갱신 목적이므로 필요 시 바로 띄움
          showValidationToast(colIndex, targetError.msg);
        }
      }, 100);
    });
  });

  // 초기 렌더링 시 대시보드 계산 한 번 수행
  updateValidationDashboard();

  // 인쇄 전 최종 데이터 완결성 검증 (window.print() 호출 가로채기)
  function validateAllColumnsForPrint() {
    // 0) 활성화된 열의 대소변 실수 횟수가 비어 있는 경우 자동 0회 기입 보완
    const fecesInputs = document.querySelectorAll('.feces-input');
    const urineInputs = document.querySelectorAll('.urine-input');
    for (let colIndex = 0; colIndex < 7; colIndex++) {
      const schedInput = scheduleDateInputs[colIndex];
      const startInput = startTimeInputs[colIndex];
      const dateVal = schedInput ? schedInput.value.trim() : '';
      const startVal = startInput ? startInput.value.trim() : '';

      if (dateVal !== '' || startVal !== '') {
        const fecesInput = fecesInputs[colIndex];
        const urineInput = urineInputs[colIndex];
        if (fecesInput && fecesInput.value.trim() === '') {
          fecesInput.value = '0';
          updateInputState(fecesInput);
        }
        if (urineInput && urineInput.value.trim() === '') {
          urineInput.value = '0';
          updateInputState(urineInput);
        }
      }
    }

    // 1) 인정번호 자릿수 및 포맷 검증
    const certInp = document.querySelector('.cert-input');
    if (certInp) {
      const certVal = certInp.value.trim();
      if (certVal !== '' && (certVal.length !== 11 || !/^[lL]\d{10}$/.test(certVal))) {
        alert('장기요양인정번호는 L로 시작하고 숫자가 10자리인 총 11자리여야 인쇄 및 저장이 가능합니다.\n(예: L1234567890)');
        certInp.focus();
        return false;
      }
    }

    // 2) 생년월일 유효성 검증
    const birthInp = document.querySelector('.birth-input');
    if (birthInp) {
      const birthVal = birthInp.value.trim();
      if (birthVal !== '') {
        if (birthVal.length !== 6) {
          alert('생년월일은 6자리 숫자로 정확하게 입력해 주세요.');
          birthInp.focus();
          return false;
        }
        const mm = parseInt(birthVal.substring(2, 4), 10);
        const dd = parseInt(birthVal.substring(4, 6), 10);
        if (isNaN(mm) || mm < 1 || mm > 12 || isNaN(dd) || dd < 1 || dd > 31) {
          alert('생년월일의 월(01~12) 또는 일(01~31) 범위가 유효하지 않습니다.\n다시 한 번 입력 값을 확인해 주세요.');
          birthInp.focus();
          return false;
        }
      }
    }

    let hasError = false;
    for (let colIndex = 0; colIndex < 7; colIndex++) {
      const totalInput = totalTimeInputs[colIndex];
      if (totalInput) {
        const totalValStr = totalInput.value.trim();
        if (totalValStr !== '') {
          const totalMinutes = parseInt(totalValStr, 10);
          const sum = getColumnSum(colIndex);
          if (sum !== totalMinutes) {
            hasError = true;
            break;
          }
        }
      }
    }

    if (hasError) {
      alert('시간 합산이 일치하지 않는 일정이 존재합니다.\n\n우측 제어 패널 하단의 [⚠️ 실시간 오류 알림 대시보드] 내용을 확인하시어 시간을 정확하게 조정해 주세요.');
      return false;
    }
    return true;
  }

  // 5. 추가 입력 폼 제한 시스템 (성명, 생년월일, 인정번호)
  const nameInput = document.querySelector('.name-input');
  if (nameInput) {
    // 한글 입력 조합 도중 지워지는 현상을 방지하기 위해 blur(입력완료) 시 한글 외의 문자 제거
    nameInput.addEventListener('blur', function () {
      this.value = this.value.replace(/[^ㄱ-ㅎㅏ-ㅣ가-힣]/g, '');
      updateInputState(this);
    });
  }

  const birthInput = document.querySelector('.birth-input');
  if (birthInput) {
    birthInput.addEventListener('input', function () {
      // 숫자 이외의 문자 즉시 제거
      this.value = this.value.replace(/[^0-9]/g, '');
    });
  }

  const certInput = document.querySelector('.cert-input');
  if (certInput) {
    certInput.addEventListener('input', function () {
      let val = this.value;

      // 첫 글자는 대문자 'L'로 강제 고정
      if (!val.startsWith('L')) {
        if (val.toLowerCase().startsWith('l')) {
          val = 'L' + val.substring(1);
        } else {
          val = 'L' + val;
        }
      }

      // 'L' 뒷글자는 무조건 숫자만 허용
      const rest = val.substring(1).replace(/[^0-9]/g, '');
      this.value = 'L' + rest;
    });

    // 포커스를 잃거나 완전히 비웠을 때 기본 문자 'L' 복원
    certInput.addEventListener('blur', function () {
      if (this.value.trim() === '' || this.value === 'L') {
        this.value = 'L';
      }
    });
  }

  // 6. 탭(Tab) 키 세로 방향 포커스 이동 구현

  // 요소가 몇 번째 열(0~6)에 있는지 구하는 헬퍼 함수
  function getColumnIndex(element) {
    const rect = element.getBoundingClientRect();
    const elemX = rect.left + rect.width / 2;

    let closestIndex = -1;
    let minDiff = Infinity;

    const scheduleDateInputs = document.querySelectorAll('.record-table tr:not(.note-row) input.date-mask');
    scheduleDateInputs.forEach((schedInput, index) => {
      const schedRect = schedInput.getBoundingClientRect();
      const schedX = schedRect.left + schedRect.width / 2;
      const diff = Math.abs(elemX - schedX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = index;
      }
    });

    return closestIndex;
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {

      const activeEl = document.activeElement;
      if (!activeEl) return;

      // 우측 제어 패널(control-panel) 내부의 입력 및 버튼 요소들은 브라우저 기본 탭 포커스 이동을 따르도록 예외 처리
      if (activeEl.closest('.control-panel')) {
        return;
      }

      if (activeEl.tagName !== 'INPUT' && activeEl.getAttribute('tabindex') !== '0') return;

      const noteRows = Array.from(document.querySelectorAll('.note-row'));
      const scheduleDateInputs = document.querySelectorAll('.record-table tr:not(.note-row) input.date-mask');

      // 정방향 Tab
      if (!e.shiftKey) {
        // [소변 실수 횟수 -> 특이사항 텍스트 칸 워프]
        if (activeEl.classList.contains('urine-input')) {
          const colIndex = getColumnIndex(activeEl);
          if (colIndex >= 0 && colIndex < noteRows.length) {
            const noteRow = noteRows[colIndex];
            const targetNoteInput = noteRow.querySelector('.data-input:not(.date-mask)');
            if (targetNoteInput) {
              e.preventDefault();
              targetNoteInput.focus();
              if (typeof targetNoteInput.select === 'function') {
                targetNoteInput.select();
              }
              return;
            }
          }
        }

        // [특이사항 텍스트 칸 -> 다음 날 상단 월/일 또는 특이사항 다음 줄로 스마트 워프]
        const currentNoteRow = activeEl.closest('.note-row');
        if (currentNoteRow && activeEl.classList.contains('data-input') && !activeEl.classList.contains('date-mask')) {
          const currentIndex = noteRows.indexOf(currentNoteRow);
          // 마지막 줄이 아니라면 다음 행동 결정
          if (currentIndex >= 0 && currentIndex < 6) {
            const nextDateVal = scheduleDateInputs[currentIndex + 1] ? scheduleDateInputs[currentIndex + 1].value.trim() : '';
            const nextStartVal = startTimeInputs[currentIndex + 1] ? startTimeInputs[currentIndex + 1].value.trim() : '';
            const nextEndVal = endTimeInputs[currentIndex + 1] ? endTimeInputs[currentIndex + 1].value.trim() : '';

            // 날짜, 시작시간, 종료시간이 모두 5자리로 완전하게 입력되었는지 검사
            const isDateFilled = nextDateVal.length === 5 && nextDateVal.includes('/');
            const isStartFilled = nextStartVal.length === 5 && nextStartVal.includes(':');
            const isEndFilled = nextEndVal.length === 5 && nextEndVal.includes(':');

            // 변화상태 3행(신체기능, 식사기능, 인지기능)의 해당 열에 모두 체크가 되었는지 검사
            const changeStatusRows = Array.from(document.querySelectorAll('.record-table tr')).filter(tr => tr.querySelector('.num-group'));
            let allChangeStatusChecked = true;
            if (changeStatusRows.length > 0) {
              changeStatusRows.forEach(row => {
                const groups = row.querySelectorAll('.num-group');
                const targetGroup = groups[currentIndex + 1];
                if (targetGroup) {
                  const hasChecked = targetGroup.querySelector('.num-box.checked');
                  if (!hasChecked) allChangeStatusChecked = false;
                } else {
                  allChangeStatusChecked = false;
                }
              });
            } else {
              allChangeStatusChecked = false;
            }

            const isNextDayWritten = isDateFilled && isStartFilled && isEndFilled && allChangeStatusChecked;

            let targetInput = null;
            if (isNextDayWritten) {
              // 이미 다음 날이 작성되어 있다면 바로 특이사항 다음 행의 텍스트 칸으로 직행!
              const nextNoteRow = noteRows[currentIndex + 1];
              if (nextNoteRow) {
                targetInput = nextNoteRow.querySelector('.data-input:not(.date-mask)');
              }
            } else {
              // 작성되어 있지 않다면 상단 일정관리의 다음 날 월/일 칸으로 이동!
              targetInput = scheduleDateInputs[currentIndex + 1];
            }

            if (targetInput) {
              e.preventDefault();
              targetInput.focus();
              if (typeof targetInput.select === 'function') {
                targetInput.select();
              }
              return;
            }
          }
        }
      }
      // 역방향 Shift + Tab
      else {
        // [상단 월/일 -> 이전 날 특이사항 텍스트 칸 워프]
        const dateInputIndex = Array.from(scheduleDateInputs).indexOf(activeEl);
        if (dateInputIndex > 0) { // 1번째 ~ 6번째 열의 월/일인 경우
          const prevNoteRow = noteRows[dateInputIndex - 1];
          if (prevNoteRow) {
            const prevNoteInput = prevNoteRow.querySelector('.data-input:not(.date-mask)');
            if (prevNoteInput) {
              e.preventDefault();
              prevNoteInput.focus();
              if (typeof prevNoteInput.select === 'function') {
                prevNoteInput.select();
              }
              return;
            }
          }
        }

        // [특이사항 텍스트 칸 -> 해당 날짜 소변 실수 횟수 워프]
        const currentNoteRow = activeEl.closest('.note-row');
        if (currentNoteRow && activeEl.classList.contains('data-input') && !activeEl.classList.contains('date-mask')) {
          const currentIndex = noteRows.indexOf(currentNoteRow);
          if (currentIndex >= 0) {
            const urineInputs = document.querySelectorAll('.urine-input');
            const targetUrineInput = urineInputs[currentIndex];
            if (targetUrineInput) {
              e.preventDefault();
              targetUrineInput.focus();
              if (typeof targetUrineInput.select === 'function') {
                targetUrineInput.select();
              }
              return;
            }
          }
        }
      }

      e.preventDefault(); // 기본 가로 탭 네비게이션 차단

      // 화면에 표시되어 있고 입력 가능한 모든 기록지 내부의 input, select 및 대화형 제어 장치(tabindex="0")만 수집
      const inputs = Array.from(document.querySelectorAll('.record-table input, .record-table [tabindex="0"], .record-table select')).filter(input => {
        const rect = input.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && !input.disabled && !input.readOnly;
      });

      const activeRect = activeEl.getBoundingClientRect();
      const activeX = activeRect.left + activeRect.width / 2;
      const activeY = activeRect.top + activeRect.height / 2;

      let targetInput = null;

      if (!e.shiftKey) {
        // Tab: 바로 아래 방향으로 포커스
        let candidates = inputs.filter(input => {
          const rect = input.getBoundingClientRect();
          const y = rect.top + rect.height / 2;
          return y > activeRect.bottom + 2;
        });

        if (candidates.length > 0) {
          // 제일 가까운 밑의 행 구하기
          candidates.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
          const minTop = candidates[0].getBoundingClientRect().top;

          // 같은 행 범위(15px) 내에서 X축 좌표가 가장 가까운 요소 선별
          const rowCandidates = candidates.filter(input => Math.abs(input.getBoundingClientRect().top - minTop) < 15);
          rowCandidates.sort((a, b) => {
            const aRect = a.getBoundingClientRect();
            const bRect = b.getBoundingClientRect();
            const aX = aRect.left + aRect.width / 2;
            const bX = bRect.left + bRect.width / 2;
            return Math.abs(aX - activeX) - Math.abs(bX - activeX);
          });
          targetInput = rowCandidates[0];
        } else {
          // 아래에 요소가 없을 경우 다음 오른쪽 열의 맨 위 요소로 순환
          let rightCandidates = inputs.filter(input => {
            const rect = input.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            return x > activeX + 10;
          });

          if (rightCandidates.length > 0) {
            rightCandidates.sort((a, b) => {
              const aRect = a.getBoundingClientRect();
              const bRect = b.getBoundingClientRect();
              const xDiff = (aRect.left + aRect.width / 2) - (bRect.left + bRect.width / 2);
              if (Math.abs(xDiff) < 15) {
                return aRect.top - bRect.top;
              }
              return xDiff;
            });
            targetInput = rightCandidates[0];
          } else {
            // 오른쪽도 없다면 전체의 맨 첫 번째 input으로 회귀
            targetInput = inputs[0];
          }
        }
      } else {
        // Shift + Tab: 바로 위 방향으로 포커스
        let candidates = inputs.filter(input => {
          const rect = input.getBoundingClientRect();
          const y = rect.top + rect.height / 2;
          return y < activeRect.top - 2;
        });

        if (candidates.length > 0) {
          // 제일 가까운 위의 행 구하기
          candidates.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
          const maxTop = candidates[0].getBoundingClientRect().top;

          // 같은 행 범위(15px) 내에서 X축 좌표가 가장 가까운 요소 선별
          const rowCandidates = candidates.filter(input => Math.abs(input.getBoundingClientRect().top - maxTop) < 15);
          rowCandidates.sort((a, b) => {
            const aRect = a.getBoundingClientRect();
            const bRect = b.getBoundingClientRect();
            const aX = aRect.left + aRect.width / 2;
            const bX = bRect.left + bRect.width / 2;
            return Math.abs(aX - activeX) - Math.abs(bX - activeX);
          });
          targetInput = rowCandidates[0];
        } else {
          // 위에 요소가 없을 경우 이전 왼쪽 열의 맨 아래 요소로 순환
          let leftCandidates = inputs.filter(input => {
            const rect = input.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            return x < activeX - 10;
          });

          if (leftCandidates.length > 0) {
            leftCandidates.sort((a, b) => {
              const aRect = a.getBoundingClientRect();
              const bRect = b.getBoundingClientRect();
              const xDiff = (bRect.left + bRect.width / 2) - (aRect.left + aRect.width / 2);
              if (Math.abs(xDiff) < 15) {
                return bRect.top - aRect.top;
              }
              return xDiff;
            });
            targetInput = leftCandidates[0];
          } else {
            // 왼쪽도 없다면 전체의 맨 마지막 input으로 회귀
            targetInput = inputs[inputs.length - 1];
          }
        }
      }

      if (targetInput) {
        targetInput.focus();
        if (typeof targetInput.select === 'function') {
          targetInput.select();
        }
      }
    }
  });

  // 7. 테이블 셀(td, th) 클릭 시 내부의 input 요소로 포커스 자동 연결 시스템
  const recordTable = document.querySelector('.record-table');
  if (recordTable) {
    recordTable.addEventListener('click', function (e) {
      // 클릭한 엘리먼트 또는 그 조상 중 td/th 확인
      const cell = e.target.closest('td, th');
      if (cell) {
        // 클릭 대상이 이미 input, select, chk-box, num-box 등 제어 장치인 경우 기본 동작 유지
        if (
          e.target.tagName === 'INPUT' ||
          e.target.tagName === 'SELECT' ||
          e.target.classList.contains('chk-box') ||
          e.target.classList.contains('num-box')
        ) {
          return;
        }

        // 셀 내에 비활성화되지 않은 첫 번째 input 요소를 검색
        const input = cell.querySelector('input:not([disabled]):not([readonly])');
        if (input) {
          input.focus();
          // 숫자 텍스트 등의 수정을 신속하게 돕기 위해 전체 선택 처리
          if (typeof input.select === 'function') {
            input.select();
          }
        }
      }
    });
  }

  // 8. 일정관리 월일(date-mask) 입력 시 특이사항 날짜 칸 자동 복사 동기화 시스템
  const scheduleDateInputs = document.querySelectorAll('.record-table tr:not(.note-row) input.date-mask');
  const noteDateInputs = document.querySelectorAll('.note-row input.date-mask');

  scheduleDateInputs.forEach((schedInput, index) => {
    // 입력 발생 시 실시간 동기화
    schedInput.addEventListener('input', function () {
      const noteInput = noteDateInputs[index];
      if (noteInput) {
        noteInput.value = this.value;
        updateInputState(noteInput);
      }
    });

    // blur 포커스 아웃 시 스마트 보정 값까지 포함하여 동기화
    schedInput.addEventListener('blur', function () {
      const noteInput = noteDateInputs[index];
      if (noteInput) {
        noteInput.value = this.value;
        updateInputState(noteInput);
      }
    });
  });

  // 9. 일정관리 입력 시 장기요양요원 및 수급자 서명란 듀얼 자동 입력 시스템
  const signRows = document.querySelectorAll('.sign-row');
  const officerSignInputs = signRows[0] ? signRows[0].querySelectorAll('input') : [];
  const recipientSignInputs = signRows[1] ? signRows[1].querySelectorAll('input') : [];

  let activeCaregiverName = '홍길동'; // 수급자 연동에 따라 변경되는 전역 요양보호사 성명

  function updateAllSignaturesCaregiver(newName) {
    activeCaregiverName = newName;
    for (let colIndex = 0; colIndex < 7; colIndex++) {
      const schedInput = scheduleDateInputs[colIndex];
      const startInput = startTimeInputs[colIndex];
      const officerInput = officerSignInputs[colIndex];

      if (!officerInput) continue;

      const dateVal = schedInput ? schedInput.value.trim() : '';
      const startVal = startInput ? startInput.value.trim() : '';

      // 일정이 적혀 있는 열인 경우에만 요양보호사 서명 실시간 동기화
      if (dateVal !== '' || startVal !== '') {
        officerInput.value = newName;
        updateInputState(officerInput);
      }
    }
  }

  function autoFillSignatures(colIndex) {
    const schedInput = scheduleDateInputs[colIndex];
    const startInput = startTimeInputs[colIndex];
    const officerInput = officerSignInputs[colIndex];
    const recipientInput = recipientSignInputs[colIndex];

    if (!officerInput && !recipientInput) return;

    const dateVal = schedInput ? schedInput.value.trim() : '';
    const startVal = startInput ? startInput.value.trim() : '';
    const currentRecipientName = nameInput ? nameInput.value.trim() : '';
    const caregiverName = activeCaregiverName || '홍길동';

    const fecesInputs = document.querySelectorAll('.feces-input');
    const urineInputs = document.querySelectorAll('.urine-input');
    const fecesInput = fecesInputs[colIndex];
    const urineInput = urineInputs[colIndex];

    // 날짜 또는 시작시간 중 하나라도 값이 입력된 경우
    if (dateVal !== '' || startVal !== '') {
      // 1) 요양보호사 서명란 자동 기입
      if (officerInput && officerInput.value.trim() === '') {
        officerInput.value = caregiverName;
        updateInputState(officerInput);
      }
      // 2) 수급자 서명란 자동 기입 (상단 수급자 성명이 적혀 있을 때)
      if (recipientInput && recipientInput.value.trim() === '') {
        if (currentRecipientName !== '') {
          recipientInput.value = currentRecipientName;
          updateInputState(recipientInput);
        }
      }
      // 3) 대소변 실수 횟수 자동 기입 (비어있으면 무조건 0회로 자동 기입)
      if (fecesInput && fecesInput.value.trim() === '') {
        fecesInput.value = '0';
        updateInputState(fecesInput);
      }
      if (urineInput && urineInput.value.trim() === '') {
        urineInput.value = '0';
        updateInputState(urineInput);
      }
    } else {
      // 날짜와 시작시간이 모두 지워지면 서명란 및 대소변 실수 횟수도 자동 초기화
      if (officerInput && officerInput.value.trim() === caregiverName) {
        officerInput.value = '';
        updateInputState(officerInput);
      }
      if (recipientInput && recipientInput.value.trim() === currentRecipientName) {
        recipientInput.value = '';
        updateInputState(recipientInput);
      }
      if (fecesInput && fecesInput.value.trim() === '0') {
        fecesInput.value = '';
        updateInputState(fecesInput);
      }
      if (urineInput && urineInput.value.trim() === '0') {
        urineInput.value = '';
        updateInputState(urineInput);
      }
    }
  }

  // 상단 수급자 성명 수정 시, 이미 활성화된 열들의 수급자 서명란도 실시간 동기화
  if (nameInput) {
    nameInput.addEventListener('input', function () {
      const newName = this.value.trim();
      for (let colIndex = 0; colIndex < 7; colIndex++) {
        const schedInput = scheduleDateInputs[colIndex];
        const startInput = startTimeInputs[colIndex];
        const recipientInput = recipientSignInputs[colIndex];

        if (!recipientInput) continue;

        const dateVal = schedInput ? schedInput.value.trim() : '';
        const startVal = startInput ? startInput.value.trim() : '';

        // 일정이 적혀 있는 열인 경우에만 수급자 서명 실시간 동기화
        if (dateVal !== '' || startVal !== '') {
          recipientInput.value = newName;
          updateInputState(recipientInput);
        }
      }
    });
  }

  // 각 일정관리 월일 및 시작시간 필드에 자동 채우기 트리거 연동
  scheduleDateInputs.forEach((input, colIndex) => {
    input.addEventListener('input', () => autoFillSignatures(colIndex));
    input.addEventListener('blur', () => autoFillSignatures(colIndex));
  });

  startTimeInputs.forEach((input, colIndex) => {
    input.addEventListener('input', () => autoFillSignatures(colIndex));
    input.addEventListener('blur', () => autoFillSignatures(colIndex));
  });

  // window.print() 오버라이드
  const originalPrint = window.print;
  window.print = function () {
    if (validateAllColumnsForPrint()) {
      originalPrint();
    }
  };

  // 10. 기록 초기화 및 인쇄 버튼 제어 시스템
  const btnReset = document.getElementById('btn-reset');
  if (btnReset) {
    btnReset.addEventListener('click', function () {
      if (confirm('수급자 정보를 제외한 모든 서비스 제공 기록을 초기화하시겠습니까?')) {
        // 1. 년도를 제외한 모든 .data-input 초기화
        const dataInputs = document.querySelectorAll('.data-input');
        dataInputs.forEach(input => {
          if (!input.classList.contains('year-input')) {
            input.value = '';
            updateInputState(input);
          }
        });

        // 2. 모든 체크박스 초기화
        const chkBoxes = document.querySelectorAll('.chk-box');
        chkBoxes.forEach(chk => {
          chk.classList.remove('checked');
          chk.innerText = '□';
        });

        // 3. 모든 변화상태 번호 박스 초기화
        const numBoxes = document.querySelectorAll('.num-box');
        numBoxes.forEach(num => {
          num.classList.remove('checked');
        });

        // 4. 스타일 경고(빨간 배경/보더) 리셋
        totalTimeInputs.forEach(input => {
          if (input) {
            input.classList.remove('val-error-highlight');
          }
        });

        alert('일정관리 및 기록 내용이 성공적으로 초기화되었습니다.');

        // 초기화 완료 후 대시보드 상태 갱신
        if (typeof updateValidationDashboard === 'function') {
          updateValidationDashboard();
        }
      }
    });
  }

  const btnPrint = document.getElementById('btn-print');
  if (btnPrint) {
    btnPrint.addEventListener('click', function () {
      window.print();
    });
  }

  // 11. 수급자 및 요양보호사 데이터 관리 시스템 (localStorage 및 대시보드 연동)
  const recipientListContainer = document.getElementById('recipient-list-container');

  // 데이터 로드 (고정 파일 데이터 + 로컬 스토리지 병합)
  let recipients = [];

  async function loadRecipientsFromStorage() {
    try {
      let initialList = [];
      let fileTimestamp = 0;

      if (window.location.protocol.startsWith('http')) {
        try {
          const res = await fetch('/api/load-recipients');
          if (res.ok) {
            initialList = await res.json();
            fileTimestamp = Date.now();
          }
        } catch (e) {
          console.error('API 로드 실패:', e);
        }
      } else if (window.api && window.api.loadRecipients) {
        initialList = await window.api.loadRecipients();
        fileTimestamp = Date.now();
      }

      // 🛡️ [철통 보안 패치] 로컬 웹 브라우저(file://)이거나 API 로드가 실패한 경우 폴백 작동
      if (initialList.length === 0) {
        if (typeof INITIAL_RECIPIENTS !== 'undefined' && INITIAL_RECIPIENTS.length > 0) {
          initialList = [...INITIAL_RECIPIENTS];
        } else {
          // 캐시 복원 시도
          const cached = localStorage.getItem('rfid_recipients');
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                initialList = parsed;
              }
            } catch(e) {}
          }
        }
      }

      // 만약 캐시까지 비어있다면 화면이 굳지 않도록 내장 기본 데이터 주입
      if (initialList.length === 0) {
        initialList = [
          {
            "id": "1781105931732",
            "name": "김지상",
            "birth": "921223",
            "gender": "남",
            "grade": "4",
            "cert": "L1234567890",
            "caregiver": "김영환",
            "isDementia": false,
            "template": {
              "totalTime": "180",
              "startTime": "11:11",
              "endTime": "14:11",
              "serviceMinutes": ["60", "", "", "", "60", "60"],
              "checkboxes": [true, false, false, false, true, true, true, false],
              "subCheckboxes": [true, true, false, false, false, true, true, false, false, true, false, false, false],
              "subOtherTexts": ["", "", ""],
              "numBoxes": ["2", "2", "2"],
              "feces": "0",
              "urine": "0",
              "note": "테스트용 특이사항 메모입니다."
            }
          },
          {
            "id": "1781105931733",
            "name": "이영희",
            "birth": "450515",
            "gender": "여",
            "grade": "3",
            "cert": "L2345678901",
            "caregiver": "박정아",
            "isDementia": true,
            "template": {
              "totalTime": "120",
              "startTime": "09:00",
              "endTime": "11:00",
              "serviceMinutes": ["30", "60", "30", "", "", ""],
              "checkboxes": [true, true, true, true, false, false, false, false],
              "subCheckboxes": [false, false, true, true, false, false, false, false, false, false, false, false, false],
              "subOtherTexts": ["", "", ""],
              "numBoxes": ["1", "3", "1"],
              "feces": "1",
              "urine": "0",
              "note": "주 3회 인지활동 지원 프로그램 진행 대상자."
            }
          }
        ];
      }

      recipients = initialList;
      localStorage.setItem('rfid_recipients', JSON.stringify(recipients));
    } catch (e) {
      console.error('데이터 로드 중 오류 발생:', e);
      recipients = typeof INITIAL_RECIPIENTS !== 'undefined' ? [...INITIAL_RECIPIENTS] : [];
    }
  }

  // 초기 기동 데이터 로드
  loadRecipientsFromStorage().then(() => {
    // 항상 수급자 목록을 화면에 바로 렌더링
    if (recipientListContainer) {
      renderRecipientList();
    }
  });



  // 타 창(manage.html)에서 데이터 변경 시 실시간 브라우저 동기화 리스너
  window.addEventListener('storage', function (e) {
    if (e.key === 'rfid_recipients' || !e.key) {
      loadRecipientsFromStorage();
      renderRecipientList();
    }
  });

  // 수급자 성명 실시간 검색 이벤트 리스너 연동 (전역 검색 필터 - 요양보호사 검색 제외)
  const searchInput = document.getElementById('recipient-search');
  const btnSearchClear = document.getElementById('btn-search-clear');

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      const val = this.value.trim();
      if (btnSearchClear) {
        btnSearchClear.style.display = val.length > 0 ? 'inline-block' : 'none';
      }
      renderRecipientList();
    });
  }

  if (btnSearchClear && searchInput) {
    btnSearchClear.addEventListener('click', function () {
      searchInput.value = '';
      this.style.display = 'none';
      renderRecipientList();
      searchInput.focus();
    });
  }

  // 12. 수급자 정밀 관리 대시보드(manage.html) 팝업 호출 기능 연동
  const btnOpenManage = document.getElementById('btn-open-manage');
  if (btnOpenManage) {
    btnOpenManage.addEventListener('click', function () {
      // 듀얼모니터 및 편의를 위해 화면 정중앙 팝업 크기 계산
      const w = 1180;
      const h = 960;
      const left = (window.screen.width / 2) - (w / 2);
      const top = (window.screen.height / 2) - (h / 2);
      window.open('[관리자] 수급자 등록 및 변경하기.html', 'recipient_dashboard', `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`);
    });
  }

  // 목록 렌더링 (실시간 검색 필터 적용 - 수급자 성명 전용)
  function renderRecipientList() {
    if (!recipientListContainer) return;
    recipientListContainer.innerHTML = '';

    const searchInput = document.getElementById('recipient-search');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    // 한글 초성 검색 매칭 유틸리티
    function matchesChoSung(name, searchStr) {
      const HANGUL_START = 0xAC00;
      const CHO_SUNG = [
        'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
        'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
      ];

      let choSungName = '';
      for (let i = 0; i < name.length; i++) {
        const charCode = name.charCodeAt(i) - HANGUL_START;
        if (charCode >= 0 && charCode <= 11172) {
          choSungName += CHO_SUNG[Math.floor(charCode / 588)];
        } else {
          choSungName += name.charAt(i);
        }
      }

      // 검색어가 초성으로만 이루어졌는지 체크
      const isChoSungQuery = searchStr.split('').every(ch => CHO_SUNG.includes(ch));

      if (isChoSungQuery) {
        return choSungName.includes(searchStr);
      }
      return false;
    }

    // 수급자 성명으로만 필터링 적용 (요양보호사명은 제외)
    const filteredRecipients = recipients.filter(r => {
      if (!query) return true;
      const name = r.name.toLowerCase();
      return name.includes(query) || matchesChoSung(name, query);
    });

    if (filteredRecipients.length === 0) {
      recipientListContainer.innerHTML = `
        <div class="no-recipients">
          <span class="no-recipients-icon">🔍</span>
          일치하는 수급자가 없습니다.
        </div>
      `;
      return;
    }

    filteredRecipients.forEach(r => {
      const row = document.createElement('div');
      row.className = 'recipient-row';
      row.title = '💡 더블클릭하면 이 수급자의 표준 일정을 기록지에 즉시 적용합니다.';

      const familyCareBadge = (r.template && r.template.familyCare) ? `<span class="badge-dementia">가족</span>` : '';
      const genderBadge = `<span style="font-size: 11px; color: ${r.gender === '남' ? '#3b82f6' : '#ec4899'}; font-weight: bold; margin-left: 4px;">(${r.gender || '여'})</span>`;

      row.innerHTML = `
        <div class="row-info-wrap">
          <span class="row-name">${escapeHtml(r.name)}${genderBadge}</span>
          <span class="row-grade">${r.grade}등급</span>
          <span class="row-sep">·</span>
          <span class="row-birth">${escapeHtml(r.birth)}</span>
          <span class="row-sep">·</span>
          <span class="row-cert">${escapeHtml(r.cert)}</span>
        </div>
        ${familyCareBadge}
      `;

      // 더블클릭 시 즉시 기록지에 적용
      row.addEventListener('dblclick', () => applyRecipient(r));

      recipientListContainer.appendChild(row);
    });
  }

  // 수급자 정보 기록지에 적용
  function applyRecipient(recipient) {
    if (!recipient) return;

    // 1. 상단 정보 입력
    if (nameInput) {
      nameInput.value = recipient.name;
      updateInputState(nameInput);
    }
    if (birthInput) {
      birthInput.value = recipient.birth;
      updateInputState(birthInput);
    }
    if (gradeSelect) {
      gradeSelect.value = recipient.grade;
      // 등급 선택 change 이벤트 강제 트리거 (인쇄 연동 및 시간 자동계산)
      gradeSelect.dispatchEvent(new Event('change'));
    }
    if (certInput) {
      certInput.value = recipient.cert;
      updateInputState(certInput);
    }

    // 2. 담당 요양보호사 성명 듀얼 연동
    updateAllSignaturesCaregiver(recipient.caregiver);

    // 3. 기록지 전체 수급자 서명란 실시간 갱신 (이미 작성된 서명)
    for (let colIndex = 0; colIndex < 7; colIndex++) {
      const schedInput = scheduleDateInputs[colIndex];
      const startInput = startTimeInputs[colIndex];
      const recipientInput = recipientSignInputs[colIndex];

      if (!recipientInput) continue;

      const dateVal = schedInput ? schedInput.value.trim() : '';
      const startVal = startInput ? startInput.value.trim() : '';

      // 일정이 적혀 있는 열인 경우에만 수급자 서명 실시간 동기화
      if (dateVal !== '' || startVal !== '') {
        recipientInput.value = recipient.name;
        updateInputState(recipientInput);
      }
    }

    // [신규 기능] 4. 첫 번째 열(1일차)에 해당 수급자의 하루 표준 스케줄 적용 및 어제 날짜 자동 기입
    if (recipient.template) {
      const template = recipient.template;

      // 총시간 / 시작시간 / 종료시간 기입
      if (totalTimeInputs[0]) {
        totalTimeInputs[0].value = template.totalTime || '';
        updateInputState(totalTimeInputs[0]);
      }
      if (startTimeInputs[0]) {
        startTimeInputs[0].value = template.startTime || '';
        updateInputState(startTimeInputs[0]);
      }
      if (endTimeInputs[0]) {
        endTimeInputs[0].value = template.endTime || '';
        updateInputState(endTimeInputs[0]);
      }

      // 서비스 제공시간(분) 입력 필드 기입
      let minIdx = 0;
      const serviceInputs = document.querySelectorAll('.record-table .time-row input');
      serviceInputs.forEach(inp => {
        if (getColumnIndex(inp) === 0) {
          inp.value = template.serviceMinutes[minIdx++] || '';
          updateInputState(inp);
        }
      });

      // 일반 서비스 체크박스 상태 기입 (주/월/필요시 비정기 서비스인 경우 체크 안 되도록 필터링)
      let chkIdx = 0;
      const chkBoxes = document.querySelectorAll('.chk-box');
      chkBoxes.forEach(chk => {
        if (getColumnIndex(chk) === 0) {
          const isChecked = template.checkboxes[chkIdx];
          const isWeekly = template.weeklyCheckboxes?.[chkIdx];
          const isMonthly = template.monthlyCheckboxes?.[chkIdx];
          const isAsNeeded = template.asNeededCheckboxes?.[chkIdx];
          chkIdx++;
          if (isChecked && !isWeekly && !isMonthly && !isAsNeeded) {
            chk.classList.add('checked');
            chk.innerText = '☑';
          } else {
            chk.classList.remove('checked');
            chk.innerText = '□';
          }
        }
      });

      // 변화상태 라디오 상태 기입 (주/월/필요시 비정기 상태인 경우 체크 안 되도록 필터링)
      let numIdx = 0;
      const numGroups = document.querySelectorAll('.num-group');
      numGroups.forEach(group => {
        if (getColumnIndex(group) === 0) {
          const checkedVal = template.numBoxes[numIdx];
          const isWeekly = template.weeklyNumBoxes?.[numIdx];
          const isMonthly = template.monthlyNumBoxes?.[numIdx];
          const isAsNeeded = template.asNeededNumBoxes?.[numIdx];
          numIdx++;
          const boxes = group.querySelectorAll('.num-box');
          boxes.forEach(b => {
            if (checkedVal && b.getAttribute('data-val') === checkedVal && !isWeekly && !isMonthly && !isAsNeeded) {
              b.classList.add('checked');
            } else {
              b.classList.remove('checked');
            }
          });
        }
      });

      // 대소변 실수 횟수 기입
      const fecesInputs = document.querySelectorAll('.feces-input');
      const urineInputs = document.querySelectorAll('.urine-input');
      if (fecesInputs[0]) {
        fecesInputs[0].value = template.feces !== undefined && template.feces !== '' ? template.feces : '0';
        updateInputState(fecesInputs[0]);
      }
      if (urineInputs[0]) {
        urineInputs[0].value = template.urine !== undefined && template.urine !== '' ? template.urine : '0';
        updateInputState(urineInputs[0]);
      }

      // 비고란 (특이사항) 기입
      const noteRows = document.querySelectorAll('.note-row');
      if (noteRows[0]) {
        const noteInput = noteRows[0].querySelector('.data-input:not(.date-mask)');
        if (noteInput) {
          noteInput.value = template.note || '';
          updateInputState(noteInput);
        }
      }
    }

    // 1번째 일정 날짜에 "작성일(오늘) - 1일(어제)" 자동 계산하여 세팅
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const dd = String(yesterday.getDate()).padStart(2, '0');

    if (scheduleDateInputs[0]) {
      scheduleDateInputs[0].value = `${mm}/${dd}`;
      updateInputState(scheduleDateInputs[0]);
      // 1번째 일정 날짜 변경 시 특이사항 날짜 동적 연쇄 갱신 호출
      scheduleDateInputs[0].dispatchEvent(new Event('input'));
    }

    // 대소변 실수 횟수 인풋 참조
    const fecesInputs = document.querySelectorAll('.feces-input');
    const urineInputs = document.querySelectorAll('.urine-input');

    // 2~7번째 열은 깨끗하게 초기화 대기
    for (let col = 1; col < 7; col++) {
      if (scheduleDateInputs[col]) {
        scheduleDateInputs[col].value = '';
        updateInputState(scheduleDateInputs[col]);
        scheduleDateInputs[col].dispatchEvent(new Event('input'));
      }
      if (totalTimeInputs[col]) {
        totalTimeInputs[col].value = '';
        updateInputState(totalTimeInputs[col]);
      }
      if (startTimeInputs[col]) {
        startTimeInputs[col].value = '';
        updateInputState(startTimeInputs[col]);
      }
      if (endTimeInputs[col]) {
        endTimeInputs[col].value = '';
        updateInputState(endTimeInputs[col]);
      }

      const chkBoxes = document.querySelectorAll('.chk-box');
      chkBoxes.forEach(chk => {
        if (getColumnIndex(chk) === col) {
          chk.classList.remove('checked');
          chk.innerText = '□';
        }
      });

      const serviceInputs = document.querySelectorAll('.record-table .time-row input');
      serviceInputs.forEach(inp => {
        if (getColumnIndex(inp) === col) {
          inp.value = '';
          updateInputState(inp);
        }
      });

      const numGroups = document.querySelectorAll('.num-group');
      numGroups.forEach(group => {
        if (getColumnIndex(group) === col) {
          group.querySelectorAll('.num-box').forEach(b => b.classList.remove('checked'));
        }
      });

      if (fecesInputs[col]) {
        fecesInputs[col].value = '';
        updateInputState(fecesInputs[col]);
      }
      if (urineInputs[col]) {
        urineInputs[col].value = '';
        updateInputState(urineInputs[col]);
      }

      const noteRows = document.querySelectorAll('.note-row');
      if (noteRows[col]) {
        const noteInput = noteRows[col].querySelector('.data-input:not(.date-mask)');
        if (noteInput) {
          noteInput.value = '';
          updateInputState(noteInput);
        }
      }
    }



    // 적용 직후 전체 검증 상태 갱신
    if (typeof updateValidationDashboard === 'function') {
      updateValidationDashboard();
    }

    alert(`[${recipient.name} 수급자] 및 [${recipient.caregiver} 요양보호사] 정보가 기록지에 일괄 적용되었습니다.\n\n첫 번째 칸에 수급자 전용 어제 날짜(${mm}/${dd}) 및 기본 표준 일정이 자동 완성되었습니다.`);

    // 수급자 선택이 완료되면 자동으로 패널 닫아주기 (화면 가림 방지 UX 최적화)
    const controlPanelEl = document.getElementById('controlPanel');
    if (controlPanelEl) {
      setTimeout(() => {
        controlPanelEl.classList.remove('open');
      }, 800); // 0.8초 딜레이를 주어 알림창 확인 후 스무스하게 닫히도록 지원
    }
  }

  // 13. 키보드 화살표 키 격자 내비게이션 지원 (1번의 A 기능)
  function focusNearestElementInDirection(activeEl, direction) {
    if (!activeEl) return;

    // 테이블 외부 요소(예: 제어패널)면 미지원
    if (activeEl.closest('.control-panel')) return;

    const activeRect = activeEl.getBoundingClientRect();
    const activeX = activeRect.left + activeRect.width / 2;
    const activeY = activeRect.top + activeRect.height / 2;

    const recordTable = document.querySelector('.record-table');
    if (!recordTable) return;

    // 모든 입력 가능한 격자 요소 수집 (select 및 tabindex="0" 포함)
    const inputs = Array.from(recordTable.querySelectorAll('input, select, [tabindex="0"]')).filter(input => {
      const rect = input.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && !input.disabled && !input.readOnly && input !== activeEl;
    });

    let candidates = [];

    if (direction === 'up') {
      candidates = inputs.filter(input => {
        const rect = input.getBoundingClientRect();
        const y = rect.top + rect.height / 2;
        return y < activeY - 5;
      });
      candidates.sort((a, b) => {
        const rectA = a.getBoundingClientRect();
        const rectB = b.getBoundingClientRect();
        const yA = rectA.top + rectA.height / 2;
        const yB = rectB.top + rectB.height / 2;

        if (Math.abs(yA - yB) > 15) {
          return yB - yA; // 가장 가까운 위쪽 행 우선
        }
        const xA = rectA.left + rectA.width / 2;
        const xB = rectB.left + rectB.width / 2;
        return Math.abs(xA - activeX) - Math.abs(xB - activeX);
      });
    } else if (direction === 'down') {
      candidates = inputs.filter(input => {
        const rect = input.getBoundingClientRect();
        const y = rect.top + rect.height / 2;
        return y > activeY + 5;
      });
      candidates.sort((a, b) => {
        const rectA = a.getBoundingClientRect();
        const rectB = b.getBoundingClientRect();
        const yA = rectA.top + rectA.height / 2;
        const yB = rectB.top + rectB.height / 2;

        if (Math.abs(yA - yB) > 15) {
          return yA - yB; // 가장 가까운 아래쪽 행 우선
        }
        const xA = rectA.left + rectA.width / 2;
        const xB = rectB.left + rectB.width / 2;
        return Math.abs(xA - activeX) - Math.abs(xB - activeX);
      });
    } else if (direction === 'left') {
      candidates = inputs.filter(input => {
        const rect = input.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        return x < activeX - 5 && Math.abs(y - activeY) < 18;
      });
      candidates.sort((a, b) => {
        const rectA = a.getBoundingClientRect();
        const rectB = b.getBoundingClientRect();
        const xA = rectA.left + rectA.width / 2;
        const xB = rectB.left + rectB.width / 2;
        return xB - xA; // 가장 가까운 왼쪽 우선
      });
    } else if (direction === 'right') {
      candidates = inputs.filter(input => {
        const rect = input.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        return x > activeX + 5 && Math.abs(y - activeY) < 18;
      });
      candidates.sort((a, b) => {
        const rectA = a.getBoundingClientRect();
        const rectB = b.getBoundingClientRect();
        const xA = rectA.left + rectA.width / 2;
        const xB = rectB.left + rectB.width / 2;
        return xA - xB; // 가장 가까운 오른쪽 우선
      });
    }

    const targetInput = candidates[0];
    if (targetInput) {
      targetInput.focus();
      if (typeof targetInput.select === 'function') {
        targetInput.select();
      }
    }
  }

  document.addEventListener('keydown', function (e) {

    const activeEl = document.activeElement;
    if (!activeEl) return;

    if (activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'SELECT' && activeEl.getAttribute('tabindex') !== '0') return;
    if (activeEl.closest('.control-panel')) return;

    const isTextInput = activeEl.tagName === 'INPUT' && (activeEl.type === 'text' || activeEl.type === '');

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusNearestElementInDirection(activeEl, 'up');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusNearestElementInDirection(activeEl, 'down');
    } else if (e.key === 'ArrowLeft') {
      if (isTextInput && activeEl.selectionStart !== null && activeEl.selectionStart > 0) {
        return;
      }
      e.preventDefault();
      focusNearestElementInDirection(activeEl, 'left');
    } else if (e.key === 'ArrowRight') {
      if (isTextInput && activeEl.selectionStart !== null && activeEl.selectionStart < activeEl.value.length) {
        return;
      }
      e.preventDefault();
      focusNearestElementInDirection(activeEl, 'right');
    }
  });



  // 2~7번째 일정 날짜(date-mask) 입력 시, 1번째 열에 설정된 템플릿 표준 일정을 쫘르륵 복사하여 자동 완성시키는 스마트 연쇄 연동
  scheduleDateInputs.forEach((dateInput, colIndex) => {
    if (colIndex > 0) { // 2번째부터 7번째 열에 대해서만 감지
      dateInput.addEventListener('input', function () {
        const val = this.value.trim();
        // 날짜가 1글자라도 작성되기 시작하면 1번째 열(colIndex=0)의 기입 내용을 즉시 그대로 복사
        if (val.length > 0) {
          // 1) 시작/종료/총시간 복사
          if (totalTimeInputs[colIndex] && totalTimeInputs[0]) {
            totalTimeInputs[colIndex].value = totalTimeInputs[0].value;
            updateInputState(totalTimeInputs[colIndex]);
          }
          if (startTimeInputs[colIndex] && startTimeInputs[0]) {
            startTimeInputs[colIndex].value = startTimeInputs[0].value;
            updateInputState(startTimeInputs[colIndex]);
          }
          if (endTimeInputs[colIndex] && endTimeInputs[0]) {
            endTimeInputs[colIndex].value = endTimeInputs[0].value;
            updateInputState(endTimeInputs[colIndex]);
          }

          // 2) 서비스 제공시간(분) 복사
          const serviceInputs = document.querySelectorAll('.record-table .time-row input');
          const colZeroMinutes = [];
          serviceInputs.forEach(inp => {
            if (getColumnIndex(inp) === 0) {
              colZeroMinutes.push(inp.value.trim());
            }
          });

          let minIdx = 0;
          serviceInputs.forEach(inp => {
            if (getColumnIndex(inp) === colIndex) {
              inp.value = colZeroMinutes[minIdx++] || '';
              updateInputState(inp);
            }
          });

          // 3) 일반 서비스 체크박스 상태 복사
          const chkBoxes = document.querySelectorAll('.chk-box');
          const colZeroChecks = [];
          chkBoxes.forEach(chk => {
            if (getColumnIndex(chk) === 0) {
              colZeroChecks.push(chk.classList.contains('checked'));
            }
          });

          let chkIdx = 0;
          chkBoxes.forEach(chk => {
            if (getColumnIndex(chk) === colIndex) {
              const isChecked = colZeroChecks[chkIdx++];
              if (isChecked) {
                chk.classList.add('checked');
                chk.innerText = '☑';
              } else {
                chk.classList.remove('checked');
                chk.innerText = '□';
              }
            }
          });

          // 4) 변화상태 라디오 상태 복사
          const numGroups = document.querySelectorAll('.num-group');
          const colZeroNums = [];
          numGroups.forEach(group => {
            if (getColumnIndex(group) === 0) {
              const checkedBox = group.querySelector('.num-box.checked');
              colZeroNums.push(checkedBox ? checkedBox.getAttribute('data-val') : null);
            }
          });

          let numIdx = 0;
          numGroups.forEach(group => {
            if (getColumnIndex(group) === colIndex) {
              const checkedVal = colZeroNums[numIdx++];
              group.querySelectorAll('.num-box').forEach(b => {
                if (checkedVal && b.getAttribute('data-val') === checkedVal) {
                  b.classList.add('checked');
                } else {
                  b.classList.remove('checked');
                }
              });
            }
          });

          // 5) 비고란 (특이사항) 텍스트 복사
          const noteRows = document.querySelectorAll('.note-row');
          let colZeroNote = '';
          if (noteRows[0]) {
            const noteInput = noteRows[0].querySelector('.data-input:not(.date-mask)');
            if (noteInput) colZeroNote = noteInput.value.trim();
          }
          if (noteRows[colIndex]) {
            const noteInput = noteRows[colIndex].querySelector('.data-input:not(.date-mask)');
            if (noteInput && noteInput.value.trim() === '') { // 비고란이 아직 비어있을 때만 복사하여 기입
              noteInput.value = colZeroNote;
              updateInputState(noteInput);
            }
          }

          // 동기화 완료 직후 실시간 알림 대시보드 갱신
          if (typeof updateValidationDashboard === 'function') {
            updateValidationDashboard();
          }
        }
      });
    }
  });

  // 15. 반응형 슬라이딩 드로어(control-panel) 온오프 제어 연동
  const toggleBtn = document.getElementById('controlPanelToggle');

  if (toggleBtn && controlPanel) {
    toggleBtn.addEventListener('click', function () {
      controlPanel.classList.toggle('open');
    });
  }

  // 모바일이 아닌 경우(데스크톱 너비 > 1024px) 초기 로드 시 자동으로 패널 열어두기
  if (controlPanel && window.innerWidth > 1024) {
    controlPanel.classList.add('open');
  }



  // HTML 이스케이프 헬퍼
  function escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function (m) { return map[m]; });
  }
});


