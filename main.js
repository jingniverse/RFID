const { app, Tray, Menu, shell, dialog } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 🌟 단일 인스턴스 잠금 (중복 실행 방지)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // 이미 다른 인스턴스가 실행 중이면 즉시 종료
  app.quit();
} else {
  let tray = null;
  let server = null;
  let port = 3000;

  // 🌟 중복 실행 시도 시 기존 브라우저 창 다시 열기
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (server && port) {
      shell.openExternal(`http://localhost:${port}`);
    }
  });

  // 🌟 수급자 데이터 파일 경로 결정 함수 (포터블 EXE 실제 위치 100% 탐색)
  function getRecipientsPath() {
    if (app.isPackaged) {
      // 💡 electron-builder 포터블 환경에서는 PORTABLE_EXECUTABLE_DIR가 실제 exe 폴더를 가리킴
      const exeDir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe'));
      const externalPath = path.join(exeDir, 'recipients.js');
      
      // 만약 외부 실행 폴더에 recipients.js가 아직 없다면 내부 기본 템플릿을 복사 생성
      if (!fs.existsSync(externalPath)) {
        try {
          const internalPath = path.join(__dirname, 'recipients.js');
          if (fs.existsSync(internalPath)) {
            fs.copyFileSync(internalPath, externalPath);
          }
        } catch (e) {
          console.error("기본 recipients.js 외부 복사 실패:", e);
        }
      }
      return externalPath;
    } else {
      // 개발 환경 (VS Code 등)
      return path.join(__dirname, 'recipients.js');
    }
  }

  // 💡 가독성 높은 주석이 포함된 자바스크립트 객체 문자열 변환 헬퍼
  function stringifyWithComments(recipients) {
    if (!Array.isArray(recipients)) return JSON.stringify(recipients, null, 2);
    
    let out = '[\n';
    recipients.forEach((r, idx) => {
      out += '    {\n';
      out += `      "id": ${JSON.stringify(r.id || String(Date.now()))}, // 고유 ID\n`;
      out += `      "name": ${JSON.stringify(r.name || "")}, // 수급자 성명\n`;
      out += `      "birth": ${JSON.stringify(r.birth || "")}, // 생년월일\n`;
      out += `      "gender": ${JSON.stringify(r.gender || "여")}, // 성별\n`;
      out += `      "grade": ${JSON.stringify(r.grade || "1")}, // 장기요양등급\n`;
      out += `      "cert": ${JSON.stringify(r.cert || "")}, // 장기요양인정번호\n`;
      out += `      "caregiver": ${JSON.stringify(r.caregiver || "")}, // 담당 요양보호사 성명\n`;
      out += `      "isDementia": ${r.isDementia ? "true" : "false"}, // 치매 여부\n`;
      if (typeof r.isPending !== 'undefined') {
        out += `      "isPending": ${r.isPending ? "true" : "false"}, // 보류 여부\n`;
      }
      if (typeof r.isWaiting !== 'undefined') {
        out += `      "isWaiting": ${r.isWaiting ? "true" : "false"}, // 대기 여부\n`;
      }
      if (typeof r.isFamilyCare !== 'undefined') {
        out += `      "isFamilyCare": ${r.isFamilyCare ? "true" : "false"}, // 가족요양 여부\n`;
      }
      if (typeof r.familyCareType !== 'undefined') {
        out += `      "familyCareType": ${JSON.stringify(r.familyCareType || "60")}, // 가족요양 구분\n`;
      }
      
      const t = r.template || {};
      out += '      "template": {\n';
      out += `        "totalTime": ${JSON.stringify(t.totalTime || "180")}, // 총 서비스 시간(분)\n`;
      out += `        "startTime": ${JSON.stringify(t.startTime || "09:00")}, // 시작 시간\n`;
      out += `        "endTime": ${JSON.stringify(t.endTime || "12:00")}, // 종료 시간\n`;
      out += `        "serviceMinutes": ${JSON.stringify(t.serviceMinutes || ["", "", "", "", "", ""])}, // 6대 요양 시간 분배\n`;
      out += `        "checkboxes": ${JSON.stringify(t.checkboxes || [])}, // 메인 8대 체크박스\n`;
      out += `        "subCheckboxes": ${JSON.stringify(t.subCheckboxes || [])}, // 상세 서브 체크박스\n`;
      out += `        "subOtherTexts": ${JSON.stringify(t.subOtherTexts || ["", "", ""])}, // 기타 직접입력\n`;
      out += `        "numBoxes": ${JSON.stringify(t.numBoxes || ["", "", ""])}, // 상태 변화(대변, 소변, 식사량)\n`;
      out += `        "feces": ${JSON.stringify(t.feces || "0")}, // 대변 실수 횟수\n`;
      out += `        "urine": ${JSON.stringify(t.urine || "0")}, // 소변 실수 횟수\n`;
      out += `        "note": ${JSON.stringify(t.note || t.notes || "")}, // 특이사항\n`;
      out += `        "weeklyCheckboxes": ${JSON.stringify(t.weeklyCheckboxes || [])}, // 주간 비정기 체크박스\n`;
      out += `        "weeklySubCheckboxes": ${JSON.stringify(t.weeklySubCheckboxes || [])}, // 주간 비정기 서브\n`;
      out += `        "weeklyNumBoxes": ${JSON.stringify(t.weeklyNumBoxes || [])}, // 주간 비정기 수치\n`;
      out += `        "monthlyCheckboxes": ${JSON.stringify(t.monthlyCheckboxes || [])}, // 월간 비정기 체크박스\n`;
      out += `        "monthlySubCheckboxes": ${JSON.stringify(t.monthlySubCheckboxes || [])}, // 월간 비정기 서브\n`;
      out += `        "monthlyNumBoxes": ${JSON.stringify(t.monthlyNumBoxes || [])}, // 월간 비정기 수치\n`;
      out += `        "asNeededCheckboxes": ${JSON.stringify(t.asNeededCheckboxes || [])}, // 필요시 비정기 체크박스\n`;
      out += `        "asNeededSubCheckboxes": ${JSON.stringify(t.asNeededSubCheckboxes || [])}, // 필요시 비정기 서브\n`;
      out += `        "asNeededNumBoxes": ${JSON.stringify(t.asNeededNumBoxes || [])} // 필요시 비정기 수치\n`;
      out += '      }\n';
      out += '    }' + (idx < recipients.length - 1 ? ',\n' : '\n');
    });
    out += '  ]';
    return out;
  }

  // 🌟 로컬 HTTP 서버 구동 함수
  function startLocalServer() {
    server = http.createServer((req, res) => {
      // CORS 및 캐시 방지 헤더 설정
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        return res.end();
      }

      const parsedUrl = url.parse(req.url, true);
      let pathname = parsedUrl.pathname;

      // 1. API: load-recipients (vm 안전 실행 파싱 적용)
      if (pathname === '/api/load-recipients' && req.method === 'GET') {
        const filePath = getRecipientsPath();
        if (!fs.existsSync(filePath)) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify([]));
        }
        try {
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const vm = require('vm');
          const sandbox = { INITIAL_RECIPIENTS: [] };
          try {
            vm.runInNewContext(fileContent, sandbox);
          } catch (vmErr) {
            console.warn("VM eval 실패, 정규식 대체 시도:", vmErr);
            const jsonMatch = fileContent.match(/var INITIAL_RECIPIENTS = (\[[\s\S]*?\])(?:\s*;|\s*$)/);
            if (jsonMatch) {
              const cleanJsonText = jsonMatch[1].replace(/\/\/.*/g, '');
              sandbox.INITIAL_RECIPIENTS = JSON.parse(cleanJsonText);
            }
          }
          const data = Array.isArray(sandbox.INITIAL_RECIPIENTS) ? sandbox.INITIAL_RECIPIENTS : [];
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
                path.join(__dirname, '수기 급여제공기록지', 'js', 'recipients.js'),
                path.join(__dirname, 'LONGTERM', 'js', 'recipients.js')
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
