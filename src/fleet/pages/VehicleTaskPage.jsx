import { MapPin } from "lucide-react";
import { EmptyState, PageHeader } from "../components.jsx";

// 车辆卡片的任务单入口：只展示当前车辆相关的运输任务。
export function VehicleTaskPage({ vehicle, onBack }) {
  const tasks = vehicle.taskOrders ?? [];

  return (
    <section className="fleet-detail-page" aria-label={`${vehicle.plate}任务单`}>
      <PageHeader title="任务单" subtitle={vehicle.plate} onBack={onBack} />
      <div className="fleet-detail-body fleet-task-list-body">
        <p className="fleet-log-count">当前车辆共 {tasks.length} 张任务单</p>
        {tasks.length ? tasks.map((task) => (
          <article className="fleet-log-card fleet-task-order" key={task.id}>
            <div className="fleet-log-card-title">
              <b>{task.id}</b>
              <span className={task.status === "运输中" ? "in-progress" : "pending"}>{task.status}</span>
            </div>
            <p><MapPin aria-hidden="true" />{task.loadAddress}</p>
            <p><MapPin aria-hidden="true" />{task.unloadAddress}</p>
            <small>计划发车：{task.planAt}</small>
          </article>
        )) : <EmptyState title="暂无任务单" hint="该车辆当前没有待执行或运输中的任务" />}
      </div>
    </section>
  );
}
