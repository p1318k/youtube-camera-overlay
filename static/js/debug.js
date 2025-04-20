// YouTube 플레이어 로딩 확인 및 디버깅을 위한 스크립트
window.addEventListener('DOMContentLoaded', function() {
    // YouTube 동영상 강제 로딩 시도
    setTimeout(function() {
        const outputPlayer = document.getElementById('output-youtube-player');
        if (outputPlayer) {
            console.log('output-youtube-player 요소 발견:', outputPlayer);
            
            // iframe이 생성되었는지 확인
            const iframe = outputPlayer.querySelector('iframe');
            if (iframe) {
                console.log('YouTube iframe 발견:', iframe);
                iframe.style.width = '100%';
                iframe.style.height = '100%';
                iframe.style.position = 'absolute';
                iframe.style.top = '0';
                iframe.style.left = '0';
                iframe.style.zIndex = '1';
                console.log('iframe 스타일 설정 완료');
            } else {
                console.warn('YouTube iframe을 찾을 수 없음');
            }
            
            // 직접 강제 로드 시도 (iframe이 없는 경우)
            if (!iframe && window.YT && typeof window.YT.Player === 'function') {
                console.log('YouTube API 발견, 강제 로드 시도');
                window.forceLoadYouTubePlayer = new YT.Player('output-youtube-player', {
                    width: '100%',
                    height: '100%',
                    videoId: '9bZkp7q19f0',  // 기본 영상 (강남스타일)
                    playerVars: {
                        'autoplay': 1, 
                        'controls': 0,
                        'rel': 0,
                        'showinfo': 0,
                        'modestbranding': 1
                    }
                });
            }
        } else {
            console.error('output-youtube-player 요소를 찾을 수 없음');
        }
    }, 2000);  // 2초 대기 후 실행
});

// 오버레이 컨테이너의 위치 문제 해결을 위한 함수
window.fixOverlayContainerPosition = function() {
    const outputContainer = document.getElementById('output-container');
    const overlayContainer = document.querySelector('.overlay-container');
    
    if (outputContainer && overlayContainer) {
        // 출력 컨테이너의 위치 및 크기 확인
        const rect = outputContainer.getBoundingClientRect();
        console.log('출력 컨테이너 위치/크기:', rect);
        
        // 오버레이 컨테이너 위치 수정
        overlayContainer.style.position = 'absolute';
        overlayContainer.style.top = '0';
        overlayContainer.style.left = '0';
        overlayContainer.style.width = '100%';
        overlayContainer.style.height = '100%';
        
        // output-youtube-player 확인 및 수정
        const youtubePlayer = document.getElementById('output-youtube-player');
        if (youtubePlayer) {
            youtubePlayer.style.position = 'absolute';
            youtubePlayer.style.top = '0';
            youtubePlayer.style.left = '0';
            youtubePlayer.style.width = '100%';
            youtubePlayer.style.height = '100%';
            youtubePlayer.style.zIndex = '1';
            
            // YouTube iframe 직접 접근 시도
            const iframe = youtubePlayer.querySelector('iframe');
            if (iframe) {
                iframe.style.width = '100%';
                iframe.style.height = '100%';
                iframe.style.position = 'absolute';
                iframe.style.top = '0';
                iframe.style.left = '0';
            }
        }
        
        // person-overlay 캔버스 확인 및 수정
        const personOverlay = document.getElementById('person-overlay');
        if (personOverlay) {
            personOverlay.style.position = 'absolute';
            personOverlay.style.top = '0';
            personOverlay.style.left = '0';
            personOverlay.style.width = '100%';
            personOverlay.style.height = '100%';
            personOverlay.style.zIndex = '2';
            personOverlay.style.pointerEvents = 'none';
        }
        
        console.log('오버레이 컨테이너 위치 수정 완료');
        return true;
    } else {
        console.error('출력 컨테이너 또는 오버레이 컨테이너를 찾을 수 없음');
        return false;
    }
};

// 페이지 로드 후 1초 뒤에 실행
setTimeout(window.fixOverlayContainerPosition, 1000);
