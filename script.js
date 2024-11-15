//Variables
const label = document.getElementById('object-name');
const labelText = document.getElementById('object-text');
const deselectButton = document.getElementById('deselect-button');
const colorMenu = document.getElementById('color-menu');

//Bools
let selectionEnabled = false; //Selection and highlighting are disabled

let highlightedObject = null;
let selectedObject = null;
let optionsVisible = false; // Track visibility state

let fovManuallySet = false; // Track if the FOV was changed manually

// Create the scene
const scene = new THREE.Scene();
const light = new THREE.DirectionalLight(0xffffff, 3); // Higher intensity for HDR effect
light.position.set(10, 10, 10);
scene.add(light);

// Create a camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);
camera.position.set(0, 0, 1); // Set initial position to a visible location
const originalFOV = camera.fov;

// Create the renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding; // Set output encoding to sRGB
renderer.toneMapping = THREE.ACESFilmicToneMapping; // Enable ACES tone mapping
renderer.toneMappingExposure = 3; // Adjust exposure as needed

// Initialize EffectComposer and passes
const composer = new THREE.EffectComposer(renderer);
const renderPass = new THREE.RenderPass(scene, camera);
composer.addPass(renderPass);


document.body.appendChild(renderer.domElement);

renderer.setClearColor(0x111111); // Sets a dark grey background

const textureLoader = new THREE.TextureLoader();
const texture = textureLoader.load('assets/Textures');
texture.encoding = THREE.sRGBEncoding;

//----------------------------Helpers-----------------------------//

// const axesHelper = new THREE.AxesHelper(5); // Size of the axes
// scene.add(axesHelper);

// const gridHelper = new THREE.GridHelper(125, 15); // Grid size and divisions
// scene.add(gridHelper);

// // const cameraHelper = new THREE.CameraHelper(camera);
// // scene.add(cameraHelper);

// const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
// directionalLight.position.set(10, 10, 10);
// scene.add(directionalLight);

// const directionalLightHelper = new THREE.DirectionalLightHelper(directionalLight, 5); // Size of helper
// scene.add(directionalLightHelper);

// const pointLight = new THREE.PointLight(0xffffff, 1, 100);
// pointLight.position.set(5, 5, 5);
// scene.add(pointLight);

// const pointLightHelper = new THREE.PointLightHelper(pointLight, 1); // Size of helper
// scene.add(pointLightHelper);

//----------------------------Helpers-----------------------------//

// Set up OutlinePass
const outlinePass = new THREE.OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
outlinePass.edgeStrength = 100;
outlinePass.edgeGlow = 0;
outlinePass.edgeThickness = 1;
outlinePass.pulsePeriod = 0; // No pulsing
outlinePass.visibleEdgeColor.set('#FF0000'); 
outlinePass.hiddenEdgeColor.set('#FF0000'); 
composer.addPass(outlinePass);

//Vignette
const vignetteShader = {
    uniforms: {
        tDiffuse: { value: null },
        offset: { value: 1.0 }, // Controls how far the darkening extends
        darkness: { value: 1.2 } // Controls the intensity of the darkening
    },
    vertexShader: `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
        `,
        fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float offset;
        uniform float darkness;
        varying vec2 vUv;
        
        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            float dist = distance(vUv, vec2(0.5, 0.5));
            color.rgb *= smoothstep(0.8, offset * 0.799, dist * (darkness + offset));
            gl_FragColor = color;
            }
            `
        };
        
        // Create a ShaderPass for the vignette effect
        const vignettePass = new THREE.ShaderPass(vignetteShader);
        
        // Adjust the vignette effect intensity and size
        vignettePass.uniforms.offset.value = .3; // Controls vignette size
        vignettePass.uniforms.darkness.value = .3; // Controls vignette intensity
        
// Add the vignette pass to the composer
composer.addPass(vignettePass);

const colorCorrectionShader = {
    uniforms: {
        tDiffuse: { value: null },
        brightness: { value: 0.0 },  // Default brightness (0.0 = neutral)
        contrast: { value: 1.0 }     // Default contrast (1.0 = neutral)
    },
    vertexShader: `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
        `,
        fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float brightness;
        uniform float contrast;
        varying vec2 vUv;
        
        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            color.rgb += brightness; // Adjust brightness
            color.rgb = (color.rgb - 0.5) * contrast + 0.5; // Adjust contrast
            gl_FragColor = color;
            }
            `
};
// Create a ShaderPass for color correction
const colorCorrectionPass = new THREE.ShaderPass(colorCorrectionShader);
        
// Add the ShaderPass to the composer
composer.addPass(colorCorrectionPass);

// Get slider elements
const brightnessSlider = document.getElementById('brightness-slider');
const contrastSlider = document.getElementById('contrast-slider');

// Update shader uniform values when sliders change
brightnessSlider.addEventListener('input', () => {
    colorCorrectionPass.uniforms.brightness.value = parseFloat(brightnessSlider.value);
});

contrastSlider.addEventListener('input', () => {
    colorCorrectionPass.uniforms.contrast.value = parseFloat(contrastSlider.value);
});
        
//Raycaster
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

//Mouse Event Listener
window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

//FOV Button
const fovButton = document.getElementById('fov-button');
const fovInput = document.getElementById('fov-input');

fovButton.addEventListener('click', () => {
    event.stopPropagation();
    const newFOV = parseFloat(fovInput.value); // Get value from the input field
    
    // Validate and apply the new FOV if it's within range
    if (!isNaN(newFOV) && newFOV >= 10 && newFOV <= 100) {
        camera.fov = newFOV;
        camera.updateProjectionMatrix(); // Apply the new FOV to the camera
        fovManuallySet = true; // Mark FOV as manually set
    } else {
        alert("Please enter a valid FOV between 10 and 100."); // Error message for invalid input
    }
});

//Camera Lock Button
const lockCameraButton = document.getElementById('lock-camera-button');
let cameraLocked = false;

lockCameraButton.addEventListener('click', () => {
    cameraLocked = !cameraLocked; // Toggle lock state
    controls.enabled = !cameraLocked; // Lock or unlock camera controls
    
    // Update button text
    lockCameraButton.textContent = cameraLocked ? "Unlock Camera" : "Lock Camera";
});

//Camera Reset Button
const resetCameraButton = document.getElementById('reset-camera-button');

resetCameraButton.addEventListener('click', () => {
    // Animate the camera position
    gsap.to(camera.position, {
        x: initialCameraPosition.x,
        y: initialCameraPosition.y,
        z: initialCameraPosition.z,
        duration: 1.5,
        ease: "power2.inOut",
        onUpdate: () => {
            camera.lookAt(controls.target);
        }
});

    // Optionally, animate the FOV (uncomment if needed)
    gsap.to(camera, {
        fov: initialCameraFOV,
        duration: 1.5,
        ease: "power2.inOut",
        onUpdate: () => {
            camera.updateProjectionMatrix();
        }
    });

    // Animate the controls target smoothly
    gsap.to(controls.target, {
        x: initialTarget.x,
        y: initialTarget.y,
        z: initialTarget.z,
        duration: 1.5,
        ease: "power2.inOut",
        onUpdate: () => {
            controls.update();
        }
    });
});

const toggleSelectionButton = document.getElementById('toggle-selection-button');
//Camera Settings and Selection Button
const optionButtons = [fovButton, fovInput, lockCameraButton, resetCameraButton, toggleSelectionButton];

const toggleOptionsButton = document.getElementById('toggle-options-button');


toggleOptionsButton.addEventListener('click', () => {
    optionsVisible = !optionsVisible; // Toggle the visibility state
    
    // Show or hide all option buttons based on the visibility state
    optionButtons.forEach(button => {
        button.style.display = optionsVisible ? 'inline-block' : 'none';
    });
    // Update the toggle button text based on the visibility state
    // toggleOptionsButton.textContent = optionsVisible ? '☰' : '☰';
});

//Toggle Selection Mode

toggleSelectionButton.addEventListener('click', () => {
    event.stopPropagation();
    selectionEnabled = !selectionEnabled;
    resetIdleTimer(); // Reset idle timer whenever selection mode changes
    
    // Update button text based on the new state
    toggleSelectionButton.textContent = selectionEnabled ? 'Disable Selection' : 'Enable Selection';
    
    // Deselect any currently selected object if selection mode is disabled
    if (!selectionEnabled && selectedObject) {
        outlinePass.selectedObjects = [];
        selectedObject = null;
        document.getElementById('object-name').style.opacity = '0'; // Hide label
        document.getElementById('object-name').style.display = 'none';
    }
});

//Settings Button
const settingsButton = document.getElementById('settings-button');
const scontrols = document.getElementById('controls');

settingsButton.addEventListener('click', () => {
    const isVisible = scontrols.style.display === 'block';
    gsap.to(scontrols.style, {
        display: isVisible ? 'none' : 'block',
        opacity: isVisible ? '0' : '1',
        duration: 0.2,
        ease: "power1.inOut",
    });
    // scontrols.style.display = isVisible ? 'none' : 'block';
    // scontrols.style.opacity = isVisible ? '0' : '1';
    gsap.to(scontrols.style, {
        display: isVisible ? 'none' : 'block',
        opacity: isVisible ? '0' : '1',
        duration: 0.2,
        ease: "power1.inOut",
    });
});

//Idle Camera Movement
let isIdle = false;

function applyIdleCameraMovement() {
    if (isIdle && !selectionEnabled) { // Only apply idle animation if selection is disabled
        camera.fov = 30;
        camera.updateProjectionMatrix();
        camera.position.x = Math.sin(Date.now() * 0.0002) * 0.1;
        camera.position.y = Math.sin(Date.now() * 0.0002) * 0.1;
        camera.lookAt(0, 0, 0); // Keep the camera focused
    }
}

let idleTimeout;
let countdownInterval;
let countdownValue = 2; // Countdown start value (in seconds)
const idleTimeLimit = 35000; // Idle time limit in milliseconds (15 seconds)

// Function to reset idle timer on user interaction
function resetIdleTimer() {
    // Clear any existing idle or countdown timers
    clearTimeout(idleTimeout);
    clearInterval(countdownInterval);
    isIdle = false;

    // Hide the idle timer display initially
    document.getElementById('idle-timer-display').style.display = 'none';

    // Only reset FOV if it hasn't been manually set
    if (!fovManuallySet) {
        camera.fov = originalFOV;
        camera.updateProjectionMatrix();
    }

    // Only start the idle timer and countdown if selection mode is disabled
    if (!selectionEnabled) {
        // Start a delayed timeout for countdown display (10 seconds after no interaction)
        idleTimeout = setTimeout(() => {
            countdownValue = 5; // Reset countdown to 5 seconds
            document.getElementById('idle-countdown').textContent = countdownValue; // Update the display text
            document.getElementById('idle-timer-display').style.display = 'block'; // Show the countdown display

            // Countdown timer every second
            countdownInterval = setInterval(() => {
                countdownValue -= 1;
                document.getElementById('idle-countdown').textContent = countdownValue;

                if (countdownValue <= 0) {
                    clearInterval(countdownInterval); // Stop countdown
                    document.getElementById('idle-timer-display').style.display = 'none'; // Hide countdown display
                    isIdle = true; // Set idle state to true
                    fovManuallySet = false; // Reset FOV tracking when idle mode is reactivated
                }
            }, 1000);
        }, idleTimeLimit - 5000); // Start the countdown 5 seconds before idle mode activates
    }
}

// Event listeners to reset the idle timer on user interaction
window.addEventListener('mousemove', resetIdleTimer);
window.addEventListener('mousedown', resetIdleTimer);
window.addEventListener('touchstart', resetIdleTimer);


// Click event to select an object and focus the camera on it
window.addEventListener('click', (event) => {
    // Prevent interaction if clicking "X" button, selection is disabled, or camera is moving
    if (event.target === deselectButton || !selectionEnabled || cameraIsMoving) return;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    // Check if an object is already selected; if so, ignore other clicks
    if (selectedObject) return;

    // If no object is selected, proceed with selection and focus
    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;

        // Highlight the newly clicked object and set it as selected
        outlinePass.selectedObjects = [clickedObject];
        selectedObject = clickedObject;

        // Display the name of the selected object
        labelText.textContent = `${clickedObject.name}`;
        label.style.display = 'block';
        label.style.opacity = '1';     
    }
});

// Deselect the object when "X" button is clicked
deselectButton.addEventListener('click', () => {
    if (selectedObject) {
        outlinePass.selectedObjects = [];
        selectedObject = null;
        labelText.textContent = ''; // Clear the label
        label.style.opacity = '0'; // Fade out the label
        setTimeout(() => label.style.display = 'none', 300); // Hide after transition
    }
});


// Array to hold the origin dots for toggling visibility
let originDots = [];

// Function to add origin dots to each object's origin
function addOriginDots(model) {
    const originMaterial = new THREE.PointsMaterial({ color: 0x000000, size: 0.06 });
    originMaterial.depthTest = false; // Disable depth testing

    const outlineMaterial = new THREE.PointsMaterial({
        color: 0xfc2000,
        size: 0.04,
        opacity: 1,
        transparent: true,
        depthTest: false,
    });

    const outlineOffset = new THREE.Vector3(0, 0, -0.001);

    model.traverse((child) => {
        if (child.isMesh) {
            const objectOrigin = new THREE.Vector3();
            child.getWorldPosition(objectOrigin);

            const dotGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0)]);
            const originDot = new THREE.Points(dotGeometry, originMaterial);
            originDot.position.copy(objectOrigin);
            originDot.renderOrder = 1;
            originDot.visible = false; // Set initially hidden
            originDot.layers.set(1); // Assign to layer 1

            const outlineDot = new THREE.Points(dotGeometry, outlineMaterial);
            outlineDot.position.copy(objectOrigin).add(outlineOffset);
            outlineDot.renderOrder = 0;
            outlineDot.visible = false; // Set initially hidden
            outlineDot.layers.set(1); // Assign to layer 1

            // Add both dots to the scene and store them in the array
            scene.add(outlineDot);
            scene.add(originDot);
            originDots.push(originDot, outlineDot); // Store for toggling
        }
    });
}
// Configure the raycaster to ignore layer 1
raycaster.layers.enable(0); // Enable default layer 0 for selection
raycaster.layers.disable(1); // Disable layer 1 to ignore origin dots

// Toggle the visibility of the origin dots and adjust camera layers
const toggleOriginsButton = document.getElementById('toggle-origins-button');
let originsVisible = false;

toggleOriginsButton.addEventListener('click', () => {
    originsVisible = !originsVisible;
    
    originDots.forEach((dot) => {
        dot.visible = originsVisible; // Toggle visibility of each dot
    });

    // Adjust camera layers to show or hide the origin layer
    if (originsVisible) {
        camera.layers.enable(1); // Enable layer 1 to show origins
    } else {
        camera.layers.disable(1); // Disable layer 1 to hide origins
    }

    // Update button text
    toggleOriginsButton.textContent = originsVisible ? "Hide Origins" : "Show Origins";
});

// Load the GLTF model
const loader = new THREE.GLTFLoader();
loader.load(
    './assets/scene.glb',
    (gltf) => {
        const model = gltf.scene;
        model.position.set(-.35, -1, -3);
        model.scale.set(1, 1, 1);
        scene.add(model);
        console.log("Model loaded successfully"); // Debugging line
        // Add origin dots to each object in the model
        addOriginDots(model);
    },
    undefined,
    (error) => {
        console.error('An error occurred while loading the model:', error);
    }
);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Enable damping for smooth controls
controls.dampingFactor = 0.06; // Adjust the damping factor (lower is smoother)
controls.zoomSpeed = 1; // Adjust zoom speed (lower is smoother)
controls.rotateSpeed = 0.5; // Adjust rotation speed (optional, makes rotation slower)
controls.panSpeed = 0.5; // Adjust pan speed (optional, makes panning slower)
controls.update();

// Variable to track if the camera is moving
let cameraIsMoving = false;

// // Disable selection while the camera is moving
controls.addEventListener('start', () => {
    cameraIsMoving = true;
});

// Re-enable selection when camera movement stops
controls.addEventListener('end', () => {
    cameraIsMoving = false;
});


// 3. Define initial camera settings
const initialCameraPosition = camera.position.clone(); // Clone the initial position
const initialCameraFOV = camera.fov; // Store initial FOV
const initialTarget = controls.target.clone(); // Clone the initial target


// // Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Only allow hover highlighting if selectionEnabled is true and no object is selected
    if (selectionEnabled && !selectedObject) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);
        if (intersects.length > 0) {
            const closestObject = intersects[0].object;

            if (highlightedObject !== closestObject) {
                if (highlightedObject) {
                    outlinePass.selectedObjects = [];
                }
                outlinePass.selectedObjects = [closestObject];
                highlightedObject = closestObject;
            }
        } else if (highlightedObject) {
            outlinePass.selectedObjects = [];
            highlightedObject = null;
        }
    } else if (highlightedObject && highlightedObject !== selectedObject) {
        outlinePass.selectedObjects = [];
        highlightedObject = null;
    }

    // Update the position of the label near the selected object
    if (selectedObject) {
        const objectPosition = new THREE.Vector3();
        selectedObject.getWorldPosition(objectPosition); // Get the object's world position
        const projectedPosition = objectPosition.clone().project(camera); // Project the 3D position to 2D

        // Convert the normalized device coordinates to screen coordinates
        const x = (projectedPosition.x * 0.5 + 0.5) * window.innerWidth;
        const y = (1 - (projectedPosition.y * 0.5 + 0.5)) * window.innerHeight;

        // Set the label position near the corner of the selected object
        const label = document.getElementById('object-name');
        label.style.transform = `translate(${x + 10}px, ${y - 30}px)`; // Adjust offsets as needed
    }

    if (isIdle) {
        applyIdleCameraMovement();
    }

    // Update controls if not idle
    if (controls && !isIdle) {
        controls.update();
    }

    controls.update();
    composer.render();
}

animate();
