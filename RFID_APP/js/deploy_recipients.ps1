# 한글 출력 및 인코딩 설정
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  🚚 수급자 데이터 자동 업로드를 시작합니다! (PowerShell 엔진)" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Downloads 및 카카오톡 받은 파일 폴더 경로 찾기
$downDir = [System.IO.Path]::Combine([System.Environment]::GetFolderPath('UserProfile'), 'Downloads')
$kakaoDir = [System.IO.Path]::Combine([System.Environment]::GetFolderPath('MyDocuments'), '카카오톡 받은 파일')
$targetDir = $PSScriptRoot

# 2. 두 폴더에서 'recipients*.js' 검색 및 병합
$files = @()
if (Test-Path $downDir) {
    $files += Get-ChildItem -Path $downDir -Filter "recipients*.js" -ErrorAction SilentlyContinue
}
if (Test-Path $kakaoDir) {
    $files += Get-ChildItem -Path $kakaoDir -Filter "recipients*.js" -ErrorAction SilentlyContinue
}

if ($files.Count -gt 0) {
    # 최신순 정렬 후 최신 파일 1개 선택
    $files = $files | Sort-Object LastWriteTime -Descending
    $latestFile = $files[0]
    $destPath = [System.IO.Path]::Combine($targetDir, 'recipients.js')
    
    # 3. 파일 복사 (덮어쓰기)
    Copy-Item -Path $latestFile.FullName -Destination $destPath -Force
    
    # 🌟 상위 폴더에 수기 급여제공기록지가 존재할 경우, 양쪽 연동을 위해 종이형 폴더에도 동시 업로드!
    $linkedPaperPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($targetDir, '..', '..', '수기 급여제공기록지', 'js', 'recipients.js'))
    if (Test-Path $linkedPaperPath) {
        Copy-Item -Path $latestFile.FullName -Destination $linkedPaperPath -Force
        Write-Host "   💡 수기 급여제공기록지폴더에도 동시에 자동 동기화 업로드를 완료했습니다!" -ForegroundColor Green
    }
    
    Write-Host "===================================================" -ForegroundColor Green
    Write-Host "  🎉 [업로드 완료!] 최신 수급자 정보가 안전하게 반영되었습니다!" -ForegroundColor Green
    Write-Host "===================================================" -ForegroundColor Green
    Write-Host "   업로드된 파일명: $($latestFile.Name)"
    Write-Host "   다운로드 경로: $($latestFile.DirectoryName)"
    Write-Host "   반영 방법: 인터넷 화면을 새로고침(F5) 해주세요."
    Write-Host ""
    
    # 4. 다운로드 폴더 안의 recipients 관련 임시 파일들 정리
    foreach ($f in $files) {
        Remove-Item $f.FullName -ErrorAction SilentlyContinue
    }
}
else {
    Write-Host "===================================================" -ForegroundColor Red
    Write-Host "  ❌ [오류] 업로드할 파일이 다운로드 또는 카카오톡 받은 파일 폴더에 없습니다!" -ForegroundColor Red
    Write-Host "===================================================" -ForegroundColor Red
    Write-Host "   감시 경로 1 (다운로드): $downDir"
    Write-Host "   감시 경로 2 (카카오톡): $kakaoDir"
    Write-Host "   해결 방법: 인터넷 창([관리자] 수급자 등록 및 변경하기.html) 또는 메일/카카오톡에서"
    Write-Host "             받은 수급자 명단 파일을 위 두 폴더 중 하나에 넣어주신 후 이 프로그램을 실행해주세요!"
    Write-Host ""
}

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  아무 키나 누르면 이 창이 닫힙니다."
Write-Host "===================================================" -ForegroundColor Cyan
Read-Host
