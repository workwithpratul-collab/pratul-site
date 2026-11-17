// Step 1 check: make sure every library in the import map loads.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

console.log('libs ok', THREE.REVISION, typeof GLTFLoader, typeof VRMLoaderPlugin, gsap.version, typeof ScrollTrigger, typeof Lenis);
window.__ascent = { ready: true };
