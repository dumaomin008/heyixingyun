import { useState } from "react";
import { ChevronDown, ChevronRight, MapPin, Plus } from "lucide-react";
import { EmptyState, PageHeader } from "../components.jsx";

function TaskInfoTabs({ value, onChange }) {
  return (
    <nav className="fleet-task-source-tabs" aria-label="任务信息切换" role="tablist">
      <button type="button" role="tab" aria-selected={value === "task"} className={value === "task" ? "active" : ""} onClick={() => onChange("task")}>任务信息</button>
      <button type="button" role="tab" aria-selected={value === "route"} className={value === "route" ? "active" : ""} onClick={() => onChange("route")}>路线信息</button>
    </nav>
  );
}

function TaskNodes({ task, currentNode = 0, completed = false }) {
  const loadSite = task.loadSite ?? { name: task.loadAddress, address: task.loadAddress };
  const unloadSite = task.unloadSite ?? { name: task.unloadAddress, address: task.unloadAddress };
  const nodes = [
    { label: completed ? "起" : "1", title: loadSite.name, address: loadSite.address, type: "装货地" },
    { label: completed ? "终" : "2", title: unloadSite.name, address: unloadSite.address, type: "卸货地" },
  ];

  return (
    <section className={`fleet-task-source-nodes ${completed ? "completed" : ""}`} aria-label="运输节点">
      <h2>运输节点 {!completed && <small>({currentNode + 1}/2)</small>}</h2>
      <ol>
        {nodes.map((node, index) => (
          <li key={node.type} className={`${index === currentNode ? "current" : ""} ${index < currentNode ? "passed" : ""}`}>
            <span className="fleet-task-source-marker">{node.label}</span>
            <div className="fleet-task-source-node-copy">
              <div>
                <b>{node.title || "地址信息暂无"}</b>
                {!completed && <span>{node.type}</span>}
              </div>
              <p>{node.address || "地址信息暂无"}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DetailFields({ vehicle, task, locationExpanded, onLocationClick }) {
  return (
    <section className="fleet-task-source-fields" aria-label="任务详情">
      <div className="fleet-task-source-order">
        <span>任务单号：</span><b>{task.id}</b><ChevronDown aria-hidden="true" />
      </div>
      <dl>
        <div><dt>要求发车时间</dt><dd>{task.planAt}</dd></div>
        <div><dt>备注</dt><dd /></div>
        <div><dt>高速入口</dt><dd /></div>
        <div><dt>高速出口</dt><dd /></div>
        <div><dt>最新定位时间</dt><dd>{vehicle.locationAt ?? "暂无定位时间"}</dd></div>
        <div className={locationExpanded ? "location expanded" : "location"}>
          <dt>最新位置</dt>
          <dd>
            <button type="button" aria-expanded={locationExpanded} onClick={onLocationClick}>
              <MapPin aria-hidden="true" />{vehicle.latestLocation ?? vehicle.location}
            </button>
          </dd>
        </div>
      </dl>
      <button type="button" className="fleet-task-source-plus" aria-label="查看附加路线信息"><Plus aria-hidden="true" /></button>
    </section>
  );
}

// 任务页采用现有司机端小程序的页面骨架；车队长只复刻查看与追踪信息，不执行司机动作。
export function VehicleTaskPage({ vehicle, onBack }) {
  const activeTasks = (vehicle.taskOrders ?? []).filter((task) => !["已完成", "已关闭"].includes(task.status));
  const [detailView, setDetailView] = useState("task");
  const [locationExpanded, setLocationExpanded] = useState(false);
  const activeTask = activeTasks[0];

  return (
    <section className="fleet-detail-page fleet-task-source-page" aria-label={`${vehicle.plate}任务单`}>
      <PageHeader title="执行中任务" onBack={onBack} action={<span className="fleet-task-source-header-spacer" aria-hidden="true" />} />
      <div className="fleet-detail-body fleet-task-source-body">
        {activeTask ? <>
          <TaskInfoTabs value={detailView} onChange={setDetailView} />
          {detailView === "task" ? <>
            <DetailFields vehicle={vehicle} task={activeTask} locationExpanded={locationExpanded} onLocationClick={() => setLocationExpanded((value) => !value)} />
            <button type="button" className="fleet-task-source-event">历史上报事件<ChevronRight aria-hidden="true" /></button>
            <button type="button" className="fleet-task-source-report" onClick={() => setLocationExpanded(true)}>上报当前位置</button>
            <TaskNodes task={activeTask} currentNode={activeTask.currentNode} />
            <button type="button" className="fleet-task-source-arrive" onClick={() => setLocationExpanded(true)}>到达</button>
          </> : <section className="fleet-task-route-info"><TaskNodes task={activeTask} currentNode={activeTask.currentNode} /></section>}
        </> : <div className="fleet-task-source-empty"><EmptyState title="暂无执行中任务" hint="该车辆当前没有待执行或运输中的任务" /></div>}
      </div>
    </section>
  );
}
