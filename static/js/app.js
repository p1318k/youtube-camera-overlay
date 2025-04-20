/**
 * YouTube 카메라 오버레이 애플리케이션
 * 순수 프론트엔드로 구현된 버전
 */

// 전역 변수
let youtubePlayer = null;       // 미리보기 YouTube 플레이어
let outputYoutubePlayer = null; // 출력 YouTube 플레이어
let cameraStream = null;
let cameraVideo = null;
let outputCanvas = null;
let outputCtx = null;
let personOverlayCanvas = null; // 인물 오버레이 캔버스
let personOverlayCtx = null;
let cameraCanvas = null;        // 카메라 캡처용 캔버스 (재사용)
let cameraCtx = null;           // 카메라 캡처용 컨텍스트
let personSegmenter = null;
let isProcessing = false;
let processingInterval = null;
let opacityValue = 1.0;
let selectedVideoId = '';       // 현재 선택된 비디오 ID

// YouTube IFrame API 콜백을 전역에 노출 (모듈 내에서는 전역 함수가 되지 않음)
window.onYouTubeIframeAPIReady = function() {
    console.log("YouTube API 로드 완료");
    
    // 미리보기 YouTube 플레이어 생성
    youtubePlayer = new YT.Player('youtube-player', {
        width: '100%',
        height: '100%',
        videoId: '',
        playerVars: {
            'autoplay': 0,
            'controls': 1,
            'rel': 0,
            'showinfo': 0,
            'modestbranding': 1,
            'iv_load_policy': 3
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
    
    // 출력 YouTube 플레이어 생성
    outputYoutubePlayer = new YT.Player('output-youtube-player', {
        width: '100%',
        height: '100%',
        videoId: '',
        playerVars: {
            'autoplay': 0,
            'controls': 0,  // 컨트롤 숨김
            'rel': 0,
            'showinfo': 0,
            'modestbranding': 1,
            'iv_load_policy': 3,
            'disablekb': 1,  // 키보드 제어 비활성화
            'fs': 0          // 전체 화면 버튼 숨김
        },
        events: {
            'onReady': onOutputPlayerReady,
            'onStateChange': onOutputPlayerStateChange,
            'onError': onOutputPlayerError
        }
    });
};

// YouTube 미리보기 플레이어 준비 완료
function onPlayerReady(event) {
    console.log("YouTube 미리보기 플레이어 준비 완료");
}

// YouTube 출력 플레이어 준비 완료
function onOutputPlayerReady(event) {
    console.log("YouTube 출력 플레이어 준비 완료");
    
    // 인물 오버레이 캔버스 초기화
    personOverlayCanvas = document.getElementById('person-overlay');
    personOverlayCanvas.width = 640;
    personOverlayCanvas.height = 360;
    personOverlayCtx = personOverlayCanvas.getContext('2d');
}

// YouTube 플레이어 상태 변경 (미리보기 플레이어용)
function onPlayerStateChange(event) {
    // 미리보기 플레이어 상태가 변경될 때 출력 플레이어와 동기화
    if (event.data === YT.PlayerState.PLAYING) {
        // 미리보기 플레이어가 재생될 때 출력 플레이어도 재생
        if (outputYoutubePlayer && outputYoutubePlayer.playVideo) {
            // 현재 시간으로 동기화
            const currentTime = youtubePlayer.getCurrentTime();
            outputYoutubePlayer.seekTo(currentTime);
            outputYoutubePlayer.playVideo();
        }
    } else if (event.data === YT.PlayerState.PAUSED) {
        // 미리보기 플레이어가 일시정지될 때 출력 플레이어도 일시정지
        if (outputYoutubePlayer && outputYoutubePlayer.pauseVideo) {
            outputYoutubePlayer.pauseVideo();
        }
    }
}

// YouTube 출력 플레이어 상태 변경
function onOutputPlayerStateChange(event) {
    console.log("출력 플레이어 상태 변경:", event.data);
}

// YouTube 출력 플레이어 오류 처리
function onOutputPlayerError(event) {
    console.error("출력 플레이어 오류:", event.data);
}

// 애플리케이션 초기화
async function initializeApp() {
    // 요소 참조 가져오기
    cameraVideo = document.getElementById('camera-video');
    outputCanvas = document.getElementById('output-canvas');
    outputCtx = outputCanvas.getContext('2d');
    
    // 캔버스 크기 설정
    outputCanvas.width = 640;
    outputCanvas.height = 360;
    
    // 인물 분리 모듈 초기화
    personSegmenter = new PersonSegmenter();
    await personSegmenter.initialize();
    
    // 카메라 캡처용 캔버스 초기화
    cameraCanvas = document.createElement('canvas');
    cameraCtx = cameraCanvas.getContext('2d');
    
    // 이벤트 리스너 설정
    setupEventListeners();
    
    // 페이지 로딩 시 자동으로 카메라 접근 권한 요청 및 카메라 프리뷰 시작
    try {
        console.log("카메라 자동 시작 시도 중...");
        const cameraStarted = await startCamera();
        if (cameraStarted) {
            console.log("카메라 자동 시작 성공");
            document.getElementById('camera-status').innerText = "카메라가 활성화되었습니다";
            setTimeout(() => {
                document.getElementById('camera-status').classList.add('hidden');
            }, 2000); // 2초 후 상태 메시지 숨김
        } else {
            console.warn("카메라 자동 시작 실패");
        }
    } catch (error) {
        console.error("카메라 자동 시작 중 오류 발생:", error);
        document.getElementById('camera-status').innerText = "카메라 시작 중 오류: " + error.message;
        document.getElementById('camera-status').classList.remove('hidden');
    }
    
    console.log("애플리케이션 초기화 완료");
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 버튼 참조 가져오기
    const startButton = document.getElementById('start-button');
    const stopButton = document.getElementById('stop-button');
    const screenshotButton = document.getElementById('screenshot-button');
    const loadVideoButton = document.getElementById('load-video-button');
    const opacitySlider = document.getElementById('opacity-slider');
    
    // 시작 버튼 클릭
    startButton.addEventListener('click', startProcessing);
    
    // 중지 버튼 클릭
    stopButton.addEventListener('click', stopProcessing);
    
    // 스크린샷 버튼 클릭
    screenshotButton.addEventListener('click', takeScreenshot);
    
    // 영상 불러오기 버튼 클릭
    loadVideoButton.addEventListener('click', loadYouTubeVideo);
    
    // URL 입력 필드에서 엔터 키 누름
    document.getElementById('url-input').addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            loadYouTubeVideo();
        }
    });
    
    // 투명도 슬라이더 변경
    opacitySlider.addEventListener('input', function() {
        opacityValue = this.value / 100;
        
        // 실시간으로 투명도 적용
        if (personOverlayCanvas) {
            personOverlayCanvas.style.opacity = opacityValue;
        }
    });
}

// 비디오 선택
function selectVideo(videoId) {
    console.log(`YouTube 비디오 선택: ${videoId}`);
    
    // 현재 선택된 비디오 ID 저장
    selectedVideoId = videoId;
    
    // YouTube 미리보기 플레이어에 비디오 로드
    if (youtubePlayer && youtubePlayer.loadVideoById) {
        youtubePlayer.loadVideoById(videoId);
        
        // 시작 버튼 활성화
        document.getElementById('start-button').disabled = false;
    }
}

// YouTube URL에서 비디오 로드
function loadYouTubeVideo() {
    // URL 입력 필드에서 값 가져오기
    const urlInput = document.getElementById('url-input');
    const url = urlInput.value.trim();
    
    if (!url) {
        alert('YouTube 영상 URL을 입력해주세요.');
        return;
    }
    
    // URL에서 비디오 ID 추출
    const videoId = extractVideoId(url);
    
    if (!videoId) {
        alert('올바른 YouTube URL이 아닙니다. 다시 확인해주세요.');
        return;
    }
    
    console.log(`YouTube 비디오 URL에서 ID 추출: ${videoId}`);
    
    // 추출한 비디오 ID로 영상 선택 및 로드
    selectVideo(videoId);
    
    // 입력 필드에 성공 메시지 표시
    urlInput.value = `비디오가 로드되었습니다: ${videoId}`;
    
    // 3초 후 입력 필드 지우기
    setTimeout(() => {
        urlInput.value = '';
    }, 3000);
}

// YouTube URL에서 비디오 ID 추출
function extractVideoId(url) {
    // 일반적인 YouTube URL 패턴
    // 예: https://www.youtube.com/watch?v=9bZkp7q19f0
    // 예: https://youtu.be/9bZkp7q19f0
    // 예: https://www.youtube.com/embed/9bZkp7q19f0
    
    // 이미 ID만 입력한 경우 (11자리 영숫자)
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
        return url;
    }
    
    try {
        // URL 파싱
        let videoId = '';
        
        // youtu.be 단축 URL
        if (url.includes('youtu.be/')) {
            const urlObj = new URL(url);
            videoId = urlObj.pathname.split('/')[1];
        } 
        // watch?v= 형식
        else if (url.includes('youtube.com/watch')) {
            const urlObj = new URL(url);
            videoId = urlObj.searchParams.get('v');
        } 
        // embed 형식
        else if (url.includes('youtube.com/embed/')) {
            const urlObj = new URL(url);
            videoId = urlObj.pathname.split('/').pop();
        }
        
        // 비디오 ID가 유효한지 확인 (11자리 영숫자)
        if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
            return videoId;
        }
    } catch (error) {
        console.error("URL 파싱 오류:", error);
    }
    
    return null;
}

// 카메라 접근
async function startCamera() {
    try {
        // 이미 스트림이 있으면 중지
        if (cameraStream) {
            stopCamera();
        }
        
        // 사용자 미디어 장치 접근 요청
        cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 360 }
            }, 
            audio: false 
        });
        
        // 비디오 요소에 스트림 연결
        cameraVideo.srcObject = cameraStream;
        
        // 카메라 상태 메시지 완전히 숨김
        document.getElementById('camera-status').classList.add('hidden');
        
        return true;
    } catch (error) {
        console.error("카메라 접근 오류:", error);
        const statusElement = document.getElementById('camera-status');
        statusElement.innerText = '카메라 접근 오류: ' + error.message;
        statusElement.classList.remove('hidden');
        return false;
    }
}

// 카메라 중지
function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraVideo.srcObject = null;
        cameraStream = null;
    }
}

// 처리 시작
async function startProcessing() {
    // 카메라가 준비되지 않았으면 시작
    if (!cameraStream) {
        const cameraStarted = await startCamera();
        if (!cameraStarted) return;
    }
    
    // YouTube 비디오가 선택되지 않았으면 알림
    if (!selectedVideoId) {
        alert('YouTube 영상을 먼저 선택해주세요.');
        return;
    }
    
    // 이미 처리 중이면 중복 실행 방지
    if (isProcessing) return;
    
    console.log("처리 시작 - 영상 ID:", selectedVideoId);
    
    // 상태 및 버튼 업데이트
    isProcessing = true;
    document.getElementById('start-button').disabled = true;
    document.getElementById('stop-button').disabled = false;
    document.getElementById('output-status').innerText = '초기화 중...';
    
    // output-container와 overlay-container 요소 확인
    const outputContainer = document.getElementById('output-container');
    if (!outputContainer) {
        console.error("출력 컨테이너를 찾을 수 없습니다.");
        return;
    }
    
    const overlayContainer = outputContainer.querySelector('.overlay-container');
    if (!overlayContainer) {
        console.error("오버레이 컨테이너를 찾을 수 없습니다.");
        return;
    }
    
    // 컨테이너 스타일 확인
    console.log("출력 컨테이너 스타일:", getComputedStyle(outputContainer).position);
    console.log("오버레이 컨테이너 스타일:", getComputedStyle(overlayContainer).position);
    
    // 출력 컨테이너 스타일 강제 설정 (position: relative)
    outputContainer.style.position = 'relative';
    
    // 출력 YouTube 플레이어 요소 확인
    const youtubePlayerElement = document.getElementById('output-youtube-player');
    if (!youtubePlayerElement) {
        console.error("출력 YouTube 플레이어 요소를 찾을 수 없습니다.");
        return;
    }
    
    // YouTube 플레이어 ID 확인 및 재생
    if (!outputYoutubePlayer || typeof outputYoutubePlayer.loadVideoById !== 'function') {
        console.error("출력 YouTube 플레이어가 초기화되지 않았습니다. 플레이어 다시 생성...");
        
        // 플레이어가 없으면 새로 생성
        outputYoutubePlayer = new YT.Player('output-youtube-player', {
            width: '100%',
            height: '100%',
            videoId: selectedVideoId,
            playerVars: {
                'autoplay': 1, // 자동 재생 활성화
                'controls': 0,  // 컨트롤 숨김
                'rel': 0,
                'showinfo': 0,
                'modestbranding': 1,
                'iv_load_policy': 3,
                'disablekb': 1  // 키보드 제어 비활성화
            },
            events: {
                'onReady': function(event) {
                    console.log("새 출력 플레이어 준비 완료, 재생 시작");
                    event.target.playVideo();
                },
                'onStateChange': onOutputPlayerStateChange,
                'onError': onOutputPlayerError
            }
        });
    } else {
        // 기존 플레이어에 비디오 로드 및 재생
        console.log("기존 출력 플레이어에 비디오 로드:", selectedVideoId);
        outputYoutubePlayer.loadVideoById({
            videoId: selectedVideoId,
            startSeconds: youtubePlayer.getCurrentTime() || 0
        });
        outputYoutubePlayer.playVideo();
    }
    
    // person-overlay 캔버스 초기화 및 설정
    personOverlayCanvas = document.getElementById('person-overlay');
    if (!personOverlayCanvas) {
        console.error("인물 오버레이 캔버스를 찾을 수 없습니다.");
        return;
    }
    
    // 캔버스 사이즈 초기화 (컨테이너 크기에 맞게)
    personOverlayCanvas.width = outputContainer.clientWidth || 640;
    personOverlayCanvas.height = outputContainer.clientHeight || 360;
    personOverlayCtx = personOverlayCanvas.getContext('2d');
    
    // 캔버스 스타일 설정
    personOverlayCanvas.style.opacity = opacityValue;
    personOverlayCanvas.style.display = 'block';
    
    console.log(`인물 오버레이 캔버스 초기화 완료: ${personOverlayCanvas.width}x${personOverlayCanvas.height}`);
    
    // 상태 메시지 업데이트
    document.getElementById('output-status').innerText = '처리 시작 중...';
    
    // 처리 루프 시작 (인물 분리 및 오버레이)
    processingInterval = setInterval(processOverlay, 1000 / 30); // 약 30fps
    
    console.log("처리 루프 시작됨");
}

// 처리 중지
function stopProcessing() {
    // 처리 루프 중지
    if (processingInterval) {
        clearInterval(processingInterval);
        processingInterval = null;
    }
    
    // 상태 및 버튼 업데이트
    isProcessing = false;
    document.getElementById('start-button').disabled = false;
    document.getElementById('stop-button').disabled = true;
    document.getElementById('output-status').innerText = '처리가 중지되었습니다';
    
    // 출력 YouTube 플레이어 일시 정지
    if (outputYoutubePlayer && outputYoutubePlayer.pauseVideo) {
        outputYoutubePlayer.pauseVideo();
    }
    
    // 인물 오버레이 캔버스 지우기
    if (personOverlayCtx) {
        personOverlayCtx.clearRect(0, 0, personOverlayCanvas.width, personOverlayCanvas.height);
    }
    
    console.log("처리 중지됨");
}

// 인물 오버레이 처리 (새로운 합성 방식)
async function processOverlay() {
    if (!cameraVideo || cameraVideo.paused || cameraVideo.ended || !personOverlayCtx) {
        console.warn("카메라 비디오 또는 오버레이 캔버스 컨텍스트가 없습니다.");
        return;
    }
    
    try {
        // 출력 컨테이너 확인
        const outputContainer = document.getElementById('output-container');
        if (!outputContainer) {
            console.error("출력 컨테이너를 찾을 수 없습니다.");
            return;
        }
        
        // overlay-container 확인 
        const overlayContainer = outputContainer.querySelector('.overlay-container');
        if (!overlayContainer) {
            console.error("오버레이 컨테이너를 찾을 수 없습니다.");
            return;
        }
        
        // output-youtube-player 확인
        const youtubePlayerElement = document.getElementById('output-youtube-player');
        if (!youtubePlayerElement) {
            console.error("출력 YouTube 플레이어 요소를 찾을 수 없습니다.");
            return;
        }
        
        // 비디오 플레이어 상태 확인
        if (outputYoutubePlayer && typeof outputYoutubePlayer.getPlayerState === 'function') {
            const playerState = outputYoutubePlayer.getPlayerState();
            console.log("출력 YouTube 플레이어 상태:", playerState);
            
            // 상태가 PLAYING이 아니면 디버그 메시지 표시
            if (playerState !== YT.PlayerState.PLAYING) {
                console.warn("YouTube 플레이어가 재생 중이 아닙니다. 상태:", 
                    playerState === YT.PlayerState.UNSTARTED ? "시작 안 됨" :
                    playerState === YT.PlayerState.ENDED ? "종료됨" :
                    playerState === YT.PlayerState.PAUSED ? "일시정지" :
                    playerState === YT.PlayerState.BUFFERING ? "버퍼링" :
                    playerState === YT.PlayerState.CUED ? "준비됨" : "알 수 없음");
            }
        } else {
            console.error("출력 YouTube 플레이어가 초기화되지 않았습니다.");
        }
        
        // 컨테이너 실제 표시 크기 확인
        const containerWidth = outputContainer.clientWidth;
        const containerHeight = outputContainer.clientHeight;
        
        if (containerWidth === 0 || containerHeight === 0) {
            console.warn("출력 컨테이너 크기가 0입니다. 표시 크기를 확인하세요.");
            return;
        }
        
        // 디버그 정보: 컨테이너 크기
        if (Math.random() < 0.05) { // 5% 확률로 로그 출력 (너무 많은 로그 방지)
            console.log(`출력 컨테이너 크기: ${containerWidth}x${containerHeight}`);
        }
        
        // 캔버스 크기 업데이트 (컨테이너와 동일하게)
        if (personOverlayCanvas.width !== containerWidth || 
            personOverlayCanvas.height !== containerHeight) {
            personOverlayCanvas.width = containerWidth;
            personOverlayCanvas.height = containerHeight;
            console.log(`오버레이 캔버스 크기 조정: ${containerWidth}x${containerHeight}`);
        }
        
        // 카메라 캡처용 캔버스 크기 설정
        cameraCanvas.width = cameraVideo.videoWidth || 640;
        cameraCanvas.height = cameraVideo.videoHeight || 360;
        
        // 카메라가 미러링되어 있으므로 캔버스에서도 미러링 처리
        cameraCtx.save();
        cameraCtx.scale(-1, 1); // 수평으로 뒤집기
        cameraCtx.drawImage(cameraVideo, -cameraCanvas.width, 0, cameraCanvas.width, cameraCanvas.height);
        cameraCtx.restore();
        
        // 인물 분리 실행
        console.log("인물 분리 시작...");
        const segmentationResult = await personSegmenter.segmentPerson(cameraCanvas);
        console.log("인물 분리 완료");
        
        // 디버그: 분리 결과 확인
        if (!segmentationResult || (!segmentationResult.personCanvas && !segmentationResult.maskCanvas)) {
            console.error("인물 분리 결과가 없습니다.");
            return;
        }
        
        // personCanvas가 있으면 사용 (인물만 분리된 캔버스)
        const personCanvas = segmentationResult.personCanvas || segmentationResult.maskCanvas;
        
        // 디버그: 분리된 인물 데이터 확인
        const personCtx = personCanvas.getContext('2d');
        const personImageData = personCtx.getImageData(0, 0, personCanvas.width, personCanvas.height);
        
        // 투명 픽셀과 불투명 픽셀 개수 세기
        let transparentPixels = 0;
        let opaquePixels = 0;
        
        for (let i = 3; i < personImageData.data.length; i += 4) {
            if (personImageData.data[i] === 0) {
                transparentPixels++;
            } else {
                opaquePixels++;
            }
        }
        
        // 투명/불투명 픽셀 비율 계산
        const totalPixels = personCanvas.width * personCanvas.height;
        const transparentRatio = transparentPixels / totalPixels;
        const opaqueRatio = opaquePixels / totalPixels;
        
        if (Math.random() < 0.05) { // 5% 확률로 로그 출력 
            console.log(`인물 분리 통계: 전체 픽셀 ${totalPixels}, 투명 ${transparentRatio.toFixed(2)}, 불투명 ${opaqueRatio.toFixed(2)}`);
        }
        
        // 인물이 너무 적게 감지되면 경고
        if (opaqueRatio < 0.01) {
            console.warn("인물이 거의 감지되지 않았습니다. (인물 비율: " + (opaqueRatio * 100).toFixed(2) + "%)");
        }
        
        // 오버레이 캔버스에 인물만 그리기
        personOverlayCtx.clearRect(0, 0, personOverlayCanvas.width, personOverlayCanvas.height);
        
        // 캔버스 배경을 완전 투명하게 설정
        personOverlayCanvas.style.backgroundColor = 'transparent';
        // 캔버스 컨텍스트의 compositeOperation 설정 (투명 부분은 배경 표시)
        personOverlayCtx.globalCompositeOperation = 'source-over';
        
        // 캔버스 상태 저장
        personOverlayCtx.save();
        
        // 타겟 크기 계산 (종횡비 유지하면서 가능한 크게)
        // 크기 계산을 개선하여 더 적절한 크기로 조정
        const videoAspectRatio = 16/9; // YouTube 비디오 종횡비
        
        let targetWidth, targetHeight, x, y;
        
        // 디버깅용: 테스트 모드 - 화면 중앙에 인물 배치
        const useDebugPosition = false; // 디버깅 위치 사용 여부
        
        if (useDebugPosition) {
            // 화면 중앙에 크게 표시 (디버깅용)
            targetHeight = containerHeight * 0.8;
            targetWidth = targetHeight * (personCanvas.width / personCanvas.height);
            x = (containerWidth - targetWidth) / 2; // 중앙 정렬
            y = (containerHeight - targetHeight) / 2; // 중앙 정렬
            
            // 디버그용 경계 표시
            personOverlayCtx.strokeStyle = 'red';
            personOverlayCtx.lineWidth = 2;
            personOverlayCtx.strokeRect(x, y, targetWidth, targetHeight);
        } else {
            // 인물을 화면의 오른쪽 아래에 배치 (실제 사용)
            targetHeight = containerHeight * 0.4; // 화면 높이의 40%로 줄임
            targetWidth = targetHeight * (personCanvas.width / personCanvas.height);
            x = containerWidth - targetWidth - 20; // 오른쪽에서 20px 여백
            y = containerHeight - targetHeight - 10; // 아래쪽에서 10px 여백
        }
        
        console.log(`인물 그리기: 크기 ${targetWidth}x${targetHeight}, 위치 (${x}, ${y})`);
        
        // 그리기 전 디버그용 배경 (인물 위치 확인용)
        if (useDebugPosition) {
            personOverlayCtx.fillStyle = 'rgba(255, 255, 0, 0.2)';
            personOverlayCtx.fillRect(x, y, targetWidth, targetHeight);
        }
        
        // 인물 그리기
        personOverlayCtx.drawImage(
            personCanvas, 
            0, 0, personCanvas.width, personCanvas.height,
            x, y, targetWidth, targetHeight
        );
        
        // 캔버스 상태 복원
        personOverlayCtx.restore();
        
        // 상태 메시지 업데이트
        document.getElementById('output-status').innerText = '';
        
        // 디버그 정보 표시 (영상 위에)
        if (useDebugPosition) {
            personOverlayCtx.font = '14px Arial';
            personOverlayCtx.fillStyle = 'white';
            personOverlayCtx.fillText(`Debug: 인물 ${opaqueRatio.toFixed(3)*100}%, 캔버스 ${personOverlayCanvas.width}x${personOverlayCanvas.height}`, 10, 20);
        }
        
        // 디버그 정보: 합성 프레임 카운터
        window.overlayFrameCount = (window.overlayFrameCount || 0) + 1;
        if (window.overlayFrameCount % 30 === 0) { // 30프레임마다 로그
            console.log(`합성 프레임 카운트: ${window.overlayFrameCount}`);
        }
        
    } catch (error) {
        console.error("인물 오버레이 처리 오류:", error);
        document.getElementById('output-status').innerText = '처리 오류: ' + error.message;
    }
}

// 스크린샷 촬영 (새로운 방식)
function takeScreenshot() {
    if (!isProcessing) {
        alert('먼저 처리를 시작해주세요.');
        return;
    }
    
    try {
        // 출력 결과를 스크린샷으로 캡처하는 함수
        const screenshotCanvas = document.createElement('canvas');
        const width = personOverlayCanvas.width;
        const height = personOverlayCanvas.height;
        
        screenshotCanvas.width = width;
        screenshotCanvas.height = height;
        const ctx = screenshotCanvas.getContext('2d');
        
        // 출력 화면 전체 스크린샷 (YouTube 플레이어는 캡처할 수 없음)
        // 대신 현재 영상에서 재생 중인 시점의 썸네일 이미지를 배경으로 사용
        
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        
        // 배경에 영상 정보 표시
        ctx.font = '16px Arial';
        ctx.fillStyle = 'white';
        ctx.fillText(`YouTube 영상: ${selectedVideoId}`, 20, height - 20);
        
        // 인물 오버레이 합성
        ctx.drawImage(personOverlayCanvas, 0, 0);
        
        // 이미지 URL 생성
        const imageUrl = screenshotCanvas.toDataURL('image/png');
        
        // 다운로드 링크 생성 및 클릭
        const link = document.createElement('a');
        link.download = `screenshot_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
        link.href = imageUrl;
        link.click();
        
        console.log("스크린샷 저장 완료");
    } catch (error) {
        console.error("스크린샷 저장 오류:", error);
        alert("스크린샷 저장 중 오류가 발생했습니다: " + error.message);
    }
}

// 페이지 로드 시 앱 초기화
window.addEventListener('DOMContentLoaded', initializeApp);