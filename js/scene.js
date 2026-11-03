// Scene 3D hero: medan (terrain) wireframe + 3 satelit GNSS dengan sinyal ke permukaan. Dibuat prosedural dengan three.js (MIT).
(function () {
  var cv = document.getElementById('scene');
  if (!cv || !window.THREE) return;
  var r;
  try { r = new THREE.WebGLRenderer({ canvas: cv, antialias: innerWidth > 700, alpha: true }); } catch (e) { return; }
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, small = innerWidth < 700;
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  var sc = new THREE.Scene(); sc.fog = new THREE.Fog(0x0b1f19, 16, 46);
  var cam = new THREE.PerspectiveCamera(50, 1, 0.1, 100); cam.position.set(0, 9, 18);
  var N = small ? 40 : 68, S = 46;
  var g = new THREE.PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2);
  var pos = g.attributes.position;
  sc.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x2fbf94, wireframe: true, transparent: true, opacity: 0.32 })));
  sc.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xf3c95e, size: 0.1, transparent: true, opacity: 0.85 })));
  function h(x, z, t) {
    var d = Math.min(1, Math.hypot(x, z) / 22);
    return (2.4 * Math.sin(x * 0.22 + t * 0.35) * Math.cos(z * 0.2 - t * 0.28) + 1.2 * Math.sin(x * 0.55 + z * 0.47 + t * 0.5)) * (1.15 - d * 0.5);
  }
  function terrain(t) { for (var i = 0; i < pos.count; i++) pos.setY(i, h(pos.getX(i), pos.getZ(i), t)); pos.needsUpdate = true; }
  var sats = [], beams = [], tmp = new THREE.Vector3();
  [[9, 0.5, 0.0], [12, -0.35, 2.1], [15, 0.2, 4.2]].forEach(function (c, i) {
    var pivot = new THREE.Group(); pivot.position.y = 8; pivot.rotation.z = c[1]; pivot.rotation.x = c[1] * 0.6; sc.add(pivot);
    var ring = []; for (var k = 0; k < 96; k++) ring.push(new THREE.Vector3(Math.cos(k / 96 * 6.2832) * c[0], 0, Math.sin(k / 96 * 6.2832) * c[0]));
    pivot.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ring), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 })));
    var s = new THREE.Group();
    s.add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.35), new THREE.MeshBasicMaterial({ color: 0xffffff })));
    [-0.8, 0.8].forEach(function (x) { var p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.35), new THREE.MeshBasicMaterial({ color: 0x5aa9ff })); p.position.x = x; s.add(p); });
    s.scale.setScalar(2.2); pivot.add(s); sats.push({ s: s, r: c[0], a: c[2], v: 0.18 - i * 0.04 });
    var bm = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xf3c95e, transparent: true, opacity: 0.55 }));
    sc.add(bm); beams.push(bm);
  });
  var mx = 0, my = 0, run = true, t0 = 0;
  addEventListener('pointermove', function (e) { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; });
  function size() { var p = cv.parentElement; r.setSize(p.clientWidth, p.clientHeight, false); cam.aspect = p.clientWidth / p.clientHeight; cam.updateProjectionMatrix(); }
  addEventListener('resize', size); size();
  function frame(ms) {
    var t = ms / 1000; if (reduce) t = 0;
    terrain(t);
    sats.forEach(function (o, i) {
      o.a += o.v * 0.016; o.s.position.set(Math.cos(o.a) * o.r, 0, Math.sin(o.a) * o.r); o.s.rotation.y = -o.a;
      o.s.getWorldPosition(tmp);
      var gx = tmp.x * 0.45, gz = tmp.z * 0.45 + 2, pa = beams[i].geometry.attributes.position;
      pa.setXYZ(0, tmp.x, tmp.y, tmp.z); pa.setXYZ(1, gx, h(gx, gz, t), gz); pa.needsUpdate = true;
    });
    cam.position.x += (mx * 9 - cam.position.x) * 0.05;
    cam.position.y += (9 - my * 5 - cam.position.y) * 0.05;
    cam.lookAt(0, 2.5, 0); r.render(sc, cam);
  }
  function loop(ms) { if (!run) return; frame(ms); requestAnimationFrame(loop); }
  if (reduce) { frame(0); return; }
  new IntersectionObserver(function (e) { var v = e[0].isIntersecting; if (v && !run) { run = true; requestAnimationFrame(loop); } run = v; }).observe(cv);
  requestAnimationFrame(loop);
})();
