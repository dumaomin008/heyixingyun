import {
  BatteryCharging,
  BatteryLow,
  ClipboardCheck,
  ClipboardList,
  Gauge,
  Handshake,
  KeyRound,
  ListTodo,
  PackageCheck,
  ShieldCheck,
  Truck,
  UserRound,
  UsersRound,
  Warehouse,
} from "lucide-react";
import { PrimaryPageHeader } from "../components.jsx";

const DISPATCH_ACTIONS = [
  { id: "dispatch", label: "调度派车", Icon: Truck },
  { id: "waybill", label: "运单", Icon: ClipboardList },
  { id: "appointment", label: "预约列表", Icon: ListTodo },
  { id: "dock", label: "月台分配", Icon: Warehouse },
  { id: "handover", label: "车辆交接", Icon: PackageCheck },
  { id: "carrier", label: "委派承运商", Icon: Handshake },
  { id: "alerts", label: "报警处理", Icon: BatteryLow },
  { id: "inspection", label: "车辆检查管理", Icon: ShieldCheck },
  { id: "lock", label: "蓝钧开关锁", Icon: KeyRound },
  { id: "vehicle-list", label: "车辆列表", Icon: Truck },
  { id: "trailer", label: "挂车列表", Icon: ClipboardCheck },
  { id: "driver", label: "司机列表", Icon: UserRound },
  { id: "charging", label: "充电桩状态", Icon: BatteryCharging },
  { id: "visitor", label: "访客管理", Icon: UsersRound },
  { id: "manage", label: "管理", Icon: Gauge },
];

export function DispatchPage({ onBusinessAction }) {
  return (
    <section className="fleet-content-page fleet-dispatch-page" aria-label="调度">
      <PrimaryPageHeader title="调度" className="fleet-dispatch-title" />
      <div className="fleet-page-body fleet-dispatch-body">
        <section className="fleet-dispatch-status" aria-labelledby="dispatch-status-title">
          <div><span>今日待办</span><h2 id="dispatch-status-title">优先处理待派与在途任务</h2></div>
          <div className="fleet-dispatch-status-grid">
            <button type="button" onClick={() => onBusinessAction("dispatch", "调度派车")}><b>235</b><span>待派车</span></button>
            <button type="button" onClick={() => onBusinessAction("waybill", "运单")}><b>2</b><span>待运输</span></button>
            <button type="button" onClick={() => onBusinessAction("waybill", "运单")}><b>21</b><span>运输中</span></button>
          </div>
        </section>

        <section className="fleet-dispatch-workbench" aria-labelledby="dispatch-workbench-title">
          <div className="fleet-home-section-heading"><div><span>原首页业务能力</span><h2 id="dispatch-workbench-title">调度工作台</h2></div><span className="fleet-home-entry-count">15 项服务</span></div>
          <div className="fleet-dispatch-grid">
            {DISPATCH_ACTIONS.map(({ id, label, Icon }) => (
              <button key={id} type="button" onClick={() => onBusinessAction(id, label)}><span><Icon aria-hidden="true" /></span><b>{label}</b></button>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
