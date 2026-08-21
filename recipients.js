/**
 * HTML 배포 및 화면 테스트 전용 가짜 수급자 데이터입니다.
 * 실제 수급자 정보는 이 파일에 입력하지 마세요.
 * 실제 데이터는 EXE 옆의 별도 recipients.js에서만 관리합니다.
 */

var INITIAL_RECIPIENTS_TIMESTAMP = 1787238000000;

function createFakeRecipient(config) {
  var totalTime = String(config.totalTime || "180");
  var isFamilyOnly = config.careMode === "가족요양";
  var isFamilyAndGeneral = config.careMode === "가족요양+일반요양";
  var isFamilyCare = isFamilyOnly || isFamilyAndGeneral;

  return {
    id: config.id,
    name: config.name,
    birth: config.birth,
    gender: config.gender,
    grade: config.grade,
    cert: config.cert,
    caregiver: config.caregiver,
    shift: config.shift,
    shiftType: config.shift,
    careMode: config.careMode,
    isFamilyCare: isFamilyCare,
    familyCareType: isFamilyCare ? String(config.familyCareType || "60") : "",
    hasGeneralCare: !isFamilyOnly,
    generalCaregiver: config.generalCaregiver || "",
    isDementia: false,
    template: {
      totalTime: totalTime,
      startTime: config.startTime,
      endTime: config.endTime,
      serviceMinutes: isFamilyOnly
        ? [totalTime, "0", "0", "0", "0", "0"]
        : ["60", "0", "0", "0", "30", String(Number(totalTime) - 90)],
      checkboxes: [true, false, true, false, true, true, true, true],
      subCheckboxes: [true, false, false, true, false, false, true, false, false, true, false, false, false],
      subOtherTexts: ["", "", ""],
      numBoxes: ["0", "0", "0"],
      feces: "0",
      urine: "0",
      note: config.careMode + " 테스트용 가상 수급자",
      weeklyCheckboxes: [false, false, false, false, false, false, false, false],
      weeklySubCheckboxes: [false, false, false, false, false, false, false, false, false, false, false, false, false],
      weeklyNumBoxes: [false, false, false]
    }
  };
}

var INITIAL_RECIPIENTS = [
  createFakeRecipient({
    id: "FAKE-001", name: "테스트수급자01", birth: "1940-01-01", gender: "여", grade: "3",
    cert: "FAKE-CERT-001", caregiver: "테스트요양보호사A", shift: "오전", careMode: "일반요양",
    totalTime: "180", startTime: "08:00", endTime: "11:00"
  }),
  createFakeRecipient({
    id: "FAKE-002", name: "테스트수급자02", birth: "1941-02-02", gender: "남", grade: "4",
    cert: "FAKE-CERT-002", caregiver: "테스트요양보호사B", shift: "오전", careMode: "일반요양",
    totalTime: "180", startTime: "08:30", endTime: "11:30"
  }),
  createFakeRecipient({
    id: "FAKE-003", name: "테스트수급자03", birth: "1942-03-03", gender: "여", grade: "2",
    cert: "FAKE-CERT-003", caregiver: "테스트요양보호사C", shift: "오전", careMode: "일반요양",
    totalTime: "180", startTime: "09:00", endTime: "12:00"
  }),
  createFakeRecipient({
    id: "FAKE-004", name: "테스트수급자04", birth: "1943-04-04", gender: "남", grade: "3",
    cert: "FAKE-CERT-004", caregiver: "테스트요양보호사D", shift: "오후", careMode: "일반요양",
    totalTime: "180", startTime: "13:00", endTime: "16:00"
  }),
  createFakeRecipient({
    id: "FAKE-005", name: "테스트수급자05", birth: "1944-05-05", gender: "여", grade: "4",
    cert: "FAKE-CERT-005", caregiver: "테스트요양보호사E", shift: "오후", careMode: "일반요양",
    totalTime: "180", startTime: "13:30", endTime: "16:30"
  }),
  createFakeRecipient({
    id: "FAKE-006", name: "테스트수급자06", birth: "1945-06-06", gender: "남", grade: "5",
    cert: "FAKE-CERT-006", caregiver: "테스트요양보호사F", shift: "오후", careMode: "일반요양",
    totalTime: "180", startTime: "14:00", endTime: "17:00"
  }),
  createFakeRecipient({
    id: "FAKE-007", name: "테스트수급자07", birth: "1946-07-07", gender: "여", grade: "3",
    cert: "FAKE-CERT-007", caregiver: "테스트가족보호자A", shift: "오전", careMode: "가족요양",
    familyCareType: "60", totalTime: "60", startTime: "07:00", endTime: "08:00"
  }),
  createFakeRecipient({
    id: "FAKE-008", name: "테스트수급자08", birth: "1947-08-08", gender: "남", grade: "4",
    cert: "FAKE-CERT-008", caregiver: "테스트가족보호자B", shift: "오후", careMode: "가족요양",
    familyCareType: "90", totalTime: "90", startTime: "18:00", endTime: "19:30"
  }),
  createFakeRecipient({
    id: "FAKE-009", name: "테스트수급자09", birth: "1948-09-09", gender: "여", grade: "2",
    cert: "FAKE-CERT-009", caregiver: "테스트가족보호자C", generalCaregiver: "테스트요양보호사G",
    shift: "오전", careMode: "가족요양+일반요양", familyCareType: "60",
    totalTime: "180", startTime: "09:30", endTime: "12:30"
  }),
  createFakeRecipient({
    id: "FAKE-010", name: "테스트수급자10", birth: "1949-10-10", gender: "남", grade: "3",
    cert: "FAKE-CERT-010", caregiver: "테스트가족보호자D", generalCaregiver: "테스트요양보호사H",
    shift: "오후", careMode: "가족요양+일반요양", familyCareType: "90",
    totalTime: "180", startTime: "15:00", endTime: "18:00"
  })
];

var INITIAL_CENTER_NAME = "가상 방문요양센터";
var INITIAL_CENTER_CODE = "0000000000";
