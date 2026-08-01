// 车队长端独立的高德加载器。
// 复用与司机端相同的 script id，因此两端切换时不会重复插入 SDK。
const AMAP_KEY = "2e9013c7c076a1baec170c986d477a8b";
let loaderPromise;

export function loadAmap() {
  if (window.AMap) return Promise.resolve(window.AMap);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("amap-js-sdk");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.AMap));
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.id = "amap-js-sdk";
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.Scale,AMap.ToolBar,AMap.MarkerCluster`;
    script.async = true;
    script.onload = () => resolve(window.AMap);
    script.onerror = () => reject(new Error("高德地图脚本加载失败"));
    document.head.appendChild(script);
  });

  return loaderPromise;
}
