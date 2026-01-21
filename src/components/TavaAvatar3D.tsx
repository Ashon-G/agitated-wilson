import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';

interface TavaAvatar3DProps {
  isAudioPlaying?: boolean;
  audioData?: number[]; // Audio frequency data for lip sync
  onReady?: () => void;
  onError?: (error: string) => void;
  showPlatform?: boolean;
  cameraDistance?: number;
  cameraHeight?: number;
}

export default function TavaAvatar3D({
  isAudioPlaying = false,
  audioData,
  onReady,
  onError,
  showPlatform = true,
  cameraDistance = 2.5,
  cameraHeight = 0.2,
}: TavaAvatar3DProps) {
  const webViewRef = useRef<WebView>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Send audio data to WebView for lip sync
  useEffect(() => {
    if (webViewRef.current && isLoaded) {
      const message = JSON.stringify({
        type: 'audioState',
        isPlaying: isAudioPlaying,
        audioData: audioData || [],
      });
      webViewRef.current.postMessage(message);
    }
  }, [isAudioPlaying, audioData, isLoaded]);

  const handleMessage = useCallback(
    (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'ready') {
          console.log('[TavaAvatar3D] Model loaded successfully');
          setIsLoaded(true);
          setLoadError(null);
          if (onReady) onReady();
        } else if (data.type === 'error') {
          console.error('[TavaAvatar3D] Error:', data.message);
          setLoadError(data.message);
          if (retryCount < maxRetries) {
            console.log(`[TavaAvatar3D] Retrying... (${retryCount + 1}/${maxRetries})`);
            setRetryCount((prev) => prev + 1);
          } else if (onError) {
            onError(data.message);
          }
        } else if (data.type === 'log') {
          console.log('[TavaAvatar3D]', data.message);
        }
      } catch (error) {
        console.error('Error parsing WebView message:', error);
      }
    },
    [onReady, onError, retryCount],
  );

  // GitHub raw URLs for assets - using jsdelivr CDN for better reliability
  const tavaModelUrl =
    'https://cdn.jsdelivr.net/gh/Ashon-G/tava-assets@main/tava.glb';
  const talkingAnimationUrl =
    'https://cdn.jsdelivr.net/gh/readyplayerme/animation-library@master/feminine/glb/expression/F_Talking_Variations_001.glb';
  const idleAnimationUrl =
    'https://cdn.jsdelivr.net/gh/readyplayerme/animation-library@master/feminine/glb/idle/F_Standing_Idle_001.glb';
  const platformUrl =
    'https://cdn.jsdelivr.net/gh/Ashon-G/tava-assets@main/appearance_effect_starlight.glb';

  // Fallback URLs using raw.githubusercontent.com
  const fallbackTavaModelUrl =
    'https://raw.githubusercontent.com/Ashon-G/tava-assets/main/tava.glb';
  const fallbackAnimationUrl =
    'https://raw.githubusercontent.com/readyplayerme/animation-library/master/feminine/glb/expression/F_Talking_Variations_001.glb';
  const fallbackIdleAnimationUrl =
    'https://raw.githubusercontent.com/readyplayerme/animation-library/master/feminine/glb/idle/F_Standing_Idle_001.glb';
  const fallbackPlatformUrl =
    'https://raw.githubusercontent.com/Ashon-G/tava-assets/main/appearance_effect_starlight.glb';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>Tava Avatar</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          overflow: hidden;
        }
        body {
          width: 100vw;
          height: 100vh;
          background: transparent;
        }
        #scene-container {
          width: 100%;
          height: 100%;
        }
        #loading {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 16px;
          text-align: center;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 10px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div id="scene-container"></div>
      <div id="loading">
        <div class="spinner"></div>
        <div>Loading Tava...</div>
      </div>

      <script type="importmap">
        {
          "imports": {
            "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
            "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
          }
        }
      </script>

      <script type="module">
        import * as THREE from 'three';
        import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

        const log = (msg) => {
          console.log(msg);
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: String(msg) }));
          }
        };

        const reportError = (msg) => {
          console.error(msg);
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: String(msg) }));
          }
        };

        const reportReady = () => {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
          }
        };

        let scene, camera, renderer, mixer, clock;
        let avatar, platform;
        let talkingAction, idleAction;
        let morphTargets = {};
        let isAudioPlaying = false;
        let lipSyncTime = 0;

        // URLs with fallbacks
        const modelUrls = {
          tava: ['${tavaModelUrl}', '${fallbackTavaModelUrl}'],
          animation: ['${talkingAnimationUrl}', '${fallbackAnimationUrl}'],
          idleAnimation: ['${idleAnimationUrl}', '${fallbackIdleAnimationUrl}'],
          platform: ['${platformUrl}', '${fallbackPlatformUrl}']
        };

        async function loadModelWithFallback(loader, urls, name) {
          for (let i = 0; i < urls.length; i++) {
            try {
              log('Loading ' + name + ' from: ' + urls[i]);
              const gltf = await new Promise((resolve, reject) => {
                loader.load(
                  urls[i],
                  resolve,
                  (progress) => {
                    if (progress.total > 0) {
                      const percent = Math.round((progress.loaded / progress.total) * 100);
                      log(name + ' loading: ' + percent + '%');
                    }
                  },
                  reject
                );
              });
              log(name + ' loaded successfully from ' + urls[i]);
              return gltf;
            } catch (error) {
              log('Failed to load ' + name + ' from ' + urls[i] + ': ' + error.message);
              if (i === urls.length - 1) {
                throw new Error('All URLs failed for ' + name);
              }
            }
          }
        }

        async function init() {
          try {
            log('Initializing Three.js scene...');

            const container = document.getElementById('scene-container');
            const loadingEl = document.getElementById('loading');

            // Create scene with transparent background
            scene = new THREE.Scene();

            // Create camera
            const width = window.innerWidth;
            const height = window.innerHeight;
            camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
            camera.position.set(0, ${cameraHeight}, ${cameraDistance});
            camera.lookAt(0, 0, 0);

            // Create renderer with transparency
            renderer = new THREE.WebGLRenderer({
              antialias: true,
              alpha: true,
              premultipliedAlpha: false
            });
            renderer.setSize(width, height);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.setClearColor(0x000000, 0);
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            container.appendChild(renderer.domElement);

            // Lighting setup for avatar
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            scene.add(ambientLight);

            // Key light (main light from front-right)
            const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
            keyLight.position.set(2, 3, 3);
            scene.add(keyLight);

            // Fill light (softer, from left)
            const fillLight = new THREE.DirectionalLight(0x88aaff, 0.5);
            fillLight.position.set(-2, 2, 2);
            scene.add(fillLight);

            // Rim/back light for depth
            const rimLight = new THREE.DirectionalLight(0xffffee, 0.4);
            rimLight.position.set(0, 2, -3);
            scene.add(rimLight);

            // Bottom fill for platform glow reflection
            const bottomLight = new THREE.PointLight(0x8866ff, 0.3);
            bottomLight.position.set(0, -1, 0);
            scene.add(bottomLight);

            clock = new THREE.Clock();

            const loader = new GLTFLoader();

            // Load Tava avatar model
            try {
              const tavaGltf = await loadModelWithFallback(loader, modelUrls.tava, 'Tava model');
              avatar = tavaGltf.scene;
              avatar.position.set(0, -0.9, 0);
              avatar.scale.set(1, 1, 1);

              // Find morphable meshes for lip sync
              avatar.traverse((node) => {
                if (node.isMesh && node.morphTargetInfluences && node.morphTargetDictionary) {
                  log('Found morph targets on: ' + node.name);
                  morphTargets[node.name] = {
                    mesh: node,
                    dictionary: node.morphTargetDictionary,
                    influences: node.morphTargetInfluences
                  };
                }
              });

              scene.add(avatar);

              // Create animation mixer for avatar
              mixer = new THREE.AnimationMixer(avatar);

              // Load talking animation
              try {
                const animGltf = await loadModelWithFallback(loader, modelUrls.animation, 'Animation');
                if (animGltf.animations && animGltf.animations.length > 0) {
                  talkingAction = mixer.clipAction(animGltf.animations[0]);
                  talkingAction.setLoop(THREE.LoopRepeat);
                  log('Talking animation ready');
                }
              } catch (animError) {
                log('Animation failed to load, continuing without it: ' + animError.message);
              }

              // Load idle animation
              try {
                const idleGltf = await loadModelWithFallback(loader, modelUrls.idleAnimation, 'Idle Animation');
                if (idleGltf.animations && idleGltf.animations.length > 0) {
                  idleAction = mixer.clipAction(idleGltf.animations[0]);
                  idleAction.setLoop(THREE.LoopRepeat);
                  // Start idle animation immediately
                  idleAction.play();
                  log('Idle animation ready and playing');
                }
              } catch (idleError) {
                log('Idle animation failed to load, continuing without it: ' + idleError.message);
              }

            } catch (modelError) {
              throw new Error('Failed to load Tava model: ' + modelError.message);
            }

            // Load platform if enabled
            ${showPlatform ? `
            try {
              const platformGltf = await loadModelWithFallback(loader, modelUrls.platform, 'Platform');
              platform = platformGltf.scene;
              platform.position.set(0, -0.95, 0);
              platform.scale.set(0.5, 0.5, 0.5);

              // Enhance platform materials for glow effect
              platform.traverse((node) => {
                if (node.isMesh && node.material) {
                  if (Array.isArray(node.material)) {
                    node.material.forEach(mat => {
                      if (mat.emissiveIntensity !== undefined) {
                        mat.emissiveIntensity = 1.5;
                      }
                    });
                  } else if (node.material.emissiveIntensity !== undefined) {
                    node.material.emissiveIntensity = 1.5;
                  }
                }
              });

              scene.add(platform);
              log('Platform loaded and added to scene');
            } catch (platformError) {
              log('Platform failed to load, continuing without it: ' + platformError.message);
            }
            ` : ''}

            // Hide loading indicator and report ready
            loadingEl.style.display = 'none';
            reportReady();

            // Start animation loop
            animate();

            // Handle resize
            window.addEventListener('resize', onWindowResize);

            // Listen for messages from React Native
            window.addEventListener('message', handleMessage);
            document.addEventListener('message', handleMessage);

          } catch (error) {
            log('Init error: ' + error.message);
            reportError(error.message);
          }
        }

        function handleMessage(event) {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'audioState') {
              const wasPlaying = isAudioPlaying;
              isAudioPlaying = data.isPlaying;

              if (isAudioPlaying && !wasPlaying) {
                startTalking();
              } else if (!isAudioPlaying && wasPlaying) {
                stopTalking();
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
        }

        function startTalking() {
          log('Starting talking animation');
          // Fade out idle animation
          if (idleAction) {
            idleAction.fadeOut(0.3);
          }
          // Fade in talking animation
          if (talkingAction) {
            talkingAction.reset();
            talkingAction.fadeIn(0.3);
            talkingAction.play();
          }
          lipSyncTime = 0;
        }

        function stopTalking() {
          log('Stopping talking animation');
          // Fade out talking animation
          if (talkingAction) {
            talkingAction.fadeOut(0.5);
          }
          // Fade back to idle animation
          if (idleAction) {
            idleAction.reset();
            idleAction.fadeIn(0.5);
            idleAction.play();
          }
          resetMorphTargets();
        }

        function updateLipSyncSimulated(delta) {
          if (!isAudioPlaying) return;

          lipSyncTime += delta;

          // Create natural-looking mouth movement pattern
          const primaryWave = Math.sin(lipSyncTime * 8) * 0.5 + 0.5;
          const secondaryWave = Math.sin(lipSyncTime * 12 + 1) * 0.3;
          const accentWave = Math.sin(lipSyncTime * 4) * 0.2;

          let mouthOpen = primaryWave + secondaryWave + accentWave;
          mouthOpen = Math.max(0, Math.min(1, mouthOpen * 0.7));

          applyMouthOpen(mouthOpen);
        }

        function applyMouthOpen(value) {
          const mouthMorphNames = [
            'mouthOpen', 'mouth_open', 'MouthOpen',
            'jawOpen', 'jaw_open', 'JawOpen',
            'viseme_aa', 'viseme_O', 'A', 'O',
            'mouthSmile', 'mouth_smile'
          ];

          Object.values(morphTargets).forEach(({ mesh, dictionary }) => {
            mouthMorphNames.forEach(name => {
              if (dictionary[name] !== undefined) {
                const index = dictionary[name];
                const targetValue = name.includes('Smile') || name.includes('smile')
                  ? value * 0.3
                  : value;
                mesh.morphTargetInfluences[index] = targetValue;
              }
            });
          });
        }

        function resetMorphTargets() {
          Object.values(morphTargets).forEach(({ mesh }) => {
            for (let i = 0; i < mesh.morphTargetInfluences.length; i++) {
              mesh.morphTargetInfluences[i] *= 0.9;
            }
          });
        }

        function animate() {
          requestAnimationFrame(animate);

          const delta = clock.getDelta();

          if (mixer) {
            mixer.update(delta);
          }

          if (isAudioPlaying) {
            updateLipSyncSimulated(delta);
          }

          // Subtle idle breathing/swaying for platform
          if (platform) {
            platform.rotation.y += delta * 0.1;
          }

          renderer.render(scene, camera);
        }

        function onWindowResize() {
          const width = window.innerWidth;
          const height = window.innerHeight;

          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
        }

        // Initialize
        init();
      </script>
    </body>
    </html>
  `;

  const handleWebViewError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('[TavaAvatar3D] WebView error:', nativeEvent);
    setLoadError(nativeEvent.description || 'WebView failed to load');
  };

  return (
    <View style={styles.container}>
      <WebView
        key={`webview-${retryCount}`} // Force remount on retry
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webview}
        onMessage={handleMessage}
        onError={handleWebViewError}
        originWhitelist={['*']}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scrollEnabled={false}
        bounces={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        mixedContentMode="always"
        cacheEnabled={true}
        cacheMode="LOAD_DEFAULT"
      />
      {loadError && retryCount >= maxRetries && (
        <View style={styles.errorOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.errorText}>Loading avatar...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  errorText: {
    color: '#ffffff',
    marginTop: 10,
    fontSize: 16,
  },
});
