// 组织树来自后台「部门管理」。生产环境以登录态和授权范围返回这些 ID；
// 演示环境使用相同层级和确定性车队归属，验证切换后的数据口径。
export const scopeTree = [
  { id: "wotong", name: "内蒙古沃通智行物流科技有限公司", departments: [{ id: "wotong-default", name: "默认部门", fleets: [] }] },
  {
    id: "yunnan-lifu",
    name: "云南力伏星新能源有限公司",
    departments: [
      { id: "finance", name: "财务部（宁核聚力）", fleets: [] },
      { id: "chengdu", name: "成都校区", fleets: [] },
      { id: "guangxi", name: "广西钦圣", fleets: [] },
      { id: "hr", name: "人资部（宁核聚力）", fleets: [] },
      { id: "sales", name: "销售部（宁核聚力）", fleets: [] },
      { id: "yunnan-qinsheng", name: "云南钦圣新能源科技有限公司", fleets: [{ id: "qinsheng-team-1", name: "一车队（云南钦圣）" }, { id: "qinsheng-team-2", name: "二车队（云南钦圣）" }] },
    ],
  },
  { id: "heavy-truck-test", name: "重卡测试组", departments: [{ id: "test-default", name: "测试运营部", fleets: [] }] },
];

export const defaultScopeSelection = { organizationId: "yunnan-lifu", departmentId: "yunnan-qinsheng", fleetId: "qinsheng-team-1" };

export function getScopeOptions(selection) {
  const organization = scopeTree.find((item) => item.id === selection.organizationId) ?? scopeTree[0];
  const department = organization.departments.find((item) => item.id === selection.departmentId) ?? organization.departments[0];
  return { organization, department, fleets: department.fleets };
}

export function resolveScope(selection) {
  const { organization, department, fleets } = getScopeOptions(selection);
  const fleet = fleets.find((item) => item.id === selection.fleetId) ?? null;
  return { organization, department, fleet, path: [organization.name, department.name, fleet?.name].filter(Boolean) };
}

export function scopeMatchesVehicle(vehicle, selection) {
  return vehicle.organizationId === selection.organizationId
    && vehicle.departmentId === selection.departmentId
    && (!selection.fleetId || vehicle.fleetId === selection.fleetId);
}
