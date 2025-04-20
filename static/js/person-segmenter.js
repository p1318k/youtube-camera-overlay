/**
 * PersonSegmenter 클래스 - 카메라 영상에서 사람을 분리하는 기능 담당
 * MediaPipe Selfie Segmentation을 사용하여 구현
 * 참고: https://codepen.io/mediapipe/pen/wvJyQpq
 */
class PersonSegmenter {
    constructor() {
        this.initialized = false;
        this.selfieSegmentation = null;
        this.segmentationConfig = {
            threshold: 0.5,      // 분할 임계값
            maskOpacity: 1.0,    // 마스크 불투명도
            maskBlur: 5,         // 마스크 블러 강도
            edgeBlur: 10,        // 에지 블러 강도
            flipHorizontal: true, // 수평 뒤집기 (셀카 모드)
            maxImageSize: 640    // 최대 이미지 크기 (메모리 오류 방지)
        };
        
        // 초기화 상태 변수
        this.maxRetries = 3;     // 초기화 최대 재시도 횟수
        this.retryCount = 0;     // 현재 재시도 횟수
        this.useMediaPipe = true; // MediaPipe 사용 여부 플래그
        
        // 오류 발생 카운터 (연속적인 오류 감지)
        this.errorCount = 0;
        this.maxErrorsBeforeFallback = 3;
        
        console.log("PersonSegmenter 생성됨");
    }

    /**
     * 모델 초기화
     */
    async initialize() {
        try {
            // 모델이 이미 초기화되었는지 확인
            if (this.initialized) {
                return true;
            }

            console.log("PersonSegmenter 초기화 시작...");

            if (!this.useMediaPipe) {
                console.warn("MediaPipe 사용이 비활성화되어 있습니다. 대체 메서드를 사용합니다.");
                return this.initFallbackMethod();
            }

            // MediaPipe Selfie Segmentation 모듈 로드
            if (!window.SelfieSegmentation) {
                console.log("MediaPipe Selfie Segmentation 모듈 로드 중...");
                await this._loadMediaPipeScript();
            }
            
            // SelfieSegmentation 초기화
            if (window.SelfieSegmentation) {
                this.selfieSegmentation = new window.SelfieSegmentation({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/${file}`;
                    }
                });
                
                // 결과 콜백 설정 - 바로 처리하지 않고 결과만 저장
                this.selfieSegmentation.onResults((results) => {
                    this.lastResults = results;
                });
                
                // 모델 옵션 설정
                await this.selfieSegmentation.setOptions({
                    modelSelection: 1, // 0: 일반 모델, 1: 풍경 모델(더 정확)
                    selfieMode: this.segmentationConfig.flipHorizontal
                });
                
                this.initialized = true;
                console.log("MediaPipe Selfie Segmentation 초기화 완료!");
                return true;
            } else {
                throw new Error("MediaPipe Selfie Segmentation을 로드할 수 없습니다.");
            }
        } catch (error) {
            console.error("Selfie Segmentation 초기화 오류:", error);
            this.retryCount++;
            
            if (this.retryCount < this.maxRetries) {
                console.log(`초기화 재시도 중... (${this.retryCount}/${this.maxRetries})`);
                return this.initialize();
            } else {
                console.warn("최대 재시도 횟수 초과. 대체 메서드를 사용합니다.");
                this.useMediaPipe = false;
                return this.initFallbackMethod();
            }
        }
    }

    /**
     * MediaPipe Selfie Segmentation 스크립트 로드
     */
    async _loadMediaPipeScript() {
        return new Promise((resolve, reject) => {
            // 이미 로드되었는지 확인
            if (window.SelfieSegmentation) {
                console.log("MediaPipe Selfie Segmentation이 이미 로드되어 있습니다.");
                resolve();
                return;
            }

            try {
                // 메모리 관련 문제 해결을 위한 설정
                // WASM 메모리 설정 및 성능 최적화
                window.Module = window.Module || {};
                window.Module.arguments = window.Module.arguments || [];
                window.Module.locateFile = (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/${file}`;
                };
                
                // 메모리 부족 오류 방지를 위한 힙 설정
                window.Module.TOTAL_MEMORY = 50 * 1024 * 1024; // 50MB
                window.Module.noInitialRun = true;
                window.Module.onRuntimeInitialized = () => {
                    console.log("MediaPipe WASM 런타임 초기화 완료");
                };
                
                // 로딩 타임아웃 설정
                const loadTimeout = setTimeout(() => {
                    console.error("MediaPipe 로딩 타임아웃");
                    reject(new Error("MediaPipe 로딩 시간 초과"));
                }, 10000); // 10초 타임아웃
                
                // SelfieSegmentation 스크립트 동적 로드
                // 메모리 사용량이 적은 가벼운 모델 버전 사용
                const script = document.createElement('script');
                // CDN 로드 실패 시 대체 URL 사용 준비
                const primaryUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/selfie_segmentation.js';
                const backupUrl = 'https://unpkg.com/@mediapipe/selfie_segmentation@0.1/selfie_segmentation.js';
                
                script.src = primaryUrl;
                script.crossOrigin = 'anonymous';
                
                // 스크립트 로드 이벤트 핸들러
                script.onload = () => {
                    clearTimeout(loadTimeout);
                    console.log("MediaPipe Selfie Segmentation 스크립트 로드 완료");
                    
                    // 다음 프레임에서 확인 (비동기 초기화 대기)
                    setTimeout(() => {
                        if (window.SelfieSegmentation) {
                            resolve();
                        } else {
                            console.warn("MediaPipe가 전역 객체에 등록되지 않았습니다. 다시 시도합니다.");
                            // 메인 CDN 실패시 대체 URL 시도
                            this._tryLoadAlternateScript(backupUrl, resolve, reject);
                        }
                    }, 100);
                };
                
                script.onerror = (error) => {
                    clearTimeout(loadTimeout);
                    console.error("MediaPipe 스크립트 로드 실패, 대체 URL 시도:", error);
                    this._tryLoadAlternateScript(backupUrl, resolve, reject);
                };
                
                document.head.appendChild(script);
                
            } catch (error) {
                console.error("MediaPipe 로드 중 예기치 않은 오류:", error);
                reject(error);
            }
        });
    }
    
    /**
     * 대체 스크립트 URL로 로드 시도
     */
    _tryLoadAlternateScript(url, resolve, reject) {
        try {
            const altScript = document.createElement('script');
            altScript.src = url;
            altScript.crossOrigin = 'anonymous';
            
            altScript.onload = () => {
                console.log("대체 URL에서 MediaPipe 로드 완료");
                
                // 비동기 초기화 확인
                setTimeout(() => {
                    if (window.SelfieSegmentation) {
                        resolve();
                    } else {
                        reject(new Error("모든 소스에서 MediaPipe 로드 실패"));
                    }
                }, 100);
            };
            
            altScript.onerror = (error) => {
                console.error("대체 MediaPipe 로드 실패:", error);
                reject(new Error("모든 소스에서 MediaPipe 로드 실패"));
            };
            
            document.head.appendChild(altScript);
        } catch (error) {
            reject(error);
        }
    }

    /**
     * 폴백 메서드 초기화
     */
    initFallbackMethod() {
        console.warn("색상 기반 인물 분리 메서드로 전환합니다 (MediaPipe 사용 불가)");
        this.initialized = true;
        this.useMediaPipe = false;
        return true;
    }

    /**
     * 영상 프레임에서 사람 마스크 생성
     */
    async segmentPerson(frame) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            // MediaPipe 사용이 가능하면 SelfieSegmentation 사용
            if (this.useMediaPipe && this.selfieSegmentation) {
                return await this._segmentPersonWithMediaPipe(frame);
            } 
            // 그렇지 않으면, 색상 기반 대체 메서드 사용
            return this._segmentPersonByColor(frame);
        } catch (error) {
            console.error("인물 분리 중 오류 발생:", error);
            // 오류 발생 시 색상 기반 분리로 폴백
            return this._segmentPersonByColor(frame);
        }
    }

    /**
     * MediaPipe Selfie Segmentation을 사용한 인물 분리
     */
    async _segmentPersonWithMediaPipe(frame) {
        const originalWidth = frame.width;
        const originalHeight = frame.height;
        
        // 입력 이미지가 없거나 너무 작으면 폴백
        if (!frame || originalWidth < 10 || originalHeight < 10) {
            console.warn("유효하지 않은 입력 프레임");
            return this._segmentPersonByColor(frame);
        }
        
        try {
            // 이미지가 너무 크면 리사이징 (메모리 오류 방지)
            let processedFrame = frame;
            const maxSize = this.segmentationConfig.maxImageSize;
            
            if (originalWidth > maxSize || originalHeight > maxSize) {
                console.log(`이미지 크기 조정: ${originalWidth}x${originalHeight} -> 최대 ${maxSize}px`);
                
                // 새로운 크기 계산 (종횡비 유지)
                const scale = Math.min(maxSize / originalWidth, maxSize / originalHeight);
                const newWidth = Math.floor(originalWidth * scale);
                const newHeight = Math.floor(originalHeight * scale);
                
                // 임시 캔버스에 리사이징
                const resizedCanvas = document.createElement('canvas');
                resizedCanvas.width = newWidth;
                resizedCanvas.height = newHeight;
                const resizedCtx = resizedCanvas.getContext('2d');
                resizedCtx.drawImage(frame, 0, 0, newWidth, newHeight);
                
                processedFrame = resizedCanvas;
                console.log(`이미지 리사이징 완료: ${newWidth}x${newHeight}`);
            }
            
            // 이미지 데이터 안전성 검사
            try {
                // Canvas 컨텍스트에서 데이터 가져오기 시도 (유효성 테스트)
                const testCtx = processedFrame.getContext('2d');
                const testData = testCtx.getImageData(0, 0, Math.min(processedFrame.width, 10), Math.min(processedFrame.height, 10));
                
                // 이미지 데이터가 없으면 오류
                if (!testData || !testData.data || testData.data.length === 0) {
                    throw new Error("이미지 데이터가 유효하지 않습니다");
                }
            } catch (dataError) {
                console.warn("이미지 데이터 검증 실패:", dataError);
                return this._segmentPersonByColor(frame);
            }
            
            // MediaPipe 처리 (try-catch로 메모리 오류 포착)
            try {
                // 시간 측정 시작
                const startTime = performance.now();
                
                // selfie_segmentation은 이미지를 직접 입력으로 받음
                await this.selfieSegmentation.send({ image: processedFrame });
                
                // 시간 측정 종료
                const processingTime = performance.now() - startTime;
                console.log(`MediaPipe 처리 시간: ${processingTime.toFixed(1)}ms`);
                
                // 결과가 없으면 오류
                if (!this.lastResults || !this.lastResults.segmentationMask) {
                    throw new Error("유효한 분할 결과를 받지 못했습니다.");
                }
                
                // 오류 카운터 리셋 (성공)
                this.errorCount = 0;
            } catch (mpError) {
                // 메모리 오류 또는 다른 MediaPipe 내부 오류 발생
                console.error("MediaPipe 내부 처리 오류:", mpError);
                
                // 연속 오류 카운트 증가
                this.errorCount++;
                
                // 연속 오류가 임계값을 초과하면 폴백 메서드로 전환
                if (this.errorCount >= this.maxErrorsBeforeFallback) {
                    console.warn(`연속 ${this.errorCount}회 오류 발생, 폴백 메서드로 전환`);
                    this.useMediaPipe = false;
                }
                
                return this._segmentPersonByColor(frame);
            }
            
            // 여기서부터는 정상 처리된 경우
            // 결과 처리를 위한 캔버스 준비
            const personCanvas = document.createElement('canvas');
            personCanvas.width = originalWidth;
            personCanvas.height = originalHeight;
            const personCtx = personCanvas.getContext('2d');
            
            // 마스크 캔버스 준비
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = originalWidth;
            maskCanvas.height = originalHeight;
            const maskCtx = maskCanvas.getContext('2d');
            
            // 세그멘테이션 마스크 그리기 (원본 이미지 크기에 맞게 조정)
            maskCtx.drawImage(this.lastResults.segmentationMask, 0, 0, originalWidth, originalHeight);
            
            // 원본 이미지 그리기
            personCtx.drawImage(frame, 0, 0, originalWidth, originalHeight);
            
            // 마스크를 사용하여 인물만 추출 (배경 제거)
            personCtx.globalCompositeOperation = 'destination-in';
            personCtx.drawImage(maskCanvas, 0, 0, originalWidth, originalHeight);
            personCtx.globalCompositeOperation = 'source-over';
            
            // 에지 블러 효과 적용
            const blurredCanvas = this._applyMaskBlur(personCanvas);
            
            // 결과 반환
            return {
                maskCanvas: maskCanvas,
                originalCanvas: frame,
                personCanvas: blurredCanvas
            };
        } catch (error) {
            console.error("MediaPipe Selfie Segmentation 처리 중 오류:", error);
            
            // 오류 카운터 증가
            this.errorCount++;
            
            // 연속 오류가 임계값 초과시 MediaPipe 비활성화
            if (this.errorCount >= this.maxErrorsBeforeFallback) {
                console.warn(`연속 ${this.errorCount}회 오류 발생, MediaPipe 사용 중지`);
                this.useMediaPipe = false;
            }
            
            console.warn("색상 기반 인물 분리로 폴백합니다.");
            return this._segmentPersonByColor(frame);
        }
    }

    /**
     * 마스크에 블러 효과 적용
     */
    _applyMaskBlur(maskCanvas) {
        const { width, height } = maskCanvas;
        const blurredCanvas = document.createElement('canvas');
        blurredCanvas.width = width;
        blurredCanvas.height = height;
        const blurredCtx = blurredCanvas.getContext('2d');
        
        // 원본 마스크 그리기
        blurredCtx.drawImage(maskCanvas, 0, 0);
        
        // 블러 적용
        const blurAmount = this.segmentationConfig.maskBlur;
        blurredCtx.filter = `blur(${blurAmount}px)`;
        blurredCtx.drawImage(maskCanvas, 0, 0);
        
        // 두 번째 블러 패스 (더 부드러운 에지를 위해)
        blurredCtx.filter = `blur(${Math.max(1, blurAmount/2)}px)`;
        blurredCtx.drawImage(blurredCanvas, 0, 0);
        blurredCtx.filter = 'none';
        
        return blurredCanvas;
    }

    /**
     * 색상 범위를 이용한 사람 분리 (HSV 색상 공간)
     * 폴백 메서드로 사용
     */
    _segmentPersonByColor(frame) {
        console.log("색상 기반 인물 분리 시작...");

        // 캔버스에서 이미지 데이터 가져오기
        const ctx = frame.getContext('2d');
        const { width, height } = frame;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // 결과를 저장할 마스크 생성
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const maskCtx = maskCanvas.getContext('2d');
        
        // 인물 마스크 생성
        const maskImageData = maskCtx.createImageData(width, height);
        const maskData = maskImageData.data;
        
        // 각 픽셀 처리
        let detectedSkinPixels = 0;
        let totalPixels = width * height;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // RGB를 HSV로 변환
            const [h, s, v] = this._rgbToHsv(r, g, b);
            
            // 피부색 범위 감지
            const isSkin = this._isSkinPixel(h, s, v);
            
            if (isSkin) {
                // 피부색 감지 카운트 증가
                detectedSkinPixels++;
                
                // 피부색으로 감지된 픽셀은 원본 색상 유지하고 완전 불투명하게
                maskData[i] = 255;      // 마스크의 빨간색 채널 (흰색)
                maskData[i + 1] = 255;  // 마스크의 녹색 채널 (흰색)
                maskData[i + 2] = 255;  // 마스크의 파란색 채널 (흰색)
                maskData[i + 3] = 255;  // 마스크의 알파 채널 (완전 불투명)
            } else {
                // 피부색이 아닌 픽셀은 완전 투명하게 설정
                maskData[i] = 0;
                maskData[i + 1] = 0;
                maskData[i + 2] = 0;
                maskData[i + 3] = 0;
            }
        }
        
        // 피부색 감지 통계 출력
        const skinPercentage = (detectedSkinPixels / totalPixels) * 100;
        console.log(`피부색 감지: 총 ${totalPixels}픽셀 중 ${detectedSkinPixels}픽셀 감지 (${skinPercentage.toFixed(2)}%)`);
        
        // 마스크 개선 (노이즈 제거 및 에지 부드럽게)
        this._improveSegmentationMask(maskData, width, height);
        
        // 결과 마스크 적용
        maskCtx.putImageData(maskImageData, 0, 0);
        
        // 마스크 블러 처리
        const blurredMaskCanvas = this._applyMaskBlur(maskCanvas);
        
        // 원본 이미지와 마스크 결합
        const personCanvas = document.createElement('canvas');
        personCanvas.width = width;
        personCanvas.height = height;
        const personCtx = personCanvas.getContext('2d');
        
        // 원본 이미지 그리기
        personCtx.drawImage(frame, 0, 0);
        
        // 마스크를 사용하여 알파 채널 설정
        personCtx.globalCompositeOperation = 'destination-in';
        personCtx.drawImage(blurredMaskCanvas, 0, 0);
        personCtx.globalCompositeOperation = 'source-over';
        
        return { 
            maskCanvas: blurredMaskCanvas, 
            originalCanvas: frame,
            personCanvas: personCanvas
        };
    }
    
    /**
     * RGB to HSV 변환
     */
    _rgbToHsv(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        
        let h, s, v;
        
        if (d === 0) {
            h = 0;
        } else if (max === r) {
            h = ((g - b) / d) % 6;
        } else if (max === g) {
            h = (b - r) / d + 2;
        } else {
            h = (r - g) / d + 4;
        }
        
        h = Math.round(h * 60);
        if (h < 0) h += 360;
        
        s = max === 0 ? 0 : d / max;
        v = max;
        
        return [h, s, v];
    }
    
    /**
     * 피부색 픽셀 감지
     */
    _isSkinPixel(h, s, v) {
        // 피부색에 대한 HSV 범위
        const isHueSkin = (h >= 0 && h <= 50) || (h >= 340 && h <= 360);
        const isSaturationOk = s >= 0.1 && s <= 0.8;
        const isValueOk = v >= 0.2 && v <= 0.95;
        
        return isHueSkin && isSaturationOk && isValueOk;
    }
    
    /**
     * 세그먼테이션 마스크 개선 (노이즈 제거 및 구멍 채우기)
     */
    _improveSegmentationMask(maskData, width, height) {
        // 간단한 모폴로지 연산 (팽창 후 침식)
        const tempBuffer = new Uint8ClampedArray(maskData.length);
        
        // 팽창 연산 (작은 구멍 채우기)
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                
                // 주변 8개 픽셀에 대해 검사
                let hasNeighborPerson = false;
                
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        
                        const nx = x + dx;
                        const ny = y + dy;
                        
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const nidx = (ny * width + nx) * 4;
                            if (maskData[nidx + 3] > 100) {
                                hasNeighborPerson = true;
                                break;
                            }
                        }
                    }
                    if (hasNeighborPerson) break;
                }
                
                if (hasNeighborPerson) {
                    tempBuffer[idx] = 255;
                    tempBuffer[idx + 1] = 255;
                    tempBuffer[idx + 2] = 255;
                    tempBuffer[idx + 3] = 255;
                } else {
                    tempBuffer[idx] = maskData[idx];
                    tempBuffer[idx + 1] = maskData[idx + 1];
                    tempBuffer[idx + 2] = maskData[idx + 2];
                    tempBuffer[idx + 3] = maskData[idx + 3];
                }
            }
        }
        
        // 침식 연산 (노이즈 제거)
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                
                if (tempBuffer[idx + 3] > 0) {
                    let neighborCount = 0;
                    
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            
                            const nx = x + dx;
                            const ny = y + dy;
                            
                            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                const nidx = (ny * width + nx) * 4;
                                if (tempBuffer[nidx + 3] > 0) {
                                    neighborCount++;
                                }
                            }
                        }
                    }
                    
                    // 주변에 충분한 사람 픽셀이 없으면 제거
                    if (neighborCount < 4) {
                        maskData[idx + 3] = 0;
                    } else {
                        // 그렇지 않으면 원래 결과 복원
                        maskData[idx] = tempBuffer[idx];
                        maskData[idx + 1] = tempBuffer[idx + 1];
                        maskData[idx + 2] = tempBuffer[idx + 2];
                        maskData[idx + 3] = tempBuffer[idx + 3];
                    }
                }
            }
        }
    }
}