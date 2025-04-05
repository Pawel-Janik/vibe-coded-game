import * as THREE from 'three';

// Game variables
let score = 0;
const scoreElement = document.getElementById('scoreValue');

// Scene setup
const scene = new THREE.Scene();
scene.background = null; // Make sure main scene has transparent background
const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);

// Create a gradient background
const vertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
}`;

const fragmentShader = `
varying vec2 vUv;
void main() {
    vec3 bottomColor = vec3(0.05, 0.0, 0.1);  // Dark purple-blue
    vec3 topColor = vec3(0.1, 0.05, 0.2);     // Lighter purple-blue
    vec3 color = mix(bottomColor, topColor, vUv.y);
    gl_FragColor = vec4(color, 1.0);
}`;

// Create separate renderer for background
const backgroundRenderer = new THREE.WebGLRenderer();
backgroundRenderer.setSize(window.innerWidth, window.innerHeight);
backgroundRenderer.domElement.style.position = 'fixed';
backgroundRenderer.domElement.style.zIndex = '-1';
document.body.appendChild(backgroundRenderer.domElement);

const backgroundScene = new THREE.Scene();
const backgroundCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const backgroundMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader
});
const backgroundGeometry = new THREE.PlaneGeometry(2, 2);
const backgroundMesh = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
backgroundScene.add(backgroundMesh);

// Main game renderer
const renderer = new THREE.WebGLRenderer({ alpha: true });  // Enable alpha
renderer.setClearColor(0x000000, 0);  // Set clear color to transparent
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);  
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);  
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// Add a spotlight to better illuminate obstacles
const spotlight = new THREE.SpotLight(0xffffff, 2);
spotlight.position.set(0, 10, 10);
spotlight.angle = Math.PI / 3;
spotlight.penumbra = 0.1;
spotlight.decay = 0;
spotlight.distance = 100;
scene.add(spotlight);

// Player ship
function createPlayerShip() {
    const shipGroup = new THREE.Group();
    
    // Main body (green cube)
    const bodyGeometry = new THREE.BoxGeometry(1, 0.4, 1);
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    shipGroup.add(body);
    
    // Left wing
    const leftWingGeometry = new THREE.BoxGeometry(1.5, 0.1, 0.7);
    const wingMaterial = new THREE.MeshPhongMaterial({ color: 0x00cc00 });
    const leftWing = new THREE.Mesh(leftWingGeometry, wingMaterial);
    leftWing.position.set(-0.8, 0, 0);
    shipGroup.add(leftWing);
    
    // Right wing
    const rightWing = new THREE.Mesh(leftWingGeometry, wingMaterial);
    rightWing.position.set(0.8, 0, 0);
    shipGroup.add(rightWing);
    
    // Wing tips
    const tipGeometry = new THREE.BoxGeometry(0.2, 0.15, 0.9);
    const tipMaterial = new THREE.MeshPhongMaterial({ color: 0x008800 });
    
    const leftTip = new THREE.Mesh(tipGeometry, tipMaterial);
    leftTip.position.set(-1.5, 0, 0);
    shipGroup.add(leftTip);
    
    const rightTip = new THREE.Mesh(tipGeometry, tipMaterial);
    rightTip.position.set(1.5, 0, 0);
    shipGroup.add(rightTip);
    
    return shipGroup;
}

const player = createPlayerShip();
scene.add(player);

// Obstacles array
const obstacles = [];
const obstacleGeometry = new THREE.BoxGeometry(1, 1, 1);

// Camera position
camera.position.z = 15;
camera.position.y = 8;
camera.rotation.x = -0.3;

// Add starfield background
const starsGeometry = new THREE.BufferGeometry();
const starsCount = 2000;  // Increased star count
const starsPositions = new Float32Array(starsCount * 3);

for (let i = 0; i < starsCount * 3; i += 3) {
    starsPositions[i] = Math.random() * 200 - 100;     // x: wider range
    starsPositions[i + 1] = Math.random() * 200 - 100; // y: wider range
    starsPositions[i + 2] = Math.random() * 200 - 100; // z: wider range
}

starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
const starsMaterial = new THREE.PointsMaterial({ 
    color: 0xFFFFFF, 
    size: 0.2,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true  // Stars get smaller with distance
});
const starField = new THREE.Points(starsGeometry, starsMaterial);
scene.add(starField);

// Game state
let gameOver = false;
let playerSpeed = 0.1;

// Player movement
const keys = {
    left: false,
    right: false,
    up: false,
    down: false
};

window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;
    if (e.key === 'ArrowUp') keys.up = true;
    if (e.key === 'ArrowDown') keys.down = true;
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
    if (e.key === 'ArrowUp') keys.up = false;
    if (e.key === 'ArrowDown') keys.down = false;
});

// Create obstacle
function createObstacle() {
    const obstacleMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xff0000,  
        emissive: 0x330000, 
        shininess: 50
    });
    const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
    obstacle.position.z = -50;  
    obstacle.position.x = Math.random() * 20 - 10;  
    obstacle.position.y = Math.random() * 10 - 5;   
    scene.add(obstacle);
    obstacles.push(obstacle);
}

// Update obstacle color based on distance
function updateObstacleColor(obstacle) {
    const distance = obstacle.position.z;  
    const intensity = Math.min(1, (distance + 50) / -30);  
    const baseColor = 0.3;  
    const colorValue = baseColor + (1 - baseColor) * intensity;
    
    obstacle.material.color.setRGB(1, 0, 0);  
    obstacle.material.emissive.setRGB(colorValue * 0.5, 0, 0);  
    obstacle.material.opacity = 0.5 + intensity * 0.5;  
}

// Check collision
function checkCollision(obj1, obj2) {
    const distance = obj1.position.distanceTo(obj2.position);
    return distance < 1;
}

// Game loop
function animate() {
    if (gameOver) return;
    requestAnimationFrame(animate);

    // Player movement
    if (keys.left && player.position.x > -10) player.position.x -= playerSpeed;
    if (keys.right && player.position.x < 10) player.position.x += playerSpeed;
    if (keys.up && player.position.y < 5) player.position.y += playerSpeed;
    if (keys.down && player.position.y > -5) player.position.y -= playerSpeed;

    // Add slight tilt when moving
    const targetTilt = keys.left ? 0.3 : (keys.right ? -0.3 : 0);
    player.rotation.z += (targetTilt - player.rotation.z) * 0.1;

    // Move starfield for additional motion effect
    starField.rotation.z += 0.0001;  // Slower rotation
    for(let i = 0; i < starsCount * 3; i += 3) {
        starsPositions[i + 2] += 0.05;  // Slower forward movement
        if(starsPositions[i + 2] > 100) {
            starsPositions[i + 2] = -100;
            // Randomize X and Y when star resets
            starsPositions[i] = Math.random() * 200 - 100;
            starsPositions[i + 1] = Math.random() * 200 - 100;
        }
    }
    starField.geometry.attributes.position.needsUpdate = true;

    // Create new obstacles
    if (Math.random() < 0.02) {
        createObstacle();
    }

    // Update obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        obstacle.position.z += 0.2;  
        updateObstacleColor(obstacle);  

        // Check collision
        if (checkCollision(player, obstacle)) {
            gameOver = true;
            alert('Game Over! Score: ' + score);
            return;
        }

        // Remove obstacles that pass the camera
        if (obstacle.position.z > 10) {
            scene.remove(obstacle);
            obstacles.splice(i, 1);
            score++;
            scoreElement.textContent = score;
        }
    }

    // Render background
    backgroundRenderer.render(backgroundScene, backgroundCamera);
    // Render main scene
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    backgroundRenderer.setSize(window.innerWidth, window.innerHeight);
});

// Start the game
animate();
