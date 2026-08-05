import { PrimaryPageHeader } from "../components.jsx";
import { FLEET_PROFILE } from "../data.js";

export function ProfilePage({
  subscriptionEnabled,
  onToggleSubscription,
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
          <button type="button"><span>关于车辆监控</span><b>版本 1.0</b></button>
        </section>
      </div>
    </section>
  );
}
