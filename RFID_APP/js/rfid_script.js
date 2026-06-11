// ── [주간서비스 개별 체크박스 연동 기능] ──
const originalCheckedDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
Object.defineProperty(HTMLInputElement.prototype, 'checked', {
    get: function () {
        return originalCheckedDescriptor.get.call(this);
    },
    set: function (val) {
        originalCheckedDescriptor.set.call(this, val);

        if (this.classList.contains('custom-cb-input') && this.id !== 'weeklyServiceCb') {
            // 배변변화 등 주간서비스 제외 대상 카드는 제외
            if (this.closest('[data-no-weekly]')) return;

            // 상위/그룹 체크박스는 주간(빨간색) 체크박스 대상에서 제외
            const parentIds = ['chk-hygiene', 'chk-toilet', 'chk-housework'];
            if (parentIds.includes(this.id)) return;

            const weeklyCb = document.getElementById('weeklyServiceCb');
            if (val) {
                if (weeklyCb && weeklyCb.checked) {
                    this.classList.add('weekly-checked');
                }
            } else {
                this.classList.remove('weekly-checked');
            }
        }
    },
    configurable: true,
    enumerable: true
});

function updateAppParentWeeklyStatus(parentId) {
    const parentEl = document.getElementById(parentId);
    if (!parentEl) return;
    
    const subGrid = document.querySelector(`[data-parent-cb="${parentId}"]`);
    if (!subGrid) return;
    
    const checkedChildren = Array.from(subGrid.querySelectorAll('input[type="checkbox"]'))
        .filter(cb => cb.checked);
        
    if (checkedChildren.length > 0) {
        const allWeekly = checkedChildren.every(cb => cb.classList.contains('weekly-checked'));
        if (allWeekly) {
            parentEl.classList.add('weekly-checked');
        } else {
            parentEl.classList.remove('weekly-checked');
        }
    } else {
        parentEl.classList.remove('weekly-checked');
    }
}

document.addEventListener('change', function (e) {
    if (e.target && e.target.classList.contains('custom-cb-input') && e.target.id !== 'weeklyServiceCb') {
        // 배변변화 등 주간서비스 제외 대상 카드는 제외
        if (e.target.closest('[data-no-weekly]')) return;

        // 상위/그룹 체크박스는 주간(빨간색) 체크박스 대상에서 제외
        const parentIds = ['chk-hygiene', 'chk-toilet', 'chk-housework'];
        if (parentIds.includes(e.target.id)) return;

        const weeklyCb = document.getElementById('weeklyServiceCb');
        if (e.target.checked) {
            if (weeklyCb && weeklyCb.checked) {
                e.target.classList.add('weekly-checked');
            }
        } else {
            e.target.classList.remove('weekly-checked');
        }

        // 하위 항목 변경 시 대분류(부모)의 주간 상태 동적 갱신
        const parentGrid = e.target.closest('[data-parent-cb]');
        if (parentGrid) {
            const parentId = parentGrid.getAttribute('data-parent-cb');
            updateAppParentWeeklyStatus(parentId);
        }
    }
});

// ── 0. 성별 전환 (아바타 + 버튼 토글)
let currentGender = 'female';

function toggleGender() {
    currentGender = (currentGender === 'female') ? 'male' : 'female';
    const btn = document.getElementById('genderToggle');
    const avatar = document.getElementById('userAvatar');

    if (currentGender === 'female') {
        btn.textContent = '여성';
        btn.classList.remove('male');
        btn.classList.add('female');
        avatar.textContent = '👩🏻';
    } else {
        btn.textContent = '남성';
        btn.classList.remove('female');
        btn.classList.add('male');
        avatar.textContent = '👨🏻';
    }
}

// ── 카드 비활성화 시 해당 영역 시간 입력값 + 체크박스 초기화
function resetAreaInputs(area) {
    area.querySelectorAll('.time-input-num').forEach(function (input) {
        input.value = '0';
        input.classList.remove('time-entered');
    });
    area.querySelectorAll('.counter-input').forEach(function (input) {
        input.value = '0';
    });
    area.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
        cb.checked = false;
    });
    updateRemaining();
}

// ── 시간 계산 함수 (전역)
function calcTotalTime() {
    const startEl = document.getElementById('startTime');
    const endEl = document.getElementById('endTime');
    const totalEl = document.getElementById('totalMin');
    if (!startEl || !endEl || !totalEl) return;
    const toSec = function (t) { var p = t.split(':').map(Number); return p[0] * 3600 + (p[1] || 0) * 60 + (p[2] || 0); };
    var startSec = toSec(startEl.value || '00:00:00');
    var endSec = toSec(endEl.value || '00:00:00');
    // 종료시간이 시작시간보다 이르면 자정을 넘긴 것으로 처리 (+24h)
    var isNextDay = endSec < startSec;
    if (isNextDay) endSec += 86400;
    var diffMin = Math.max(0, Math.round((endSec - startSec) / 60));
    totalEl.textContent = diffMin;
    updateEndDateSpan(isNextDay); // 종료 날짜 익일 여부 반영
    updateRemaining(); // 제공시간 차감
}

// ── 제공 시간 합산 → 잔여 시간 갱신 (전역)
function updateRemaining() {
    const totalEl = document.getElementById('totalMin');
    const remainEl = document.getElementById('remainMin');
    if (!totalEl || !remainEl) return;
    const totalMin = parseInt(totalEl.textContent) || 0;
    let usedMin = 0;
    // '제공 시간' span을 직접 자식으로 가진 항목만 합산 (하위 시간은 이미 부모에 포함됨)
    document.querySelectorAll('.time-input-row').forEach(function (row) {
        const firstChild = row.querySelector(':scope > span');
        if (firstChild && firstChild.textContent.trim() === '제공 시간') {
            const input = row.querySelector('.time-input-num');
            if (input) usedMin += parseInt(input.value) || 0;
        }
    });
    remainEl.textContent = Math.max(0, totalMin - usedMin);
    // 제공 시간 초과 시 경고 팝업
    if (usedMin > totalMin) showExceedModal(totalMin, usedMin);
}

function showExceedModal(total, used) {
    var el = document.getElementById('exceedMsg');
    if (el) el.innerHTML =
        '서비스 총 제공시간(분) [<b>' + total + '</b>]보다 <br>서비스 등록시간(분) [<b>' + used + '</b>]이 더 큽니다';
    document.getElementById('exceedOverlay').classList.add('open');
    document.getElementById('exceedPanel').classList.add('open');
}

function closeExceedModal() {
    document.getElementById('exceedOverlay').classList.remove('open');
    const panel = document.getElementById('exceedPanel');
    if (panel) {
        panel.classList.remove('open');
        panel.style.width = '';     // 인라인 스타일 청소
        panel.style.maxWidth = '';  // 인라인 스타일 청소
    }
}

// ── 취소 버튼: 모든 입력값 초기화
function cancelForm() {
    // 이름 초기화
    document.getElementById('userName').value = '';

    // 시간 입력 초기화
    document.querySelectorAll('.time-input-num').forEach(function (input) {
        input.value = '0';
        input.classList.remove('time-entered');
    });

    // 카운터 초기화
    document.querySelectorAll('.counter-input').forEach(function (input) {
        input.value = '0';
    });

    // 체크박스 전체 해제 및 주간서비스 모드 해제
    document.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
        cb.checked = false;
    });
    document.body.classList.remove('weekly-mode');

    // 라디오 버튼: 각 그룹에서 "유지" (index 1) 복원
    ['p1', 'm1', 'c1'].forEach(function (name) {
        var radios = document.querySelectorAll('input[type="radio"][name="' + name + '"]');
        if (radios.length >= 2) radios[1].checked = true;
    });

    // 텍스트 입력(기타사항) 초기화
    document.querySelectorAll('.text-input').forEach(function (input) {
        input.value = '';
    });

    // 특이사항 textarea 초기화
    var noteTA = document.getElementById('specialNote');
    if (noteTA) {
        noteTA.value = '';
        noteTA.style.height = '105px';
        noteTA.style.overflowY = 'hidden';
        var charCountEl = document.getElementById('charCount');
        if (charCountEl) charCountEl.textContent = '0/200';
    }

    // 비활성화된 카드 오버레이 해제 (카드 활성 상태로 복원)
    document.querySelectorAll('.card-overlay.active').forEach(function (overlay) {
        overlay.classList.remove('active');
    });
    document.querySelectorAll('.card-toggle-btn.off').forEach(function (btn) {
        btn.classList.remove('off');
    });

    // 성별 여성으로 초기화
    var gBtn = document.getElementById('genderToggle');
    var gAvatar = document.getElementById('userAvatar');
    currentGender = 'female';
    gBtn.textContent = '여성';
    gBtn.classList.remove('male');
    gBtn.classList.add('female');
    gAvatar.textContent = '👩🏻';

    // 등급 4등급으로 초기화
    document.getElementById('gradeSelect').value = '4';

    // 시작/종료 시간 기본값으로 초기화 (hidden input + 버튼 텍스트)
    var startTimeEl = document.getElementById('startTime');
    var endTimeEl = document.getElementById('endTime');
    var startTimeBtn = document.getElementById('startTimeBtn');
    var endTimeBtn = document.getElementById('endTimeBtn');
    if (startTimeEl && startTimeBtn) { startTimeEl.value = '09:00:00'; startTimeBtn.textContent = '09:00:00'; }
    if (endTimeEl && endTimeBtn) { endTimeEl.value = '12:00:00'; endTimeBtn.textContent = '12:00:00'; }

    // 날짜 span도 오늘 날짜로 복원 (익일 표시 해제)
    updateEndDateSpan(false);

    calcTotalTime();
    updateRemaining();
}

// ── 종료 날짜 span 갱신: 익일 여부에 따라 오늘/내일 날짜 표시
function updateEndDateSpan(isNextDay) {
    var el = document.getElementById('endDateSpan');
    if (!el) return;
    if (isNextDay) {
        var d = new Date();
        d.setDate(d.getDate() + 1);
        el.textContent = d.getFullYear() + '-'
            + String(d.getMonth() + 1).padStart(2, '0') + '-'
            + String(d.getDate()).padStart(2, '0');
    } else {
        el.textContent = getTodayStr();
    }
}

function autoSetEndTime() {
    const startEl = document.getElementById('startTime');
    const endEl = document.getElementById('endTime');
    const grade = parseInt(document.getElementById('gradeSelect').value) || 4;
    if (!startEl || !endEl || !startEl.value) return;
    const addSec = (grade <= 2) ? 4 * 3600 : 3 * 3600;
    const p = startEl.value.split(':').map(Number);
    const totalEndSec = p[0] * 3600 + (p[1] || 0) * 60 + (p[2] || 0) + addSec;
    const pad = n => String(n).padStart(2, '0');
    // 24h를 넘으면 % 24로 시간만 표시, 날짜는 익일로
    const timeStr = `${pad(Math.floor(totalEndSec / 3600) % 24)}:${pad(Math.floor((totalEndSec % 3600) / 60))}:${pad(totalEndSec % 60)}`;
    endEl.value = timeStr;
    const endBtn = document.getElementById('endTimeBtn');
    if (endBtn) endBtn.textContent = timeStr;
    calcTotalTime(); // 내부에서 isNextDay 판단 후 날짜 span 자동 갱신
}

// ── 인라인 시간 피커 (tip)
var _tipCurrent = null; // 'start' | 'end' | null

function toggleTip(target) {
    var popup = document.getElementById(target + 'TipPopup');
    var isOpen = popup.classList.contains('open');

    // 다른 쪽 팝업 닫기
    ['start', 'end'].forEach(function (t) {
        document.getElementById(t + 'TipPopup').classList.remove('open');
    });

    if (!isOpen) {
        var val = document.getElementById(target + 'Time').value || '00:00:00';
        var parts = val.split(':').map(Number);
        var pad = function (n) { return String(n).padStart(2, '0'); };
        if (target === 'start') {
            document.getElementById('tipSH').value = pad(parts[0] || 0);
            document.getElementById('tipSM').value = pad(parts[1] || 0);
            document.getElementById('tipSS').value = pad(parts[2] || 0);
            setTimeout(function () { document.getElementById('tipSH').select(); }, 30);
        } else {
            document.getElementById('tipEH').value = pad(parts[0] || 0);
            document.getElementById('tipEM').value = pad(parts[1] || 0);
            document.getElementById('tipES').value = pad(parts[2] || 0);
            setTimeout(function () { document.getElementById('tipEH').select(); }, 30);
        }
        popup.classList.add('open');
        _tipCurrent = target;
    } else {
        _tipCurrent = null;
    }
}

function confirmTip(target) {
    var clamp = function (id, max) {
        return Math.max(0, Math.min(max, parseInt(document.getElementById(id).value) || 0));
    };
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var h, m, s;
    if (target === 'start') {
        h = clamp('tipSH', 23); m = clamp('tipSM', 59); s = clamp('tipSS', 59);
    } else {
        h = clamp('tipEH', 23); m = clamp('tipEM', 59); s = clamp('tipES', 59);
    }
    var timeStr = pad(h) + ':' + pad(m) + ':' + pad(s);
    document.getElementById(target + 'Time').value = timeStr;
    document.getElementById(target + 'TimeBtn').textContent = timeStr;
    document.getElementById(target + 'TipPopup').classList.remove('open');
    _tipCurrent = null;
    if (target === 'start') { autoSetEndTime(); } else { calcTotalTime(); }
}


// ── 날짜 문자열 반환 헬퍼 (전역)
function getTodayStr() {
    var d = new Date();
    return d.getFullYear() + '-'
        + String(d.getMonth() + 1).padStart(2, '0') + '-'
        + String(d.getDate()).padStart(2, '0');
}

// ── 날짜 표시 갱신 + 시작/종료 시간 기본값 리셋 + 총시간 재계산 (전역)
var _currentDateStr = '';
function refreshDateDisplay() {
    var today = getTodayStr();
    if (_currentDateStr === today) return; // 날짜 변경 없으면 패스
    _currentDateStr = today;

    // 날짜 span 갱신
    document.querySelectorAll('.today-date').forEach(function (el) {
        el.textContent = today;
    });

    // 시작/종료 시간 기본값 리셋 (익일이 되면 초기값으로 복원)
    var startEl = document.getElementById('startTime');
    var endEl = document.getElementById('endTime');
    var startBtn = document.getElementById('startTimeBtn');
    var endBtn = document.getElementById('endTimeBtn');
    if (startEl && startBtn) {
        startEl.value = '09:00:00';
        startBtn.textContent = '09:00:00';
    }
    if (endEl && endBtn) {
        endEl.value = '12:00:00';
        endBtn.textContent = '12:00:00';
    }

    calcTotalTime(); // 총시간 재계산
}

document.addEventListener('DOMContentLoaded', function () {

    // ── 최초 날짜 표시 + 이후 30초마다 자정 넘어가면 자동 갱신
    refreshDateDisplay();
    setInterval(refreshDateDisplay, 30000);

    // ── 주간서비스 모드 토글
    const weeklyCb = document.getElementById('weeklyServiceCb');
    if (weeklyCb) {
        weeklyCb.addEventListener('change', function () {
            if (this.checked) {
                document.body.classList.add('weekly-mode');
            } else {
                document.body.classList.remove('weekly-mode');
            }
        });
    }

    // 등급 변경 시 종료시간 재계산
    document.getElementById('gradeSelect').addEventListener('change', function () {
        if (document.getElementById('startTime').value) autoSetEndTime();
    });
    calcTotalTime(); // 초기 계산

    // 팝업 외부 클릭 시 닫기
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.tip-wrap')) {
            ['start', 'end'].forEach(function (t) {
                document.getElementById(t + 'TipPopup').classList.remove('open');
            });
            _tipCurrent = null;
        }
    });

    // Enter → 확인 / Escape → 닫기
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && _tipCurrent) {
            e.preventDefault();
            confirmTip(_tipCurrent);
        }
        if (e.key === 'Escape' && _tipCurrent) {
            ['start', 'end'].forEach(function (t) {
                document.getElementById(t + 'TipPopup').classList.remove('open');
            });
            _tipCurrent = null;
        }
    });


    document.querySelectorAll('.category-card').forEach(function (card, index) {
        // 토글 제외 카드 건너맜기
        if (card.hasAttribute('data-no-toggle')) return;

        if (index === 0) {
            // ─ 첫 번째 카드: "신체활동 지원" sub-title 옆 버튼
            //   sub-title + 이후 노드만 card-body로 감싸서 부분 오버레이
            const subTitle = card.querySelector('.sub-title');
            if (!subTitle) return;

            // sub-title flex 처리 + 인라인 버튼
            subTitle.style.display = 'flex';
            subTitle.style.justifyContent = 'space-between';
            subTitle.style.alignItems = 'center';

            const btn = document.createElement('button');
            btn.className = 'card-toggle-btn card-toggle-inline';
            btn.title = '신체활동 지원 비활성화';
            subTitle.appendChild(btn);

            // sub-title을 포함한 이후 노드들을 card-body로 래핑
            const body = document.createElement('div');
            body.className = 'card-body';
            const siblings = [];
            let node = subTitle.nextSibling;
            while (node) { siblings.push(node); node = node.nextSibling; }

            // card에 body 삽입 (subTitle 바로 전에) → subTitle도 body 안으로
            card.insertBefore(body, subTitle);
            body.appendChild(subTitle);
            siblings.forEach(s => body.appendChild(s));

            const overlay = document.createElement('div');
            overlay.className = 'card-overlay';
            body.appendChild(overlay);

            btn.addEventListener('click', function () {
                const isOff = overlay.classList.toggle('active');
                btn.classList.toggle('off', isOff);
                if (isOff) resetAreaInputs(body);
            });

        } else {
            // ─ 나머지 카드: 카드 우측 상단 버튼 + 전체 카드 오버레이
            const overlay = document.createElement('div');
            overlay.className = 'card-overlay';
            card.appendChild(overlay);

            const btn = document.createElement('button');
            btn.className = 'card-toggle-btn card-toggle-abs';
            btn.title = '이 카드 비활성화';
            card.appendChild(btn);

            btn.addEventListener('click', function () {
                const isOff = overlay.classList.toggle('active');
                btn.classList.toggle('off', isOff);
                if (isOff) resetAreaInputs(card);
            });
        }
    });



    // ── 특이사항 textarea 자동 높이 조절 (최소 높이를 크게 확보하여 대형 플레이스홀더 수용) + 200자 제한 및 글자 수 표기
    var noteTA = document.getElementById('specialNote');
    if (noteTA) {
        var LINE_H = 24;  // px per line (font-size 14px 입력 텍스트 기준)
        var MIN_H = 105;  // 18px 대형 플레이스홀더 텍스트가 완벽히 드러나는 최소 높이
        var MAX_H = LINE_H * 7 + 20;
        noteTA.style.minHeight = MIN_H + 'px';
        noteTA.style.maxHeight = MAX_H + 'px';
        noteTA.style.height = MIN_H + 'px';
        noteTA.style.overflowY = 'hidden';

        noteTA.addEventListener('input', function () {
            // 200자 초과 방지 및 글자 수 표시 갱신
            var text = this.value;
            if (text.length > 200) {
                text = text.substring(0, 200);
                this.value = text;
            }
            var charCountEl = document.getElementById('charCount');
            if (charCountEl) charCountEl.textContent = text.length + '/200';

            // 글씨를 다 지운 공백 상태일 때 높이와 스크롤 상태 즉시 강제 원복 (플레이스홀더 완벽 재노출 보장)
            if (text.trim() === '') {
                this.style.height = MIN_H + 'px';
                this.style.overflowY = 'hidden';
                return;
            }
            this.style.height = MIN_H + 'px';
            var sh = Math.max(MIN_H, Math.min(this.scrollHeight, MAX_H));
            this.style.height = sh + 'px';
            this.style.overflowY = sh >= MAX_H ? 'auto' : 'hidden';
        });

        noteTA.addEventListener('blur', function () {
            // 포커스 아웃 시에도 비어있으면 완벽 리셋
            if (this.value.trim() === '') {
                this.style.height = MIN_H + 'px';
                this.style.overflowY = 'hidden';
                var charCountEl = document.getElementById('charCount');
                if (charCountEl) charCountEl.textContent = '0/200';
            }
        });
    }

    // ── 1. 배변 횟수 카운터: 버튼 + 키보드 입력 모두 가능
    document.querySelectorAll('.counter-row').forEach(function (row) {
        const minusBtn = row.querySelector('.btn-circle:first-child');
        const plusBtn = row.querySelector('.btn-circle:last-child');
        const input = row.querySelector('.counter-input');
        const checkbox = row.querySelector('input[type="checkbox"]');

        if (minusBtn && plusBtn && input) {
            minusBtn.style.cursor = 'pointer';
            plusBtn.style.cursor = 'pointer';

            function applyCounter(val) {
                val = Math.max(0, val);
                input.value = val;
                if (checkbox) checkbox.checked = val > 0;
            }

            plusBtn.addEventListener('click', function () { applyCounter(parseInt(input.value || 0) + 1); });
            minusBtn.addEventListener('click', function () { applyCounter(parseInt(input.value || 0) - 1); });

            // 체크박스 해제 → 값 0 초기화
            if (checkbox) {
                checkbox.addEventListener('change', function () {
                    if (!this.checked) applyCounter(0);
                });
            }

            // 키보드 입력: 숫자만 허용 + 위아래 키 증감
            input.removeAttribute('readonly');
            input.addEventListener('keydown', function (e) {
                if (e.key === 'ArrowUp') { e.preventDefault(); applyCounter(parseInt(this.value || 0) + 1); return; }
                if (e.key === 'ArrowDown') { e.preventDefault(); applyCounter(parseInt(this.value || 0) - 1); return; }
                const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
                if (allowed.includes(e.key)) return;
                if (e.key >= '0' && e.key <= '9') return;
                e.preventDefault();
            });
            input.addEventListener('input', function () {
                let val = this.value.replace(/[^0-9]/g, '');
                if (val === '') val = '0';
                applyCounter(parseInt(val));
            });
            input.addEventListener('blur', function () {
                if (this.value === '' || isNaN(parseInt(this.value))) applyCounter(0);
            });
            input.addEventListener('focus', function () { this.select(); });
        }
    });

    // ── 2. 시간 입력 필드: 숫자만 허용, 음수 방지, 위아래키 증감, 볼드토글, 잡여갱신
    document.querySelectorAll('.time-input-num').forEach(function (input) {

        input.addEventListener('keydown', function (e) {
            if (this.readOnly) return; // 직접 수정 방어
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.value = Math.max(0, (parseInt(this.value) || 0) + 1);
                this.classList.toggle('time-entered', parseInt(this.value) > 0);
                updateRemaining();
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.value = Math.max(0, (parseInt(this.value) || 0) - 1);
                this.classList.toggle('time-entered', parseInt(this.value) > 0);
                updateRemaining();
                return;
            }
            const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
            if (allowed.includes(e.key)) return;
            if (e.key >= '0' && e.key <= '9') return;
            e.preventDefault();
        });

        input.addEventListener('input', function () {
            if (this.readOnly) return; // 직접 수정 방어
            let val = this.value.replace(/[^0-9]/g, '');
            if (val === '') val = '0';
            this.value = val;
            // 입력값 > 0 이면 볼드체 ON
            this.classList.toggle('time-entered', parseInt(val) > 0);
            updateRemaining();
        });

        input.addEventListener('blur', function () {
            if (this.readOnly) return; // 직접 수정 방어
            if (this.value === '' || isNaN(parseInt(this.value))) {
                this.value = '0';
            }
            this.classList.toggle('time-entered', parseInt(this.value) > 0);
            updateRemaining();
        });

        input.addEventListener('focus', function () {
            if (this.readOnly) return; // 직접 수정 방어
            this.select();
        });
    });

    // ── 3. Type A: 하위 체크박스 체크 → 상위 체크박스 자동 연동
    //    (개인위생, 화장실이용하기, 식사준비... )
    document.querySelectorAll('[data-parent-cb]').forEach(function (grid) {
        const parentId = grid.getAttribute('data-parent-cb');
        const parentCb = document.getElementById(parentId);
        if (!parentCb) return;

        const childCbs = Array.from(grid.querySelectorAll('input[type="checkbox"]'));

        // 하위 체크 변경 시 상위 자동 반영
        childCbs.forEach(function (cb) {
            cb.addEventListener('change', function () {
                parentCb.checked = childCbs.some(c => c.checked);
            });
        });

        // 상위 체크 해제 시 하위 전체 해제
        parentCb.addEventListener('change', function () {
            if (!parentCb.checked) {
                childCbs.forEach(c => { c.checked = false; });
            }
        });
    });

    // ── 4. Type B: 하위 시간 입력 → 상위 시간 합산 자동 연동
    //    (인지활동 지원, 인지관리 지원, 정서지원)
    document.querySelectorAll('[data-time-group]').forEach(function (card) {
        const allTimeRows = Array.from(card.querySelectorAll('.time-input-row'));
        if (allTimeRows.length < 2) return;

        // 첫 번째 row = 제공 시간 (상위)
        const parentTimeInput = allTimeRows[0].querySelector('.time-input-num');
        if (!parentTimeInput) return;

        // 나머지 rows = 하위 항목 (체크박스 + 시간)
        const subRows = allTimeRows.slice(1);

        function syncParentTime() {
            let total = 0;
            subRows.forEach(function (row) {
                const subTime = row.querySelector('.time-input-num');
                const subCb = row.querySelector('input[type="checkbox"]');
                const val = parseInt(subTime ? subTime.value : '0') || 0;

                // 하위 시간 > 0 이면 해당 항목 체크박스 자동 체크
                if (subCb) subCb.checked = val > 0 ? true : subCb.checked;
                // 서브 입력값 볼드 토글
                if (subTime) subTime.classList.toggle('time-entered', val > 0);
                total += val;
            });
            parentTimeInput.value = total;
            // 부모 시간 볼드 토글 후 잡여 업데이트
            parentTimeInput.classList.toggle('time-entered', total > 0);
            updateRemaining();
        }

        subRows.forEach(function (row) {
            const subTime = row.querySelector('.time-input-num');
            if (subTime) {
                subTime.addEventListener('input', syncParentTime);
                subTime.addEventListener('blur', syncParentTime);
            }
        });
    });

    // ── 6. 기타사항 입력 필드 (.text-input) 보이는 영역까지만 입력 제한
    document.querySelectorAll('.text-input').forEach(function (inputEl) {
        const computedStyle = window.getComputedStyle(inputEl);
        const font = `${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`;

        // 텍스트 너비 측정을 위한 임시 캔버스 컨텍스트 생성
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        context.font = font;

        inputEl.addEventListener('input', function () {
            const paddingLeft = parseFloat(computedStyle.paddingLeft) || 16;
            const paddingRight = parseFloat(computedStyle.paddingRight) || 16;
            const maxWidth = inputEl.clientWidth - paddingLeft - paddingRight - 8; // 8px의 안전 마진 확보

            let text = inputEl.value;
            let textWidth = context.measureText(text).width;

            // 가용 너비를 넘는 순간 한 글자씩 지워 가로 스크롤 밀림 방지
            while (textWidth > maxWidth && text.length > 0) {
                text = text.substring(0, text.length - 1);
                textWidth = context.measureText(text).width;
            }
            inputEl.value = text;
        });
    });
});

// ── 5. 전송하기(인쇄) 전 유효성 검사 (등록시간과 총 제공시간 비교)
function submitForm() {
    // ── 이름 미입력 시 인쇄 차단
    var userName = document.getElementById('userName').value.trim();
    if (!userName) {
        var el = document.getElementById('exceedMsg');
        var panel = document.getElementById('exceedPanel');
        if (el && panel) {
            el.innerHTML = '이름을 입력해주세요.';
            panel.style.width = '';
            panel.style.maxWidth = '';
            document.getElementById('exceedOverlay').classList.add('open');
            panel.classList.add('open');
        }
        return;
    }

    const totalEl = document.getElementById('totalMin');
    const totalMin = parseInt(totalEl.textContent) || 0;

    // 각 영역의 입력된 제공 시간 구하기
    const bodilyMin = parseInt(document.getElementById('time-bodily').value) || 0;
    const cognitiveMin = parseInt(document.getElementById('time-cognitive').value) || 0;
    const cognitiveManageMin = parseInt(document.getElementById('time-cognitive-manage').value) || 0;
    const emotionalMin = parseInt(document.getElementById('time-emotional').value) || 0;
    const houseworkMin = parseInt(document.getElementById('time-housework').value) || 0;

    // 총 서비스 등록시간 합산
    const usedMin = bodilyMin + cognitiveMin + cognitiveManageMin + emotionalMin + houseworkMin;

    // 일치하지 않을 때 안내 팝업창 띄우기 (기존 경고 모달을 확장하여 세련되게 렌더링)
    if (usedMin !== totalMin) {
        const el = document.getElementById('exceedMsg');
        const panel = document.getElementById('exceedPanel');

        if (el && panel) {
            el.innerHTML =
                `서비스 등록시간(분) [<b>${usedMin}</b>]이 <br>` +
                `서비스 총 제공시간(분) [<b>${totalMin}</b>]과 같아야 합니다.<br>` +
                `<div style="text-align: left; margin-top: 12px; background: #f8fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13.5px; line-height: 1.6; color: #475569; width: 100%;">` +
                `• 신체활동지원 : [<b>${bodilyMin}</b>]분<br>` +
                `• 인지활동지원 : [<b>${cognitiveMin}</b>]분<br>` +
                `• 인지관리지원 : [<b>${cognitiveManageMin}</b>]분<br>` +
                `• 정서지원지원 : [<b>${emotionalMin}</b>]분<br>` +
                `• 가사 및 일상생활 지원 : [<b>${houseworkMin}</b>]분` +
                `</div>`;

            // 시원한 레이아웃을 위해 팝업창 너비 조절
            panel.style.width = '380px';
            panel.style.maxWidth = '90%';

            document.getElementById('exceedOverlay').classList.add('open');
            panel.classList.add('open');
        }
        return; // 전송(인쇄) 중단
    }

    // 일치하면 인쇄창 띄우기
    window.print();
}

// ── ──────────────── 수급자 관리 & 연동 및 자동기입 시스템 ──────────────── ──

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

document.addEventListener('DOMContentLoaded', function () {
    const recipientListContainer = document.getElementById('recipient-list-container');
    const searchInput = document.getElementById('recipient-search');
    const btnSearchClear = document.getElementById('btn-search-clear');
    const btnOpenManage = document.getElementById('btn-open-manage');
    const controlPanel = document.getElementById('controlPanel');

    let recipients = [];

    // 데이터 불러오기 및 병합
    async function loadRecipientsFromStorage() {
        try {
            let initialList = [];
            let fileTimestamp = 0;

            // 🌟 로컬 서버 환경일 경우 API 호출 우선
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
                // 일렉트론 환경에서는 항상 파일이 기준이 되므로 타임스탬프를 현재 시간으로 동기화
                fileTimestamp = Date.now();
            } else {
                // 일반 웹 브라우저 환경인 경우 (폴백)
                initialList = typeof INITIAL_RECIPIENTS !== 'undefined' ? [...INITIAL_RECIPIENTS] : [];
                fileTimestamp = typeof INITIAL_RECIPIENTS_TIMESTAMP !== 'undefined' ? INITIAL_RECIPIENTS_TIMESTAMP : 0;
            }

            const storedTimestamp = parseInt(localStorage.getItem('rfid_recipients_timestamp') || '0', 10);

            // 고유 ID가 누락된 데이터가 있을 경우 이름_생년월일 조합으로 자동 고유 ID 생성 (대안 B 폴백)
            const ensureId = r => {
                if (!r.id) {
                    r.id = r.name + "_" + r.birth;
                }
                return r;
            };

            // 🌟 일렉트론 환경이거나 파일 타임스탬프가 더 최신인 경우 덮어쓰기 로드
            if ((window.api && window.api.loadRecipients) || (fileTimestamp > storedTimestamp && fileTimestamp > 0)) {
                // 파일에 있는 수정버전이 로컬 저장소보다 최신인 경우: 파일 데이터로 전체 초기화하여 덮어씀 (삭제 내역 즉시 동기화)
                recipients = initialList.map(ensureId);
                localStorage.setItem('rfid_recipients', JSON.stringify(recipients));
                localStorage.setItem('rfid_recipients_timestamp', fileTimestamp);
            } else {
                // 그렇지 않은 경우: 기존 로컬 임시 수정 정보 병합 적용 (로컬 변경사항 보존)
                let localList = [];
                const saved = localStorage.getItem('rfid_recipients');
                if (saved) {
                    localList = JSON.parse(saved);
                }

                const merged = initialList.map(ensureId);
                localList.map(ensureId).forEach(localRec => {
                    const idx = merged.findIndex(m => m.id === localRec.id);
                    if (idx > -1) {
                        merged[idx] = localRec;
                    } else {
                        merged.push(localRec);
                    }
                });

                recipients = merged;
                localStorage.setItem('rfid_recipients', JSON.stringify(recipients));
                if (!localStorage.getItem('rfid_recipients_timestamp')) {
                    localStorage.setItem('rfid_recipients_timestamp', storedTimestamp || Date.now());
                }
            }
        } catch (e) {
            console.error('데이터 로드 중 오류 발생:', e);
            recipients = typeof INITIAL_RECIPIENTS !== 'undefined' ? [...INITIAL_RECIPIENTS] : [];
        }
    }

    // 초성 검색 매칭 유틸리티
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

        const isChoSungQuery = searchStr.split('').every(ch => CHO_SUNG.includes(ch));
        if (isChoSungQuery) {
            return choSungName.includes(searchStr);
        }
        return false;
    }

    // 수급자 목록 렌더링
    function renderRecipientList() {
        if (!recipientListContainer) return;
        recipientListContainer.innerHTML = '';

        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

        const filtered = recipients.filter(r => {
            if (!query) return true;
            const name = r.name.toLowerCase();
            return name.includes(query) || matchesChoSung(name, query);
        });

        if (filtered.length === 0) {
            recipientListContainer.innerHTML = `
                <div style="padding: 20px 10px; color: #999; text-align: center; font-size: 12px; width: 100%;">
                    일치하는 수급자가 없습니다.
                </div>
            `;
            return;
        }

        filtered.forEach(r => {
            const row = document.createElement('div');
            row.className = 'recipient-row';
            row.title = '💡 더블클릭하면 이 수급자의 하루 표준 일정을 즉시 적용합니다.';

            const dementiaBadge = r.isDementia ? '<span class="badge-dementia">치매</span>' : '';
            const genderBadge = `<span style="font-size: 11px; color: ${r.gender === '남' ? '#3b82f6' : '#ec4899'}; font-weight: bold; margin-left: 4px;">(${r.gender || '여'})</span>`;

            row.innerHTML = `
                <div class="row-info-wrap">
                    <span class="row-name">${escapeHtml(r.name)}${genderBadge}</span>
                    <span class="row-grade">${r.grade}등급</span>
                    <span class="row-sep">·</span>
                    <span class="row-birth">${escapeHtml(r.birth)}</span>
                </div>
                ${dementiaBadge}
            `;

            // 더블클릭 시 1초 자동 완성 적용
            row.addEventListener('dblclick', () => {
                applyRecipient(r);
            });

            recipientListContainer.appendChild(row);
        });
    }

    // 수급자 더블클릭 시 모든 인풋 필드에 자동 채워넣는 매핑 엔진
    function applyRecipient(recipient) {
        if (!recipient) return;

        // 기존 입력값들이 남아있는 상태에서 새 값을 채우는 도중 시간 초과 팝업이 뜨는 것을 원천 방지하기 위해 폼 초기화 먼저 실행
        cancelForm();

        // 1. 이름 및 등급 설정
        const userNameInp = document.getElementById('userName');
        if (userNameInp) {
            userNameInp.value = recipient.name;
            // 이름 입력 시 볼드체 등의 상태 갱신 필요시 대응
            userNameInp.dispatchEvent(new Event('input'));
        }

        const gradeSelectInp = document.getElementById('gradeSelect');
        if (gradeSelectInp) {
            gradeSelectInp.value = recipient.grade;
            // 등급 변경 이벤트 발생시켜 종료 시간 재연산 강제 작동
            gradeSelectInp.dispatchEvent(new Event('change'));
        }

        // 2. 성별 자동 유추 및 적용 (저장된 성별이 있으면 그것을 우선 사용, 없으면 이름 규칙 유추 작동)
        const avatar = document.getElementById('userAvatar');
        const gBtn = document.getElementById('genderToggle');
        if (avatar && gBtn) {
            let gender = recipient.gender;
            if (!gender) {
                const isMaleName = recipient.name.endsWith('동') || recipient.name.endsWith('정') || recipient.name.endsWith('재') || recipient.name.endsWith('식') || recipient.name.endsWith('호');
                gender = isMaleName ? '남' : '여';
            }
            currentGender = gender === '남' ? 'male' : 'female';
            if (currentGender === 'female') {
                gBtn.textContent = '여성';
                gBtn.classList.remove('male');
                gBtn.classList.add('female');
                avatar.textContent = '👩🏻';
            } else {
                gBtn.textContent = '남성';
                gBtn.classList.remove('female');
                gBtn.classList.add('male');
                avatar.textContent = '👨🏻';
            }
        }

        // 3. 하루 표준 일정 템플릿 연동
        if (recipient.template) {
            const template = recipient.template;

            // 시작시간 / 종료시간 / 총시간
            const startEl = document.getElementById('startTime');
            const endEl = document.getElementById('endTime');
            const startBtn = document.getElementById('startTimeBtn');
            const endBtn = document.getElementById('endTimeBtn');

            if (startEl && startBtn && template.startTime) {
                // 시작시간 입력 (HH:MM:SS 포맷 대응)
                const sTime = template.startTime.includes(':') && template.startTime.split(':').length === 2 ? template.startTime + ':00' : template.startTime;
                startEl.value = sTime;
                startBtn.textContent = sTime;
            }

            if (endEl && endBtn && template.endTime) {
                // 종료시간 입력 (HH:MM:SS 포맷 대응)
                const eTime = template.endTime.includes(':') && template.endTime.split(':').length === 2 ? template.endTime + ':00' : template.endTime;
                endEl.value = eTime;
                endBtn.textContent = eTime;
            }

            // 총 시간 계산 작동 강제 호출
            calcTotalTime();

            // 4. 분야별 제공시간 분 단위 자동 완성
            const serviceMinutes = template.serviceMinutes || [];

            // 신체활동
            const bodilyInp = document.getElementById('time-bodily');
            if (bodilyInp) {
                bodilyInp.value = serviceMinutes[0] || '0';
                bodilyInp.classList.toggle('time-entered', parseInt(bodilyInp.value) > 0);
            }

            // 인지활동 지원 카드 (하위 인풋 채우면 부모 인풋은 자동 합산 연동됨)
            // 인지자극활동 분
            const subCognitiveRow1 = document.querySelectorAll('[data-time-group]')[0]?.querySelectorAll('.time-input-row')[1];
            const subCognitiveInp1 = subCognitiveRow1?.querySelector('.time-input-num');
            const subCognitiveCb1 = subCognitiveRow1?.querySelector('input[type="checkbox"]');
            if (subCognitiveInp1) {
                subCognitiveInp1.value = serviceMinutes[1] || '0';
                subCognitiveInp1.classList.toggle('time-entered', parseInt(subCognitiveInp1.value) > 0);
                if (subCognitiveCb1) subCognitiveCb1.checked = parseInt(subCognitiveInp1.value) > 0;
            }

            // 일상생활 함께하기 분
            const subCognitiveRow2 = document.querySelectorAll('[data-time-group]')[0]?.querySelectorAll('.time-input-row')[2];
            const subCognitiveInp2 = subCognitiveRow2?.querySelector('.time-input-num');
            const subCognitiveCb2 = subCognitiveRow2?.querySelector('input[type="checkbox"]');
            if (subCognitiveInp2) {
                subCognitiveInp2.value = serviceMinutes[2] || '0';
                subCognitiveInp2.classList.toggle('time-entered', parseInt(subCognitiveInp2.value) > 0);
                if (subCognitiveCb2) subCognitiveCb2.checked = parseInt(subCognitiveInp2.value) > 0;
            }

            // 인지활동 그룹 합산 강제 연동
            const cognitiveGroupEvent = new Event('input', { bubbles: true });
            if (subCognitiveInp1) subCognitiveInp1.dispatchEvent(cognitiveGroupEvent);

            // 인지관리 지원 카드
            const subCognitiveManageRow = document.querySelectorAll('[data-time-group]')[1]?.querySelectorAll('.time-input-row')[1];
            const subCognitiveManageInp = subCognitiveManageRow?.querySelector('.time-input-num');
            const subCognitiveManageCb = subCognitiveManageRow?.querySelector('input[type="checkbox"]');
            if (subCognitiveManageInp) {
                subCognitiveManageInp.value = serviceMinutes[3] || '0';
                subCognitiveManageInp.classList.toggle('time-entered', parseInt(subCognitiveManageInp.value) > 0);
                if (subCognitiveManageCb) subCognitiveManageCb.checked = parseInt(subCognitiveManageInp.value) > 0;
                subCognitiveManageInp.dispatchEvent(cognitiveGroupEvent); // 부모 합산 트리거
            }

            // 정서지원 카드
            const subEmotionalRow = document.querySelectorAll('[data-time-group]')[2]?.querySelectorAll('.time-input-row')[1];
            const subEmotionalInp = subEmotionalRow?.querySelector('.time-input-num');
            const subEmotionalCb = subEmotionalRow?.querySelector('input[type="checkbox"]');
            if (subEmotionalInp) {
                subEmotionalInp.value = serviceMinutes[4] || '0';
                subEmotionalInp.classList.toggle('time-entered', parseInt(subEmotionalInp.value) > 0);
                if (subEmotionalCb) subEmotionalCb.checked = parseInt(subEmotionalInp.value) > 0;
                subEmotionalInp.dispatchEvent(cognitiveGroupEvent); // 부모 합산 트리거
            }

            // 가사 및 일상생활 지원
            const houseworkInp = document.getElementById('time-housework');
            if (houseworkInp) {
                houseworkInp.value = serviceMinutes[5] || '0';
                houseworkInp.classList.toggle('time-entered', parseInt(houseworkInp.value) > 0);
            }

            // 5. 체크박스 8종 및 세부 체크박스 매핑 자동 활성화
            const checkboxes = template.checkboxes || [];
            const subCheckboxes = template.subCheckboxes; // 신규 세부 선택 정보

            // 개인위생 하위 체크박스 연동 (chk-hygiene)
            const hygieneCb = document.getElementById('chk-hygiene');
            const hygieneSubGrid = document.querySelector('[data-parent-cb="chk-hygiene"]');
            if (hygieneCb && hygieneSubGrid) {
                const childCbs = Array.from(hygieneSubGrid.querySelectorAll('input[type="checkbox"]'));
                if (subCheckboxes && subCheckboxes.length >= 5) {
                    childCbs.forEach((cb, idx) => {
                        if (idx < 5) cb.checked = !!subCheckboxes[idx];
                    });
                    hygieneCb.checked = childCbs.some(c => c.checked);
                } else {
                    // 하위 호환성 Fallback
                    hygieneCb.checked = !!checkboxes[0];
                    childCbs.forEach(cb => {
                        cb.checked = !!checkboxes[0];
                    });
                }
            }

            // 몸씻기 도움
            const washRow = document.querySelector('.main-group-grid');
            const washCb = washRow?.querySelectorAll('input[type="checkbox"]')[0];
            if (washCb) washCb.checked = !!checkboxes[1];

            // 식사도움
            const mealCb = washRow?.querySelectorAll('input[type="checkbox"]')[1];
            if (mealCb) mealCb.checked = !!checkboxes[2];

            // 체위변경
            const postureCb = washRow?.querySelectorAll('input[type="checkbox"]')[2];
            if (postureCb) postureCb.checked = !!checkboxes[3];

            // 이동도움
            const moveCb = document.querySelector('.main-label-alone input[type="checkbox"]');
            if (moveCb) moveCb.checked = !!checkboxes[4];

            // 화장실 이용 (chk-toilet)
            const toiletCb = document.getElementById('chk-toilet');
            const toiletSubGrid = document.querySelector('[data-parent-cb="chk-toilet"]');
            if (toiletCb && toiletSubGrid) {
                const childCbs = Array.from(toiletSubGrid.querySelectorAll('input[type="checkbox"]'));
                if (subCheckboxes && subCheckboxes.length >= 9) {
                    childCbs.forEach((cb, idx) => {
                        if (idx < 4) cb.checked = !!subCheckboxes[5 + idx];
                    });
                    toiletCb.checked = childCbs.some(c => c.checked);
                } else {
                    // 하위 호환성 Fallback
                    toiletCb.checked = !!checkboxes[5];
                    childCbs.forEach(cb => {
                        cb.checked = !!checkboxes[5];
                    });
                }
            }

            // 가사 및 일상생활 지원 하위 체크박스 연동 (chk-housework)
            const houseworkCb = document.getElementById('chk-housework');
            const houseworkSubGrid = document.querySelector('[data-parent-cb="chk-housework"]');
            if (houseworkCb && houseworkSubGrid) {
                const childCbs = Array.from(houseworkSubGrid.querySelectorAll('input[type="checkbox"]'));
                if (subCheckboxes && subCheckboxes.length >= 13) {
                    childCbs.forEach((cb, idx) => {
                        if (idx < 4) cb.checked = !!subCheckboxes[9 + idx];
                    });
                    houseworkCb.checked = childCbs.some(c => c.checked);
                } else {
                    // 하위 호환성 Fallback
                    houseworkCb.checked = !!checkboxes[6];
                    childCbs.forEach(cb => {
                        cb.checked = !!checkboxes[6];
                    });
                }
            }

            // 개인활동지원
            const allCbs = document.querySelectorAll('input[type="checkbox"]');
            let targetActivityCb = null;
            allCbs.forEach(cb => {
                if (cb.closest('.category-card') && cb.closest('.category-card').querySelector('.sub-title')?.textContent.includes('가사 및 일상생활')) {
                    if (cb.parentNode.textContent.includes('개인활동지원')) {
                        targetActivityCb = cb;
                    }
                }
            });
            if (targetActivityCb) targetActivityCb.checked = !!checkboxes[7];

            // 세부 기타사항 매핑 복원
            const subOtherTexts = template.subOtherTexts || [];
            const hygieneOtherEl = document.getElementById('hygiene-other-text');
            if (hygieneOtherEl) {
                hygieneOtherEl.value = subOtherTexts[0] || '';
            }
            const toiletOtherEl = document.getElementById('toilet-other-text');
            if (toiletOtherEl) {
                toiletOtherEl.value = subOtherTexts[1] || '';
            }
            const houseworkOtherEl = document.getElementById('housework-other-text');
            if (houseworkOtherEl) {
                houseworkOtherEl.value = subOtherTexts[2] || '';
            }

            // 6. 변화상태 라디오 매핑 (1: 호전, 2: 유지, 3: 악화)
            const numBoxes = template.numBoxes || ["2", "2", "2"];
            const mapNumToRadio = function (radioName, val) {
                const radios = document.getElementsByName(radioName);
                if (radios.length === 3) {
                    const idx = val === "1" ? 0 : (val === "3" ? 2 : 1);
                    radios[idx].checked = true;
                }
            };
            mapNumToRadio('p1', numBoxes[0]);
            mapNumToRadio('m1', numBoxes[1]);
            mapNumToRadio('c1', numBoxes[2]);

            // 7. 배변 실수 횟수 매핑
            const fecesVal = template.feces !== undefined ? template.feces : '0';
            const urineVal = template.urine !== undefined ? template.urine : '0';

            const fecesRow = document.querySelectorAll('.counter-row')[0];
            const fecesInp = fecesRow?.querySelector('.counter-input');
            const fecesCb = fecesRow?.querySelector('input[type="checkbox"]');
            if (fecesInp) {
                fecesInp.value = fecesVal;
                if (fecesCb) fecesCb.checked = parseInt(fecesVal) > 0;
            }

            const urineRow = document.querySelectorAll('.counter-row')[1];
            const urineInp = urineRow?.querySelector('.counter-input');
            const urineCb = urineRow?.querySelector('input[type="checkbox"]');
            if (urineInp) {
                urineInp.value = urineVal;
                if (urineCb) urineCb.checked = parseInt(urineVal) > 0;
            }

            // 8. 특이사항 매핑 및 글자수 카운터 작동
            const specialNoteTA = document.getElementById('specialNote');
            if (specialNoteTA) {
                specialNoteTA.value = template.note || '';
                specialNoteTA.dispatchEvent(new Event('input'));
            }

            // 9. 잔여시간 갱신 및 초과 검증 최종 작동 호출
            updateRemaining();

            // ── 주간/월간/필요시 체크박스 및 변화상태 라디오 적용 ──
            const wCheckboxes = template.weeklyCheckboxes || [];
            const wSubCheckboxes = template.weeklySubCheckboxes || [];
            const wNumBoxes = template.weeklyNumBoxes || [];

            // 1. 개인위생 하위 주간 상태
            if (hygieneSubGrid) {
                const childCbs = Array.from(hygieneSubGrid.querySelectorAll('input[type="checkbox"]'));
                childCbs.forEach((cb, idx) => {
                    if (idx < 5 && wSubCheckboxes[idx]) {
                        cb.classList.add('weekly-checked');
                    } else {
                        cb.classList.remove('weekly-checked');
                    }
                });
            }

            // 2. 화장실 이용 하위 주간 상태
            if (toiletSubGrid) {
                const childCbs = Array.from(toiletSubGrid.querySelectorAll('input[type="checkbox"]'));
                childCbs.forEach((cb, idx) => {
                    if (idx < 4 && wSubCheckboxes[5 + idx]) {
                        cb.classList.add('weekly-checked');
                    } else {
                        cb.classList.remove('weekly-checked');
                    }
                });
            }

            // 3. 가사 및 일상생활 지원 하위 주간 상태
            if (houseworkSubGrid) {
                const childCbs = Array.from(houseworkSubGrid.querySelectorAll('input[type="checkbox"]'));
                childCbs.forEach((cb, idx) => {
                    if (idx < 4 && wSubCheckboxes[9 + idx]) {
                        cb.classList.add('weekly-checked');
                    } else {
                        cb.classList.remove('weekly-checked');
                    }
                });
            }

            // 4. 대분류 주간 상태 체크 및 클래스 부여
            // 개인위생
            if (hygieneCb) {
                if (wCheckboxes[0]) hygieneCb.classList.add('weekly-checked');
                else hygieneCb.classList.remove('weekly-checked');
            }
            // 몸씻기 도움
            if (washCb) {
                if (wCheckboxes[1]) washCb.classList.add('weekly-checked');
                else washCb.classList.remove('weekly-checked');
            }
            // 식사도움
            if (mealCb) {
                if (wCheckboxes[2]) mealCb.classList.add('weekly-checked');
                else mealCb.classList.remove('weekly-checked');
            }
            // 체위변경
            if (postureCb) {
                if (wCheckboxes[3]) postureCb.classList.add('weekly-checked');
                else postureCb.classList.remove('weekly-checked');
            }
            // 이동도움
            if (moveCb) {
                if (wCheckboxes[4]) moveCb.classList.add('weekly-checked');
                else moveCb.classList.remove('weekly-checked');
            }
            // 화장실 이용
            if (toiletCb) {
                if (wCheckboxes[5]) toiletCb.classList.add('weekly-checked');
                else toiletCb.classList.remove('weekly-checked');
            }
            // 가사 및 일상생활
            if (houseworkCb) {
                if (wCheckboxes[6]) houseworkCb.classList.add('weekly-checked');
                else houseworkCb.classList.remove('weekly-checked');
            }
            // 개인활동지원
            if (targetActivityCb) {
                if (wCheckboxes[7]) targetActivityCb.classList.add('weekly-checked');
                else targetActivityCb.classList.remove('weekly-checked');
            }

            // 5. 변화상태 라디오 행 주간 연동
            const radioRows = document.querySelectorAll('.radio-row');
            if (radioRows.length >= 3) {
                for (let i = 0; i < 3; i++) {
                    if (wNumBoxes[i]) {
                        radioRows[i].classList.add('weekly-active');
                    } else {
                        radioRows[i].classList.remove('weekly-active');
                    }
                }
            }

            // 6. 하위 항목 기준으로 대분류 주간 상태 최종 보완 갱신 (유저 요청 규칙 적용)
            updateAppParentWeeklyStatus('chk-hygiene');
            updateAppParentWeeklyStatus('chk-toilet');
            updateAppParentWeeklyStatus('chk-housework');

            // 알림 토스트 띄우기
            showValidationToastSuccess(`🎉 ${recipient.name} 수급자의 하루 표준 일정이 성공적으로 자동 입력되었습니다!`);

            // 수급자 선택이 완료되면 자동으로 패널 닫아주기 (화면 가림 방지 UX 최적화)
            if (controlPanel) {
                setTimeout(() => {
                    controlPanel.classList.remove('open');
                }, 800); // 0.8초 딜레이를 주어 토스트 성공 알림을 인지할 기회를 제공
            }
        }
    }

    // 성공 메시지용 미니 토스트 알림 함수
    function showValidationToastSuccess(message) {
        const container = document.getElementById('validation-toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'val-toast-card';
        toast.style.background = 'linear-gradient(135deg, #2e7d32 0%, #4caf50 100%)';
        toast.style.borderColor = '#81c784';
        toast.style.boxShadow = '0 6px 20px rgba(76, 175, 80, 0.15)';
        toast.innerHTML = `
            <span class="val-toast-icon">✅</span>
            <span class="val-toast-msg" style="color: white; font-weight: bold; font-size: 13px;">${escapeHtml(message)}</span>
            <button class="val-toast-close" style="color: white;">&times;</button>
        `;

        toast.querySelector('.val-toast-close').addEventListener('click', () => {
            toast.classList.add('fade-out');
            toast.addEventListener('animationend', () => toast.remove());
        });

        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3500);
    }

    // 초기 기동 데이터 로드 및 렌더링
    loadRecipientsFromStorage().then(() => {
        renderRecipientList();
    });

    // 타 창(대시보드)에서 수급자 추가/수정 시 실시간으로 이 화면 목록 갱신
    window.addEventListener('storage', function (e) {
        if (e.key === 'rfid_recipients' || !e.key) {
            loadRecipientsFromStorage();
            renderRecipientList();
        }
    });

    // 실시간 검색
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            const val = this.value.trim();
            if (btnSearchClear) {
                btnSearchClear.style.display = val.length > 0 ? 'block' : 'none';
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

    // 👥 수급자 정보 관리 / 신규 등록 대시보드 새창 띄우기
    if (btnOpenManage) {
        btnOpenManage.addEventListener('click', function () {
            const w = 1180;
            const h = 960;
            const left = (window.screen.width / 2) - (w / 2);
            const top = (window.screen.height / 2) - (h / 2);
            window.open('[관리자] 수급자 등록 및 변경하기.html', 'recipient_dashboard', `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`);
        });
    }

    // 🎛️ 반응형 슬라이딩 드로어(control-panel) 온오프 제어 연동
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
});
