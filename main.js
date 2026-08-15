const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 880,
    minWidth: 1000,
    minHeight: 700,
    title: '방문요양 급여제공기록지 & RFID 스마트 통합 관리 시스템',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  // 통합 허브 메인 대시보드 로드
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// 수급자 데이터 로컬 영구 저장 IPC 핸들러
ipcMain.on('save-recipients-data', (event, data) => {
  try {
    const recipientsContent = `/**
 * 수급자 & 요양보호사 고정 목록 설정 파일 (recipients.js)
 * 자동 생성된 최신 데이터
 */

if (typeof INITIAL_RECIPIENTS === 'undefined') {
  var INITIAL_RECIPIENTS_TIMESTAMP = ${Date.now()};
  var INITIAL_RECIPIENTS = ${JSON.stringify(data, null, 2)};
}
`;
    // 루트 및 각 서브폴더의 recipients.js 동시 동기화
    const targetPaths = [
      path.join(__dirname, 'recipients.js'),
      path.join(__dirname, 'RFID_APP', 'js', 'recipients.js'),
      path.join(__dirname, '수기 급여제공기록지', 'js', 'recipients.js'),
      path.join(__dirname, 'LONGTERM', 'js', 'recipients.js')
    ];

    targetPaths.forEach(p => {
      if (fs.existsSync(path.dirname(p))) {
        fs.writeFileSync(p, recipientsContent, 'utf-8');
      }
    });

    event.reply('save-recipients-response', { success: true });
  } catch (err) {
    console.error('수급자 파일 저장 실패:', err);
    event.reply('save-recipients-response', { success: false, error: err.message });
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});
