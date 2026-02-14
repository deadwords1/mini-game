const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

let x = window.innerWidth / 2;
let y = window.innerHeight / 2;

function loop() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  // тестовая “игра”
  ctx.fillStyle = "rgba(255,255,255,.9)";
  ctx.fillRect(x - 30, y - 30, 60, 60);

  ctx.fillStyle = "rgba(0,0,0,.7)";
  ctx.font = "700 16px system-ui";
  ctx.fillText("OK, работает ✅", 16, 28);

  requestAnimationFrame(loop);
}
loop();

// тест тача
canvas.addEventListener("pointermove", (e) => {
  x = e.clientX;
  y = e.clientY;
});
