const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 [RFID_HUB] v1.8.0 빌드 및 dist 단일화 프로세스를 시작합니다...');

// 1. 실행 중인 프로세스 안전 종료
try {
  execSync('taskkill /F /IM RFID_HUB.exe /T 2>nul', { stdio: 'ignore' });
  execSync('taskkill /F /IM electron.exe /T 2>nul', { stdio: 'ignore' });
} catch (e) {}

// 2. 임시 빌드 디렉토리 설정 (외부 캐시 디렉토리)
const tmpBuildDir = path.join(process.env.USERPROFILE || 'C:\\Users\\ziziz', '.rfid_build_tmp');
if (fs.existsSync(tmpBuildDir)) {
  try {
    fs.rmSync(tmpBuildDir, { recursive: true, force: true });
  } catch (e) {}
}

// 3. electron-builder 실행
console.log('📦 포터블 EXE 패키징 중...');
try {
  execSync(`npx electron-builder --win portable -c.directories.output="${tmpBuildDir}"`, {
    cwd: __dirname,
    stdio: 'inherit'
  });

  // 4. 빌드 결과물을 dist 폴더로 이동
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const generatedExe = path.join(tmpBuildDir, 'RFID_HUB_v1.8.0.exe');
  const targetExe = path.join(distDir, 'RFID_HUB_v1.8.0.exe');

  if (fs.existsSync(generatedExe)) {
    fs.copyFileSync(generatedExe, targetExe);
    console.log(`✅ 성공: ${targetExe} 생성 완료!`);
  }

  // 4-1. dist 폴더에 루트 최신 recipients.js 항상 강제 동기화
  const distRecipients = path.join(distDir, 'recipients.js');
  const rootRecipients = path.join(__dirname, 'recipients.js');
  if (fs.existsSync(rootRecipients)) {
    fs.copyFileSync(rootRecipients, distRecipients);
    console.log(`✅ 루트 recipients.js 파일이 dist 폴더로 최신 동기화되었습니다.`);
  }

  // 5. 임시 빌드 폴더 정리
  try {
    fs.rmSync(tmpBuildDir, { recursive: true, force: true });
  } catch (e) {}

  console.log('✨ 모든 정리가 완료되었습니다. 오직 dist 폴더에만 결과물이 남았습니다.');
} catch (err) {
  console.error('❌ 빌드 중 오류 발생:', err.message);
  process.exit(1);
}
