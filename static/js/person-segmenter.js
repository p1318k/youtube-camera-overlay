/**
 * PersonSegmenter 클래스 - 카메라 영상에서 사람을 분리하는 기능 담당
 * MediaPipe Image Segmentation을 사용하여 구현
 * 참고: https://codepen.io/mediapipe/pen/wvJyQpq
 */
class PersonSegmenter {
    constructor() {
        this.initialized = false;
        this.imageSegmenter = null;
        this.segmentationConfig = {
            threshold: 0.5,      // 분할 임계값
            maskOpacity: 1.0,    // 마스크 불투명도
            maskBlur: 5,         // 마스크 블러 강도
            edgeBlur: 10,        // 에지 블러 강도
            flipHorizontal: true // 수평 뒤집기 (셀카 모드)
        };
        
        // MediaPipe CDN 경로 설정 (여러 버전 설정)
        this.mediapipeCDNURLs = [
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest', // 최신 버전
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8', // 안정 버전 1
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3'  // 이전 버전 (기존 코드)
        ];
        this.mediapipeCDNURL = this.mediapipeCDNURLs[0]; // 기본적으로 최신 버전 사용
        this.currentCDNIndex = 0;
        
        this.maxRetries = 3;     // 초기화 최대 재시도 횟수
        this.retryCount = 0;     // 현재 재시도 횟수
        this.useMediaPipe = true; // MediaPipe 사용 여부 플래그
        
        console.log("PersonSegmenter 생성됨");
    }

    /**
     * 모델 초기화
     * MediaPipe Tasks Vision의 ImageSegmenter 모델 로드 및 초기화
     */
    async initialize() {
        try {
            // 모델이 이미 초기화되었는지 확인
            if (this.initialized) {
                return true;
            }

            console.log("PersonSegmenter 초기화 시작...");
            
            // MediaPipe 사용이 명시적으로 비활성화된 경우 폴백 메서드로 바로 전환
            if (!this.useMediaPipe) {
                console.warn("MediaPipe 사용이 비활성화되어 있습니다. 대체 메서드를 사용합니다.");
                return this.initFallbackMethod();
            }
            
            // MediaPipe 스크립트 로드
            try {
                await this._loadMediaPipeScripts();
            } catch (error) {
                console.error("MediaPipe 스크립트 로드 실패:", error);
                if (this.retryCount < this.maxRetries) {
                    this.retryCount++;
                    console.log(`${this.retryCount}번째 재시도 중... (최대 ${this.maxRetries}회)`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return this.initialize();
                } else {
                    this.useMediaPipe = false;
                    return this.initFallbackMethod();
                }
            }
            
            // ImageSegmenter 생성
            try {
                // 모델 URL
                const modelAssetPath = `${this.mediapipeCDNURL}/wasm/selfie_segmentation.tflite`;
                
                // Vision Tasks 로드
                const vision = await FilesetResolver.forVisionTasks(
                    `${this.mediapipeCDNURL}/wasm`
                );
                
                console.log("Vision Tasks 초기화 완료. ImageSegmenter 생성 중...");
                
                // ImageSegmenter 초기화
                this.imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: modelAssetPath,
                        delegate: "GPU"
                    },
                    runningMode: "IMAGE",
                    outputCategoryMask: true
                });
                
                console.log("MediaPipe ImageSegmenter 초기화 완료!");
                this.initialized = true;
                return true;
                
            } catch (gpuError) {
                console.warn("GPU 모드 실패:", gpuError);
                console.log("CPU 모드로 다시 시도합니다...");
                
                try {
                    const modelAssetPath = `${this.mediapipeCDNURL}/wasm/selfie_segmentation.tflite`;
                    const vision = await FilesetResolver.forVisionTasks(
                        `${this.mediapipeCDNURL}/wasm`
                    );
                    
                    this.imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
                        baseOptions: {
                            modelAssetPath: modelAssetPath,
                            delegate: "CPU"
                        },
                        runningMode: "IMAGE",
                        outputCategoryMask: true
                    });
                    
                    console.log("MediaPipe ImageSegmenter (CPU 모드) 초기화 완료!");
                    this.initialized = true;
                    return true;
                } catch (cpuError) {
                    console.error("CPU 모드에서도 실패:", cpuError);
                    this.useMediaPipe = false;
                    return this.initFallbackMethod();
                }
            }
            
        } catch (error) {
            console.error("모델 초기화 과정 중 예상치 못한 오류 발생:", error);
            return this.initFallbackMethod();
        }
    }
    
    /**
     * MediaPipe 스크립트 로드
     */
    async _loadMediaPipeScripts() {
        console.log("MediaPipe 스크립트 로드 중...");
        
        // 이미 로드되었는지 확인
        if (window.FilesetResolver && window.ImageSegmenter) {
            console.log("MediaPipe 모듈이 이미 로드되어 있습니다");
            return;
        }
        
        // 스크립트 로드
        return new Promise((resolve, reject) => {
            const loadScript = () => {
                // 기존 스크립트가 있으면 제거
                const existingScript = document.querySelector('script[data-mediapipe="vision-tasks"]');
                if (existingScript) {
                    existingScript.remove();
                }
                
                // 새 스크립트 생성
                const script = document.createElement('script');
                
                // 올바른 CDN 경로 구조 사용
                // IIFE 버전은 /wasm 하위 폴더에 있지 않고 루트에 있음
                script.src = `${this.mediapipeCDNURL}/vision_bundle.js`; // .min.js가 아닌 일반 버전 먼저 시도
                script.dataset.mediapipe = "vision-tasks";
                script.crossOrigin = "anonymous"; // CORS 오류 방지
                
                script.onload = () => {
                    console.log(`MediaPipe 스크립트 로드 완료 (${script.src})`);
                    
                    // 잠시 대기 후 FilesetResolver 정의 확인
                    setTimeout(() => {
                        if (window.FilesetResolver && window.ImageSegmenter) {
                            console.log("MediaPipe 객체가 전역 스코프에 성공적으로 로드됨");
                            resolve();
                        } else {
                            console.error("MediaPipe 스크립트가 로드되었지만 필요한 객체를 찾을 수 없음");
                            // 다음 CDN URL 시도
                            this.currentCDNIndex++;
                            if (this.currentCDNIndex < this.mediapipeCDNURLs.length) {
                                this.mediapipeCDNURL = this.mediapipeCDNURLs[this.currentCDNIndex];
                                console.log(`다음 CDN URL로 시도: ${this.mediapipeCDNURL}`);
                                setTimeout(loadScript, 500);  // 잠시 대기 후 다시 시도
                            } else {
                                // 모든 CDN URL 시도 실패
                                reject(new Error("MediaPipe 객체를 찾을 수 없음"));
                            }
                        }
                    }, 500);
                };
                
                script.onerror = (error) => {
                    console.error(`MediaPipe 스크립트 로드 실패 (${script.src}):`, error);
                    
                    // 먼저 압축 버전(.min.js) 시도
                    if (!script.src.includes('.min.js')) {
                        console.log("압축 버전(.min.js)으로 다시 시도합니다.");
                        script.src = `${this.mediapipeCDNURL}/vision_bundle.min.js`;
                        document.head.appendChild(script);
                        return;
                    }
                    
                    // 다음으로 direct_bundle 시도
                    if (!script.src.includes('direct')) {
                        console.log("direct_bundle 버전으로 다시 시도합니다.");
                        script.src = `${this.mediapipeCDNURL}/tasks-vision_direct_bundle.js`;
                        document.head.appendChild(script);
                        return;
                    }
                    
                    // 다음 CDN URL 시도
                    this.currentCDNIndex++;
                    if (this.currentCDNIndex < this.mediapipeCDNURLs.length) {
                        this.mediapipeCDNURL = this.mediapipeCDNURLs[this.currentCDNIndex];
                        console.log(`다음 CDN URL로 시도: ${this.mediapipeCDNURL}`);
                        setTimeout(loadScript, 500);  // 잠시 대기 후 다시 시도
                    } else {
                        // 모든 CDN URL 시도 실패
                        console.error("모든 CDN URL에서 MediaPipe 로드 실패");
                        reject(error);
                    }
                };
                
                document.head.appendChild(script);
            };
            
            // 첫 번째 URL로 로드 시작
            loadScript();
        });
    }

    /**
     * 폴백 메서드 초기화 (ImageSegmenter 로드 실패 시)
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
            // ImageSegmenter가 초기화되었으면 사용
            if (this.imageSegmenter) {
                return await this._segmentPersonWithImageSegmenter(frame);
            }
            // 그렇지 않으면 색상 기반 폴백 메서드 사용
            return this._segmentPersonByColor(frame);
        } catch (error) {
            console.error("인물 분리 중 오류 발생:", error);
            // 오류 발생 시 색상 기반 분리로 폴백
            return this._segmentPersonByColor(frame);
        }
    }

    /**
     * MediaPipe ImageSegmenter를 사용한 인물 분리
     */
    async _segmentPersonWithImageSegmenter(frame) {
        console.log("MediaPipe ImageSegmenter 인물 분리 시작...");

        const { width, height } = frame;
        
        try {
            // 캔버스를 이미지로 변환
            const imageBlob = await new Promise(resolve => {
                frame.toBlob(resolve, 'image/png');
            });
            
            if (!imageBlob) {
                throw new Error("캔버스를 이미지로 변환하는데 실패했습니다.");
            }
            
            // Blob을 이미지로 변환
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = URL.createObjectURL(imageBlob);
            });
            
            // ImageSegmenter로 이미지 분할
            const segmentationResult = this.imageSegmenter.segment(img);
            
            // 결과가 없으면 에러
            if (!segmentationResult || !segmentationResult.categoryMask) {
                throw new Error("유효한 분할 결과를 받지 못했습니다.");
            }
            
            // 카테고리 마스크 가져오기
            const mask = segmentationResult.categoryMask;
            
            // 결과 캔버스 생성 (인물 분리용)
            const personCanvas = document.createElement('canvas');
            personCanvas.width = width;
            personCanvas.height = height;
            const personCtx = personCanvas.getContext('2d');
            
            // 마스크 캔버스 생성
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = width;
            maskCanvas.height = height;
            const maskCtx = maskCanvas.getContext('2d');
            
            // 카테고리 마스크 데이터 처리
            const maskWidth = mask.width;
            const maskHeight = mask.height;
            const maskData = mask.getAsUint8Array();
            const maskImageData = maskCtx.createImageData(maskWidth, maskHeight);
            
            // 사람 클래스는 일반적으로 인덱스 1 (0은 배경)
            const personCategoryIndex = 1;
            let opaquePixels = 0;
            
            // 마스크 이미지 만들기
            for (let i = 0; i < maskData.length; i++) {
                const category = maskData[i];
                const dataIndex = i * 4; // RGBA 데이터의 인덱스
                
                if (category === personCategoryIndex) {
                    // 인물로 분류된 픽셀은 흰색으로 설정
                    maskImageData.data[dataIndex] = 255;     // R
                    maskImageData.data[dataIndex + 1] = 255; // G
                    maskImageData.data[dataIndex + 2] = 255; // B
                    maskImageData.data[dataIndex + 3] = 255; // Alpha (불투명)
                    opaquePixels++;
                } else {
                    // 배경은 투명하게 설정
                    maskImageData.data[dataIndex] = 0;       // R
                    maskImageData.data[dataIndex + 1] = 0;   // G
                    maskImageData.data[dataIndex + 2] = 0;   // B
                    maskImageData.data[dataIndex + 3] = 0;   // Alpha (투명)
                }
            }
            
            // 통계 정보
            const totalPixels = maskWidth * maskHeight;
            const personRatio = opaquePixels / totalPixels;
            console.log(`인물 검출 비율: ${(personRatio * 100).toFixed(2)}% (${opaquePixels}/${totalPixels} 픽셀)`);
            
            // 마스크 이미지를 캔버스에 적용
            maskCtx.putImageData(maskImageData, 0, 0);
            
            // 원본 이미지 그리기
            personCtx.drawImage(img, 0, 0, width, height);
            
            // 마스크를 사용하여 인물만 유지하고 배경은 투명하게
            personCtx.globalCompositeOperation = 'destination-in';
            personCtx.drawImage(maskCanvas, 0, 0, width, height);
            personCtx.globalCompositeOperation = 'source-over';
            
            // 에지 블러 효과 적용 (부드러운 경계를 위해)
            const blurredCanvas = this._applyMaskBlur(personCanvas);
            
            // 메모리 해제
            URL.revokeObjectURL(img.src);
            
            // 결과 반환
            return {
                maskCanvas: maskCanvas,
                originalCanvas: frame,
                personCanvas: blurredCanvas
            };
            
        } catch (error) {
            console.error("MediaPipe ImageSegmenter 처리 중 오류:", error);
            console.warn("색상 기반 인물 분리로 폴백합니다.");
            return this._segmentPersonByColor(frame);
        }
    }

    /**
     * 마스크에 블러 효과 적용 (에지를 부드럽게 하기 위함)
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
                maskData[i] = r;       // 마스크의 빨간색 채널
                maskData[i + 1] = g;   // 마스크의 녹색 채널
                maskData[i + 2] = b;   // 마스크의 파란색 채널
                maskData[i + 3] = 255; // 마스크의 알파 채널 (완전 불투명)
            } else {
                // 피부색이 아닌 픽셀은 완전 투명하게 설정
                maskData[i] = 0;
                maskData[i + 1] = 0;
                maskData[i + 2] = 0;
                maskData[i + 3] = 0;
            }
        }
        
        // 디버깅: 피부색 감지 통계 출력
        const skinPercentage = (detectedSkinPixels / totalPixels) * 100;
        console.log(`피부색 감지: 총 ${totalPixels}픽셀 중 ${detectedSkinPixels}픽셀 감지 (${skinPercentage.toFixed(2)}%)`);
        
        // 마스크 개선 (노이즈 제거 및 에지 부드럽게)
        this._improveSegmentationMask(maskData, width, height);
        
        // 결과 마스크 적용
        maskCtx.putImageData(maskImageData, 0, 0);
        
        // 마스크 블러 처리 (에지를 부드럽게)
        const blurredMaskCanvas = this._applyMaskBlur(maskCanvas);
        
        // 원본 이미지와 마스크 결합하여 투명 배경의 인물만 표시
        const personCanvas = document.createElement('canvas');
        personCanvas.width = width;
        personCanvas.height = height;
        const personCtx = personCanvas.getContext('2d');
        
        // 원본 이미지 그리기
        personCtx.drawImage(frame, 0, 0);
        
        // 마스크를 사용하여 알파 채널 설정 (destination-in 연산)
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
        // 피부색에 대한 확장된 HSV 범위
        const isHueSkin = (h >= 0 && h <= 40) || (h >= 340 && h <= 360);
        const isSaturationOk = s >= 0.1 && s <= 0.7;
        const isValueOk = v >= 0.3 && v <= 0.95;
        
        return isHueSkin && isSaturationOk && isValueOk;
    }
    
    /**
     * 세그먼테이션 마스크 개선 (노이즈 제거 및 구멍 채우기)
     */
    _improveSegmentationMask(maskData, width, height) {
        // 간단한 모폴로지 연산 (팽창 후 침식)
        // 임시 버퍼 생성
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
                            if (maskData[nidx + 3] > 100) { // 어느 정도 불투명한 픽셀
                                hasNeighborPerson = true;
                                break;
                            }
                        }
                    }
                    if (hasNeighborPerson) break;
                }
                
                // 주변에 사람 픽셀이 있으면 현재 픽셀도 사람으로 설정
                if (hasNeighborPerson) {
                    tempBuffer[idx] = maskData[idx];
                    tempBuffer[idx + 1] = maskData[idx + 1];
                    tempBuffer[idx + 2] = maskData[idx + 2];
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
                
                // 현재 픽셀이 사람 픽셀이라면
                if (tempBuffer[idx + 3] > 0) {
                    // 주변 8개 픽셀에 대해 검사
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
                    
                    // 주변에 충분한 사람 픽셀이 없으면 제거 (노이즈 제거)
                    if (neighborCount < 4) {
                        maskData[idx + 3] = 0;
                    }
                }
            }
        }
    }
}