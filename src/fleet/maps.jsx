import { useEffect, useRef, useState } from "react";
import { Navigation, PlugZap } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadAmap } from "./amap.js";

const CENTER = [102.545, 24.337];
const CLUSTER_GRID_SIZE = 56;
const STATION_ICON = renderToStaticMarkup(<PlugZap aria-hidden="true" />);
const USER_DIRECTION_ICON = renderToStaticMarkup(<Navigation aria-hidden="true" />);

function isHeading(value) {
  return Number.isFinite(value) && value >= 0 && value < 360;
}

function bearingBetween(previous, next) {
  const toRadians = (value) => value * Math.PI / 180;
  const latitudeA = toRadians(previous.lat);
  const latitudeB = toRadians(next.lat);
  const longitudeDifference = toRadians(next.lng - previous.lng);
  const y = Math.sin(longitudeDifference) * Math.cos(latitudeB);
  const x = Math.cos(latitudeA) * Math.sin(latitudeB)
    - Math.sin(latitudeA) * Math.cos(latitudeB) * Math.cos(longitudeDifference);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function statusClassOf(vehicle) {
  if (vehicle.onlineStatus === "在线") return "online";
  if (vehicle.onlineStatus === "离线") return "offline";
  return "never";
}

function buildFleetMarkerHtml(vehicle, selected) {
  const markerText = vehicle.onlineStatus === "在线"
    ? (vehicle.speed > 0 ? `${vehicle.speed} km/h` : "停车中")
    : vehicle.onlineStatus === "离线" ? "离线" : "未上线";
  return `<button type="button" class="fleet-map-vehicle-marker ${statusClassOf(vehicle)} ${selected ? "selected" : ""}" aria-label="${vehicle.plate}，${vehicle.onlineStatus}"><span class="fleet-map-vehicle-orbit"><img class="fleet-map-van" src="/fleet-assets/dispatch-van.png" alt="" /></span><b>${markerText}</b></button>`;
}

function buildFleetClusterHtml(count, tone) {
  return `<button type="button" class="fleet-map-cluster ${tone}" aria-label="${count} 辆车辆聚合点"><b>${count}</b><span>辆</span></button>`;
}

function buildStationMarkerHtml(station, selected) {
  return `<button type="button" class="fleet-map-station-marker ${selected ? "selected" : ""}" aria-label="${station.name}，${station.priceText}，${station.distance.text}"><span>${STATION_ICON}</span><b>${station.priceText}</b><small>${station.distance.text}</small></button>`;
}

function buildUserLocationMarkerHtml(heading) {
  // lucide Navigation 的默认箭头朝东北，减去 45° 后与地图的正北方向对齐。
  const iconRotation = heading - 45;
  return `<div class="fleet-map-user-location" role="img" aria-label="当前用户定位，朝向 ${Math.round(heading)} 度"><span class="fleet-map-user-direction" style="transform:rotate(${iconRotation}deg)">${USER_DIRECTION_ICON}</span><span class="fleet-map-user-dot"></span></div>`;
}

function clusterTone(clusterData) {
  const vehicles = clusterData.map((item) => item.vehicle).filter(Boolean);
  if (vehicles.some((vehicle) => vehicle.alert)) return "attention";
  if (vehicles.every((vehicle) => vehicle.onlineStatus === "在线")) return "online";
  if (vehicles.every((vehicle) => vehicle.onlineStatus === "离线")) return "offline";
  return "mixed";
}

function MapShell({ containerRef, loadState, loadingText }) {
  return (
    <>
      <div ref={containerRef} className="fleet-amap-container" />
      {loadState === "loading" && <div className="fleet-map-status">{loadingText}</div>}
      {loadState === "error" && <div className="fleet-map-status error">地图暂不可用，请检查网络后刷新</div>}
    </>
  );
}

// 监控页全屏地图：只渲染有定位的车辆，从未上线车辆无坐标不落点。
export function FleetMapCanvas({ vehicles, selectedId, stations, selectedStationId, isInfoPanelVisible, onVehicleClick, onStationClick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRefs = useRef([]);
  const stationMarkerRefs = useRef([]);
  const userLocationMarkerRef = useRef(null);
  const previousUserLocationRef = useRef(null);
  const clusterRef = useRef(null);
  const onVehicleClickRef = useRef(onVehicleClick);
  const onStationClickRef = useRef(onStationClick);
  const [loadState, setLoadState] = useState("loading");
  const [userLocation, setUserLocation] = useState(null);
  onVehicleClickRef.current = onVehicleClick;
  onStationClickRef.current = onStationClick;

  useEffect(() => {
    let cancelled = false;
    loadAmap()
      .then((AMap) => {
        if (cancelled || !containerRef.current) return;
        const map = new AMap.Map(containerRef.current, {
          center: CENTER,
          // 场站最远约 25km；以更宽的默认视野保证车辆与司机端同批场站可同时扫读。
          zoom: 9.7,
          viewMode: "2D",
          resizeEnable: true,
          animateEnable: false,
          mapStyle: "amap://styles/whitesmoke",
          features: ["bg", "road", "building", "point"],
        });
        map.setPitch?.(0);
        mapRef.current = map;
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });

    return () => {
      cancelled = true;
      mapRef.current?.destroy?.();
      mapRef.current = null;
      clusterRef.current = null;
      stationMarkerRefs.current = [];
      userLocationMarkerRef.current = null;
    };
  }, []);

  // 以设备定位为准持续更新当前位置；方向优先使用硬件 heading，静止或未提供时
  // 根据连续定位点计算方位，确保定位点始终能表达朝向。
  useEffect(() => {
    if (!navigator.geolocation) return undefined;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const next = {
          lng: position.coords.longitude,
          lat: position.coords.latitude,
        };
        const deviceHeading = Number(position.coords.heading);
        const compassHeading = Number(position.coords.webkitCompassHeading);
        const previous = previousUserLocationRef.current;
        const heading = isHeading(deviceHeading)
          ? deviceHeading
          : isHeading(compassHeading)
            ? compassHeading
            : previous
              ? bearingBetween(previous, next)
              : 0;

        previousUserLocationRef.current = next;
        setUserLocation({ ...next, heading });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = window.AMap;
    if (loadState !== "ready" || !map || !AMap) return;

    let cancelled = false;
    clusterRef.current?.setMap?.(null);
    clusterRef.current = null;
    markerRefs.current.forEach((marker) => map.remove(marker));

    const locatable = vehicles.filter((vehicle) => vehicle.onlineStatus !== "从未上线");
    // 当前选中车辆保持独立；其他车辆（含异常车辆）随缩放继续聚合，风险由聚合点颜色表达。
    const priorityVehicles = locatable.filter((vehicle) => vehicle.id === selectedId);
    const clusteredVehicles = locatable.filter((vehicle) => !priorityVehicles.some((item) => item.id === vehicle.id));

    markerRefs.current = priorityVehicles.map((vehicle) => {
      const marker = new AMap.Marker({
        position: [vehicle.lng, vehicle.lat],
        offset: new AMap.Pixel(-44, -42),
        content: buildFleetMarkerHtml(vehicle, vehicle.id === selectedId),
        zIndex: vehicle.id === selectedId ? 180 : 150,
      });
      marker.on("click", () => onVehicleClickRef.current(vehicle.id));
      map.add(marker);
      return marker;
    });

    if (clusteredVehicles.length) {
      const points = clusteredVehicles.map((vehicle) => ({
        lnglat: [vehicle.lng, vehicle.lat],
        weight: 1,
        vehicle,
      }));

      map.plugin(["AMap.MarkerCluster"], () => {
        if (cancelled || !mapRef.current) return;
        const cluster = new AMap.MarkerCluster(map, points, {
          gridSize: CLUSTER_GRID_SIZE,
          renderClusterMarker(context) {
            const count = context.count;
            const size = count >= 10 ? 50 : 44;
            context.marker.setContent(buildFleetClusterHtml(count, clusterTone(context.clusterData ?? [])));
            context.marker.setOffset(new AMap.Pixel(-size / 2, -size / 2));
            context.marker.setAnchor?.("center");
            context.marker.setzIndex?.(200);
            context.marker.off?.("click");
            context.marker.on("click", (event) => {
              const nextZoom = Math.min(15, map.getZoom() + 1.5);
              map.setZoomAndCenter(nextZoom, event.lnglat ?? context.marker.getPosition());
            });
          },
          renderMarker(context) {
            const vehicle = context.data?.[0]?.vehicle;
            if (!vehicle) return;
            context.marker.setContent(buildFleetMarkerHtml(vehicle, false));
            context.marker.setOffset(new AMap.Pixel(-44, -42));
            context.marker.setExtData?.(vehicle.id);
            context.marker.off?.("click");
            context.marker.on("click", () => onVehicleClickRef.current(vehicle.id));
          },
        });
        clusterRef.current = cluster;
      });
    }

    return () => {
      cancelled = true;
      clusterRef.current?.setMap?.(null);
      clusterRef.current = null;
    };
  }, [vehicles, selectedId, loadState]);

  // 场站沿用司机端的点位展示规则：独立于车辆状态筛选，正常且有坐标的站点直接落图。
  useEffect(() => {
    const map = mapRef.current;
    const AMap = window.AMap;
    if (loadState !== "ready" || !map || !AMap) return undefined;

    stationMarkerRefs.current.forEach((marker) => map.remove(marker));
    stationMarkerRefs.current = stations.map((station) => {
      const marker = new AMap.Marker({
        position: [station.lng, station.lat],
        offset: new AMap.Pixel(-25, -42),
        content: buildStationMarkerHtml(station, station.id === selectedStationId),
        // 车辆聚合点的层级为 200；场站必须可直接点击，不能被聚合层吞掉。
        zIndex: station.id === selectedStationId ? 300 : 280,
      });
      marker.on("click", () => onStationClickRef.current?.(station.id));
      map.add(marker);
      return marker;
    });

    return () => {
      stationMarkerRefs.current.forEach((marker) => map.remove(marker));
      stationMarkerRefs.current = [];
    };
  }, [stations, selectedStationId, loadState]);

  // 当前用户单独使用高层级定位点，避免与车辆聚合或场站点位相互遮挡。
  useEffect(() => {
    const map = mapRef.current;
    const AMap = window.AMap;
    if (loadState !== "ready" || !map || !AMap || !userLocation) return;

    const content = buildUserLocationMarkerHtml(userLocation.heading);
    if (!userLocationMarkerRef.current) {
      userLocationMarkerRef.current = new AMap.Marker({
        position: [userLocation.lng, userLocation.lat],
        offset: new AMap.Pixel(-22, -22),
        content,
        zIndex: 360,
      });
      map.add(userLocationMarkerRef.current);
      return;
    }

    userLocationMarkerRef.current.setPosition([userLocation.lng, userLocation.lat]);
    userLocationMarkerRef.current.setContent(content);
  }, [userLocation, loadState]);

  // 地图上的选中车辆要落在状态标签与车辆信息卡之间的可视区域中央，
  // 而不是落在整张地图的几何中心；信息卡会随内容伸缩，因此每次选择
  // 或重新展开卡片后都按当前实际尺寸重新计算。
  useEffect(() => {
    const map = mapRef.current;
    const AMap = window.AMap;
    const vehicle = vehicles.find((item) => item.id === selectedId);
    if (loadState !== "ready" || !map || !AMap || !vehicle || !isInfoPanelVisible) return undefined;

    let alignmentFrame = 0;
    const placeVehicleInSafeArea = () => {
      const mapBounds = containerRef.current?.getBoundingClientRect();
      const tabsBounds = document.querySelector(".fleet-monitor-status-tabs")?.getBoundingClientRect();
      const panel = document.querySelector(".fleet-source-vehicle-panel.is-visible");
      if (!mapBounds || !panel) return;

      const panelTop = panel.offsetTop;
      const tabsBottom = tabsBounds ? tabsBounds.bottom - mapBounds.top : 0;
      const safeTop = Math.max(0, tabsBottom + 12);
      const safeBottom = Math.max(safeTop, panelTop - 12);
      const targetX = mapBounds.width / 2;
      const targetY = (safeTop + safeBottom) / 2;

      // 先置中，再以真实标记的可见中心校准。标记本身有图片、光晕和
      // AMap offset，不能假定经纬度锚点就是它的视觉中心。
      map.setCenter([vehicle.lng, vehicle.lat]);
      alignmentFrame = window.requestAnimationFrame(() => {
        const markerBounds = containerRef.current
          ?.querySelector(".fleet-map-vehicle-marker.selected")
          ?.getBoundingClientRect();
        if (!markerBounds) return;

        const markerX = markerBounds.left - mapBounds.left + markerBounds.width / 2;
        const markerY = markerBounds.top - mapBounds.top + markerBounds.height / 2;
        const nextCenter = map.containerToLngLat(new AMap.Pixel(
          mapBounds.width / 2 + markerX - targetX,
          mapBounds.height / 2 + markerY - targetY,
        ));
        map.setCenter(nextCenter);
      });
    };
    const initialFrame = window.requestAnimationFrame(placeVehicleInSafeArea);

    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.cancelAnimationFrame(alignmentFrame);
    };
  }, [vehicles, selectedId, isInfoPanelVisible, loadState]);

  return (
    <div className="fleet-amap-layer">
      <MapShell containerRef={containerRef} loadState={loadState} loadingText="正在加载车辆地图" />
    </div>
  );
}

// 轨迹回放地图：轨迹线按速度分色，播放游标随进度移动。
export function FleetTrackCanvas({ points, progress }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const playbackMarkerRef = useRef(null);
  const [loadState, setLoadState] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    if (!points.length) return undefined;
    loadAmap()
      .then((AMap) => {
        if (cancelled || !containerRef.current) return;
        const path = points.map((point) => [point.lng, point.lat]);
        const map = new AMap.Map(containerRef.current, {
          center: path[0],
          zoom: 12.4,
          viewMode: "2D",
          resizeEnable: true,
          animateEnable: false,
          mapStyle: "amap://styles/whitesmoke",
          features: ["bg", "road", "building", "point"],
        });

        // 按速度分段着色：低速黄、中速绿、高速蓝，对应 TSP 端轨迹分色。
        const overlays = [];
        for (let i = 0; i < path.length - 1; i += 1) {
          const speed = points[i].speed;
          const color = speed < 35 ? "#f59e0b" : speed < 55 ? "#22c55e" : "#2563eb";
          overlays.push(new AMap.Polyline({
            path: [path[i], path[i + 1]],
            strokeColor: color,
            strokeWeight: 5,
            strokeOpacity: 0.9,
            lineJoin: "round",
          }));
        }
        const startMarker = new AMap.Marker({ position: path[0], offset: new AMap.Pixel(-14, -14), content: '<span class="fleet-track-marker start">起</span>' });
        const endMarker = new AMap.Marker({ position: path[path.length - 1], offset: new AMap.Pixel(-14, -14), content: '<span class="fleet-track-marker end">终</span>' });
        const playbackMarker = new AMap.Marker({ position: path[0], offset: new AMap.Pixel(-16, -16), content: '<span class="fleet-track-marker current"></span>', zIndex: 180 });
        map.add([...overlays, startMarker, endMarker, playbackMarker]);
        map.setFitView(overlays, false, [124, 48, 260, 48], 13);
        mapRef.current = map;
        playbackMarkerRef.current = playbackMarker;
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
      mapRef.current?.destroy?.();
      mapRef.current = null;
      playbackMarkerRef.current = null;
    };
  }, [points]);

  useEffect(() => {
    if (!points.length) return;
    const index = Math.min(points.length - 1, Math.round(progress * (points.length - 1)));
    playbackMarkerRef.current?.setPosition?.([points[index].lng, points[index].lat]);
  }, [points, progress]);

  return (
    <div className="fleet-amap-layer">
      <MapShell containerRef={containerRef} loadState={loadState} loadingText="正在加载轨迹地图" />
    </div>
  );
}

// 单点地图：车辆当前位置、充电位置共用。
export function FleetSpotMap({ lng, lat, label, tone = "vehicle" }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [loadState, setLoadState] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    loadAmap()
      .then((AMap) => {
        if (cancelled || !containerRef.current) return;
        const map = new AMap.Map(containerRef.current, {
          center: [lng, lat],
          zoom: 14.2,
          viewMode: "2D",
          resizeEnable: true,
          animateEnable: false,
          mapStyle: "amap://styles/whitesmoke",
          features: ["bg", "road", "building", "point"],
        });
        map.add(new AMap.Marker({
          position: [lng, lat],
          offset: new AMap.Pixel(-15, -15),
          content: `<span class="fleet-spot-marker ${tone}" title="${label ?? ""}"></span>`,
        }));
        mapRef.current = map;
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
      mapRef.current?.destroy?.();
      mapRef.current = null;
    };
  }, [lng, lat, label, tone]);

  return (
    <div className="fleet-spot-map">
      <MapShell containerRef={containerRef} loadState={loadState} loadingText="正在加载位置" />
    </div>
  );
}

// 单次行程静态轨迹：不带播放控制，用于行车日志查看。
export function FleetTripTrackMap({ points }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [loadState, setLoadState] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    if (!points.length) return undefined;
    loadAmap()
      .then((AMap) => {
        if (cancelled || !containerRef.current) return;
        const path = points.map((point) => [point.lng, point.lat]);
        const map = new AMap.Map(containerRef.current, {
          center: path[0],
          zoom: 12.4,
          viewMode: "2D",
          resizeEnable: true,
          animateEnable: false,
          mapStyle: "amap://styles/whitesmoke",
          features: ["bg", "road", "building", "point"],
        });
        const polyline = new AMap.Polyline({ path, strokeColor: "#2563eb", strokeWeight: 5, strokeOpacity: 0.88, lineJoin: "round" });
        const startMarker = new AMap.Marker({ position: path[0], offset: new AMap.Pixel(-14, -14), content: '<span class="fleet-track-marker start">起</span>' });
        const endMarker = new AMap.Marker({ position: path[path.length - 1], offset: new AMap.Pixel(-14, -14), content: '<span class="fleet-track-marker end">终</span>' });
        map.add([polyline, startMarker, endMarker]);
        map.setFitView([polyline], false, [60, 40, 60, 40], 13);
        mapRef.current = map;
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
      mapRef.current?.destroy?.();
      mapRef.current = null;
    };
  }, [points]);

  return (
    <div className="fleet-spot-map tall">
      <MapShell containerRef={containerRef} loadState={loadState} loadingText="正在加载行程轨迹" />
    </div>
  );
}
