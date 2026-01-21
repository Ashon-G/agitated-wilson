import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import WebView from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { getAgent, AgentId } from '../data/agentPersonalities';

interface Agent3DProps {
  agentId: AgentId; // Must be a personality AgentId ('marcus' | 'sophia')
  accepted?: boolean;
  userName?: string;
  onGreetingComplete?: () => void;
  workspaceColor?: string;
  transparentBottom?: boolean;
  hasInboxItems?: boolean;
  onSpeechComplete?: () => void;
  showGrid?: boolean;
  modelScale?: number;
  modelOffsetY?: number;
}

export interface Agent3DRef {
  speak: (text: string) => Promise<void>;
  stopSpeaking: () => void;
}

const Agent3D = forwardRef<Agent3DRef, Agent3DProps>(({
  agentId,
  accepted = false,
  userName = 'there',
  onGreetingComplete,
  workspaceColor = '#60a5fa',
  transparentBottom = false,
  hasInboxItems = false,
  onSpeechComplete,
  showGrid = true,
  modelScale = 1,
  modelOffsetY = 0,
}, ref) => {
  // Log the workspace color received
  console.log('🎨 Agent3D received workspaceColor:', workspaceColor);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const webViewRef = useRef<WebView | null>(null);
  const [hasPlayedGreeting, setHasPlayedGreeting] = useState(false);

  // Get personality data for the agent
  const personality = getAgent(agentId);

  // Use personality data for gender, model URL, and voice
  const avatarGender = personality?.gender || 'female';
  const agentModelUrl = personality?.modelUrl || '';
  const voiceId = personality?.voiceId || '21m00Tcm4TlvDq8ikWAM';

  // Track previous inbox status to detect changes
  const prevHasInboxItemsRef = useRef(hasInboxItems);

  // Log agent info on mount
  useEffect(() => {
    if (personality) {
      console.log('Using personality agent:', personality.name, 'Gender:', personality.gender);
    }
  }, [agentId, personality]);

  // Handle inbox status changes - switch between idle and dance animations + show/hide icon
  useEffect(() => {
    // Only trigger animation change if hasInboxItems changes and webView is ready
    if (prevHasInboxItemsRef.current !== hasInboxItems && webViewRef.current && !loading) {
      console.log('Inbox status changed:', hasInboxItems);

      // Determine which animation to use
      const idleAnimUrl = avatarGender === 'male'
        ? 'https://raw.githubusercontent.com/readyplayerme/animation-library/master/masculine/glb/idle/M_Standing_Idle_Variations_003.glb'
        : 'https://raw.githubusercontent.com/readyplayerme/animation-library/master/feminine/glb/idle/F_Standing_Idle_Variations_003.glb';

      const danceAnimUrl = avatarGender === 'male'
        ? 'https://raw.githubusercontent.com/readyplayerme/animation-library/master/masculine/glb/dance/M_Dances_009.glb'
        : 'https://raw.githubusercontent.com/readyplayerme/animation-library/master/feminine/glb/dance/F_Dances_004.glb';

      const targetAnimationUrl = hasInboxItems ? danceAnimUrl : idleAnimUrl;

      webViewRef.current.postMessage(
        JSON.stringify({
          action: 'switchAnimation',
          animationUrl: targetAnimationUrl,
          showInboxIcon: hasInboxItems,
        }),
      );
    }

    prevHasInboxItemsRef.current = hasInboxItems;
  }, [hasInboxItems, avatarGender, loading]);

  useEffect(() => {
    console.log('Agent3D greeting effect:', { accepted, hasPlayedGreeting });
    if (accepted && webViewRef.current && !hasPlayedGreeting) {
      console.log('Starting avatar greeting...');
      setHasPlayedGreeting(true);

      webViewRef.current.postMessage(
        JSON.stringify({
          action: 'switchToTalking',
        }),
      );

      playGreeting();
    }
  }, [accepted, hasPlayedGreeting]);

  const playGreeting = async () => {
    // ElevenLabs API temporarily disabled - skip audio and complete immediately
    console.log('playGreeting called - ElevenLabs disabled, completing immediately');
    if (onGreetingComplete) {
      onGreetingComplete();
    }
  };

  // Reference for current sound to allow stopping
  const currentSoundRef = useRef<Audio.Sound | null>(null);

  // Generic speak function for dashboard cards
  const speak = async (text: string) => {
    // ElevenLabs API temporarily disabled - skip audio and complete immediately
    console.log('Agent speak called - ElevenLabs disabled, completing immediately:', text);
    if (onSpeechComplete) {
      onSpeechComplete();
    }
  };

  const stopSpeaking = () => {
    if (currentSoundRef.current) {
      currentSoundRef.current.stopAsync();
      currentSoundRef.current.unloadAsync();
      currentSoundRef.current = null;
    }
  };

  // Expose speak method via ref
  useImperativeHandle(ref, () => ({
    speak,
    stopSpeaking,
  }));

  // Use personality model URL
  const agentUrl = agentModelUrl;

  // Idle animations based on gender
  const idleAnimationUrl = avatarGender === 'male'
    ? 'https://raw.githubusercontent.com/readyplayerme/animation-library/master/masculine/glb/idle/M_Standing_Idle_Variations_003.glb'
    : 'https://raw.githubusercontent.com/readyplayerme/animation-library/master/feminine/glb/idle/F_Standing_Idle_Variations_003.glb';

  // Dance animations for inbox notifications based on gender
  const danceAnimationUrl = avatarGender === 'male'
    ? 'https://raw.githubusercontent.com/readyplayerme/animation-library/master/masculine/glb/dance/M_Dances_009.glb'
    : 'https://raw.githubusercontent.com/readyplayerme/animation-library/master/feminine/glb/dance/F_Dances_004.glb';

  const talkingAnimationUrl =
    'https://cdn.jsdelivr.net/gh/readyplayerme/animation-library@master/masculine/glb/expression/M_Talking_Variations_001.glb';

  // Memoize HTML to prevent WebView recreation on prop changes
  // Only recreate when essential properties change (agent model, colors)
  const html = useMemo(() => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background: ${transparentBottom
    ? 'linear-gradient(180deg, #0C0C0E 0%, #141416 30%, rgba(20, 20, 22, 0.8) 60%, transparent 100%)'
    : 'linear-gradient(180deg, #0C0C0E 0%, #141416 50%, #1A1A1D 100%)'};
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #avatar-container {
          width: 100%;
          height: 100%;
        }
        #loading {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-size: 18px;
          text-align: center;
          z-index: 100;
        }
        .instructions {
          position: absolute;
          bottom: 80px;
          left: 0;
          right: 0;
          text-align: center;
          color: white;
          font-size: 14px;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.5s;
          z-index: 50;
        }
        .instructions.visible {
          opacity: 1;
        }
        #exclamation-icon {
          position: absolute;
          top: 20%;
          left: 50%;
          transform: translateX(-50%);
          font-size: 48px;
          color: #F59E0B;
          font-weight: bold;
          text-shadow: 0 0 10px rgba(245, 158, 11, 0.8), 0 0 20px rgba(245, 158, 11, 0.6);
          z-index: 200;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s;
          animation: pulse 1.5s ease-in-out infinite;
        }
        #exclamation-icon.visible {
          opacity: 1;
        }
        @keyframes pulse {
          0%, 100% { transform: translateX(-50%) scale(1); }
          50% { transform: translateX(-50%) scale(1.1); }
        }
      </style>
    </head>
    <body>
      <div id="avatar-container"></div>
      <div id="loading">Loading 3D viewer...</div>
      <div class="instructions">Drag left or right to rotate</div>
      <div id="exclamation-icon">!</div>

      <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>

      <script>
        (function() {
          try {
            console.log('Starting Three.js initialization...');
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage('Starting initialization');

            const container = document.getElementById('avatar-container');
            const loadingEl = document.getElementById('loading');
            const instructionsEl = document.querySelector('.instructions');

            if (!THREE) {
              throw new Error('Three.js failed to load');
            }

            console.log('Three.js version:', THREE.REVISION);
            loadingEl.textContent = 'Setting up 3D scene...';

            const scene = new THREE.Scene();

            const camera = new THREE.PerspectiveCamera(
              50,
              window.innerWidth / window.innerHeight,
              0.1,
              1000
            );
            camera.position.set(0, 0.2, 3.2);

            // Performance optimization: Reduce pixel ratio and disable antialiasing
            const renderer = new THREE.WebGLRenderer({
              alpha: true,
              antialias: false, // Disable antialiasing for better performance
              powerPreference: 'low-power', // Prefer battery life over performance
            });
            renderer.setSize(window.innerWidth, window.innerHeight);
            // Limit pixel ratio to 1.5 to reduce rendering load (was devicePixelRatio up to 3)
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
            container.appendChild(renderer.domElement);

            console.log('Renderer created');
            loadingEl.textContent = 'Setting up lights...';

            // Performance optimization: Reduce number of lights from 11 to 3
            const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); // Increase ambient to compensate
            scene.add(ambientLight);

            // Keep only 2 directional lights instead of 8 point lights + 3 others
            const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
            keyLight.position.set(2, 3, 3);
            scene.add(keyLight);

            const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
            fillLight.position.set(-2, 1, -1);
            scene.add(fillLight);

            console.log('Lights created');

            // Performance optimization: Reduce particles from 100 to 30
            console.log('Creating particle system...');
            const particleCount = 30; // Reduced from 100 for better performance
            const particles = new THREE.BufferGeometry();
            const particlePositions = new Float32Array(particleCount * 3);
            const particleVelocities = [];

            for (let i = 0; i < particleCount; i++) {
              const radius = Math.random() * 3 + 1;
              const theta = Math.random() * Math.PI * 2;
              const phi = Math.random() * Math.PI;

              particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
              particlePositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) - 0.5;
              particlePositions[i * 3 + 2] = radius * Math.cos(phi);

              particleVelocities.push({
                x: (Math.random() - 0.5) * 0.01,
                y: Math.random() * 0.01 + 0.005,
                z: (Math.random() - 0.5) * 0.01
              });
            }

            particles.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

            const canvas = document.createElement('canvas');
            canvas.width = 32; // Reduced from 64 for better performance
            canvas.height = 32;
            const ctx = canvas.getContext('2d');

            const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 32, 32);

            const texture = new THREE.CanvasTexture(canvas);

            const particleMaterial = new THREE.PointsMaterial({
              map: texture,
              size: 0.04,
              transparent: true,
              opacity: 0.8,
              blending: THREE.AdditiveBlending,
              sizeAttenuation: true,
              depthWrite: false
            });

            const particleSystem = new THREE.Points(particles, particleMaterial);
            scene.add(particleSystem);

            console.log('Particle system created');

            // Conditionally add grid floor
            const shouldShowGrid = ${showGrid};
            if (shouldShowGrid) {
              console.log('Creating grid floor...');
              const gridSize = 10;
              const gridDivisions = 20;
              const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x333333, 0x1a1a1a);
              gridHelper.position.y = -1.1;
              scene.add(gridHelper);

              const floorGeometry = new THREE.PlaneGeometry(gridSize, gridSize);
              const floorMaterial = new THREE.MeshBasicMaterial({
                color: 0x0c0c0e,
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide
              });
              const floor = new THREE.Mesh(floorGeometry, floorMaterial);
              floor.rotation.x = -Math.PI / 2;
              floor.position.y = -1.11;
              scene.add(floor);
              console.log('Grid floor created');
            }

            const controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableZoom = false;
            controls.enablePan = false;
            controls.enableRotate = true;
            controls.minPolarAngle = Math.PI / 2;
            controls.maxPolarAngle = Math.PI / 2;
            camera.position.set(0, 0.2, 3.2);
            controls.target.set(0, -0.1, 0);
            controls.update();

            console.log('Controls created');
            loadingEl.textContent = 'Loading avatar model...';

            const loader = new THREE.GLTFLoader();
            let mixer;

            loader.load(
              '${agentUrl}',
              function(gltf) {
                console.log('Agent loaded successfully');
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage('Agent loaded');
                loadingEl.textContent = 'Loading animation...';

                const avatar = gltf.scene;
                const scale = ${modelScale};
                const offsetY = ${modelOffsetY};
                avatar.scale.set(scale, scale, scale);
                avatar.position.set(0, -1.1 * scale + offsetY, 0);
                scene.add(avatar);

                // Always load idle animation initially
                const animationUrl = '${idleAnimationUrl}';
                console.log('Loading animation:', animationUrl);

                loader.load(
                  animationUrl,
                  function(animGltf) {
                    console.log('Animation loaded successfully');
                    window.ReactNativeWebView && window.ReactNativeWebView.postMessage('Animation loaded');

                    if (animGltf.animations && animGltf.animations.length > 0) {
                      mixer = new THREE.AnimationMixer(avatar);
                      const action = mixer.clipAction(animGltf.animations[0]);
                      action.play();
                      console.log('Animation playing');
                    }

                    loadingEl.style.display = 'none';
                    instructionsEl.classList.add('visible');
                  },
                  function(progress) {
                    if (progress.total > 0) {
                      const percent = Math.round((progress.loaded / progress.total) * 100);
                      loadingEl.textContent = 'Loading animation... ' + percent + '%';
                    }
                  },
                  function(error) {
                    console.error('Animation load error:', error);
                    window.ReactNativeWebView && window.ReactNativeWebView.postMessage('Animation skipped - avatar still interactive!');
                    loadingEl.textContent = 'Avatar ready!';
                    setTimeout(function() {
                      loadingEl.style.display = 'none';
                      instructionsEl.classList.add('visible');
                    }, 1500);
                  }
                );
              },
              function(progress) {
                if (progress.total > 0) {
                  const percent = Math.round((progress.loaded / progress.total) * 100);
                  loadingEl.textContent = 'Loading avatar... ' + percent + '%';
                }
              },
              function(error) {
                console.error('Avatar load error:', error);
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage('Avatar error: ' + error);
                loadingEl.textContent = 'Failed to load avatar';
                loadingEl.style.color = '#ff6b6b';
              }
            );

            const clock = new THREE.Clock();
            // Performance optimization: Throttle frame rate to 30 FPS instead of 60
            const targetFPS = 30;
            const frameInterval = 1000 / targetFPS;
            let lastFrameTime = 0;

            function animate(currentTime) {
              requestAnimationFrame(animate);

              // Throttle to 30 FPS to reduce CPU/GPU load and heat
              const timeSinceLastFrame = currentTime - lastFrameTime;
              if (timeSinceLastFrame < frameInterval) {
                return; // Skip this frame
              }
              lastFrameTime = currentTime - (timeSinceLastFrame % frameInterval);

              if (mixer) {
                mixer.update(clock.getDelta());
              }

              // Update particles every frame (still at 30 FPS)
              const positions = particles.attributes.position.array;
              for (let i = 0; i < particleCount; i++) {
                positions[i * 3] += particleVelocities[i].x;
                positions[i * 3 + 1] += particleVelocities[i].y;
                positions[i * 3 + 2] += particleVelocities[i].z;

                if (positions[i * 3 + 1] > 3) {
                  positions[i * 3 + 1] = -2;
                  positions[i * 3] = (Math.random() - 0.5) * 4;
                  positions[i * 3 + 2] = (Math.random() - 0.5) * 4;
                }
              }
              particles.attributes.position.needsUpdate = true;

              particleSystem.rotation.y += 0.001;

              controls.update();
              renderer.render(scene, camera);
            }
            animate(0);

            console.log('Animation loop started');
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage('Scene ready');

            window.addEventListener('resize', function() {
              camera.aspect = window.innerWidth / window.innerHeight;
              camera.updateProjectionMatrix();
              renderer.setSize(window.innerWidth, window.innerHeight);
            });

            window.addEventListener('message', function(event) {
              try {
                const message = JSON.parse(event.data);

                if (message.action === 'switchAnimation' && message.animationUrl) {
                  console.log('Switching to animation:', message.animationUrl);

                  // Handle inbox icon visibility
                  const exclamationEl = document.getElementById('exclamation-icon');
                  if (exclamationEl) {
                    if (message.showInboxIcon) {
                      exclamationEl.classList.add('visible');
                    } else {
                      exclamationEl.classList.remove('visible');
                    }
                  }

                  // Reset camera to original position when switching back to idle
                  camera.position.set(0, 0.2, 3.2);
                  controls.target.set(0, -0.1, 0);
                  controls.update();

                  loader.load(
                    message.animationUrl,
                    function(animGltf) {
                      console.log('New animation loaded');
                      if (animGltf.animations && animGltf.animations.length > 0 && mixer) {
                        mixer.stopAllAction();
                        const newAction = mixer.clipAction(animGltf.animations[0]);
                        newAction.play();
                        console.log('New animation playing');
                      }
                    },
                    undefined,
                    function(error) {
                      console.error('Animation switch error:', error);
                    }
                  );
                } else if (message.action === 'switchToTalking') {
                  console.log('Switching to talking animation and zooming camera...');

                  camera.position.set(0, 0.6, 2.2);
                  controls.target.set(0, 0.3, 0);
                  controls.update();

                  loader.load(
                    '${talkingAnimationUrl}',
                    function(talkingGltf) {
                      console.log('Talking animation loaded');
                      if (talkingGltf.animations && talkingGltf.animations.length > 0 && mixer) {
                        mixer.stopAllAction();
                        const talkAction = mixer.clipAction(talkingGltf.animations[0]);
                        talkAction.play();
                        console.log('Talking animation playing');
                      }
                    },
                    undefined,
                    function(error) {
                      console.error('Talking animation load error:', error);
                    }
                  );
                }
              } catch (e) {
                console.error('Message parsing error:', e);
              }
            });

          } catch (error) {
            console.error('Fatal error:', error);
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage('Fatal error: ' + error.message);
            const loadingEl = document.getElementById('loading');
            if (loadingEl) {
              loadingEl.textContent = 'Error: ' + error.message;
              loadingEl.style.color = '#ff6b6b';
            }
          }
        })();
      </script>
    </body>
    </html>
  `, [agentUrl, workspaceColor, transparentBottom, idleAnimationUrl, talkingAnimationUrl, showGrid, modelScale, modelOffsetY]);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingText}>Initializing 3D viewer...</Text>
        </View>
      )}

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <WebView
          key={`agent3d-${workspaceColor}`}
          ref={webViewRef}
          source={{ html }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowFileAccess={true}
          originWhitelist={['*']}
          mixedContentMode="always"
          allowUniversalAccessFromFileURLs={true}
          // Performance optimizations for WebView
          androidLayerType="software" // Use software rendering for better battery life
          cacheEnabled={true}
          cacheMode="LOAD_CACHE_ELSE_NETWORK"
          incognito={false} // Allow caching
          mediaPlaybackRequiresUserAction={false}
          onLoad={() => {
            console.log('WebView loaded');
            setLoading(false);
          }}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView error:', nativeEvent);
            setError('Failed to load 3D viewer');
            setLoading(false);
          }}
          onMessage={(event) => {
            const message = event.nativeEvent.data;
            console.log('WebView message:', message);

            if (message.includes('Failed') || message.includes('Fatal')) {
              setError(message);
            }

            if (
              message.includes('Avatar loaded') ||
              message.includes('Scene ready')
            ) {
              setError(null);
            }
          }}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('HTTP error:', nativeEvent);
          }}
        />
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
});

// Memoize with custom comparison to prevent re-renders on tab switches
export default React.memo(Agent3D, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.agentId === nextProps.agentId &&
    prevProps.accepted === nextProps.accepted &&
    prevProps.userName === nextProps.userName &&
    prevProps.workspaceColor === nextProps.workspaceColor &&
    prevProps.transparentBottom === nextProps.transparentBottom &&
    prevProps.hasInboxItems === nextProps.hasInboxItems &&
    prevProps.showGrid === nextProps.showGrid &&
    prevProps.modelScale === nextProps.modelScale &&
    prevProps.modelOffsetY === nextProps.modelOffsetY
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(12, 12, 14, 0.9)',
    zIndex: 10,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    position: 'absolute',
    top: '50%',
    left: 20,
    right: 20,
    padding: 16,
    backgroundColor: 'rgba(255, 107, 107, 0.9)',
    borderRadius: 8,
    zIndex: 10,
  },
  errorText: {
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
  },
});
