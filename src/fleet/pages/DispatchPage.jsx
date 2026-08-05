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

// 调度页内容已并入首页“经营调度”，保留为可复用区块，避免两处维护同一套入口。
export function DispatchOverview({ onBusinessAction }) {
  return (
    <section className="fleet-dispatch-workbench" aria-label="业务入口">
      <div className="fleet-dispatch-grid">
        {DISPATCH_ACTIONS.map(({ id, label, Icon }) => (
          <button key={id} type="button" onClick={() => onBusinessAction(id, label)}><span><Icon aria-hidden="true" /></span><b>{label}</b></button>
        ))}
      </div>
    </section>
  );
}
