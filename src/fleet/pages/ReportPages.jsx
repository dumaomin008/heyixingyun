import { useState } from "react";
import { PageHeader, RangeTabs } from "../components.jsx";
import { getDailyReports, getRawMessages } from "../data.js";

// 单车日报表：保留 TSP 端行驶 / 能耗 / 充电三类核心指标。
export function DailyReportPage({ vehicle, onBack }) {
  const [range, setRange] = useState("近 7 天");
  const [activeDate, setActiveDate] = useState(null);
  const reports = getDailyReports(vehicle.id);
  const current = reports.find((item) => item.date === activeDate) ?? reports[0];

  return (
    <section className="fleet-detail-page" aria-label="单车日报表">
      <PageHeader title="单车日报表" subtitle={vehicle.plate} onBack={onBack} />
      <div className="fleet-detail-body fleet-log-body">
        <RangeTabs options={["近 7 天", "近 30 天", "自定义"]} value={range} onChange={setRange} />

        <section className="fleet-report-dates" aria-label="日期">
          {reports.map((item) => (
            <button key={item.date} type="button" className={current.date === item.date ? "active" : ""} onClick={() => setActiveDate(item.date)}>
              {item.date.slice(5)}
            </button>
          ))}
        </section>

        <section className="fleet-report-highlight">
          <div><span>日总行驶里程</span><b>{current.mileage}<small> km</small></b></div>
          <div><span>日行驶次数</span><b>{current.trips}<small> 次</small></b></div>
          <div><span>日总行驶时间</span><b>{current.drivingHours}<small> h</small></b></div>
          <div><span>日平均速度</span><b>{current.avgSpeed}<small> km/h</small></b></div>
        </section>

        <section className="fleet-detail-section">
          <h2>行驶统计</h2>
          <dl className="fleet-detail-grid">
            <div><dt>日活跃总时间</dt><dd>{current.activeHours} h</dd></div>
            <div><dt>单次运行最大里程</dt><dd>{current.maxTripMileage} km</dd></div>
            <div><dt>总里程</dt><dd>{vehicle.totalMileage.toLocaleString()} km</dd></div>
            <div><dt>数据最后上传</dt><dd>{current.lastUploadAt}</dd></div>
          </dl>
        </section>

        <section className="fleet-detail-section">
          <h2>能耗统计</h2>
          <dl className="fleet-detail-grid">
            <div><dt>实际百公里耗电量</dt><dd>{current.energyPer100km} kWh</dd></div>
            <div><dt>单次充电后最大耗电</dt><dd>{current.maxEnergyPerCharge} kWh</dd></div>
          </dl>
        </section>

        <section className="fleet-detail-section">
          <h2>充电统计</h2>
          <dl className="fleet-detail-grid">
            <div><dt>充电总次数</dt><dd>{current.chargeTimes} 次</dd></div>
            <div><dt>充电总时长</dt><dd>{current.chargeHours} h</dd></div>
            <div><dt>日充电电量</dt><dd>{current.chargeElectricity} kWh</dd></div>
            <div><dt>单次最长充电</dt><dd>{current.maxChargeHours} h</dd></div>
            <div><dt>单次最大充电量</dt><dd>{current.maxChargeElectricity} kWh</dd></div>
            <div><dt>单次充电最大里程</dt><dd>{current.maxMileagePerCharge} km</dd></div>
          </dl>
        </section>
      </div>
    </section>
  );
}

// 明细数据查询：移动端只展示关键报文字段。
export function RawDataPage({ vehicle, onBack }) {
  const [range, setRange] = useState("近 1 小时");
  const messages = getRawMessages(vehicle.id);

  return (
    <section className="fleet-detail-page" aria-label="明细数据">
      <PageHeader title="明细数据" subtitle={vehicle.plate} onBack={onBack} />
      <div className="fleet-detail-body fleet-log-body">
        <RangeTabs options={["近 1 小时", "近 6 小时", "今天"]} value={range} onChange={setRange} />
        <p className="fleet-log-count">{range} · 共 {messages.length} 条报文 · 仅展示关键字段</p>
        {messages.map((item) => (
          <article key={item.id} className={`fleet-raw-card ${item.status === "异常" ? "abnormal" : ""}`}>
            <div className="fleet-raw-card-top">
              <b>{item.collectedAt}</b>
              <span>{item.status}</span>
            </div>
            <dl>
              <div><dt>车速</dt><dd>{item.speed} km/h</dd></div>
              <div><dt>SOC</dt><dd>{item.soc}%</dd></div>
              <div><dt>总电压</dt><dd>{item.voltage} V</dd></div>
              <div><dt>总电流</dt><dd>{item.current} A</dd></div>
              <div><dt>里程</dt><dd>{item.mileage.toLocaleString()} km</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
