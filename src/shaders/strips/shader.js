import Vertex from './vertex.glsl'
import Fragment from './fragment.glsl'


export const StripeShader = {
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value:0 },
        sinedX: { value:.45 },
        uProgress: { value:0 }
    },
    vertexShader: Vertex,
    fragmentShader: Fragment,
};
