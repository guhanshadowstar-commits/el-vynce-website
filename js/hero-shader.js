/* EL VYNCE — subtle, slow, low-opacity WebGL shader accent for the homepage hero.
   Adapted from the Stitch shader export. Monochrome, near-invisible "fabric drift". */

(function () {
  function initHeroShader() {
    const canvas = document.getElementById("hero-shader");
    if (!canvas) return;

    function syncSize() {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(syncSize).observe(canvas);
    }
    syncSize();

    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return;

    const vs = `attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }`;

    const fs = `precision highp float;
      varying vec2 v_texCoord;
      uniform float u_time;
      void main() {
        vec2 uv = v_texCoord;
        float wave1 = sin(uv.x * 2.5 + u_time * 0.12) * 0.5 + 0.5;
        float wave2 = sin(uv.y * 1.8 - u_time * 0.08) * 0.5 + 0.5;
        float noise = wave1 * wave2;
        vec3 color1 = vec3(1.0, 1.0, 1.0);
        vec3 color2 = vec3(0.82, 0.82, 0.82);
        vec3 finalColor = mix(color1, color2, noise * 0.35);
        float vignette = 1.0 - length(uv - 0.5) * 0.6;
        finalColor *= vignette;
        gl_FragColor = vec4(finalColor, 0.06);
      }`;

    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    const uTime = gl.getUniformLocation(prog, "u_time");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    function render(t) {
      syncSize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (uTime) gl.uniform1f(uTime, t * 0.0006);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(render);
    }
    render(0);
  }

  document.addEventListener("DOMContentLoaded", initHeroShader);
})();
