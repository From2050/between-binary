/** GLSL sources. Sky directions deliberately separate celestial and terrestrial frames. */
export const skyVertex = `
			varying vec3 vDir;
			varying vec3 vWorld;
			void main() {
				vDir = position;                                   // turns with the sky
				vWorld = (modelMatrix * vec4(position, 1.0)).xyz;  // stays with the ground
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`;

export const skyFragment = `
			precision highp float;
			uniform float uTime;
			uniform float uDim;
			uniform float uDawn;   // the end of the walk: first light behind home, in the east
			uniform float uAurora; // the end of the walk: the aurora brightens and spreads overhead
			varying vec3 vDir;
			varying vec3 vWorld;

			float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
			vec3 hash33(vec3 p){ p = fract(p*vec3(0.1031,0.1030,0.0973)); p += dot(p,p.yxz+33.33); return fract((p.xxy+p.yxx)*p.zyx); }
			float vnoise(vec3 p){
				vec3 i = floor(p), f = fract(p);
				vec3 u = f*f*(3.0-2.0*f);
				return mix(
					mix(mix(hash13(i), hash13(i+vec3(1,0,0)), u.x),
						mix(hash13(i+vec3(0,1,0)), hash13(i+vec3(1,1,0)), u.x), u.y),
					mix(mix(hash13(i+vec3(0,0,1)), hash13(i+vec3(1,0,1)), u.x),
						mix(hash13(i+vec3(0,1,1)), hash13(i+vec3(1,1,1)), u.x), u.y),
					u.z);
			}
			float fbm(vec3 p){ float v=0.0; float a=0.5; for(int k=0;k<4;k++){ v+=a*vnoise(p); p*=2.13; a*=0.5; } return v; }

			float starLayer(vec3 d, float scale, float density, float twSpeed){
				vec3 p = d*scale;
				vec3 id = floor(p);
				vec3 gv = fract(p)-0.5;
				vec3 rnd = hash33(id);
				float sel = step(1.0-density, rnd.z);
				vec3 offs = (rnd-0.5)*0.72;
				float dist = length(gv-offs);
				float m = smoothstep(0.13, 0.0, dist);
				float tw = 0.7 + 0.3*sin(uTime*twSpeed*(0.5+rnd.x) + rnd.y*6.2831);
				return m*sel*tw;
			}

			void main(){
				vec3 d = normalize(vDir);    // celestial frame — stars, milky way, nebulae
				vec3 w = normalize(vWorld);  // world frame — horizon, distant glow, aurora
				float h = w.y;

				float east = max(0.0, dot(normalize(w.xz + vec2(1e-4)), normalize(vec2(0.97, -0.22))));
				float dawnLow = exp(-max(h, 0.0) * 7.0), dawnHigh = exp(-max(h, 0.0) * 2.4);
				vec3 zenith = vec3(0.0028, 0.004, 0.009);
				vec3 horizon = vec3(0.003, 0.0045, 0.008);
				vec3 col = mix(horizon, zenith, smoothstep(0.0, 0.42, h));

				// milky way: tilted band with dust lanes
				vec3 n = normalize(vec3(0.55, 0.28, 0.78));
				float planeDist = abs(dot(d, n));
				float band = exp(-planeDist*planeDist*38.0);
				float cloud = fbm(d*5.0);
				float dust = fbm(d*9.0 + vec3(4.7, 1.3, 8.1));
				vec3 mwCol = mix(vec3(0.42, 0.32, 0.85), vec3(0.86, 0.60, 0.95), cloud);
				mwCol = mix(mwCol, vec3(0.35, 0.70, 0.85), smoothstep(0.55, 0.85, fbm(d*3.0 + 7.0)));
				float mw = band * (0.15 + 0.85*cloud);
				mw *= 1.0 - 0.8*smoothstep(0.40, 0.75, dust);
				col += mwCol * mw * 0.08 * smoothstep(-0.05, 0.12, h);

				// faint nebula patches
				float neb = fbm(d*3.2 + vec3(11.0));
				col += vec3(0.28, 0.15, 0.48) * pow(neb, 4.5) * 0.12 * smoothstep(0.0, 0.3, h);

				// twinkling star field
				float fade = smoothstep(-0.02, 0.16, h);
				float s = starLayer(d, 95.0, 0.10, 1.4)*0.26
						+ starLayer(d, 150.0, 0.07, 2.0)*0.16
						+ starLayer(d, 220.0, 0.05, 2.8)*0.10;
				col += vec3(0.85, 0.88, 1.0) * s * fade * (1.0 - uDawn * 0.7 * east * dawnHigh);
				float sb = starLayer(d, 18.0, 0.02, 1.0);
				col += vec3(1.0, 0.85, 0.65) * sb * 0.0 * fade;


                // aurora curtain, low on one side
                float aBand = smoothstep(0.02, 0.16, h) * (1.0 - smoothstep(0.28, 0.55, h));
                float g = max(0.0, dot(normalize(w.xz + vec2(1e-4)), normalize(vec2(0.85, 0.4))));
                float curtain = fbm(vec3(w.x*4.0, w.z*4.0, uTime*0.045));
                col += vec3(0.12, 0.75, 0.55) * aBand * pow(g, 3.0) * pow(curtain, 2.5) * 0.32 * (1.0 + uAurora * 1.4);
                // overhead, the curtain arcs across the whole sky at the end of the walk
                float arc = smoothstep(0.12, 0.42, h) * (1.0 - smoothstep(0.62, 0.96, h));
                float folds = fbm(vec3(w.x * 2.2 + uTime * 0.03, w.z * 2.2, uTime * 0.05));
                float ribbon = exp(-pow((w.z + 0.25 * sin(w.x * 3.0 + uTime * 0.04)) * 3.2, 2.0));
                col += mix(vec3(0.10, 0.72, 0.50), vec3(0.42, 0.20, 0.62), smoothstep(0.35, 0.9, h)) * arc * ribbon * pow(folds, 2.2) * 0.42 * uAurora;
                // first light, low in the east, behind home
                col += (vec3(0.34, 0.14, 0.05) * pow(east, 5.0) * dawnLow * 1.15 + vec3(0.025, 0.045, 0.085) * pow(east, 1.6) * dawnHigh) * uDawn;

				// the walk's war station: smoke over the stars and the aurora
				col *= 1.0 - uDim * 0.82;
				col += vec3(0.012, 0.004, 0.002) * uDim * (1.0 - smoothstep(0.0, 0.5, h));
				gl_FragColor = vec4(col, 1.0);
			}
		`;

export const starsVertex = `
		attribute vec3 color;
		attribute float phase;
		attribute float glow; // woken at the summit of the walk
		uniform float uTime;
		uniform float uSize;
		varying vec3 vColor;
		varying float vTw;
		void main() {
			vColor = color * (1.0 + glow * 1.1);
			vTw = 0.74 + 0.26 * sin(uTime * (0.5 + fract(phase) * 0.9) + phase * 6.2831);
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			gl_PointSize = uSize * (1.0 + glow * .8);
		}
	`;

export const starsFragment = `
		precision highp float;
		uniform sampler2D uMap;
		uniform float uDim;
		varying vec3 vColor;
		varying float vTw;
		void main() {
			float a = texture2D(uMap, gl_PointCoord).a * vTw * (1.0 - uDim * 0.9);
			gl_FragColor = vec4(vColor * a, a);
		}
	`;

export const fireVertex = `
			varying vec2 vUv;
			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`;

export const fireFragment = `
			precision highp float;
			uniform float uTime;
			uniform float uIntensity;
            uniform float uWind;
			varying vec2 vUv;

			float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
			float noise(vec2 p){
				vec2 i = floor(p), f = fract(p);
				vec2 u = f*f*(3.0-2.0*f);
				return mix(mix(hash(i), hash(i+vec2(1,0)), u.x),
						   mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
			}
			float fbm(vec2 p){
				float v = 0.0, a = 0.5;
				for (int i = 0; i < 5; i++){ v += a*noise(p); p *= 2.03; a *= 0.5; }
				return v;
			}

			void main(){
				vec2 uv = vUv;
				float y = uv.y;

				// rising turbulence, domain-warped so it curls instead of streaking
				vec2 q = vec2(uv.x*4.5, uv.y*3.0 - uTime*1.9);
				float warp = fbm(q*1.9 + uTime*0.25);
				float n = fbm(q + warp*0.75);

				// the whole column leans and sways as it burns
				float sway = (fbm(vec2(uv.y*1.6 - uTime*0.8, uTime*0.3)) - 0.5) * 0.22 * y;
				float d = abs(uv.x - 0.5 - sway - uWind * y * y * .25);

				// teardrop body, narrowing as it rises
				float width = 0.40 * (1.0 - y*0.78);
				float body = 1.0 - smoothstep(width*0.25, width, d);
				body *= 1.0 - smoothstep(0.46, 1.0, y);  // dissolve near the top
				body *= smoothstep(0.0, 0.08, y);        // sit down into the logs

				// noise bites deeper the higher up you go, so tongues break off
				float f = body * (0.40 + n * 0.65) - (1.0 - n) * (0.28 + y*1.1);
				f = smoothstep(0.02, 0.62, f) * uIntensity;

				// warm ramp — a yellow heart, never a white blob
				vec3 col = mix(vec3(0.52, 0.05, 0.005), vec3(0.95, 0.30, 0.02), smoothstep(0.04, 0.32, f));
				col = mix(col, vec3(1.0, 0.31, 0.025), smoothstep(0.32, 0.62, f));
				col = mix(col, vec3(1.0, 0.48, 0.055), smoothstep(0.70, 0.98, f));

				gl_FragColor = vec4(col * 0.85, f * 0.82);
			}
		`;
