/* Tally service worker 1.50
   方針: ページ本体はネットワーク優先(更新が即反映)、失敗時キャッシュ(オフライン動作)。
   アイコン等の静的物はキャッシュ優先。
   1.49からの変更はキャッシュ名のみ(kakeibo-1.49→tally-1.50)。旧キャッシュはactivateで自動削除、ロジック不変。 */
const CACHE = "tally-1.50";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.mode === "navigate" || url.pathname.endsWith("index.html")) {
    // ネットワーク優先 → 成功したらキャッシュ更新 → 失敗(圏外)ならキャッシュ
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request))
    );
  }
});
