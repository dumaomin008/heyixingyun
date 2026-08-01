import { useState } from "react";
import { ChevronRight, Star } from "lucide-react";
import { PrimaryPageHeader } from "../components.jsx";
import { FLEET_PROFILE } from "../data.js";

export function ProfilePage({
  followedVehicles,
  subscriptionEnabled,
  onToggleSubscription,
  onOpenVehicle,
  onOpenPage,
  onEditVehicle,
}) {
  return (
    <section className="fleet-content-page" aria-label="我的">
      <PrimaryPageHeader title="我的" />
      <div className="fleet-page-body fleet-profile-body">
        <section className="fleet-profile-card">
          <b>{FLEET_PROFILE.name}</b>
          <span>{FLEET_PROFILE.team} · {FLEET_PROFILE.role}</span>
          <small>已授权查看本车队车辆</small>
        </section>

        <section className="fleet-settings-list" aria-label="账号设置">
          <button type="button"><span>所属组织</span><b>{FLEET_PROFILE.org}</b></button>
          <button type="button"><span>所属车队</span><b>{FLEET_PROFILE.team}</b></button>
          <button type="button" className="fleet-subscription-row" onClick={onToggleSubscription}>
            <span>预警订阅</span>
            <b className={subscriptionEnabled ? "enabled" : ""}>{subscriptionEnabled ? "已开启" : "未开启"}</b>
          </button>
          <button type="button" onClick={() => onOpenPage("monitored-vehicles")}>
            <span>监控车辆</span><b>{followedVehicles.length} 辆 <ChevronRight aria-hidden="true" /></b>
          </button>
          <button type="button"><span>关于车辆监控</span><b>版本 1.0</b></button>
        </section>

        <section className="fleet-followed-list" aria-label="关注车辆">
          <header><h2>关注车辆</h2><span>{followedVehicles.length} 辆</span></header>
          {followedVehicles.length ? followedVehicles.map((vehicle) => (
            <article key={vehicle.id} className="fleet-followed-row">
              <button type="button" onClick={() => onOpenVehicle(vehicle)}>
                <Star aria-hidden="true" fill="currentColor" />
                <div>
                  <b>{vehicle.plate}</b>
                  <span>{vehicle.onlineStatus} · SOC {vehicle.soc === null ? "—" : `${vehicle.soc}%`}</span>
                </div>
              </button>
              <button type="button" className="fleet-followed-edit" onClick={() => onEditVehicle(vehicle)}>编辑</button>
            </article>
          )) : <p>暂未关注车辆</p>}
        </section>
      </div>
    </section>
  );
}

// 监控车辆单条编辑：仅金融渠道、经销商、票据号码三个业务字段，与 TSP 端一致。
export function MonitoredVehicleEditor({ vehicle, onClose, onSave }) {
  const [form, setForm] = useState({
    financeChannel: vehicle.financeChannel,
    dealer: vehicle.dealer,
    invoiceNo: vehicle.invoiceNo,
  });
  const complete = form.financeChannel.trim() && form.dealer.trim() && form.invoiceNo.trim();

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="fleet-modal-mask" role="dialog" aria-modal="true" aria-label="编辑监控车辆">
      <section className="fleet-modal">
        <header><h2>编辑监控车辆</h2><span>{vehicle.plate}</span></header>
        <label>
          <span>金融渠道</span>
          <input value={form.financeChannel} onChange={(event) => update("financeChannel", event.target.value)} placeholder="必填" />
        </label>
        <label>
          <span>经销商</span>
          <input value={form.dealer} onChange={(event) => update("dealer", event.target.value)} placeholder="必填" />
        </label>
        <label>
          <span>票据号码</span>
          <input value={form.invoiceNo} onChange={(event) => update("invoiceNo", event.target.value)} placeholder="必填" />
        </label>
        <footer>
          <button type="button" onClick={onClose}>取消</button>
          <button type="button" className="primary" disabled={!complete} onClick={() => onSave(vehicle.id, form)}>保存</button>
        </footer>
      </section>
    </div>
  );
}
