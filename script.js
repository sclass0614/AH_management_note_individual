// Supabase 클라이언트는 supabase.js에서 이미 초기화됨

// 전역 변수
let currentDate = new Date().toISOString().split('T')[0].replace(/-/g, ''); // 오늘 날짜 (YYYYMMDD 형식)
let individualWorkData = []; // management_note_individual 데이터
let originalData = null; // 기존 데이터 저장 (동시 편집 충돌 방지용)
let originalWorkContent = ''; // 처음 로드된 업무내용 (충돌 감지용)

// DOM 요소들
const datePicker = document.getElementById('datePicker');
const employeeNumberInput = document.getElementById('employeeNumber');
const employeeNameInput = document.getElementById('employeeName');
const contentTextarea = document.getElementById('contentTextarea');
const submitBtn = document.getElementById('submitBtn');

// 탭 요소들
const inputTab = document.getElementById('inputTab');
const historyTab = document.getElementById('historyTab');
const inputTabContent = document.getElementById('inputTabContent');
const historyTabContent = document.getElementById('historyTabContent');

// 과거 확인 요소들
const historyDatePicker = document.getElementById('historyDatePicker');
const historyContentTextarea = document.getElementById('historyContentTextarea');
const copyBtn = document.getElementById('copyBtn');

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== 페이지 로드 시작 ===');
    console.log('현재 URL:', window.location.href);
    console.log('페이지 제목:', document.title);
    
    initializePage();
    loadEmployeeNumberFromURL(); // URL에서 직원번호 로드
    setupPostMessageListener(); // PostMessage 리스너 설정
    
    console.log('=== 페이지 로드 완료 ===');
});

// 페이지 초기화
function initializePage() {
    // 한국 시간 기준 오늘 날짜로 date picker 설정 (YYYY-MM-DD 형식)
    const koreaTime = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
    const today = koreaTime.toISOString().split('T')[0];
    datePicker.value = today;
    
    // 현재 날짜 업데이트
    currentDate = today.replace(/-/g, '');
    
    // 이벤트 리스너 등록
    setupEventListeners();
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 날짜 변경 시
    datePicker.addEventListener('change', function() {
        // YYYY-MM-DD 형식을 YYYYMMDD 형식으로 변환
        currentDate = this.value.replace(/-/g, '');
        // 날짜가 변경되면 데이터를 새로 가져오기
        loadIndividualWorkData();
    });
    
    // 입력 버튼
    submitBtn.addEventListener('click', submitData);
    
    // 탭 버튼 이벤트
    inputTab.addEventListener('click', function() {
        switchTab('input');
    });
    
    historyTab.addEventListener('click', function() {
        switchTab('history');
    });
    
    // 과거 확인 날짜 변경 시
    historyDatePicker.addEventListener('change', function() {
        loadHistoryData();
    });
    
    // 복사 버튼
    copyBtn.addEventListener('click', function() {
        copyToClipboard();
    });
    
    // textarea 입력 시 높이 자동 조정
    contentTextarea.addEventListener('input', function() {
        adjustTextareaHeight();
    });
    
    // 과거 확인 textarea는 읽기 전용이므로 input 이벤트가 없지만, 
    // 내용이 변경될 때마다 높이를 조정하도록 함
}

// Supabase에서 개인업무 데이터 로드
async function loadIndividualWorkData() {
    try {
        console.log('개인업무 데이터 로딩 시작...');
        console.log('현재 날짜 (YYYYMMDD):', currentDate);
        console.log('현재 직원번호:', employeeNumberInput.value);
        
        // 직원번호가 있는 경우에만 해당 직원의 데이터 로드
        if (employeeNumberInput.value.trim()) {
        const { data: individualData, error: individualError } = await supabase
            .from('management_note_individual')
            .select('*')
                .eq('날짜', currentDate)
                .eq('직원번호', employeeNumberInput.value.trim());
        
        if (individualError) {
            console.error('management_note_individual 로드 에러:', individualError);
            return;
        }
        
        individualWorkData = individualData || [];
        console.log('management_note_individual 데이터:', individualWorkData);
        
                        // 데이터가 있으면 첫 번째 데이터의 업무내용을 textarea에 로드
            if (individualWorkData.length > 0) {
                const firstData = individualWorkData[0];
                contentTextarea.value = firstData.업무내용 || '';
                contentTextarea.dataset.existingId = firstData.id;
                
                // 원본 데이터 저장 (동시 편집 충돌 방지용)
                originalData = {
                    id: firstData.id,
                    직원번호: firstData.직원번호 || '',
                    직원명: firstData.직원명 || '',
                    업무내용: firstData.업무내용 || ''
                };
                
                // 처음 로드된 업무내용 저장 (충돌 감지용)
                originalWorkContent = firstData.업무내용 || '';
            } else {
                // 데이터가 없으면 빈칸으로 설정
                contentTextarea.value = '';
                contentTextarea.dataset.existingId = '';
                originalData = null;
                originalWorkContent = '';
            }
    
    // textarea 높이 자동 조정
    adjustTextareaHeight();
        }
        
    } catch (error) {
        console.error('데이터 로드 중 예외 발생:', error);
    }
}

// 데이터 입력 처리
async function submitData() {
    // 입력값 검증
    const employeeNumber = employeeNumberInput.value.trim();
    const employeeName = employeeNameInput.value.trim();
    const workContent = contentTextarea.value.trim();
    const existingId = contentTextarea.dataset.existingId;
    
    if (!employeeNumber || !employeeName || !workContent) {
        await customAlert('직원번호, 직원명, 업무내용을 모두 입력해주세요.', '입력 확인');
        return;
    }
    
    try {
        let result;
        
        // 데이터 입력 전에 항상 충돌 검사 수행
        console.log('충돌 검사 시작...');
        console.log('현재 직원번호:', employeeNumber);
        console.log('현재 날짜:', currentDate);
        console.log('원본 업무내용:', originalWorkContent);
        
        // 서버에서 현재 직원번호와 날짜로 최신 데이터 조회
        const { data: currentServerData, error: conflictCheckError } = await supabase
            .from('management_note_individual')
            .select('*')
            .eq('직원번호', employeeNumber)
            .eq('날짜', currentDate);
        
        if (conflictCheckError) {
            console.error('충돌 검사 중 에러:', conflictCheckError);
            await customAlert('충돌 검사 중 오류가 발생했습니다.', '오류');
            return;
        }
        
        console.log('서버 최신 데이터:', currentServerData);
        
        // 서버에 데이터가 있고, 원본과 다른 경우 충돌 감지
        if (currentServerData && currentServerData.length > 0) {
            const serverWorkContent = currentServerData[0].업무내용 || '';
            console.log('서버 업무내용:', serverWorkContent);
            
            if (serverWorkContent !== originalWorkContent) {
                console.log('충돌 감지! 다른 사용자가 수정함');
                // 충돌 감지 - 모달 표시
                showConflictModal(currentServerData[0]);
                return;
            }
        }
        
        if (existingId) {
            // 기존 데이터가 있으면 업데이트
            
            // 충돌이 없으면 업데이트 진행
            const { data, error } = await supabase
                .from('management_note_individual')
                .update({
                    직원번호: employeeNumber,
                    직원명: employeeName,
                    업무내용: workContent
                })
                .eq('id', existingId);
            
            if (error) {
                console.error('데이터 업데이트 에러:', error);
                await customAlert('데이터 업데이트 중 오류가 발생했습니다.', '오류');
                return;
            }
            
            result = data;
            console.log('데이터 업데이트 성공:', result);
        } else {
            // 새 데이터 삽입
            console.log('새 데이터 삽입');
            const { data, error } = await supabase
                .from('management_note_individual')
                .insert([
                    {
                        직원번호: employeeNumber,
                        직원명: employeeName,
                        날짜: currentDate, // YYYYMMDD 형식
                        업무내용: workContent
                    }
                ]);
            
            if (error) {
                console.error('데이터 입력 에러:', error);
                await customAlert('데이터 입력 중 오류가 발생했습니다.', '오류');
                return;
            }
            
            result = data;
            console.log('데이터 입력 성공:', result);
        }
        
        // 입력 폼 초기화
        clearForm();
        
        // 개인업무 데이터 다시 로드
        await loadIndividualWorkData();
        
        await customAlert(
            existingId ? '업무내용이 성공적으로 업데이트되었습니다.' : '업무내용이 성공적으로 입력되었습니다.',
            '완료'
        );
        
    } catch (error) {
        console.error('데이터 처리 중 예외 발생:', error);
        await customAlert('데이터 처리 중 오류가 발생했습니다.', '오류');
    }
}

// textarea 높이 자동 조정 함수
function adjustTextareaHeight() {
    const textarea = contentTextarea;
    textarea.style.height = 'auto';
    const newHeight = Math.max(textarea.scrollHeight, 120); // 최소 높이 120px
    textarea.style.height = newHeight + 'px';
}

// 충돌 모달 표시 함수
function showConflictModal(serverData) {
    const modalHtml = `
        <div id="conflictModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>⚠️ 동시 편집 충돌 감지</h3>
                </div>
                <div class="modal-body">
                    <p>다른 사용자가 동시에 이 내용을 수정했습니다.</p>
                    <div class="conflict-info">
                        <h4>서버의 최신 데이터:</h4>
                        <div class="info-item">
                            <strong>직원번호:</strong> ${serverData.직원번호 || '없음'}
                        </div>
                        <div class="info-item">
                            <strong>직원명:</strong> ${serverData.직원명 || '없음'}
                        </div>
                                                 <div class="info-item">
                            <strong>업무내용:</strong>
                            <div class="content-preview">${serverData.업무내용 ? serverData.업무내용.replace(/\n/g, '\n') : '없음'}</div>
                         </div>
                    </div>
                    <p class="warning-text">계속 진행하시겠습니까? 현재 입력한 내용으로 덮어쓰게 됩니다.</p>
                </div>
                <div class="modal-footer">
                    <button id="continueBtn" class="btn-primary">계속 진행</button>
                    <button id="cancelBtn" class="btn-secondary">취소</button>
                </div>
            </div>
        </div>
    `;
    
    // 모달을 body에 추가
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // 모달 이벤트 리스너
    document.getElementById('continueBtn').addEventListener('click', async function() {
        // 사용자가 계속 진행을 선택한 경우 강제 업데이트
        await forceUpdate();
        closeConflictModal();
    });
    
    document.getElementById('cancelBtn').addEventListener('click', function() {
        closeConflictModal();
    });
    
    // 모달 외부 클릭 시 닫기
    document.getElementById('conflictModal').addEventListener('click', function(e) {
        if (e.target.id === 'conflictModal') {
            closeConflictModal();
        }
    });
}

// 강제 업데이트 함수
async function forceUpdate() {
    const employeeNumber = employeeNumberInput.value.trim();
    const employeeName = employeeNameInput.value.trim();
    const workContent = contentTextarea.value.trim();
    const existingId = contentTextarea.dataset.existingId;
    
    try {
        const { data, error } = await supabase
            .from('management_note_individual')
            .update({
                직원번호: employeeNumber,
                직원명: employeeName,
                업무내용: workContent
            })
            .eq('id', existingId);
        
        if (error) {
            console.error('강제 업데이트 에러:', error);
            await customAlert('데이터 업데이트 중 오류가 발생했습니다.', '오류');
            return;
        }
        
        console.log('강제 업데이트 성공:', data);
        
        // 원본 업무내용을 현재 입력한 내용으로 업데이트
        originalWorkContent = workContent;
        
        // 개인업무 데이터 다시 로드
        await loadIndividualWorkData();
        
        await customAlert('업무내용이 성공적으로 업데이트되었습니다.', '완료');
        
    } catch (error) {
        console.error('강제 업데이트 중 예외 발생:', error);
        await customAlert('데이터 업데이트 중 오류가 발생했습니다.', '오류');
    }
}

// 충돌 모달 닫기 함수
function closeConflictModal() {
    const modal = document.getElementById('conflictModal');
    if (modal) {
        modal.remove();
    }
}

// 입력 폼 초기화
function clearForm() {
    contentTextarea.value = '';
    // 기존 데이터 ID 초기화
    contentTextarea.dataset.existingId = '';
    // 원본 데이터 초기화
    originalData = null;
    // 원본 업무내용 초기화
    originalWorkContent = '';
    // textarea 높이 초기화
    contentTextarea.style.height = 'auto';
}

// 유틸리티 함수: 날짜 포맷팅
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// 유틸리티 함수: 현재 시간 가져오기
function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// 디버깅용 로그 함수
function logData() {
    console.log('현재 날짜 (YYYYMMDD):', currentDate);
    console.log('management_note_individual 데이터:', individualWorkData);
}

// 탭 전환 함수
function switchTab(tabName) {
    // 모든 탭 버튼과 콘텐츠의 active 클래스 제거
    inputTab.classList.remove('active');
    historyTab.classList.remove('active');
    inputTabContent.classList.remove('active');
    historyTabContent.classList.remove('active');
    
    // 선택된 탭 활성화
    if (tabName === 'input') {
        inputTab.classList.add('active');
        inputTabContent.classList.add('active');
    } else if (tabName === 'history') {
        historyTab.classList.add('active');
        historyTabContent.classList.add('active');
    }
}

// 과거 데이터 로드 함수
async function loadHistoryData() {
    try {
        const historyDate = historyDatePicker.value.replace(/-/g, '');
        const employeeNumber = employeeNumberInput.value.trim();
        
        console.log('과거 데이터 로딩 시작...');
        console.log('조회 날짜:', historyDate);
        console.log('직원번호:', employeeNumber);
        
        if (!employeeNumber || !historyDate) {
            historyContentTextarea.value = '';
            return;
        }
        
        // 해당 날짜와 직원번호의 데이터 조회
        const { data: historyData, error: historyError } = await supabase
            .from('management_note_individual')
            .select('*')
            .eq('날짜', historyDate)
            .eq('직원번호', employeeNumber);
        
        if (historyError) {
            console.error('과거 데이터 로드 에러:', historyError);
            historyContentTextarea.value = '데이터를 불러오는 중 오류가 발생했습니다.';
            return;
        }
        
        console.log('과거 데이터:', historyData);
        
        if (historyData && historyData.length > 0) {
            // 데이터가 있으면 첫 번째 데이터의 업무내용을 표시
            historyContentTextarea.value = historyData[0].업무내용 || '';
        } else {
            // 데이터가 없으면 빈칸으로 설정
            historyContentTextarea.value = '해당 날짜에 등록된 업무내용이 없습니다.';
        }
        
        // textarea 높이 자동 조정
        adjustHistoryTextareaHeight();
        
    } catch (error) {
        console.error('과거 데이터 로드 중 예외 발생:', error);
        historyContentTextarea.value = '데이터를 불러오는 중 오류가 발생했습니다.';
    }
}

// 과거 데이터 textarea 높이 자동 조정 함수
function adjustHistoryTextareaHeight() {
    const textarea = historyContentTextarea;
    textarea.style.height = 'auto';
    const newHeight = Math.max(textarea.scrollHeight, 120); // 최소 높이 120px
    textarea.style.height = newHeight + 'px';
}

// 클립보드에 복사 함수
async function copyToClipboard() {
    try {
        const content = historyContentTextarea.value;
        if (!content || content === '해당 날짜에 등록된 업무내용이 없습니다.' || content === '데이터를 불러오는 중 오류가 발생했습니다.') {
            await customAlert('복사할 내용이 없습니다.', '알림');
            return;
        }
        
        await navigator.clipboard.writeText(content);
        await customAlert('내용이 클립보드에 복사되었습니다.', '복사 완료');
    } catch (error) {
        console.error('클립보드 복사 실패:', error);
        // 대안 방법 시도
        try {
            historyContentTextarea.select();
            document.execCommand('copy');
            await customAlert('내용이 클립보드에 복사되었습니다.', '복사 완료');
        } catch (fallbackError) {
            console.error('대안 복사 방법도 실패:', fallbackError);
            await customAlert('복사에 실패했습니다. 직접 드래그하여 복사해주세요.', '오류');
        }
    }
}

// 전역 함수로 노출 (디버깅용)
window.logData = logData;
window.loadIndividualWorkData = loadIndividualWorkData;

// 커스텀 Alert 함수
function customAlert(message, title = '알림') {
    return new Promise((resolve) => {
        const modalHtml = `
            <div class="custom-modal">
                <div class="custom-modal-content">
                    <div class="custom-modal-header">
                        <h3>${title}</h3>
                    </div>
                    <div class="custom-modal-body">
                        <p>${message}</p>
                    </div>
                    <div class="custom-modal-footer">
                        <button class="custom-btn custom-btn-primary" id="customAlertOk">확인</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modal = document.querySelector('.custom-modal');
        const okBtn = document.getElementById('customAlertOk');
        
        const closeModal = () => {
            modal.remove();
            resolve();
        };
        
        okBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // Enter 키로 확인
        const handleKeyPress = (e) => {
            if (e.key === 'Enter') {
                closeModal();
                document.removeEventListener('keydown', handleKeyPress);
            }
        };
        document.addEventListener('keydown', handleKeyPress);
    });
}

// 커스텀 Confirm 함수
function customConfirm(message, title = '확인') {
    return new Promise((resolve) => {
        const modalHtml = `
            <div class="custom-modal">
                <div class="custom-modal-content">
                    <div class="custom-modal-header">
                        <h3>${title}</h3>
                    </div>
                    <div class="custom-modal-body">
                        <p>${message}</p>
                    </div>
                    <div class="custom-modal-footer">
                        <button class="custom-btn custom-btn-secondary" id="customConfirmCancel">취소</button>
                        <button class="custom-btn custom-btn-primary" id="customConfirmOk">확인</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modal = document.querySelector('.custom-modal');
        const okBtn = document.getElementById('customConfirmOk');
        const cancelBtn = document.getElementById('customConfirmCancel');
        
        const closeModal = (result) => {
            modal.remove();
            resolve(result);
        };
        
        okBtn.addEventListener('click', () => closeModal(true));
        cancelBtn.addEventListener('click', () => closeModal(false));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(false);
        });
        
        // Enter 키로 확인, Escape 키로 취소
        const handleKeyPress = (e) => {
            if (e.key === 'Enter') {
                closeModal(true);
                document.removeEventListener('keydown', handleKeyPress);
            } else if (e.key === 'Escape') {
                closeModal(false);
                document.removeEventListener('keydown', handleKeyPress);
            }
        };
        document.addEventListener('keydown', handleKeyPress);
    });
}

// 기존 alert/confirm을 커스텀 버전으로 교체
window.alert = customAlert;
window.confirm = customConfirm;

// 직원번호 가져오기 (모든 방법 지원)
function loadEmployeeNumberFromURL() {
    console.log('=== 직원번호 로드 시작 ===');
    let employeeNumber = null;
    let urlHasEmployeeNumber = false;
    
    // 1. URL 파라미터에서 확인 (empNo 파라미터)
    const urlParams = new URLSearchParams(window.location.search);
    const empNoFromURL = urlParams.get('empNo');
    const employeeNumberFromURL = urlParams.get('employeeNumber');
    employeeNumber = empNoFromURL || employeeNumberFromURL;
    
    // URL에서 직원번호를 가져왔는지 확인
    if (empNoFromURL || employeeNumberFromURL) {
        urlHasEmployeeNumber = true;
    }
    
    console.log('URL 파라미터 확인:');
    console.log('- empNo:', empNoFromURL);
    console.log('- employeeNumber:', employeeNumberFromURL);
    console.log('- 최종 URL 결과:', employeeNumber);
    console.log('- URL에서 직원번호 가져옴:', urlHasEmployeeNumber);
    
    // 2. sessionStorage에서 확인
    if (!employeeNumber) {
        const empNoFromSession = sessionStorage.getItem('empNo');
        const currentUserFromSession = sessionStorage.getItem('currentUser');
        const userInfoFromSession = sessionStorage.getItem('userInfo');
        
        employeeNumber = empNoFromSession || currentUserFromSession || userInfoFromSession;
        
        console.log('sessionStorage 확인:');
        console.log('- empNo:', empNoFromSession);
        console.log('- currentUser:', currentUserFromSession);
        console.log('- userInfo:', userInfoFromSession);
        console.log('- 최종 sessionStorage 결과:', employeeNumber);
    }
    
    // 3. localStorage에서 확인
    if (!employeeNumber) {
        const employeeNumberFromLocal = localStorage.getItem('employeeNumber');
        employeeNumber = employeeNumberFromLocal;
        
        console.log('localStorage 확인:');
        console.log('- employeeNumber:', employeeNumberFromLocal);
        console.log('- 최종 localStorage 결과:', employeeNumber);
    }
    
    // 4. userInfo 요소에서 확인
    if (!employeeNumber) {
        const userInfoElement = document.getElementById('userInfo');
        console.log('userInfo 요소 확인:');
        console.log('- userInfo 요소 존재:', !!userInfoElement);
        
        if (userInfoElement) {
            const userInfoText = userInfoElement.textContent;
            console.log('- userInfo 텍스트:', userInfoText);
            
            const match = userInfoText.match(/([A-Za-z0-9]+)\s*님/);
            console.log('- 정규식 매치 결과:', match);
            
            employeeNumber = match ? match[1].toLowerCase() : null;
            console.log('- userInfo에서 추출한 직원번호:', employeeNumber);
        }
    }
    
    console.log('=== 최종 직원번호 결과:', employeeNumber, '===');
    
    if (employeeNumber) {
        // 직원번호 입력필드에 설정
        employeeNumberInput.value = employeeNumber;
        console.log('직원번호 입력필드에 설정됨:', employeeNumberInput.value);
        
        // 직원번호가 있으면 직원명도 자동으로 가져오기
        loadEmployeeName(employeeNumber);
        
        // URL에서 직원번호를 가져왔다면 URL 정리 (보안)
        if (urlHasEmployeeNumber) {
            cleanURLFromEmployeeNumber();
        }
        
        console.log('직원번호 자동 설정 완료:', employeeNumber);
    } else {
        console.log('❌ 직원번호를 찾을 수 없습니다!');
        console.log('현재 URL:', window.location.href);
        console.log('현재 페이지 제목:', document.title);
    }
}

// URL에서 직원번호 파라미터 제거 (보안)
function cleanURLFromEmployeeNumber() {
    try {
        const currentURL = new URL(window.location.href);
        const searchParams = currentURL.searchParams;
        
        // 직원번호 관련 파라미터 제거
        searchParams.delete('empNo');
        searchParams.delete('employeeNumber');
        
        // 새로운 URL 생성
        const newURL = currentURL.origin + currentURL.pathname;
        const newSearchParams = searchParams.toString();
        const finalURL = newSearchParams ? `${newURL}?${newSearchParams}` : newURL;
        
        // 브라우저 히스토리 업데이트 (페이지 새로고침 없이)
        window.history.replaceState({}, document.title, finalURL);
        
        console.log('URL에서 직원번호 파라미터 제거 완료');
        console.log('새로운 URL:', finalURL);
    } catch (error) {
        console.log('URL 정리 중 오류:', error);
    }
}

// 직원번호로 직원명 가져오기 (선택사항)
async function loadEmployeeName(employeeNumber) {
    console.log('=== 직원명 로드 시작 ===');
    console.log('조회할 직원번호:', employeeNumber);
    
    try {
        // 먼저 테이블 구조와 데이터 확인
        console.log('테이블 구조 확인 중...');
        const { data: sampleData, error: sampleError } = await supabase
            .from('employeesinfo')
            .select('*')
            .limit(5);
        
        console.log('샘플 데이터:', sampleData);
        console.log('샘플 에러:', sampleError);
        
        if (sampleData && sampleData.length > 0) {
            console.log('테이블 컬럼명:', Object.keys(sampleData[0]));
            console.log('첫 번째 행:', sampleData[0]);
        }
        
        // 방법 1: 모든 데이터를 가져와서 클라이언트에서 필터링
        console.log('전체 직원 데이터 조회 중...');
        const { data: allEmployees, error } = await supabase
            .from('employeesinfo')
            .select('*');
        
        console.log('전체 직원 데이터:', allEmployees);
        console.log('조회 에러:', error);
        
        if (allEmployees && !error) {
            console.log('전체 직원 수:', allEmployees.length);
            
            // 대소문자 구분 없이 직원번호 매칭 (상세 디버깅)
            console.log('매칭 과정 상세:');
            console.log('검색할 직원번호:', `"${employeeNumber}"`);
            console.log('검색할 직원번호 길이:', employeeNumber.length);
            console.log('검색할 직원번호 charCode:', Array.from(employeeNumber).map(c => c.charCodeAt(0)));
            
            const matchedEmployee = allEmployees.find(emp => {
                if (!emp.직원번호) return false;
                
                const serverEmpNo = emp.직원번호;
                const searchEmpNo = employeeNumber;
                
                console.log(`비교: "${serverEmpNo}" vs "${searchEmpNo}"`);
                console.log(`길이: ${serverEmpNo.length} vs ${searchEmpNo.length}`);
                console.log(`소문자 변환: "${serverEmpNo.toLowerCase()}" vs "${searchEmpNo.toLowerCase()}"`);
                
                // 방법 1: toLowerCase() 비교
                const lowerMatch = serverEmpNo.toLowerCase() === searchEmpNo.toLowerCase();
                console.log(`소문자 매칭 결과: ${lowerMatch}`);
                
                // 방법 2: 정확한 문자열 비교
                const exactMatch = serverEmpNo === searchEmpNo;
                console.log(`정확한 매칭 결과: ${exactMatch}`);
                
                // 방법 3: 대문자로 변환해서 비교
                const upperMatch = serverEmpNo.toUpperCase() === searchEmpNo.toUpperCase();
                console.log(`대문자 매칭 결과: ${upperMatch}`);
                
                // 방법 4: 정규식으로 대소문자 무시 비교
                const regexMatch = new RegExp(`^${searchEmpNo}$`, 'i').test(serverEmpNo);
                console.log(`정규식 매칭 결과: ${regexMatch}`);
                
                return lowerMatch || exactMatch || upperMatch || regexMatch;
            });
            
            console.log('매칭된 직원:', matchedEmployee);
            
            if (matchedEmployee) {
                employeeNameInput.value = matchedEmployee.직원명 || '';
                console.log('직원명 설정 완료:', employeeNameInput.value);
                
                // 직원명이 설정되면 해당 직원의 오늘 데이터를 로드
                await loadIndividualWorkData();
            } else {
                console.log('해당 직원번호를 찾을 수 없음');
                console.log('검색한 직원번호:', employeeNumber);
                console.log('서버의 직원번호들:', allEmployees.map(emp => emp.직원번호));
                
                // 방법 2: 대안으로 ilike 사용 (대소문자 무시)
                console.log('ilike로 재시도 중...');
                const { data: ilikeResult, error: ilikeError } = await supabase
                    .from('employeesinfo')
                    .select('*')
                    .ilike('직원번호', employeeNumber);
                
                console.log('ilike 결과:', ilikeResult);
                console.log('ilike 에러:', ilikeError);
                
                if (ilikeResult && ilikeResult.length > 0) {
                    employeeNameInput.value = ilikeResult[0].직원명 || '';
                    console.log('ilike로 직원명 설정 완료:', employeeNameInput.value);
                    
                    // 직원명이 설정되면 해당 직원의 오늘 데이터를 로드
                    await loadIndividualWorkData();
                }
            }
        } else {
            console.log('직원 데이터 조회 실패');
            if (error) {
                console.log('에러 상세:', error);
            }
        }
    } catch (error) {
        console.log('직원명 로드 실패:', error);
        console.log('에러 상세:', error.message);
    }
    
    console.log('=== 직원명 로드 완료 ===');
}

// PostMessage 통신 설정
function setupPostMessageListener() {
    console.log('=== PostMessage 리스너 설정 시작 ===');
    
    // PostMessage로 직원번호 요청
    window.addEventListener('message', function(event) {
        console.log('PostMessage 수신:', event.data);
        
        if (event.data && event.data.type === 'requestUserInfo') {
            console.log('직원번호 요청 메시지 수신');
            const currentUserEmpNo = getCurrentEmployeeNumber();
            console.log('현재 직원번호:', currentUserEmpNo);
            
            if (currentUserEmpNo) {
                event.source.postMessage({
                    type: 'userInfo',
                    userId: currentUserEmpNo,
                    empNo: currentUserEmpNo,
                    user: currentUserEmpNo
                }, '*');
                console.log('PostMessage로 직원번호 전송:', currentUserEmpNo);
            }
        } else if (event.data && event.data.type === 'userInfo') {
            console.log('직원번호 정보 수신:', event.data);
            if (event.data.empNo) {
                console.log('PostMessage로 받은 직원번호:', event.data.empNo);
                employeeNumberInput.value = event.data.empNo;
                loadEmployeeName(event.data.empNo);
            }
        }
    });
    
    // 부모 창에 직원번호 요청
    if (window.opener) {
        console.log('부모 창 존재, 직원번호 요청 전송');
        window.opener.postMessage({ type: 'requestUserInfo' }, '*');
    } else {
        console.log('부모 창 없음 (window.opener가 null)');
    }
    
    console.log('=== PostMessage 리스너 설정 완료 ===');
}

// 현재 직원번호 가져오기
function getCurrentEmployeeNumber() {
    // 1. 입력필드에서 확인
    if (employeeNumberInput.value) {
        return employeeNumberInput.value;
    }
    
    // 2. sessionStorage에서 확인
    let employeeNumber = sessionStorage.getItem('empNo') || 
                        sessionStorage.getItem('currentUser') || 
                        sessionStorage.getItem('userInfo');
    
    // 3. localStorage에서 확인
    if (!employeeNumber) {
        employeeNumber = localStorage.getItem('employeeNumber');
    }
    
    // 4. userInfo 요소에서 확인
    if (!employeeNumber) {
        const userInfoElement = document.getElementById('userInfo');
        if (userInfoElement) {
            const userInfoText = userInfoElement.textContent;
            const match = userInfoText.match(/([A-Za-z0-9]+)\s*님/);
            employeeNumber = match ? match[1].toLowerCase() : null;
        }
    }
    
    return employeeNumber;
}
