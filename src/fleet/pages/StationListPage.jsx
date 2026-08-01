import { useMemo, useState } from "react";
import { Copy, MapPin, Navigation, Search, X } from "lucide-react";
import { PageHeader } from "../components.jsx";

const DISTANCE_OPTIONS = ["不限", "10km", "20km", "50km"];

function StationNavigationSheet({ station, onClose, onToast }) {
  const [failedApp, setFailedApp] = useState("");

  function chooseMap(name) {
    if (name === "百度地图") {
      setFailedApp(name);
      onToast("百度地图拉起失败，请重新选择或复制地址");
      return;
    }
    onToast(`已拉起${name}，目的地：${station.shortName || station.name}`);
    onClose();
  }

  return (
    <div className="fleet-station-nav-mask" role="presentation">
      <section className="fleet-station-nav-sheet" aria-label="选择导航地图">
        <header>
          <h2>选择导航地图</h2>
          <button type="button" aria-label="关闭" onClick={onClose}><X aria-hidden="true" /></button>
        </header>
        <div>
          {["高德地图", "百度地图", "腾讯地图"].map((name) => (
            <button key={name} type="button" className={failedApp === name ? "failed" : ""} onClick={() => chooseMap(name)}>
              <b>{name}</b><span>{failedApp === name ? "未安装或拉起失败" : `导航至 ${station.shortName || station.name}`}</span>
            </button>
          ))}
        </div>
        {failedApp && (
          <footer>
            <p>外部地图拉起失败，可重新选择地图或复制地址。</p>
            <button type="button" onClick={() => onToast("已复制地址")}>复制地址</button>
          </footer>
        )}
      </section>
    </div>
  );
}

export function StationQuickCard({ station, onClose, onNavigate, onCopy, panelRef }) {
  return (
    <section ref={panelRef} className="fleet-station-panel" aria-label="已选充电场站">
      <button type="button" className="fleet-station-panel-close" aria-label="收起场站卡片" onClick={onClose}><i aria-hidden="true" /></button>
      <h2>{station.name}</h2>
      <dl>
        <div><dt>距离</dt><dd>{station.distance.text}</dd></div>
        <div><dt>当前电价</dt><dd>{station.priceText}</dd></div>
        <div className="fleet-station-panel-address"><dt>地址</dt><dd>{station.address}</dd></div>
        <div><dt>充电桩</dt><dd>{station.totalPiles} 台</dd></div>
      </dl>
      <div className="fleet-station-panel-actions">
        <button type="button" className="primary" onClick={onNavigate}><Navigation aria-hidden="true" />导航</button>
        <button type="button" onClick={onCopy}><Copy aria-hidden="true" />复制地址</button>
      </div>
    </section>
  );
}

export function StationListPage({ stations, onBack, onToast }) {
  const [keyword, setKeyword] = useState("");
  const [distance, setDistance] = useState("不限");
  const [navStation, setNavStation] = useState(null);
  const filteredStations = useMemo(() => {
    const limit = distance === "不限" ? Infinity : Number(distance.replace("km", ""));
    const query = keyword.trim();
    return stations.filter((station) => (
      (!query || `${station.name}${station.address}`.includes(query))
      && (station.distance.type === "none" || station.distance.value <= limit)
    ));
  }, [distance, keyword, stations]);

  return (
    <section className="fleet-detail-page fleet-station-list-page" aria-label="场站列表">
      <PageHeader title="场站列表" onBack={onBack} />
      <div className="fleet-page-body">
        <label className="fleet-station-list-search">
          <Search aria-hidden="true" />
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索场站名称" />
        </label>
        <nav className="fleet-station-distance-filter" aria-label="距离筛选">
          {DISTANCE_OPTIONS.map((item) => (
            <button key={item} type="button" className={distance === item ? "active" : ""} onClick={() => setDistance(item)}>{item}</button>
          ))}
        </nav>
        <section className="fleet-station-list" aria-label="场站结果">
          {filteredStations.length ? filteredStations.map((station, index) => (
            <article key={station.id}>
              <div>
                <b><em>{index + 1}</em>{station.name}</b>
                <span>{station.distance.text}｜当前 {station.priceText}｜充电桩 {station.totalPiles} 台</span>
                <small><MapPin aria-hidden="true" />{station.address}</small>
              </div>
              <button type="button" aria-label={`导航至${station.name}`} onClick={() => setNavStation(station)}><Navigation aria-hidden="true" /></button>
            </article>
          )) : <p>暂无符合条件的场站</p>}
        </section>
      </div>
      {navStation && <StationNavigationSheet station={navStation} onClose={() => setNavStation(null)} onToast={onToast} />}
    </section>
  );
}

export { StationNavigationSheet };
