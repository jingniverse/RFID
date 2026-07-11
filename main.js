const { app, Tray, Menu, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');

// 중복 실행 방지 락(Lock) 요청
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  let tray = null;
  let port = 3001;

  app.on('second-instance', (event, commandLine, workingDirectory) => {
    shell.openExternal(`http://localhost:${port}`);
  });

  // 🌟 수급자 데이터 경로 결정 함수 (EXE 실행파일 바로 옆 또는 개발 루트 폴더)
  const getRecipientsPath = () => {
    if (app.isPackaged) {
      // Portable EXE 실행 파일이 있는 원본 디렉토리 경로 획득 (PORTABLE_EXECUTABLE_DIR)
      const baseDir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
      return path.join(baseDir, 'recipients.js');
    } else {
      // 개발 모드 시 루트 폴더에 recipients.js 보관
      return path.join(__dirname, 'recipients.js');
    }
  };

  // 🌟 JSON 수급자 목록에 가이드용 주석을 추가해주는 문자열 변환 헬퍼 함수
  function stringifyWithComments(recipients) {
    const jsonStr = JSON.stringify(recipients, null, 2);
    const lines = jsonStr.split('\n');
    
    let inServiceMinutes = false;
    let serviceMinutesIdx = 0;
    
    let inCheckboxes = false;
    let checkboxesIdx = 0;
    
    let inSubCheckboxes = false;
    let subCheckboxesIdx = 0;

    let inSubOtherTexts = false;
    let subOtherTextsIdx = 0;

    let inNumBoxes = false;
    let numBoxesIdx = 0;

    let inWeeklyCheckboxes = false;
    let weeklyCheckboxesIdx = 0;

    let inWeeklySubCheckboxes = false;
    let weeklySubCheckboxesIdx = 0;

    let inWeeklyNumBoxes = false;
    let weeklyNumBoxesIdx = 0;
    
    const serviceMinutesComments = [
      ' // [0] 신체활동 지원',
      ' // [1] 인지활동 - 인지자극',
      ' // [2] 인지활동 - 일상함께',
      ' // [3] 인지관리 - 행동변화',
      ' // [4] 정서지원 - 말벗/격려',
      ' // [5] 가사 및 일상생활'
    ];
    
    const checkboxesComments = [
      ' // [0] 개인위생 (chk-hygiene)',
      ' // [1] 몸 씻기 도움',
      ' // [2] 식사도움',
      ' // [3] 체위변경',
      ' // [4] 이동도움',
      ' // [5] 화장실 이용 (chk-toilet)',
      ' // [6] 가사 및 일상생활 (chk-housework)',
      ' // [7] 개인활동지원'
    ];
    
    const subCheckboxesComments = [
      ' // [0] [개인위생] 옷 갈아입기',
      ' // [1] [개인위생] 세면 도움',
      ' // [2] [개인위생] 구강 청결',
      ' // [3] [개인위생] 몸단장 도움',
      ' // [4] [개인위생] 기타',
      ' // [5] [화장실] 화장실',
      ' // [6] [화장실] 이동변기',
      ' // [7] [화장실] 기저귀 교환',
      ' // [8] [화장실] 기타',
      ' // [9] [가사] 식사 준비',
      ' // [10] [가사] 청소 및 정리정돈',
      ' // [11] [가사] 세탁',
      ' // [12] [가사] 기타'
    ];

    const subOtherTextsComments = [
      ' // [0] 개인위생 기타내용',
      ' // [1] 화장실 기타내용',
      ' // [2] 가사 및 정리 기타내용'
    ];

    const numBoxesComments = [
      ' // [0] 신체기능 (1:호전, 2:유지, 3:악화)',
      ' // [1] 식사기능 (1:호전, 2:유지, 3:악화)',
      ' // [2] 인지기능 (1:호전, 2:유지, 3:악화)'
    ];

    const weeklyCheckboxesComments = [
      ' // [0] 주간-개인위생',
      ' // [1] 주간-몸 씻기 도움',
      ' // [2] 주간-식사도움',
      ' // [3] 주간-체위변경',
      ' // [4] 주간-이동도움',
      ' // [5] 주간-화장실 이용',
      ' // [6] 주간-가사 및 일상생활',
      ' // [7] 주간-개인활동지원'
    ];

    const weeklySubCheckboxesComments = [
      ' // [0] 주간-[개인위생] 옷 갈아입기',
      ' // [1] 주간-[개인위생] 세면 도움',
      ' // [2] 주간-[개인위생] 구강 청결',
      ' // [3] 주간-[개인위생] 몸단장 도움',
      ' // [4] 주간-[개인위생] 기타',
      ' // [5] 주간-[화장실] 화장실',
      ' // [6] 주간-[화장실] 이동변기',
      ' // [7] 주간-[화장실] 기저귀 교환',
      ' // [8] 주간-[화장실] 기타',
      ' // [9] 주간-[가사] 식사 준비',
      ' // [10] 주간-[가사] 청소 및 정리정돈',
      ' // [11] 주간-[가사] 세탁',
      ' // [12] 주간-[가사] 기타'
    ];

    const weeklyNumBoxesComments = [
      ' // [0] 주간-신체기능',
      ' // [1] 주간-식사기능',
      ' // [2] 주간-인지기능'
    ];

    const processedLines = lines.map(line => {
      const commentMappings = [
        { key: '"id":', comment: ' // 고유 ID (생성 시간 타임스탬프)' },
        { key: '"name":', comment: ' // 수급자 성명' },
        { key: '"birth":', comment: ' // 생년월일 (YYMMDD 형식)' },
        { key: '"gender":', comment: ' // 성별 (남/여)' },
        { key: '"grade":', comment: ' // 장기요양등급 (1~5등급 및 인지지원등급)' },
        { key: '"cert":', comment: ' // 장기요양인정번호' },
        { key: '"caregiver":', comment: ' // 담당 요양보호사 성명' },
        { key: '"isDementia":', comment: ' // 치매 여부 (true/false)' },
        { key: '"totalTime":', comment: ' // 하루 총 급여 제공 시간 (분 단위)' },
        { key: '"startTime":', comment: ' // 시작 시간 (HH:MM)' },
        { key: '"endTime":', comment: ' // 종료 시간 (HH:MM)' },
        { key: '"feces":', comment: ' // 대변 상태' },
        { key: '"urine":', comment: ' // 소변 상태' },
        { key: '"note":', comment: ' // 특이사항 및 전달사항' }
      ];
      
      for (const mapping of commentMappings) {
        if (line.includes(mapping.key)) {
          return line + mapping.comment;
        }
      }
      
      if (line.includes('"serviceMinutes": [')) {
        inServiceMinutes = true;
        serviceMinutesIdx = 0;
        return line;
      }
      if (inServiceMinutes && (line.trim() === '],' || line.trim() === ']')) {
        inServiceMinutes = false;
        return line;
      }
      if (inServiceMinutes) {
        const comment = serviceMinutesComments[serviceMinutesIdx] || '';
        serviceMinutesIdx++;
        return line + comment;
      }
      
      if (line.includes('"checkboxes": [')) {
        inCheckboxes = true;
        checkboxesIdx = 0;
        return line;
      }
      if (inCheckboxes && (line.trim() === '],' || line.trim() === ']')) {
        inCheckboxes = false;
        return line;
      }
      if (inCheckboxes) {
        const comment = checkboxesComments[checkboxesIdx] || '';
        checkboxesIdx++;
        return line + comment;
      }
      
      if (line.includes('"subCheckboxes": [')) {
        inSubCheckboxes = true;
        subCheckboxesIdx = 0;
        return line;
      }
      if (inSubCheckboxes && (line.trim() === '],' || line.trim() === ']')) {
        inSubCheckboxes = false;
        return line;
      }
      if (inSubCheckboxes) {
        const comment = subCheckboxesComments[subCheckboxesIdx] || '';
        subCheckboxesIdx++;
        return line + comment;
      }

      if (line.includes('"subOtherTexts": [')) {
        inSubOtherTexts = true;
        subOtherTextsIdx = 0;
        return line;
      }
      if (inSubOtherTexts && (line.trim() === '],' || line.trim() === ']')) {
        inSubOtherTexts = false;
        return line;
      }
      if (inSubOtherTexts) {
        const comment = subOtherTextsComments[subOtherTextsIdx] || '';
        subOtherTextsIdx++;
        return line + comment;
      }

      if (line.includes('"numBoxes": [')) {
        inNumBoxes = true;
        numBoxesIdx = 0;
        return line;
      }
      if (inNumBoxes && (line.trim() === '],' || line.trim() === ']')) {
        inNumBoxes = false;
        return line;
      }
      if (inNumBoxes) {
        const comment = numBoxesComments[numBoxesIdx] || '';
        numBoxesIdx++;
        return line + comment;
      }

      if (line.includes('"weeklyCheckboxes": [')) {
        inWeeklyCheckboxes = true;
        weeklyCheckboxesIdx = 0;
        return line;
      }
      if (inWeeklyCheckboxes && (line.trim() === '],' || line.trim() === ']')) {
        inWeeklyCheckboxes = false;
        return line;
      }
      if (inWeeklyCheckboxes) {
        const comment = weeklyCheckboxesComments[weeklyCheckboxesIdx] || '';
        weeklyCheckboxesIdx++;
        return line + comment;
      }

      if (line.includes('"weeklySubCheckboxes": [')) {
        inWeeklySubCheckboxes = true;
        weeklySubCheckboxesIdx = 0;
        return line;
      }
      if (inWeeklySubCheckboxes && (line.trim() === '],' || line.trim() === ']')) {
        inWeeklySubCheckboxes = false;
        return line;
      }
      if (inWeeklySubCheckboxes) {
        const comment = weeklySubCheckboxesComments[weeklySubCheckboxesIdx] || '';
        weeklySubCheckboxesIdx++;
        return line + comment;
      }

      if (line.includes('"weeklyNumBoxes": [')) {
        inWeeklyNumBoxes = true;
        weeklyNumBoxesIdx = 0;
        return line;
      }
      if (inWeeklyNumBoxes && (line.trim() === '],' || line.trim() === ']')) {
        inWeeklyNumBoxes = false;
        return line;
      }
      if (inWeeklyNumBoxes) {
        const comment = weeklyNumBoxesComments[weeklyNumBoxesIdx] || '';
        weeklyNumBoxesIdx++;
        return line + comment;
      }
      
      return line;
    });
    
    return processedLines.join('\n');
  }

  // 🌟 로컬 HTTP 웹 서버 시작 및 포트 충돌 방지 로직
  function startLocalServer() {
    const server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url, true);
      let pathname = parsedUrl.pathname;

      // 1. API: load-recipients
      if (pathname === '/api/load-recipients' && req.method === 'GET') {
        const filePath = getRecipientsPath();
        if (!fs.existsSync(filePath)) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify([]));
        }
        try {
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const jsonMatch = fileContent.match(/var INITIAL_RECIPIENTS = (\[[\s\S]*?\]);/);
          
          let data = [];
          if (jsonMatch) {
            try {
              // JSON 변환 전 정규식으로 각 라인의 single-line 주석(//)을 빈 문자로 치환하여 제거
              const cleanJsonText = jsonMatch[1].replace(/\/\/.*/g, '');
              data = JSON.parse(cleanJsonText);
            } catch (parseErr) {
              console.error("JSON parsing error after comment removal:", parseErr);
              data = [];
            }
          }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify(data));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ error: err.message }));
        }
      }

      // 1.5. API: load-center-info
      if (pathname === '/api/load-center-info' && req.method === 'GET') {
        const filePath = getRecipientsPath();
        if (!fs.existsSync(filePath)) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ centerName: '', centerCode: '' }));
        }
        try {
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const nameMatch = fileContent.match(/var INITIAL_CENTER_NAME = (["'])([\s\S]*?)\1;/);
          const codeMatch = fileContent.match(/var INITIAL_CENTER_CODE = (["'])([\s\S]*?)\1;/);
          const centerName = nameMatch ? nameMatch[2] : '';
          const centerCode = codeMatch ? codeMatch[2] : '';
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ centerName, centerCode }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ error: err.message }));
        }
      }

      // 2. API: save-recipients
      if (pathname === '/api/save-recipients' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            let recipients = [];
            let centerName = '';
            let centerCode = '';
            if (Array.isArray(parsed)) {
              recipients = parsed;
            } else {
              recipients = parsed.recipients || [];
              centerName = parsed.centerName || '';
              centerCode = parsed.centerCode || '';
            }

            const filePath = getRecipientsPath();
            const timestamp = Date.now();
            const jsContent = `/**
 * 수급자 & 요양보호사 고정 목록 설정 파일 (recipients.js)
 * 
 * [주의] 이 파일은 EXE 앱 상에서 수급자 변경 시 자동으로 갱신됩니다.
 * 사용자가 직접 VS Code 또는 메모장 등으로 이 파일의 목록 데이터를 수정해도 실시간 반영됩니다.
 */

if (typeof INITIAL_RECIPIENTS === 'undefined') {
  var INITIAL_RECIPIENTS_TIMESTAMP = ${timestamp};

  var INITIAL_RECIPIENTS = ${stringifyWithComments(recipients)};

  var INITIAL_CENTER_NAME = ${JSON.stringify(centerName)};
  var INITIAL_CENTER_CODE = ${JSON.stringify(centerCode)};
}
`;
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, jsContent, 'utf-8');

            // 💡 하위 호환성 유지용 동기화 (개발 환경인 경우)
            if (!app.isPackaged) {
              const paths = [
                path.join(__dirname, 'RFID_APP', 'js', 'recipients.js'),
                path.join(__dirname, '수기 급여제공기록지', 'js', 'recipients.js')
              ];
              paths.forEach(p => {
                try {
                  const pDir = path.dirname(p);
                  if (fs.existsSync(pDir)) {
                    fs.writeFileSync(p, jsContent, 'utf-8');
                  }
                } catch (e) {}
              });
            }

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true }));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      // 3. 정적 파일 서빙
      try {
        pathname = decodeURIComponent(pathname);
      } catch (e) {}

      // 기본 파일 설정
      if (pathname === '/' || pathname === '') {
        pathname = '/index.html';
      }

      const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
      const localFilePath = path.join(__dirname, safePath);

      if (!fs.existsSync(localFilePath) || fs.statSync(localFilePath).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('파일을 찾을 수 없습니다.');
      }

      // MIME 타입 결정
      const ext = path.extname(localFilePath).toLowerCase();
      let contentType = 'application/octet-stream';
      if (ext === '.html') contentType = 'text/html; charset=utf-8';
      else if (ext === '.css') contentType = 'text/css; charset=utf-8';
      else if (ext === '.js') contentType = 'application/javascript; charset=utf-8';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.gif') contentType = 'image/gif';
      else if (ext === '.ico') contentType = 'image/x-icon';

      res.writeHead(200, { 'Content-Type': contentType });
      const stream = fs.createReadStream(localFilePath);
      stream.pipe(res);
    });

    // 🌟 포트가 이미 사용 중인 경우 다음 포트로 자동 이행
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} is in use, trying ${port + 1}...`);
        port++;
        server.listen(port, 'localhost');
      } else {
        console.error('Server listening error:', err);
      }
    });

    server.on('listening', () => {
      console.log(`HTTP Server running at http://localhost:${port}`);
      // 서버가 무사히 구동을 시작했을 때 알림 영역 트레이와 브라우저를 로드
      createTray(port);
      shell.openExternal(`http://localhost:${port}`);
    });

    server.listen(port, 'localhost');
  }

  // 🌟 시스템 트레이(알림 영역) 아이콘 생성 함수
  function createTray(activePort) {
    const iconPath = path.join(__dirname, 'tray_icon.png');
    
    if (!fs.existsSync(iconPath)) {
      console.error('Tray icon not found at:', iconPath);
    }
    
    tray = new Tray(iconPath);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '👥 방문요양 스마트 허브',
        enabled: false
      },
      { type: 'separator' },
      {
        label: '🌐 웹 브라우저에서 화면 열기',
        click: () => {
          shell.openExternal(`http://localhost:${activePort}`);
        }
      },
      { type: 'separator' },
      {
        label: '❌ 프로그램 종료',
        click: () => {
          app.quit();
        }
      }
    ]);

    tray.setToolTip('방문요양 스마트 허브');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
      shell.openExternal(`http://localhost:${activePort}`);
    });
  }

  // 앱 구동 시 실행
  app.on('ready', () => {
    startLocalServer();
  });

  // 트레이 앱이므로 모든 윈도우가 닫혀도 앱이 종료되지 않도록 설정
  app.on('window-all-closed', () => {
    // Do nothing
  });
}
