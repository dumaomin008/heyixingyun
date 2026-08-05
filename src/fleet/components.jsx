import { useState } from "react";
import { Building2, ChevronDown, ChevronLeft, UsersRound } from "lucide-react";
import { getScopeOptions, resolveScope, scopeTree } from "./scope.js";

// 一级页共享的标题与数据范围入口，保证在任何入口切换时范围口径一致。
export function ScopeHeader({ title, scopeSelection, onScopeChange, className = "" }) {
  const [scopeExpanded, setScopeExpanded] = useState(false);
  const scope = resolveScope(scopeSelection);
  const { organization, fleets } = getScopeOptions(scopeSelection);

  function changeOrganization(organizationId) {
    const nextOrganization = scopeTree.find((item) => item.id === organizationId);
    const nextDepartment = nextOrganization.departments[0];
    onScopeChange({ organizationId, departmentId: nextDepartment.id, fleetId: nextDepartment.fleets[0]?.id ?? "" });
  }

  function changeDepartment(departmentId) {
    const nextDepartment = organization.departments.find((item) => item.id === departmentId);
    onScopeChange({ ...scopeSelection, departmentId, fleetId: nextDepartment.fleets[0]?.id ?? "" });
  }

  return (
    <header className={`fleet-page-title fleet-home-title ${className}`.trim()}>
      <div className="fleet-home-title-copy">
        <h1>{title}</h1>
        <button
          type="button"
          className="fleet-home-scope-trigger"
          aria-label={`切换当前组织范围：${scope.path.join("，")}`}
          aria-expanded={scopeExpanded}
          onClick={() => setScopeExpanded((value) => !value)}
        >
          <b>{scope.fleet?.name ?? scope.department.name}</b><ChevronDown aria-hidden="true" />
        </button>
        {scopeExpanded && (
          <section className="fleet-home-scope-panel" aria-label="当前登录人数据范围">
            <label><Building2 aria-hidden="true" /><span>组织</span><select aria-label="选择组织" value={scopeSelection.organizationId} onChange={(event) => changeOrganization(event.target.value)}>{scopeTree.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label><Building2 aria-hidden="true" /><span>部门</span><select aria-label="选择部门" value={scopeSelection.departmentId} onChange={(event) => changeDepartment(event.target.value)}>{organization.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label><UsersRound aria-hidden="true" /><span>车队</span><select aria-label="选择车队" value={scopeSelection.fleetId} disabled={!fleets.length} onChange={(event) => onScopeChange({ ...scopeSelection, fleetId: event.target.value })}>{fleets.length ? fleets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : <option value="">暂无车队</option>}</select><em>当前</em></label>
          </section>
        )}
      </div>
    </header>
  );
}

// 非首页只保留一致的一级页标题，组织范围统一从首页切换，避免高频作业页重复入口。
export function PrimaryPageHeader({ title, className = "" }) {
  return (
    <header className={`fleet-page-title fleet-home-title fleet-title-only ${className}`.trim()}>
      <div className="fleet-home-title-copy"><h1>{title}</h1></div>
    </header>
  );
}

// 所有二级页共用的顶部返回栏。
export function PageHeader({ title, subtitle, onBack, action, showBackLabel = false }) {
  return (
    <header className="fleet-detail-header">
      <button type="button" className={showBackLabel ? "page-back page-back-labeled" : "page-back"} aria-label="返回" onClick={onBack}>
        <ChevronLeft aria-hidden="true" />
        {showBackLabel && <span>返回</span>}
      </button>
      <div className="fleet-detail-heading">
        {subtitle && <span>{subtitle}</span>}
        <h1>{title}</h1>
      </div>
      {action}
    </header>
  );
}

export function EmptyState({ title, hint }) {
  return (
    <section className="fleet-log-empty">
      <b>{title}</b>
      {hint && <span>{hint}</span>}
    </section>
  );
}

// 快捷时间段选择，替代 PC 端的精确时间选择器。
export function RangeTabs({ options, value, onChange }) {
  return (
    <section className="fleet-log-filter" aria-label="时间范围">
      {options.map((item) => (
        <button key={item} type="button" className={value === item ? "active" : ""} onClick={() => onChange(item)}>
          {item}
        </button>
      ))}
    </section>
  );
}

export function Pagination({ page, pageSize, total, onChange }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <nav className="fleet-pagination" aria-label="分页">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>上一页</button>
      <span>{page} / {pageCount}</span>
      <button type="button" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>下一页</button>
    </nav>
  );
}

export function StatusPill({ status }) {
  const tone = status === "在线" ? "online" : status === "离线" ? "offline" : "never";
  return <span className={`fleet-status-pill ${tone}`}>{status}</span>;
}

export function SocBar({ soc, threshold }) {
  if (soc === null || soc === undefined) return <span className="fleet-soc-na">无数据</span>;
  const low = soc <= (threshold ?? 30);
  return (
    <span className={`fleet-soc-bar ${low ? "low" : ""}`}>
      <i style={{ width: `${Math.max(4, soc)}%` }} />
      <b>{soc}%</b>
    </span>
  );
}

// 键值对数据网格，单车监控、车辆档案、日报表共用。
export function DataGrid({ rows, highlightKey }) {
  return (
    <dl className="fleet-realtime-grid">
      {rows.map(([label, value]) => (
        <div key={label} className={highlightKey && highlightKey(label, value) ? "alarm" : undefined}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
