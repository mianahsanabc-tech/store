import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";
import { getDatabase, ref, set, onValue, push } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js";

// FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyACVwVXRB_5nTFozs0PV22zd6wSpZuBVqE",
  authDomain: "reakweb.firebaseapp.com",
  databaseURL: "https://reakweb-default-rtdb.firebaseio.com",
  projectId: "reakweb",
  storageBucket: "reakweb.firebasestorage.app",
  messagingSenderId: "228639861953",
  appId: "1:228639861953:web:2941663bb550703b61b840"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// AUTH MANAGEMENT
let isRegisterMode = false;

window.switchAuthMode = (mode) => {
  isRegisterMode = (mode === 'register');
  document.getElementById('tab-login').classList.toggle('active', !isRegisterMode);
  document.getElementById('tab-register').classList.toggle('active', isRegisterMode);
  document.getElementById('auth-username').style.display = isRegisterMode ? 'block' : 'none';
  document.getElementById('auth-btn').textContent = isRegisterMode ? 'Register' : 'Sign In';
};

window.handleAuth = (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;

  if (isRegisterMode) {
    createUserWithEmailAndPassword(auth, email, password)
      .then(() => window.location.href = 'lobby.html')
      .catch(err => alert(err.message));
  } else {
    signInWithEmailAndPassword(auth, email, password)
      .then(() => window.location.href = 'lobby.html')
      .catch(err => alert(err.message));
  }
};

window.playAsGuest = () => {
  window.location.href = 'lobby.html';
};

// MULTIPLAYER POOL GAME CANVAS ENGINE
window.onload = () => {
  const canvas = document.getElementById('poolCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const powerFillEl = document.getElementById('powerFill');

  // Change Board Felt Color based on URL Arena Parameter
  const urlParams = new URLSearchParams(window.location.search);
  const arena = urlParams.get('arena') || 'pub';
  const feltColors = { pub: '#065f46', tokyo: '#1e40af', vegas: '#991b1b', gold: '#18181b' };
  canvas.style.backgroundColor = feltColors[arena] || '#065f46';

  const ballRadius = 11;
  const friction = 0.985;

  let balls = [
    { x: 250, y: 225, vx: 0, vy: 0, color: '#ffffff', isCue: true },
    { x: 620, y: 225, vx: 0, vy: 0, color: '#facc15' },
    { x: 642, y: 213, vx: 0, vy: 0, color: '#1d4ed8' },
    { x: 642, y: 237, vx: 0, vy: 0, color: '#b91c1c' },
    { x: 664, y: 201, vx: 0, vy: 0, color: '#6b21a8' },
    { x: 664, y: 225, vx: 0, vy: 0, color: '#000000', num: 8 }, // 8 Ball
    { x: 664, y: 249, vx: 0, vy: 0, color: '#c2410c' }
  ];

  let mouseX = 0, mouseY = 0, isCharging = false, currentPower = 0;

  canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  };

  canvas.onmousedown = () => {
    const isMoving = balls.some(b => Math.hypot(b.vx, b.vy) > 0.1);
    if (!isMoving) { isCharging = true; currentPower = 0; }
  };

  canvas.onmouseup = () => {
    if (!isCharging) return;
    isCharging = false;

    const cueBall = balls[0];
    if (cueBall) {
      const angle = Math.atan2(mouseY - cueBall.y, mouseX - cueBall.x);
      cueBall.vx = Math.cos(angle) * currentPower;
      cueBall.vy = Math.sin(angle) * currentPower;

      // Broadcast Shot Data to Firebase Realtime DB
      set(ref(db, 'active_match/lastShot'), {
        angle: angle,
        power: currentPower,
        time: Date.now()
      });
    }

    currentPower = 0;
    if (powerFillEl) powerFillEl.style.height = '0%';
  };

  function updatePhysics() {
    if (isCharging) {
      currentPower = Math.min(currentPower + 0.4, 24);
      if (powerFillEl) powerFillEl.style.height = `${(currentPower / 24) * 100}%`;
    }

    balls.forEach(b => {
      b.x += b.vx; b.y += b.vy;
      b.vx *= friction; b.vy *= friction;

      if (b.x - ballRadius < 0 || b.x + ballRadius > canvas.width) b.vx *= -1;
      if (b.y - ballRadius < 0 || b.y + ballRadius > canvas.height) b.vy *= -1;
    });
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cueBall = balls[0];
    const isMoving = balls.some(b => Math.hypot(b.vx, b.vy) > 0.1);

    // Aim Line & Wood Cue Stick
    if (cueBall && !isMoving) {
      const angle = Math.atan2(mouseY - cueBall.y, mouseX - cueBall.x);

      ctx.save();
      ctx.translate(cueBall.x, cueBall.y);
      ctx.rotate(angle);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(-200 - (currentPower * 3), -4, 180, 8); // Wooden cue
      ctx.restore();
    }

    // Render Balls
    balls.forEach(b => {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, ballRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    updatePhysics();
    requestAnimationFrame(render);
  }

  render();
};