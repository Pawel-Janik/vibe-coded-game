import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// Game variables
let score = 0;
let lives = 3;
let gameOver = false;
let finalExplosionActive = false;
const scoreElement = document.getElementById('scoreValue');
const livesElement = document.getElementById('livesValue');
const gameOverScreen = document.getElementById('gameOver');
const finalScoreValue = document.getElementById('finalScoreValue');
const restartButton = document.getElementById('restartButton');

// Movement constants
const playerSpeed = 0.2;
const enemySpeed = 0.15;  // Slightly slower than player
const maxTilt = Math.PI / 6;  // 30 degrees
const tiltSpeed = 0.1;

// Projectiles arrays
const playerProjectiles = [];
const enemyProjectiles = [];
const projectileSpeed = 1.0;
let canShoot = true;
const shootCooldown = 250; // Cooldown in milliseconds

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

// Player movement
const keys = {
    left: false,
    right: false,
    up: false,
    down: false,
    shoot: false
};

window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;
    if (e.key === 'ArrowUp') keys.up = true;
    if (e.key === 'ArrowDown') keys.down = true;
    if (e.code === 'Space') keys.shoot = true;
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
    if (e.key === 'ArrowUp') keys.up = false;
    if (e.key === 'ArrowDown') keys.down = false;
    if (e.code === 'Space') keys.shoot = false;
});

// Create a projectile
function createProjectile(isEnemy = false) {
    const projectileGeometry = new THREE.CylinderGeometry(0.05, 0.05, 2, 8);
    projectileGeometry.rotateX(Math.PI / 2);  // Rotate to point forward
    
    const projectileMaterial = new THREE.MeshPhongMaterial({
        color: isEnemy ? 0xff0000 : 0x00ff00,
        emissive: isEnemy ? 0xff0000 : 0x00ff00,
        emissiveIntensity: 2,
        transparent: true,
        opacity: 0.8
    });
    const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
    
    if (isEnemy) {
        // Get random enemy position
        const enemy = obstacles[Math.floor(Math.random() * obstacles.length)];
        if (enemy) {
            projectile.position.copy(enemy.position);
            projectile.position.z += 1; // Spawn in front of the enemy
            scene.add(projectile);
            enemyProjectiles.push(projectile);
        }
    } else {
        // Player projectile
        projectile.position.copy(player.position);
        projectile.position.z -= 1; // Spawn in front of the player
        scene.add(projectile);
        playerProjectiles.push(projectile);
    }
}

// Create explosion effect
function createExplosion(position, isPlayerHit = false) {
    const particleCount = 30;  // More particles for bigger explosion
    const particles = new THREE.Group();
    
    const color = isPlayerHit ? 0x00ff44 : 0xff4400;  // Green for player, red for enemies
    const emissive = isPlayerHit ? 0x00ff22 : 0xff2200;
    
    for (let i = 0; i < particleCount; i++) {
        const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const material = new THREE.MeshPhongMaterial({
            color: color,
            emissive: emissive,
            emissiveIntensity: 2,
            transparent: true,
            opacity: 1
        });
        
        const particle = new THREE.Mesh(geometry, material);
        particle.position.copy(position);
        
        // Random velocity for each particle
        const speed = isPlayerHit ? 0.4 : 0.3;  // Bigger explosion for player hit
        particle.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * speed,
            (Math.random() - 0.5) * speed,
            (Math.random() - 0.5) * speed
        );
        
        particles.add(particle);
    }
    
    scene.add(particles);
    
    // Animate and remove after 1 second
    let aliveTime = 0;
    function animateExplosion() {
        if (aliveTime > 1000) {
            scene.remove(particles);
            return;
        }
        
        particles.children.forEach(particle => {
            particle.position.add(particle.velocity);
            particle.material.opacity -= 0.02;
            particle.scale.multiplyScalar(0.98);
        });
        
        aliveTime += 16.7;
        requestAnimationFrame(animateExplosion);
    }
    
    animateExplosion();
}

// Create huge final explosion
function createFinalExplosion(position) {
    finalExplosionActive = true;
    const particleCount = 200;  // Lots of particles
    const particles = new THREE.Group();
    const colors = [0x00ff00, 0x00dd00, 0x00ff44];  // Different shades of green
    
    for (let i = 0; i < particleCount; i++) {
        const size = Math.random() * 0.5 + 0.3;  // Bigger particles
        const geometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshPhongMaterial({
            color: colors[Math.floor(Math.random() * colors.length)],
            emissive: 0x00ff00,
            emissiveIntensity: 3,
            transparent: true,
            opacity: 1
        });
        
        const particle = new THREE.Mesh(geometry, material);
        particle.position.copy(position);
        
        // Random velocity in all directions with higher speed
        const speed = 1.0;  // Much faster than regular explosions
        const angle = Math.random() * Math.PI * 2;
        const height = (Math.random() - 0.5) * 2;
        particle.velocity = new THREE.Vector3(
            Math.cos(angle) * speed,
            height * speed,
            Math.sin(angle) * speed
        );
        
        // Add random rotation
        particle.rotationSpeed = new THREE.Vector3(
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.2
        );
        
        particles.add(particle);
    }
    
    scene.add(particles);
    
    // Animate explosion
    let aliveTime = 0;
    function animateExplosion() {
        if (aliveTime > 2000) {  // Longer duration (2 seconds)
            scene.remove(particles);
            finalExplosionActive = false;
            // Show game over screen after explosion finishes
            gameOverScreen.style.display = 'block';
            finalScoreValue.textContent = score;
            return;
        }
        
        particles.children.forEach(particle => {
            // Update position
            particle.position.add(particle.velocity);
            
            // Add gravity effect
            particle.velocity.y -= 0.01;
            
            // Rotate particles
            particle.rotation.x += particle.rotationSpeed.x;
            particle.rotation.y += particle.rotationSpeed.y;
            particle.rotation.z += particle.rotationSpeed.z;
            
            // Fade out
            if (aliveTime > 1000) {  // Start fading after 1 second
                particle.material.opacity -= 0.02;
            }
            
            // Slow down over time
            particle.velocity.multiplyScalar(0.99);
        });
        
        aliveTime += 16.7;
        requestAnimationFrame(animateExplosion);
    }
    
    animateExplosion();
}

// Reset player position
function resetPlayerPosition() {
    player.position.set(0, 0, 0);
    player.rotation.set(0, 0, 0);
}

// Handle player hit
function handlePlayerHit() {
    createExplosion(player.position.clone(), true);
    lives--;
    livesElement.textContent = lives;
    
    if (lives <= 0) {
        gameOver = true;
        player.visible = false;
        createFinalExplosion(player.position.clone());
        return true;
    }
    
    return false;
}

// Handle shooting
function handleShooting() {
    if (keys.shoot && canShoot) {
        createProjectile(false);  // Player projectile
        canShoot = false;
        setTimeout(() => {
            canShoot = true;
        }, shootCooldown);
    }
    
    // Random enemy shooting
    if (Math.random() < 0.02 && obstacles.length > 0) {  // 2% chance per frame
        createProjectile(true);  // Enemy projectile
    }
}

// Check collision between projectile and enemy
function checkProjectileCollision(projectile, enemy) {
    const distance = projectile.position.distanceTo(enemy.position);
    return distance < 2; // Increased collision radius for better gameplay
}

// Create enemy ship
function createEnemyShip() {
    const enemyGroup = new THREE.Group();
    
    // Main body
    const bodyGeometry = new THREE.BoxGeometry(1, 0.4, 1);
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xff0000,
        emissive: 0x330000,
        shininess: 50
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    enemyGroup.add(body);
    
    // Wings (larger and more aggressive looking than player wings)
    const wingGeometry = new THREE.BoxGeometry(2, 0.1, 0.7);
    const wingMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xcc0000,
        emissive: 0x330000,
        shininess: 50
    });
    
    // Left wing (horizontal)
    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.set(-1, 0, 0);
    enemyGroup.add(leftWing);
    
    // Right wing (horizontal)
    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.position.set(1, 0, 0);
    enemyGroup.add(rightWing);
    
    // Wing tips
    const tipGeometry = new THREE.BoxGeometry(0.3, 0.15, 1.2);
    const tipMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x880000,
        emissive: 0x330000,
        shininess: 50
    });
    
    const leftTip = new THREE.Mesh(tipGeometry, tipMaterial);
    leftTip.position.set(-2, 0, 0);
    enemyGroup.add(leftTip);
    
    const rightTip = new THREE.Mesh(tipGeometry, tipMaterial);
    rightTip.position.set(2, 0, 0);
    enemyGroup.add(rightTip);

    return enemyGroup;
}

// Create obstacle
function createObstacle() {
    const enemy = createEnemyShip();
    enemy.position.z = -50;  // Start further away
    enemy.position.x = Math.random() * 20 - 10;  // Random X between -10 and 10
    enemy.position.y = Math.random() * 10 - 5;   // Random Y between -5 and 5
    
    scene.add(enemy);
    obstacles.push(enemy);
}

// Update obstacle color based on distance
function updateObstacleColor(obstacle) {
    const distance = obstacle.position.z;  // Distance from camera
    const intensity = Math.min(1, (distance + 50) / -30);  // Normalize to 0-1
    const baseColor = 0.3;  // Minimum brightness
    const colorValue = baseColor + (1 - baseColor) * intensity;
    
    // Update all materials in the enemy ship
    obstacle.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.material.emissive.setRGB(colorValue * 0.5, 0, 0);
            child.material.opacity = 0.5 + intensity * 0.5;
        }
    });
}

// Check collision
function checkCollision(obj1, obj2) {
    const distance = obj1.position.distanceTo(obj2.position);
    return distance < 1;
}

// Game loop
function animate() {
    requestAnimationFrame(animate);

    // Only update game logic if not game over or final explosion is still playing
    if (!gameOver || finalExplosionActive) {
        // Handle shooting
        if (!gameOver) {
            handleShooting();

            // Create new obstacles
            if (Math.random() < 0.02) {
                createObstacle();
            }
        }

        // Update player projectiles
        for (let i = playerProjectiles.length - 1; i >= 0; i--) {
            const projectile = playerProjectiles[i];
            projectile.position.z -= projectileSpeed;

            // Remove projectiles that are too far
            if (projectile.position.z < -50) {
                scene.remove(projectile);
                playerProjectiles.splice(i, 1);
                continue;
            }

            if (!gameOver) {
                // Check collisions with enemies
                for (let j = obstacles.length - 1; j >= 0; j--) {
                    const enemy = obstacles[j];
                    if (checkProjectileCollision(projectile, enemy)) {
                        createExplosion(enemy.position, false);
                        scene.remove(projectile);
                        scene.remove(enemy);
                        playerProjectiles.splice(i, 1);
                        obstacles.splice(j, 1);
                        score++;
                        scoreElement.textContent = score;
                        break;
                    }
                }
            }
        }

        // Update enemy projectiles
        for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
            const projectile = enemyProjectiles[i];
            projectile.position.z += projectileSpeed;

            // Remove projectiles that are too far
            if (projectile.position.z > 10) {
                scene.remove(projectile);
                enemyProjectiles.splice(i, 1);
                continue;
            }

            // Check collision with player
            if (!gameOver && checkProjectileCollision(projectile, player) && player.visible) {
                scene.remove(projectile);
                enemyProjectiles.splice(i, 1);
                if (handlePlayerHit()) continue;
            }
        }

        // Player movement
        if (!gameOver) {
            if (keys.left && player.position.x > -10) player.position.x -= playerSpeed;
            if (keys.right && player.position.x < 10) player.position.x += playerSpeed;
            if (keys.up && player.position.y < 5) player.position.y += playerSpeed;
            if (keys.down && player.position.y > -5) player.position.y -= playerSpeed;

            // Add tilt when moving
            const targetRollTilt = keys.left ? 0.3 : (keys.right ? -0.3 : 0);  // Roll (z-axis)
            const targetPitchTilt = keys.up ? -0.3 : (keys.down ? 0.3 : 0);    // Pitch (x-axis)
            
            // Smooth rotation transitions
            player.rotation.z += (targetRollTilt - player.rotation.z) * 0.1;
            player.rotation.x += (targetPitchTilt - player.rotation.x) * 0.1;
        }

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

        // Update obstacles
        if (!gameOver) {
            for (let i = obstacles.length - 1; i >= 0; i--) {
                const obstacle = obstacles[i];
                
                // Calculate direction to player
                const directionToPlayer = new THREE.Vector3()
                    .subVectors(player.position, obstacle.position)
                    .normalize();
                
                // Store previous position for tilt calculation
                const previousX = obstacle.position.x;
                
                // Move towards player with similar controls as player
                obstacle.position.z += 0.1;  // Forward movement
                obstacle.position.x += directionToPlayer.x * enemySpeed;  // Left/right movement
                obstacle.position.y += directionToPlayer.y * enemySpeed;  // Up/down movement
                
                // Constrain movement to game bounds
                obstacle.position.x = Math.max(-10, Math.min(10, obstacle.position.x));
                obstacle.position.y = Math.max(-5, Math.min(5, obstacle.position.y));
                
                // Calculate movement direction for tilt
                const xMovement = obstacle.position.x - previousX;
                
                // Apply roll (left/right tilt) based on horizontal movement
                const targetRoll = -xMovement * 10;  // Multiply for more noticeable effect
                obstacle.rotation.z = THREE.MathUtils.lerp(
                    obstacle.rotation.z,
                    THREE.MathUtils.clamp(targetRoll, -maxTilt, maxTilt),
                    tiltSpeed
                );
                
                // Apply pitch (up/down tilt) based on vertical target direction
                const targetPitch = directionToPlayer.y * (maxTilt / 2);  // Half the max tilt for pitch
                obstacle.rotation.x = THREE.MathUtils.lerp(
                    obstacle.rotation.x,
                    THREE.MathUtils.clamp(targetPitch, -maxTilt/2, maxTilt/2),
                    tiltSpeed
                );
                
                updateObstacleColor(obstacle);

                // Check collision
                if (checkCollision(player, obstacle) && player.visible) {
                    scene.remove(obstacle);
                    obstacles.splice(i, 1);
                    if (handlePlayerHit()) continue;
                }

                // Remove obstacles that pass the camera
                if (obstacle.position.z > 10) {
                    scene.remove(obstacle);
                    obstacles.splice(i, 1);
                }
            }
        }
    }

    // Always render
    renderer.render(scene, camera);
    backgroundRenderer.render(backgroundScene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    backgroundRenderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize game
function initGame() {
    score = 0;
    lives = 3;
    gameOver = false;
    finalExplosionActive = false;
    scoreElement.textContent = score;
    livesElement.textContent = lives;
    gameOverScreen.style.display = 'none';
    
    // Clear all objects
    while(obstacles.length > 0) {
        const obstacle = obstacles.pop();
        scene.remove(obstacle);
    }
    while(playerProjectiles.length > 0) {
        const projectile = playerProjectiles.pop();
        scene.remove(projectile);
    }
    while(enemyProjectiles.length > 0) {
        const projectile = enemyProjectiles.pop();
        scene.remove(projectile);
    }
    
    // Reset player
    resetPlayerPosition();
    player.visible = true;
    
    // Reset game speed and difficulty
    enemySpeed = 0.05;  // Reset enemy speed
    projectileSpeed = 1.0;  // Reset projectile speed
    
    // Reset shooting cooldown
    canShoot = true;
    shootCooldown = 250;  // Reset shooting cooldown
    
    // Reset all timers and intervals
    lastSpeedIncrease = Date.now();
}

// Add event listener for restart button
restartButton.addEventListener('click', () => {
    initGame();
    animate();
});

// Start the game
animate();
