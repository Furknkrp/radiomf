document.addEventListener("DOMContentLoaded", () => {
    
    // --- 1. ÇEVİRMELİ DÜĞME (KNOB) MANTIK ALTYAPISI (Güncellendi) ---
    function makeKnobRotatable(knobElement, initialRotation, onRotateCallback) {
        let isDragging = false;
        let startAngle = 0;
        let currentRotation = initialRotation; 

        knobElement.style.transform = `rotate(${currentRotation}deg)`;

        const startInteraction = (clientX, clientY) => {
            isDragging = true;
            const rect = knobElement.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            startAngle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI) - currentRotation;
        };

        knobElement.addEventListener("mousedown", (e) => startInteraction(e.clientX, e.clientY));
        knobElement.addEventListener("touchstart", (e) => startInteraction(e.touches[0].clientX, e.touches[0].clientY), {passive: true});

        const handleMove = (clientX, clientY) => {
            if (!isDragging) return;
            const rect = knobElement.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            let angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
            let rotation = angle - startAngle;

            if (rotation < -135) rotation = -135;
            if (rotation > 135) rotation = 135;

            currentRotation = rotation;
            knobElement.style.transform = `rotate(${currentRotation}deg)`;

            let percentage = (currentRotation + 135) / 270;
            onRotateCallback(percentage, false);
        };

        document.addEventListener("mousemove", (e) => handleMove(e.clientX, e.clientY));
        document.addEventListener("touchmove", (e) => handleMove(e.touches[0].clientX, e.touches[0].clientY), {passive: false});

        const handleEnd = () => {
            if(isDragging) {
                isDragging = false;
                onRotateCallback(null, true); 
            }
        };

        document.addEventListener("mouseup", handleEnd);
        document.addEventListener("touchend", handleEnd);
    }

    // --- 2. SES KONTROLÜ VE EKRAN GÖSTERİMİ ---
    const volumeKnob = document.getElementById("volume-knob");
    const audioPlayer = document.getElementById("audio-player");
    const volOverlay = document.getElementById("volume-overlay");
    
    // SESİ %100'DEN BAŞLAT
    audioPlayer.volume = 1.0; 
    let volHideTimeout;

    // DÜĞMEYİ 135 DERECE (MAKSİMUM) KONUMUNDAN BAŞLAT
    makeKnobRotatable(volumeKnob, 135, (percentage, isDragEnd) => {
        if (!isDragEnd) {
            audioPlayer.volume = percentage;
            volOverlay.innerText = `VOL: ${Math.round(percentage * 100)}`;
            volOverlay.style.opacity = "1";
            clearTimeout(volHideTimeout);
        } else {
            volHideTimeout = setTimeout(() => { volOverlay.style.opacity = "0"; }, 800);
        }
    });

    let audioCtx;
    function initAudio() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }

    // --- 3. KANAL DEĞİŞTİRME VE CIZIRTI MOTORU ---
    const tuningKnob = document.getElementById("tuning-knob");
    const tuningNeedle = document.getElementById("tuning-needle");
    
    let staticNoise;
    let gainNode;
    let isNoisePlaying = false;

    function initStaticNoise(ctxAudio) {
        const bufferSize = ctxAudio.sampleRate * 2; 
        const buffer = ctxAudio.createBuffer(1, bufferSize, ctxAudio.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1; 
        
        staticNoise = ctxAudio.createBufferSource();
        staticNoise.buffer = buffer;
        staticNoise.loop = true;
        
        gainNode = ctxAudio.createGain();
        gainNode.gain.value = 0; 
        
        staticNoise.connect(gainNode);
        gainNode.connect(ctxAudio.destination);
        staticNoise.start();
        isNoisePlaying = true;
    }

    // TUNING DÜĞMESİNİ -45 DERECE (MİNİMUM) KONUMUNDAN BAŞLAT
    makeKnobRotatable(tuningKnob, -45, (percentage, isDragEnd) => {
        const ctxAudio = initAudio();
        if (!isNoisePlaying) initStaticNoise(ctxAudio);

        if (isDragEnd) {
            if(gainNode) gainNode.gain.setTargetAtTime(0, ctxAudio.currentTime, 0.1);
            tuningNeedle.style.transition = 'transform 0.15s ease-out';
            tuningNeedle.style.transform = 'translateX(0px)';
        } else {
            if(gainNode) gainNode.gain.setTargetAtTime(0.15, ctxAudio.currentTime, 0.05);
            tuningNeedle.style.transition = 'none'; 
            const jitterAmount = (Math.random() * 6) - 3; 
            tuningNeedle.style.transform = `translateX(${jitterAmount}px)`;
        }
    });

    // --- 4. SİMÜLE EDİLMİŞ RETRO EQ (SPOTIFY STYLE) SES DALGASI ---
    const canvas = document.getElementById("visualizer");
    const canvasCtx = canvas.getContext("2d");
    let isPlayingAnim = false;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const numBars = 60; 
    const bars = [];
    for (let i = 0; i < numBars; i++) {
        bars.push({ current: 2, target: 2 });
    }

    function drawSimulatedWave() {
        requestAnimationFrame(drawSimulatedWave);
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        const centerY = canvas.height / 2;
        const barWidth = Math.min(8, (canvas.width * 0.8) / numBars - 4); 
        const gap = barWidth * 0.8;
        const totalWidth = numBars * (barWidth + gap);
        const startX = (canvas.width - totalWidth) / 2;

        canvasCtx.lineCap = "round";
        canvasCtx.lineWidth = barWidth;
        
        canvasCtx.strokeStyle = "rgba(255, 218, 51, 0.9)";
        canvasCtx.shadowBlur = 15;
        canvasCtx.shadowColor = "rgba(255, 218, 51, 0.8)";

        for (let i = 0; i < numBars; i++) {
            if (isPlayingAnim) {
                if (Math.random() < 0.12) {
                    const distanceFromCenter = Math.abs(i - numBars / 2) / (numBars / 2);
                    const maxHeight = 140 - (distanceFromCenter * 80); 
                    bars[i].target = Math.random() * maxHeight + 5;
                }
            } else {
                bars[i].target = 2; 
            }

            bars[i].current += (bars[i].target - bars[i].current) * 0.15;

            const h = bars[i].current;
            
            canvasCtx.beginPath();
            canvasCtx.moveTo(startX + i * (barWidth + gap), centerY - h / 2);
            canvasCtx.lineTo(startX + i * (barWidth + gap), centerY + h / 2);
            canvasCtx.stroke();
        }
    }
    drawSimulatedWave();

    // --- 5. MEDYA TUŞLARI VE MEKANİK "TAK" SESİ ---
    function playMechanicalTak() {
        const ctxAudio = initAudio();
        
        const osc = ctxAudio.createOscillator();
        const oscGain = ctxAudio.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, ctxAudio.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(10, ctxAudio.currentTime + 0.05);
        oscGain.gain.setValueAtTime(1, ctxAudio.currentTime);
        oscGain.gain.exponentialRampToValueAtTime(0.01, ctxAudio.currentTime + 0.05);
        osc.connect(oscGain);
        oscGain.connect(ctxAudio.destination);
        
        const bufferSize = ctxAudio.sampleRate * 0.05;
        const buffer = ctxAudio.createBuffer(1, bufferSize, ctxAudio.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        
        const noise = ctxAudio.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = ctxAudio.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 800; 
        const noiseGain = ctxAudio.createGain();
        noiseGain.gain.setValueAtTime(0.8, ctxAudio.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, ctxAudio.currentTime + 0.05);
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(ctxAudio.destination);
        
        osc.start();
        noise.start();
        osc.stop(ctxAudio.currentTime + 0.1);
        noise.stop(ctxAudio.currentTime + 0.1);
    }

    const mechButtons = document.querySelectorAll(".mech-btn");
    mechButtons.forEach(btn => {
        btn.addEventListener("mousedown", playMechanicalTak);
        btn.addEventListener("touchstart", () => { playMechanicalTak(); }, { passive: true });
    });

    const playBtn = document.getElementById("play-pause-btn");
    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");

    // Çalma Listesi Mantığı
    const playlist = ["yeni-kayit.mp3", "radio2.mp3", "m-icin.mp3"];
    let currentTrackIndex = 0; // 0: yeni-kayit.mp3, 1: radio2.mp3, 2: m-icin.mp3
    let hasLiveButtonAppeared = false;

    const liveBtn = document.getElementById("live-connect-btn");
    
    // Canlı yayına bağlan butonunu 15. saniyede göster, şarkı değişene kadar kalsın
    audioPlayer.addEventListener("timeupdate", () => {
        if (currentTrackIndex === 0) {
            if (audioPlayer.currentTime >= 15) {
                hasLiveButtonAppeared = true;
            }
            if (hasLiveButtonAppeared) {
                liveBtn.style.opacity = "1";
                liveBtn.style.pointerEvents = "all";
            } else {
                liveBtn.style.opacity = "0";
                liveBtn.style.pointerEvents = "none";
            }
        } else {
            liveBtn.style.opacity = "0";
            liveBtn.style.pointerEvents = "none";
        }
    });

    // Müziği oynatmayı başlatan ve UI'ı güncelleyen yardımcı fonksiyon
    function playCurrentTrack() {
        let playPromise = audioPlayer.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                isPlayingAnim = true;
                playBtn.querySelector('.btn-face').innerHTML = "❚❚"; 
            }).catch(error => {
                console.error("Müzik çalınamadı. Dosyalar klasörde mi?", error);
                isPlayingAnim = false;
                playBtn.querySelector('.btn-face').innerHTML = "▶"; 
            });
        }
    }

    // Şarkı değiştirme fonksiyonu
    function changeTrack(direction) {
        if (direction === 'next') {
            currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
        } else {
            currentTrackIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
        }
        
        hasLiveButtonAppeared = false; // Şarkı değiştiğinde durumu sıfırla
        
        audioPlayer.src = playlist[currentTrackIndex];
        audioPlayer.currentTime = 0; // Şarkıyı en başa sar
        playCurrentTrack(); // Değiştikten sonra otomatik çal
    }

    // Tuşlara Olay Dinleyicileri Ekle
    prevBtn.addEventListener("click", () => changeTrack('prev'));
    nextBtn.addEventListener("click", () => changeTrack('next'));

    playBtn.addEventListener("click", () => {
        if (audioPlayer.paused) {
            playCurrentTrack();
        } else {
            audioPlayer.pause();
            isPlayingAnim = false;
            playBtn.querySelector('.btn-face').innerHTML = "▶"; 
        }
    });
});