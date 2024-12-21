let state = {
    enabled: false,
    window: null,
    timer: null,
    videoIndex: 0,
    ws: null
};

const VID_CONFIG = {
    videos: ['video1.mp4', 'video2.mp4', 'video3.mp4', 'video4.mp4', 'video5.mp4', 'video6.mp4', 'video7.mp4', 'video8.mp4', 'video9.mp4', 'video10.mp4'],
    delays: {
        initial: () => Math.floor(Math.random() * (5 - 2 + 1) + 2) * 1000,      // 2-5s
        between: () => Math.floor(Math.random() * (180 - 120 + 1) + 120) * 1000 // 2-3m
    },
    styles: {
        window: `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 2147483647;
            width: 640px;
            height: 640px;
            background: #000;
            border-radius: 24px;
            box-shadow: 0 0 50px rgba(0,0,0,0.5);
            overflow: hidden;
            transition: all 0.5s ease-in-out;
        `,
        video: `
            width: 100%;
            height: 100%;
            display: block;
            object-fit: cover;
        `,
        errorMsg: `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            text-align: center;
            color: #fff;
            background: rgba(0,0,0,0.5);
            padding: 12px 24px;
            border-radius: 8px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            z-index: 999999;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
        `
    }
};

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

shuffleArray(VID_CONFIG.videos);

function initWebSocket() {
    if (state.ws) return;
    
    try {
        state.ws = new WebSocket('ws://localhost:8766');
        state.ws.onmessage = ({data}) => {
            try {
                const response = JSON.parse(data);
                
                console.log(response)
                // Create/update error message element
                let errorMsg = document.getElementById('voice-error-msg');
                if (!errorMsg && state.window) {
                    errorMsg = document.createElement('div');
                    errorMsg.id = 'voice-error-msg';
                    errorMsg.style.cssText = VID_CONFIG.styles.errorMsg;
                    document.body.appendChild(errorMsg);
                }

                if (response.phrase) {
                    removeAd();
                } else if (errorMsg && response.error) {
                    errorMsg.textContent = response.error;
                    errorMsg.style.opacity = '1';
 
                    setTimeout(() => {
                        errorMsg.style.opacity = '0';
                    }, 3000);
                }
            } catch (err) {
                console.error('WebSocket message error:', err);
            }
        };
    } catch (err) {
        console.error('WebSocket connection failed:', err);
    }
}

async function createAd() {
    if (!state.enabled || state.window) return;

    const videoSrc = chrome.runtime.getURL(`data/videos/${VID_CONFIG.videos[state.videoIndex]}`);
    const silentSrc = chrome.runtime.getURL('data/videos/silent.mp4');
    state.videoIndex = (state.videoIndex + 1) % VID_CONFIG.videos.length;

    const adWindow = document.createElement('div');
    adWindow.className = 'floating-video-ad';
    adWindow.style.cssText = VID_CONFIG.styles.window;

    // Silent video iframe trick for autoplay
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.allow = 'autoplay';
    iframe.src = silentSrc;

    const video = document.createElement('video');
    video.style.cssText = VID_CONFIG.styles.video;
    video.src = videoSrc;
    video.autoplay = true;
    video.muted = false;
    video.loop = false;
    video.controls = false;
    video.playsInline = true;

    // Backup play on click
    video.addEventListener('click', () => video.play().catch(() => {}));

    // Cleanup on video end
    video.addEventListener('ended', removeAd);

    adWindow.appendChild(iframe);
    adWindow.appendChild(video);
    document.body.appendChild(adWindow);
    state.window = adWindow;
}

async function removeAd() {
    if (!state.window) return;
    
    state.window.style.transform = 'translate(-50%, -50%) scale(0)';
    state.window.style.opacity = '0';
    await new Promise(r => setTimeout(r, 500));
    state.window.remove();
    state.window = null;
}

async function scheduleNext(isInitial = false) {
    if (!state.enabled) return;

    const delay = isInitial ? VID_CONFIG.delays.initial() : VID_CONFIG.delays.between();
    await new Promise(r => setTimeout(r, delay));

    if (state.enabled && !state.window) {
        createAd();
        scheduleNext();
    }
}

function cleanup() {
    if (state.timer) {
        clearTimeout(state.timer);
        state.timer = null;
    }
    if (state.window) {
        state.window.remove();
        state.window = null;
    }
    if (state.ws) {
        state.ws.close();
        state.ws = null;
    }
}

chrome.storage.sync.get(['videoAds'], (result) => {
    state.enabled = result.videoAds ?? true;
    
    if (state.enabled) {
        initWebSocket();
        scheduleNext(true);
    }
});

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'featureToggle' && msg.feature === 'videoAds') {
        state.enabled = msg.enabled;
        
        if (!state.enabled) {
            cleanup();
        } else {
            initWebSocket();
            scheduleNext(true);
        }
    }
});
