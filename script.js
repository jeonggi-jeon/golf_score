import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getDatabase, ref, push, remove, onValue } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js';

const firebaseConfig = {
    apiKey: "AIzaSyBbS-55QWcBjCS0DKtC1jcY9MgGV9VXgR0",
    authDomain: "golfscore-69d17.firebaseapp.com",
    projectId: "golfscore-69d17",
    storageBucket: "golfscore-69d17.firebasestorage.app",
    messagingSenderId: "239382914777",
    appId: "1:239382914777:web:ac78311df2431991b8c0c8",
    measurementId: "G-ETWSB8QQL4",
    databaseURL: "https://golfscore-69d17-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const scoresRef = ref(database, 'scores');
const playersRef = ref(database, 'players');

let scores = [];
let scoresMap = {};
let players = [];
let playersMap = {};

function migrateLocalStorageToFirebase() {
    const STORAGE_KEY = 'golfScores';
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored) {
        try {
            const oldScores = JSON.parse(stored);
            if (Array.isArray(oldScores) && oldScores.length > 0) {
                console.log('localStorage에서 ' + oldScores.length + '개의 기록을 발견하여 Firebase로 이전 중...');

                oldScores.forEach(score => {
                    push(scoresRef, {
                        id: score.id,
                        playerName: score.playerName,
                        scoreDate: score.scoreDate,
                        course: score.course,
                        score: score.score
                    });
                });

                localStorage.removeItem(STORAGE_KEY);
                console.log('마이그레이션 완료!');
            }
        } catch (error) {
            console.error('마이그레이션 중 오류:', error);
        }
    }
}

function initializeData() {
    migrateLocalStorageToFirebase();

    onValue(scoresRef, (snapshot) => {
        scoresMap = {};
        scores = [];

        if (snapshot.exists()) {
            const data = snapshot.val();
            console.log('Firebase에서 로드한 데이터:', data);
            Object.entries(data).forEach(([key, value]) => {
                scoresMap[key] = value;
                scores.push({...value, firebaseKey: key});
            });
        } else {
            console.log('Firebase에 데이터가 없습니다.');
        }

        console.log('처리된 scores 배열:', scores);
        scores.sort((a, b) => b.id - a.id);
        updateStats();
    }, (error) => {
        console.error('Firebase 읽기 오류:', error);
    });

    onValue(playersRef, (snapshot) => {
        playersMap = {};
        players = [];

        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.entries(data).forEach(([key, value]) => {
                playersMap[key] = value;
                players.push({...value, firebaseKey: key});
            });
        }

        players.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
        updatePlayersScoresForm();
        updatePlayersList();
    }, (error) => {
        console.error('Firebase 선수 읽기 오류:', error);
    });
}

function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function addNewPlayer() {
    const playerInput = document.getElementById('newPlayerInput');
    const playerName = playerInput.value.trim();

    if (!playerName) {
        alert('선수명을 입력하세요.');
        return;
    }

    const isDuplicate = players.some(p => p.name === playerName);
    if (isDuplicate) {
        alert('이미 등록된 선수입니다.');
        playerInput.value = '';
        return;
    }

    push(playersRef, { name: playerName }).then(() => {
        playerInput.value = '';
        playerInput.focus();
    }).catch((error) => {
        alert('저장 실패: ' + error.message);
    });
}

function deletePlayer(firebaseKey) {
    if (!confirm('선수를 삭제하시겠습니까?')) {
        return;
    }

    const player = playersMap[firebaseKey];
    if (!player) {
        alert('선수 정보를 찾을 수 없습니다.');
        return;
    }

    const playerName = player.name;
    const relatedScores = scores.filter(s => s.playerName === playerName);

    let deleteScoresToo = false;
    if (relatedScores.length > 0) {
        deleteScoresToo = confirm(
            `이 선수의 스코어 기록 ${relatedScores.length}건도 함께 삭제할까요?\n\n` +
            '확인: 선수와 스코어 기록 모두 삭제\n취소: 선수만 삭제(스코어는 통계에 유지)'
        );
    }

    const removes = [];
    if (deleteScoresToo) {
        relatedScores.forEach(s => {
            removes.push(remove(ref(database, `scores/${s.firebaseKey}`)));
        });
    }
    removes.push(remove(ref(database, `players/${firebaseKey}`)));

    Promise.all(removes).catch((error) => {
        alert('삭제 실패: ' + error.message);
    });
}

function openPlayerManagementModal() {
    document.getElementById('playerManagementModal').classList.add('show');
}

function closePlayerManagementModal() {
    document.getElementById('playerManagementModal').classList.remove('show');
}

function pickRandomPlayer() {
    if (players.length === 0) {
        alert('등록된 선수가 없습니다.');
        return;
    }

    openPickPlayerModal();
}

function openPickPlayerModal() {
    const pickPlayersList = document.getElementById('pickPlayersList');

    if (players.length === 0) {
        pickPlayersList.innerHTML = '<p class="empty-message">등록된 선수가 없습니다.</p>';
        document.getElementById('pickPlayerModal').classList.add('show');
        return;
    }

    pickPlayersList.innerHTML = players.map(player => `
        <div class="pick-player-item">
            <input type="checkbox" class="player-checkbox" data-player-name="${escapeHtml(player.name)}" checked />
            <div class="pick-player-item-name">${escapeHtml(player.name)}</div>
        </div>
    `).join('');

    document.getElementById('pickPlayerModal').classList.add('show');
}

function closePickPlayerModal() {
    document.getElementById('pickPlayerModal').classList.remove('show');
}

function confirmPickPlayer() {
    const checkboxes = document.querySelectorAll('.player-checkbox:checked');
    const selectedPlayers = Array.from(checkboxes).map(cb => cb.getAttribute('data-player-name'));

    if (selectedPlayers.length === 0) {
        alert('최소 한 명의 선수를 선택해주세요.');
        return;
    }

    const teams = divideTeams(selectedPlayers);
    displayDividedTeams(teams);
    closePickPlayerModal();
}

function divideTeams(players) {
    const isOdd = players.length % 2 === 1;
    let playersToDiv = [...players];
    let joker = null;

    // 배열을 먼저 섞기
    for (let i = playersToDiv.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [playersToDiv[i], playersToDiv[j]] = [playersToDiv[j], playersToDiv[i]];
    }

    if (isOdd) {
        // 마지막 선수를 조커로 지정
        const jokerPlayer = playersToDiv[playersToDiv.length - 1];
        joker = `${jokerPlayer} 🃏`;
        // 조커를 제외한 나머지
        const playersWithoutJoker = playersToDiv.slice(0, playersToDiv.length - 1);
        const teamSize = playersWithoutJoker.length / 2;
        const team1 = playersWithoutJoker.slice(0, teamSize);
        const team2 = playersWithoutJoker.slice(teamSize);
        return { team1, team2, joker };
    } else {
        // 짝수인 경우 2팀으로 균등하게 나눔
        const mid = playersToDiv.length / 2;
        const team1 = playersToDiv.slice(0, mid);
        const team2 = playersToDiv.slice(mid);
        return { team1, team2, joker };
    }
}

function displayDividedTeams(teams) {
    const team1Container = document.getElementById('team1Players');
    const team2Container = document.getElementById('team2Players');
    const jokerSection = document.getElementById('jokerSection');
    const jokerContainer = document.getElementById('jokerPlayer');

    team1Container.innerHTML = teams.team1.map(player => `
        <div class="team-player-item">
            ${player}
        </div>
    `).join('');

    team2Container.innerHTML = teams.team2.map(player => `
        <div class="team-player-item">
            ${player}
        </div>
    `).join('');

    if (teams.joker) {
        jokerContainer.innerHTML = `
            <div class="team-player-item">
                ${teams.joker}
            </div>
        `;
        jokerSection.style.display = 'block';
    } else {
        jokerSection.style.display = 'none';
    }

    const modal = document.getElementById('dividedTeamsModal');
    modal.classList.add('show');

    // 별가루 효과 생성
    createSparkles();

    // 컨테이너 초기 상태 설정 (블러 효과를 위해)
    const teamsContainer = document.getElementById('teamsContainer');
    teamsContainer.style.opacity = '0';
    teamsContainer.style.filter = 'blur(20px)';
}

function createSparkles() {
    const sparkleEmojis = ['✨', '⭐', '🌟', '💫', '✨'];
    const sparkleCount = 50;

    for (let i = 0; i < sparkleCount; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle';
        sparkle.textContent = sparkleEmojis[Math.floor(Math.random() * sparkleEmojis.length)];

        // 화면 중앙에서 시작
        const startX = window.innerWidth / 2;
        const startY = window.innerHeight / 2;

        sparkle.style.left = startX + 'px';
        sparkle.style.top = startY + 'px';

        // 랜덤한 방향으로 날아갈 거리 계산
        const angle = (Math.random() * Math.PI * 2);
        const distance = 300 + Math.random() * 400;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;

        sparkle.style.setProperty('--tx', tx + 'px');
        sparkle.style.setProperty('--ty', ty + 'px');
        sparkle.style.animation = 'sparkleFloatSlow 3s ease-out forwards';

        // 약간의 지연 추가 (연쇄 효과)
        sparkle.style.animationDelay = (Math.random() * 0.3) + 's';

        document.body.appendChild(sparkle);

        // 애니메이션 끝나면 요소 제거
        setTimeout(() => {
            sparkle.remove();
        }, 3500);
    }
}

function closeDividedTeamsModal() {
    document.getElementById('dividedTeamsModal').classList.remove('show');
}

function updatePlayersScoresForm() {
    const container = document.getElementById('playersScoresContainer');

    if (players.length === 0) {
        container.innerHTML = '<p class="empty-message">등록된 선수가 없습니다. 선수 관리에서 선수를 추가해주세요.</p>';
        return;
    }

    container.innerHTML = players.map((player, index) => `
        <div class="player-score-row">
            <div class="player-name">${escapeHtml(player.name)}</div>
            <input type="number" class="player-score-input" data-player-name="${escapeHtml(player.name)}" placeholder="스코어 입력" />
        </div>
    `).join('');
}

function updatePlayersList() {
    const playersList = document.getElementById('playersList');

    if (players.length === 0) {
        playersList.innerHTML = '<p class="empty-message">등록된 선수가 없습니다.</p>';
        return;
    }

    playersList.innerHTML = players.map(player => `
        <div class="player-item">
            <div class="player-item-name">${escapeHtml(player.name)}</div>
            <button class="btn-delete-player" onclick="deletePlayer('${player.firebaseKey}')">삭제</button>
        </div>
    `).join('');
}

function addScore() {
    const scoreDate = document.getElementById('scoreDate').value;
    const course = document.getElementById('course').value.trim();

    if (!scoreDate || !course) {
        alert('날짜와 코스를 입력해주세요.');
        return;
    }

    const scoreInputs = document.querySelectorAll('.player-score-input');
    let hasValidScore = false;

    const scoresToAdd = [];
    scoreInputs.forEach(input => {
        const playerName = input.getAttribute('data-player-name');
        const scoreValue = input.value.trim();

        if (scoreValue !== '') {
            const score = parseInt(scoreValue);
            if (!isNaN(score)) {
                scoresToAdd.push({
                    playerName,
                    score,
                    scoreDate,
                    course
                });
                hasValidScore = true;
            }
        }
    });

    if (!hasValidScore) {
        alert('최소 한 명의 선수에 대해 스코어를 입력해주세요.');
        return;
    }

    Promise.all(scoresToAdd.map(scoreData => {
        return push(scoresRef, {
            id: Date.now() + Math.random(),
            playerName: scoreData.playerName,
            scoreDate: scoreData.scoreDate,
            course: scoreData.course,
            score: scoreData.score
        });
    })).then(() => {
        document.getElementById('scoreForm').reset();
        document.getElementById('scoreDate').valueAsDate = new Date();
        updatePlayersScoresForm();
    }).catch((error) => {
        alert('저장 실패: ' + error.message);
    });
}

function deleteScore(firebaseKey) {
    if (!confirm('정말로 삭제하시겠습니까?')) {
        return;
    }

    const element = document.querySelector(`[data-id="${firebaseKey}"]`);
    if (element) {
        element.classList.add('delete-animation');
        setTimeout(() => {
            remove(ref(database, `scores/${firebaseKey}`))
                .then(() => {
                    openPlayerModal(document.getElementById('modalPlayerName').textContent);
                })
                .catch((error) => {
                    alert('삭제 실패: ' + error.message);
                });
        }, 300);
    }
}

function updateStats() {
    if (scores.length === 0) {
        document.getElementById('playerStatsContainer').innerHTML = '<p class="empty-message">아직 기록이 없습니다.</p>';
        return;
    }

    updatePlayerStats();
}

function updatePlayerStats() {
    const playerMap = {};

    scores.forEach(score => {
        if (!playerMap[score.playerName]) {
            playerMap[score.playerName] = {
                count: 0,
                totalScore: 0
            };
        }
        playerMap[score.playerName].count++;
        playerMap[score.playerName].totalScore += score.score;
    });

    const playerStatsContainer = document.getElementById('playerStatsContainer');
    const playerNames = Object.keys(playerMap).sort();

    playerStatsContainer.innerHTML = playerNames.map(playerName => {
        const stats = playerMap[playerName];
        const avgScore = (stats.totalScore / stats.count).toFixed(1);
        return `
            <div class="player-stat-card" onclick="openPlayerModal('${playerName}')">
                <div class="player-stat-name">${escapeHtml(playerName)}</div>
                <div class="player-stat-info">
                    <div class="player-stat-item">
                        <div class="player-stat-item-label">기록</div>
                        <div class="player-stat-item-value">${stats.count}</div>
                    </div>
                    <div class="player-stat-item">
                        <div class="player-stat-item-label">평균</div>
                        <div class="player-stat-item-value">${avgScore}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function openPlayerModal(playerName) {
    const playerRecords = scores.filter(s => s.playerName === playerName);

    document.getElementById('modalPlayerName').textContent = escapeHtml(playerName);

    const totalRounds = playerRecords.length;
    const avgScore = (playerRecords.reduce((sum, r) => sum + r.score, 0) / totalRounds).toFixed(1);

    document.getElementById('modalPlayerStats').innerHTML = `
        <div class="modal-player-stat-item">
            <div class="modal-player-stat-label">총라운드</div>
            <div class="modal-player-stat-value">${totalRounds}</div>
        </div>
        <div class="modal-player-stat-item">
            <div class="modal-player-stat-label">평균스코어</div>
            <div class="modal-player-stat-value">${avgScore}</div>
        </div>
    `;

    const modalRecordsList = document.getElementById('modalRecordsList');
    const header = `
        <div class="record-header">
            <div class="record-field">날짜</div>
            <div class="record-field">코스</div>
            <div class="record-field">스코어</div>
            <div class="record-actions"></div>
        </div>
    `;

    const records = playerRecords.map(record => `
        <div class="record-item" data-id="${record.firebaseKey}">
            <div class="record-field">
                <div class="record-value">${formatDate(record.scoreDate)}</div>
            </div>
            <div class="record-field">
                <div class="record-value">${escapeHtml(record.course)}</div>
            </div>
            <div class="record-field">
                <div class="record-value">${record.score}</div>
            </div>
            <div class="record-actions">
                <button class="btn-delete" onclick="deleteScore('${record.firebaseKey}')">삭제</button>
            </div>
        </div>
    `).join('');

    modalRecordsList.innerHTML = header + records;

    document.getElementById('playerModal').classList.add('show');
}

function closePlayerModal() {
    document.getElementById('playerModal').classList.remove('show');
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

window.openPlayerModal = openPlayerModal;
window.closePlayerModal = closePlayerModal;
window.deleteScore = deleteScore;
window.openPlayerManagementModal = openPlayerManagementModal;
window.closePlayerManagementModal = closePlayerManagementModal;
window.addNewPlayer = addNewPlayer;
window.deletePlayer = deletePlayer;
window.pickRandomPlayer = pickRandomPlayer;
window.openPickPlayerModal = openPickPlayerModal;
window.closePickPlayerModal = closePickPlayerModal;
window.confirmPickPlayer = confirmPickPlayer;
window.closeDividedTeamsModal = closeDividedTeamsModal;

document.getElementById('scoreForm').addEventListener('submit', (e) => {
    e.preventDefault();
    addScore();
});

document.getElementById('scoreDate').valueAsDate = new Date();

document.getElementById('playerModal').addEventListener('click', (e) => {
    if (e.target.id === 'playerModal') {
        closePlayerModal();
    }
});

document.getElementById('playerManagementModal').addEventListener('click', (e) => {
    if (e.target.id === 'playerManagementModal') {
        closePlayerManagementModal();
    }
});

document.getElementById('pickPlayerModal').addEventListener('click', (e) => {
    if (e.target.id === 'pickPlayerModal') {
        closePickPlayerModal();
    }
});

document.getElementById('dividedTeamsModal').addEventListener('click', (e) => {
    if (e.target.id === 'dividedTeamsModal') {
        closeDividedTeamsModal();
    }
});

document.getElementById('newPlayerInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addNewPlayer();
    }
});

initializeData();
