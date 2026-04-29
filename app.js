// --- 1. Jack Daniels VDOT Math Engine ---
// VO2 Cost & Percent Max approximations for JS
function getVO2Cost(velocity) {
    // velocity in m/min
    return -4.6 + 0.182258 * velocity + 0.000104 * Math.pow(velocity, 2);
}

function getPercentMax(timeMins) {
    return 0.8 + 0.1894393 * Math.exp(-0.012778 * timeMins) + 0.2989558 * Math.exp(-0.1932605 * timeMins);
}

// Calc VDOT from Distance(m) & Time(min)
function calcVDOT(distanceMeters, timeMins) {
    const velocity = distanceMeters / timeMins;
    const vo2 = getVO2Cost(velocity);
    const percentMax = getPercentMax(timeMins);
    return vo2 / percentMax;
}

// Binary search to find Time for a given VDOT & Distance
function calcTimeFromVDOT(vdot, distanceMeters) {
    let low = 5; // 5 mins
    let high = 1500; // 25 hours
    let mid = 0;
    
    for (let i = 0; i < 50; i++) {
        mid = (low + high) / 2;
        let testVDOT = calcVDOT(distanceMeters, mid);
        if (testVDOT > vdot) {
            low = mid; // Need more time to lower VDOT
        } else {
            high = mid; // Need less time to raise VDOT
        }
    }
    return mid; // in minutes
}

// --- 2. Helper Functions ---
function timeToMins(h, m, s) { return (h * 60) + m + (s / 60); }
function minsToFormattedTime(totalMins) {
    const h = Math.floor(totalMins / 60);
    const m = Math.floor(totalMins % 60);
    const s = Math.round((totalMins % 1) * 60);
    const pad = num => num.toString().padStart(2, '0');
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
}
function calcPace(mins, distMeters) {
    const minsPerKm = mins / (distMeters / 1000);
    const m = Math.floor(minsPerKm);
    const s = Math.round((minsPerKm % 1) * 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

const DISTANCES = {
    5000: { name: '5K' },
    10000: { name: '10K' },
    21097.5: { name: 'Half' },
    42195: { name: 'Full' }
};

// --- 3. UI State & Logic ---
let currentTab = 'tab1';

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        currentTab = e.target.dataset.target;
        
        // Toggle Inputs
        document.getElementById('tab2-inputs').classList.toggle('hidden', currentTab === 'tab1');
        // Toggle Results
        document.getElementById('tab1-results').classList.toggle('hidden', currentTab === 'tab2');
        document.getElementById('tab2-results').classList.toggle('hidden', currentTab === 'tab1');
        
        calculateAll(); // Recalculate on switch
    });
});

// Main Execution
function calculateAll() {
    // Read Base Inputs
    const h = parseFloat(document.getElementById('height').value);
    const w = parseFloat(document.getElementById('weight').value);
    const recDist = parseFloat(document.getElementById('recent-dist').value);
    const rh = parseFloat(document.getElementById('rec-h').value) || 0;
    const rm = parseFloat(document.getElementById('rec-m').value) || 0;
    const rs = parseFloat(document.getElementById('rec-s').value) || 0;
    
    const recMins = timeToMins(rh, rm, rs);
    if (recMins <= 0) return; // Prevent zero division

    // Base Calcs
    const bmi = w / Math.pow(h / 100, 2);
    const currentVDOT = calcVDOT(recDist, recMins);
    const absVO2 = (currentVDOT * w) / 1000;

    // Render Tab 1
    document.getElementById('out-vdot').innerText = currentVDOT.toFixed(1);
    document.getElementById('out-bmi').innerText = bmi.toFixed(1);
    document.getElementById('out-vo2abs').innerText = absVO2.toFixed(2);

    let tableHtml = '';
    for (let d in DISTANCES) {
        let distM = parseFloat(d);
        let pTimeMins = calcTimeFromVDOT(currentVDOT, distM);
        tableHtml += `
            <tr>
                <td>${DISTANCES[d].name}</td>
                <td class="text-right">${minsToFormattedTime(pTimeMins)}</td>
                <td class="text-right">${calcPace(pTimeMins, distM)}</td>
            </tr>
        `;
    }
    document.getElementById('predict-table-body').innerHTML = tableHtml;

    // Render Tab 2 (If active or logic needed)
    if (currentTab === 'tab2') {
        runVirtualCoach(currentVDOT, recMins);
    }
}

// --- 4. Virtual Coach Algorithm ---
function runVirtualCoach(curVDOT, recMins) {
    // Read Target Inputs
    const tgtDist = parseFloat(document.getElementById('target-dist').value);
    const th = parseFloat(document.getElementById('tgt-h').value) || 0;
    const tm = parseFloat(document.getElementById('tgt-m').value) || 0;
    const ts = parseFloat(document.getElementById('tgt-s').value) || 0;
    const tgtMins = timeToMins(th, tm, ts);
    
    const trainDays = parseInt(document.getElementById('train-days').value) || 4;
    const maxMins = parseInt(document.getElementById('train-max-mins').value) || 60;

    // Gap Calcs
    const targetVDOT = calcVDOT(tgtDist, tgtMins);
    const vdotGap = targetVDOT - curVDOT;
    
    const predictedCurTimeMins = calcTimeFromVDOT(curVDOT, tgtDist);
    const timeGapMins = predictedCurTimeMins - tgtMins;

    // Render Gap Table
    document.getElementById('out-target-vdot').innerText = targetVDOT.toFixed(1);
    document.getElementById('gap-cur-vdot').innerText = curVDOT.toFixed(1);
    document.getElementById('gap-tgt-vdot').innerText = targetVDOT.toFixed(1);
    
    const vdotDiffEl = document.getElementById('gap-diff-vdot');
    vdotDiffEl.innerText = (vdotGap > 0 ? '+' : '') + vdotGap.toFixed(1);
    vdotDiffEl.style.color = vdotGap <= 0 ? 'var(--success)' : (vdotGap > 2 ? 'var(--danger)' : 'var(--warning)');

    document.getElementById('gap-cur-time').innerText = minsToFormattedTime(predictedCurTimeMins);
    document.getElementById('gap-tgt-time').innerText = minsToFormattedTime(tgtMins);
    
    const timeDiffEl = document.getElementById('gap-diff-time');
    const sign = timeGapMins > 0 ? '-' : '+';
    timeDiffEl.innerText = sign + minsToFormattedTime(Math.abs(timeGapMins));
    timeDiffEl.style.color = timeGapMins <= 0 ? 'var(--success)' : (timeGapMins > 10 ? 'var(--danger)' : 'var(--warning)');

    // Condition-based Coach Logic
    let msg = "";
    let isEnduranceHeavy = (tgtDist === 21097.5 || tgtDist === 42195);

    if (vdotGap <= 0.5) {
        if (isEnduranceHeavy) {
            msg = "현재 심폐 능력(VDOT)은 목표를 달성하기에 충분합니다. 가장 큰 관건은 <strong>'근지구력'</strong>입니다. 목표 페이스로 지속주를 하는 특이성 훈련(Marathon Pace Run)과 주말 장거리(LSD)에 집중하여 다리 근육의 내성을 기르세요.";
        } else {
            msg = "목표 달성 가시권입니다. 현재의 폼을 유지하면서, 레이스 감각을 깨우기 위한 짧은 템포런과 리듬 위주의 조깅으로 테이퍼링을 준비해도 좋습니다.";
        }
    } else if (vdotGap > 0.5 && vdotGap <= 3) {
        msg = "목표를 위해 유산소 능력을 한 단계 끌어올려야 합니다. 젖산 역치를 높이는 <strong>Threshold(T) 페이스 훈련</strong>이 핵심입니다.";
        if (maxMins <= 60 && isEnduranceHeavy) {
            msg += " <br><br>⚠️ <em>시간 제약 조건 분석:</em> 1회 훈련 가능 시간이 60분 이하로, 하프/풀 코스를 위한 장거리 훈련(LSD)이 불가합니다. 제한된 시간 내에서 효율을 극대화하기 위해, 고밀도 인터벌과 템포런을 주 2회 이상 배치하여 심폐 마진을 극한으로 끌어올리는 전략이 필요합니다.";
        }
    } else {
        msg = "목표 수치와 현재 능력 간의 격차가 다소 큽니다 (VDOT Gap > 3). 무리한 페이스 설정은 부상으로 이어집니다. 우선 현재 VDOT에 맞춘 훈련 페이스로 베이스를 다지고, 단계적으로 목표를 수정해 나가는 것을 권장합니다.";
    }

    document.getElementById('coach-message').innerHTML = msg;

    // Schedule Generation Logic based on Constraints
    let scheduleHTML = "";
    const types = {
        'E': { label: 'Easy Run', desc: '가벼운 조깅 (회복 및 유산소 베이스 확보)', colorClass: 'type-E' },
        'T': { label: 'Tempo/Threshold', desc: '역치 훈련 (약 85-90% 강도, 20~40분 지속)', colorClass: 'type-T' },
        'I': { label: 'Intervals', desc: '최대산소섭취량 훈련 (강도 95% 이상, 휴식 반복)', colorClass: 'type-I' },
        'L': { label: 'Long Run', desc: '장거리 훈련 (지구력 향상)', colorClass: 'type-L' }
    };

    // Determine workout mix based on days and maxMins
    let plan = [];
    for (let i = 1; i <= trainDays; i++) {
        let type = 'E'; // Default
        if (trainDays >= 3) {
            if (i === 2) type = 'T'; // 2nd day is quality
            if (i === trainDays) { // Last day is long or quality
                if (maxMins > 60 && isEnduranceHeavy) {
                    type = 'L';
                } else {
                    type = (trainDays > 4) ? 'I' : 'T'; 
                }
            }
            if (trainDays >= 5 && i === 4) type = 'I'; // 4th day quality for high volume
        }
        
        // Time logic
        let duration = type === 'L' ? Math.min(maxMins, 120) : Math.min(maxMins, 50);
        if (type === 'E') duration = Math.min(maxMins, 40);

        plan.push(`
            <div class="schedule-item ${types[type].colorClass}">
                <div class="day-label tabular">Day ${i}</div>
                <div class="workout-desc">
                    <strong>${types[type].label} (${duration}분)</strong><br>
                    ${types[type].desc}
                </div>
            </div>
        `);
    }

    document.getElementById('coach-schedule').innerHTML = plan.join('');
}

// Initialize on load
window.addEventListener('DOMContentLoaded', calculateAll);

// Add event listeners to update in real-time on input change
const inputIds = ['height', 'weight', 'recent-dist', 'rec-h', 'rec-m', 'rec-s', 'target-dist', 'tgt-h', 'tgt-m', 'tgt-s', 'train-days', 'train-max-mins'];
inputIds.forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', calculateAll);
});
