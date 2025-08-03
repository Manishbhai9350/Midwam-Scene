import "./style.css";
import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Injection } from "./injection";

// Postprocessing
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import { HoloEffect } from "./yuri/holo";
import { StripeShader } from "./shaders/strips/shader";


import GUI from "lil-gui";

const { PI } = Math;

const canvas = document.querySelector("canvas");

canvas.width = innerWidth;
canvas.height = innerHeight;

const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2))
renderer.setClearColor(0x050505);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.15;

const camera = new THREE.PerspectiveCamera(
  70,
  innerWidth / innerHeight,
  1 / 100,
  1000
);
camera.position.set(6, 10, 6);
camera.lookAt(new THREE.Vector3(0,10,0))

// const controls = new OrbitControls(camera, canvas);

const lil = new GUI();
lil.close()

const Manager = new THREE.LoadingManager(StartScene);
const TLoader = new THREE.TextureLoader(Manager);
const Draco = new DRACOLoader(Manager);
const GLB = new GLTFLoader(Manager);
const PMGen = new THREE.PMREMGenerator(renderer);
PMGen.compileEquirectangularShader();

Draco.setDecoderPath("/draco/");
Draco.setDecoderConfig({ type: "wasm" });
GLB.setDRACOLoader(Draco);

// Post Processing

const Renderpass = new RenderPass(scene,camera)

const BloomPass = new UnrealBloomPass(
  new THREE.Vector2(innerWidth,innerHeight),
  1.35,.7,.3
)


// lil.add(BloomPass,'strength').min(0).max(4).step(.0001).onChange(e => {
//   BloomPass.strength = e
// })
// lil.add(BloomPass,'radius').min(0).max(2).step(.0001).onChange(e => {
//   BloomPass.radius = e
// })
// lil.add(BloomPass,'threshold').min(0).max(.5).step(.000001).onChange(e => {
//   BloomPass.threshold = e
// })
// lil.add(renderer, "toneMappingExposure").min(0).max(1).step(0.01);


const Composer = new EffectComposer( renderer )
Composer.setSize(innerWidth,innerHeight)
Composer.addPass(Renderpass)
Composer.addPass(BloomPass)

const stripEffect = new ShaderPass( StripeShader );
Composer.addPass( stripEffect );

// lil.add(stripEffect.uniforms.sinedX,'value').min(0).max(5).name('sined X')
lil.add(stripEffect.uniforms.uProgress,'value').min(0).max(2).name('Progress')



let CameraCon = null;
let CameraTarget = null;
let Human = null;
let Env = null;

const uniforms = {
  uTime:{ value:0 }
}

TLoader.load("/env.jpg", (env) => {
  Env = PMGen.fromEquirectangular(env).texture;
});

GLB.load("/models/human.glb", (glb) => {
  Human = glb.scene.children[0];
  scene.add(Human);
});

GLB.load("/models/camera.glb", (glb) => {
  CameraTarget = glb.scene.children[0];
  CameraCon = glb.scene.children[1];
  scene.add(CameraCon);
});

function StartScene() {
  resize()
  const CameraRotationCon = CameraCon.children[0];
  // camera.position.copy(CameraCon.position);
  // camera.position.sub(CameraRotationCon.position);
  // camera.rotation.copy(CameraRotationCon.rotation);
  // camera.quaternion.copy(CameraRotationCon.quaternion)
  // camera.lookAt(CameraTarget.position);

  Human.position.set(0, -10, 0);

  Human.material.envMap = Env;
  Human.material.roughness = 0.28;

  
  Human.material = new THREE.MeshStandardMaterial({
    metalness:1,
    roughness:.27,
    envMap:Env,
    envMapIntensity:1
  })
  // lil.add(Human.material,'metalness').min(0).max(1).step(.01)
  // lil.add(Human.material,'roughness').min(0).max(1).step(.01)
  // lil.add(Human.material,'envMapIntensity').min(0).max(1).step(.01)

  Human.material.onBeforeCompile = (shader) => {
    const fragInject = new Injection();
    fragInject.setInjectString(shader.fragmentShader);
    const vertexInject = new Injection();
    vertexInject.setInjectString(shader.vertexShader);

    fragInject.addToInjectedString(
      /* glsl */ `
      uniform float uTime;
      mat4 rotationMatrix(vec3 axis, float angle) {
      axis = normalize(axis);
      float s = sin(angle);
      float c = cos(angle);
      float oc = 1.0 - c;
      
      return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                  oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                  oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                  0.0,                                0.0,                                0.0,                                1.0);
                }

      vec3 rotate(vec3 v, vec3 axis, float angle) {
        mat4 m = rotationMatrix(axis, angle);
        return (m * vec4(v, 1.0)).xyz;
        // return v;
      }
      `
    )
    fragInject.inject(
      `#include <envmap_physical_pars_fragment>`,
      /* glsl */`
        #ifdef USE_ENVMAP

        vec3 getIBLIrradiance( const in vec3 normal ) {

          #ifdef ENVMAP_TYPE_CUBE_UV

            vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );

            vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );

            return PI * envMapColor.rgb * envMapIntensity;

          #else

            return vec3( 0.0 );

          #endif

        }

        vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {

          #ifdef ENVMAP_TYPE_CUBE_UV

            vec3 reflectVec = reflect( - viewDir, normal );
            
            // Mixing the reflection with the normal is more accurate and keeps rough objects from gathering light from behind their tangent plane.
            reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
            
            reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
            
            reflectVec = rotate(reflectVec,vec3(1.0,0.0,0.0),uTime * .05);

            vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );

            return envMapColor.rgb * envMapIntensity;

          #else

            return vec3( 0.0 );

          #endif

        }

        #ifdef USE_ANISOTROPY

          vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {

            #ifdef ENVMAP_TYPE_CUBE_UV

              // https://google.github.io/filament/Filament.md.html#lighting/imagebasedlights/anisotropy
              vec3 bentNormal = cross( bitangent, viewDir );
              bentNormal = normalize( cross( bentNormal, bitangent ) );
              bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );

              return getIBLRadiance( viewDir, bentNormal, roughness );

            #else

              return vec3( 0.0 );

            #endif

          }

        #endif

      #endif
      `
    )
    shader.fragmentShader = fragInject.getInjectedString()

    fragInject.InjectObject(shader.uniforms,uniforms)

    Human.material.userData.shader = shader;
  };
}

const clock = new THREE.Clock();
let PrevTime = clock.getElapsedTime();

function Animate() {
  const Time = clock.getElapsedTime();
  const DT = Time - PrevTime;
  PrevTime = Time;
  stripEffect.uniforms.uTime.value = Time;
  if (Human) {
    if(Human.material.userData.shader){
      Human.material.userData.shader.uniforms.uTime.value = Time;
    }
    Human.rotation.y = Time * .2;
    camera.position.y = (Math.sin(Time * .6)) * 5;
    stripEffect.uniforms.uProgress.value = Math.sin(Time * .15) + 1
  }
  Composer.render()
  // renderer.render(scene,camera)
  requestAnimationFrame(Animate);
}

requestAnimationFrame(Animate);

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  renderer.setSize(innerWidth, innerHeight);
  Composer.setSize(innerWidth,innerHeight)
}


window.addEventListener("resize", resize);
